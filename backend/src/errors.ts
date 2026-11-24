/** Domain errors. The central error handler maps these to HTTP responses (BR1.1, BR1.4, BR1.5). */

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fields: string[] = [],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** BR2.3 / BR2.11: a unique name is already taken. `existing` is the full row so the screen can compare. */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly existing: unknown,
    public readonly conflictOn: 'step' | 'rollbackStep' | 'bundle',
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Overload protection: the write limiter is full or the connection pool is exhausted (503). */
export class ServiceBusyError extends Error {
  constructor(
    public readonly reason: 'write-limit' | 'pool',
    public readonly retryAfterSeconds = 2,
  ) {
    super(`Service busy: ${reason}`);
    this.name = 'ServiceBusyError';
  }
}

/** A Library transaction kept deadlocking or its lock set kept changing; the client may try again (409). */
export class RetryExhausted extends Error {
  constructor(operation: string) {
    super(`Library transaction ${operation} could not complete after retries`);
    this.name = 'RetryExhausted';
  }
}

/** Database unreachable. Original detail is kept in `cause` for server logs only (BR1.5). */
export class DatabaseUnavailable extends Error {
  constructor(
    public readonly operation: string,
    public readonly originalCause: unknown,
  ) {
    super(`Database unavailable during ${operation}`);
    this.name = 'DatabaseUnavailable';
  }
}

/** Template workbook missing or unreadable (BR1.4). */
export class TemplateUnavailable extends Error {
  constructor(
    public readonly expectedPath: string,
    public readonly originalCause?: unknown,
  ) {
    super(`Excel template cannot be loaded from: ${expectedPath}`);
    this.name = 'TemplateUnavailable';
  }
}
