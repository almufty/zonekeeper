import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'zonekeeper.db');

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

  CREATE TABLE IF NOT EXISTS records (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id              INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    record_name          TEXT NOT NULL,
    record_type          TEXT NOT NULL DEFAULT 'A',
    ttl                  INTEGER NOT NULL DEFAULT 3600,
    proxied              INTEGER NOT NULL DEFAULT 0,
    enabled              INTEGER NOT NULL DEFAULT 1,
    last_ip              TEXT,
    last_checked_at      TEXT,
    last_status          TEXT,
    cloudflare_record_id TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
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

export default db;
