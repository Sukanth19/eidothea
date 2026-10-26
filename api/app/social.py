"""Following writers, recommending stories, and the notifications that come of it."""

from fastapi import APIRouter, BackgroundTasks, HTTPException

from . import guard, mail
from .accounts import MemberUser, ReaderUser
from .deps import Conn, CurrentUser, OptionalUser
from .notify import notify, unread

router = APIRouter()


def find_user(conn, username: str):
    row = conn.execute("SELECT id, username FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        raise HTTPException(404, "No one by that name.")
    return row


def follow_counts(conn, user_id: int) -> dict:
    return dict(conn.execute(
        """SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
                  (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following""",
        (user_id, user_id),
    ).fetchone())


# --------------------------------------------------------------------------- follows

@router.get("/api/profiles/{username}/social")
def profile_social(username: str, conn: Conn, viewer: OptionalUser):
    """Counts and the viewer's follow state; shown with any author, public profile or not."""
    target = find_user(conn, username)
    following = bool(viewer) and bool(conn.execute(
        "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?", (viewer["id"], target["id"])
    ).fetchone())
    recommends = conn.execute(
        """SELECT COUNT(*) FROM recommends r JOIN stories s ON s.id = r.story_id
           WHERE r.user_id = ? AND s.status = 'published'""",
        (target["id"],),
    ).fetchone()[0]
    return {**follow_counts(conn, target["id"]), "is_following": following, "recommends": recommends}


@router.put("/api/users/{username}/follow")
def follow(username: str, conn: Conn, user: ReaderUser):
    guard.limit(f"follow:{user['id']}", 60, 3600)
    target = find_user(conn, username)
    if target["id"] == user["id"]:
        raise HTTPException(400, "You can't follow yourself.")
    cur = conn.execute(
        "INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)", (user["id"], target["id"])
    )
    if cur.rowcount:
        notify(conn, target["id"], "follow", actor_id=user["id"])
    conn.commit()
    return profile_social(username, conn, user)


@router.delete("/api/users/{username}/follow")
def unfollow(username: str, conn: Conn, user: CurrentUser):
    target = find_user(conn, username)
    conn.execute("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", (user["id"], target["id"]))
    conn.commit()
    return profile_social(username, conn, user)


def announce_story(conn, story_id: int, author_id: int, tasks: BackgroundTasks) -> None:
    """A story went live for the first time: tell the author's followers, by email too if they asked for it.
    Going back to drafts and publishing again doesn't announce it twice."""
    if not conn.execute(
        "UPDATE stories SET announced_at = datetime('now') WHERE id = ? AND announced_at IS NULL", (story_id,)
    ).rowcount:
        return
    followers = conn.execute(
        """SELECT u.id, u.email, u.email_verified_at, u.email_follows FROM follows f JOIN users u ON u.id = f.follower_id
           WHERE f.followee_id = ?""",
        (author_id,),
    ).fetchall()
    if not followers:
        return
    story = conn.execute(
        "SELECT s.title, s.subtitle, u.username FROM stories s JOIN users u ON u.id = s.author_id WHERE s.id = ?",
        (story_id,),
    ).fetchone()
    for f in followers:
        notify(conn, f["id"], "story", actor_id=author_id, story_id=story_id)
        if f["email_follows"] and f["email_verified_at"]:
            tasks.add_task(
                mail.send, f["email"], f"New from {story['username']}: {story['title']}",
                f"{story['username']} just published “{story['title']}”."
                + (f"\n{story['subtitle']}" if story["subtitle"] else "")
                + f"\n\nRead it here:\n{mail.link(f'/stories/{story_id}')}\n\n"
                f"You get these because you follow {story['username']}. Turn them off on your profile:\n{mail.link('/me/profile')}",
            )


# --------------------------------------------------------------------------- recommends

def recommend_state(conn, story_id: int, user) -> dict:
    count = conn.execute("SELECT COUNT(*) FROM recommends WHERE story_id = ?", (story_id,)).fetchone()[0]
    mine = bool(user) and bool(conn.execute(
        "SELECT 1 FROM recommends WHERE story_id = ? AND user_id = ?", (story_id, user["id"])
    ).fetchone())
    return {"recommend_count": count, "recommended": mine}


def published_story(conn, story_id: int):
    row = conn.execute("SELECT id, author_id FROM stories WHERE id = ? AND status = 'published'", (story_id,)).fetchone()
    if not row:
        raise HTTPException(404, "No such story.")
    return row


@router.put("/api/stories/{story_id}/recommend")
def recommend(story_id: int, conn: Conn, user: MemberUser):
    story = published_story(conn, story_id)
    if story["author_id"] == user["id"]:
        raise HTTPException(403, "You can't recommend your own story.")
    cur = conn.execute("INSERT OR IGNORE INTO recommends (user_id, story_id) VALUES (?, ?)", (user["id"], story_id))
    if cur.rowcount and story["author_id"]:
        notify(conn, story["author_id"], "recommend", actor_id=user["id"], story_id=story_id)
    conn.commit()
    return recommend_state(conn, story_id, user)


@router.delete("/api/stories/{story_id}/recommend")
def unrecommend(story_id: int, conn: Conn, user: MemberUser):
    published_story(conn, story_id)
    conn.execute("DELETE FROM recommends WHERE user_id = ? AND story_id = ?", (user["id"], story_id))
    conn.commit()
    return recommend_state(conn, story_id, user)


# --------------------------------------------------------------------------- bookmarks

def bookmark_state(conn, story_id: int, user) -> dict:
    return {"bookmarked": bool(user) and bool(conn.execute(
        "SELECT 1 FROM bookmarks WHERE story_id = ? AND user_id = ?", (story_id, user["id"])
    ).fetchone())}


@router.put("/api/stories/{story_id}/bookmark")
def bookmark(story_id: int, conn: Conn, user: CurrentUser):
    published_story(conn, story_id)
    guard.limit(f"bookmark:{user['id']}", 300, 3600)
    conn.execute("INSERT OR IGNORE INTO bookmarks (user_id, story_id) VALUES (?, ?)", (user["id"], story_id))
    conn.commit()
    return bookmark_state(conn, story_id, user)


@router.delete("/api/stories/{story_id}/bookmark")
def unbookmark(story_id: int, conn: Conn, user: CurrentUser):
    # No published check: a story taken back to drafts can still be let go of
    conn.execute("DELETE FROM bookmarks WHERE user_id = ? AND story_id = ?", (user["id"], story_id))
    conn.commit()
    return bookmark_state(conn, story_id, user)


# --------------------------------------------------------------------------- notifications

@router.get("/api/notifications")
def notifications(conn: Conn, user: CurrentUser):
    rows = conn.execute(
        """SELECT n.id, n.kind, n.created_at, n.read_at IS NOT NULL AS read, n.story_id, n.comment_id,
                  a.username AS actor, s.title AS story_title
           FROM notifications n
           LEFT JOIN users a ON a.id = n.actor_id
           LEFT JOIN stories s ON s.id = n.story_id
           WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 60""",
        (user["id"],),
    ).fetchall()
    return {"unread": unread(conn, user["id"]), "items": [{**dict(r), "read": bool(r["read"])} for r in rows]}


@router.get("/api/notifications/unread")
def unread_count(conn: Conn, user: OptionalUser):
    return {"unread": unread(conn, user["id"]) if user else 0}


@router.post("/api/notifications/read")
def mark_read(conn: Conn, user: CurrentUser):
    conn.execute("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", (user["id"],))
    conn.commit()
    return {"unread": 0}
