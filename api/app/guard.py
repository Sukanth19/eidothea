"""Spam and bot protection: rate limits, sign-up form checks, throwaway email domains,
an optional Cloudflare Turnstile check and daily caps for brand-new members."""

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from collections import defaultdict, deque

from fastapi import HTTPException, Request

TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET", "")

# A human needs at least this long to fill in the sign-up form
MIN_FORM_MS = 2500

# Members in their first week get tighter daily caps
NEW_MEMBER_DAYS = 7
DAILY_CAPS = {"stories": (3, 10), "comments": (30, 200)}  # (new member, everyone else)

DISPOSABLE = {
    "10minutemail.com", "20minutemail.com", "33mail.com", "anonaddy.me", "burnermail.io", "discard.email",
    "dispostable.com", "dropmail.me", "emailondeck.com", "fakeinbox.com", "fakemail.net", "getairmail.com",
    "getnada.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
    "harakirimail.com", "inboxkitten.com", "incognitomail.org", "jetable.org", "mail.tm", "mail-temp.com",
    "maildrop.cc", "mailinator.com", "mailinator.net", "mailnesia.com", "mailpoof.com", "mintemail.com",
    "moakt.com", "mohmal.com", "mytemp.email", "nada.email", "sharklasers.com", "spam4.me", "spamgourmet.com",
    "temp-mail.io", "temp-mail.org", "tempail.com", "tempmail.dev", "tempmail.net", "tempmailo.com",
    "tempr.email", "throwawaymail.com", "trashmail.com", "trashmail.de", "trashmail.net", "yopmail.com",
    "yopmail.fr", "yopmail.net", "emailfake.com", "fakemailgenerator.com", "minuteinbox.com", "tmail.ws",
    "tmpmail.org", "tmpmail.net", "luxusmail.org", "mailcatch.com", "spambox.us", "wegwerfmail.de",
}

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def limit(key: str, times: int, per_seconds: int, message: str = "Too many tries. Wait a while, then try again.") -> None:
    """Allows `times` calls per key within `per_seconds`, else 429. In memory: resets on restart."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > per_seconds:
            q.popleft()
        if len(q) >= times:
            raise HTTPException(429, message)
        q.append(now)
        if len(_hits) > 50_000:  # forget idle keys now and then
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > 86400]:
                del _hits[k]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "")


def check_email_domain(email: str) -> None:
    domain = email.rsplit("@", 1)[-1].lower()
    if domain in DISPOSABLE or any(domain.endswith("." + d) for d in DISPOSABLE):
        raise HTTPException(422, "Throwaway email addresses aren't accepted. Use one you'll keep.")


def check_signup_form(honeypot: str, elapsed_ms: int | None) -> None:
    # The hidden field is invisible to people; bots fill in everything
    if honeypot or (elapsed_ms is not None and elapsed_ms < MIN_FORM_MS):
        raise HTTPException(400, "Something about that sign-up felt wrong. Try again, slowly.")


def check_turnstile(token: str | None, ip: str) -> None:
    """Cloudflare's 'are you human' check, only when TURNSTILE_SECRET is set."""
    if not TURNSTILE_SECRET:
        return
    if not token:
        raise HTTPException(400, "Complete the human check first.")
    data = urllib.parse.urlencode({"secret": TURNSTILE_SECRET, "response": token, "remoteip": ip}).encode()
    try:
        with urllib.request.urlopen("https://challenges.cloudflare.com/turnstile/v0/siteverify", data, timeout=8) as r:
            ok = json.load(r).get("success")
    except Exception:
        ok = True  # Cloudflare unreachable: the other checks still apply
    if not ok:
        raise HTTPException(400, "The human check failed. Try again.")


def check_daily_cap(conn, user, kind: str) -> None:
    """Brand-new members can post a little; everyone has a ceiling. Staff are exempt."""
    if user["role"] != "user":
        return
    new = conn.execute(
        "SELECT COALESCE(member_since, created_at) > datetime('now', ?) FROM users WHERE id = ?",
        (f"-{NEW_MEMBER_DAYS} days", user["id"]),
    ).fetchone()[0]
    cap = DAILY_CAPS[kind][0 if new else 1]
    if kind == "stories":
        sql = "SELECT COUNT(*) FROM stories WHERE author_id = ? AND status = 'published' AND published_at > datetime('now', '-1 day')"
    else:
        sql = "SELECT COUNT(*) FROM comments WHERE user_id = ? AND created_at > datetime('now', '-1 day')"
    if conn.execute(sql, (user["id"],)).fetchone()[0] >= cap:
        what = "stories" if kind == "stories" else "comments"
        raise HTTPException(429, f"That's the daily limit for {what}. The archive will be here tomorrow.")
