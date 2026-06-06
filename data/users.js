import bcrypt from 'bcryptjs';
import db from '../db.js';

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export async function createUser(username, password) {
  const hash = await bcrypt.hash(password, 12);
  return db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
}

export async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

export function userCount() {
  return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
}

export async function updatePassword(userId, newPassword) {
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
}
