"""What logged-in readers read, and the trending score built from it.

Only accounts with a confirmed email are recorded: how far down a story they got,
roughly how long they spent, and whether they finished it."""

import threading
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from . import guard
from .deps import Conn, CurrentUser, OptionalUser

router = APIRouter()

# A finish needs most of the page and a fair share of the reading time, so skimming doesn't count
FINISHED_PROGRESS = 0.9
FINISHED_SHARE_OF_TIME = 0.25
TRENDING_DAYS = 14
# Time with a story before it counts as started, for "continue reading"
STARTED_SECONDS = 30

# Recent activity per story, each event fading with age (halved after 3 days, a third after 6…).
# Finished reads count most, then recommends; ratings above 5 lift a story and below 5 drag it; anonymous
# visits count a little, so trending works before many people have accounts.
HEAT_SQL = f"""
    SELECT story_id, SUM(w / (1 + age / 3.0)) AS heat FROM (
        SELECT story_id, julianday('now') - julianday(last_at) AS age,
               CASE WHEN finished THEN 3.0 WHEN progress >= 0.3 THEN 1.0 ELSE 0.3 END AS w
        FROM reads WHERE last_at > datetime('now', '-{TRENDING_DAYS} days')
        UNION ALL
        SELECT story_id, julianday('now') - julianday(created_at), (score - 5) / 2.5
        FROM story_ratings WHERE created_at > datetime('now', '-{TRENDING_DAYS} days')
        UNION ALL
        SELECT story_id, julianday('now') - julianday(created_at), 2.0
        FROM recommends WHERE created_at > datetime('now', '-{TRENDING_DAYS} days')
        UNION ALL
        SELECT story_id, julianday('now') - julianday(created_at), 1.5
        FROM comments WHERE created_at > datetime('now', '-{TRENDING_DAYS} days')
        UNION ALL
        SELECT story_id, julianday('now') - julianday(day), 0.5 * COUNT(DISTINCT visitor)
        FROM pageviews WHERE story_id IS NOT NULL AND day > date('now', '-{TRENDING_DAYS} days')
        GROUP BY story_id, day
    ) GROUP BY story_id
"""


class ReadIn(BaseModel):
    progress: float = Field(ge=0, le=1)
    seconds: int = Field(ge=0, le=600)  # since the last report


@router.post("/api/stories/{story_id}/read", status_code=204)
def record_read(story_id: int, body: ReadIn, conn: Conn, user: OptionalUser):
    if not user or not user["email_verified_at"]:
        return Response(status_code=204)
    guard.limit(f"read:{user['id']}", 240, 3600)
    story = conn.execute(
        "SELECT reading_minutes, author_id FROM stories WHERE id = ? AND status = 'published'", (story_id,)
    ).fetchone()
    if not story or story["author_id"] == user["id"]:
        return Response(status_code=204)
    conn.execute(
        """INSERT INTO reads (user_id, story_id, progress, seconds) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, story_id) DO UPDATE SET
               progress = MAX(progress, excluded.progress),
               seconds = seconds + excluded.seconds,
               last_at = datetime('now')""",
        (user["id"], story_id, body.progress, body.seconds),
    )
    conn.execute(
        """UPDATE reads SET finished = 1
           WHERE user_id = ? AND story_id = ? AND NOT finished AND progress >= ? AND seconds >= ?""",
        (user["id"], story_id, FINISHED_PROGRESS, max(20, story["reading_minutes"] * 60 * FINISHED_SHARE_OF_TIME)),
    )
    conn.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------- reading right now

# Open tabs per story and when each last checked in. In memory, like guard's limits: the API runs
# as one process, and a restart only means a minute of undercounting.
PRESENT_FOR = 50  # seconds without a check-in before a tab stops counting
MAX_TABS = 2000
_present: dict[int, dict[str, float]] = {}
_present_lock = threading.Lock()


class HereIn(BaseModel):
    tab: str = Field(min_length=8, max_length=40, pattern=r"^[A-Za-z0-9-]+$")
    leaving: bool = False


@router.post("/api/stories/{story_id}/here")
def here(story_id: int, body: HereIn, request: Request):
    """Anyone with the story open checks in every 20 seconds; answers how many others have it open."""
    guard.limit(f"here:{guard.client_ip(request)}", 120, 60)
    now = time.monotonic()
    with _present_lock:
        tabs = _present.setdefault(story_id, {})
        for t, seen in list(tabs.items()):
            if now - seen > PRESENT_FOR:
                del tabs[t]
        if body.leaving:
            tabs.pop(body.tab, None)
        elif body.tab in tabs or len(tabs) < MAX_TABS:
            tabs[body.tab] = now
        others = len(tabs) - (body.tab in tabs)
        if not tabs:
            del _present[story_id]
    return {"others": others}


# --------------------------------------------------------------------------- writer stats

STORY_STATS = """
    s.id, s.title, s.published_at, s.reading_minutes,
    (SELECT COUNT(DISTINCT day || visitor) FROM pageviews WHERE story_id = s.id) AS visits,
    (SELECT COUNT(*) FROM reads WHERE story_id = s.id) AS readers,
    (SELECT COUNT(*) FROM reads WHERE story_id = s.id AND finished) AS finished,
    (SELECT AVG(progress) FROM reads WHERE story_id = s.id) AS avg_progress,
    (SELECT COUNT(*) FROM story_ratings WHERE story_id = s.id) AS ratings,
    (SELECT AVG(score) FROM story_ratings WHERE story_id = s.id) AS avg_score,
    (SELECT COUNT(*) FROM comments WHERE story_id = s.id) AS comments,
    (SELECT COUNT(*) FROM recommends WHERE story_id = s.id) AS recommends,
    (SELECT COUNT(*) FROM bookmarks WHERE story_id = s.id) AS saves
"""


def stats_json(row) -> dict:
    out = dict(row)
    out["avg_progress"] = round(row["avg_progress"], 2) if row["avg_progress"] is not None else None
    out["avg_score"] = round(row["avg_score"], 1) if row["avg_score"] is not None else None
    return out


@router.get("/api/me/stats")
def my_stats(conn: Conn, user: CurrentUser):
    """How the writer's published stories are doing. Readers are confirmed accounts (see reads);
    visits count everyone, a person once a day."""
    stories = [stats_json(r) for r in conn.execute(
        f"""SELECT {STORY_STATS} FROM stories s WHERE s.author_id = ? AND s.status = 'published'
            ORDER BY s.published_at DESC, s.id DESC""",
        (user["id"],),
    )]
    totals = {k: sum(s[k] for s in stories) for k in ("visits", "readers", "finished", "comments", "recommends", "saves")}
    totals["stories"] = len(stories)
    totals["followers"] = conn.execute("SELECT COUNT(*) FROM follows WHERE followee_id = ?", (user["id"],)).fetchone()[0]
    return {"totals": totals, "stories": stories}


@router.get("/api/me/stats/{story_id}")
def story_stats(story_id: int, conn: Conn, user: CurrentUser):
    """One story's numbers, plus where readers stopped: how many got no further than each tenth."""
    row = conn.execute(
        f"SELECT {STORY_STATS} FROM stories s WHERE s.id = ? AND s.author_id = ? AND s.status = 'published'",
        (story_id, user["id"]),
    ).fetchone()
    if not row:
        raise HTTPException(404, "No published story of yours by that number.")
    stopped = [0] * 10
    for (progress,) in conn.execute("SELECT progress FROM reads WHERE story_id = ? AND NOT finished", (story_id,)):
        stopped[min(9, int(progress * 10))] += 1
    daily = [dict(r) for r in conn.execute(
        """SELECT day, COUNT(DISTINCT visitor) AS visitors FROM pageviews
           WHERE story_id = ? AND day >= date('now', '-29 days') GROUP BY day ORDER BY day""",
        (story_id,),
    )]
    return {**stats_json(row), "stopped": stopped, "daily": daily}


def affinity_sql() -> str:
    """The genres a reader leans towards: finished reads, half-reads and their ratings."""
    return """
        SELECT j.value AS cat, SUM(l.w) AS w FROM (
            SELECT story_id, CASE WHEN finished THEN 2.0 WHEN progress >= 0.3 THEN 0.5 ELSE 0 END AS w
            FROM reads WHERE user_id = :uid
            UNION ALL
            SELECT story_id, (score - 5) / 2.0 FROM story_ratings WHERE user_id = :uid
        ) l JOIN stories s ON s.id = l.story_id, json_each(s.categories) j
        GROUP BY j.value HAVING SUM(l.w) > 0 ORDER BY w DESC LIMIT 5
    """
