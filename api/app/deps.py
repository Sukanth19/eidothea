"""Request dependencies shared by the API modules."""

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException

from . import db
from .security import FOREVER, ROLE_LEVEL, level, suspended_until, user_for_token

Conn = Annotated[sqlite3.Connection, Depends(db.get_db)]

SEEN_EVERY = timedelta(minutes=5)


def optional_user(conn: Conn, eidothea_session: Annotated[str | None, Cookie()] = None):
    user = user_for_token(conn, eidothea_session)
    if user and _stale(user["last_seen_at"]):
        # "Last active" for /insights; written at most every few minutes per user
        conn.execute("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?", (user["id"],))
        conn.commit()
    return user


def _stale(seen: str | None) -> bool:
    if not seen:
        return True
    then = datetime.strptime(seen, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - then > SEEN_EVERY


def require_user(user=Depends(optional_user)):
    if not user:
        raise HTTPException(401, "You need to log in first.")
    return user


def check_active(user) -> None:
    """Suspended accounts can read and log in, nothing more."""
    until = suspended_until(user)
    if until:
        when = "until a keeper lifts it" if until == FOREVER else f"until {until[:10]}"
        reason = f" Reason: {user['suspended_reason']}" if user["suspended_reason"] else ""
        raise HTTPException(403, f"Your account is suspended {when}. You can still read.{reason}")


def require_active(user=Depends(require_user)):
    check_active(user)
    return user


def require_mod(user=Depends(require_user)):
    if level(user) < ROLE_LEVEL["mod"]:
        raise HTTPException(403, "Moderators only.")
    return user


OptionalUser = Annotated[sqlite3.Row | None, Depends(optional_user)]
CurrentUser = Annotated[sqlite3.Row, Depends(require_user)]
ActiveUser = Annotated[sqlite3.Row, Depends(require_active)]
ModUser = Annotated[sqlite3.Row, Depends(require_mod)]
