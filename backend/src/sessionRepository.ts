import type { Prisma, PrismaClient } from '@prisma/client';
import type { Role } from './accountRules';
import type { WarnFn } from './auditRepository';
import { withDb } from './db';
import { hashToken, newToken } from './sessionToken';

type Db = PrismaClient | Prisma.TransactionClient;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ValidSession {
  sessionId: string;
  user: SessionUser;
}

/** Issues a session; the token is returned once, only its SHA-256 is stored (BR4.5). Database clock. */
export async function issueSession(
  tx: Db,
  userId: string,
): Promise<{ token: string; sessionId: string }> {
  const token = newToken();
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "Session" ("id", "userId", "tokenHash", "createdAt", "lastSeenAt")
    VALUES (${`s${newToken().slice(0, 24)}`}, ${userId}, ${hashToken(token)},
            (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'))
    RETURNING "id"`;
  return { token, sessionId: rows[0]!.id };
}

/** One indexed query: session + user, valid only when not revoked, idle <= 8 h, age <= 7 days, user active (BR4.6). */
export async function findValidSession(db: Db, tokenHash: string): Promise<ValidSession | null> {
  const rows = await db.$queryRaw<
    Array<{ sessionId: string; id: string; name: string; email: string; role: Role }>
  >`
    SELECT s."id" AS "sessionId", u."id", u."name", u."email", u."role"::text AS "role"
    FROM "Session" s JOIN "User" u ON u."id" = s."userId"
    WHERE s."tokenHash" = ${tokenHash}
      AND s."revokedAt" IS NULL
      AND s."lastSeenAt" > (now() AT TIME ZONE 'UTC') - interval '8 hours'
      AND s."createdAt" > (now() AT TIME ZONE 'UTC') - interval '7 days'
      AND u."status" = 'active'`;
  const r = rows[0];
  return r ? { sessionId: r.sessionId, user: { id: r.id, name: r.name, email: r.email, role: r.role } } : null;
}

/** At most one write per minute per session; callers do not wait for it and a failure only warns. */
export async function touchSession(db: Db, sessionId: string, warn: WarnFn): Promise<void> {
  try {
    await db.$executeRaw`
      UPDATE "Session" SET "lastSeenAt" = (now() AT TIME ZONE 'UTC')
      WHERE "id" = ${sessionId} AND "lastSeenAt" < (now() AT TIME ZONE 'UTC') - interval '1 minute'`;
  } catch (err) {
    warn({ err, sessionId }, 'touchSession failed; continuing');
  }
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "Session" SET "revokedAt" = (now() AT TIME ZONE 'UTC') WHERE "id" = ${sessionId} AND "revokedAt" IS NULL`;
}

/** Revokes every live session of a user, optionally keeping the one in use (BR4.12, BR4.13, BR4.18). */
export async function revokeAllForUser(
  db: Db,
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  await db.$executeRaw`
    UPDATE "Session" SET "revokedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "userId" = ${userId} AND "revokedAt" IS NULL AND "id" <> ${exceptSessionId ?? ''}`;
}

/** Login that carries an old token revokes it in the same transaction (BR4.5). */
export async function revokeByToken(db: Db, token: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "Session" SET "revokedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "tokenHash" = ${hashToken(token)} AND "revokedAt" IS NULL`;
}

export function createSessionRepository(prisma: PrismaClient) {
  return {
    /** Gate lookup. A connection failure becomes DatabaseUnavailable, i.e. a closed (500) answer, never "no session needed" (NFR3.20). */
    findSession: (tokenHash: string) => withDb('findSession', () => findValidSession(prisma, tokenHash)),
    touchSession: (sessionId: string, warn: WarnFn) => touchSession(prisma, sessionId, warn),
  };
}
