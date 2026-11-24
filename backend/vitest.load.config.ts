import { defineConfig } from 'vitest/config';

/** Load tests (NFR1.5-NFR1.7, NFR1.9): run on demand or weekly in CI, never as part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/load/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    // Seeding 100,000 checklist items and 100-request series take minutes, not seconds.
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 30 * 60 * 1000,
  },
});
