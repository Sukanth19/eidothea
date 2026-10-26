"""Send one test email with the server's settings and show exactly what goes wrong, if anything.

    python send_test_email.py you@example.com                          # settings from the environment
    sudo .venv/bin/python send_test_email.py --env /etc/eidothea.env you@example.com   # on the server
"""

import argparse
import os
import sys


def load_env(path: str) -> None:
    """Reads KEY=VALUE lines the way systemd does, so values like `Name <a@b.c>` need no quoting."""
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            os.environ[key.strip()] = value


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("to")
    ap.add_argument("--env", help="settings file to read first, e.g. /etc/eidothea.env")
    args = ap.parse_args()
    if args.env:
        load_env(args.env)

    from app import mail  # reads the settings when imported

    if not mail.READY:
        sys.exit("SMTP_HOST isn't set, so nothing can be sent. Add the SMTP_* settings (see the README).")
    print(f"Sending through {mail.SMTP_HOST}:{mail.SMTP_PORT} as {mail.SMTP_USER or '(no login)'}, from {mail.MAIL_FROM} ...")
    print(f"Links will point to {mail.SITE_URL}")
    try:
        mail.deliver(args.to, "Eidothea test email", "If you can read this, Eidothea can send email.")
    except Exception as e:
        sys.exit(f"Failed: {type(e).__name__}: {e}")
    print("Sent. Check the inbox, and the spam folder.")


if __name__ == "__main__":
    main()
