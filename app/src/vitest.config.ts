import { defineConfig } from 'vitest/config';

/** Frontend-only vitest config (W4). Run: npx vitest run --config src/vitest.config.ts */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
    testTimeout: 15_000,
  },
});
