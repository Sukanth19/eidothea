"""SQLite storage. One file, created on first use."""

import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("ARCHIVE_DB", Path(__file__).resolve().parents[2] / "data" / "archive.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'mod', 'admin', 'overseer')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- There can only ever be one overseer.
CREATE UNIQUE INDEX IF NOT EXISTS one_overseer ON users(role) WHERE role = 'overseer';

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
    id              INTEGER PRIMARY KEY,
    title           TEXT NOT NULL,
    subtitle        TEXT NOT NULL DEFAULT '',
    body            TEXT NOT NULL,  -- light markup, see web/lib/markup.ts
    author_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    author_name     TEXT,
    tags            TEXT NOT NULL DEFAULT '[]',  -- JSON array
    categories      TEXT NOT NULL DEFAULT '[]',  -- JSON array
    rating          REAL,  -- from the source dataset; readers' scores live in story_ratings
    reading_minutes INTEGER NOT NULL,
    source          TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'import')),
    truncated       INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    published_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS stories_author ON stories(author_id);
CREATE INDEX IF NOT EXISTS stories_published ON stories(published_at);
CREATE INDEX IF NOT EXISTS stories_rating ON stories(rating);

CREATE TABLE IF NOT EXISTS story_ratings (
    story_id   INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY,
    story_id   INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS comments_story ON comments(story_id);

-- First-party analytics. No IPs or cookies: `visitor` is a hash of IP + browser with a
-- salt that changes daily (see analytics_salt), so a visitor can't be followed across days.
CREATE TABLE IF NOT EXISTS pageviews (
    id       INTEGER PRIMARY KEY,
    day      TEXT NOT NULL DEFAULT (date('now')),
    path     TEXT NOT NULL,
    story_id INTEGER,
    source   TEXT,
    visitor  TEXT NOT NULL,
    device   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pageviews_day ON pageviews(day);

CREATE TABLE IF NOT EXISTS analytics_salt (
    day  TEXT PRIMARY KEY,
    salt TEXT NOT NULL
);

-- Genres writers can pick on top of the dataset's categories. Mods add more.
CREATE TABLE IF NOT EXISTS genres (
    name       TEXT PRIMARY KEY COLLATE NOCASE,
    blurb      TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_votes (
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value      INTEGER NOT NULL CHECK (value IN (-1, 1)),
    PRIMARY KEY (comment_id, user_id)
);
"""

# Columns added after the first release. CREATE TABLE IF NOT EXISTS won't add them
# to an existing database, so they're added here when missing.
MIGRATIONS = {
    "users": {
        "insights": "INTEGER NOT NULL DEFAULT 0",  # may open /insights (the overseer always can)
        "last_seen_at": "TEXT",
        "source": "TEXT",  # their answer to "how did you hear about us?"
        "landing": "TEXT",  # where their first visit came from (share link tag or referring site)
        "display_name": "TEXT NOT NULL DEFAULT ''",
        "bio": "TEXT NOT NULL DEFAULT ''",
        "instagram": "TEXT NOT NULL DEFAULT ''",
        "profile_public": "INTEGER NOT NULL DEFAULT 0",
    },
    "stories": {
        "subtitle": "TEXT NOT NULL DEFAULT ''",
        "status": "TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'))",
    },
}


# The genres Eidothea starts with; the dataset's own categories already cover the classics
SEED_GENRES = [
    ("Original Cryptids", "Creatures of your own making: sightings, field notes, the lore around them."),
    ("Anomaly Files", "Containment reports and case files on things that shouldn't exist."),
    ("Real-life Mysteries", "Unsolved cases, strange disappearances and things that really happened."),
    ("Analog Horror", "Tapes, broadcasts and old media that went wrong."),
    ("Liminal Spaces", "Empty malls, endless hallways, places between places."),
    ("Rules Horror", "Follow the rules. Don't ask why."),
    ("Found Logs and Transcripts", "Recovered chats, logs, recordings and transcripts."),
    ("Lore and Theories", "Deep dives into the lore of games, films and fictional universes."),
]

def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # FastAPI may run a dependency and its endpoint on different threadpool threads
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        for table, columns in MIGRATIONS.items():
            have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            for name, decl in columns.items():
                if name not in have:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
        conn.execute("CREATE INDEX IF NOT EXISTS stories_status ON stories(status)")
        # Only into an empty table, so a genre a mod removed stays removed
        if not conn.execute("SELECT 1 FROM genres LIMIT 1").fetchone():
            conn.executemany("INSERT INTO genres (name, blurb) VALUES (?, ?)", SEED_GENRES)


def get_db():
    """FastAPI dependency: one connection per request."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
