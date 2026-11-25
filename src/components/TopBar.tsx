import React from 'react';
import { Globe, Printer, Volume2, VolumeX } from 'lucide-react';
import { AppMode, SystemId } from '../core/sheetModel';
import {
  AppLanguage,
  AppTranslations,
  getLocalizedSystemOptions,
  LANGUAGE_OPTIONS,
} from '../core/i18n';
import { localizeSystemName } from '../core/presetI18n';
import { ThemeMode } from '../utils/theme';
import { ThemeSelector } from './ThemeSelector';

interface TopBarProps {
  systemCode: string;
  activeSystemId: SystemId;
  mode: AppMode;
  language: AppLanguage;
  theme?: ThemeMode;
  isAudioMuted: boolean;
  activeView?: 'home' | 'sheet';
  t: AppTranslations['topBar'];
  onGoHome?: () => void;
  onChangeSystemCode: (nextCode: string) => void;
  onSwitchSystem: (systemId: SystemId) => void;
  onChangeLanguage: (lang: AppLanguage) => void;
  onChangeTheme?: (theme: ThemeMode) => void;
  onToggleAudioMute: () => void;
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
  theme = 'light',
  isAudioMuted,
  activeView = 'sheet',
  t,
  onGoHome,
  onChangeSystemCode,
  onSwitchSystem,
  onChangeLanguage,
  onChangeTheme,
  onToggleAudioMute,
  onModeChange,
  onNewSheet,
  onOpenModal,
  onSaveModal,
  onPrintPdf,
}) => {
  const localizedSystems = getLocalizedSystemOptions(language);

  return (
    <header
      className="no-print print:hidden topbar-root flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--bg-card)] border-b-[length:var(--border-width)] border-[var(--border-color)] shrink-0 max-w-full overflow-x-hidden"
      aria-label={t.ariaHeader}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 max-w-full">
        {onGoHome && (
          <button
            type="button"
            data-testid="topbar-home-btn"
            onClick={onGoHome}
            aria-current={activeView === 'home' ? 'page' : undefined}
            className={`font-mono-tech mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[var(--radius-pill)] border-[length:var(--border-width)] border-[var(--border-color)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeView === 'home'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t.home}
          </button>
        )}
        <span
          className="font-mono-tech text-xs font-bold px-2 py-1 bg-[var(--accent-black)] text-[var(--accent-contrast)] rounded-[var(--radius-pill)] select-none shrink-0"
          aria-hidden="true"
        >
          +
        </span>
        {mode === 'edicao' ? (
          <input
            type="text"
            aria-label={t.systemCodeAria}
            value={systemCode}
            onChange={(e) => onChangeSystemCode(e.target.value)}
            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-xs font-bold uppercase tracking-wider w-[260px] max-w-full min-w-0"
          />
        ) : (
          <h1 className="font-mono-tech text-xs sm:text-sm font-bold tracking-wider text-[var(--ink-primary)] uppercase truncate">
            {localizeSystemName(activeSystemId, systemCode, language)}
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
            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer max-w-[215px] sm:max-w-[235px]"
          >
            {localizedSystems.map((opt) => (
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
            className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          data-testid="audio-mute-toggle"
          aria-pressed={isAudioMuted}
          aria-label={isAudioMuted ? t.unmuteDiceAria : t.muteDiceAria}
          title={isAudioMuted ? t.unmuteDiceAria : t.muteDiceAria}
          onClick={onToggleAudioMute}
          className={`cyber-btn-outline mobile-touch-stepper min-h-[36px] min-w-[36px] sm:px-2 sm:py-1.5 inline-flex items-center justify-center shrink-0 cursor-pointer ${
            isAudioMuted ? 'bg-[var(--bg-header-strip)] text-[var(--ink-secondary)]' : ''
          }`}
        >
          {isAudioMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-[var(--accent-danger)]" aria-hidden="true" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-[var(--accent-wine)]" aria-hidden="true" />
          )}
        </button>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="new-sheet-btn"
            onClick={onNewSheet}
            className="cyber-btn-outline min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.newSheet}
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            className="cyber-btn-outline min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.open}
          </button>
          <button
            type="button"
            onClick={onSaveModal}
            className="cyber-btn-outline min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.save}
          </button>
          <button
            type="button"
            onClick={onPrintPdf}
            aria-label={t.pdfAria}
            className="cyber-btn-outline min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--accent-wine)]" aria-hidden="true" />
            <span>PDF</span>
          </button>
        </div>

        {onChangeTheme && (
          <ThemeSelector theme={theme} language={language} onChangeTheme={onChangeTheme} />
        )}

        <div
          role="group"
          aria-label={t.modeSelectorAria}
          className="inline-flex border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden bg-[var(--bg-card)] shrink-0"
        >
          <button
            type="button"
            aria-pressed={mode === 'jogo'}
            onClick={() => onModeChange('jogo')}
            className={`font-mono-tech min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-75 ${
              mode === 'jogo'
                ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.playMode}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'edicao'}
            onClick={() => onModeChange('edicao')}
            className={`font-mono-tech min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 border-l-[length:var(--border-width)] border-[var(--border-color)] cursor-pointer transition-colors duration-75 ${
              mode === 'edicao'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.editMode}
          </button>
        </div>
      </div>
    </header>
  );
};
