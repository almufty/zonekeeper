import db from '../db.js';
import { decryptApiKey } from '../lib/crypto.js';

function rowToRecord(row) {
  if (!row) return null;
  const record = {
    ...row,
    proxied: row.proxied === 1,
    enabled: row.enabled === 1,
  };
  // Decrypt auth_key when present (from listEnabledRecords JOIN)
  if (record.auth_key) {
    record.auth_key = decryptApiKey(record.auth_key);
  }
  return record;
}

export function listRecords(zoneId) {
  if (zoneId != null) {
    return db.prepare('SELECT * FROM records WHERE zone_id = ? ORDER BY record_name').all(zoneId).map(rowToRecord);
  }
  return db.prepare('SELECT * FROM records ORDER BY record_name').all().map(rowToRecord);
}

export function getRecord(id) {
  return rowToRecord(db.prepare('SELECT * FROM records WHERE id = ?').get(id) ?? null);
}

export function createRecord({ zone_id, record_name, record_type = 'A', ttl = 3600, proxied = false, enabled = true, cloudflare_record_id = null }) {
  const result = db.prepare(
    `INSERT INTO records (zone_id, record_name, record_type, ttl, proxied, enabled, cloudflare_record_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(zone_id, record_name, record_type, ttl, proxied ? 1 : 0, enabled ? 1 : 0, cloudflare_record_id);
  return getRecord(Number(result.lastInsertRowid));
}

export function updateRecord(id, fields) {
  const allowed = ['record_name', 'record_type', 'ttl', 'proxied', 'enabled', 'last_ip', 'last_checked_at', 'last_status', 'cloudflare_record_id'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k));
  if (updates.length === 0) return getRecord(id);
  const values = updates.map(k => {
    if (k === 'proxied' || k === 'enabled') return fields[k] ? 1 : 0;
    return fields[k];
  });
  const sql = `UPDATE records SET ${updates.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return getRecord(id);
}

export function deleteRecord(id) {
  db.prepare('DELETE FROM records WHERE id = ?').run(id);
}

export function listEnabledRecords() {
  const rows = db.prepare(`
    SELECT
      records.*,
      zones.zone_identifier,
      accounts.auth_email,
      accounts.auth_method,
      accounts.auth_key
    FROM records
    JOIN zones    ON zones.id    = records.zone_id
    JOIN accounts ON accounts.id = zones.account_id
    WHERE records.enabled = 1
  `).all();
  return rows.map(rowToRecord);
}
