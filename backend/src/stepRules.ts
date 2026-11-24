import { ValidationError } from './errors';
import { Category, firstTextError, isCategory } from './stepText';

/** NFR1.8: input limits. "Characters" are Unicode code points after trimming; attachments count UTF-8 bytes. */
export const LIMITS = {
  columns: 10,
  linesPerColumn: 50,
  lineChars: 2000,
  nameChars: 200,
  labelChars: 200,
  attachments: 10,
  filenameChars: 255,
  attachmentBytes: 102_400,
  bundleNameChars: 200,
  bundleMembers: 50,
  queryChars: 200,
} as const;

export interface ColumnInput {
  label: string | null;
  lines: string[];
}

export interface AttachmentInput {
  filename: string;
  content: string;
}

export interface StepBase {
  name: string;
  category: Category;
  columns: ColumnInput[];
  attachments: AttachmentInput[];
}

export interface StepInput extends StepBase {
  /** Always set on create; on update it is optional and, when present, must equal the stored kind. */
  kind: 'forward' | 'rollback' | undefined;
  /** undefined = leave the pair unchanged (update only); null = no pair. */
  pairedRollbackStepId: string | null | undefined;
  /** A new rollback step created and paired in the same transaction (BR2.9). */
  rollbackStep: (StepBase & { kind: 'rollback' }) | null;
}

export interface BundleInput {
  name: string;
  category: Category | null;
  forwardStepIds: string[];
  rollbackStepIds: string[];
}

export interface ListQuery {
  q: string | null;
  category: Category | null;
}

class Problems {
  readonly fields: string[] = [];
  readonly messages: string[] = [];

  add(field: string, message: string): void {
    if (!this.fields.includes(field)) this.fields.push(field);
    this.messages.push(message);
  }

  throwIfAny(): void {
    if (this.fields.length > 0) {
      throw new ValidationError(this.messages.join('; '), this.fields);
    }
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Code-point length; the cheap UTF-16 bound avoids counting huge strings that are clearly too long. */
export function codePointLength(s: string, max: number): number {
  if (s.length > max * 2) return max + 1;
  return Array.from(s).length;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** PostgreSQL text cannot hold NUL, and a lone surrogate is not valid UTF-8: both are rejected up front. */
function isStorableText(s: string): boolean {
  return !s.includes('\u0000') && !LONE_SURROGATE.test(s);
}

/** Validates a trimmed single-line field; returns the trimmed value ('' when invalid or empty). */
function readText(
  value: unknown,
  field: string,
  label: string,
  max: number,
  required: boolean,
  p: Problems,
): string {
  if (value === undefined || value === null) {
    if (required) p.add(field, `${label} wajib diisi`);
    return '';
  }
  if (typeof value !== 'string') {
    p.add(field, `${label} harus berupa teks`);
    return '';
  }
  const trimmed = value.trim();
  if (!isStorableText(trimmed)) {
    p.add(field, `${label} memuat karakter yang tidak sah`);
    return '';
  }
  if (trimmed === '' && required) {
    p.add(field, `${label} wajib diisi`);
    return '';
  }
  if (codePointLength(trimmed, max) > max) {
    p.add(field, `${label} maksimal ${max} karakter`);
    return '';
  }
  return trimmed;
}

function readColumns(raw: unknown, prefix: string, p: Problems): ColumnInput[] {
  const field = `${prefix}columns`;
  if (!Array.isArray(raw)) {
    p.add(field, 'Kolom wajib diisi (minimal satu langkah)');
    return [];
  }
  // Structure first, content second: an oversized array is rejected before any element is looked at.
  if (raw.length > LIMITS.columns) {
    p.add(field, `Kolom maksimal ${LIMITS.columns}`);
    return [];
  }
  for (const col of raw) {
    if (isObject(col) && Array.isArray(col.lines) && col.lines.length > LIMITS.linesPerColumn) {
      p.add(field, `Langkah per kolom maksimal ${LIMITS.linesPerColumn}`);
      return [];
    }
  }
  const out: ColumnInput[] = [];
  raw.forEach((col, ci) => {
    const colField = `${field}[${ci}]`;
    if (!isObject(col)) {
      p.add(colField, `Kolom ${ci + 1} tidak valid`);
      return;
    }
    const label = readText(col.label, `${colField}.label`, `Label kolom ${ci + 1}`, LIMITS.labelChars, false, p);
    if (col.lines !== undefined && !Array.isArray(col.lines)) {
      p.add(`${colField}.lines`, `Langkah kolom ${ci + 1} harus berupa daftar`);
      return;
    }
    const lines: string[] = [];
    ((col.lines as unknown[] | undefined) ?? []).forEach((line, li) => {
      const lineField = `${colField}.lines[${li}]`;
      if (typeof line !== 'string') {
        p.add(lineField, `Langkah ${li + 1} di kolom ${ci + 1} harus berupa teks`);
        return;
      }
      const text = line.trim();
      if (text === '') return; // BR2.2: empty lines are dropped before saving
      if (!isStorableText(text)) {
        p.add(lineField, `Langkah ${li + 1} di kolom ${ci + 1} memuat karakter yang tidak sah`);
        return;
      }
      if (codePointLength(text, LIMITS.lineChars) > LIMITS.lineChars) {
        p.add(lineField, `Langkah ${li + 1} di kolom ${ci + 1} maksimal ${LIMITS.lineChars} karakter`);
        return;
      }
      const pos = firstTextError(text);
      if (pos !== null) {
        p.add(
          lineField,
          `Kolom ${ci + 1}, langkah ${li + 1}, karakter ${pos}: kurung kurawal tidak sah. ` +
            'Tulis {{ dan }} untuk kurung literal, atau pindahkan teks kode ke lampiran.',
        );
        return;
      }
      lines.push(text);
    });
    if (lines.length > 0) out.push({ label: label === '' ? null : label, lines });
  });
  if (out.length === 0 && p.fields.every((f) => !f.startsWith(field))) {
    p.add(field, 'Minimal satu langkah yang tidak kosong');
  }
  return out;
}

function readAttachments(raw: unknown, prefix: string, p: Problems): AttachmentInput[] {
  const field = `${prefix}attachments`;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    p.add(field, 'Lampiran harus berupa daftar');
    return [];
  }
  if (raw.length > LIMITS.attachments) {
    p.add(field, `Lampiran maksimal ${LIMITS.attachments}`);
    return [];
  }
  const seen = new Set<string>();
  const out: AttachmentInput[] = [];
  raw.forEach((a, i) => {
    const f = `${field}[${i}]`;
    if (!isObject(a)) {
      p.add(f, `Lampiran ${i + 1} tidak valid`);
      return;
    }
    const filename = readText(a.filename, `${f}.filename`, `Nama file lampiran ${i + 1}`, LIMITS.filenameChars, true, p);
    if (filename !== '') {
      if (/[/\\]/.test(filename) || filename.includes('..')) {
        p.add(`${f}.filename`, `Nama file lampiran ${i + 1} tidak boleh memuat / \\ atau ..`);
      } else if (seen.has(filename.toLowerCase())) {
        p.add(`${f}.filename`, `Nama file lampiran ${i + 1} sudah dipakai lampiran lain`);
      } else {
        seen.add(filename.toLowerCase());
      }
    }
    const content = a.content;
    if (typeof content !== 'string') {
      p.add(`${f}.content`, `Isi lampiran ${i + 1} wajib berupa teks`);
      return;
    }
    if (!isStorableText(content)) {
      p.add(`${f}.content`, `Isi lampiran ${i + 1} bukan teks UTF-8 yang sah`);
      return;
    }
    if (Buffer.byteLength(content, 'utf8') > LIMITS.attachmentBytes) {
      p.add(`${f}.content`, `Isi lampiran ${i + 1} maksimal ${LIMITS.attachmentBytes} byte`);
      return;
    }
    out.push({ filename, content });
  });
  return out;
}

function readBase(raw: Record<string, unknown>, prefix: string, p: Problems): StepBase {
  const name = readText(raw.name, `${prefix}name`, 'Nama step', LIMITS.nameChars, true, p);
  let category: Category = 'Database';
  if (!isCategory(raw.category)) {
    p.add(`${prefix}category`, 'Kategori harus salah satu dari Database, Bastion, RabbitMQ, Keycloak');
  } else {
    category = raw.category;
  }
  return {
    name,
    category,
    columns: readColumns(raw.columns, prefix, p),
    attachments: readAttachments(raw.attachments, prefix, p),
  };
}

/** BR2.1-BR2.5, BR2.9 (shape part): validates a POST or PATCH step body, naming every bad field. */
export function validateStepBody(input: unknown, mode: 'create' | 'update'): StepInput {
  const p = new Problems();
  if (!isObject(input)) {
    throw new ValidationError('Body harus berupa objek', ['body']);
  }
  const base = readBase(input, '', p);

  let kind: StepInput['kind'];
  if (input.kind === 'forward' || input.kind === 'rollback') kind = input.kind;
  else if (input.kind === undefined && mode === 'update') kind = undefined;
  else p.add('kind', 'Jenis harus forward atau rollback');

  let pairedRollbackStepId: StepInput['pairedRollbackStepId'];
  const rawPair = input.pairedRollbackStepId;
  if (rawPair === undefined) pairedRollbackStepId = mode === 'create' ? null : undefined;
  else if (rawPair === null) pairedRollbackStepId = null;
  else if (typeof rawPair === 'string' && rawPair.trim() !== '') pairedRollbackStepId = rawPair.trim();
  else {
    p.add('pairedRollbackStepId', 'pairedRollbackStepId harus berupa id step atau null');
    pairedRollbackStepId = null;
  }

  let rollbackStep: StepInput['rollbackStep'] = null;
  if (input.rollbackStep !== undefined && input.rollbackStep !== null) {
    const rb = input.rollbackStep;
    if (!isObject(rb)) {
      p.add('rollbackStep', 'rollbackStep harus berupa objek step');
    } else {
      if (rb.kind !== undefined && rb.kind !== 'rollback') {
        p.add('rollbackStep.kind', 'rollbackStep harus berjenis rollback');
      }
      if (rb.pairedRollbackStepId != null || rb.rollbackStep != null) {
        p.add('rollbackStep', 'rollbackStep tidak boleh memiliki pasangan rollback sendiri');
      }
      rollbackStep = { ...readBase(rb, 'rollbackStep.', p), kind: 'rollback' };
    }
  }

  // BR2.9 (shape): a pair only belongs to a forward step, and only one way of naming it is allowed.
  if (kind === 'rollback' && (pairedRollbackStepId != null || rollbackStep)) {
    p.add('pairedRollbackStepId', 'Step rollback tidak boleh memiliki pasangan rollback');
  }
  if (pairedRollbackStepId != null && rollbackStep) {
    p.add('rollbackStep', 'Pilih pasangan yang sudah ada atau buat yang baru, bukan keduanya');
  }

  p.throwIfAny();
  return { ...base, kind, pairedRollbackStepId, rollbackStep };
}

function readIdList(raw: unknown, field: string, min: number, p: Problems): string[] {
  if (raw === undefined && min === 0) return [];
  if (!Array.isArray(raw)) {
    p.add(field, `${field} harus berupa daftar id step`);
    return [];
  }
  if (raw.length > LIMITS.bundleMembers) {
    p.add(field, `${field} maksimal ${LIMITS.bundleMembers} anggota`);
    return [];
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== 'string' || id.trim() === '') {
      p.add(field, `${field} hanya boleh berisi id step`);
      return [];
    }
    if (seen.has(id)) {
      p.add(field, `Step yang sama muncul dua kali di ${field}`);
      return [];
    }
    seen.add(id);
    ids.push(id);
  }
  if (ids.length < min) p.add(field, 'Bundle butuh minimal satu step forward');
  return ids;
}

/** BR2.11 (shape part). Member kinds are checked against the database in the repository. */
export function validateBundleBody(input: unknown): BundleInput {
  if (!isObject(input)) throw new ValidationError('Body harus berupa objek', ['body']);
  const p = new Problems();
  const name = readText(input.name, 'name', 'Nama bundle', LIMITS.bundleNameChars, true, p);
  let category: Category | null = null;
  if (input.category !== undefined && input.category !== null) {
    if (isCategory(input.category)) category = input.category;
    else p.add('category', 'Kategori harus salah satu dari Database, Bastion, RabbitMQ, Keycloak');
  }
  const forwardStepIds = readIdList(input.forwardStepIds, 'forwardStepIds', 1, p);
  const rollbackStepIds = readIdList(input.rollbackStepIds, 'rollbackStepIds', 0, p);
  const both = new Set(forwardStepIds);
  if (rollbackStepIds.some((id) => both.has(id))) {
    p.add('rollbackStepIds', 'Step yang sama tidak bisa menjadi anggota forward dan rollback');
  }
  p.throwIfAny();
  return { name, category, forwardStepIds, rollbackStepIds };
}

/** BR2.13: `q` (max 200 code points) and `category` (fixed list) on the list endpoints. */
export function validateListQuery(query: unknown): ListQuery {
  const raw = isObject(query) ? query : {};
  const p = new Problems();
  let q: string | null = null;
  if (raw.q !== undefined) {
    const value = readText(raw.q, 'q', 'Pencarian', LIMITS.queryChars, false, p);
    q = value === '' ? null : value;
  }
  let category: Category | null = null;
  if (raw.category !== undefined && raw.category !== '') {
    if (isCategory(raw.category)) category = raw.category;
    else p.add('category', 'Kategori harus salah satu dari Database, Bastion, RabbitMQ, Keycloak');
  }
  p.throwIfAny();
  return { q, category };
}
