import type { Prisma } from '@prisma/client';

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;
/** Database clock in the same (UTC, no time zone) form the TIMESTAMP(3) columns use. */
export const DB_NOW = `(now() AT TIME ZONE 'UTC')`;

export interface LockState {
  locked: boolean;
  retryAfterSeconds: number;
}

type Tx = Prisma.TransactionClient;

/**
 * ThrottleService (BR4.4, security-design "Penguncian"). All functions run inside the caller's transaction
 * and use the database clock. `lockState` creates the row if needed and locks it (SELECT ... FOR UPDATE),
 * so concurrent attempts for one email run one after the other.
 */
export async function lockState(tx: Tx, email: string): Promise<LockState> {
  await tx.$executeRaw`INSERT INTO "LoginThrottle" ("email") VALUES (${email}) ON CONFLICT DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ locked: boolean; retry: number | null }>>`
    SELECT ("lockedUntil" IS NOT NULL AND "lockedUntil" > (now() AT TIME ZONE 'UTC')) AS locked,
           CEIL(EXTRACT(EPOCH FROM ("lockedUntil" - (now() AT TIME ZONE 'UTC'))))::float8 AS retry
    FROM "LoginThrottle" WHERE "email" = ${email} FOR UPDATE`;
  const row = rows[0];
  const locked = row?.locked === true;
  return { locked, retryAfterSeconds: locked ? Math.max(1, Number(row?.retry ?? 1)) : 0 };
}

/** Counts one failure; the 5th sets a 15-minute lock and resets the counter. Returns true when it just locked. */
export async function registerFailure(tx: Tx, email: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
    UPDATE "LoginThrottle" SET
      "failedCount" = CASE WHEN "failedCount" + 1 >= ${MAX_FAILURES} THEN 0 ELSE "failedCount" + 1 END,
      "lockedUntil" = CASE WHEN "failedCount" + 1 >= ${MAX_FAILURES}
        THEN (now() AT TIME ZONE 'UTC') + make_interval(mins => ${LOCK_MINUTES}::int) ELSE "lockedUntil" END,
      "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "email" = ${email}
    RETURNING ("lockedUntil" IS NOT NULL AND "lockedUntil" > (now() AT TIME ZONE 'UTC')) AS locked`;
  return rows[0]?.locked === true;
}

/** Success or admin unlock: the row is removed (BR4.3, BR4.18). */
export async function clearThrottle(tx: Tx | import('@prisma/client').PrismaClient, email: string): Promise<void> {
  await tx.$executeRaw`DELETE FROM "LoginThrottle" WHERE "email" = ${email}`;
}
