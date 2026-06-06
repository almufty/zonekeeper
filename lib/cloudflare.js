const CF_BASE = 'https://api.cloudflare.com/client/v4';

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
  const body = await res.json();
  if (!body.success) {
    const msg = body.errors?.[0]?.message || 'Cloudflare API error';
    throw new Error(msg);
  }
  return body;
}

export async function getZones(account) {
  const body = await cfFetch(
    `${CF_BASE}/zones?per_page=50&status=active`,
    { headers: authHeaders(account) }
  );
  return body.result;
}

export async function getDnsRecord(account, zoneIdentifier, recordName) {
  const url = `${CF_BASE}/zones/${zoneIdentifier}/dns_records?type=A&name=${encodeURIComponent(recordName)}`;
  const body = await cfFetch(url, { headers: authHeaders(account) });
  if (!body.result || body.result.length === 0) return null;
  return body.result[0];
}

export async function updateDnsRecord(account, zoneIdentifier, recordId, { name, content, ttl, proxied }) {
  const url = `${CF_BASE}/zones/${zoneIdentifier}/dns_records/${recordId}`;
  const body = await cfFetch(url, {
    method: 'PATCH',
    headers: authHeaders(account),
    body: JSON.stringify({ type: 'A', name, content, ttl, proxied }),
  });
  return body.result;
}

export async function listDnsRecords(account, zoneIdentifier) {
  const url = `${CF_BASE}/zones/${zoneIdentifier}/dns_records?type=A&per_page=100`;
  const body = await cfFetch(url, { headers: authHeaders(account) });
  return body.result;
}
