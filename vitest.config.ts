import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Existing core unit tests use node:test (run via `npx tsx --test`).
    // Exclude them here so `npx vitest run` executes Vitest suites cleanly.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/core/diceAudio.test.ts',
      'src/core/formula.test.ts',
      'src/core/i18n.test.ts',
      'src/core/printSheet.test.ts',
      'src/core/roomSync.test.ts',
      'src/core/sheetModel.test.ts',
      'src/core/sheetSearch.test.ts',
      'src/core/xpSystem.test.ts',
    ],
  },
});
