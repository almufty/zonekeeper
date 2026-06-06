import db from '../db.js';

// TODO: encrypt auth_key before storing and decrypt on read when adding encryption-at-rest support

function rowToAccount(row) {
  if (!row) return null;
  return { ...row };
}

export function listAccounts() {
  return db.prepare('SELECT * FROM accounts ORDER BY created_at').all().map(rowToAccount);
}

export function getAccount(id) {
  return rowToAccount(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) || null);
}

export function createAccount({ name, auth_email, auth_method, auth_key }) {
  const result = db.prepare(
    'INSERT INTO accounts (name, auth_email, auth_method, auth_key) VALUES (?, ?, ?, ?)'
  ).run(name, auth_email, auth_method, auth_key);
  return getAccount(Number(result.lastInsertRowid));
}

export function updateAccount(id, fields) {
  const allowed = ['name', 'auth_email', 'auth_method', 'auth_key'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k));
  if (updates.length === 0) return getAccount(id);
  const sql = `UPDATE accounts SET ${updates.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...updates.map(k => fields[k]), id);
  return getAccount(id);
}

export function deleteAccount(id) {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}
