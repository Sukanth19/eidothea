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
    body            TEXT NOT NULL,
    author_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    author_name     TEXT,
    tags            TEXT NOT NULL DEFAULT '[]',  -- JSON array
    categories      TEXT NOT NULL DEFAULT '[]',  -- JSON array
    rating          REAL,
    reading_minutes INTEGER NOT NULL,
    source          TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'import')),
    truncated       INTEGER NOT NULL DEFAULT 0,
    published_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS stories_author ON stories(author_id);
CREATE INDEX IF NOT EXISTS stories_published ON stories(published_at);
CREATE INDEX IF NOT EXISTS stories_rating ON stories(rating);
"""


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


def get_db():
    """FastAPI dependency: one connection per request."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
