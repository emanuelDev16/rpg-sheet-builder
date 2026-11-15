import React from 'react';
import { CharacterSheetState, SystemId, TabId } from '../core/sheetModel';
import { getActiveTabSectionLabel } from '../core/printSheet';
import { AppLanguage, createTranslator } from '../core/i18n';

interface PrintSheetHeaderProps {
  sheet: CharacterSheetState;
  systemId: SystemId;
  activeTab: TabId;
  language?: AppLanguage;
  availableXp: number;
  totalCargoWeight: number;
}

export const PrintSheetHeader: React.FC<PrintSheetHeaderProps> = ({
  sheet,
  systemId,
  activeTab,
  language = 'pt-BR',
  availableXp,
  totalCargoWeight,
}) => {
  const t = createTranslator(language);
  const sectionLabel = getActiveTabSectionLabel(systemId, activeTab, language);

  return (
    <header
      aria-label={t('printHeader.ariaLabel')}
      className="print-only-header hidden print:flex items-center justify-between gap-4 mb-4 p-3.5 bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="font-mono-tech text-xs font-bold px-2 py-1 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[var(--radius-pill)] shrink-0"
          aria-hidden="true"
        >
          +
        </span>
        <div className="min-w-0">
          <div className="font-mono-tech text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase truncate">
            {sheet.systemCode}
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight truncate">
            {sheet.characterName}
          </h1>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
        <span className="font-mono-tech text-[11px] font-bold px-2.5 py-0.5 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[var(--radius-pill)] uppercase">
          {sectionLabel}
        </span>
        <div className="font-mono-tech text-[10px] font-bold text-[var(--ink-secondary)] uppercase flex items-center gap-2">
          <span>XP: {availableXp}</span>
          <span aria-hidden="true">·</span>
          <span>{t('printHeader.cargoLabel', { weight: totalCargoWeight })}</span>
        </div>
      </div>
    </header>
  );
};
