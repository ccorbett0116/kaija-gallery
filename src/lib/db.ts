// src/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const defaultPath = path.join(process.cwd(), 'data', 'gallery.sqlite');

// During Next build we can get parallel workers reading the same file; use an
// isolated in-memory DB to avoid SQLITE_BUSY during module evaluation.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.env.SKIP_DB_SETUP === '1';
const dbPath = isBuild ? process.env.BUILD_DB_PATH || ':memory:' : process.env.DB_PATH || defaultPath;
const isMemoryDb = dbPath === ':memory:';

// Ensure directory exists (skip for in-memory)
if (!isMemoryDb) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Ensure media directories exist
const mediaDirectories = [
    path.join(process.cwd(), 'data', 'media', 'originals'),
    path.join(process.cwd(), 'data', 'media', 'thumbnails'),
    path.join(process.cwd(), 'data', 'media', 'web-videos'),
];

for (const dir of mediaDirectories) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Single shared connection
// Increase busy timeout to reduce SQLITE_BUSY errors when multiple workers touch the DB (e.g. during build)
const db = new Database(dbPath, { timeout: 10000 });
db.pragma('busy_timeout = 10000');

// Pragmas tuned for Pi-friendly SQLite later as well
// WAL is only valid for file-backed databases
if (!isMemoryDb) {
    db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

// Schema: matches system prompt
db.exec(`
CREATE TABLE IF NOT EXISTS fields (
  field_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  field_name  TEXT NOT NULL UNIQUE,
  field_type  TEXT NOT NULL DEFAULT 'text'
);

CREATE TABLE IF NOT EXISTS date_entries (
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,             -- ISO 8601 string
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (title, date)
);

CREATE TABLE IF NOT EXISTS date_field_values (
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  field_id   INTEGER NOT NULL,
  field_name TEXT NOT NULL,              -- Denormalized: preserves data when field definition deleted
  field_type TEXT NOT NULL,              -- Denormalized: preserves data when field definition deleted
  value      TEXT NOT NULL,
  FOREIGN KEY (title, date)
    REFERENCES date_entries (title, date)
    ON DELETE CASCADE
  -- Note: No foreign key on field_id to prevent cascade deletion
);

CREATE TABLE IF NOT EXISTS media (
  media_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title               TEXT,              -- nullable: media can exist without a date
  date                TEXT,              -- nullable: media can exist without a date
  file_path_original  TEXT NOT NULL,
  file_path_thumb     TEXT,
  file_path_display   TEXT,
  media_type          TEXT NOT NULL,     -- 'image' | 'video'
  sort_order          INTEGER NOT NULL DEFAULT 0,
  rotation            INTEGER NOT NULL DEFAULT 0, -- degrees clockwise (0,90,180,270)
  uploaded_at         TEXT NOT NULL,     -- track when media was uploaded
  transcoding_status  TEXT NOT NULL DEFAULT 'completed', -- 'pending' | 'processing' | 'completed' | 'failed'
  FOREIGN KEY (title, date)
    REFERENCES date_entries (title, date)
    ON DELETE SET NULL                   -- unlink media if date is deleted
);

CREATE TABLE IF NOT EXISTS ideas (
  idea_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  content     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`);

// Create date_media join table for many-to-many relationship
db.exec(`
CREATE TABLE IF NOT EXISTS date_media (
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  media_id   INTEGER NOT NULL,
  added_at   TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  PRIMARY KEY (title, date, media_id),
  FOREIGN KEY (title, date)
    REFERENCES date_entries (title, date)
    ON DELETE CASCADE,
  FOREIGN KEY (media_id)
    REFERENCES media (media_id)
    ON DELETE CASCADE
);
`);

// Ensure rotation column exists on existing databases
const mediaColumns = db.prepare(`PRAGMA table_info(media)`).all() as { name: string }[];
const hasRotation = mediaColumns.some((c) => c.name === 'rotation');
if (!hasRotation) {
    db.exec(`ALTER TABLE media ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0`);
}

export default db;
