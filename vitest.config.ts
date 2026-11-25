import { defineConfig } from 'vitest/config';

export const NODE_TEST_FILES = [
  'src/core/diceAudio.test.ts',
  'src/core/formula.test.ts',
  'src/core/i18n.test.ts',
  'src/core/presetI18n.test.ts',
  'src/core/printSheet.test.ts',
  'src/core/roomSync.test.ts',
  'src/core/sheetModel.test.ts',
  'src/core/sheetSearch.test.ts',
  'src/core/wodAdvantagesCatalog.test.ts',
  'src/core/wodClansDisciplinesCatalog.test.ts',
  'src/core/wodSkillsCatalog.test.ts',
  'src/core/workspaceHydration.test.ts',
  'src/core/xpSystem.test.ts',
  'src/utils/bentoLayout.test.ts',
  'src/utils/dotRating.test.ts',
  'src/utils/theme.test.ts',
  'src/utils/wodCreationWizard.test.ts',
  'src/utils/wodPoolComposer.test.ts',
] as const;

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Existing core unit tests use node:test (run via `npm run test:node`).
    // Exclude them here so `npx vitest run` executes Vitest suites cleanly.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...NODE_TEST_FILES,
    ],
  },
});
