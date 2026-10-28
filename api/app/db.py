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

-- One-time links sent by email: confirming an address, resetting a password.
-- Only a hash of the token is kept; `email` is the address being confirmed.
CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
    email      TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Each member can invite a few people; who invited whom is kept for accountability.
CREATE TABLE IF NOT EXISTS invites (
    code       TEXT PRIMARY KEY,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_at    TEXT
);

CREATE INDEX IF NOT EXISTS invites_inviter ON invites(inviter_id);

-- Readers asking to become members; mods decide.
CREATE TABLE IF NOT EXISTS applications (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    decided_at TEXT
);

CREATE INDEX IF NOT EXISTS applications_status ON applications(status);

-- What readers with a confirmed email read, for trending and recommendations
CREATE TABLE IF NOT EXISTS reads (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    first_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_at  TEXT NOT NULL DEFAULT (datetime('now')),
    progress REAL NOT NULL DEFAULT 0,  -- furthest point reached, 0-1
    seconds  INTEGER NOT NULL DEFAULT 0,  -- time spent with the story on screen
    finished INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, story_id)
);

CREATE INDEX IF NOT EXISTS reads_story ON reads(story_id, last_at);

-- Readers following writers, members recommending stories
CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee ON follows(followee_id);

CREATE TABLE IF NOT EXISTS recommends (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id   INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, story_id)
);

CREATE INDEX IF NOT EXISTS recommends_story ON recommends(story_id);

-- Stories saved to read later. Private, unlike recommends.
CREATE TABLE IF NOT EXISTS bookmarks (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id   INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, story_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_story ON bookmarks(story_id);

-- The bell in the nav. kind: see notify.KINDS
CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    actor_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    story_id   INTEGER REFERENCES stories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at    TEXT
);

CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, id);

-- Genres writers can pick on top of the dataset's categories. Mods add more.
CREATE TABLE IF NOT EXISTS genres (
    name       TEXT PRIMARY KEY COLLATE NOCASE,
    blurb      TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Writing prompts the keepers set, open for entries between two dates (inclusive, see prompts.PROMPT_COLUMNS)
CREATE TABLE IF NOT EXISTS prompts (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    starts_on  TEXT NOT NULL,  -- YYYY-MM-DD
    ends_on    TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (ends_on >= starts_on)
);

-- Readers flagging a story or a comment for the keepers. Goes when the thing reported does.
CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id    INTEGER REFERENCES stories(id) ON DELETE CASCADE,
    comment_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    handled_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    handled_at  TEXT,
    CHECK ((story_id IS NULL) <> (comment_id IS NULL))
);

CREATE INDEX IF NOT EXISTS reports_open ON reports(status, story_id, comment_id);

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
        "email": "TEXT",  # set at sign-up; changes only once a new address is confirmed
        "email_verified_at": "TEXT",
        "member": "INTEGER NOT NULL DEFAULT 0",  # may post, comment, rate and vote (staff always may)
        "member_since": "TEXT",
        "member_via": "TEXT",  # founding, invite, approved, granted or grandfathered
        "invited_by": "INTEGER",
        "invite_code": "TEXT",  # the invite they signed up with, used up once their email is confirmed
        "email_follows": "INTEGER NOT NULL DEFAULT 0",  # email me when someone I follow publishes
        "suspended_until": "TEXT",  # may read but not post, comment, rate, vote or report until then
        "suspended_reason": "TEXT NOT NULL DEFAULT ''",
        "show_reads": "INTEGER NOT NULL DEFAULT 1",  # how many stories they've read shows on their profile
    },
    "stories": {
        "subtitle": "TEXT NOT NULL DEFAULT ''",
        "status": "TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'))",
        "announced_at": "TEXT",  # first went live; set once, so republishing doesn't count as new
        "warnings": "TEXT NOT NULL DEFAULT '[]'",  # JSON array of content warnings, see main.ContentWarning
        "prompt_id": "INTEGER REFERENCES prompts(id) ON DELETE SET NULL",  # written for this prompt
    },
    "comments": {
        "parent_id": "INTEGER REFERENCES comments(id) ON DELETE CASCADE",  # a reply; always to a top-level comment
    },
    "notifications": {
        "comment_id": "INTEGER REFERENCES comments(id) ON DELETE CASCADE",  # for replies and mentions
    },
}


# Full-text search over stories (see list_stories), kept in step with the table by triggers.
# Runs after MIGRATIONS, since it reads columns that were added later.
FTS = """
CREATE VIRTUAL TABLE IF NOT EXISTS stories_fts USING fts5(
    title, subtitle, tags, body,
    content='stories', content_rowid='id', tokenize='porter unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS stories_fts_insert AFTER INSERT ON stories BEGIN
    INSERT INTO stories_fts (rowid, title, subtitle, tags, body) VALUES (new.id, new.title, new.subtitle, new.tags, new.body);
END;

CREATE TRIGGER IF NOT EXISTS stories_fts_delete AFTER DELETE ON stories BEGIN
    INSERT INTO stories_fts (stories_fts, rowid, title, subtitle, tags, body)
    VALUES ('delete', old.id, old.title, old.subtitle, old.tags, old.body);
END;

CREATE TRIGGER IF NOT EXISTS stories_fts_update AFTER UPDATE OF title, subtitle, tags, body ON stories BEGIN
    INSERT INTO stories_fts (stories_fts, rowid, title, subtitle, tags, body)
    VALUES ('delete', old.id, old.title, old.subtitle, old.tags, old.body);
    INSERT INTO stories_fts (rowid, title, subtitle, tags, body) VALUES (new.id, new.title, new.subtitle, new.tags, new.body);
END;
"""


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
        added = set()
        for table, columns in MIGRATIONS.items():
            have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            for name, decl in columns.items():
                if name not in have:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
                    added.add((table, name))
        if ("users", "member") in added:
            # Everyone who joined before membership existed keeps what they could do
            conn.execute("UPDATE users SET member = 1, member_since = created_at, member_via = 'grandfathered'")
        if ("stories", "announced_at") in added:
            conn.execute("UPDATE stories SET announced_at = published_at WHERE status = 'published'")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL")
        conn.execute("CREATE INDEX IF NOT EXISTS stories_status ON stories(status)")
        fresh = not conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'stories_fts'").fetchone()
        conn.executescript(FTS)
        if fresh:  # index the stories that were there before search existed
            conn.execute("INSERT INTO stories_fts (stories_fts) VALUES ('rebuild')")
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
