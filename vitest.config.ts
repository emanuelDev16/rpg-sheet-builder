import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export const NODE_TEST_FILES = [
  'src/core/cyberpunkRules.test.ts',
  'src/core/diceAudio.test.ts',
  'src/core/catalogs/dnd5e/dnd5eCatalog.test.ts',
  'src/core/dnd5eProgression.test.ts',
  'src/core/dnd5eRules.test.ts',
  'src/core/formula.test.ts',
  'src/core/i18n.test.ts',
  'src/core/paperSheetModel.test.ts',
  'src/core/presetI18n.test.ts',
  'src/core/printSheet.test.ts',
  'src/core/roomSync.test.ts',
  'src/core/sheetModel.test.ts',
  'src/core/sheetSearch.test.ts',
  'src/core/systems/registry.test.ts',
  'src/core/wodAdvantagesCatalog.test.ts',
  'src/core/wodClansDisciplinesCatalog.test.ts',
  'src/core/wodSkillsCatalog.test.ts',
  'src/core/workspaceHydration.test.ts',
  'src/core/xpSystem.test.ts',
  'src/utils/bentoLayout.test.ts',
  'src/utils/dotRating.test.ts',
  'src/utils/popoverPosition.test.ts',
  'src/utils/theme.test.ts',
  'src/utils/wodCreationWizard.test.ts',
  'src/utils/wodPoolComposer.test.ts',
] as const;

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          // Existing core unit tests use node:test (run via `npm run test:node`).
          // Exclude them here so `npx vitest run` executes Vitest suites cleanly.
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            ...NODE_TEST_FILES,
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.ui.test.tsx'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          setupFiles: ['src/test/setupJsdom.ts'],
        },
      },
    ],
  },
});
