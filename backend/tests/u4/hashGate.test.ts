import { describe, expect, it } from 'vitest';
import { ServiceBusyError } from '../../src/errors';
import { createHashGate } from '../../src/hashGate';

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('HashGate (NFR1.24)', () => {
  it('runs at most two jobs at once and starts the next when one ends', async () => {
    const gate = createHashGate({ slots: 2 });
    const jobs = [deferred(), deferred(), deferred()];
    const started: number[] = [];
    const runs = jobs.map((j, i) =>
      gate.run(async () => {
        started.push(i);
        await j.promise;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    expect(gate.active).toBe(2);
    expect(gate.waiting).toBe(1);
    jobs[0]!.resolve();
    await runs[0];
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    jobs[1]!.resolve();
    jobs[2]!.resolve();
    await Promise.all(runs);
    expect(gate.active).toBe(0);
  });

  it('serves waiters in FIFO order', async () => {
    const gate = createHashGate({ slots: 1 });
    const first = deferred();
    const order: string[] = [];
    const a = gate.run(() => first.promise);
    const b = gate.run(async () => void order.push('b'));
    const c = gate.run(async () => void order.push('c'));
    first.resolve();
    await Promise.all([a, b, c]);
    expect(order).toEqual(['b', 'c']);
  });

  it('answers ServiceBusyError("hash") after waiting longer than the limit, without leaking the queue entry', async () => {
    const gate = createHashGate({ slots: 1, maxWaitMs: 30 });
    const block = deferred();
    const running = gate.run(() => block.promise);
    const err = await gate.run(async () => 'never').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceBusyError);
    expect(err.reason).toBe('hash');
    expect(err.retryAfterSeconds).toBe(5);
    expect(gate.waiting).toBe(0);
    block.resolve();
    await running;
  });

  it('releases the slot when the function fails', async () => {
    const gate = createHashGate({ slots: 1 });
    await expect(gate.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(gate.active).toBe(0);
    expect(await gate.run(async () => 'ok')).toBe('ok');
  });

  it('does not let a timed-out waiter take a slot later', async () => {
    const gate = createHashGate({ slots: 1, maxWaitMs: 20 });
    const block = deferred();
    const running = gate.run(() => block.promise);
    await gate.run(async () => 'x').catch(() => undefined);
    block.resolve();
    await running;
    expect(gate.active).toBe(0);
    expect(gate.waiting).toBe(0);
  });
});
