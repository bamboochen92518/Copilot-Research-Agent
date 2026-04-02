import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';
import logger from '../utils/logger';

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS papers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  authors          TEXT    NOT NULL,  -- JSON array
  abstract         TEXT    NOT NULL DEFAULT '',
  url              TEXT    NOT NULL,
  doi              TEXT,
  openalex_id      TEXT    UNIQUE,
  pdf_url          TEXT,
  cited_by_count   INTEGER DEFAULT 0,
  publication_year INTEGER,
  topics           TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  fetch_date       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id            INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  channel_id          TEXT    NOT NULL,
  recommended_date    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL,
  paper_id        INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  favorited_date  TEXT    NOT NULL,
  UNIQUE(user_id, paper_id)
);

-- Maps Discord message IDs (from paper embeds) to paper DB IDs.
-- Used by the reaction handler to know which paper a user starred.
CREATE TABLE IF NOT EXISTS message_papers (
  message_id  TEXT    PRIMARY KEY,
  paper_id    INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_papers_paper ON message_papers(paper_id);

CREATE INDEX IF NOT EXISTS idx_papers_openalex_id   ON papers(openalex_id);
CREATE INDEX IF NOT EXISTS idx_papers_pub_year      ON papers(publication_year);
CREATE INDEX IF NOT EXISTS idx_recommendations_paper ON recommendations(paper_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user        ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_paper       ON favorites(paper_id);
`;

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

/**
 * Returns (and lazily creates) the singleton SQLite connection.
 * Runs the full schema migration on first open so tables always exist.
 */
export function getDatabase(dbPath?: string): Database.Database {
  if (_db) return _db;

  const resolvedPath = dbPath ?? config.database.path;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(resolvedPath);
  _db.exec(SCHEMA);
  logger.info('Database initialised', { path: resolvedPath });
  return _db;
}

/**
 * Closes the database connection and clears the singleton reference.
 * Useful in tests and for graceful shutdown.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    logger.info('Database connection closed');
  }
}

export default getDatabase;
