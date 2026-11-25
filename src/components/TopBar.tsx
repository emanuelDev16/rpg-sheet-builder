import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe, Printer, Volume2, VolumeX } from 'lucide-react';
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
import { type PaperPrintStyle } from '../core/printSheet';

interface TopBarProps {
  systemCode: string;
  activeSystemId: SystemId;
  mode: AppMode;
  language: AppLanguage;
  theme?: ThemeMode;
  isAudioMuted: boolean;
  activeView?: 'home' | 'sheet';
  t: AppTranslations['topBar'];
  printStyle?: PaperPrintStyle;
  onChangePrintStyle?: (style: PaperPrintStyle) => void;
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
  onPrintPdf: (style?: PaperPrintStyle) => void;
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
  printStyle = 'gothic-crimson',
  onChangePrintStyle,
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
  const [isPdfMenuOpen, setIsPdfMenuOpen] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPdfMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPdfMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setIsPdfMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPdfMenuOpen]);

  const activePrintStyle = printStyle;

  const styleOptions: Array<{
    id: PaperPrintStyle;
    label: string;
    desc: string;
  }> = [
    {
      id: 'gothic-crimson',
      label: t.pdfStyleGothic,
      desc: t.pdfStyleGothicDesc,
    },
    {
      id: 'classic-bw',
      label: t.pdfStyleClassic,
      desc: t.pdfStyleClassicDesc,
    },
    {
      id: 'minimal',
      label: t.pdfStyleMinimal,
      desc: t.pdfStyleMinimalDesc,
    },
  ];

  const handleSelectAndPrint = (selectedStyle: PaperPrintStyle) => {
    onChangePrintStyle?.(selectedStyle);
    onPrintPdf(selectedStyle);
    setIsPdfMenuOpen(false);
  };

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
          <div className="relative shrink-0" ref={pdfMenuRef}>
            <button
              type="button"
              data-testid="topbar-pdf-btn"
              onClick={() => setIsPdfMenuOpen((prev) => !prev)}
              aria-expanded={isPdfMenuOpen}
              aria-haspopup="menu"
              aria-label={t.pdfAria}
              title={t.pdfAria}
              className="cyber-btn-outline min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--accent-wine)]" aria-hidden="true" />
              <span>PDF</span>
              <ChevronDown
                className={`w-3 h-3 text-[var(--ink-muted)] transition-transform duration-100 ${
                  isPdfMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            {isPdfMenuOpen && (
              <div
                role="menu"
                aria-label={t.pdfMenuAria}
                data-testid="topbar-pdf-menu"
                className="absolute right-0 top-full mt-1.5 z-50 w-72 p-2 bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] shadow-lg flex flex-col gap-1 text-[var(--text-primary)] font-mono-tech"
              >
                <div className="px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-[var(--ink-muted)] border-b-[length:var(--border-width)] border-[var(--border-color)] flex items-center justify-between">
                  <span>{t.pdfStyleLabel}</span>
                </div>
                <div className="flex flex-col gap-1 py-1">
                  {styleOptions.map((opt) => {
                    const isSelected = activePrintStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitem"
                        data-testid={`pdf-style-option-${opt.id}`}
                        onClick={() => handleSelectAndPrint(opt.id)}
                        className={`w-full text-left px-2.5 py-1.5 min-h-[36px] rounded-[var(--radius-control)] border transition-colors cursor-pointer flex flex-col justify-center ${
                          isSelected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)] font-bold'
                            : 'border-transparent hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="tracking-wide uppercase">{opt.label}</span>
                          {isSelected && (
                            <span className="text-[10px] text-[var(--accent-wine)] font-bold">✓</span>
                          )}
                        </div>
                        <span className="text-[9px] text-[var(--ink-muted)] font-ui leading-tight mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  data-testid="pdf-direct-print-btn"
                  onClick={() => {
                    onPrintPdf(activePrintStyle);
                    setIsPdfMenuOpen(false);
                  }}
                  className="cyber-btn-outline w-full min-h-[36px] px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase text-center cursor-pointer bg-[var(--accent-black)] text-[var(--accent-contrast)] hover:opacity-90 transition-opacity mt-1"
                >
                  {t.pdfPrintAction}
                </button>
              </div>
            )}
          </div>
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
