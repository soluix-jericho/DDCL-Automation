import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  escapeLike,
  extractVariables,
  firstTextError,
  isCategory,
  renderText,
  scanText,
} from '../../src/stepText';

describe('scanText (BR2.4)', () => {
  it('reads {{{x}}} as literal {, variable x, literal }', () => {
    expect(scanText('{{{x}}}')).toEqual([
      { type: 'text', value: '{' },
      { type: 'variable', name: 'x' },
      { type: 'text', value: '}' },
    ]);
  });

  it('accepts names with letters, digits, underscore and hyphen', () => {
    expect(extractVariables(['{db-host_1} dan {Port}'])).toEqual(['db-host_1', 'Port']);
  });

  it.each([
    ['empty braces', 'a {} b', 3],
    ['space inside', '{ a }', 1],
    ['dotted name', 'x {a.b}', 3],
    ['JSON', '{"a":1}', 1],
    ['lone close', 'abc }', 5],
    ['unterminated', 'start {name', 7],
    ['odd braces', '{a}}', 4],
  ])('rejects %s with the 1-based position', (_label, text, position) => {
    expect(firstTextError(text)).toBe(position);
  });

  it('reports positions in code points, not UTF-16 units', () => {
    expect(firstTextError('😀😀{}')).toBe(3);
  });

  it('returns null for valid text including escaped braces', () => {
    expect(firstTextError('SELECT {{1}} FROM {table}')).toBeNull();
    expect(firstTextError('')).toBeNull();
  });
});

describe('extractVariables', () => {
  it('returns unique names in order of first appearance, case-sensitive', () => {
    expect(extractVariables(['{b} {a}', '{a} {B} {b}'])).toEqual(['b', 'a', 'B']);
  });

  it('ignores escaped braces and returns [] without variables', () => {
    expect(extractVariables(['{{literal}}'])).toEqual([]);
  });
});

describe('renderText', () => {
  it('turns {{ and }} into literal braces and fills known variables', () => {
    expect(renderText('{{a}} = {a}', { a: '1' })).toBe('{a} = 1');
  });

  it('keeps an unfilled variable visible', () => {
    expect(renderText('host {host}')).toBe('host {host}');
  });

  it('does not re-scan a substituted value', () => {
    expect(renderText('{a}', { a: '{b}' })).toBe('{b}');
  });

  it('does not treat inherited object keys as values', () => {
    expect(renderText('{toString}')).toBe('{toString}');
  });
});

describe('escapeLike (NFR2.9)', () => {
  it('escapes backslash, percent and underscore', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  it('leaves other text untouched', () => {
    expect(escapeLike('Update Image')).toBe('Update Image');
  });
});

describe('categories (BR2.12)', () => {
  it('is the fixed list of four', () => {
    expect(CATEGORIES).toEqual(['Database', 'Bastion', 'RabbitMQ', 'Keycloak']);
    expect(isCategory('Database')).toBe(true);
    expect(isCategory('database')).toBe(false);
    expect(isCategory(5)).toBe(false);
  });
});
