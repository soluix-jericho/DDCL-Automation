import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import {
  DEFAULT_CREATED_BY,
  INITIAL_STATUS,
  MAX_PARAMETERS,
  tabLabel,
  validateChecklistInput,
  validateDdclInput,
} from '../../src/rules';
import { validateStepBody } from '../../src/stepRules';

function fieldsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.fields;
    throw e;
  }
  return [];
}

// BR1.1 (name and category mandatory, the error names every bad field) is now enforced by
// validateStepBody (BR2.1); the same behaviours are checked here against the new validator.
describe('step validation (BR1.1, extended by BR2.1)', () => {
  const lines = [{ lines: ['x'] }];

  it('accepts name and category and trims the name', () => {
    expect(
      validateStepBody({ name: ' Update Image ', category: 'Database', kind: 'forward', columns: lines }, 'create'),
    ).toMatchObject({ name: 'Update Image', category: 'Database' });
  });

  it('names both fields when both are empty', () => {
    expect(
      fieldsOf(() => validateStepBody({ name: '', category: '  ', kind: 'forward', columns: lines }, 'create')),
    ).toEqual(['name', 'category']);
  });

  it('names only name when only the name is empty', () => {
    expect(
      fieldsOf(() => validateStepBody({ name: '', category: 'Database', kind: 'forward', columns: lines }, 'create')),
    ).toEqual(['name']);
  });

  it('names only category when only the category is missing', () => {
    expect(fieldsOf(() => validateStepBody({ name: 'X', kind: 'forward', columns: lines }, 'create'))).toEqual([
      'category',
    ]);
  });

  it('rejects a non-object body', () => {
    expect(fieldsOf(() => validateStepBody(undefined, 'create'))).toEqual(['body']);
  });
});

describe('constants and labels (BR1.2, BR1.3, BR1.7)', () => {
  it('uses fixed createdBy and Draft status', () => {
    expect(DEFAULT_CREATED_BY).toBe('dev-user');
    expect(INITIAL_STATUS).toBe('Draft');
  });

  it('tab label follows the header date', () => {
    expect(tabLabel('2026-10-26')).toBe('2026-10-26');
    expect(tabLabel('2026-11-01')).toBe('2026-11-01');
  });

  it('tab label falls back when the date is empty', () => {
    expect(tabLabel(null, 'DDCL')).toBe('DDCL');
    expect(tabLabel('  ')).toBe('');
  });
});

describe('DDCL input validation', () => {
  it('requires a title', () => {
    expect(fieldsOf(() => validateDdclInput({ releaseHeader: {} }))).toEqual(['title']);
  });

  it('accepts an empty header (no mandatory fields in the skeleton)', () => {
    expect(validateDdclInput({ title: 'T' })).toEqual({ title: 'T', releaseHeader: {} });
  });

  it('rejects malformed dates and non-string header fields', () => {
    expect(
      fieldsOf(() =>
        validateDdclInput({ title: 'T', releaseHeader: { date: '26-10-2026', environment: 5 } }),
      ),
    ).toEqual(['date', 'environment']);
    expect(
      fieldsOf(() => validateDdclInput({ title: 'T', releaseHeader: { date: '2026-02-31' } })),
    ).toEqual(['date']);
  });
});

describe('checklist input validation', () => {
  it('requires stepId', () => {
    expect(fieldsOf(() => validateChecklistInput({}))).toEqual(['stepId']);
  });

  it('keeps parameter values verbatim, including leading "="', () => {
    expect(
      validateChecklistInput({ stepId: 's1', parameterValues: { a: '=1+1', b: ' x ' } }),
    ).toEqual({ stepId: 's1', parameterValues: { a: '=1+1', b: ' x ' } });
  });

  it('rejects non-string values and too many parameters', () => {
    expect(
      fieldsOf(() => validateChecklistInput({ stepId: 's', parameterValues: { a: 1 } })),
    ).toEqual(['parameterValues']);
    const many = Object.fromEntries(Array.from({ length: MAX_PARAMETERS + 1 }, (_, i) => [`p${i}`, 'v']));
    expect(
      fieldsOf(() => validateChecklistInput({ stepId: 's', parameterValues: many })),
    ).toEqual(['parameterValues']);
  });
});
