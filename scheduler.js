import { resolvePublicIp } from './lib/ipResolver.js';
import { getDnsRecord, updateDnsRecord } from './lib/cloudflare.js';
import { listEnabledRecords, updateRecord } from './data/records.js';
import { insertLog, pruneOldLogs } from './data/syncLog.js';
import { logger } from './lib/logger.js';

let lastPublicIp  = null;
let lastPollTime  = null;
// MEDIUM-7 fix: mutex prevents concurrent syncAll runs (scheduler + manual trigger)
let syncRunning   = false;

export function getLastPublicIp()  { return lastPublicIp; }
export function getLastPollTime()  { return lastPollTime; }

export async function syncRecord(record) {
  let publicIp;
  try {
    publicIp = await resolvePublicIp();
  } catch (err) {
    const msg = `Failed to resolve public IP: ${err.message}`;
    insertLog({ record_id: record.id, old_ip: record.last_ip, new_ip: null, status: 'error', message: msg });
    updateRecord(record.id, { last_checked_at: new Date().toISOString(), last_status: 'error' });
    return { status: 'error', message: msg };
  }

  let cfRecord;
  try {
    cfRecord = await getDnsRecord(record, record.zone_identifier, record.record_name);
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

  if (publicIp === oldIp) {
    insertLog({ record_id: record.id, old_ip: oldIp, new_ip: publicIp, status: 'unchanged', message: 'IP unchanged' });
    updateRecord(record.id, { last_ip: publicIp, last_checked_at: now, last_status: 'unchanged' });
    return { status: 'unchanged', old_ip: oldIp, new_ip: publicIp };
  }

  try {
    await updateDnsRecord(record, record.zone_identifier, cfRecord.id, {
      name: record.record_name,
      content: publicIp,
      ttl: record.ttl,
      proxied: record.proxied,
    });
    insertLog({ record_id: record.id, old_ip: oldIp, new_ip: publicIp, status: 'updated', message: `Updated from ${oldIp} to ${publicIp}` });
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
    let publicIp = null;
    try {
      publicIp = await resolvePublicIp();
      lastPublicIp = publicIp;
    } catch (err) {
      logger.error({ event: 'scheduler.ip.fail', err: err.message }, 'Could not resolve public IP');
    }
    lastPollTime = new Date().toISOString();

    const records = listEnabledRecords();
    const results = [];
    for (const record of records) {
      const result = await syncRecord(record);
      results.push({ record_id: record.id, record_name: record.record_name, ...result });
    }

    // MEDIUM-10: prune old log entries after each cycle
    const retention = parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);
    const pruned = pruneOldLogs(retention);
    if (pruned > 0) {
      logger.debug({ event: 'scheduler.prune', pruned }, `Pruned ${pruned} old log entries`);
    }

    return results;
  } finally {
    syncRunning = false;
  }
}

export function startScheduler() {
  // HIGH-6 fix: validate and clamp POLL_INTERVAL to a minimum of 60 seconds
  const raw = parseInt(process.env.POLL_INTERVAL || '300', 10);
  if (!Number.isFinite(raw) || raw < 60) {
    throw new Error(`POLL_INTERVAL must be a number >= 60 (got "${process.env.POLL_INTERVAL}"). Refusing to start to prevent API rate-limit flooding.`);
  }
  const intervalSec = raw;
  logger.info({ event: 'scheduler.start', intervalSec }, `Scheduler starting — polling every ${intervalSec}s`);

  syncAll().catch(err => logger.error({ event: 'scheduler.init.error', err: err.message }, 'Initial sync error'));
  setInterval(() => {
    syncAll().catch(err => logger.error({ event: 'scheduler.error', err: err.message }, 'Sync error'));
  }, intervalSec * 1000);
}
