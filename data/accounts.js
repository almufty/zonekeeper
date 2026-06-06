import db from '../db.js';
import { encryptApiKey, decryptApiKey } from '../lib/crypto.js';

// HIGH-4: strip auth_key from public-facing functions by default.
// getAccountWithKey() returns the decrypted key for internal/privileged use.

function rowToAccount(row, includeKey = false) {
  if (!row) return null;
  const { auth_key, ...rest } = row;
  if (!includeKey) return rest;
  return { ...rest, auth_key: decryptApiKey(auth_key) };
}

export function listAccounts() {
  return db.prepare('SELECT * FROM accounts ORDER BY created_at').all().map(r => rowToAccount(r, false));
}

export function getAccount(id) {
  return rowToAccount(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) ?? null, false);
}

/** Returns the account including the decrypted auth_key — for API calls and the key-reveal endpoint. */
export function getAccountWithKey(id) {
  return rowToAccount(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) ?? null, true);
}

export function createAccount({ name, auth_email, auth_method, auth_key }) {
  const result = db.prepare(
    'INSERT INTO accounts (name, auth_email, auth_method, auth_key) VALUES (?, ?, ?, ?)'
  ).run(name, auth_email, auth_method, encryptApiKey(auth_key));
  return getAccount(Number(result.lastInsertRowid));
}

export function updateAccount(id, fields) {
  const allowed = ['name', 'auth_email', 'auth_method', 'auth_key'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k) && fields[k] !== undefined && fields[k] !== '');
  if (updates.length === 0) return getAccount(id);

  const values = updates.map(k => k === 'auth_key' ? encryptApiKey(fields[k]) : fields[k]);
  const sql = `UPDATE accounts SET ${updates.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return getAccount(id);
}

export function deleteAccount(id) {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}
