import { ValidationError } from './errors';

/** BR1.3: constant stub until UserAccount (U4) exists. */
export const DEFAULT_CREATED_BY = 'dev-user';
/** BR1.2: every new DDCL starts as Draft. */
export const INITIAL_STATUS = 'Draft' as const;
/** Skeleton limit: parameter rows the template's first object group can hold (sheet 3, rows 7-23). */
export const MAX_PARAMETERS = 17;

// Step validation (BR1.1, extended by BR2.1) lives in stepRules.ts since U2.

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

export interface HeaderInput {
  date?: string | null;
  startDate?: string | null;
  impactedSystem?: string | null;
  environment?: string | null;
  phaseRelease?: string | null;
  releaseObjective?: string | null;
  technicalChange?: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_FIELDS = [
  'impactedSystem',
  'environment',
  'phaseRelease',
  'releaseObjective',
  'technicalChange',
] as const;

function validDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export interface DdclInput {
  title: string;
  releaseHeader: HeaderInput;
}

/** Skeleton: header fields are optional (AC2.1.2 belongs to U3) but must be well-formed when present. */
export function validateDdclInput(input: unknown): DdclInput {
  const body = (input ?? {}) as Record<string, unknown>;
  if (isBlank(body.title)) {
    throw new ValidationError('Field wajib belum diisi: title', ['title']);
  }
  const rawHeader = (body.releaseHeader ?? {}) as Record<string, unknown>;
  if (typeof rawHeader !== 'object' || Array.isArray(rawHeader)) {
    throw new ValidationError('releaseHeader harus berupa objek', ['releaseHeader']);
  }
  const header: HeaderInput = {};
  const bad: string[] = [];
  for (const key of ['date', 'startDate'] as const) {
    const v = rawHeader[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string' && validDate(v)) header[key] = v;
    else bad.push(key);
  }
  for (const key of TEXT_FIELDS) {
    const v = rawHeader[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') header[key] = v;
    else bad.push(key);
  }
  if (bad.length > 0) {
    throw new ValidationError(`Format field tidak valid: ${bad.join(', ')}`, bad);
  }
  return { title: (body.title as string).trim(), releaseHeader: header };
}

export interface ChecklistInput {
  stepId: string;
  parameterValues: Record<string, string> | null;
}

export function validateChecklistInput(input: unknown): ChecklistInput {
  const body = (input ?? {}) as Record<string, unknown>;
  if (isBlank(body.stepId)) {
    throw new ValidationError('Field wajib belum diisi: stepId', ['stepId']);
  }
  let parameterValues: Record<string, string> | null = null;
  const raw = body.parameterValues;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ValidationError('parameterValues harus berupa objek nama -> nilai', [
        'parameterValues',
      ]);
    }
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.some(([, v]) => typeof v !== 'string')) {
      throw new ValidationError('Semua nilai parameterValues harus berupa teks', [
        'parameterValues',
      ]);
    }
    if (entries.length > MAX_PARAMETERS) {
      throw new ValidationError(`Maksimal ${MAX_PARAMETERS} parameter pada skeleton`, [
        'parameterValues',
      ]);
    }
    parameterValues = Object.fromEntries(entries) as Record<string, string>;
  }
  return { stepId: (body.stepId as string).trim(), parameterValues };
}

/** BR1.7: the tab label shown on the compose screen is the Release Header date. */
export function tabLabel(headerDate: string | null | undefined, fallback = ''): string {
  return headerDate && headerDate.trim() !== '' ? headerDate : fallback;
}
