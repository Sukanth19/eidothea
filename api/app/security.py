"""Password hashing, sessions and role rules."""

import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

SESSION_COOKIE = "eidothea_session"
SESSION_DAYS = 30

# The first this-many people to confirm their email become members automatically
FOUNDING_MEMBERS = int(os.environ.get("FOUNDING_MEMBERS", "300"))
INVITES_PER_MEMBER = int(os.environ.get("INVITES_PER_MEMBER", "3"))

# Higher level = more power. Users can only manage people strictly below them.
ROLE_LEVEL = {"user": 0, "mod": 1, "admin": 2, "overseer": 3}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(digest.hex(), digest_hex)


def token_hash(token: str) -> str:
    # Only a hash of the token is stored, so a leaked database can't be used to log in.
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (token_hash(token), user_id, expires.isoformat()),
    )
    conn.commit()
    return token


def delete_session(conn: sqlite3.Connection, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
    conn.commit()


def user_for_token(conn: sqlite3.Connection, token: str | None) -> sqlite3.Row | None:
    if not token:
        return None
    return conn.execute(
        """SELECT u.id, u.username, u.role, u.created_at, u.insights, u.last_seen_at,
                  u.email, u.email_verified_at, u.member, u.member_since
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ?""",
        (token_hash(token), datetime.now(timezone.utc).isoformat()),
    ).fetchone()


def level(user) -> int:
    return ROLE_LEVEL[user["role"]] if user else -1


def is_member(user) -> bool:
    """Members may post, comment, rate and vote. Staff always may."""
    return bool(user) and (level(user) >= ROLE_LEVEL["mod"] or bool(user["member"]))


def tier(user) -> str:
    """visitor (no account), unverified (email not confirmed), reader or member."""
    if not user:
        return "visitor"
    if is_member(user):
        return "member"
    return "reader" if user["email_verified_at"] else "unverified"


def can_edit_story(user, story) -> bool:
    """The author, or staff who outrank them (imported stories count as a user's)."""
    if not user:
        return False
    if story["author_id"] == user["id"]:
        return True
    return level(user) >= ROLE_LEVEL["mod"] and level(user) > ROLE_LEVEL[story["author_role"]]


def can_view_insights(user) -> bool:
    """The overseer, plus whoever the overseer has let in."""
    return bool(user) and (user["role"] == "overseer" or bool(user["insights"]))


def can_manage_user(actor, target) -> bool:
    return level(actor) >= ROLE_LEVEL["admin"] and level(target) < level(actor)


def assignable_roles(actor) -> list[str]:
    """Roles an actor may hand out. Nobody can assign overseer."""
    if level(actor) < ROLE_LEVEL["admin"]:
        return []
    return [r for r, lvl in ROLE_LEVEL.items() if lvl < level(actor) and r != "overseer"]
