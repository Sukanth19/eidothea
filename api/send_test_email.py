"""Send one test email with the server's settings and show exactly what goes wrong, if anything.

    python send_test_email.py you@example.com

On the server the settings live in /etc/eidothea.env, so load them first:

    sudo bash -c 'set -a; . /etc/eidothea.env; cd /opt/eidothea/api && .venv/bin/python send_test_email.py you@example.com'
"""

import sys

from app import mail


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    if not mail.READY:
        sys.exit("SMTP_HOST isn't set, so nothing can be sent. Add the SMTP_* settings (see the README).")
    print(f"Sending through {mail.SMTP_HOST}:{mail.SMTP_PORT} as {mail.SMTP_USER or '(no login)'}, from {mail.MAIL_FROM} ...")
    try:
        mail.deliver(sys.argv[1], "Eidothea test email", "If you can read this, Eidothea can send email.")
    except Exception as e:
        sys.exit(f"Failed: {type(e).__name__}: {e}")
    print("Sent. Check the inbox, and the spam folder.")


if __name__ == "__main__":
    main()
