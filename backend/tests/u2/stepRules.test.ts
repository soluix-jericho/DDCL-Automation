import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import {
  LIMITS,
  validateBundleBody,
  validateListQuery,
  validateStepBody,
} from '../../src/stepRules';

function fieldsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.fields;
    throw e;
  }
  return [];
}

const valid = (over: Record<string, unknown> = {}) => ({
  name: 'Update Deployment',
  category: 'Database',
  kind: 'forward',
  columns: [{ lines: ['kubectl apply'] }],
  ...over,
});

describe('step body (BR2.1, BR2.2)', () => {
  it('accepts a minimal step and trims name and lines', () => {
    const r = validateStepBody(valid({ name: '  A  ', columns: [{ label: ' L ', lines: ['  x  '] }] }), 'create');
    expect(r).toMatchObject({
      name: 'A',
      kind: 'forward',
      pairedRollbackStepId: null,
      columns: [{ label: 'L', lines: ['x'] }],
      attachments: [],
      rollbackStep: null,
    });
  });

  it('names every bad field: empty name, bad category, bad kind, no lines', () => {
    expect(
      fieldsOf(() => validateStepBody({ name: ' ', category: 'Nope', kind: 'x', columns: [] }, 'create')),
    ).toEqual(['name', 'category', 'columns', 'kind']);
  });

  it('drops empty lines and columns without content, keeping order', () => {
    const r = validateStepBody(
      valid({ columns: [{ lines: ['', '  '] }, { lines: ['a', '', 'b'] }, { lines: [] }] }),
      'create',
    );
    expect(r.columns).toEqual([{ label: null, lines: ['a', 'b'] }]);
  });

  it('rejects when nothing is left after dropping empties (BR2.1)', () => {
    expect(fieldsOf(() => validateStepBody(valid({ columns: [{ lines: ['  '] }] }), 'create'))).toEqual([
      'columns',
    ]);
  });

  it('rejects a non-object body and non-string lines', () => {
    expect(fieldsOf(() => validateStepBody(null, 'create'))).toEqual(['body']);
    expect(fieldsOf(() => validateStepBody(valid({ columns: [{ lines: [5] }] }), 'create'))).toEqual([
      'columns[0].lines[0]',
    ]);
  });

  it('requires kind on create but not on update', () => {
    const noKind = valid({ kind: undefined });
    expect(fieldsOf(() => validateStepBody(noKind, 'create'))).toEqual(['kind']);
    expect(validateStepBody(noKind, 'update').kind).toBeUndefined();
  });

  it('rejects NUL and lone surrogates so they cannot reach PostgreSQL', () => {
    expect(fieldsOf(() => validateStepBody(valid({ name: 'a\u0000b' }), 'create'))).toEqual(['name']);
    expect(fieldsOf(() => validateStepBody(valid({ columns: [{ lines: ['\uD800'] }] }), 'create'))).toEqual([
      'columns[0].lines[0]',
    ]);
  });
});

describe('limits (NFR1.8)', () => {
  it('accepts every limit exactly at its maximum', () => {
    const columns = Array.from({ length: LIMITS.columns }, () => ({
      label: 'l'.repeat(LIMITS.labelChars),
      lines: Array.from({ length: LIMITS.linesPerColumn }, () => 'x'.repeat(LIMITS.lineChars)),
    }));
    const attachments = Array.from({ length: LIMITS.attachments }, (_, i) => ({
      filename: `${'f'.repeat(LIMITS.filenameChars - 3)}${String(i).padStart(3, '0')}`,
      content: 'c'.repeat(LIMITS.attachmentBytes),
    }));
    const r = validateStepBody(valid({ name: 'n'.repeat(LIMITS.nameChars), columns, attachments }), 'create');
    expect(r.columns).toHaveLength(10);
    expect(r.attachments).toHaveLength(10);
  });

  it.each([
    ['name 201', { name: 'n'.repeat(201) }, 'name'],
    ['11 columns', { columns: Array.from({ length: 11 }, () => ({ lines: ['x'] })) }, 'columns'],
    ['51 lines', { columns: [{ lines: Array.from({ length: 51 }, () => 'x') }] }, 'columns'],
    ['line 2001 chars', { columns: [{ lines: ['x'.repeat(2001)] }] }, 'columns[0].lines[0]'],
    ['label 201 chars', { columns: [{ label: 'l'.repeat(201), lines: ['x'] }] }, 'columns[0].label'],
    [
      '11 attachments',
      { attachments: Array.from({ length: 11 }, (_, i) => ({ filename: `f${i}`, content: '' })) },
      'attachments',
    ],
    ['filename 256', { attachments: [{ filename: 'f'.repeat(256), content: '' }] }, 'attachments[0].filename'],
    [
      'attachment 102401 bytes',
      { attachments: [{ filename: 'a', content: 'c'.repeat(102_401) }] },
      'attachments[0].content',
    ],
  ])('rejects %s naming the field', (_label, over, field) => {
    expect(fieldsOf(() => validateStepBody(valid(over), 'create'))).toContain(field);
  });

  it('counts attachment size in UTF-8 bytes, not characters', () => {
    const fits = '😀'.repeat(25_600); // 4 bytes each = 102,400
    expect(validateStepBody(valid({ attachments: [{ filename: 'a', content: fits }] }), 'create')).toBeDefined();
    expect(
      fieldsOf(() => validateStepBody(valid({ attachments: [{ filename: 'a', content: `${fits}x` }] }), 'create')),
    ).toEqual(['attachments[0].content']);
  });

  it('counts characters as code points: 2000 four-byte characters are fine', () => {
    expect(
      validateStepBody(valid({ columns: [{ lines: ['😀'.repeat(2000)] }] }), 'create').columns[0]?.lines[0],
    ).toHaveLength(4000);
  });
});

describe('variables in lines (BR2.4)', () => {
  it('rejects an invalid brace and tells column, line and position', () => {
    try {
      validateStepBody(valid({ columns: [{ lines: ['ok'] }, { lines: ['a', 'x {a.b} y'] }] }), 'create');
      expect.unreachable();
    } catch (e) {
      const err = e as ValidationError;
      expect(err.fields).toEqual(['columns[1].lines[1]']);
      expect(err.message).toMatch(/Kolom 2, langkah 2, karakter 3/);
      expect(err.message).toMatch(/\{\{/);
    }
  });

  it.each(['{}', '{ a }', '{"a":1}', 'unterminated {x'])('rejects %s', (line) => {
    expect(fieldsOf(() => validateStepBody(valid({ columns: [{ lines: [line] }] }), 'create'))).toEqual([
      'columns[0].lines[0]',
    ]);
  });

  it('keeps {{ and }} and variables as typed', () => {
    const r = validateStepBody(valid({ columns: [{ lines: ['{{x}} {Host}'] }] }), 'create');
    expect(r.columns[0]?.lines[0]).toBe('{{x}} {Host}');
  });

  it('does not scan attachment content for variables', () => {
    expect(
      validateStepBody(valid({ attachments: [{ filename: 'a.json', content: '{"a": {}}' }] }), 'create'),
    ).toBeDefined();
  });
});

describe('attachments (BR2.5)', () => {
  it.each([
    ['path separator /', 'dir/a.yaml'],
    ['path separator \\', 'dir\\a.yaml'],
    ['parent path', '..a.yaml'],
    ['empty', '  '],
  ])('rejects filename with %s', (_l, filename) => {
    expect(
      fieldsOf(() => validateStepBody(valid({ attachments: [{ filename, content: 'x' }] }), 'create')),
    ).toEqual(['attachments[0].filename']);
  });

  it('rejects duplicate filenames ignoring case', () => {
    expect(
      fieldsOf(() =>
        validateStepBody(
          valid({ attachments: [{ filename: 'a.sql', content: '' }, { filename: 'A.SQL', content: '' }] }),
          'create',
        ),
      ),
    ).toEqual(['attachments[1].filename']);
  });

  it('rejects non-text content and lone surrogates', () => {
    expect(
      fieldsOf(() => validateStepBody(valid({ attachments: [{ filename: 'a', content: 5 }] }), 'create')),
    ).toEqual(['attachments[0].content']);
    expect(
      fieldsOf(() => validateStepBody(valid({ attachments: [{ filename: 'a', content: '\uDC00' }] }), 'create')),
    ).toEqual(['attachments[0].content']);
  });
});

describe('rollback pairing shape (BR2.9)', () => {
  it('rejects a pair on a rollback step', () => {
    expect(
      fieldsOf(() => validateStepBody(valid({ kind: 'rollback', pairedRollbackStepId: 'x' }), 'create')),
    ).toEqual(['pairedRollbackStepId']);
    expect(
      fieldsOf(() =>
        validateStepBody(valid({ kind: 'rollback', rollbackStep: valid({ kind: 'rollback' }) }), 'create'),
      ),
    ).toContain('pairedRollbackStepId');
  });

  it('rejects an id and an inline rollbackStep together', () => {
    expect(
      fieldsOf(() =>
        validateStepBody(valid({ pairedRollbackStepId: 'x', rollbackStep: valid({ kind: 'rollback' }) }), 'create'),
      ),
    ).toEqual(['rollbackStep']);
  });

  it('accepts an inline rollbackStep (kind defaults to rollback) and validates it with a prefix', () => {
    const r = validateStepBody(valid({ rollbackStep: valid({ kind: undefined, name: 'Undo' }) }), 'create');
    expect(r.rollbackStep).toMatchObject({ name: 'Undo', kind: 'rollback' });
    expect(
      fieldsOf(() => validateStepBody(valid({ rollbackStep: valid({ kind: undefined, name: '' }) }), 'create')),
    ).toEqual(['rollbackStep.name']);
  });

  it('rejects an inline rollbackStep that is forward or has its own pair', () => {
    expect(
      fieldsOf(() => validateStepBody(valid({ rollbackStep: valid({ kind: 'forward' }) }), 'create')),
    ).toContain('rollbackStep.kind');
    expect(
      fieldsOf(() =>
        validateStepBody(valid({ rollbackStep: valid({ kind: 'rollback', pairedRollbackStepId: 'z' }) }), 'create'),
      ),
    ).toContain('rollbackStep');
  });

  it('distinguishes an absent pair (unchanged) from null (cleared) on update', () => {
    expect(validateStepBody(valid(), 'update').pairedRollbackStepId).toBeUndefined();
    expect(validateStepBody(valid({ pairedRollbackStepId: null }), 'update').pairedRollbackStepId).toBeNull();
  });
});

describe('bundle body (BR2.11)', () => {
  const bundle = (over: Record<string, unknown> = {}) => ({
    name: 'Buka DB',
    forwardStepIds: ['a', 'b'],
    rollbackStepIds: ['c'],
    ...over,
  });

  it('accepts different forward and rollback counts and an optional category', () => {
    expect(validateBundleBody(bundle({ category: 'Database' }))).toEqual({
      name: 'Buka DB',
      category: 'Database',
      forwardStepIds: ['a', 'b'],
      rollbackStepIds: ['c'],
    });
    expect(validateBundleBody(bundle({ rollbackStepIds: undefined })).rollbackStepIds).toEqual([]);
  });

  it('rejects empty name, no forward members, bad category and duplicates', () => {
    expect(fieldsOf(() => validateBundleBody(bundle({ name: '' })))).toEqual(['name']);
    expect(fieldsOf(() => validateBundleBody(bundle({ forwardStepIds: [] })))).toEqual(['forwardStepIds']);
    expect(fieldsOf(() => validateBundleBody(bundle({ category: 'X' })))).toEqual(['category']);
    expect(fieldsOf(() => validateBundleBody(bundle({ forwardStepIds: ['a', 'a'] })))).toEqual(['forwardStepIds']);
    expect(fieldsOf(() => validateBundleBody(bundle({ rollbackStepIds: ['a'] })))).toEqual(['rollbackStepIds']);
  });

  it('enforces name 200 and 50 members per list', () => {
    expect(fieldsOf(() => validateBundleBody(bundle({ name: 'n'.repeat(201) })))).toEqual(['name']);
    const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
    expect(validateBundleBody(bundle({ forwardStepIds: ids('f', 50), rollbackStepIds: ids('r', 50) }))).toBeDefined();
    expect(fieldsOf(() => validateBundleBody(bundle({ forwardStepIds: ids('f', 51) })))).toEqual(['forwardStepIds']);
    expect(fieldsOf(() => validateBundleBody(bundle({ rollbackStepIds: ids('r', 51) })))).toEqual(['rollbackStepIds']);
  });

  it('rejects a non-object body', () => {
    expect(fieldsOf(() => validateBundleBody('x'))).toEqual(['body']);
  });
});

describe('list query (BR2.13)', () => {
  it('normalizes empty values to null', () => {
    expect(validateListQuery({})).toEqual({ q: null, category: null });
    expect(validateListQuery({ q: '  ', category: '' })).toEqual({ q: null, category: null });
  });

  it('accepts q up to 200 characters and a valid category', () => {
    expect(validateListQuery({ q: ' img ', category: 'Bastion' })).toEqual({ q: 'img', category: 'Bastion' });
    expect(validateListQuery({ q: 'q'.repeat(200) }).q).toHaveLength(200);
  });

  it('rejects q over 200, bad category and repeated parameters', () => {
    expect(fieldsOf(() => validateListQuery({ q: 'q'.repeat(201) }))).toEqual(['q']);
    expect(fieldsOf(() => validateListQuery({ category: 'Nope' }))).toEqual(['category']);
    expect(fieldsOf(() => validateListQuery({ q: ['a', 'b'] }))).toEqual(['q']);
  });
});
