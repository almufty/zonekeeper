import { logger } from './logger.js';

const IPV4_RE = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export async function resolvePublicIpV4() {
  // Fallback 1: api4.ipify.org
  try {
    const res = await fetch('https://api4.ipify.org', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV4_RE.test(ip)) return ip;
  } catch (err) {
    logger.warn({ event: 'ipResolver.v4.ipify.fail', err: err.message }, 'IPv4 ipify failed');
  }

  // Fallback 2: ipv4.icanhazip.com
  try {
    const res = await fetch('https://ipv4.icanhazip.com', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV4_RE.test(ip)) return ip;
  } catch (err) {
    logger.warn({ event: 'ipResolver.v4.icanhazip.fail', err: err.message }, 'IPv4 icanhazip failed');
  }

  // Fallback 3: Cloudflare trace
  try {
    const res = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const match = text.match(/^ip=(.+)$/m);
    if (match && IPV4_RE.test(match[1].trim())) return match[1].trim();
  } catch (err) {
    logger.warn({ event: 'ipResolver.v4.cloudflare.fail', err: err.message }, 'IPv4 Cloudflare trace failed');
  }

  throw new Error('Could not resolve a valid public IPv4 address');
}

export async function resolvePublicIpV6() {
  // Fallback 1: api6.ipify.org
  try {
    const res = await fetch('https://api6.ipify.org', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV6_RE.test(ip)) return ip;
  } catch (err) {
    logger.warn({ event: 'ipResolver.v6.ipify.fail', err: err.message }, 'IPv6 ipify failed');
  }

  // Fallback 2: ipv6.icanhazip.com
  try {
    const res = await fetch('https://ipv6.icanhazip.com', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV6_RE.test(ip)) return ip;
  } catch (err) {
    logger.warn({ event: 'ipResolver.v6.icanhazip.fail', err: err.message }, 'IPv6 icanhazip failed');
  }

  // Fallback 3: Cloudflare trace
  try {
    const res = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const match = text.match(/^ip=(.+)$/m);
    if (match && IPV6_RE.test(match[1].trim())) return match[1].trim();
  } catch (err) {
    logger.warn({ event: 'ipResolver.v6.cloudflare.fail', err: err.message }, 'IPv6 Cloudflare trace failed');
  }

  throw new Error('Could not resolve a valid public IPv6 address');
}

export async function resolvePublicIp() {
  return resolvePublicIpV4();
}
