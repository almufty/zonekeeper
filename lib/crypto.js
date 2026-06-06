import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const ENC_PREFIX = 'v1:';

const rawKey = process.env.ENCRYPTION_KEY;
const KEY = rawKey ? Buffer.from(rawKey, 'hex') : null;

if (!KEY) {
  logger.warn({ event: 'crypto.no-key' }, 'ENCRYPTION_KEY not set — Cloudflare API keys stored in plaintext. Set a 64-char hex secret.');
} else if (KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
}

export const encryptionEnabled = !!KEY;

export function encryptApiKey(plaintext) {
  if (!KEY) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored) {
  if (!stored || !stored.startsWith(ENC_PREFIX)) {
    // Plaintext — legacy or no encryption key configured
    return stored;
  }
  if (!KEY) {
    throw new Error('ENCRYPTION_KEY is required to decrypt stored Cloudflare credentials');
  }
  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted key value');

  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}

/** Encrypt any plaintext keys in the accounts table that are not yet encrypted. */
export function migrateApiKeys(db) {
  if (!KEY) return;

  const rows = db.prepare('SELECT id, auth_key FROM accounts').all();
  let count = 0;
  for (const row of rows) {
    if (!row.auth_key.startsWith(ENC_PREFIX)) {
      db.prepare('UPDATE accounts SET auth_key = ? WHERE id = ?').run(encryptApiKey(row.auth_key), row.id);
      count++;
    }
  }
  if (count > 0) {
    logger.info({ event: 'crypto.migration', count }, `Encrypted ${count} plaintext API key(s)`);
  }
}
