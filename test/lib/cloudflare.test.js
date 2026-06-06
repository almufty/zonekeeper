import { describe, it, expect } from 'vitest';
import { isValidCfId } from '../../lib/cloudflare.js';

describe('isValidCfId (HIGH-2)', () => {
  it('accepts valid 32-char hex Cloudflare IDs', () => {
    expect(isValidCfId('a'.repeat(32))).toBe(true);
    expect(isValidCfId('0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('rejects values that are not 32 hex chars', () => {
    expect(isValidCfId('')).toBe(false);
    expect(isValidCfId('short')).toBe(false);
    expect(isValidCfId('a'.repeat(31))).toBe(false);
    expect(isValidCfId('a'.repeat(33))).toBe(false);
    expect(isValidCfId('ABCDEF0123456789ABCDEF0123456789')).toBe(false); // uppercase
    expect(isValidCfId('../../etc/passwd'.padEnd(32, 'a'))).toBe(false);
    expect(isValidCfId(null)).toBe(false);
    expect(isValidCfId(undefined)).toBe(false);
  });

  it('rejects path-traversal payloads', () => {
    // Ensure URL-injection via zone_identifier is impossible
    expect(isValidCfId('abc123/../zones/evil')).toBe(false);
    expect(isValidCfId('abc123?token=evil')).toBe(false);
  });
});
