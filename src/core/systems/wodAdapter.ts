import { normalizeRulePreset } from '../formula.ts';
import { migrateLegacyWodSheet, resolveRulePreset } from '../sheetModel.ts';
import type { SystemAdapter } from './types.ts';

const WOD_PRESETS = new Set(['vampire-v5', 'storyteller-v20']);

/** World of Darkness adapter covering Vampire V5 and Storyteller V20. */
export const wodAdapter: SystemAdapter = {
  id: 'wod',
  matches: (systemId, rulePreset) => {
    if (systemId === 'wod') return true;
    if (systemId !== undefined && systemId !== '') return false;
    return rulePreset !== undefined && WOD_PRESETS.has(normalizeRulePreset(rulePreset));
  },
  capabilities: Object.freeze({
    supportsXp: true,
    supportsPoolComposer: true,
    supportsD20Advantage: false,
    supportsStructuredDossier: true,
    supportsPaperSheet: true,
  }),
  paperLayout: 'wod-v20',
  resolvePaperLayout: (sheet) => (resolveRulePreset(sheet) === 'vampire-v5' ? 'wod-v5' : 'wod-v20'),
  i18nNamespace: 'wod',
  migrateSheet: (sheet) => migrateLegacyWodSheet(sheet),
};
