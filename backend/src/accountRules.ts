import { ValidationError } from './errors';
import { checkPasswordLength } from './passwordService';

export const ROLES = ['admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];
export const STATUSES = ['active', 'inactive'] as const;
export type Status = (typeof STATUSES)[number];

export const AUDIT_TYPES = [
  'login_success',
  'login_failed',
  'login_locked',
  'logout',
  'account_created',
  'role_changed',
  'account_deactivated',
  'account_reactivated',
  'password_changed',
  'password_reset_by_admin',
  'lockout_cleared_by_admin',
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export const EMAIL_MAX = 254;
export const NAME_MAX = 100;
export const AUDIT_LIMIT_DEFAULT = 50;
export const AUDIT_LIMIT_MAX = 100;

function body(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ValidationError('Isi permintaan harus berupa objek JSON', []);
  }
  return input as Record<string, unknown>;
}

/** BR4.1: trimmed and lowercase. Non-text input normalizes to the empty string (rejected by validateEmail). */
export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** BR4.1: one @, non-empty local part and domain, no whitespace, at most 254 characters. */
export function validateEmail(raw: unknown, field = 'email'): string {
  const email = normalizeEmail(raw);
  const parts = email.split('@');
  const ok =
    email !== '' &&
    email.length <= EMAIL_MAX &&
    parts.length === 2 &&
    parts[0] !== '' &&
    parts[1] !== '' &&
    !/\s/.test(email);
  if (!ok) throw new ValidationError('Email tidak valid', [field]);
  return email;
}

function validateRole(raw: unknown): Role {
  if (typeof raw !== 'string' || !(ROLES as readonly string[]).includes(raw)) {
    throw new ValidationError('Role harus salah satu dari admin, editor, viewer', ['role']);
  }
  return raw as Role;
}

function validateName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name === '' || [...name].length > NAME_MAX) {
    throw new ValidationError(`Nama harus 1 sampai ${NAME_MAX} karakter`, ['name']);
  }
  return name;
}

export interface LoginBody {
  email: string;
  password: string;
}

/** Login does not check password length: a wrong-length password is just a failed attempt (generic 401). */
export function validateLoginBody(input: unknown): LoginBody {
  const b = body(input);
  const email = validateEmail(b.email);
  if (typeof b.password !== 'string' || b.password === '') {
    throw new ValidationError('Field wajib belum diisi: password', ['password']);
  }
  if ([...b.password].length > 1024) throw new ValidationError('Kata sandi terlalu panjang', ['password']);
  return { email, password: b.password };
}

export interface CreateUserBody {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export function validateCreateUserBody(input: unknown): CreateUserBody {
  const b = body(input);
  return {
    name: validateName(b.name),
    email: validateEmail(b.email),
    role: validateRole(b.role),
    password: checkPasswordLength(b.password),
  };
}

export interface PatchUserBody {
  role?: Role;
  status?: Status;
}

/** BR4.19: only `role` and `status`; empty body or any other field is a 400. */
export function validatePatchUserBody(input: unknown): PatchUserBody {
  const b = body(input);
  const unknown = Object.keys(b).filter((k) => k !== 'role' && k !== 'status');
  if (unknown.length > 0) {
    throw new ValidationError(`Field tidak boleh diubah: ${unknown.join(', ')}`, unknown);
  }
  if (b.role === undefined && b.status === undefined) {
    throw new ValidationError('Isi permintaan kosong: sebutkan role atau status', ['role', 'status']);
  }
  const out: PatchUserBody = {};
  if (b.role !== undefined) out.role = validateRole(b.role);
  if (b.status !== undefined) {
    if (typeof b.status !== 'string' || !(STATUSES as readonly string[]).includes(b.status)) {
      throw new ValidationError('Status harus active atau inactive', ['status']);
    }
    out.status = b.status as Status;
  }
  return out;
}

export interface PasswordChangeBody {
  currentPassword: string;
  newPassword: string;
}

export function validatePasswordChangeBody(input: unknown): PasswordChangeBody {
  const b = body(input);
  if (typeof b.currentPassword !== 'string' || b.currentPassword === '') {
    throw new ValidationError('Field wajib belum diisi: currentPassword', ['currentPassword']);
  }
  if ([...b.currentPassword].length > 1024) {
    throw new ValidationError('Kata sandi terlalu panjang', ['currentPassword']);
  }
  return { currentPassword: b.currentPassword, newPassword: checkPasswordLength(b.newPassword, 'newPassword') };
}

export function validateResetPasswordBody(input: unknown): { newPassword: string } {
  const b = body(input);
  return { newPassword: checkPasswordLength(b.newPassword, 'newPassword') };
}

export interface AuditCursor {
  occurredAt: Date;
  id: string;
}

export interface AuditQuery {
  type?: AuditType;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: AuditCursor;
}

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

function parseDate(raw: unknown, field: string): Date {
  const d = typeof raw === 'string' && ISO.test(raw) ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) {
    throw new ValidationError(`Tanggal tidak valid: ${field}`, [field]);
  }
  return d;
}

export function encodeCursor(c: AuditCursor): string {
  return Buffer.from(JSON.stringify({ t: c.occurredAt.toISOString(), id: c.id })).toString('base64url');
}

function decodeCursor(raw: string): AuditCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { t?: unknown; id?: unknown };
    const occurredAt = new Date(String(parsed.t));
    if (typeof parsed.id !== 'string' || parsed.id === '' || Number.isNaN(occurredAt.getTime())) {
      throw new Error('bad');
    }
    return { occurredAt, id: parsed.id };
  } catch {
    throw new ValidationError('Kursor tidak valid', ['cursor']);
  }
}

/** NFR2.28: invalid filters are a 400 that names the field. A date-only `to` covers the whole day. */
export function validateAuditQuery(input: unknown): AuditQuery {
  const q = (input ?? {}) as Record<string, unknown>;
  const out: AuditQuery = { limit: AUDIT_LIMIT_DEFAULT };
  if (q.type !== undefined && q.type !== '') {
    if (typeof q.type !== 'string' || !(AUDIT_TYPES as readonly string[]).includes(q.type)) {
      throw new ValidationError('Jenis peristiwa tidak valid', ['type']);
    }
    out.type = q.type as AuditType;
  }
  if (q.from !== undefined && q.from !== '') out.from = parseDate(q.from, 'from');
  if (q.to !== undefined && q.to !== '') {
    const to = parseDate(q.to, 'to');
    out.to = typeof q.to === 'string' && q.to.length === 10 ? new Date(to.getTime() + 86_400_000) : to;
  }
  if (q.limit !== undefined && q.limit !== '') {
    const n = typeof q.limit === 'string' && /^\d+$/.test(q.limit) ? Number(q.limit) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > AUDIT_LIMIT_MAX) {
      throw new ValidationError(`limit harus 1 sampai ${AUDIT_LIMIT_MAX}`, ['limit']);
    }
    out.limit = n;
  }
  if (q.cursor !== undefined && q.cursor !== '') {
    if (typeof q.cursor !== 'string') throw new ValidationError('Kursor tidak valid', ['cursor']);
    out.cursor = decodeCursor(q.cursor);
  }
  return out;
}
