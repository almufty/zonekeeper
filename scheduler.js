import { resolvePublicIpV4, resolvePublicIpV6 } from './lib/ipResolver.js';
import { getDnsRecord, updateDnsRecord } from './lib/cloudflare.js';
import { listEnabledRecords, updateRecord } from './data/records.js';
import { insertLog, pruneOldLogs } from './data/syncLog.js';
import { logger } from './lib/logger.js';
import { getSetting } from './data/settings.js';
import { sendNotification } from './lib/notifier.js';

let lastPublicIpV4 = null;
let lastPublicIpV6 = null;
let lastPollTime   = null;
// MEDIUM-7 fix: mutex prevents concurrent syncAll runs (scheduler + manual trigger)
let syncRunning    = false;

export function getLastPublicIpV4() { return lastPublicIpV4; }
export function getLastPublicIpV6() { return lastPublicIpV6; }
export function getLastPollTime()   { return lastPollTime; }

export async function syncRecord(record) {
  let publicIp;
  try {
    if (record.record_type === 'AAAA') {
      publicIp = await resolvePublicIpV6();
    } else {
      publicIp = await resolvePublicIpV4();
    }
  } catch (err) {
    const msg = `Failed to resolve public IP: ${err.message}`;
    insertLog({ record_id: record.id, old_ip: record.last_ip, new_ip: null, status: 'error', message: msg });
    updateRecord(record.id, { last_checked_at: new Date().toISOString(), last_status: 'error' });
    return { status: 'error', message: msg };
  }

  let cfRecord;
  try {
    cfRecord = await getDnsRecord(record, record.zone_identifier, record.record_name, record.record_type);
  } catch (err) {
    const msg = `Cloudflare API error: ${err.message}`;
    insertLog({ record_id: record.id, old_ip: record.last_ip, new_ip: null, status: 'error', message: msg });
    updateRecord(record.id, { last_checked_at: new Date().toISOString(), last_status: 'error' });
    return { status: 'error', message: msg };
  }

  if (!cfRecord) {
    const msg = 'Record does not exist in Cloudflare — create it manually first';
    insertLog({ record_id: record.id, old_ip: record.last_ip, new_ip: null, status: 'error', message: msg });
    updateRecord(record.id, { last_checked_at: new Date().toISOString(), last_status: 'error' });
    return { status: 'error', message: msg };
  }

  if (!record.cloudflare_record_id) {
    updateRecord(record.id, { cloudflare_record_id: cfRecord.id });
    record = { ...record, cloudflare_record_id: cfRecord.id };
  }

  const oldIp = cfRecord.content;
  const now   = new Date().toISOString();

  const ipChanged = publicIp !== oldIp;
  const proxiedChanged = cfRecord.proxied !== record.proxied;
  const ttlChanged = cfRecord.ttl !== record.ttl;

  if (!ipChanged && !proxiedChanged && !ttlChanged) {
    insertLog({ record_id: record.id, old_ip: oldIp, new_ip: publicIp, status: 'unchanged', message: 'IP, proxied status, and TTL unchanged' });
    updateRecord(record.id, { last_ip: publicIp, last_checked_at: now, last_status: 'unchanged' });
    return { status: 'unchanged', old_ip: oldIp, new_ip: publicIp };
  }

  try {
    await updateDnsRecord(record, record.zone_identifier, cfRecord.id, {
      name: record.record_name,
      content: publicIp,
      ttl: record.ttl,
      proxied: record.proxied,
      type: record.record_type,
    });

    const changes = [];
    if (ipChanged) changes.push(`IP from ${oldIp} to ${publicIp}`);
    if (proxiedChanged) changes.push(`proxied status from ${cfRecord.proxied} to ${record.proxied}`);
    if (ttlChanged) changes.push(`TTL from ${cfRecord.ttl} to ${record.ttl}`);
    const message = `Updated ${changes.join(', ')}`;

    insertLog({ record_id: record.id, old_ip: oldIp, new_ip: publicIp, status: 'updated', message });
    updateRecord(record.id, { last_ip: publicIp, last_checked_at: now, last_status: 'updated' });
    return { status: 'updated', old_ip: oldIp, new_ip: publicIp };
  } catch (err) {
    const msg = `Failed to update record: ${err.message}`;
    insertLog({ record_id: record.id, old_ip: oldIp, new_ip: publicIp, status: 'error', message: msg });
    updateRecord(record.id, { last_checked_at: now, last_status: 'error' });
    return { status: 'error', old_ip: oldIp, new_ip: publicIp, message: msg };
  }
}

export async function syncAll() {
  // MEDIUM-7: prevent overlapping sync runs
  if (syncRunning) {
    logger.warn({ event: 'scheduler.skipped' }, 'syncAll skipped — previous run still in progress');
    return [];
  }
  syncRunning = true;

  try {
    try {
      lastPublicIpV4 = await resolvePublicIpV4();
    } catch (err) {
      logger.error({ event: 'scheduler.ipv4.fail', err: err.message }, 'Could not resolve public IPv4');
      lastPublicIpV4 = null;
    }
    try {
      lastPublicIpV6 = await resolvePublicIpV6();
    } catch (err) {
      logger.error({ event: 'scheduler.ipv6.fail', err: err.message }, 'Could not resolve public IPv6');
      lastPublicIpV6 = null;
    }
    lastPollTime = new Date().toISOString();

    const records = listEnabledRecords();
    const results = [];
    const updated = [];
    const errors = [];
    for (const record of records) {
      const result = await syncRecord(record);
      results.push({ record_id: record.id, record_name: record.record_name, ...result });
      if (result.status === 'updated') {
        updated.push({ name: record.record_name, ip: result.new_ip, oldIp: result.old_ip });
      } else if (result.status === 'error') {
        errors.push({ name: record.record_name, error: result.message || 'Unknown error' });
      }
    }

    if (updated.length > 0 && getSetting('notify_on_success', 'false') === 'true') {
      const msg = `✅ **Updated DNS Records**:\n` + updated.map(u => `• \`${u.name}\` ➔ \`${u.ip}\` (was \`${u.oldIp}\`)`).join('\n');
      sendNotification(msg);
    }
    if (errors.length > 0 && getSetting('notify_on_error', 'true') === 'true') {
      const msg = `❌ **Failed DNS record syncs**:\n` + errors.map(e => `• \`${e.name}\`: ${e.error}`).join('\n');
      sendNotification(msg);
    }

    // MEDIUM-10: prune old log entries after each cycle
    const retention = parseInt(getSetting('log_retention_days', process.env.LOG_RETENTION_DAYS || '30'), 10);
    const pruned = pruneOldLogs(retention);
    if (pruned > 0) {
      logger.debug({ event: 'scheduler.prune', pruned }, `Pruned ${pruned} old log entries`);
    }

    return results;
  } finally {
    syncRunning = false;
  }
}

let activeIntervalId = null;

export function updateSchedulerInterval(intervalSec) {
  if (activeIntervalId) {
    clearInterval(activeIntervalId);
  }
  logger.info({ event: 'scheduler.update', intervalSec }, `Scheduler rescheduled — polling every ${intervalSec}s`);
  activeIntervalId = setInterval(() => {
    syncAll().catch(err => logger.error({ event: 'scheduler.error', err: err.message }, 'Sync error'));
  }, intervalSec * 1000);
}

export function startScheduler() {
  const raw = parseInt(getSetting('poll_interval', process.env.POLL_INTERVAL || '300'), 10);
  if (!Number.isFinite(raw) || raw < 60) {
    throw new Error(`POLL_INTERVAL must be a number >= 60 (got "${raw}"). Refusing to start to prevent API rate-limit flooding.`);
  }
  const intervalSec = raw;
  logger.info({ event: 'scheduler.start', intervalSec }, `Scheduler starting — polling every ${intervalSec}s`);

  syncAll().catch(err => logger.error({ event: 'scheduler.init.error', err: err.message }, 'Initial sync error'));
  activeIntervalId = setInterval(() => {
    syncAll().catch(err => logger.error({ event: 'scheduler.error', err: err.message }, 'Sync error'));
  }, intervalSec * 1000);
}
