"""Eidothea API. Run with: uvicorn app.main:app --reload (from api/)."""

import json
import re
import sqlite3
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from . import accounts, db, guard, insights, mail, moderation, reading, social
from .notify import notify
from .accounts import MemberUser, ReaderUser, grant_membership, user_json
from .deps import Conn, CurrentUser, ModUser, OptionalUser
from .gaming import with_gaming_category
from .security import ROLE_LEVEL, assignable_roles, can_edit_story, can_manage_user, level

WORDS_PER_MINUTE = 200


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    if not mail.READY:
        mail.log.warning("SMTP_HOST is not set: emails will be printed here instead of sent (see the README)")
    yield


app = FastAPI(title="Eidothea", lifespan=lifespan)
app.include_router(accounts.router)
app.include_router(insights.router)
app.include_router(moderation.router)
app.include_router(reading.router)
app.include_router(social.router)


# --------------------------------------------------------------------------- models

Status = Literal["draft", "published"]
# Content warnings a writer can put on a story; readers see them before the text
ContentWarning = Literal[
    "gore", "body-horror", "self-harm", "suicide", "abuse", "sexual-content", "animal-harm", "child-harm", "substance-use",
]


class StoryIn(BaseModel):
    # Drafts may be empty; publishing checks the lengths (see check_publishable)
    title: str = Field(default="", max_length=200)
    subtitle: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=100_000)
    tags: list[str] = Field(default_factory=list, max_length=15)
    categories: list[str] = Field(default_factory=list, max_length=5)
    warnings: list[ContentWarning] = Field(default_factory=list, max_length=9)
    status: Status = "published"

    @field_validator("title", "subtitle", "body")
    @classmethod
    def strip_text(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v

    @field_validator("tags", "categories")
    @classmethod
    def clean_list(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        seen, out = set(), []
        for item in (s.strip()[:60] for s in v):
            if item and item.lower() not in seen:
                seen.add(item.lower())
                out.append(item)
        return out

    @field_validator("warnings")
    @classmethod
    def unique_warnings(cls, v: list[str] | None) -> list[str] | None:
        return list(dict.fromkeys(v)) if v is not None else v


class StoryPatch(StoryIn):
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=300)
    body: str | None = Field(default=None, max_length=100_000)
    tags: list[str] | None = Field(default=None, max_length=15)
    categories: list[str] | None = Field(default=None, max_length=5)
    warnings: list[ContentWarning] | None = Field(default=None, max_length=9)
    status: Status | None = None


class RatingIn(BaseModel):
    score: int = Field(ge=1, le=10)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    parent_id: int | None = None  # replying to this comment

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("cannot be blank")
        return v


class VoteIn(BaseModel):
    value: Literal[-1, 0, 1]


class RoleIn(BaseModel):
    role: Literal["user", "mod", "admin"]


class MembershipIn(BaseModel):
    member: bool


class GenreIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    blurb: str = Field(default="", max_length=200)

    @field_validator("name", "blurb")
    @classmethod
    def tidy(cls, v: str) -> str:
        return " ".join(v.split())


# --------------------------------------------------------------------------- helpers

def reading_minutes(body: str) -> int:
    return max(1, round(len(body.split()) / WORDS_PER_MINUTE))


def like(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# Stories matching a search, best first: a hit in the title counts most, then subtitle and tags, then the text
SEARCH_SQL = """SELECT rowid AS id, bm25(stories_fts, 10.0, 4.0, 4.0, 1.0) AS rank
                FROM stories_fts WHERE stories_fts MATCH ?"""


def fts_query(q: str) -> str | None:
    """A search box's words as a full-text query: every word must appear (in any form:
    "haunted" finds "haunting"), and the last one may be half-typed."""
    words = re.findall(r"[^\W_]+", q)[:12]
    if not words:
        return None
    return " ".join(f'"{w}"' for w in words) + "*"


# A story's score blends the source dataset's rating, counted as this many votes,
# with readers' 1-10 scores. Community stories are scored by readers alone.
ARCHIVE_WEIGHT = 5
MIN_BODY = 50

STORY_FROM = """stories s
    LEFT JOIN users u ON u.id = s.author_id
    LEFT JOIN (SELECT story_id, COUNT(*) AS n, SUM(score) AS total FROM story_ratings GROUP BY story_id) r
           ON r.story_id = s.id"""

STORY_COLUMNS = f"""
    s.id, s.title, s.subtitle, s.author_id, s.author_name, u.username AS author_username,
    COALESCE(u.profile_public, 0) AS author_public, COALESCE(u.role, 'user') AS author_role,
    s.tags, s.categories, s.warnings, s.rating AS archive_rating, s.reading_minutes, s.source, s.truncated,
    s.status, s.published_at, s.updated_at,
    COALESCE(r.n, 0) AS rating_count,
    CASE WHEN s.rating IS NULL THEN r.total * 1.0 / r.n
         ELSE (s.rating * {ARCHIVE_WEIGHT} + COALESCE(r.total, 0)) / ({ARCHIVE_WEIGHT} + COALESCE(r.n, 0))
    END AS score,
    (SELECT COUNT(*) FROM comments c WHERE c.story_id = s.id) AS comment_count,
    (SELECT COUNT(*) FROM recommends rc WHERE rc.story_id = s.id) AS recommend_count
"""


def story_json(row, user, *, body: bool = False) -> dict:
    out = {
        "id": row["id"],
        "title": row["title"],
        "subtitle": row["subtitle"],
        "author": row["author_username"] or row["author_name"],
        "author_id": row["author_id"],
        "author_public": bool(row["author_public"]),
        "tags": json.loads(row["tags"]),
        "categories": json.loads(row["categories"]),
        "warnings": json.loads(row["warnings"]),
        "rating": round(row["score"], 2) if row["score"] is not None else None,
        "archive_rating": row["archive_rating"],
        "rating_count": row["rating_count"],
        "comment_count": row["comment_count"],
        "recommend_count": row["recommend_count"],
        "reading_minutes": row["reading_minutes"],
        "source": row["source"],
        "truncated": bool(row["truncated"]),
        "status": row["status"],
        "published_at": row["published_at"],
        "updated_at": row["updated_at"],
        "can_edit": can_edit_story(user, row),
    }
    if body:
        out["body"] = row["body"]
    else:
        out["excerpt"] = row["excerpt"]
    return out


def fetch_story(conn, story_id: int, user):
    """A story the user may see. Drafts are only visible to their author."""
    row = conn.execute(
        f"SELECT {STORY_COLUMNS}, s.body, s.announced_at FROM {STORY_FROM} WHERE s.id = ?", (story_id,)
    ).fetchone()
    if not row or (row["status"] == "draft" and (not user or row["author_id"] != user["id"])):
        raise HTTPException(404, "No such story. Maybe there never was.")
    return row


def fetch_published(conn, story_id: int, user):
    row = fetch_story(conn, story_id, user)
    if row["status"] != "published":
        raise HTTPException(409, "Publish the story first.")
    return row


def check_publishable(title: str, body: str) -> None:
    if not title:
        raise HTTPException(422, "Give your story a title before publishing.")
    if len(body) < MIN_BODY:
        raise HTTPException(422, f"Stories need at least {MIN_BODY} characters to be published.")


def with_reads(conn, user, items: list[dict]) -> list[dict]:
    """Marks the stories this reader has started or finished, for the cards' read markers."""
    if not user or not items:
        return items
    reads = {r["story_id"]: r for r in conn.execute(
        f"""SELECT story_id, progress, finished FROM reads
            WHERE user_id = ? AND story_id IN ({','.join('?' * len(items))})""",
        [user["id"], *(i["id"] for i in items)],
    )}
    for i in items:
        r = reads.get(i["id"])
        i["my_read"] = {"progress": r["progress"], "finished": bool(r["finished"])} if r else None
    return items


def rating_json(conn, story_id: int, user) -> dict:
    row = fetch_story(conn, story_id, user)
    mine = conn.execute(
        "SELECT score FROM story_ratings WHERE story_id = ? AND user_id = ?", (story_id, user["id"])
    ).fetchone()
    return {
        "rating": round(row["score"], 2) if row["score"] is not None else None,
        "rating_count": row["rating_count"],
        "my_rating": mine["score"] if mine else None,
    }


# --------------------------------------------------------------------------- stories

@app.get("/api/stories")
def list_stories(
    conn: Conn,
    user: OptionalUser,
    q: str = "",
    category: str = "",
    sort: Literal["relevance", "new", "trending", "rating", "short", "long"] | None = None,
    source: Literal["all", "user", "import"] = "all",
    mine: bool = False,
    author: str = "",
    recommended_by: str = "",
    following: bool = False,
    bookmarked: bool = False,
    status: Status = "published",
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=60),
):
    # Joins come first in the SQL, so their arguments go first too
    with_sql, joins, join_args = "", "", []
    where, args = ["s.status = ?"], [status]
    match = fts_query(q)
    if match:
        # Materialized: run the search once, not once per story. `ft` is the stories with every word in the title.
        with_sql = f"WITH f AS MATERIALIZED ({SEARCH_SQL}), ft AS MATERIALIZED ({SEARCH_SQL}) "
        joins += " LEFT JOIN f ON f.id = s.id LEFT JOIN ft ON ft.id = s.id"
        join_args += [match, f"title : ({match})"]
        where.append("(f.id IS NOT NULL OR COALESCE(u.username, s.author_name) LIKE ? ESCAPE '\\')")
        args.append(like(q.strip()))
    elif q.strip():  # only punctuation: nothing for the index to go on
        where.append("s.title LIKE ? ESCAPE '\\'")
        args.append(like(q.strip()))
    if category:
        where.append("EXISTS (SELECT 1 FROM json_each(s.categories) WHERE value = ?)")
        args.append(category)
    if source != "all":
        where.append("s.source = ?")
        args.append(source)
    if author:
        where.append("u.username = ?")
        args.append(author)
    if recommended_by:
        where.append("""EXISTS (SELECT 1 FROM recommends rb JOIN users ru ON ru.id = rb.user_id
                                WHERE rb.story_id = s.id AND ru.username = ?)""")
        args.append(recommended_by)
    if following:
        if not user:
            raise HTTPException(401, "You need to log in first.")
        where.append("s.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)")
        args.append(user["id"])
    if mine or status == "draft":
        if not user:
            raise HTTPException(401, "You need to log in first.")
        where.append("s.author_id = ?")
        args.append(user["id"])

    if bookmarked:
        if not user:
            raise HTTPException(401, "You need to log in first.")
        joins += " JOIN bookmarks bm ON bm.story_id = s.id AND bm.user_id = ?"
        join_args.append(user["id"])

    where_sql = "WHERE " + " AND ".join(where)
    newest = (
        "bm.created_at DESC, s.id DESC" if bookmarked  # most recently saved first
        else "COALESCE(s.updated_at, s.published_at) DESC, s.id DESC" if status == "draft"
        else "s.published_at DESC, s.id DESC"
    )
    if not sort or (sort == "relevance" and not match):
        sort = "relevance" if match else "new"
    order_sql = {
        # Title matches first, then bm25 (lower is better); author-only matches last
        "relevance": "f.rank IS NULL, ft.id IS NULL, f.rank, s.id DESC",
        "new": newest,
        "trending": "COALESCE(t.heat, 0) DESC, score IS NULL, score DESC, s.id DESC",
        "rating": "score IS NULL, score DESC, rating_count DESC, s.id",
        "short": "s.reading_minutes ASC, s.id",
        "long": "s.reading_minutes DESC, s.id",
    }[sort]

    trending = f" LEFT JOIN ({reading.HEAT_SQL}) t ON t.story_id = s.id" if sort == "trending" else ""
    base = f"FROM {STORY_FROM}{joins}{trending} {where_sql}"
    args = [*join_args, *args]
    total = conn.execute(f"{with_sql}SELECT COUNT(*) {base}", args).fetchone()[0]
    rows = conn.execute(
        f"{with_sql}SELECT {STORY_COLUMNS}, substr(s.body, 1, 320) AS excerpt {base} ORDER BY {order_sql} LIMIT ? OFFSET ?",
        [*args, per_page, (page - 1) * per_page],
    ).fetchall()
    items = with_reads(conn, user, [story_json(r, user) for r in rows])
    if match and items:
        # Show the part of the story that matched instead of its opening lines
        hits = dict(conn.execute(
            f"""SELECT rowid, snippet(stories_fts, 3, '', '', '…', 40) FROM stories_fts
                WHERE stories_fts MATCH ? AND rowid IN ({','.join('?' * len(items))})""",
            [match, *(i["id"] for i in items)],
        ).fetchall())
        for i in items:
            if hits.get(i["id"]):
                i["excerpt"] = hits[i["id"]]
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // per_page)),
    }


@app.get("/api/stories/for-you")
def for_you(conn: Conn, user: ReaderUser, limit: int = Query(6, ge=1, le=24)):
    """Unread stories in the genres this reader finishes and rates well, hottest first."""
    cats = conn.execute(reading.affinity_sql(), {"uid": user["id"]}).fetchall()
    if not cats:
        return {"items": [], "based_on": []}
    rows = conn.execute(
        f"""WITH cats AS ({reading.affinity_sql()})
            SELECT {STORY_COLUMNS}, substr(s.body, 1, 320) AS excerpt,
                   (SELECT SUM(c.w) FROM json_each(s.categories) j JOIN cats c ON c.cat = j.value) AS fit
            FROM {STORY_FROM} LEFT JOIN ({reading.HEAT_SQL}) t ON t.story_id = s.id
            WHERE s.status = 'published' AND s.author_id IS NOT :uid
              AND s.id NOT IN (SELECT story_id FROM reads WHERE user_id = :uid)
              AND s.id NOT IN (SELECT story_id FROM story_ratings WHERE user_id = :uid)
              AND fit > 0
            ORDER BY fit * COALESCE(score, 6) / 10 + COALESCE(t.heat, 0) * 0.2 DESC, s.id DESC
            LIMIT :limit""",
        {"uid": user["id"], "limit": limit},
    ).fetchall()
    return {"items": [story_json(r, user) for r in rows], "based_on": [c["cat"] for c in cats[:3]]}


@app.get("/api/stories/continue")
def continue_reading(conn: Conn, user: CurrentUser, limit: int = Query(3, ge=1, le=24)):
    """Stories this reader got into but didn't finish, most recently read first."""
    rows = conn.execute(
        f"""SELECT {STORY_COLUMNS}, substr(s.body, 1, 320) AS excerpt
            FROM {STORY_FROM} JOIN reads rd ON rd.story_id = s.id AND rd.user_id = ?
            WHERE s.status = 'published' AND NOT rd.finished AND rd.progress < ? AND rd.seconds >= ?
            ORDER BY rd.last_at DESC LIMIT ?""",
        (user["id"], reading.FINISHED_PROGRESS, reading.STARTED_SECONDS, limit),
    ).fetchall()
    return {"items": with_reads(conn, user, [story_json(r, user) for r in rows])}


@app.get("/api/stories/random")
def random_story(conn: Conn):
    row = conn.execute("SELECT id FROM stories WHERE status = 'published' ORDER BY random() LIMIT 1").fetchone()
    if not row:
        raise HTTPException(404, "The archive is empty.")
    return {"id": row["id"]}


@app.get("/api/stories/{story_id}")
def get_story(story_id: int, conn: Conn, user: OptionalUser):
    out = story_json(fetch_story(conn, story_id, user), user, body=True)
    if user:
        out["my_rating"] = rating_json(conn, story_id, user)["my_rating"]
        out["recommended"] = social.recommend_state(conn, story_id, user)["recommended"]
        out["bookmarked"] = social.bookmark_state(conn, story_id, user)["bookmarked"]
        with_reads(conn, user, [out])
    return out


@app.get("/api/stories/{story_id}/related")
def related(story_id: int, conn: Conn, user: OptionalUser, limit: int = Query(4, ge=1, le=12)):
    """What to read next: stories that share this one's genres, tags or writer, and above all
    the ones people who finished this also finished. Skips what the reader has already finished."""
    fetch_published(conn, story_id, user)
    rows = conn.execute(
        f"""WITH me AS (SELECT categories, tags, author_id FROM stories WHERE id = :id),
                 also AS (SELECT r2.story_id, COUNT(*) AS n FROM reads r1
                          JOIN reads r2 ON r2.user_id = r1.user_id AND r2.story_id <> r1.story_id AND r2.finished
                          WHERE r1.story_id = :id AND r1.finished GROUP BY r2.story_id)
            SELECT {STORY_COLUMNS}, substr(s.body, 1, 320) AS excerpt,
                   2 * (SELECT COUNT(*) FROM json_each(s.categories) a, json_each((SELECT categories FROM me)) b
                        WHERE a.value = b.value)
                   + (SELECT COUNT(*) FROM json_each(s.tags) a, json_each((SELECT tags FROM me)) b
                      WHERE lower(a.value) = lower(b.value))
                   + (s.author_id IS NOT NULL AND s.author_id = (SELECT author_id FROM me))
                   + 3 * COALESCE(also.n, 0) AS fit
            FROM {STORY_FROM} LEFT JOIN also ON also.story_id = s.id
            WHERE s.status = 'published' AND s.id <> :id AND fit > 0
              AND s.id NOT IN (SELECT story_id FROM reads WHERE user_id = :uid AND finished)
            ORDER BY fit DESC, score IS NULL, score DESC, s.id DESC
            LIMIT :limit""",
        {"id": story_id, "uid": user["id"] if user else None, "limit": limit},
    ).fetchall()
    return {"items": with_reads(conn, user, [story_json(r, user) for r in rows])}


@app.post("/api/stories", status_code=201)
def create_story(story: StoryIn, conn: Conn, user: MemberUser, tasks: BackgroundTasks):
    if story.status == "published":
        check_publishable(story.title, story.body)
        guard.check_daily_cap(conn, user, "stories")
    categories = with_gaming_category(story.categories, story.title, story.tags, story.body)
    cur = conn.execute(
        """INSERT INTO stories (title, subtitle, body, author_id, tags, categories, warnings, reading_minutes, source, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', ?)""",
        (story.title, story.subtitle, story.body, user["id"], json.dumps(story.tags), json.dumps(categories),
         json.dumps(story.warnings), reading_minutes(story.body), story.status),
    )
    if story.status == "published":
        social.announce_story(conn, cur.lastrowid, user["id"], tasks)
    conn.commit()
    return story_json(fetch_story(conn, cur.lastrowid, user), user, body=True)


@app.patch("/api/stories/{story_id}")
def update_story(story_id: int, patch: StoryPatch, conn: Conn, user: MemberUser, tasks: BackgroundTasks):
    existing = fetch_story(conn, story_id, user)
    if not can_edit_story(user, existing):
        raise HTTPException(403, "You can only edit your own stories.")

    changes = patch.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        return story_json(existing, user, body=True)
    if changes.get("status") == "draft" and existing["author_id"] != user["id"]:
        raise HTTPException(403, "Only the author can take a story back to drafts.")
    status = changes.get("status", existing["status"])
    # Only a story's first time live is new; one taken back to drafts returns as it was
    debut = existing["status"] == "draft" and status == "published" and not existing["announced_at"]
    if status == "published":
        check_publishable(changes.get("title", existing["title"]), changes.get("body", existing["body"]))
        if debut:
            guard.check_daily_cap(conn, user, "stories")
    if "body" in changes:
        changes["reading_minutes"] = reading_minutes(changes["body"])
        changes["truncated"] = 0
    if {"title", "body", "tags", "categories"} & changes.keys():
        changes["categories"] = with_gaming_category(
            changes.get("categories", json.loads(existing["categories"])),
            changes.get("title", existing["title"]),
            changes.get("tags", json.loads(existing["tags"])),
            changes.get("body", existing["body"]),
        )
    for key in ("tags", "categories", "warnings"):
        if key in changes:
            changes[key] = json.dumps(changes[key])

    assignments = ", ".join(f"{k} = ?" for k in changes)
    # A draft going live is new: it gets today's date and no "edited" mark
    stamp = "published_at = datetime('now'), updated_at = NULL" if debut else "updated_at = datetime('now')"
    conn.execute(f"UPDATE stories SET {assignments}, {stamp} WHERE id = ?", [*changes.values(), story_id])
    if debut and existing["author_id"]:
        social.announce_story(conn, story_id, existing["author_id"], tasks)
    conn.commit()
    return story_json(fetch_story(conn, story_id, user), user, body=True)


@app.delete("/api/stories/{story_id}", status_code=204)
def delete_story(story_id: int, conn: Conn, user: CurrentUser):
    if not can_edit_story(user, fetch_story(conn, story_id, user)):
        raise HTTPException(403, "You can only delete your own stories.")
    conn.execute("DELETE FROM stories WHERE id = ?", (story_id,))
    conn.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------- ratings

@app.put("/api/stories/{story_id}/rating")
def rate_story(story_id: int, body: RatingIn, conn: Conn, user: MemberUser):
    if fetch_published(conn, story_id, user)["author_id"] == user["id"]:
        raise HTTPException(403, "You can't rate your own story.")
    conn.execute(
        """INSERT INTO story_ratings (story_id, user_id, score) VALUES (?, ?, ?)
           ON CONFLICT (story_id, user_id) DO UPDATE SET score = excluded.score, created_at = datetime('now')""",
        (story_id, user["id"], body.score),
    )
    conn.commit()
    return rating_json(conn, story_id, user)


@app.delete("/api/stories/{story_id}/rating")
def unrate_story(story_id: int, conn: Conn, user: MemberUser):
    fetch_story(conn, story_id, user)
    conn.execute("DELETE FROM story_ratings WHERE story_id = ? AND user_id = ?", (story_id, user["id"]))
    conn.commit()
    return rating_json(conn, story_id, user)


# --------------------------------------------------------------------------- comments

COMMENT_SELECT = """
    SELECT c.id, c.story_id, c.user_id, c.parent_id, c.body, c.created_at, u.username, u.role,
           COALESCE(SUM(v.value = 1), 0) AS likes,
           COALESCE(SUM(v.value = -1), 0) AS dislikes,
           MAX(CASE WHEN v.user_id = ? THEN v.value END) AS my_vote
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN comment_votes v ON v.comment_id = c.id
"""


def comment_json(row, user) -> dict:
    return {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "body": row["body"],
        "created_at": row["created_at"],
        "author": row["username"],
        "author_id": row["user_id"],
        "author_role": row["role"],
        "likes": row["likes"],
        "dislikes": row["dislikes"],
        "my_vote": row["my_vote"] or 0,
        # The writer, or staff who outrank them (as with stories)
        "can_delete": bool(user) and (
            row["user_id"] == user["id"] or level(user) >= ROLE_LEVEL["mod"] and level(user) > ROLE_LEVEL[row["role"]]
        ),
    }


def fetch_comment(conn, comment_id: int, user):
    row = conn.execute(
        f"{COMMENT_SELECT} WHERE c.id = ? GROUP BY c.id", (user["id"] if user else None, comment_id)
    ).fetchone()
    if not row:
        raise HTTPException(404, "That comment is gone.")
    return row


@app.get("/api/stories/{story_id}/comments")
def list_comments(story_id: int, conn: Conn, user: OptionalUser, sort: Literal["top", "new"] = "top"):
    fetch_story(conn, story_id, user)
    order = "likes - dislikes DESC, c.id DESC" if sort == "top" else "c.id DESC"
    rows = conn.execute(
        f"{COMMENT_SELECT} WHERE c.story_id = ? GROUP BY c.id ORDER BY {order} LIMIT 500",
        (user["id"] if user else None, story_id),
    ).fetchall()
    return [comment_json(r, user) for r in rows]


# "@name" in a comment, but not inside an email address
MENTION = re.compile(r"(?<![\w@])@([A-Za-z0-9_-]{3,24})")
MAX_MENTIONS = 5


@app.post("/api/stories/{story_id}/comments", status_code=201)
def add_comment(story_id: int, comment: CommentIn, conn: Conn, user: MemberUser):
    story = fetch_published(conn, story_id, user)
    guard.check_daily_cap(conn, user, "comments")
    parent = None
    if comment.parent_id is not None:
        parent = conn.execute(
            "SELECT id, parent_id, user_id FROM comments WHERE id = ? AND story_id = ?", (comment.parent_id, story_id)
        ).fetchone()
        if not parent:
            raise HTTPException(404, "The comment you're replying to is gone.")
    # Threads are one level deep: a reply to a reply joins the same thread
    root = parent and (parent["parent_id"] or parent["id"])
    cur = conn.execute(
        "INSERT INTO comments (story_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)",
        (story_id, user["id"], root, comment.body),
    )
    # Each person hears about it once, by the most specific reason
    told = {user["id"]}
    if parent and parent["user_id"] not in told:
        notify(conn, parent["user_id"], "reply", actor_id=user["id"], story_id=story_id, comment_id=cur.lastrowid)
        told.add(parent["user_id"])
    if story["author_id"] and story["author_id"] not in told:
        notify(conn, story["author_id"], "comment", actor_id=user["id"], story_id=story_id, comment_id=cur.lastrowid)
        told.add(story["author_id"])
    names = list(dict.fromkeys(n.lower() for n in MENTION.findall(comment.body)))[:MAX_MENTIONS]
    if names:
        mentioned = conn.execute(
            f"SELECT id FROM users WHERE username IN ({','.join('?' * len(names))})", names
        ).fetchall()
        for m in mentioned:
            if m["id"] not in told:
                notify(conn, m["id"], "mention", actor_id=user["id"], story_id=story_id, comment_id=cur.lastrowid)
                told.add(m["id"])
    conn.commit()
    return comment_json(fetch_comment(conn, cur.lastrowid, user), user)


@app.delete("/api/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, conn: Conn, user: CurrentUser):
    if not comment_json(fetch_comment(conn, comment_id, user), user)["can_delete"]:
        raise HTTPException(403, "You can only delete your own comments.")
    conn.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    conn.commit()
    return Response(status_code=204)


@app.put("/api/comments/{comment_id}/vote")
def vote_comment(comment_id: int, vote: VoteIn, conn: Conn, user: MemberUser):
    fetch_comment(conn, comment_id, user)
    if vote.value:
        conn.execute(
            """INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, ?, ?)
               ON CONFLICT (comment_id, user_id) DO UPDATE SET value = excluded.value""",
            (comment_id, user["id"], vote.value),
        )
    else:
        conn.execute("DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?", (comment_id, user["id"]))
    conn.commit()
    return comment_json(fetch_comment(conn, comment_id, user), user)


# --------------------------------------------------------------------------- browse helpers

@app.get("/api/categories")
def categories(conn: Conn):
    rows = conn.execute(
        """SELECT j.value AS name, COUNT(*) AS count
           FROM stories s, json_each(s.categories) j
           WHERE s.status = 'published'
           GROUP BY j.value ORDER BY count DESC, name"""
    ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/genres")
def list_genres(conn: Conn):
    rows = conn.execute(
        """SELECT g.name, g.blurb,
                  (SELECT COUNT(*) FROM stories s, json_each(s.categories) j
                   WHERE s.status = 'published' AND j.value = g.name) AS count
           FROM genres g ORDER BY g.created_at, g.name"""
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/genres", status_code=201)
def add_genre(body: GenreIn, conn: Conn, user: ModUser):
    try:
        conn.execute("INSERT INTO genres (name, blurb, created_by) VALUES (?, ?, ?)", (body.name, body.blurb, user["id"]))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That genre already exists.")
    conn.commit()
    return list_genres(conn)


@app.delete("/api/genres/{name}")
def remove_genre(name: str, conn: Conn, _user: ModUser):
    # Stories keep the genre; it just stops being offered to writers
    conn.execute("DELETE FROM genres WHERE name = ?", (name,))
    conn.commit()
    return list_genres(conn)


@app.get("/api/stats")
def stats(conn: Conn):
    row = conn.execute(
        """SELECT COUNT(*) AS stories,
                  SUM(source = 'user') AS community,
                  (SELECT COUNT(*) FROM users) AS users,
                  COALESCE(SUM(reading_minutes), 0) AS minutes
           FROM stories WHERE status = 'published'"""
    ).fetchone()
    return {k: row[k] or 0 for k in row.keys()}


# --------------------------------------------------------------------------- users (admin+)

def require_admin(user: CurrentUser):
    if level(user) < ROLE_LEVEL["admin"]:
        raise HTTPException(403, "Admins only.")
    return user


AdminUser = Annotated[sqlite3.Row, Depends(require_admin)]


def fetch_user(conn, user_id: int):
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "No such user.")
    return row


@app.get("/api/users")
def list_users(conn: Conn, actor: AdminUser):
    rows = conn.execute(
        """SELECT u.*, COUNT(s.id) AS story_count
           FROM users u LEFT JOIN stories s ON s.author_id = u.id AND s.status = 'published'
           GROUP BY u.id ORDER BY u.created_at, u.id"""
    ).fetchall()
    return {
        "assignable_roles": assignable_roles(actor),
        "users": [
            {**user_json(r), "story_count": r["story_count"], "can_manage": can_manage_user(actor, r)}
            for r in rows
        ],
    }


@app.patch("/api/users/{user_id}")
def set_role(user_id: int, body: RoleIn, conn: Conn, actor: AdminUser):
    target = fetch_user(conn, user_id)
    if not can_manage_user(actor, target) or body.role not in assignable_roles(actor):
        raise HTTPException(403, "You don't outrank them.")
    conn.execute("UPDATE users SET role = ? WHERE id = ?", (body.role, user_id))
    conn.commit()
    return user_json(fetch_user(conn, user_id))


@app.patch("/api/users/{user_id}/membership")
def set_membership(user_id: int, body: MembershipIn, conn: Conn, actor: AdminUser):
    target = fetch_user(conn, user_id)
    if not can_manage_user(actor, target):
        raise HTTPException(403, "You don't outrank them.")
    if body.member:
        grant_membership(conn, user_id, "granted")
    else:
        conn.execute("UPDATE users SET member = 0 WHERE id = ?", (user_id,))
    conn.commit()
    return user_json(fetch_user(conn, user_id))


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: int, conn: Conn, actor: AdminUser):
    if not can_manage_user(actor, fetch_user(conn, user_id)):
        raise HTTPException(403, "You don't outrank them.")
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))  # sessions and stories cascade
    conn.commit()
    return Response(status_code=204)
