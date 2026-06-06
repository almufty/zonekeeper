import { resolvePublicIp } from './lib/ipResolver.js';
import { getDnsRecord, updateDnsRecord } from './lib/cloudflare.js';
import { listEnabledRecords, updateRecord } from './data/records.js';
import { insertLog } from './data/syncLog.js';

let lastPublicIp = null;
let lastPollTime = null;

export function getLastPublicIp() { return lastPublicIp; }
export function getLastPollTime() { return lastPollTime; }

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

  // Cache the Cloudflare record ID after first successful lookup
  if (!record.cloudflare_record_id) {
    updateRecord(record.id, { cloudflare_record_id: cfRecord.id });
    record = { ...record, cloudflare_record_id: cfRecord.id };
  }

  const oldIp = cfRecord.content;
  const now = new Date().toISOString();

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
  let publicIp = null;
  try {
    publicIp = await resolvePublicIp();
    lastPublicIp = publicIp;
  } catch (err) {
    console.error('[scheduler] Could not resolve public IP:', err.message);
  }
  lastPollTime = new Date().toISOString();

  const records = listEnabledRecords();
  const results = [];
  for (const record of records) {
    const result = await syncRecord(record);
    results.push({ record_id: record.id, record_name: record.record_name, ...result });
  }
  return results;
}

export function startScheduler() {
  const intervalSec = parseInt(process.env.POLL_INTERVAL || '300', 10);
  console.log(`[scheduler] Starting poll every ${intervalSec}s`);
  // Run once immediately on startup
  syncAll().catch(err => console.error('[scheduler] Initial sync error:', err.message));
  setInterval(() => {
    syncAll().catch(err => console.error('[scheduler] Sync error:', err.message));
  }, intervalSec * 1000);
}
