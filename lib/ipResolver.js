import { logger } from './logger.js';

const IPV4_RE = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

const FETCH_TIMEOUT_MS = 5000;

/**
 * L-8 fix: single helper drives the ordered fallback chain for both IP families,
 * removing the duplicated try/catch blocks.
 *
 * @param {Array<{ url: string, label: string, parse?: (text: string) => string }>} sources
 * @param {RegExp} validator
 * @returns {Promise<string>}
 */
async function resolveFromSources(sources, validator) {
  for (const { url, label, parse } of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      const text = await res.text();
      const ip = (parse ? parse(text) : text).trim();
      if (validator.test(ip)) return ip;
    } catch (err) {
      logger.warn({ event: `ipResolver.${label}.fail`, err: err.message }, `${label} lookup failed`);
    }
  }
  throw new Error('Could not resolve a valid public IP address');
}

const parseCloudflareTrace = (text) => text.match(/^ip=(.+)$/m)?.[1] ?? '';

export async function resolvePublicIpV4() {
  return resolveFromSources([
    { url: 'https://api4.ipify.org',           label: 'v4.ipify' },
    { url: 'https://ipv4.icanhazip.com',       label: 'v4.icanhazip' },
    { url: 'https://cloudflare.com/cdn-cgi/trace', label: 'v4.cloudflare', parse: parseCloudflareTrace },
    { url: 'https://v4.ident.me',              label: 'v4.identme' },
  ], IPV4_RE).catch(() => {
    throw new Error('Could not resolve a valid public IPv4 address');
  });
}

export async function resolvePublicIpV6() {
  return resolveFromSources([
    { url: 'https://api6.ipify.org',           label: 'v6.ipify' },
    { url: 'https://ipv6.icanhazip.com',       label: 'v6.icanhazip' },
    { url: 'https://cloudflare.com/cdn-cgi/trace', label: 'v6.cloudflare', parse: parseCloudflareTrace },
    { url: 'https://v6.ident.me',              label: 'v6.identme' },
  ], IPV6_RE).catch(() => {
    throw new Error('Could not resolve a valid public IPv6 address');
  });
}

export async function resolvePublicIp() {
  return resolvePublicIpV4();
}
