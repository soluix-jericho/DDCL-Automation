import { Prisma, PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';
import type { CreateUserBody, PatchUserBody, Role, Status } from './accountRules';
import { AuditInput, writeAudit, writeAuditBestEffort, WarnFn } from './auditRepository';
import { withDb } from './db';
import {
  AccountConflictError,
  NotFoundError,
  TooManyAttemptsError,
  UnauthorizedError,
  ValidationError,
} from './errors';
import { isDeadlock } from './libraryTx';
import type { PasswordService } from './passwordService';
import { issueSession, revokeAllForUser, revokeByToken, revokeSession } from './sessionRepository';
import { clearThrottle, lockState, registerFailure } from './throttleService';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  createdAt: string;
  lastLoginAt: string | null;
}

/** BR4.17: the only shape an account leaves the backend in. Never the hash. */
export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

export interface LoginResult {
  token: string;
  user: { id: string; name: string; email: string; role: Role };
}

export interface AccountDeps {
  prisma: PrismaClient;
  passwords: PasswordService;
  warn: WarnFn;
}

const TX = { timeout: 10_000, maxWait: 5_000 } as const;
const BAD_CURRENT = 'Kata sandi lama tidak cocok.';

export function createAccountRepository({ prisma, passwords, warn }: AccountDeps) {
  const audit = (ev: AuditInput) => writeAuditBestEffort(prisma, ev, warn);

  /** Transaction A: is the email locked right now? (429 without checking the password.) */
  async function assertNotLocked(email: string): Promise<void> {
    const s = await prisma.$transaction((tx) => lockState(tx, email), TX);
    if (s.locked) throw new TooManyAttemptsError(s.retryAfterSeconds);
  }

  return {
    /** BR4.3, BR4.4: A -> hash (outside any transaction) -> B. */
    login(email: string, password: string, ip: string | null, carriedToken?: string | null): Promise<LoginResult> {
      return withDb('login', async () => {
        await assertNotLocked(email);
        const user = await prisma.user.findUnique({ where: { email } });
        const passwordOk = user
          ? await passwords.verify(password, user.passwordHash)
          : await passwords.verifyDummy(password);
        const ok = passwordOk && user?.status === 'active';

        type Outcome =
          | { kind: 'locked'; retry: number }
          | { kind: 'failed'; lockedNow: boolean }
          | { kind: 'ok'; token: string; sessionId: string };
        const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
          const s = await lockState(tx, email);
          // A parallel attempt may have locked the email while we hashed: discard even a correct password.
          if (s.locked) return { kind: 'locked', retry: s.retryAfterSeconds };
          if (!ok || !user) return { kind: 'failed', lockedNow: await registerFailure(tx, email) };
          await clearThrottle(tx, email);
          if (carriedToken) await revokeByToken(tx, carriedToken);
          const issued = await issueSession(tx, user.id);
          await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
          return { kind: 'ok', ...issued };
        }, TX);

        if (outcome.kind === 'locked') throw new TooManyAttemptsError(outcome.retry);
        if (outcome.kind === 'failed') {
          // NFR2.30: only registered emails reach the audit table.
          if (user) {
            await audit({ type: 'login_failed', actorUserId: user.id, email, ipAddress: ip });
            if (outcome.lockedNow) await audit({ type: 'login_locked', actorUserId: user.id, email, ipAddress: ip });
          }
          throw new UnauthorizedError();
        }
        await audit({ type: 'login_success', actorUserId: user!.id, email, ipAddress: ip });
        return {
          token: outcome.token,
          user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role },
        };
      });
    },

    logout(sessionId: string, userId: string, ip: string | null): Promise<void> {
      return withDb('logout', async () => {
        await revokeSession(prisma, sessionId);
        await audit({ type: 'logout', actorUserId: userId, ipAddress: ip });
      });
    },

    /** BR4.12: same A-hash-B protocol on the user's own email. */
    changeOwnPassword(
      userId: string,
      currentSessionId: string,
      currentPassword: string,
      newPassword: string,
      ip: string | null,
    ): Promise<void> {
      return withDb('changeOwnPassword', async () => {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedError();
        if (newPassword === currentPassword) {
          throw new ValidationError('Kata sandi baru harus berbeda dari yang lama.', ['newPassword']);
        }
        await assertNotLocked(user.email);
        const ok = await passwords.verify(currentPassword, user.passwordHash);
        const newHash = ok ? await passwords.hash(newPassword) : null;

        const outcome = await prisma.$transaction(async (tx) => {
          const s = await lockState(tx, user.email);
          if (s.locked) return { kind: 'locked' as const, retry: s.retryAfterSeconds };
          if (!ok || !newHash) {
            await registerFailure(tx, user.email);
            return { kind: 'wrong' as const };
          }
          await clearThrottle(tx, user.email);
          await tx.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
          await revokeAllForUser(tx, userId, currentSessionId);
          await writeAudit(tx, { type: 'password_changed', actorUserId: userId, targetUserId: userId, ipAddress: ip });
          return { kind: 'ok' as const };
        }, TX);
        if (outcome.kind === 'locked') throw new TooManyAttemptsError(outcome.retry);
        if (outcome.kind === 'wrong') throw new ValidationError(BAD_CURRENT, ['currentPassword']);
      });
    },

    createUser(actorId: string, body: CreateUserBody, ip: string | null): Promise<PublicUser> {
      return withDb('createUser', async () => {
        if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
          throw new AccountConflictError('Email sudah terdaftar.');
        }
        const passwordHash = await passwords.hash(body.password);
        try {
          return await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
              data: { name: body.name, email: body.email, role: body.role, passwordHash },
            });
            await writeAudit(tx, {
              type: 'account_created',
              actorUserId: actorId,
              targetUserId: created.id,
              ipAddress: ip,
              detail: `role ${body.role}`,
            });
            return toPublicUser(created);
          }, TX);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new AccountConflictError('Email sudah terdaftar.');
          }
          throw err;
        }
      });
    },

    listUsers(): Promise<PublicUser[]> {
      return withDb('listUsers', async () =>
        (await prisma.user.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(toPublicUser),
      );
    },

    /** BR4.13, BR4.14, BR4.19: admin rows locked in id order, final state judged, one transaction. */
    patchUser(actorId: string, targetId: string, body: PatchUserBody, ip: string | null): Promise<PublicUser> {
      const attempt = () =>
        prisma.$transaction(async (tx) => {
          const admins = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "User" WHERE "role" = 'admin' AND "status" = 'active' ORDER BY "id" FOR UPDATE`;
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${targetId} FOR UPDATE`;
          const target = await tx.user.findUnique({ where: { id: targetId } });
          if (!target) throw new NotFoundError('Akun tidak ditemukan.');

          if (body.status === 'active' && target.status === 'inactive') {
            throw new AccountConflictError('Akun nonaktif tidak bisa diaktifkan lewat portal.');
          }
          const role: Role = body.role ?? target.role;
          const status: Status = body.status ?? target.status;
          if (role === target.role && status === target.status) return toPublicUser(target);

          const deactivating = status === 'inactive' && target.status === 'active';
          if (deactivating && target.id === actorId) {
            throw new AccountConflictError('Anda tidak bisa menonaktifkan akun Anda sendiri.');
          }
          const wasActiveAdmin = target.role === 'admin' && target.status === 'active';
          const staysActiveAdmin = role === 'admin' && status === 'active';
          if (wasActiveAdmin && !staysActiveAdmin && admins.length <= 1) {
            throw new AccountConflictError('Harus tersisa sedikitnya satu admin aktif.');
          }

          const updated = await tx.user.update({ where: { id: targetId }, data: { role, status } });
          if (role !== target.role) {
            await writeAudit(tx, {
              type: 'role_changed',
              actorUserId: actorId,
              targetUserId: targetId,
              ipAddress: ip,
              detail: `${target.role} -> ${role}`,
            });
          }
          if (deactivating) {
            await revokeAllForUser(tx, targetId);
            await writeAudit(tx, { type: 'account_deactivated', actorUserId: actorId, targetUserId: targetId, ipAddress: ip });
          }
          return toPublicUser(updated);
        }, TX);

      return withDb('patchUser', async () => {
        try {
          return await attempt();
        } catch (err) {
          if (!isDeadlock(err)) throw err;
          warn({ operation: 'patchUser' }, 'deadlock; retrying once');
          return attempt();
        }
      });
    },

    resetPassword(actorId: string, targetId: string, newPassword: string, ip: string | null): Promise<void> {
      return withDb('resetPassword', async () => {
        if (targetId === actorId) {
          throw new AccountConflictError('Gunakan Ganti Kata Sandi untuk akun Anda sendiri.');
        }
        const target = await prisma.user.findUnique({ where: { id: targetId } });
        if (!target) throw new NotFoundError('Akun tidak ditemukan.');
        const passwordHash = await passwords.hash(newPassword);
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: targetId }, data: { passwordHash } });
          await revokeAllForUser(tx, targetId);
          await clearThrottle(tx, target.email);
          await writeAudit(tx, { type: 'password_reset_by_admin', actorUserId: actorId, targetUserId: targetId, ipAddress: ip });
        }, TX);
      });
    },

    unlock(actorId: string, targetId: string, ip: string | null): Promise<void> {
      return withDb('unlock', async () => {
        const target = await prisma.user.findUnique({ where: { id: targetId } });
        if (!target) throw new NotFoundError('Akun tidak ditemukan.');
        await prisma.$transaction(async (tx) => {
          await clearThrottle(tx, target.email);
          await writeAudit(tx, { type: 'lockout_cleared_by_admin', actorUserId: actorId, targetUserId: targetId, ipAddress: ip });
        }, TX);
      });
    },
  };
}
