import express from 'express';
import { getAllSettings, setSetting } from '../data/settings.js';
import { updateSchedulerInterval } from '../scheduler.js';

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

export default router;
