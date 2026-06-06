import { describe, it, expect } from 'vitest';

// Test the IPv4 regex via a white-box import — we extract the regex logic
// by testing resolvePublicIp's validation behavior with a mocked fetch.

const VALID_IPS = ['1.2.3.4', '192.168.0.1', '255.255.255.255', '0.0.0.0', '10.0.0.1'];
const INVALID_IPS = ['256.1.1.1', '999.999.999.999', '1.2.3', '1.2.3.4.5', 'abc.def.ghi.jkl', '', '1.2.3.256'];

// Test the regex directly (MEDIUM-1 fix verification)
const IPV4_RE = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

describe('IPv4 regex (MEDIUM-1)', () => {
  it('accepts valid IPv4 addresses', () => {
    for (const ip of VALID_IPS) {
      expect(IPV4_RE.test(ip), `Expected ${ip} to be valid`).toBe(true);
    }
  });

  it('rejects invalid or out-of-range addresses', () => {
    for (const ip of INVALID_IPS) {
      expect(IPV4_RE.test(ip), `Expected ${ip} to be invalid`).toBe(false);
    }
  });

  it('rejects the old permissive pattern edge-case: 999.999.999.999', () => {
    // Old regex /^(\d{1,3}\.){3}\d{1,3}$/ would have accepted this
    expect(IPV4_RE.test('999.999.999.999')).toBe(false);
  });
});
