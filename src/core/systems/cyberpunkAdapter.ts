import { migrateLegacyCyberpunkSheet, migrateLegacySheetMetadata } from '../sheetModel.ts';
import type { SystemAdapter } from './types.ts';

/**
 * Cyberpunk (`NET//RUNNER`) adapter. Rules live in `cyberpunkRules.ts`; migration
 * delegates to `migrateLegacySheetMetadata` + `migrateLegacyCyberpunkSheet`.
 */
export const cyberpunkAdapter: SystemAdapter = {
  id: 'cyberpunk',
  matches: (systemId) => systemId?.trim().toLowerCase() === 'cyberpunk',
  progressionKind: 'cyberpunk-ip',
  capabilities: Object.freeze({
    supportsXp: false,
    supportsPoolComposer: false,
    supportsD20Advantage: false,
    supportsExplodingD10: true,
    supportsStructuredDossier: false,
    supportsPaperSheet: true,
  }),
  paperLayout: 'cyberpunk',
  i18nNamespace: 'cyberpunk',
  migrateSheet: (sheet) => migrateLegacyCyberpunkSheet(migrateLegacySheetMetadata(sheet)),
};
