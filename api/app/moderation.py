"""Reports: readers flag a story or comment, the keepers dismiss it or take it down.
Suspensions: the keepers stop someone posting for a while, keeping what they've written."""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field, model_validator

from . import guard
from .accounts import ReaderUser
from .deps import Conn, ModUser, check_active
from .notify import notify
from .security import FOREVER, ROLE_LEVEL, can_edit_story, can_moderate_user, level, suspended_until

router = APIRouter()

Reason = Literal["spam", "harassment", "hate", "sexual", "self-harm", "stolen", "other"]


class Target(BaseModel):
    """Exactly one of a story or a comment."""
    story_id: int | None = None
    comment_id: int | None = None

    @model_validator(mode="after")
    def one_target(self):
        if (self.story_id is None) == (self.comment_id is None):
            raise ValueError("report a story or a comment")
        return self


class ReportIn(Target):
    reason: Reason
    note: str = Field(default="", max_length=500)


class ResolveIn(Target):
    action: Literal["dismiss", "remove"]


def target_author(conn, t: Target):
    """The reported thing's author id and role, or 404 if it's gone (or a draft)."""
    if t.story_id is not None:
        row = conn.execute(
            """SELECT s.author_id, COALESCE(u.role, 'user') AS author_role FROM stories s
               LEFT JOIN users u ON u.id = s.author_id WHERE s.id = ? AND s.status = 'published'""",
            (t.story_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """SELECT c.user_id AS author_id, u.role AS author_role FROM comments c
               JOIN users u ON u.id = c.user_id WHERE c.id = ?""",
            (t.comment_id,),
        ).fetchone()
    if not row:
        raise HTTPException(404, "That's already gone.")
    return row


@router.post("/api/reports", status_code=204)
def report(body: ReportIn, conn: Conn, user: ReaderUser):
    check_active(user)
    guard.limit(f"report:{user['id']}", 20, 3600, "That's a lot of reports. The keepers will get to them.")
    if target_author(conn, body)["author_id"] == user["id"]:
        raise HTTPException(400, "You can't report your own writing. You can delete it.")
    # One open report per person per thing; a second press just updates it
    cur = conn.execute(
        """UPDATE reports SET reason = ?, note = ? WHERE reporter_id = ? AND status = 'open'
           AND story_id IS ? AND comment_id IS ?""",
        (body.reason, body.note.strip(), user["id"], body.story_id, body.comment_id),
    )
    if not cur.rowcount:
        conn.execute(
            "INSERT INTO reports (reporter_id, story_id, comment_id, reason, note) VALUES (?, ?, ?, ?, ?)",
            (user["id"], body.story_id, body.comment_id, body.reason, body.note.strip()),
        )
    conn.commit()
    return Response(status_code=204)


@router.get("/api/reports")
def open_reports(conn: Conn, mod: ModUser):
    """Open reports, one entry per reported thing, the most reported first."""
    rows = conn.execute(
        """SELECT r.story_id, r.comment_id, r.reason, r.note, r.created_at, ru.username AS reporter,
                  COALESCE(r.story_id, c.story_id) AS link_story,
                  COALESCE(s.title, cs.title) AS story_title,
                  c.body AS comment_body,
                  COALESCE(su.username, s.author_name, cu.username) AS author,
                  COALESCE(s.author_id, c.user_id) AS author_id,
                  COALESCE(su.role, cu.role) AS author_role,
                  COALESCE(su.suspended_until, cu.suspended_until) AS author_suspended
           FROM reports r
           JOIN users ru ON ru.id = r.reporter_id
           LEFT JOIN stories s ON s.id = r.story_id LEFT JOIN users su ON su.id = s.author_id
           LEFT JOIN comments c ON c.id = r.comment_id LEFT JOIN users cu ON cu.id = c.user_id
           LEFT JOIN stories cs ON cs.id = c.story_id
           WHERE r.status = 'open' ORDER BY r.id"""
    ).fetchall()
    grouped: dict[tuple, dict] = {}
    for r in rows:
        key = (r["story_id"], r["comment_id"])
        g = grouped.setdefault(key, {
            "kind": "story" if r["story_id"] else "comment",
            "story_id": r["story_id"], "comment_id": r["comment_id"], "link_story": r["link_story"],
            "story_title": r["story_title"], "comment_body": r["comment_body"],
            "author": r["author"], "author_id": r["author_id"],
            "author_suspended_until": suspended_until({"suspended_until": r["author_suspended"]}),
            "can_suspend": bool(r["author_id"]) and can_moderate_user(mod, {"role": r["author_role"]}),
            "first_at": r["created_at"], "reasons": {}, "notes": [],
        })
        g["reasons"][r["reason"]] = g["reasons"].get(r["reason"], 0) + 1
        if r["note"]:
            g["notes"].append({"by": r["reporter"], "note": r["note"]})
    out = list(grouped.values())
    out.sort(key=lambda g: -sum(g["reasons"].values()))
    return out


@router.post("/api/reports/resolve")
def resolve(body: ResolveIn, conn: Conn, mod: ModUser):
    if body.action == "remove":
        author = target_author(conn, body)
        if body.story_id is not None:
            if not can_edit_story(mod, {"author_id": author["author_id"], "author_role": author["author_role"]}):
                raise HTTPException(403, "You don't outrank its writer.")
            conn.execute("DELETE FROM stories WHERE id = ?", (body.story_id,))  # its reports go with it
        else:
            if author["author_id"] != mod["id"] and level(mod) <= ROLE_LEVEL[author["author_role"]]:
                raise HTTPException(403, "You don't outrank its writer.")
            conn.execute("DELETE FROM comments WHERE id = ?", (body.comment_id,))
    else:
        conn.execute(
            """UPDATE reports SET status = 'dismissed', handled_by = ?, handled_at = datetime('now')
               WHERE status = 'open' AND story_id IS ? AND comment_id IS ?""",
            (mod["id"], body.story_id, body.comment_id),
        )
    conn.commit()
    return open_reports(conn, mod)


# --------------------------------------------------------------------------- suspensions

class SuspendIn(BaseModel):
    days: int | None = Field(default=None, ge=1, le=3650)  # None: until a keeper lifts it
    reason: str = Field(default="", max_length=300)


def suspendable(conn, user_id: int, mod):
    target = conn.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not target:
        raise HTTPException(404, "No such user.")
    if not can_moderate_user(mod, target):
        raise HTTPException(403, "You don't outrank them.")
    return target


@router.put("/api/users/{user_id}/suspension")
def suspend(user_id: int, body: SuspendIn, conn: Conn, mod: ModUser):
    """Stops someone posting, commenting, rating, voting and reporting. What they wrote stays."""
    suspendable(conn, user_id, mod)
    until = FOREVER if body.days is None else (
        datetime.now(timezone.utc) + timedelta(days=body.days)
    ).strftime("%Y-%m-%d %H:%M:%S")
    reason = " ".join(body.reason.split())
    conn.execute("UPDATE users SET suspended_until = ?, suspended_reason = ? WHERE id = ?", (until, reason, user_id))
    notify(conn, user_id, "suspended")  # no actor: which keeper did it stays with the keepers
    conn.commit()
    return {"suspended_until": until, "suspended_reason": reason}


@router.delete("/api/users/{user_id}/suspension")
def lift(user_id: int, conn: Conn, mod: ModUser):
    suspendable(conn, user_id, mod)
    conn.execute("UPDATE users SET suspended_until = NULL, suspended_reason = '' WHERE id = ?", (user_id,))
    conn.commit()
    return {"suspended_until": None, "suspended_reason": None}
