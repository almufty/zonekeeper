import db from '../db.js';

export function listZones(accountId) {
  if (accountId != null) {
    return db.prepare('SELECT * FROM zones WHERE account_id = ? ORDER BY created_at').all(accountId);
  }
  return db.prepare('SELECT * FROM zones ORDER BY created_at').all();
}

export function getZone(id) {
  return db.prepare('SELECT * FROM zones WHERE id = ?').get(id) || null;
}

export function createZone({ account_id, zone_identifier, name }) {
  const result = db.prepare(
    'INSERT INTO zones (account_id, zone_identifier, name) VALUES (?, ?, ?)'
  ).run(account_id, zone_identifier, name);
  return getZone(Number(result.lastInsertRowid));
}

export function deleteZone(id) {
  db.prepare('DELETE FROM zones WHERE id = ?').run(id);
}
