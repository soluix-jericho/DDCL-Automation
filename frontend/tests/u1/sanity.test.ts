import { describe, expect, it } from 'vitest';
import { tabLabel } from '../../src/tabLabel';

describe('sanity: test runner', () => {
  it('runs vitest with jsdom', () => {
    expect(typeof document).toBe('object');
  });

  it('tabLabel returns the date when present, else the fallback', () => {
    expect(tabLabel('2026-10-26', 'DDCL')).toBe('2026-10-26');
    expect(tabLabel('', 'DDCL')).toBe('DDCL');
  });
});
