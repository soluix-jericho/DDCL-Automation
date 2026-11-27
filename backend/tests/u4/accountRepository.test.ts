import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AccountConflictError,
  NotFoundError,
  TooManyAttemptsError,
  UnauthorizedError,
  ValidationError,
} from '../../src/errors';
import { createRepository, Repository } from '../../src/repository';
import { findValidSession } from '../../src/sessionRepository';
import { hashToken } from '../../src/sessionToken';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { cheapPasswords, makeUser, TEST_PASSWORD } from './helpers';

let prisma: PrismaClient;
let repo: Repository;

beforeAll(() => {
  prisma = createTestPrisma();
  repo = createRepository(prisma, { passwords: cheapPasswords });
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
});

const login = (email: string, password = TEST_PASSWORD, token?: string) =>
  repo.login(email, password, '10.0.0.1', token);
const alive = async (token: string) => (await findValidSession(prisma, hashToken(token))) !== null;
const user = (o: Parameters<typeof makeUser>[1] = {}) => makeUser(prisma, { password: TEST_PASSWORD, ...o });
const types = async () => (await prisma.auditEvent.findMany({ orderBy: { occurredAt: 'asc' } })).map((a) => a.type);

describe('login (BR4.3, BR4.4, BR4.5)', () => {
  it('signs in an active account: token, public user, lastLoginAt, throttle row cleared, audit', async () => {
    const u = await user({ email: 'ana@x.test', role: 'editor' });
    await prisma.loginThrottle.create({ data: { email: 'ana@x.test', failedCount: 3 } });
    const r = await login('ana@x.test');
    expect(r.user).toEqual({ id: u.id, name: u.name, email: 'ana@x.test', role: 'editor' });
    expect(await alive(r.token)).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).lastLoginAt).not.toBeNull();
    expect(await prisma.loginThrottle.count()).toBe(0);
    const [ev] = await prisma.auditEvent.findMany();
    expect(ev).toMatchObject({ type: 'login_success', actorUserId: u.id, email: 'ana@x.test', ipAddress: '10.0.0.1' });
  });

  it('answers the same generic 401 for wrong password, unknown email and inactive account, and issues no session', async () => {
    await user({ email: 'ana@x.test' });
    await user({ email: 'off@x.test', status: 'inactive' });
    for (const [email, pw] of [
      ['ana@x.test', 'salah-salah-1'],
      ['ghost@x.test', TEST_PASSWORD],
      ['off@x.test', TEST_PASSWORD],
    ] as const) {
      await expect(login(email, pw)).rejects.toBeInstanceOf(UnauthorizedError);
    }
    expect(await prisma.session.count()).toBe(0);
  });

  it('audits failures only for registered emails (NFR2.30)', async () => {
    await user({ email: 'ana@x.test' });
    await login('ghost@x.test', 'x').catch(() => undefined);
    expect(await prisma.auditEvent.count()).toBe(0);
    await login('ana@x.test', 'salah-salah-1').catch(() => undefined);
    expect(await types()).toEqual(['login_failed']);
  });

  it('locks after 5 failures: 5th is a plain 401 plus one login_locked row; then 429 even with the right password', async () => {
    await user({ email: 'ana@x.test' });
    for (let i = 0; i < 5; i++) {
      await expect(login('ana@x.test', 'salah-salah-1')).rejects.toBeInstanceOf(UnauthorizedError);
    }
    const err = await login('ana@x.test').catch((e) => e);
    expect(err).toBeInstanceOf(TooManyAttemptsError);
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    await login('ana@x.test').catch(() => undefined);
    expect((await types()).filter((t) => t === 'login_locked')).toHaveLength(1);
    expect(await prisma.session.count()).toBe(0);
  });

  it('locks an unregistered email the same way, without writing audit rows', async () => {
    for (let i = 0; i < 5; i++) await login('ghost@x.test', 'x').catch(() => undefined);
    await expect(login('ghost@x.test')).rejects.toBeInstanceOf(TooManyAttemptsError);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('revokes the session the login request carried', async () => {
    await user({ email: 'ana@x.test' });
    const first = await login('ana@x.test');
    const second = await login('ana@x.test', TEST_PASSWORD, first.token);
    expect(await alive(first.token)).toBe(false);
    expect(await alive(second.token)).toBe(true);
  });

  it('keeps several concurrent sessions when no old token is carried', async () => {
    await user({ email: 'ana@x.test' });
    const a = await login('ana@x.test');
    const b = await login('ana@x.test');
    expect(await alive(a.token)).toBe(true);
    expect(await alive(b.token)).toBe(true);
  });

  it('writes no secret into any audit column', async () => {
    await user({ email: 'ana@x.test' });
    const ok = await login('ana@x.test');
    await login('ana@x.test', 'sandi-yang-salah').catch(() => undefined);
    const dump = JSON.stringify(await prisma.auditEvent.findMany());
    for (const secret of [TEST_PASSWORD, 'sandi-yang-salah', ok.token, hashToken(ok.token), 'scrypt$']) {
      expect(dump).not.toContain(secret);
    }
  });

  it('still answers 401, not a failure, when the audit write fails (best effort)', async () => {
    await user({ email: 'ana@x.test' });
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT audit_block CHECK (false) NOT VALID`);
    try {
      await expect(login('ana@x.test', 'salah-salah-1')).rejects.toBeInstanceOf(UnauthorizedError);
      const ok = await login('ana@x.test');
      expect(await alive(ok.token)).toBe(true);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "AuditEvent" DROP CONSTRAINT audit_block`);
    }
  });
});

describe('logout and own password (BR4.7, BR4.12)', () => {
  it('logout revokes only the session in use and writes an audit row', async () => {
    const u = await user({ email: 'ana@x.test' });
    const a = await login('ana@x.test');
    const b = await login('ana@x.test');
    const sid = (await findValidSession(prisma, hashToken(a.token)))!.sessionId;
    await repo.logout(sid, u.id, null);
    expect(await alive(a.token)).toBe(false);
    expect(await alive(b.token)).toBe(true);
    expect(await types()).toContain('logout');
  });

  it('changes the password, revokes the other sessions but not the current one, audits', async () => {
    const u = await user({ email: 'ana@x.test' });
    const cur = await login('ana@x.test');
    const other = await login('ana@x.test');
    const sid = (await findValidSession(prisma, hashToken(cur.token)))!.sessionId;
    await repo.changeOwnPassword(u.id, sid, TEST_PASSWORD, 'kata-sandi-baru-1', null);
    expect(await alive(cur.token)).toBe(true);
    expect(await alive(other.token)).toBe(false);
    await expect(login('ana@x.test')).rejects.toBeInstanceOf(UnauthorizedError);
    expect((await login('ana@x.test', 'kata-sandi-baru-1')).user.id).toBe(u.id);
    expect(await types()).toContain('password_changed');
  });

  it('rejects a wrong current password with a generic 400 and counts it towards the lock', async () => {
    const u = await user({ email: 'ana@x.test' });
    for (let i = 0; i < 5; i++) {
      await expect(repo.changeOwnPassword(u.id, 's', 'bukan-sandi-lama', 'kata-sandi-baru-1', null)).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(repo.changeOwnPassword(u.id, 's', TEST_PASSWORD, 'kata-sandi-baru-1', null)).rejects.toBeInstanceOf(TooManyAttemptsError);
    // The same counter blocks login for this email.
    await expect(login('ana@x.test')).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it('rejects a new password equal to the old one and leaves the hash alone', async () => {
    const u = await user({ email: 'ana@x.test' });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash;
    await expect(repo.changeOwnPassword(u.id, 's', TEST_PASSWORD, TEST_PASSWORD, null)).rejects.toBeInstanceOf(ValidationError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash).toBe(before);
  });
});

describe('createUser and listUsers (BR4.1, BR4.10, BR4.17)', () => {
  const body = { name: 'Budi', email: 'budi@x.test', role: 'viewer' as const, password: 'kata-sandi-awal-1' };

  it('creates an active account without exposing the hash, audits it, and the new user can log in', async () => {
    const admin = await user({ role: 'admin' });
    const created = await repo.createUser(admin.id, body, null);
    expect(created).toMatchObject({ name: 'Budi', email: 'budi@x.test', role: 'viewer', status: 'active', lastLoginAt: null });
    expect(JSON.stringify(created)).not.toMatch(/passwordHash|scrypt/);
    expect((await login('budi@x.test', body.password)).user.role).toBe('viewer');
    expect(await types()).toContain('account_created');
    const list = await repo.listUsers();
    expect(list).toHaveLength(2);
    expect(JSON.stringify(list)).not.toMatch(/passwordHash|scrypt/);
  });

  it('answers 409 for a duplicate email, including an inactive account', async () => {
    const admin = await user({ role: 'admin' });
    await user({ email: 'budi@x.test', status: 'inactive' });
    await expect(repo.createUser(admin.id, body, null)).rejects.toBeInstanceOf(AccountConflictError);
    expect(await prisma.user.count()).toBe(2);
  });

  it('rolls the account back when its audit row cannot be written', async () => {
    const admin = await user({ role: 'admin' });
    await expect(repo.createUser('no-such-actor', body, null)).rejects.toThrow();
    expect(await prisma.user.count({ where: { email: 'budi@x.test' } })).toBe(0);
    expect(admin.id).toBeTruthy();
  });
});

describe('patchUser (BR4.13, BR4.14, BR4.19)', () => {
  it('changes a role, writes role_changed with old and new, and is idempotent for the same role', async () => {
    const admin = await user({ role: 'admin' });
    const t = await user({ role: 'viewer' });
    const r = await repo.patchUser(admin.id, t.id, { role: 'editor' }, null);
    expect(r.role).toBe('editor');
    await repo.patchUser(admin.id, t.id, { role: 'editor' }, null);
    const events = await prisma.auditEvent.findMany({ where: { type: 'role_changed' } });
    expect(events).toHaveLength(1);
    expect(events[0]!.detail).toBe('viewer -> editor');
  });

  it('deactivates an account, revokes its sessions at once, and audits', async () => {
    const admin = await user({ role: 'admin' });
    await user({ role: 'admin' });
    const t = await user({ email: 't@x.test', role: 'editor' });
    const s = await login('t@x.test');
    const r = await repo.patchUser(admin.id, t.id, { status: 'inactive' }, null);
    expect(r.status).toBe('inactive');
    expect(await alive(s.token)).toBe(false);
    await expect(login('t@x.test')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await types()).toContain('account_deactivated');
    // Deactivating again is a no-op (200), not an error and not a second audit row.
    await repo.patchUser(admin.id, t.id, { status: 'inactive' }, null);
    expect((await types()).filter((x) => x === 'account_deactivated')).toHaveLength(1);
  });

  it('refuses: own deactivation, last admin (deactivate and demote), reactivation, unknown id', async () => {
    const admin = await user({ role: 'admin' });
    const t = await user({ role: 'viewer', status: 'inactive' });
    const editor = await user({ role: 'editor' });
    await expect(repo.patchUser(admin.id, admin.id, { status: 'inactive' }, null)).rejects.toBeInstanceOf(AccountConflictError);
    await expect(repo.patchUser(editor.id, admin.id, { role: 'editor' }, null)).rejects.toBeInstanceOf(AccountConflictError);
    await expect(repo.patchUser(editor.id, admin.id, { status: 'inactive' }, null)).rejects.toBeInstanceOf(AccountConflictError);
    await expect(repo.patchUser(admin.id, t.id, { status: 'active' }, null)).rejects.toBeInstanceOf(AccountConflictError);
    await expect(repo.patchUser(admin.id, 'ghost', { role: 'viewer' }, null)).rejects.toBeInstanceOf(NotFoundError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('admin');
  });

  it('judges role and status together against the final state, atomically', async () => {
    const a1 = await user({ role: 'admin' });
    const a2 = await user({ role: 'admin' });
    // Two admins: demoting a2 to viewer AND deactivating a1 in one go would leave none... one call per target here.
    await expect(repo.patchUser(a1.id, a2.id, { role: 'viewer', status: 'inactive' }, null)).resolves.toMatchObject({
      role: 'viewer',
      status: 'inactive',
    });
    // a1 is now the only admin: the same kind of change on a1 by someone else is refused and changes nothing.
    const e = await user({ role: 'editor' });
    await expect(repo.patchUser(e.id, a1.id, { role: 'viewer', status: 'inactive' }, null)).rejects.toBeInstanceOf(AccountConflictError);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: a1.id } });
    expect(row).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('allows demoting yourself when another active admin remains', async () => {
    const a1 = await user({ role: 'admin' });
    await user({ role: 'admin' });
    expect((await repo.patchUser(a1.id, a1.id, { role: 'editor' }, null)).role).toBe('editor');
  });
});

describe('resetPassword and unlock (BR4.18)', () => {
  it('sets a new password, revokes all sessions, clears the lock, audits without the password', async () => {
    const admin = await user({ role: 'admin' });
    const t = await user({ email: 't@x.test' });
    const s = await login('t@x.test');
    for (let i = 0; i < 5; i++) await login('t@x.test', 'salah-salah-1').catch(() => undefined);
    await repo.resetPassword(admin.id, t.id, 'sandi-baru-dari-admin', null);
    expect(await alive(s.token)).toBe(false);
    expect((await login('t@x.test', 'sandi-baru-dari-admin')).user.id).toBe(t.id);
    expect(JSON.stringify(await prisma.auditEvent.findMany())).not.toContain('sandi-baru-dari-admin');
    expect(await types()).toContain('password_reset_by_admin');
  });

  it('refuses a reset for your own account (409) and for an unknown account (404)', async () => {
    const admin = await user({ role: 'admin' });
    await expect(repo.resetPassword(admin.id, admin.id, 'sandi-baru-dari-admin', null)).rejects.toBeInstanceOf(AccountConflictError);
    await expect(repo.resetPassword(admin.id, 'ghost', 'sandi-baru-dari-admin', null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does not reactivate an inactive account by resetting its password', async () => {
    const admin = await user({ role: 'admin' });
    const t = await user({ email: 'off@x.test', status: 'inactive' });
    await repo.resetPassword(admin.id, t.id, 'sandi-baru-dari-admin', null);
    await expect(login('off@x.test', 'sandi-baru-dari-admin')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('unlocks a locked email, is idempotent, audits, and 404s for an unknown account', async () => {
    const admin = await user({ role: 'admin' });
    await user({ email: 't@x.test' });
    const t = await prisma.user.findUniqueOrThrow({ where: { email: 't@x.test' } });
    for (let i = 0; i < 5; i++) await login('t@x.test', 'salah-salah-1').catch(() => undefined);
    await expect(login('t@x.test')).rejects.toBeInstanceOf(TooManyAttemptsError);
    await repo.unlock(admin.id, t.id, null);
    await repo.unlock(admin.id, t.id, null);
    expect((await login('t@x.test')).user.id).toBe(t.id);
    expect((await types()).filter((x) => x === 'lockout_cleared_by_admin')).toHaveLength(2);
    await expect(repo.unlock(admin.id, 'ghost', null)).rejects.toBeInstanceOf(NotFoundError);
  });
});
