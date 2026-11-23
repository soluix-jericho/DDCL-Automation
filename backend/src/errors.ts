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
