import express from 'express';
import { getAllSettings, setSetting } from '../data/settings.js';
import { updateSchedulerInterval } from '../scheduler.js';
import db from '../db.js';
import { decryptApiKey, encryptApiKey } from '../lib/crypto.js';

const router = express.Router();

router.get('/settings', (req, res) => {
  try {
    const settings = getAllSettings();
    res.json({
      poll_interval: parseInt(settings.poll_interval || '300', 10),
      log_retention_days: parseInt(settings.log_retention_days || '30', 10),
      discord_webhook_url: settings.discord_webhook_url || '',
      telegram_bot_token: settings.telegram_bot_token || '',
      telegram_chat_id: settings.telegram_chat_id || '',
      notify_on_success: settings.notify_on_success === 'true',
      notify_on_error: settings.notify_on_error !== 'false'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

  if (discord_webhook_url !== undefined) {
    setSetting('discord_webhook_url', discord_webhook_url.trim());
  }

  if (telegram_bot_token !== undefined) {
    setSetting('telegram_bot_token', telegram_bot_token.trim());
  }

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
    const accounts = db.prepare('SELECT id, name, auth_email, auth_method, auth_key FROM accounts').all().map(a => ({
      ...a,
      auth_key: decryptApiKey(a.auth_key)
    }));
    const zones = db.prepare('SELECT id, account_id, zone_identifier, name FROM zones').all();
    const records = db.prepare('SELECT id, zone_id, record_name, record_type, ttl, proxied, enabled, cloudflare_record_id FROM records').all();
    const settings = db.prepare('SELECT key, value FROM settings').all();

    res.json({
      version: '1.0.0',
      accounts,
      zones,
      records,
      settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings/restore', (req, res) => {
  const { accounts, zones, records, settings } = req.body;
  if (!Array.isArray(accounts) || !Array.isArray(zones) || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Invalid backup format' });
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
        r.ttl || 3600,
        r.proxied ? 1 : 0,
        r.enabled ? 1 : 0,
        r.cloudflare_record_id || null
      );
    }

    // 5. Restore settings (if present)
    if (Array.isArray(settings)) {
      for (const s of settings) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
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
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

export default router;
