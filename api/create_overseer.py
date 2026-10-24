"""Create the single Overseer account, or reset its password.

    python create_overseer.py <username>             # prompts for a password
    python create_overseer.py <username> --reset     # change the existing overseer's password

The Overseer can't be created or assigned through the website.
"""

import argparse
import getpass
import re
import sys

from app import db
from app.security import hash_password


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("username")
    ap.add_argument("--reset", action="store_true", help="reset the existing overseer's password")
    args = ap.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9_-]{3,24}", args.username):
        sys.exit("Username must be 3-24 characters: letters, digits, _ or -.")

    db.init()
    with db.connect() as conn:
        current = conn.execute("SELECT id, username FROM users WHERE role = 'overseer'").fetchone()
        if current and not args.reset:
            sys.exit(f"An overseer already exists ({current['username']}). Use --reset to change its password.")
        if args.reset and not current:
            sys.exit("There is no overseer yet. Run without --reset.")

        password = getpass.getpass("Password (min 8 chars): ")
        if len(password) < 8 or password != getpass.getpass("Again: "):
            sys.exit("Passwords must match and be at least 8 characters.")

        if args.reset:
            conn.execute("UPDATE users SET username = ?, password_hash = ? WHERE id = ?",
                         (args.username, hash_password(password), current["id"]))
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (current["id"],))
            print(f"Overseer reset: {args.username}")
            return

        taken = conn.execute("SELECT id FROM users WHERE username = ?", (args.username,)).fetchone()
        if taken:
            # Promote an existing account rather than creating a clash
            conn.execute("UPDATE users SET role = 'overseer', password_hash = ? WHERE id = ?",
                         (hash_password(password), taken["id"]))
        else:
            conn.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'overseer')",
                         (args.username, hash_password(password)))
    print(f"Overseer created: {args.username}")


if __name__ == "__main__":
    main()
