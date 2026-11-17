import React, { useRef } from 'react';
import { AppMode, RulePreset, SystemId, TabId } from '../core/sheetModel';
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
  rulePreset?: RulePreset;
  onSelectRulePreset?: (preset: RulePreset) => void;
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
  rulePreset = 'storyteller-v20',
  onSelectRulePreset,
}) => {
  const { tab1, tab2, tab3 } = getTabLabelsForSystem(systemId, language);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    geral: null,
    magias: null,
    xp: null,
  });

  const showRulePresetPill =
    Boolean(onSelectRulePreset) && (systemId === 'wod' || rulePreset !== 'storyteller-v20');

  const rulePresetOptions: Array<{ id: RulePreset; label: string; testId: string }> = [
    { id: 'storyteller-v20', label: t.t('tabNav.rulePresetV20'), testId: 'tabnav-preset-v20' },
    { id: 'vampire-v5', label: t.t('tabNav.rulePresetV5'), testId: 'tabnav-preset-v5' },
    { id: 'custom', label: t.t('tabNav.rulePresetCustom'), testId: 'tabnav-preset-custom' },
  ];

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
          className={`cyber-tab-btn font-mono-tech min-h-[36px] px-3 sm:px-4 py-2 text-xs font-bold tracking-wider uppercase border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            activeTab === 'geral'
              ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)] shadow-[var(--shadow-btn)]'
              : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
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
          className={`cyber-tab-btn font-mono-tech min-h-[36px] px-3 sm:px-4 py-2 text-xs font-bold tracking-wider uppercase border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            activeTab === 'magias'
              ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)] shadow-[var(--shadow-btn)]'
              : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
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
          className={`cyber-tab-btn font-mono-tech min-h-[36px] px-3 sm:px-4 py-2 text-xs font-bold tracking-wider uppercase border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            activeTab === 'xp'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-[var(--shadow-btn)]'
              : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {tab3}
        </button>
      </nav>

      <div className="flex flex-wrap items-center gap-2.5 max-w-full min-w-0">
        {showRulePresetPill && (
          <div
            role="radiogroup"
            aria-label={t.t('tabNav.rulePresetAria')}
            data-testid="tabnav-rule-preset-selector"
            className="inline-flex items-center border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] bg-[var(--bg-card)] p-0.5 shadow-[var(--shadow-btn)] shrink-0"
          >
            {rulePresetOptions.map((opt) => {
              const selected = rulePreset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={opt.testId}
                  onClick={() => onSelectRulePreset?.(opt.id)}
                  className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold tracking-wider uppercase rounded-[var(--radius-pill)] whitespace-nowrap cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

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
          <span className="font-mono-tech text-[11px] font-bold px-2.5 py-1 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0">
            {t.editableSchema}
          </span>
        )}
      </div>
    </div>
  );
};
