"""Outgoing email over SMTP. Without SMTP_HOST set, messages are printed to the log instead,
so sign-up works on a laptop: copy the link from the API's output."""

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

log = logging.getLogger("eidothea")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "") or formataddr(("Eidothea", SMTP_USER or "eidothea@localhost"))
SITE_URL = os.environ.get("SITE_URL", "http://localhost:3000").rstrip("/")

SIGNATURE = "\n\n— The Eidothea Archive\n" + SITE_URL


def link(path: str) -> str:
    return SITE_URL + path


def send(to: str, subject: str, text: str) -> None:
    """Sends a plain-text email. Never raises: a mail problem must not break the request."""
    if not SMTP_HOST:
        log.warning("email (SMTP_HOST not set, not sent)\n  to: %s\n  subject: %s\n\n%s\n", to, subject, text + SIGNATURE)
        return
    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg["Reply-To"] = parseaddr(MAIL_FROM)[1]
    msg.set_content(text + SIGNATURE)
    try:
        context = ssl.create_default_context()
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=15)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
            server.starttls(context=context)
        with server:
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        log.warning("email to %s failed: %s", to, e)
