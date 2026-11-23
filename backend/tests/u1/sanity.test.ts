import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';

describe('sanity: test runner and config', () => {
  it('runs the runner and reads default config', () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(3000);
    expect(cfg.templatePath).toContain('TEMPLATE.xlsx');
  });

  it('reads overrides from the environment', () => {
    const cfg = loadConfig({
      BACKEND_PORT: '4100',
      FRONTEND_ORIGIN: 'http://example.test',
      DDCL_TEMPLATE_PATH: '/x/y.xlsx',
    });
    expect(cfg).toEqual({
      port: 4100,
      frontendOrigin: 'http://example.test',
      templatePath: '/x/y.xlsx',
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ BACKEND_PORT: 'abc' })).toThrow(/BACKEND_PORT/);
  });
});
