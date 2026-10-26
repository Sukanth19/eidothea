"""What logged-in readers read, and the trending score built from it.

Only accounts with a confirmed email are recorded: how far down a story they got,
roughly how long they spent, and whether they finished it."""

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

from . import guard
from .deps import Conn, OptionalUser

router = APIRouter()

# A finish needs most of the page and a fair share of the reading time, so skimming doesn't count
FINISHED_PROGRESS = 0.9
FINISHED_SHARE_OF_TIME = 0.25
TRENDING_DAYS = 14

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
