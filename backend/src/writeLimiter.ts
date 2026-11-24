import type { FastifyRequest } from 'fastify';
import { ServiceBusyError } from './errors';

/** Most Library write requests handled at once per process (performance-design.md). */
export const MAX_CONCURRENT_WRITES = 4;

/**
 * Admission control for Library writes. The `onRequest` hook runs before the body is read, so a request
 * over the limit is turned away (503 + Retry-After) without holding up to 24 MiB of memory. A slot is taken
 * when a request is admitted and released exactly once when it ends in any way: response sent (including
 * 413 and handler errors) or client abort. Release is idempotent because both hooks can fire.
 */
export function createWriteLimiter(max: number = MAX_CONCURRENT_WRITES) {
  let active = 0;
  const holding = new WeakSet<object>();

  return {
    onRequest: async (request: FastifyRequest): Promise<void> => {
      if (active >= max) throw new ServiceBusyError('write-limit'); // the error handler maps it to 503 and logs it
      active += 1;
      holding.add(request);
    },

    release: async (request: FastifyRequest): Promise<void> => {
      if (holding.delete(request)) active -= 1;
    },

    activeCount: (): number => active,
  };
}

export type WriteLimiter = ReturnType<typeof createWriteLimiter>;
