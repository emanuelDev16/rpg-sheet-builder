import { migrateLegacyDnd5eSheet, migrateLegacySheetMetadata } from '../sheetModel.ts';
import type { SystemAdapter } from './types.ts';

/**
 * D&D 5e (SRD 5.1) adapter. Rules live in `dnd5eRules.ts`; migration delegates
 * to `migrateLegacySheetMetadata` + `migrateLegacyDnd5eSheet` (`normalizeDnd5eState`).
 */
export const dnd5eAdapter: SystemAdapter = {
  id: 'dnd5e',
  matches: (systemId) => systemId?.trim().toLowerCase() === 'dnd5e',
  progressionKind: 'dnd5e-leveling',
  capabilities: Object.freeze({
    supportsXp: false,
    supportsPoolComposer: false,
    supportsD20Advantage: true,
    supportsStructuredDossier: false,
    supportsPaperSheet: true,
  }),
  paperLayout: 'dnd5e',
  i18nNamespace: 'dnd5e',
  migrateSheet: (sheet) => migrateLegacyDnd5eSheet(migrateLegacySheetMetadata(sheet)),
};
