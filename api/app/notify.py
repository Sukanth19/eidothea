"""Notifications: the bell in the nav. Callers commit."""

KINDS = {"follow", "story", "comment", "recommend", "invite_used", "member", "rejected"}
KEEP = 200  # per person; older ones are dropped


def notify(conn, user_id: int, kind: str, actor_id: int | None = None, story_id: int | None = None) -> None:
    assert kind in KINDS, kind
    if user_id == actor_id:
        return
    conn.execute(
        "INSERT INTO notifications (user_id, kind, actor_id, story_id) VALUES (?, ?, ?, ?)",
        (user_id, kind, actor_id, story_id),
    )
    conn.execute(
        """DELETE FROM notifications WHERE user_id = ? AND id NOT IN
           (SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?)""",
        (user_id, user_id, KEEP),
    )


def unread(conn, user_id: int) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL", (user_id,)
    ).fetchone()[0]
