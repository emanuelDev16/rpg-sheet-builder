import { migrateLegacyDnd5eSheet } from '../sheetModel.ts';
import type { SystemAdapter } from './types.ts';

/**
 * D&D 5e (SRD 5.1) adapter. Rules live in `dnd5eRules.ts`; migration delegates
 * to `migrateLegacyDnd5eSheet`, which normalizes state via `normalizeDnd5eState`.
 */
export const dnd5eAdapter: SystemAdapter = {
  id: 'dnd5e',
  matches: (systemId) => systemId === 'dnd5e',
  capabilities: Object.freeze({
    supportsXp: false,
    supportsPoolComposer: false,
    supportsD20Advantage: true,
    supportsStructuredDossier: false,
    supportsPaperSheet: true,
  }),
  paperLayout: 'dnd5e',
  i18nNamespace: 'dnd5e',
  migrateSheet: (sheet) => migrateLegacyDnd5eSheet(sheet),
};
