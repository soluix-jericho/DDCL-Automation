import { describe, expect, it } from 'vitest';
import {
  encodeCursor,
  normalizeEmail,
  validateAuditQuery,
  validateCreateUserBody,
  validateEmail,
  validateLoginBody,
  validatePasswordChangeBody,
  validatePatchUserBody,
  validateResetPasswordBody,
} from '../../src/accountRules';
import { ValidationError } from '../../src/errors';

const fieldsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    return (e as ValidationError).fields;
  }
  throw new Error('did not throw');
};

describe('email (BR4.1)', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana@Example.TEST ')).toBe('ana@example.test');
    expect(validateEmail('  Ana@Example.TEST ')).toBe('ana@example.test');
  });

  it('accepts exactly 254 characters and rejects 255', () => {
    const local = 'a'.repeat(254 - '@x.test'.length);
    expect(validateEmail(`${local}@x.test`)).toHaveLength(254);
    expect(fieldsOf(() => validateEmail(`a${local}@x.test`))).toEqual(['email']);
  });

  it.each(['', '   ', 'tanpa-at', 'a@@b.test', 'a@b@c.test', 'a b@c.test', '@c.test', 'a@', 42, null])(
    'rejects %j',
    (v) => {
      expect(() => validateEmail(v)).toThrow(ValidationError);
    },
  );
});

describe('request bodies', () => {
  it('login: needs a valid email and a non-empty password, and does not judge password length', () => {
    expect(validateLoginBody({ email: 'A@b.test', password: 'x' })).toEqual({ email: 'a@b.test', password: 'x' });
    expect(fieldsOf(() => validateLoginBody({ email: 'a@b.test' }))).toEqual(['password']);
    expect(fieldsOf(() => validateLoginBody({ email: 'bad', password: 'x' }))).toEqual(['email']);
    expect(() => validateLoginBody('teks')).toThrow(ValidationError);
    expect(() => validateLoginBody({ email: 'a@b.test', password: 'x'.repeat(1025) })).toThrow(ValidationError);
  });

  it('create user: name 1-100, role enum, password 10-128', () => {
    const ok = { name: ' Ana ', email: 'ana@b.test', role: 'editor', password: 'p'.repeat(10) };
    expect(validateCreateUserBody(ok)).toMatchObject({ name: 'Ana', role: 'editor' });
    expect(validateCreateUserBody({ ...ok, name: 'n'.repeat(100) }).name).toHaveLength(100);
    expect(fieldsOf(() => validateCreateUserBody({ ...ok, name: 'n'.repeat(101) }))).toEqual(['name']);
    expect(fieldsOf(() => validateCreateUserBody({ ...ok, name: '  ' }))).toEqual(['name']);
    expect(fieldsOf(() => validateCreateUserBody({ ...ok, role: 'root' }))).toEqual(['role']);
    expect(fieldsOf(() => validateCreateUserBody({ ...ok, password: 'p'.repeat(9) }))).toEqual(['password']);
    expect(fieldsOf(() => validateCreateUserBody({ ...ok, password: 'p'.repeat(129) }))).toEqual(['password']);
  });

  it('patch user: only role/status; empty or other fields are 400 (BR4.19)', () => {
    expect(validatePatchUserBody({ role: 'viewer' })).toEqual({ role: 'viewer' });
    expect(validatePatchUserBody({ role: 'admin', status: 'inactive' })).toEqual({ role: 'admin', status: 'inactive' });
    expect(() => validatePatchUserBody({})).toThrow(ValidationError);
    expect(fieldsOf(() => validatePatchUserBody({ name: 'x' }))).toEqual(['name']);
    expect(fieldsOf(() => validatePatchUserBody({ role: 'viewer', email: 'x@y.test' }))).toEqual(['email']);
    expect(fieldsOf(() => validatePatchUserBody({ status: 'banned' }))).toEqual(['status']);
    expect(fieldsOf(() => validatePatchUserBody({ role: 'boss' }))).toEqual(['role']);
    expect(() => validatePatchUserBody([])).toThrow(ValidationError);
  });

  it('password change and admin reset: new password 10-128', () => {
    expect(validatePasswordChangeBody({ currentPassword: 'a', newPassword: 'b'.repeat(10) })).toEqual({
      currentPassword: 'a',
      newPassword: 'b'.repeat(10),
    });
    expect(fieldsOf(() => validatePasswordChangeBody({ newPassword: 'b'.repeat(10) }))).toEqual(['currentPassword']);
    expect(fieldsOf(() => validatePasswordChangeBody({ currentPassword: 'a', newPassword: 'short' }))).toEqual(['newPassword']);
    expect(validateResetPasswordBody({ newPassword: 'c'.repeat(128) }).newPassword).toHaveLength(128);
    expect(fieldsOf(() => validateResetPasswordBody({ newPassword: 'c'.repeat(129) }))).toEqual(['newPassword']);
  });
});

describe('audit query (NFR2.28)', () => {
  it('defaults to 50 and accepts 1..100', () => {
    expect(validateAuditQuery({}).limit).toBe(50);
    expect(validateAuditQuery({ limit: '1' }).limit).toBe(1);
    expect(validateAuditQuery({ limit: '100' }).limit).toBe(100);
  });

  it.each([['0'], ['101'], ['-1'], ['abc'], ['1.5']])('rejects limit %s and names the field', (limit) => {
    expect(fieldsOf(() => validateAuditQuery({ limit }))).toEqual(['limit']);
  });

  it('validates type and dates, and a date-only "to" covers the whole day', () => {
    expect(validateAuditQuery({ type: 'login_failed' }).type).toBe('login_failed');
    expect(fieldsOf(() => validateAuditQuery({ type: 'hack' }))).toEqual(['type']);
    expect(fieldsOf(() => validateAuditQuery({ from: '26/10/2026' }))).toEqual(['from']);
    expect(fieldsOf(() => validateAuditQuery({ to: 'besok' }))).toEqual(['to']);
    const q = validateAuditQuery({ from: '2026-10-01', to: '2026-10-02' });
    expect(q.to!.getTime() - q.from!.getTime()).toBe(2 * 86_400_000);
  });

  it('round-trips the cursor and rejects a broken one', () => {
    const c = { occurredAt: new Date('2026-10-01T10:00:00.123Z'), id: 'abc' };
    expect(validateAuditQuery({ cursor: encodeCursor(c) }).cursor).toEqual(c);
    expect(fieldsOf(() => validateAuditQuery({ cursor: 'bukan-kursor' }))).toEqual(['cursor']);
  });
});
