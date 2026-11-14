import React from 'react';
import { Globe, Printer } from 'lucide-react';
import { AppMode, SYSTEM_OPTIONS, SystemId } from '../core/sheetModel';
import { AppLanguage, AppTranslations, LANGUAGE_OPTIONS } from '../core/i18n';

interface TopBarProps {
  systemCode: string;
  activeSystemId: SystemId;
  mode: AppMode;
  language: AppLanguage;
  t: AppTranslations['topBar'];
  onChangeSystemCode: (nextCode: string) => void;
  onSwitchSystem: (systemId: SystemId) => void;
  onChangeLanguage: (lang: AppLanguage) => void;
  onModeChange: (mode: AppMode) => void;
  onNewSheet: () => void;
  onOpenModal: () => void;
  onSaveModal: () => void;
  onPrintPdf: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  systemCode,
  activeSystemId,
  mode,
  language,
  t,
  onChangeSystemCode,
  onSwitchSystem,
  onChangeLanguage,
  onModeChange,
  onNewSheet,
  onOpenModal,
  onSaveModal,
  onPrintPdf,
}) => {
  return (
    <header
      className="no-print print:hidden topbar-root flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--bg-card)] border-b-2 border-[var(--border-ink)] shrink-0 max-w-full overflow-x-hidden"
      aria-label={t.ariaHeader}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 max-w-full">
        <span
          className="font-mono-tech text-xs font-bold px-2 py-1 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[4px] select-none shrink-0"
          aria-hidden="true"
        >
          +
        </span>
        {mode === 'edicao' ? (
          <input
            type="text"
            aria-label="Identificador do sistema"
            value={systemCode}
            onChange={(e) => onChangeSystemCode(e.target.value)}
            className="cyber-input mobile-touch-input px-2.5 py-1 text-xs font-bold uppercase tracking-wider w-[260px] max-w-full min-w-0"
          />
        ) : (
          <h1 className="font-mono-tech text-xs sm:text-sm font-bold tracking-wider text-[var(--ink-primary)] uppercase truncate">
            {systemCode}
          </h1>
        )}
      </div>

      <div className="topbar-actions-scroll flex flex-wrap items-center gap-2 sm:gap-2.5 w-full xl:w-auto max-w-full">
        <div className="flex items-center gap-1.5 shrink-0 max-w-full">
          <label
            htmlFor="system-switcher-select"
            className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)] hidden xl:inline whitespace-nowrap"
          >
            {t.systemLabel}
          </label>
          <select
            id="system-switcher-select"
            aria-label={t.systemAria}
            value={activeSystemId}
            onChange={(e) => onSwitchSystem(e.target.value as SystemId)}
            className="cyber-input mobile-touch-input px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer max-w-[215px] sm:max-w-[235px]"
          >
            {SYSTEM_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Globe className="w-3.5 h-3.5 text-[var(--accent-wine)] shrink-0" aria-hidden="true" />
          <label htmlFor="language-switcher-select" className="sr-only">
            {t.languageLabel}
          </label>
          <select
            id="language-switcher-select"
            data-testid="language-switcher"
            aria-label={t.languageAria}
            value={language}
            onChange={(e) => onChangeLanguage(e.target.value as AppLanguage)}
            className="cyber-input mobile-touch-input px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onNewSheet}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.newSheet}
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.open}
          </button>
          <button
            type="button"
            onClick={onSaveModal}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.save}
          </button>
          <button
            type="button"
            onClick={onPrintPdf}
            aria-label={t.pdfAria}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--accent-wine)]" aria-hidden="true" />
            <span>PDF</span>
          </button>
        </div>

        <div
          role="group"
          aria-label={t.modeSelectorAria}
          className="inline-flex border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] overflow-hidden bg-[var(--bg-card)] shrink-0"
        >
          <button
            type="button"
            aria-pressed={mode === 'jogo'}
            onClick={() => onModeChange('jogo')}
            className={`font-mono-tech px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-75 ${
              mode === 'jogo'
                ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            {t.playMode}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'edicao'}
            onClick={() => onModeChange('edicao')}
            className={`font-mono-tech px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 border-l-2 border-[var(--border-ink)] cursor-pointer transition-colors duration-75 ${
              mode === 'edicao'
                ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            {t.editMode}
          </button>
        </div>
      </div>
    </header>
  );
};
