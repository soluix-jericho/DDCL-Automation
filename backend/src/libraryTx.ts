import { Prisma, PrismaClient } from '@prisma/client';
import { RetryExhausted, ServiceBusyError } from './errors';

export interface LockSet {
  stepIds: string[];
  bundleIds: string[];
}

export interface LibraryTxOptions<T> {
  operation: string;
  /** Reads (without locks) every Step and StepBundle id this write can touch. Called before and after locking. */
  candidates: (tx: Prisma.TransactionClient) => Promise<LockSet>;
  /** The write itself; runs with all candidate rows locked. */
  fn: (tx: Prisma.TransactionClient) => Promise<T>;
  /** Called for each deadlock or lock-set retry (observability: a warning with { retry, code }). */
  onRetry?: (info: { operation: string; retry: number; code: string }) => void;
}

/** Total attempts = 1 + 2 retries (scalability-design.md, point 5). */
const MAX_RETRIES = 2;
const TX_OPTIONS = { timeout: 10_000, maxWait: 5_000 } as const;

class LockSetChanged extends Error {}

function isDeadlock(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034') return true;
    if (err.code === 'P2010' && (err.meta as { code?: string } | undefined)?.code === '40P01') return true;
  }
  return err instanceof Error && /deadlock detected/i.test(err.message);
}

function isPoolExhausted(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return (
    err.code === 'P2024' || (err.code === 'P2028' && /Unable to start a transaction/i.test(err.message))
  );
}

const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort();

/**
 * One transaction for every Library write (NFR4.3). Two-phase locking: read the candidate ids, lock all
 * StepBundle rows and then all Step rows in ascending id order (one global order, so locks never cross),
 * read the candidates again and proceed only if nothing new appeared in between. Deadlocks and changed
 * lock sets restart the whole transaction, at most twice; after that the caller gets RetryExhausted (409).
 */
export async function withLibraryTx<T>(prisma: PrismaClient, opts: LibraryTxOptions<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const first = await opts.candidates(tx);
        const bundleIds = sorted(first.bundleIds);
        const stepIds = sorted(first.stepIds);
        if (bundleIds.length > 0) {
          await tx.$queryRaw`SELECT id FROM "StepBundle" WHERE id = ANY(${bundleIds}::text[]) ORDER BY id FOR UPDATE`;
        }
        if (stepIds.length > 0) {
          await tx.$queryRaw`SELECT id FROM "Step" WHERE id = ANY(${stepIds}::text[]) ORDER BY id FOR UPDATE`;
        }
        const second = await opts.candidates(tx);
        const lockedBundles = new Set(bundleIds);
        const lockedSteps = new Set(stepIds);
        if (second.bundleIds.some((id) => !lockedBundles.has(id)) || second.stepIds.some((id) => !lockedSteps.has(id))) {
          throw new LockSetChanged();
        }
        return opts.fn(tx);
      }, TX_OPTIONS);
    } catch (err) {
      if (isPoolExhausted(err)) throw new ServiceBusyError('pool');
      const changed = err instanceof LockSetChanged;
      if (changed || isDeadlock(err)) {
        if (attempt >= MAX_RETRIES) throw new RetryExhausted(opts.operation);
        opts.onRetry?.({ operation: opts.operation, retry: attempt + 1, code: changed ? 'lock-set-changed' : '40P01' });
        continue;
      }
      throw err;
    }
  }
}
