import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Load tests run separately (vitest.load.config.ts); node_modules is repeated because `exclude` replaces the default.
    exclude: ['**/node_modules/**', 'tests/load/**'],
    globalSetup: ['./tests/global-setup.ts'],
    // Integration tests share one PostgreSQL database and truncate tables, so files run serially.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
