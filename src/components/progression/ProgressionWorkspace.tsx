import React, { lazy, Suspense } from 'react';
import type { AppLanguage, AppTranslations, TranslateFn } from '../../core/i18n';
import type { CharacterSheetState, RollLogEntry, XpRulePreset } from '../../core/sheetModel';
import { getSystemAdapter } from '../../core/systems/registry';

const LazyWodXpWorkspace = lazy(() =>
  import('../XpUpgradeWorkspace').then((m) => ({ default: m.XpUpgradeWorkspace })),
);
const LazyDnd5eProgressionWorkspace = lazy(() =>
  import('../dnd5e/Dnd5eProgressionWorkspace').then((m) => ({ default: m.Dnd5eProgressionWorkspace })),
);
const LazyGenericXpWorkspace = lazy(() =>
  import('./GenericXpWorkspace').then((m) => ({ default: m.GenericXpWorkspace })),
);

export interface ProgressionWorkspaceProps {
  sheet: CharacterSheetState;
  language: AppLanguage;
  t: TranslateFn;
  xpT: AppTranslations['xp'];
  onUpdateSheet: (updater: (prev: CharacterSheetState) => CharacterSheetState) => void;
  onAppendRollLog: (entry: RollLogEntry) => void;
  onFlash?: (msg: string) => void;
  onAwardXp: (delta: number, reason: string) => { ok: boolean; error?: string };
  onUpgradeTrait: (fieldId: string) => void;
  onBuySpecialty?: (skillFieldId: string, focus: string) => { ok: boolean; error?: string };
  onBuyBackground?: (label: string, customCost?: number) => { ok: boolean; error?: string };
  onBuyCatalogSkill?: (skillIdOrVar: string) => { ok: boolean; error?: string };
  onBuyCatalogDiscipline?: (discIdOrName: string) => { ok: boolean; error?: string };
  onBuyCatalogAdvantage?: (advIdOrName: string, customCost?: number) => { ok: boolean; error?: string };
  onUndoLastUpgrade: () => void;
  onSelectRulePreset?: (preset: XpRulePreset) => void;
}

export const ProgressionWorkspace: React.FC<ProgressionWorkspaceProps> = ({
  sheet,
  language,
  t,
  xpT,
  onUpdateSheet,
  onAppendRollLog,
  onFlash,
  ...wodProps
}) => {
  const { progressionKind } = getSystemAdapter(sheet);

  const fallback = (
    <div className="bento-card p-6 font-mono-tech text-xs font-bold uppercase text-[var(--ink-muted)]">
      {t('progression.loading')}
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      {progressionKind === 'wod-xp' ? (
        <LazyWodXpWorkspace sheet={sheet} language={language} t={xpT} {...wodProps} />
      ) : progressionKind === 'dnd5e-leveling' ? (
        <LazyDnd5eProgressionWorkspace
          sheet={sheet}
          t={t}
          onUpdateSheet={onUpdateSheet}
          onAppendRollLog={onAppendRollLog}
          onFlash={onFlash}
        />
      ) : (
        <LazyGenericXpWorkspace
          sheet={sheet}
          t={t}
          onUpdateSheet={onUpdateSheet}
          onFlash={onFlash}
        />
      )}
    </Suspense>
  );
};
