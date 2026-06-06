import { getSetting } from '../data/settings.js';
import { logger } from './logger.js';

export async function sendNotification(message) {
  const discordUrl = getSetting('discord_webhook_url', '');
  const tgToken = getSetting('telegram_bot_token', '');
  const tgChatId = getSetting('telegram_chat_id', '');

  // Send to Discord
  if (discordUrl) {
    try {
      await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `🔔 **Zonekeeper Notification**\n${message}` }),
      });
      logger.debug({ event: 'notifier.discord.success' }, 'Discord notification sent');
    } catch (err) {
      logger.error({ event: 'notifier.discord.error', err: err.message }, 'Failed to send Discord notification');
    }
  }

  // Send to Telegram
  if (tgToken && tgChatId) {
    try {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: `🔔 Zonekeeper Notification\n${message}`,
        }),
      });
      logger.debug({ event: 'notifier.telegram.success' }, 'Telegram notification sent');
    } catch (err) {
      logger.error({ event: 'notifier.telegram.error', err: err.message }, 'Failed to send Telegram notification');
    }
  }
}
