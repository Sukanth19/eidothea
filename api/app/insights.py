"""Profiles, visitor analytics and the /insights endpoints (overseer + people they let in)."""

import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import urllib.request
from typing import Annotated, Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from .deps import Conn, CurrentUser, OptionalUser
from .security import can_view_insights

router = APIRouter()
log = logging.getLogger("eidothea")

SIGNUP_WEBHOOK_URL = os.environ.get("SIGNUP_WEBHOOK_URL", "")
BOTS = re.compile(r"bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless", re.I)
SOURCE_TAG = re.compile(r"^[a-z0-9_-]{1,24}$")


def require_insights(user: CurrentUser):
    if not can_view_insights(user):
        raise HTTPException(403, "Insights are for the Overseer and the people they let in.")
    return user


InsightsUser = Annotated[sqlite3.Row, Depends(require_insights)]


# --------------------------------------------------------------------------- signup alerts

def announce_signup(username: str, source: str | None, landing: str | None) -> None:
    """Posts to a Discord webhook when someone joins, if SIGNUP_WEBHOOK_URL is set. Never raises."""
    if not SIGNUP_WEBHOOK_URL:
        return
    lines = [f"🕯️ **{username}** just joined Eidothea."]
    if source:
        lines.append(f"Heard about it from: {source}")
    if landing:
        lines.append(f"First visit came from: {landing}")
    req = urllib.request.Request(
        SIGNUP_WEBHOOK_URL,
        data=json.dumps({"content": "\n".join(lines)}).encode(),
        headers={"content-type": "application/json", "user-agent": "eidothea"},
    )
    try:
        urllib.request.urlopen(req, timeout=5).close()
    except Exception as e:  # an unreachable webhook must not affect signing up
        log.warning("signup webhook failed: %s", e)


# --------------------------------------------------------------------------- page views

class Hit(BaseModel):
    path: str = Field(max_length=300)
    source: str | None = Field(default=None, max_length=40)
    referrer: str | None = Field(default=None, max_length=500)


def daily_salt(conn) -> str:
    row = conn.execute("SELECT salt FROM analytics_salt WHERE day = date('now')").fetchone()
    if row:
        return row["salt"]
    salt = secrets.token_hex(16)
    conn.execute("INSERT OR IGNORE INTO analytics_salt (day, salt) VALUES (date('now'), ?)", (salt,))
    # Yesterday's salt is thrown away, so yesterday's visitors can't be linked to today's.
    # Old page views go too (kept for about a year).
    conn.execute("DELETE FROM analytics_salt WHERE day <> date('now')")
    conn.execute("DELETE FROM pageviews WHERE day < date('now', '-400 days')")
    conn.commit()
    return conn.execute("SELECT salt FROM analytics_salt WHERE day = date('now')").fetchone()["salt"]


def device_of(ua: str) -> str:
    if re.search(r"iPad|Tablet", ua, re.I):
        return "tablet"
    return "phone" if re.search(r"Mobi|Android|iPhone", ua, re.I) else "computer"


@router.post("/api/hit", status_code=204)
def hit(body: Hit, request: Request, conn: Conn):
    ua = request.headers.get("user-agent", "")
    path = body.path.split("?")[0]
    if not ua or BOTS.search(ua) or not path.startswith("/") or path.startswith(("/insights", "/admin", "/api")):
        return Response(status_code=204)

    # Only a salted hash is kept; the IP itself is never stored
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "")
    visitor = hashlib.sha256(f"{daily_salt(conn)}|{ip}|{ua}".encode()).hexdigest()[:16]

    source = (body.source or "").lower()
    if not SOURCE_TAG.match(source):
        source = ""
    if not source and body.referrer:
        host = (urlparse(body.referrer).hostname or "").removeprefix("www.").removeprefix("m.")
        own = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0]
        if host and host != own:
            source = host[:60]

    story = re.fullmatch(r"/stories/(\d+)", path)
    conn.execute(
        "INSERT INTO pageviews (path, story_id, source, visitor, device) VALUES (?, ?, ?, ?, ?)",
        (path, int(story[1]) if story else None, source or None, visitor, device_of(ua)),
    )
    conn.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------- profiles

class ProfileIn(BaseModel):
    display_name: str = Field(default="", max_length=40)
    bio: str = Field(default="", max_length=300)
    instagram: str = Field(default="", max_length=31)
    profile_public: bool = False

    @field_validator("display_name", "bio")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("instagram")
    @classmethod
    def handle(cls, v: str) -> str:
        v = v.strip().removeprefix("@")
        if v and not re.fullmatch(r"[A-Za-z0-9._]{1,30}", v):
            raise ValueError("letters, numbers, dots and underscores only")
        return v


def profile_json(row) -> dict:
    return {
        "username": row["username"],
        "role": row["role"],
        "created_at": row["created_at"],
        "display_name": row["display_name"],
        "bio": row["bio"],
        "instagram": row["instagram"],
        "profile_public": bool(row["profile_public"]),
    }


@router.get("/api/me/profile")
def my_profile(conn: Conn, user: CurrentUser):
    return profile_json(conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone())


@router.put("/api/me/profile")
def save_profile(body: ProfileIn, conn: Conn, user: CurrentUser):
    conn.execute(
        "UPDATE users SET display_name = ?, bio = ?, instagram = ?, profile_public = ? WHERE id = ?",
        (body.display_name, body.bio, body.instagram, int(body.profile_public), user["id"]),
    )
    conn.commit()
    return my_profile(conn, user)


@router.get("/api/profiles/{username}")
def public_profile(username: str, conn: Conn, user: OptionalUser):
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    # Private profiles exist only for their owner and insights viewers
    if not row or not (row["profile_public"] or (user and user["id"] == row["id"]) or can_view_insights(user)):
        raise HTTPException(404, "No one by that name. Or no one who wants to be found.")
    out = profile_json(row)
    out["story_count"] = conn.execute(
        "SELECT COUNT(*) FROM stories WHERE author_id = ? AND status = 'published'", (row["id"],)
    ).fetchone()[0]
    return out


# --------------------------------------------------------------------------- insights

def _rows(conn, sql: str, args=()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


@router.get("/api/insights/overview")
def overview(conn: Conn, _viewer: InsightsUser, days: int = 30):
    days = max(1, min(days, 365))
    since = f"-{days - 1} days"
    daily = _rows(
        conn,
        """SELECT day, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views
           FROM pageviews WHERE day >= date('now', ?) GROUP BY day ORDER BY day""",
        (since,),
    )
    signups = {r["day"]: r["n"] for r in _rows(
        conn,
        "SELECT date(created_at) AS day, COUNT(*) AS n FROM users WHERE date(created_at) >= date('now', ?) GROUP BY day",
        (since,),
    )}

    def window(n: int) -> dict:
        r = conn.execute(
            """SELECT COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visitors
               FROM pageviews WHERE day >= date('now', ?)""",
            (f"-{n - 1} days",),
        ).fetchone()
        joined = conn.execute(
            "SELECT COUNT(*) FROM users WHERE date(created_at) >= date('now', ?)", (f"-{n - 1} days",)
        ).fetchone()[0]
        return {"views": r["views"], "visitors": r["visitors"], "signups": joined}

    return {
        "days": days,
        "today": window(1),
        "week": window(7),
        "month": window(30),
        "daily": [{**d, "signups": signups.get(d["day"], 0)} for d in daily],
        "top_stories": _rows(
            conn,
            """SELECT p.story_id AS id, s.title, COUNT(*) AS views, COUNT(DISTINCT p.day || p.visitor) AS readers
               FROM pageviews p JOIN stories s ON s.id = p.story_id
               WHERE p.day >= date('now', ?) GROUP BY p.story_id ORDER BY readers DESC, views DESC LIMIT 10""",
            (since,),
        ),
        "sources": _rows(
            conn,
            """SELECT COALESCE(source, 'direct') AS source, COUNT(DISTINCT day || visitor) AS visitors
               FROM pageviews WHERE day >= date('now', ?) GROUP BY 1 ORDER BY visitors DESC LIMIT 12""",
            (since,),
        ),
        "devices": _rows(
            conn,
            """SELECT device, COUNT(DISTINCT day || visitor) AS visitors
               FROM pageviews WHERE day >= date('now', ?) GROUP BY device ORDER BY visitors DESC""",
            (since,),
        ),
        "heard_from": _rows(
            conn,
            """SELECT COALESCE(source, 'not answered') AS source, COUNT(*) AS users
               FROM users GROUP BY 1 ORDER BY users DESC""",
        ),
        "new_users": _rows(
            conn,
            """SELECT id, username, created_at, source, landing FROM users
               WHERE created_at >= datetime('now', '-7 days') ORDER BY created_at DESC""",
        ),
        "totals": dict(conn.execute(
            """SELECT (SELECT COUNT(*) FROM users) AS users,
                      (SELECT COUNT(*) FROM stories WHERE status = 'published' AND source = 'user') AS community_stories,
                      (SELECT COUNT(*) FROM comments) AS comments,
                      (SELECT COUNT(*) FROM story_ratings) AS ratings"""
        ).fetchone()),
    }


USER_STATS = """
    u.id, u.username, u.role, u.created_at, u.last_seen_at, u.source, u.landing,
    u.display_name, u.insights, u.profile_public,
    (SELECT COUNT(*) FROM stories s WHERE s.author_id = u.id AND s.status = 'published') AS stories,
    (SELECT COUNT(*) FROM stories s WHERE s.author_id = u.id AND s.status = 'draft') AS drafts,
    (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments,
    (SELECT COUNT(*) FROM story_ratings r WHERE r.user_id = u.id) AS ratings
"""


def user_stats_json(r) -> dict:
    return {**dict(r), "insights": r["role"] == "overseer" or bool(r["insights"]), "profile_public": bool(r["profile_public"])}


@router.get("/api/insights/users")
def insight_users(conn: Conn, _viewer: InsightsUser, sort: Literal["joined", "active"] = "joined"):
    order = "u.created_at DESC" if sort == "joined" else "u.last_seen_at IS NULL, u.last_seen_at DESC"
    return [user_stats_json(r) for r in conn.execute(f"SELECT {USER_STATS} FROM users u ORDER BY {order}").fetchall()]


@router.get("/api/insights/users/{user_id}")
def insight_user(user_id: int, conn: Conn, _viewer: InsightsUser):
    row = conn.execute(f"SELECT {USER_STATS}, u.bio, u.instagram FROM users u WHERE u.id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "No such user.")
    rated = conn.execute("SELECT AVG(score) FROM story_ratings WHERE user_id = ?", (user_id,)).fetchone()[0]
    return {
        **user_stats_json(row),
        "average_rating_given": round(rated, 1) if rated is not None else None,
        "recent_stories": _rows(
            conn,
            """SELECT id, title, status, published_at, updated_at FROM stories
               WHERE author_id = ? ORDER BY COALESCE(updated_at, published_at) DESC LIMIT 20""",
            (user_id,),
        ),
        "recent_comments": _rows(
            conn,
            """SELECT c.id, c.body, c.created_at, c.story_id, s.title AS story_title
               FROM comments c JOIN stories s ON s.id = c.story_id
               WHERE c.user_id = ? ORDER BY c.id DESC LIMIT 20""",
            (user_id,),
        ),
    }


class AccessIn(BaseModel):
    insights: bool


@router.put("/api/insights/users/{user_id}/access")
def set_access(user_id: int, body: AccessIn, conn: Conn, viewer: InsightsUser):
    if viewer["role"] != "overseer":
        raise HTTPException(403, "Only the Overseer decides who sees insights.")
    target = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not target:
        raise HTTPException(404, "No such user.")
    if target["role"] == "overseer":
        raise HTTPException(400, "The Overseer always has access.")
    conn.execute("UPDATE users SET insights = ? WHERE id = ?", (int(body.insights), user_id))
    conn.commit()
    return insight_user(user_id, conn, viewer)
