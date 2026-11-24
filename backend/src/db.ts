import { Prisma } from '@prisma/client';
import { DatabaseUnavailable } from './errors';

const CONNECTION_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017']);

/** True for errors meaning "the database cannot be reached" (as opposed to a bug or bad data). */
export function isConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return CONNECTION_CODES.has(err.code);
  return false;
}

/** Runs a database operation; connection failures become `DatabaseUnavailable` (BR1.5, OBS1.2). */
export async function withDb<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isConnectionError(err)) throw new DatabaseUnavailable(operation, err);
    throw err;
  }
}
