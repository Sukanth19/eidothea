"""Writing prompts: the keepers set a theme with dates; members write stories for it."""

from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from .deps import Conn, ModUser

router = APIRouter()

# Dates are "anywhere on Earth": a prompt opens once its first day has begun somewhere
# (UTC+14) and closes once its last day is over everywhere (UTC-12), whatever the keeper's timezone
PROMPT_COLUMNS = """
    p.id, p.title, p.body, p.starts_on, p.ends_on,
    CASE WHEN date('now', '+14 hours') < p.starts_on THEN 'upcoming'
         WHEN date('now', '-12 hours') > p.ends_on THEN 'closed' ELSE 'open' END AS status,
    (SELECT COUNT(*) FROM stories s WHERE s.prompt_id = p.id AND s.status = 'published') AS entries
"""


class PromptIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(default="", max_length=2000)
    starts_on: date
    ends_on: date

    @field_validator("title", "body")
    @classmethod
    def tidy(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def in_order(self):
        if self.ends_on < self.starts_on:
            raise ValueError("it has to end after it starts")
        return self


def fetch_prompt(conn, prompt_id: int):
    row = conn.execute(f"SELECT {PROMPT_COLUMNS} FROM prompts p WHERE p.id = ?", (prompt_id,)).fetchone()
    if not row:
        raise HTTPException(404, "No such prompt.")
    return row


def check_open(conn, prompt_id: int) -> None:
    """Stories can only be entered while a prompt is open."""
    if fetch_prompt(conn, prompt_id)["status"] != "open":
        raise HTTPException(409, "That prompt isn't taking entries.")


@router.get("/api/prompts")
def list_prompts(conn: Conn):
    """Open prompts first (ending soonest), then upcoming, then past ones, newest first."""
    rows = conn.execute(
        f"""SELECT {PROMPT_COLUMNS} FROM prompts p
            ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
                     CASE WHEN status = 'closed' THEN NULL ELSE p.ends_on END, p.ends_on DESC, p.id DESC
            LIMIT 200"""
    ).fetchall()
    return [dict(r) for r in rows]


@router.get("/api/prompts/{prompt_id}")
def get_prompt(prompt_id: int, conn: Conn):
    return dict(fetch_prompt(conn, prompt_id))


@router.post("/api/prompts", status_code=201)
def add_prompt(body: PromptIn, conn: Conn, mod: ModUser):
    cur = conn.execute(
        "INSERT INTO prompts (title, body, starts_on, ends_on, created_by) VALUES (?, ?, ?, ?, ?)",
        (body.title, body.body, body.starts_on.isoformat(), body.ends_on.isoformat(), mod["id"]),
    )
    conn.commit()
    return dict(fetch_prompt(conn, cur.lastrowid))


@router.delete("/api/prompts/{prompt_id}")
def remove_prompt(prompt_id: int, conn: Conn, _mod: ModUser):
    # Its stories stay; they just stop being entries
    fetch_prompt(conn, prompt_id)
    conn.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
    conn.commit()
    return list_prompts(conn)
