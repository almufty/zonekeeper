import express from 'express';
import { getAllSettings, getSetting, setSetting } from '../data/settings.js';
import { updateSchedulerInterval } from '../scheduler.js';
import db from '../db.js';
import { decryptApiKey, encryptApiKey } from '../lib/crypto.js';
import { isValidCfId } from '../lib/cloudflare.js';
import { serverError } from '../lib/http.js';

const router = express.Router();

// L-3: secrets are never returned by the list endpoint — only a fixed mask. The
// real values are available on demand via GET /settings/reveal. On save, a value
// equal to the mask means "unchanged".
const SECRET_MASK = '••••••••';
const maskSecret = (v) => (v ? SECRET_MASK : '');

// M-3: only these keys may be written via restore.
const ALLOWED_SETTING_KEYS = new Set([
  'poll_interval',
  'log_retention_days',
  'discord_webhook_url',
  'telegram_bot_token',
  'telegram_chat_id',
  'notify_on_success',
  'notify_on_error',
]);

function isValidTtl(ttl) {
  return Number.isInteger(ttl) && (ttl === 1 || (ttl >= 60 && ttl <= 86400));
}

router.get('/settings', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const settings = getAllSettings();
    res.json({
      poll_interval: parseInt(settings.poll_interval || '300', 10),
      log_retention_days: parseInt(settings.log_retention_days || '30', 10),
      // L-3: mask secrets; expose booleans so the UI can show set/unset state.
      discord_webhook_url: maskSecret(settings.discord_webhook_url),
      discord_webhook_url_set: !!settings.discord_webhook_url,
      telegram_bot_token: maskSecret(settings.telegram_bot_token),
      telegram_bot_token_set: !!settings.telegram_bot_token,
      telegram_chat_id: settings.telegram_chat_id || '',
      notify_on_success: settings.notify_on_success === 'true',
      notify_on_error: settings.notify_on_error !== 'false'
    });
  } catch (err) {
    serverError(res, err, 'settings.get.error');
  }
});

// L-3: explicit, authenticated reveal of the notification secrets for editing.
router.get('/settings/reveal', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({
      discord_webhook_url: getSetting('discord_webhook_url', ''),
      telegram_bot_token: getSetting('telegram_bot_token', ''),
    });
  } catch (err) {
    serverError(res, err, 'settings.reveal.error');
  }
});

// L-3: skip writing a secret when the client echoes back the mask (unchanged).
function setSecretIfChanged(key, value) {
  if (value === undefined || value === SECRET_MASK) return;
  setSetting(key, value.trim());
}

router.put('/settings', (req, res) => {
  const {
    poll_interval,
    log_retention_days,
    discord_webhook_url,
    telegram_bot_token,
    telegram_chat_id,
    notify_on_success,
    notify_on_error
  } = req.body;

  if (poll_interval !== undefined) {
    const raw = parseInt(poll_interval, 10);
    if (isNaN(raw) || raw < 60) {
      return res.status(400).json({ error: 'Poll interval must be a number >= 60 seconds' });
    }
    setSetting('poll_interval', raw);
    updateSchedulerInterval(raw);
  }

  if (log_retention_days !== undefined) {
    const raw = parseInt(log_retention_days, 10);
    if (isNaN(raw) || raw < 1) {
      return res.status(400).json({ error: 'Log retention days must be a number >= 1' });
    }
    setSetting('log_retention_days', raw);
  }

  setSecretIfChanged('discord_webhook_url', discord_webhook_url);
  setSecretIfChanged('telegram_bot_token', telegram_bot_token);

  if (telegram_chat_id !== undefined) {
    setSetting('telegram_chat_id', telegram_chat_id.trim());
  }

  if (notify_on_success !== undefined) {
    setSetting('notify_on_success', notify_on_success ? 'true' : 'false');
  }

  if (notify_on_error !== undefined) {
    setSetting('notify_on_error', notify_on_error ? 'true' : 'false');
  }

  res.json({ ok: true });
});

router.get('/settings/backup', (req, res) => {
  try {
    // H-2: this response contains decrypted Cloudflare credentials — never cache it.
    res.set('Cache-Control', 'no-store');
    const accounts = db.prepare('SELECT id, name, auth_email, auth_method, auth_key FROM accounts').all().map(a => ({
      ...a,
      auth_key: decryptApiKey(a.auth_key)
    }));
    const zones = db.prepare('SELECT id, account_id, zone_identifier, name FROM zones').all();
    const records = db.prepare('SELECT id, zone_id, record_name, record_type, ttl, proxied, enabled, cloudflare_record_id FROM records').all();
    const settings = db.prepare('SELECT key, value FROM settings').all();

    res.json({
      version: '1.1.1',
      accounts,
      zones,
      records,
      settings
    });
  } catch (err) {
    serverError(res, err, 'settings.backup.error');
  }
});

// H-2 / M-3: fully validate the payload BEFORE any destructive write so a malformed
// backup cannot wipe a working configuration.
function validateBackup({ accounts, zones, records, settings }) {
  if (!Array.isArray(accounts) || !Array.isArray(zones) || !Array.isArray(records)) {
    return 'Invalid backup format: accounts, zones, and records must be arrays';
  }
  for (const a of accounts) {
    if (!a || typeof a.name !== 'string' || !a.name.trim()) return 'Invalid account: name is required';
    if (typeof a.auth_email !== 'string' || !a.auth_email.trim()) return `Invalid account "${a.name}": auth_email is required`;
    if (!['global', 'token'].includes(a.auth_method)) return `Invalid account "${a.name}": auth_method must be "global" or "token"`;
    if (typeof a.auth_key !== 'string' || !a.auth_key) return `Invalid account "${a.name}": auth_key is required`;
  }
  for (const z of zones) {
    if (!z || typeof z.name !== 'string' || !z.name.trim()) return 'Invalid zone: name is required';
    if (!isValidCfId(z.zone_identifier)) return `Invalid zone "${z.name}": zone_identifier must be a 32-character Cloudflare ID`;
    if (z.account_id === undefined || z.account_id === null) return `Invalid zone "${z.name}": account_id is required`;
  }
  for (const r of records) {
    if (!r || typeof r.record_name !== 'string' || !r.record_name.trim()) return 'Invalid record: record_name is required';
    const type = r.record_type ?? 'A';
    if (!['A', 'AAAA'].includes(type)) return `Invalid record "${r.record_name}": record_type must be "A" or "AAAA"`;
    const ttl = r.ttl ?? 3600;
    if (!isValidTtl(Number(ttl))) return `Invalid record "${r.record_name}": ttl must be 1 or between 60 and 86400`;
    if (r.cloudflare_record_id && !isValidCfId(r.cloudflare_record_id)) return `Invalid record "${r.record_name}": cloudflare_record_id must be a 32-character Cloudflare ID`;
    if (r.zone_id === undefined || r.zone_id === null) return `Invalid record "${r.record_name}": zone_id is required`;
  }
  if (settings !== undefined && !Array.isArray(settings)) {
    return 'Invalid backup format: settings must be an array when present';
  }
  return null;
}

router.post('/settings/restore', (req, res) => {
  const { accounts, zones, records, settings } = req.body;

  // H-2 / M-3: validate everything up front; bail out before deleting anything.
  const validationError = validateBackup({ accounts, zones, records, settings });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const runRestore = db.transaction(() => {
    // 1. Wipe existing config data
    db.prepare('DELETE FROM sync_log').run();
    db.prepare('DELETE FROM records').run();
    db.prepare('DELETE FROM zones').run();
    db.prepare('DELETE FROM accounts').run();

    // 2. Restore accounts and map their old IDs to new IDs
    const accountIdMap = new Map();
    for (const a of accounts) {
      const encryptedKey = encryptApiKey(a.auth_key);
      const result = db.prepare(
        'INSERT INTO accounts (name, auth_email, auth_method, auth_key) VALUES (?, ?, ?, ?)'
      ).run(a.name, a.auth_email, a.auth_method, encryptedKey);
      accountIdMap.set(a.id, Number(result.lastInsertRowid));
    }

    // 3. Restore zones and map their old IDs to new IDs
    const zoneIdMap = new Map();
    for (const z of zones) {
      const newAccountId = accountIdMap.get(z.account_id);
      if (!newAccountId) {
        throw new Error(`Orphaned zone ${z.name}: account not found`);
      }
      const result = db.prepare(
        'INSERT INTO zones (account_id, zone_identifier, name) VALUES (?, ?, ?)'
      ).run(newAccountId, z.zone_identifier, z.name);
      zoneIdMap.set(z.id, Number(result.lastInsertRowid));
    }

    // 4. Restore records
    for (const r of records) {
      const newZoneId = zoneIdMap.get(r.zone_id);
      if (!newZoneId) {
        throw new Error(`Orphaned record ${r.record_name}: zone not found`);
      }
      db.prepare(
        `INSERT INTO records (zone_id, record_name, record_type, ttl, proxied, enabled, cloudflare_record_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newZoneId,
        r.record_name,
        r.record_type || 'A',
        Number(r.ttl) || 3600,
        r.proxied ? 1 : 0,
        r.enabled ? 1 : 0,
        r.cloudflare_record_id || null
      );
    }

    // 5. Restore settings (allow-listed keys only — M-3)
    if (Array.isArray(settings)) {
      for (const s of settings) {
        if (!s || !ALLOWED_SETTING_KEYS.has(s.key)) continue;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, String(s.value));
      }
    }
  });

  try {
    runRestore();
    // After restore, update the scheduler interval in case poll_interval was restored
    const newSettings = db.prepare("SELECT value FROM settings WHERE key = 'poll_interval'").get();
    if (newSettings && newSettings.value) {
      updateSchedulerInterval(parseInt(newSettings.value, 10));
    }
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err, 'settings.restore.error');
  }
});

export default router;
