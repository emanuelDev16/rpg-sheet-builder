import { normalizeRulePreset } from '../formula.ts';
import { migrateLegacyWodSheet, resolveRulePreset } from '../sheetModel.ts';
import type { SystemAdapter } from './types.ts';

const EXPLICIT_WOD_PRESETS = new Set([
  'vampire-v5',
  'vampire_v5',
  'storyteller-v20',
  'storyteller_v20',
]);
const WOD_CANONICAL_PRESETS = new Set(['vampire-v5', 'storyteller-v20']);

/** World of Darkness adapter covering Vampire V5 and Storyteller V20. */
export const wodAdapter: SystemAdapter = {
  id: 'wod',
  matches: (systemId, rulePreset) => {
    const normalizedId = systemId?.trim().toLowerCase();
    if (normalizedId === 'wod') return true;
    if (normalizedId) return false;
    const normalizedPreset = rulePreset?.trim().toLowerCase();
    return (
      !!normalizedPreset &&
      EXPLICIT_WOD_PRESETS.has(normalizedPreset) &&
      WOD_CANONICAL_PRESETS.has(normalizeRulePreset(normalizedPreset))
    );
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
