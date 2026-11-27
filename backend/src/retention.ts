import type { PrismaClient } from '@prisma/client';

const BATCH = 1000;
export const RETENTION_INTERVAL_MS = 60 * 60 * 1000;

export interface RetentionLog {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
}

export interface RetentionCounts {
  sessions: number;
  throttles: number;
  auditEvents: number;
}

/** Deletes in batches of 1000 with SKIP LOCKED so a batch never waits on a row a request holds (NFR4.20). */
async function deleteBatches(run: () => Promise<number>): Promise<number> {
  let total = 0;
  for (;;) {
    const n = await run();
    total += n;
    if (n < BATCH) return total;
  }
}

export async function runRetention(prisma: PrismaClient, log: RetentionLog): Promise<RetentionCounts> {
  const sessions = await deleteBatches(() =>
    prisma.$executeRaw`
      DELETE FROM "Session" WHERE "id" IN (
        SELECT "id" FROM "Session"
        WHERE "revokedAt" < (now() AT TIME ZONE 'UTC') - interval '7 days'
           OR "lastSeenAt" < (now() AT TIME ZONE 'UTC') - interval '7 days 8 hours'
           OR "createdAt" < (now() AT TIME ZONE 'UTC') - interval '14 days'
        LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)`,
  );
  const throttles = await deleteBatches(() =>
    prisma.$executeRaw`
      DELETE FROM "LoginThrottle" WHERE "email" IN (
        SELECT "email" FROM "LoginThrottle"
        WHERE ("lockedUntil" IS NULL OR "lockedUntil" < (now() AT TIME ZONE 'UTC'))
          AND "updatedAt" < (now() AT TIME ZONE 'UTC') - interval '24 hours'
        LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)`,
  );
  const auditEvents = await deleteBatches(() =>
    prisma.$executeRaw`
      DELETE FROM "AuditEvent" WHERE "id" IN (
        SELECT "id" FROM "AuditEvent"
        WHERE "occurredAt" < (now() AT TIME ZONE 'UTC') - interval '1 year'
        LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)`,
  );
  const counts = { sessions, throttles, auditEvents };
  log.info({ event: 'retention_run', ...counts }, 'Retention run finished');
  return counts;
}

/** First run right after listen, then hourly; a failure is only a warning. The timer never keeps the process alive. */
export function startRetentionTimer(
  prisma: PrismaClient,
  log: RetentionLog,
  intervalMs = RETENTION_INTERVAL_MS,
): { stop: () => void } {
  const tick = () => {
    runRetention(prisma, log).catch((err) => log.warn({ err }, 'Retention run failed; will retry next interval'));
  };
  const first = setTimeout(tick, 0);
  const timer = setInterval(tick, intervalMs);
  first.unref();
  timer.unref();
  return {
    stop: () => {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}
