import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import {
  DEFAULT_CREATED_BY,
  INITIAL_STATUS,
  MAX_PARAMETERS,
  tabLabel,
  validateChecklistInput,
  validateDdclInput,
  validateStepInput,
} from '../../src/rules';

function fieldsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.fields;
    throw e;
  }
  return [];
}

describe('step validation (BR1.1)', () => {
  it('accepts name and category and trims them', () => {
    expect(validateStepInput({ name: ' Update Image ', category: ' Image ' })).toEqual({
      name: 'Update Image',
      category: 'Image',
    });
  });

  it('names both fields when both are empty', () => {
    expect(fieldsOf(() => validateStepInput({ name: '', category: '  ' }))).toEqual([
      'name',
      'category',
    ]);
  });

  it('names only name when only the name is empty', () => {
    expect(fieldsOf(() => validateStepInput({ name: '', category: 'Image' }))).toEqual(['name']);
  });

  it('names only category when only the category is empty', () => {
    expect(fieldsOf(() => validateStepInput({ name: 'X' }))).toEqual(['category']);
  });

  it('treats a missing or non-object body as all fields empty', () => {
    expect(fieldsOf(() => validateStepInput(undefined))).toEqual(['name', 'category']);
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
