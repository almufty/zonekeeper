import { describe, it, expect, beforeEach, vi } from 'vitest';

const VALID_KEY = 'a'.repeat(64);

describe('crypto (CRITICAL-2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('encrypts and decrypts a plaintext API key', async () => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    const { encryptApiKey, decryptApiKey } = await import('../../lib/crypto.js');
    const original  = 'my-cloudflare-api-key-abc123';
    const encrypted = encryptApiKey(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(decryptApiKey(encrypted)).toBe(original);
  });

  it('produces different ciphertext each call (random IV)', async () => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    const { encryptApiKey } = await import('../../lib/crypto.js');
    const a = encryptApiKey('same-key');
    const b = encryptApiKey('same-key');
    expect(a).not.toBe(b);
  });

  it('returns plaintext as-is when no ENCRYPTION_KEY is set', async () => {
    delete process.env.ENCRYPTION_KEY;
    const { decryptApiKey } = await import('../../lib/crypto.js');
    expect(decryptApiKey('my-plain-key')).toBe('my-plain-key');
  });

  it('throws when trying to decrypt a v1: value without an ENCRYPTION_KEY', async () => {
    delete process.env.ENCRYPTION_KEY;
    const { decryptApiKey } = await import('../../lib/crypto.js');
    expect(() => decryptApiKey('v1:aabbccdd:eeff0011:223344')).toThrow('ENCRYPTION_KEY is required');
  });

  it('throws on malformed encrypted value (wrong segment count)', async () => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    const { decryptApiKey } = await import('../../lib/crypto.js');
    expect(() => decryptApiKey('v1:only-two:parts')).toThrow('Malformed');
  });

  it('passes through plaintext (no prefix) even when key is set', async () => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    const { decryptApiKey } = await import('../../lib/crypto.js');
    expect(decryptApiKey('legacy-plaintext-key')).toBe('legacy-plaintext-key');
  });
});
