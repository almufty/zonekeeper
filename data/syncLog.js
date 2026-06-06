import db from '../db.js';

export function insertLog({ record_id, old_ip, new_ip, status, message }) {
  db.prepare(
    'INSERT INTO sync_log (record_id, old_ip, new_ip, status, message) VALUES (?, ?, ?, ?, ?)'
  ).run(record_id, old_ip ?? null, new_ip ?? null, status, message ?? null);
}

export function getLogForRecord(recordId, limit = 50) {
  return db.prepare(
    'SELECT * FROM sync_log WHERE record_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(recordId, limit);
}

export function getRecentLogs(limit = 20) {
  return db.prepare(`
    SELECT sync_log.*, records.record_name
    FROM sync_log
    JOIN records ON records.id = sync_log.record_id
    ORDER BY sync_log.timestamp DESC
    LIMIT ?
  `).all(limit);
}

// MEDIUM-10: prune old log entries to prevent unbounded table growth
export function pruneOldLogs(retentionDays = 30) {
  const result = db.prepare(
    `DELETE FROM sync_log WHERE timestamp < datetime('now', ? || ' days')`
  ).run(`-${retentionDays}`);
  return result.changes;
}
