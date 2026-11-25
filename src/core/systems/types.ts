import type { CharacterSheetState } from '../sheetModel.ts';

/** Known adapter identifiers; open-ended so future systems can register. */
export type SystemAdapterId = 'wod' | 'dnd5e' | 'default' | (string & {});

/** Paper (print/PDF) layout families supported by the sheet renderer. */
export type PaperLayout = 'wod-v5' | 'wod-v20' | 'dnd5e' | 'generic';

/** Feature flags describing what a system supports in the UI. */
export interface SystemCapabilities {
  supportsXp: boolean;
  supportsPoolComposer: boolean;
  supportsD20Advantage: boolean;
  supportsStructuredDossier: boolean;
  supportsPaperSheet: boolean;
}

/** Typed contract every registered RPG system must implement. */
export interface SystemAdapter {
  readonly id: SystemAdapterId;
  /** Returns true when this adapter owns the given system/preset pair. */
  matches(systemId?: string, rulePreset?: string): boolean;
  readonly capabilities: Readonly<SystemCapabilities>;
  /** Paper layout for the sheet (may depend on rule preset). */
  readonly paperLayout: PaperLayout;
  /** Optional preset-aware layout resolver (e.g. V5 vs V20). */
  resolvePaperLayout?(sheet: CharacterSheetState): PaperLayout;
  readonly i18nNamespace: string;
  /** Normalizes legacy sheets by delegating to sheetModel normalizers. */
  migrateSheet(sheet: CharacterSheetState): CharacterSheetState;
}
