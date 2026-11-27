import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import { createHashGate } from '../../src/hashGate';
import {
  checkPasswordLength,
  createPasswordService,
  DEFAULT_SCRYPT,
} from '../../src/passwordService';

const cheap = { N: 1024, r: 8, p: 1 };

describe('PasswordService (BR4.2, NFR2.20)', () => {
  it('stores parameters with the hash and gives a different hash for the same password (salt)', async () => {
    const svc = createPasswordService(createHashGate(), cheap);
    const [a, b] = await Promise.all([svc.hash('kata-sandi-panjang'), svc.hash('kata-sandi-panjang')]);
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$1024$8$1$')).toBe(true);
    expect(await svc.verify('kata-sandi-panjang', a)).toBe(true);
  });

  it('rejects a wrong password and a malformed stored value', async () => {
    const svc = createPasswordService(createHashGate(), cheap);
    const h = await svc.hash('kata-sandi-panjang');
    expect(await svc.verify('kata-sandi-salah!', h)).toBe(false);
    expect(await svc.verify('x', 'bukan-hash')).toBe(false);
    expect(await svc.verify('x', 'scrypt$a$b$c$d$e')).toBe(false);
  });

  it('still reads a hash made with older (smaller) parameters after the defaults change', async () => {
    const old = createPasswordService(createHashGate(), { N: 512, r: 8, p: 1 });
    const stored = await old.hash('kata-sandi-lama!');
    const current = createPasswordService(createHashGate(), cheap);
    expect(await current.verify('kata-sandi-lama!', stored)).toBe(true);
  });

  it('accepts non-ASCII characters and spaces', async () => {
    const svc = createPasswordService(createHashGate(), cheap);
    const pw = 'Sandi ünïcødé 日本語 ok';
    expect(await svc.verify(pw, await svc.hash(pw))).toBe(true);
  });

  it('uses scrypt N=32768, r=8, p=1 by default (NFR2.20)', () => {
    expect(DEFAULT_SCRYPT).toEqual({ N: 32768, r: 8, p: 1 });
  });

  it('hashes with the default parameters within the 64 MiB limit', async () => {
    const svc = createPasswordService(createHashGate());
    const h = await svc.hash('kata-sandi-panjang');
    expect(h.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(await svc.verify('kata-sandi-panjang', h)).toBe(true);
  });

  it('verifyDummy always fails but takes a slot of the same gate', async () => {
    const gate = createHashGate({ slots: 1 });
    const svc = createPasswordService(gate, cheap);
    const p = svc.verifyDummy('apa-saja-1234');
    expect(gate.active).toBe(1);
    expect(await p).toBe(false);
    expect(gate.active).toBe(0);
  });

  it('checks length 10..128 before hashing: 9 and 129 are rejected, 10 and 128 pass', () => {
    expect(() => checkPasswordLength('a'.repeat(9))).toThrow(ValidationError);
    expect(() => checkPasswordLength('a'.repeat(129))).toThrow(ValidationError);
    expect(checkPasswordLength('a'.repeat(10))).toHaveLength(10);
    expect(checkPasswordLength('a'.repeat(128))).toHaveLength(128);
    expect(() => checkPasswordLength(undefined)).toThrow(ValidationError);
    expect(() => checkPasswordLength(12345678901 as unknown)).toThrow(ValidationError);
  });
});
