import { logger } from './logger.js';

// MEDIUM-1 fix: validate each octet is 0-255, not just 1-3 digits
const IPV4_RE = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

export async function resolvePublicIp() {
  // Primary: Cloudflare trace
  try {
    const res = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const match = text.match(/^ip=(.+)$/m);
    if (match && IPV4_RE.test(match[1].trim())) return match[1].trim();
  } catch (err) {
    // LOW-5 fix: log instead of silently swallowing
    logger.warn({ event: 'ipResolver.primary.fail', err: err.message }, 'Cloudflare trace failed, trying fallback 1');
  }

  // Fallback 1
  try {
    const res = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV4_RE.test(ip)) return ip;
  } catch (err) {
    logger.warn({ event: 'ipResolver.fallback1.fail', err: err.message }, 'ipify failed, trying fallback 2');
  }

  // Fallback 2
  try {
    const res = await fetch('https://ipv4.icanhazip.com', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV4_RE.test(ip)) return ip;
  } catch (err) {
    logger.warn({ event: 'ipResolver.fallback2.fail', err: err.message }, 'icanhazip failed');
  }

  throw new Error('Could not resolve a valid public IPv4 address from any source');
}
