import { defineConfig } from 'vitest/config';

/**
 * Root test config: discovers server (W1–W5) and frontend (W4) specs.
 * Frontend-only config remains at src/vitest.config.ts for scoped runs.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    passWithNoTests: true,
    testTimeout: 15_000,
  },
});
