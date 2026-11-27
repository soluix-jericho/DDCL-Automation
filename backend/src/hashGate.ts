import { ServiceBusyError } from './errors';

export interface HashGate {
  /** Runs `fn` when a slot is free; waits FIFO; gives up with ServiceBusyError('hash') after maxWaitMs (NFR1.24). */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** Number of jobs running now (for tests). */
  readonly active: number;
  readonly waiting: number;
}

export interface HashGateOptions {
  slots?: number;
  maxWaitMs?: number;
}

/** In-process counter with 2 slots and a FIFO queue; the slot is released on every way `fn` can end. */
export function createHashGate({ slots = 2, maxWaitMs = 5000 }: HashGateOptions = {}): HashGate {
  let active = 0;
  const queue: Array<{ grant: () => void }> = [];

  const release = (): void => {
    active--;
    const next = queue.shift();
    if (next) {
      active++;
      next.grant();
    }
  };

  const acquire = (): Promise<void> => {
    if (active < slots) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const entry = {
        grant: () => {
          clearTimeout(timer);
          resolve();
        },
      };
      const timer = setTimeout(() => {
        const i = queue.indexOf(entry);
        if (i >= 0) queue.splice(i, 1);
        reject(new ServiceBusyError('hash', 5));
      }, maxWaitMs);
      queue.push(entry);
    });
  };

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
    get active() {
      return active;
    },
    get waiting() {
      return queue.length;
    },
  };
}
