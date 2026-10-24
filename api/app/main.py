"""Eidothea API. Run with: uvicorn app.main:app --reload (from api/)."""

import json
import os
import sqlite3
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from . import db
from .security import (
    ROLE_LEVEL,
    SESSION_COOKIE,
    SESSION_DAYS,
    assignable_roles,
    can_edit_story,
    can_manage_user,
    create_session,
    delete_session,
    hash_password,
    level,
    user_for_token,
    verify_password,
)

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"
WORDS_PER_MINUTE = 200


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    yield


app = FastAPI(title="Eidothea", lifespan=lifespan)

Conn = Annotated[sqlite3.Connection, Depends(db.get_db)]


# --------------------------------------------------------------------------- auth deps

def optional_user(conn: Conn, eidothea_session: Annotated[str | None, Cookie()] = None):
    return user_for_token(conn, eidothea_session)


def require_user(user=Depends(optional_user)):
    if not user:
        raise HTTPException(401, "You need to log in first.")
    return user


OptionalUser = Annotated[sqlite3.Row | None, Depends(optional_user)]
CurrentUser = Annotated[sqlite3.Row, Depends(require_user)]


def user_json(u) -> dict:
    return {"id": u["id"], "username": u["username"], "role": u["role"], "created_at": u["created_at"]}


# --------------------------------------------------------------------------- models

class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)


class StoryIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=50, max_length=100_000)
    tags: list[str] = Field(default_factory=list, max_length=15)
    categories: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("title", "body")
    @classmethod
    def strip_text(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("cannot be blank")
        return v

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


class StoryPatch(StoryIn):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=50, max_length=100_000)
    tags: list[str] | None = Field(default=None, max_length=15)
    categories: list[str] | None = Field(default=None, max_length=5)


class RoleIn(BaseModel):
    role: Literal["user", "mod", "admin"]


# --------------------------------------------------------------------------- helpers

def reading_minutes(body: str) -> int:
    return max(1, round(len(body.split()) / WORDS_PER_MINUTE))


def like(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


STORY_COLUMNS = """
    s.id, s.title, s.author_id, s.author_name, u.username AS author_username,
    s.tags, s.categories, s.rating, s.reading_minutes, s.source, s.truncated,
    s.published_at, s.updated_at
"""


def story_json(row, user, *, body: bool = False) -> dict:
    out = {
        "id": row["id"],
        "title": row["title"],
        "author": row["author_username"] or row["author_name"],
        "author_id": row["author_id"],
        "tags": json.loads(row["tags"]),
        "categories": json.loads(row["categories"]),
        "rating": row["rating"],
        "reading_minutes": row["reading_minutes"],
        "source": row["source"],
        "truncated": bool(row["truncated"]),
        "published_at": row["published_at"],
        "updated_at": row["updated_at"],
        "can_edit": can_edit_story(user, row),
    }
    if body:
        out["body"] = row["body"]
    else:
        out["excerpt"] = row["excerpt"]
    return out


def fetch_story(conn, story_id: int):
    row = conn.execute(
        f"SELECT {STORY_COLUMNS}, s.body FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = ?",
        (story_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "No such story. Maybe there never was.")
    return row


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=COOKIE_SECURE, path="/",
    )


# --------------------------------------------------------------------------- auth

@app.post("/api/auth/register", status_code=201)
def register(creds: Credentials, response: Response, conn: Conn):
    try:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (creds.username, hash_password(creds.password)),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That username is taken.")
    conn.commit()
    set_session_cookie(response, create_session(conn, cur.lastrowid))
    user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"user": user_json(user)}


@app.post("/api/auth/login")
def login(creds: Credentials, response: Response, conn: Conn):
    user = conn.execute("SELECT * FROM users WHERE username = ?", (creds.username,)).fetchone()
    if not user or not verify_password(creds.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password.")
    set_session_cookie(response, create_session(conn, user["id"]))
    return {"user": user_json(user)}


@app.post("/api/auth/logout")
def logout(response: Response, conn: Conn, eidothea_session: Annotated[str | None, Cookie()] = None):
    if eidothea_session:
        delete_session(conn, eidothea_session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: OptionalUser):
    return {"user": user_json(user) if user else None}


# --------------------------------------------------------------------------- stories

@app.get("/api/stories")
def list_stories(
    conn: Conn,
    user: OptionalUser,
    q: str = "",
    category: str = "",
    sort: Literal["new", "rating", "short", "long"] = "new",
    source: Literal["all", "user", "import"] = "all",
    mine: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=60),
):
    where, args = [], []
    if q.strip():
        where.append("(s.title LIKE ? ESCAPE '\\' OR s.tags LIKE ? ESCAPE '\\' OR COALESCE(u.username, s.author_name) LIKE ? ESCAPE '\\')")
        args += [like(q.strip())] * 3
    if category:
        where.append("EXISTS (SELECT 1 FROM json_each(s.categories) WHERE value = ?)")
        args.append(category)
    if source != "all":
        where.append("s.source = ?")
        args.append(source)
    if mine:
        if not user:
            raise HTTPException(401, "You need to log in first.")
        where.append("s.author_id = ?")
        args.append(user["id"])

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    order_sql = {
        "new": "s.published_at DESC, s.id DESC",
        "rating": "s.rating IS NULL, s.rating DESC, s.id",
        "short": "s.reading_minutes ASC, s.id",
        "long": "s.reading_minutes DESC, s.id",
    }[sort]

    base = f"FROM stories s LEFT JOIN users u ON u.id = s.author_id {where_sql}"
    total = conn.execute(f"SELECT COUNT(*) {base}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT {STORY_COLUMNS}, substr(s.body, 1, 320) AS excerpt {base} ORDER BY {order_sql} LIMIT ? OFFSET ?",
        [*args, per_page, (page - 1) * per_page],
    ).fetchall()
    return {
        "items": [story_json(r, user) for r in rows],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // per_page)),
    }


@app.get("/api/stories/random")
def random_story(conn: Conn):
    row = conn.execute("SELECT id FROM stories ORDER BY random() LIMIT 1").fetchone()
    if not row:
        raise HTTPException(404, "The archive is empty.")
    return {"id": row["id"]}


@app.get("/api/stories/{story_id}")
def get_story(story_id: int, conn: Conn, user: OptionalUser):
    return story_json(fetch_story(conn, story_id), user, body=True)


@app.post("/api/stories", status_code=201)
def create_story(story: StoryIn, conn: Conn, user: CurrentUser):
    cur = conn.execute(
        """INSERT INTO stories (title, body, author_id, tags, categories, reading_minutes, source)
           VALUES (?, ?, ?, ?, ?, ?, 'user')""",
        (story.title, story.body, user["id"], json.dumps(story.tags), json.dumps(story.categories),
         reading_minutes(story.body)),
    )
    conn.commit()
    return story_json(fetch_story(conn, cur.lastrowid), user, body=True)


@app.patch("/api/stories/{story_id}")
def update_story(story_id: int, patch: StoryPatch, conn: Conn, user: CurrentUser):
    existing = fetch_story(conn, story_id)
    if not can_edit_story(user, existing):
        raise HTTPException(403, "You can only edit your own stories.")

    changes = patch.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        return story_json(existing, user, body=True)
    if "body" in changes:
        changes["reading_minutes"] = reading_minutes(changes["body"])
        changes["truncated"] = 0
    for key in ("tags", "categories"):
        if key in changes:
            changes[key] = json.dumps(changes[key])

    assignments = ", ".join(f"{k} = ?" for k in changes)
    conn.execute(
        f"UPDATE stories SET {assignments}, updated_at = datetime('now') WHERE id = ?",
        [*changes.values(), story_id],
    )
    conn.commit()
    return story_json(fetch_story(conn, story_id), user, body=True)


@app.delete("/api/stories/{story_id}", status_code=204)
def delete_story(story_id: int, conn: Conn, user: CurrentUser):
    if not can_edit_story(user, fetch_story(conn, story_id)):
        raise HTTPException(403, "You can only delete your own stories.")
    conn.execute("DELETE FROM stories WHERE id = ?", (story_id,))
    conn.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------- browse helpers

@app.get("/api/categories")
def categories(conn: Conn):
    rows = conn.execute(
        """SELECT j.value AS name, COUNT(*) AS count
           FROM stories s, json_each(s.categories) j
           GROUP BY j.value ORDER BY count DESC, name"""
    ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/stats")
def stats(conn: Conn):
    row = conn.execute(
        """SELECT COUNT(*) AS stories,
                  SUM(source = 'user') AS community,
                  (SELECT COUNT(*) FROM users) AS users,
                  COALESCE(SUM(reading_minutes), 0) AS minutes
           FROM stories"""
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
           FROM users u LEFT JOIN stories s ON s.author_id = u.id
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


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: int, conn: Conn, actor: AdminUser):
    if not can_manage_user(actor, fetch_user(conn, user_id)):
        raise HTTPException(403, "You don't outrank them.")
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))  # sessions and stories cascade
    conn.commit()
    return Response(status_code=204)
