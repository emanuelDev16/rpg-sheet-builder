import { migrateLegacySheetMetadata } from '../sheetModel.ts';
import type { SystemAdapter } from './types.ts';

/** Safe fallback for blank, generic, Cyberpunk (pending) and unknown systems. */
export const defaultAdapter: SystemAdapter = {
  id: 'default',
  matches: (systemId) => systemId?.trim().toLowerCase() === 'default',
  progressionKind: 'generic-xp',
  capabilities: Object.freeze({
    supportsXp: false,
    supportsPoolComposer: false,
    supportsD20Advantage: false,
    supportsStructuredDossier: false,
    supportsPaperSheet: true,
  }),
  paperLayout: 'generic',
  i18nNamespace: 'generic',
  migrateSheet: (sheet) => migrateLegacySheetMetadata(sheet),
};
