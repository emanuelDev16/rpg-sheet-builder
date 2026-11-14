import React, { useRef } from 'react';
import { AppMode, SystemId, TabId } from '../core/sheetModel';
import { getTabLabelsForSystem } from '../core/printSheet';
import { AppLanguage, AppTranslations } from '../core/i18n';

interface TabNavProps {
  activeTab: TabId;
  systemId: SystemId;
  language: AppLanguage;
  t: AppTranslations['tabNav'];
  onSelectTab: (tab: TabId) => void;
  characterName: string;
  mode: AppMode;
  onChangeCharacterName: (name: string) => void;
}

const TAB_ORDER: TabId[] = ['geral', 'magias', 'xp'];

export const TabNav: React.FC<TabNavProps> = ({
  activeTab,
  systemId,
  language,
  t,
  onSelectTab,
  characterName,
  mode,
  onChangeCharacterName,
}) => {
  const { tab1, tab2, tab3 } = getTabLabelsForSystem(systemId, language);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    geral: null,
    magias: null,
    xp: null,
  });

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentTab: TabId) => {
    const idx = TAB_ORDER.indexOf(currentTab);
    if (idx === -1) return;

    let nextTab: TabId | null = null;
    if (e.key === 'ArrowRight') {
      nextTab = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    } else if (e.key === 'ArrowLeft') {
      nextTab = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    } else if (e.key === 'Home') {
      nextTab = TAB_ORDER[0];
    } else if (e.key === 'End') {
      nextTab = TAB_ORDER[TAB_ORDER.length - 1];
    }

    if (nextTab) {
      e.preventDefault();
      onSelectTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  return (
    <div className="no-print print:hidden tabnav-root flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-5 max-w-full">
      <nav
        aria-label={t.ariaLabel}
        role="tablist"
        className="flex flex-nowrap md:flex-wrap items-center gap-2 sm:gap-2.5 max-w-full overflow-x-auto pb-1 md:pb-0 [-webkit-overflow-scrolling:touch]"
      >
        <button
          ref={(el) => {
            tabRefs.current.geral = el;
          }}
          type="button"
          id="sheet-tab-geral"
          role="tab"
          aria-selected={activeTab === 'geral'}
          aria-controls="sheet-tabpanel-geral"
          tabIndex={activeTab === 'geral' ? 0 : -1}
          onClick={() => onSelectTab('geral')}
          onKeyDown={(e) => handleTabKeyDown(e, 'geral')}
          className={`cyber-tab-btn font-mono-tech px-3 sm:px-4 py-2 text-xs font-bold tracking-wider uppercase border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            activeTab === 'geral'
              ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)] shadow-[2px_2px_0_#5B0F18]'
              : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {tab1}
        </button>

        <button
          ref={(el) => {
            tabRefs.current.magias = el;
          }}
          type="button"
          id="sheet-tab-magias"
          role="tab"
          aria-selected={activeTab === 'magias'}
          aria-controls="sheet-tabpanel-magias"
          tabIndex={activeTab === 'magias' ? 0 : -1}
          onClick={() => onSelectTab('magias')}
          onKeyDown={(e) => handleTabKeyDown(e, 'magias')}
          className={`cyber-tab-btn font-mono-tech px-3 sm:px-4 py-2 text-xs font-bold tracking-wider uppercase border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            activeTab === 'magias'
              ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)] shadow-[2px_2px_0_#5B0F18]'
              : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {tab2}
        </button>

        <button
          ref={(el) => {
            tabRefs.current.xp = el;
          }}
          type="button"
          id="sheet-tab-xp"
          role="tab"
          aria-selected={activeTab === 'xp'}
          aria-controls="sheet-tabpanel-xp"
          tabIndex={activeTab === 'xp' ? 0 : -1}
          onClick={() => onSelectTab('xp')}
          onKeyDown={(e) => handleTabKeyDown(e, 'xp')}
          className={`cyber-tab-btn font-mono-tech px-3 sm:px-4 py-2 text-xs font-bold tracking-wider uppercase border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            activeTab === 'xp'
              ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)] shadow-[2px_2px_0_#0B0B0B]'
              : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {tab3}
        </button>
      </nav>

      <div className="flex flex-wrap items-center gap-2.5 max-w-full min-w-0">
        {mode === 'edicao' ? (
          <input
            type="text"
            aria-label={t.characterAria}
            value={characterName}
            onChange={(e) => onChangeCharacterName(e.target.value)}
            className="cyber-input mobile-touch-input px-2.5 py-1 text-xs font-bold uppercase tracking-wider w-[230px] sm:w-[260px] max-w-full"
          />
        ) : (
          <span className="font-mono-tech text-xs font-semibold text-[var(--ink-secondary)] uppercase tracking-wider break-words">
            {characterName}
          </span>
        )}
        {mode === 'edicao' && (
          <span className="font-mono-tech text-[11px] font-bold px-2.5 py-1 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border-[1.5px] border-[var(--border-ink)] rounded-[4px] uppercase shrink-0">
            {t.editableSchema}
          </span>
        )}
      </div>
    </div>
  );
};
