import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// HIGH-5 fix: removed '..' — default DB lives alongside server.js, not one level up
const dbPath = process.env.DB_PATH || path.join(__dirname, 'zonekeeper.db');

const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    auth_email  TEXT NOT NULL,
    auth_method TEXT NOT NULL CHECK(auth_method IN ('global', 'token')),
    auth_key    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zones (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    zone_identifier  TEXT NOT NULL,
    name             TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id  INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    timestamp  TEXT NOT NULL DEFAULT (datetime('now')),
    old_ip     TEXT,
    new_ip     TEXT,
    status     TEXT NOT NULL CHECK(status IN ('updated', 'unchanged', 'error')),
    message    TEXT
  );
`);

// MEDIUM-6 + MEDIUM-5 fix: recreate records table with CHECK constraints on
// record_type and ttl if they are not yet present. Idempotent — skipped if
// the constraints already exist in the table DDL.
const recordsDdl = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='records'"
).get();

if (!recordsDdl || !recordsDdl.sql.includes("CHECK(record_type IN")) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;

    CREATE TABLE IF NOT EXISTS records_new (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id              INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      record_name          TEXT NOT NULL,
      record_type          TEXT NOT NULL DEFAULT 'A' CHECK(record_type IN ('A', 'AAAA')),
      ttl                  INTEGER NOT NULL DEFAULT 3600 CHECK(ttl = 1 OR (ttl >= 60 AND ttl <= 86400)),
      proxied              INTEGER NOT NULL DEFAULT 0,
      enabled              INTEGER NOT NULL DEFAULT 1,
      last_ip              TEXT,
      last_checked_at      TEXT,
      last_status          TEXT,
      cloudflare_record_id TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO records_new
      SELECT id, zone_id, record_name,
             CASE WHEN record_type IN ('A','AAAA') THEN record_type ELSE 'A' END,
             CASE WHEN ttl = 1 OR (ttl >= 60 AND ttl <= 86400) THEN ttl ELSE 3600 END,
             proxied, enabled, last_ip, last_checked_at, last_status,
             cloudflare_record_id, created_at
      FROM records;

    DROP TABLE IF EXISTS records;
    ALTER TABLE records_new RENAME TO records;

    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

export default db;
