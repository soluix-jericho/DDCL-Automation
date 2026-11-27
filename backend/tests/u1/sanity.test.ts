import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';

describe('sanity: test runner and config', () => {
  it('runs the runner and reads default config', () => {
    const cfg = loadConfig({ ALLOWED_ORIGINS: 'http://localhost:5173' });
    expect(cfg.port).toBe(3000);
    expect(cfg.templatePath).toContain('TEMPLATE.xlsx');
    expect(cfg.cookieSecure).toBe(false);
    expect(cfg.trustProxy).toBe(false);
    expect(cfg.admin).toBeNull();
  });

  it('reads overrides from the environment', () => {
    const cfg = loadConfig({
      BACKEND_PORT: '4100',
      ALLOWED_ORIGINS: 'http://example.test, http://other.test',
      DDCL_TEMPLATE_PATH: '/x/y.xlsx',
      COOKIE_SECURE: 'true',
      TRUST_PROXY: '1',
      ADMIN_EMAIL: ' A@B.test ',
      ADMIN_PASSWORD: 'secret-password',
      ADMIN_NAME: 'Ada',
    });
    expect(cfg).toEqual({
      port: 4100,
      allowedOrigins: ['http://example.test', 'http://other.test'],
      templatePath: '/x/y.xlsx',
      cookieSecure: true,
      trustProxy: true,
      admin: { email: 'A@B.test', password: 'secret-password', name: 'Ada' },
    });
  });

  it('falls back to FRONTEND_ORIGIN when ALLOWED_ORIGINS is empty', () => {
    expect(loadConfig({ ALLOWED_ORIGINS: '', FRONTEND_ORIGIN: 'http://old.test' }).allowedOrigins).toEqual([
      'http://old.test',
    ]);
  });

  it('rejects an empty origin list (NFR2.25)', () => {
    expect(() => loadConfig({})).toThrow(/ALLOWED_ORIGINS/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ BACKEND_PORT: 'abc', ALLOWED_ORIGINS: 'http://x' })).toThrow(/BACKEND_PORT/);
  });
});
