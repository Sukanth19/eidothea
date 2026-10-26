"""Accounts: sign-up with email, logging in, confirming email, resetting passwords,
and becoming a member (founding spots, invites from members, or the waiting list)."""

import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from . import guard, insights, mail
from .notify import notify, unread
from .deps import Conn, CurrentUser, ModUser, OptionalUser
from .security import (
    FOUNDING_MEMBERS,
    INVITES_PER_MEMBER,
    ROLE_LEVEL,
    SESSION_COOKIE,
    SESSION_DAYS,
    can_view_insights,
    create_session,
    delete_session,
    hash_password,
    is_member,
    level,
    tier,
    token_hash,
    verify_password,
)

router = APIRouter()

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[A-Za-z]{2,}$")
VERIFY_HOURS = 48
RESET_HOURS = 1
REAPPLY_DAYS = 7
# Easy to read aloud or type: no 0/O, 1/I/L
INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def user_json(u, *, private: bool = False) -> dict:
    out = {
        "id": u["id"],
        "username": u["username"],
        "role": u["role"],
        "created_at": u["created_at"],
        "insights": can_view_insights(u),
        "tier": tier(u),
        "member": is_member(u),
        "email_verified": bool(u["email_verified_at"]),
    }
    if private:
        out["email"] = u["email"]
        out["mail_ready"] = mail.READY
    return out


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=COOKIE_SECURE, path="/",
    )


def fresh_user(conn, user_id: int):
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


# --------------------------------------------------------------------------- requirements

def require_verified(user: CurrentUser):
    if not user["email_verified_at"]:
        raise HTTPException(403, "Confirm your email address first.")
    return user


def require_member(user: CurrentUser):
    if not is_member(user):
        raise HTTPException(403, "Only members can do that. Ask a member for an invite, or join the waiting list.")
    return user


ReaderUser = Annotated[sqlite3.Row, Depends(require_verified)]
MemberUser = Annotated[sqlite3.Row, Depends(require_member)]


# --------------------------------------------------------------------------- models

def clean_email(v: str) -> str:
    v = v.strip()
    if not EMAIL.match(v) or len(v) > 254:
        raise ValueError("doesn't look like an email address")
    return v


class Registration(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)
    email: str
    # Both optional: the answer to "how did you hear about us?" and where their first visit came from
    source: str | None = Field(default=None, max_length=80)
    landing: str | None = Field(default=None, max_length=120)
    invite: str | None = Field(default=None, max_length=20)
    # Bot checks: a field people never see, how long the form was open, Cloudflare's token
    website: str = Field(default="", max_length=200)
    elapsed_ms: int | None = None
    turnstile: str | None = Field(default=None, max_length=4096)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return clean_email(v)

    @field_validator("source", "landing", "invite")
    @classmethod
    def tidy(cls, v: str | None) -> str | None:
        v = " ".join((v or "").split())
        return v or None


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=254)  # or their email
    password: str = Field(min_length=1, max_length=128)


class EmailIn(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return clean_email(v)


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResetIn(TokenIn):
    password: str = Field(min_length=8, max_length=128)


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class ApplicationIn(BaseModel):
    note: str = Field(min_length=20, max_length=1000)

    @field_validator("note")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class DecisionIn(BaseModel):
    approve: bool


# --------------------------------------------------------------------------- email links

def issue_token(conn, user_id: int, purpose: Literal["verify", "reset"], email: str, hours: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?", (user_id, purpose))
    conn.execute(
        "INSERT INTO email_tokens (token_hash, user_id, purpose, email, expires_at) VALUES (?, ?, ?, ?, ?)",
        (token_hash(token), user_id, purpose, email,
         (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()),
    )
    conn.commit()
    return token


def take_token(conn, token: str, purpose: str):
    row = conn.execute(
        "SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = ? AND expires_at > ?",
        (token_hash(token), purpose, datetime.now(timezone.utc).isoformat()),
    ).fetchone()
    if not row:
        raise HTTPException(400, "That link has expired or was already used. Ask for a new one.")
    conn.execute("DELETE FROM email_tokens WHERE token_hash = ?", (row["token_hash"],))
    return row


def send_verification(conn, user, email: str, tasks: BackgroundTasks) -> None:
    token = issue_token(conn, user["id"], "verify", email, VERIFY_HOURS)
    tasks.add_task(
        mail.send, email, "Confirm your email for Eidothea",
        f"Someone (hopefully you, {user['username']}) gave this address to the Eidothea archive.\n\n"
        f"Open this link to confirm it:\n{mail.link('/verify?token=' + token)}\n\n"
        f"It stops working in {VERIFY_HOURS} hours. If this wasn't you, ignore it and nothing happens.",
    )


def email_taken(conn, email: str, user_id: int | None = None) -> bool:
    """Only a confirmed address is taken, so typing someone else's email can't lock them out."""
    return bool(conn.execute(
        "SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id IS NOT ? AND email_verified_at IS NOT NULL",
        (email, user_id),
    ).fetchone())


def release_email(conn, email: str, user_id: int | None = None) -> None:
    """Takes an unconfirmed address off whoever else gave it, before it's stored for someone new.
    Their confirmation link still works, unless the new account confirms first."""
    conn.execute(
        "UPDATE users SET email = NULL WHERE email = ? COLLATE NOCASE AND id IS NOT ? AND email_verified_at IS NULL",
        (email, user_id),
    )


# --------------------------------------------------------------------------- membership

def grant_membership(conn, user_id: int, via: str, invited_by: int | None = None) -> None:
    conn.execute(
        """UPDATE users SET member = 1, member_since = datetime('now'), member_via = ?,
                  invited_by = COALESCE(?, invited_by), invite_code = NULL
           WHERE id = ? AND member = 0""",
        (via, invited_by, user_id),
    )
    notify(conn, user_id, "member", actor_id=invited_by)


def use_invite(conn, code: str, user_id: int) -> int | None:
    """Spends an unused invite on this user. Returns the inviter's id, or None if the code is no good."""
    code = code.strip().upper()
    row = conn.execute("SELECT inviter_id FROM invites WHERE code = ? AND used_by IS NULL", (code,)).fetchone()
    if not row or row["inviter_id"] == user_id:
        return None
    cur = conn.execute(
        "UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE code = ? AND used_by IS NULL", (user_id, code)
    )
    return row["inviter_id"] if cur.rowcount else None


def welcome_member(conn, user, tasks: BackgroundTasks) -> str | None:
    """Right after someone confirms their email: an invite they signed up with, or a founding spot."""
    if is_member(user):
        return None
    if user["invite_code"]:
        inviter = use_invite(conn, user["invite_code"], user["id"])
        if inviter:
            grant_membership(conn, user["id"], "invite", inviter)
            notify(conn, inviter, "invite_used", actor_id=user["id"])
            return "invite"
    founders = conn.execute("SELECT COUNT(*) FROM users WHERE member_via = 'founding'").fetchone()[0]
    if founders < FOUNDING_MEMBERS:
        grant_membership(conn, user["id"], "founding")
        return "founding"
    return None


# --------------------------------------------------------------------------- sign up, log in

@router.post("/api/auth/register", status_code=201)
def register(body: Registration, request: Request, response: Response, conn: Conn, tasks: BackgroundTasks):
    ip = guard.client_ip(request)
    guard.limit(f"signup:{ip}", 5, 3600, "Too many sign-ups from here. Try again in an hour.")
    guard.check_signup_form(body.website, body.elapsed_ms)
    guard.check_turnstile(body.turnstile, ip)
    guard.check_email_domain(body.email)
    if email_taken(conn, body.email):
        raise HTTPException(409, "That email already has an account. Log in, or reset the password.")
    release_email(conn, body.email)
    try:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, email, source, landing, invite_code) VALUES (?, ?, ?, ?, ?, ?)",
            (body.username, hash_password(body.password), body.email, body.source, body.landing,
             body.invite.upper() if body.invite else None),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That username is taken.")
    conn.commit()
    user = fresh_user(conn, cur.lastrowid)
    send_verification(conn, user, body.email, tasks)
    tasks.add_task(insights.announce_signup, body.username, body.source, body.landing)
    set_session_cookie(response, create_session(conn, user["id"]))
    return {"user": user_json(user, private=True)}


@router.post("/api/auth/login")
def login(creds: Credentials, request: Request, response: Response, conn: Conn):
    # Per address only: a limit per account would let anyone lock someone out by failing on purpose
    guard.limit(f"login:{guard.client_ip(request)}", 10, 600)
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? OR email = ? COLLATE NOCASE", (creds.username, creds.username)
    ).fetchone()
    if not user or not verify_password(creds.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username, email or password.")
    set_session_cookie(response, create_session(conn, user["id"]))
    return {"user": user_json(user, private=True)}


@router.post("/api/auth/logout")
def logout(response: Response, conn: Conn, eidothea_session: Annotated[str | None, Cookie()] = None):
    if eidothea_session:
        delete_session(conn, eidothea_session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/api/auth/me")
def me(user: OptionalUser, conn: Conn):
    if not user:
        return {"user": None}
    return {"user": {**user_json(user, private=True), "unread": unread(conn, user["id"])}}


# --------------------------------------------------------------------------- confirming email

@router.post("/api/auth/verify")
def verify(body: TokenIn, response: Response, conn: Conn, tasks: BackgroundTasks):
    row = take_token(conn, body.token, "verify")
    if email_taken(conn, row["email"], row["user_id"]):
        conn.commit()
        raise HTTPException(409, "Another account confirmed that address first.")
    release_email(conn, row["email"], row["user_id"])
    conn.execute(
        "UPDATE users SET email = ?, email_verified_at = datetime('now') WHERE id = ?", (row["email"], row["user_id"])
    )
    became = welcome_member(conn, fresh_user(conn, row["user_id"]), tasks)
    conn.commit()
    # The link may be opened on another device: log them in there too
    set_session_cookie(response, create_session(conn, row["user_id"]))
    return {"user": user_json(fresh_user(conn, row["user_id"]), private=True), "became_member": became}


@router.post("/api/auth/resend")
def resend(user: CurrentUser, conn: Conn, tasks: BackgroundTasks):
    guard.limit(f"resend:{user['id']}", 3, 3600, "We've sent a few already. Check your spam folder, or wait an hour.")
    pending = conn.execute(
        "SELECT email FROM email_tokens WHERE user_id = ? AND purpose = 'verify'", (user["id"],)
    ).fetchone()
    email = pending["email"] if pending else user["email"]
    if not email or (user["email_verified_at"] and not pending):
        raise HTTPException(400, "There's nothing waiting to be confirmed.")
    send_verification(conn, user, email, tasks)
    return {"ok": True, "email": email, "mail_ready": mail.READY}


@router.put("/api/me/email")
def change_email(body: EmailIn, user: CurrentUser, conn: Conn, tasks: BackgroundTasks):
    """Adds or changes the address. The old one stays until the new one is confirmed."""
    guard.limit(f"email:{user['id']}", 5, 3600)
    guard.check_email_domain(body.email)
    if email_taken(conn, body.email, user["id"]):
        raise HTTPException(409, "That email belongs to another account.")
    if not user["email"]:
        release_email(conn, body.email, user["id"])
        conn.execute("UPDATE users SET email = ? WHERE id = ?", (body.email, user["id"]))
        conn.commit()
    send_verification(conn, user, body.email, tasks)
    return {"ok": True, "email": body.email, "mail_ready": mail.READY}


# --------------------------------------------------------------------------- passwords

@router.post("/api/auth/forgot")
def forgot(body: EmailIn, request: Request, conn: Conn, tasks: BackgroundTasks):
    guard.limit(f"forgot:{guard.client_ip(request)}", 5, 3600)
    user = conn.execute(
        "SELECT * FROM users WHERE email = ? COLLATE NOCASE AND email_verified_at IS NOT NULL", (body.email,)
    ).fetchone()
    if user:
        token = issue_token(conn, user["id"], "reset", user["email"], RESET_HOURS)
        tasks.add_task(
            mail.send, user["email"], "Reset your Eidothea password",
            f"Someone asked to reset the password for {user['username']}.\n\n"
            f"Choose a new one here:\n{mail.link('/reset?token=' + token)}\n\n"
            f"The link works for {RESET_HOURS} hour. If it wasn't you, ignore this; your password stays the same.",
        )
    # Same answer either way, so this can't be used to find out who has an account
    return {"ok": True}


@router.post("/api/auth/reset")
def reset(body: ResetIn, response: Response, conn: Conn):
    row = take_token(conn, body.token, "reset")
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(body.password), row["user_id"]))
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["user_id"],))  # log out everywhere else
    conn.commit()
    set_session_cookie(response, create_session(conn, row["user_id"]))
    return {"user": user_json(fresh_user(conn, row["user_id"]), private=True)}


# --------------------------------------------------------------------------- invites

def invite_quota(user) -> int | None:
    """None means no limit (staff)."""
    return None if level(user) >= ROLE_LEVEL["mod"] else INVITES_PER_MEMBER


def invites_json(conn, user) -> dict:
    rows = conn.execute(
        """SELECT i.code, i.created_at, i.used_at, u.username AS used_by
           FROM invites i LEFT JOIN users u ON u.id = i.used_by
           WHERE i.inviter_id = ? ORDER BY i.created_at DESC""",
        (user["id"],),
    ).fetchall()
    quota = invite_quota(user)
    return {
        "left": None if quota is None else max(0, quota - len(rows)),
        "invites": [dict(r) for r in rows],
    }


@router.get("/api/me/invites")
def my_invites(user: MemberUser, conn: Conn):
    return invites_json(conn, user)


@router.post("/api/me/invites", status_code=201)
def create_invite(user: MemberUser, conn: Conn):
    left = invites_json(conn, user)["left"]
    if left == 0:
        raise HTTPException(403, "You've used all your invites.")
    code = "-".join("".join(secrets.choice(INVITE_ALPHABET) for _ in range(4)) for _ in range(2))
    conn.execute("INSERT INTO invites (code, inviter_id) VALUES (?, ?)", (code, user["id"]))
    conn.commit()
    return invites_json(conn, user)


@router.get("/api/invites/{code}")
def check_invite(code: str, conn: Conn):
    row = conn.execute(
        """SELECT u.username FROM invites i JOIN users u ON u.id = i.inviter_id
           WHERE i.code = ? AND i.used_by IS NULL""",
        (code.strip().upper(),),
    ).fetchone()
    return {"valid": bool(row), "inviter": row["username"] if row else None}


@router.post("/api/me/redeem")
def redeem(body: CodeIn, user: ReaderUser, request: Request, conn: Conn):
    guard.limit(f"redeem:{guard.client_ip(request)}", 10, 3600)
    if is_member(user):
        raise HTTPException(400, "You're already a member.")
    inviter = use_invite(conn, body.code, user["id"])
    if not inviter:
        raise HTTPException(400, "That invite doesn't work. It may be used up, or mistyped.")
    grant_membership(conn, user["id"], "invite", inviter)
    notify(conn, inviter, "invite_used", actor_id=user["id"])
    conn.commit()
    return {"user": user_json(fresh_user(conn, user["id"]), private=True)}


# --------------------------------------------------------------------------- waiting list

def application_json(row) -> dict:
    return {k: row[k] for k in row.keys()}


@router.get("/api/me/application")
def my_application(user: CurrentUser, conn: Conn):
    row = conn.execute(
        "SELECT id, note, status, created_at, decided_at FROM applications WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        (user["id"],),
    ).fetchone()
    return application_json(row) if row else None


@router.post("/api/me/application", status_code=201)
def apply(body: ApplicationIn, user: ReaderUser, conn: Conn):
    if is_member(user):
        raise HTTPException(400, "You're already a member.")
    last = conn.execute(
        "SELECT status, decided_at FROM applications WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user["id"],)
    ).fetchone()
    if last and last["status"] == "pending":
        raise HTTPException(409, "Your request is already waiting.")
    if last and last["status"] == "rejected" and conn.execute(
        "SELECT ? > datetime('now', ?)", (last["decided_at"], f"-{REAPPLY_DAYS} days")
    ).fetchone()[0]:
        raise HTTPException(429, f"You can ask again {REAPPLY_DAYS} days after a no.")
    conn.execute("INSERT INTO applications (user_id, note) VALUES (?, ?)", (user["id"], body.note))
    conn.commit()
    return my_application(user, conn)


@router.get("/api/applications")
def list_applications(conn: Conn, _mod: ModUser, status: Literal["pending", "approved", "rejected"] = "pending"):
    rows = conn.execute(
        """SELECT a.id, a.note, a.status, a.created_at, a.decided_at,
                  u.id AS user_id, u.username, u.created_at AS joined,
                  d.username AS decided_by
           FROM applications a JOIN users u ON u.id = a.user_id
           LEFT JOIN users d ON d.id = a.decided_by
           WHERE a.status = ? ORDER BY a.id DESC LIMIT 200""",
        (status,),
    ).fetchall()
    return [application_json(r) for r in rows]


@router.post("/api/applications/{app_id}/decision")
def decide(app_id: int, body: DecisionIn, conn: Conn, mod: ModUser, tasks: BackgroundTasks):
    row = conn.execute(
        """SELECT a.user_id, u.username, u.email, u.email_verified_at FROM applications a JOIN users u ON u.id = a.user_id
           WHERE a.id = ? AND a.status = 'pending'""",
        (app_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "That request was already handled.")
    status = "approved" if body.approve else "rejected"
    conn.execute(
        "UPDATE applications SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?",
        (status, mod["id"], app_id),
    )
    if body.approve:
        grant_membership(conn, row["user_id"], "approved")
    else:
        notify(conn, row["user_id"], "rejected")
    conn.commit()
    if row["email"] and row["email_verified_at"]:
        if body.approve:
            text = (f"{row['username']}, the keepers of the archive have let you in.\n\n"
                    f"You can now write, comment and rate:\n{mail.link('/stories/new')}")
        else:
            text = (f"{row['username']}, the keepers didn't let you in this time.\n\n"
                    f"You can keep reading everything, and ask again in {REAPPLY_DAYS} days, "
                    f"or ask a member for an invite.")
        tasks.add_task(mail.send, row["email"], "About your Eidothea membership", text)
    return list_applications(conn, mod)
