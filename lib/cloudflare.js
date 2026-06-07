// HIGH-2 fix: validate Cloudflare IDs before interpolating into URLs
const CF_ID_RE = /^[a-f0-9]{32}$/;
const CF_BASE  = 'https://api.cloudflare.com/client/v4';

export function isValidCfId(id) {
  return typeof id === 'string' && CF_ID_RE.test(id);
}

function assertCfId(value, label) {
  if (!isValidCfId(value)) {
    throw new Error(`Invalid ${label}: must be a 32-character hex Cloudflare ID`);
  }
}

function authHeaders(account) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Email': account.auth_email,
  };
  if (account.auth_method === 'global') {
    headers['X-Auth-Key'] = account.auth_key;
  } else {
    headers['Authorization'] = `Bearer ${account.auth_key}`;
  }
  return headers;
}

async function cfFetch(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });

  // M-7 fix: guard against non-JSON responses (e.g. 5xx HTML error pages, gateway
  // timeouts) so we surface a clear status-based message instead of an opaque
  // "Unexpected token" JSON parse error.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Cloudflare API returned a non-JSON response (HTTP ${res.status})`);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Cloudflare API returned an unparseable response (HTTP ${res.status})`);
  }

  if (!res.ok || !body.success) {
    const msg = body.errors?.[0]?.message || `Cloudflare API error (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return body;
}

async function cfFetchAll(buildUrl, account, perPage = 100) {
  const results = [];
  let page = 1;
  const sep = buildUrl.includes('?') ? '&' : '?';
  while (true) {
    const url = `${buildUrl}${sep}per_page=${perPage}&page=${page}`;
    const body = await cfFetch(url, { headers: authHeaders(account) });
    results.push(...body.result);
    const info = body.result_info;
    if (!info || page >= info.total_pages) break;
    page++;
  }
  return results;
}

export async function getZones(account) {
  return cfFetchAll(`${CF_BASE}/zones?status=active`, account);
}

export async function getDnsRecord(account, zoneIdentifier, recordName, recordType = 'A') {
  assertCfId(zoneIdentifier, 'zone_identifier');
  const url = `${CF_BASE}/zones/${zoneIdentifier}/dns_records?type=${recordType}&name=${encodeURIComponent(recordName)}`;
  const body = await cfFetch(url, { headers: authHeaders(account) });
  if (!body.result || body.result.length === 0) return null;
  return body.result[0];
}

export async function updateDnsRecord(account, zoneIdentifier, recordId, { name, content, ttl, proxied, type = 'A' }) {
  assertCfId(zoneIdentifier, 'zone_identifier');
  assertCfId(recordId, 'record_id');
  const url = `${CF_BASE}/zones/${zoneIdentifier}/dns_records/${recordId}`;
  const body = await cfFetch(url, {
    method: 'PATCH',
    headers: authHeaders(account),
    body: JSON.stringify({ type, name, content, ttl, proxied }),
  });
  return body.result;
}

export async function listDnsRecords(account, zoneIdentifier) {
  assertCfId(zoneIdentifier, 'zone_identifier');
  const all = await cfFetchAll(
    `${CF_BASE}/zones/${zoneIdentifier}/dns_records`,
    account,
  );
  return all.filter(r => r.type === 'A' || r.type === 'AAAA');
}
