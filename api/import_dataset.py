"""Import the DavidGetter1/creepypastas dataset (Hugging Face) into the archive.

    python import_dataset.py                      # straight from Hugging Face
    python import_dataset.py --csv path/to.csv    # from a local copy
    python import_dataset.py --replace            # wipe earlier imports first
"""

import argparse
import json
import re

import pandas as pd

from app import db

HF_PATH = "hf://datasets/DavidGetter1/creepypastas/creepypastas.csv"

# The dataset was saved through Excel, which cuts cells at this length.
EXCEL_CELL_LIMIT = 32_767
MIN_BODY_CHARS = 300

# Scraper leftovers at the end of a body / category list
JUNK_TAIL = re.compile(r"(\s*Please wait\.\.\.)+\s*\Z")
# Most stories end with a line like "Credit To – Ben Meadows"
CREDIT_LINE = re.compile(
    r"\n[ \t]*(?:credited to|credits? to|credits?|written by|author)[ \t]*[:–—-]*[ \t]*([^\n]{1,80}?)\s*\Z",
    re.IGNORECASE,
)


def clean_body(body: str) -> tuple[str, str | None]:
    """Returns (body without junk or credit line, author name if credited)."""
    body = JUNK_TAIL.sub("", body.replace("\r\n", "\n")).strip()
    m = CREDIT_LINE.search(body)
    if not m:
        return body, None
    # "Matt M. – read more of his work at ..." / "Christopher Maxim (Contact • ...)" -> just the name
    author = re.split(r" \(| – | — | \| ", m.group(1))[0].strip()
    return body[: m.start()].rstrip(), author or None


def split_categories(raw: str) -> list[str]:
    """Category names contain commas ("Deaths, Murders, and Disappearances"),
    so a three-part name is any run of three tokens ending in "and ..."."""
    tokens = [t.strip() for t in str(raw).split("\n")[0].split(",") if t.strip()]
    out, i = [], 0
    while i < len(tokens):
        if i + 2 < len(tokens) and tokens[i + 2].startswith("and "):
            out.append(", ".join(tokens[i:i + 3]))
            i += 3
        else:
            out.append(tokens[i])
            i += 1
    return out


def split_tags(raw) -> list[str]:
    if pd.isna(raw):
        return []
    seen, out = set(), []
    for t in (s.strip() for s in str(raw).split("\n")[0].split(",")):
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:15]


def load(source: str) -> pd.DataFrame:
    df = pd.read_csv(source)
    df = df.dropna(subset=["story_name", "body"])
    df["story_name"] = df["story_name"].str.strip()
    df["truncated"] = df["body"].str.len() >= EXCEL_CELL_LIMIT - 5
    cleaned = [clean_body(b) for b in df["body"]]
    df["body"] = [body for body, _ in cleaned]
    df["author"] = [author for _, author in cleaned]
    df = df[df["body"].str.len() >= MIN_BODY_CHARS]
    df = df.drop_duplicates(subset=["story_name", "body"])

    df["published"] = pd.to_datetime(df["publish_date"].str.strip(), format="%B %d, %Y", errors="coerce")
    minutes = pd.to_numeric(df["estimated_reading_time"].str.extract(r"(\d+)")[0], errors="coerce")
    estimated = (df["body"].str.split().str.len() / 200).round().clip(lower=1)
    df["minutes"] = minutes.fillna(estimated).astype(int)
    df["categories_list"] = df["categories"].fillna("").map(split_categories)
    df["tags_list"] = df["tags"].map(split_tags)
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=HF_PATH, help="CSV path or hf:// URL (default: the Hugging Face dataset)")
    ap.add_argument("--replace", action="store_true", help="delete previously imported stories first")
    ap.add_argument("--limit", type=int, help="only import the N highest-rated stories")
    args = ap.parse_args()

    db.init()
    with db.connect() as conn:
        existing = conn.execute("SELECT COUNT(*) FROM stories WHERE source = 'import'").fetchone()[0]
        if existing and not args.replace:
            print(f"{existing} imported stories already in the archive. Use --replace to re-import.")
            return

        print(f"Reading {args.csv} ...")
        df = load(args.csv).sort_values("average_rating", ascending=False)
        if args.limit:
            df = df.head(args.limit)

        rows = [
            (
                r.story_name,
                r.body,
                r.author if isinstance(r.author, str) else None,
                json.dumps(r.tags_list),
                json.dumps(r.categories_list),
                float(r.average_rating) if pd.notna(r.average_rating) else None,
                int(r.minutes),
                int(r.truncated),
                r.published.strftime("%Y-%m-%d") if pd.notna(r.published) else "2015-01-01",
            )
            for r in df.itertuples()
        ]

        if args.replace:
            conn.execute("DELETE FROM stories WHERE source = 'import'")
        conn.executemany(
            """INSERT INTO stories (title, body, author_name, tags, categories, rating, reading_minutes,
                                    truncated, published_at, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'import')""",
            rows,
        )
    print(f"Imported {len(rows)} stories ({int(df['truncated'].sum())} were cut off in the source data).")


if __name__ == "__main__":
    main()
