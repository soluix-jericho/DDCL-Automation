import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import { issueSession, findValidSession } from '../../src/sessionRepository';
import { hashToken } from '../../src/sessionToken';
import { parseArgs, runRecovery } from '../../src/scripts/recovery';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { cheapPasswords, makeUser } from './helpers';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
});

const run = (cmd: Parameters<typeof runRecovery>[2], email: string, pw?: string) =>
  runRecovery(prisma, cheapPasswords, cmd, email, pw);
const lastAudit = () => prisma.auditEvent.findFirstOrThrow({ orderBy: { occurredAt: 'desc' } });

describe('recovery script core (NFR3.22)', () => {
  it('reset-password: new hash, all sessions revoked, lock cleared, audit with empty actor and recovery-script', async () => {
    const u = await makeUser(prisma, { email: 'ana@x.test' });
    const s = await issueSession(prisma, u.id);
    await prisma.loginThrottle.create({ data: { email: 'ana@x.test', failedCount: 4 } });
    await run('reset-password', ' Ana@X.test ', 'sandi-pemulihan-1');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await cheapPasswords.verify('sandi-pemulihan-1', after.passwordHash)).toBe(true);
    expect(await findValidSession(prisma, hashToken(s.token))).toBeNull();
    expect(await prisma.loginThrottle.count()).toBe(0);
    expect(await lastAudit()).toMatchObject({ type: 'password_reset_by_admin', actorUserId: null, targetUserId: u.id, detail: 'recovery-script' });
    expect(JSON.stringify(await prisma.auditEvent.findMany())).not.toContain('sandi-pemulihan-1');
  });

  it('reset-password: refuses a short password and an unknown email, changing nothing', async () => {
    const u = await makeUser(prisma, { email: 'ana@x.test' });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash;
    await expect(run('reset-password', 'ana@x.test', 'pendek')).rejects.toBeInstanceOf(ValidationError);
    await expect(run('reset-password', 'ana@x.test', undefined)).rejects.toBeInstanceOf(ValidationError);
    await expect(run('reset-password', 'ghost@x.test', 'sandi-pemulihan-1')).rejects.toThrow(/tidak ditemukan/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash).toBe(before);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('unlock clears the lock and audits', async () => {
    const u = await makeUser(prisma, { email: 'ana@x.test' });
    await prisma.loginThrottle.create({ data: { email: 'ana@x.test', failedCount: 2 } });
    await run('unlock', 'ana@x.test');
    expect(await prisma.loginThrottle.count()).toBe(0);
    expect(await lastAudit()).toMatchObject({ type: 'lockout_cleared_by_admin', actorUserId: null, targetUserId: u.id, detail: 'recovery-script' });
  });

  it('reactivate turns an inactive account active and audits account_reactivated', async () => {
    const u = await makeUser(prisma, { email: 'off@x.test', status: 'inactive' });
    await run('reactivate', 'off@x.test');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe('active');
    expect(await lastAudit()).toMatchObject({ type: 'account_reactivated', detail: 'recovery-script' });
  });

  it('make-admin promotes an account and audits role_changed', async () => {
    const u = await makeUser(prisma, { email: 'ed@x.test', role: 'editor' });
    await run('make-admin', 'ed@x.test');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('admin');
    expect(await lastAudit()).toMatchObject({ type: 'role_changed', detail: 'recovery-script: editor -> admin' });
  });

  it('writes the change and its audit row in one transaction (a failing audit rolls the change back)', async () => {
    const u = await makeUser(prisma, { email: 'off@x.test', status: 'inactive' });
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT audit_block CHECK (false) NOT VALID`);
    try {
      await expect(run('reactivate', 'off@x.test')).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "AuditEvent" DROP CONSTRAINT audit_block`);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe('inactive');
  });
});

describe('recovery script arguments', () => {
  it('accepts command, email and --password-stdin', () => {
    expect(parseArgs(['reset-password', 'a@b.test', '--password-stdin'])).toEqual({ command: 'reset-password', email: 'a@b.test', passwordStdin: true });
    expect(parseArgs(['unlock', 'a@b.test'])).toEqual({ command: 'unlock', email: 'a@b.test', passwordStdin: false });
  });

  it.each([
    [['reset-password', 'a@b.test', '--password', 'rahasia']],
    [['reset-password', 'a@b.test', '--password=rahasia']],
    [['reset-password', 'a@b.test', '-e', 'PASSWORD=rahasia']],
    [['reset-password', 'a@b.test', '-ePASSWORD=rahasia']],
  ])('refuses a password on the command line: %j', (argv) => {
    expect(() => parseArgs(argv)).toThrow(/argumen/);
  });

  it.each([[[]], [['reset-password']], [['hapus', 'a@b.test']], [['unlock', 'a@b.test', 'lebih']], [['unlock', 'a@b.test', '--aneh']]])(
    'prints usage for %j',
    (argv) => {
      expect(() => parseArgs(argv)).toThrow(/Pemakaian/);
    },
  );
});
