const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export async function resolvePublicIp() {
  // Primary: cloudflare trace
  try {
    const res = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const match = text.match(/^ip=(.+)$/m);
    if (match && IPV4_RE.test(match[1].trim())) return match[1].trim();
  } catch {}

  // Fallback 1
  try {
    const res = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV4_RE.test(ip)) return ip;
  } catch {}

  // Fallback 2
  try {
    const res = await fetch('https://ipv4.icanhazip.com', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (IPV4_RE.test(ip)) return ip;
  } catch {}

  throw new Error('Could not resolve a valid public IPv4 address from any source');
}
