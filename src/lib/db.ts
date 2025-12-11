// src/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const defaultPath = path.join(process.cwd(), 'data', 'gallery.sqlite');
const dbPath = process.env.DB_PATH || defaultPath;

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Single shared connection
const db = new Database(dbPath);

// Pragmas tuned for Pi-friendly SQLite later as well
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema: matches system prompt
db.exec(`
CREATE TABLE IF NOT EXISTS fields (
  field_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  field_name  TEXT NOT NULL UNIQUE
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
  value      TEXT NOT NULL,
  FOREIGN KEY (title, date)
    REFERENCES date_entries (title, date)
    ON DELETE CASCADE,
  FOREIGN KEY (field_id)
    REFERENCES fields (field_id)
    ON DELETE CASCADE
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
  uploaded_at         TEXT NOT NULL,     -- track when media was uploaded
  transcoding_status  TEXT DEFAULT 'completed', -- 'pending' | 'processing' | 'completed' | 'failed'
  FOREIGN KEY (title, date)
    REFERENCES date_entries (title, date)
    ON DELETE SET NULL                   -- unlink media if date is deleted
);
`);

// Add transcoding_status column to existing tables (migration)
try {
  db.exec(`ALTER TABLE media ADD COLUMN transcoding_status TEXT DEFAULT 'completed'`);
} catch (e) {
  // Column already exists, ignore
}

// Add field_type column to fields table (migration)
try {
  db.exec(`ALTER TABLE fields ADD COLUMN field_type TEXT DEFAULT 'text'`);
} catch (e) {
  // Column already exists, ignore
}

export default db;
