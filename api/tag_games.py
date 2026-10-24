"""Add the video-game category to every existing story that's about games.

    python tag_games.py            # apply
    python tag_games.py --dry-run  # just list what would change

Safe to run repeatedly; it only ever adds the category.
"""

import argparse
import json

from app import db
from app.gaming import CATEGORY, with_gaming_category


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db.init()
    with db.connect() as conn:
        changed = []
        for row in conn.execute("SELECT id, title, tags, categories, body FROM stories"):
            cats = json.loads(row["categories"])
            new = with_gaming_category(cats, row["title"], json.loads(row["tags"]), row["body"])
            if new != cats:
                changed.append((json.dumps(new), row["id"], row["title"]))

        for _, _, title in changed:
            print(f"  + {title}")
        if not args.dry_run:
            conn.executemany("UPDATE stories SET categories = ? WHERE id = ?", [(c, i) for c, i, _ in changed])
    verb = "Would tag" if args.dry_run else "Tagged"
    print(f"{verb} {len(changed)} stories as '{CATEGORY}'.")


if __name__ == "__main__":
    main()
