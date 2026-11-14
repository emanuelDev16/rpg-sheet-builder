import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Copy, Check, Upload, Printer } from 'lucide-react';
import {
  CharacterSheetState,
  NewSheetIdentityInput,
  SYSTEM_OPTIONS,
  SystemId,
} from '../core/sheetModel';
import { AppTranslations, getTranslations } from '../core/i18n';
import { generateSingleFilePureHtml, QSS_VARIABLES_GUIDE } from '../core/pureHtmlExporter';

interface SheetModalProps {
  mode: 'new' | 'open' | 'save' | null;
  sheet: CharacterSheetState;
  activeSystemId: SystemId;
  t?: AppTranslations['modal'];
  onClose: () => void;
  onCreateNewSheet: (systemId: SystemId, identity?: NewSheetIdentityInput) => void;
  onLoadPreset: (presetId: SystemId) => void;
  onImportJson: (nextSheet: CharacterSheetState) => void;
  onSaveLocal: () => void;
  onPrintPdf: () => void;
}

const DEFAULT_MODAL_T = getTranslations('pt-BR').modal;

export const SheetModal: React.FC<SheetModalProps> = ({
  mode,
  sheet,
  activeSystemId,
  t = DEFAULT_MODAL_T,
  onClose,
  onCreateNewSheet,
  onLoadPreset,
  onImportJson,
  onSaveLocal,
  onPrintPdf,
}) => {
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedQss, setCopiedQss] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<SystemId>(activeSystemId);
  const [charName, setCharName] = useState('');
  const [secondaryTrait, setSecondaryTrait] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (mode === 'new') {
      setSelectedSystem(activeSystemId);
      setCharName('');
      setSecondaryTrait('');
    }
  }, [mode, activeSystemId]);

  useEffect(() => {
    if (!mode) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const rafId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    };
  }, [mode]);

  if (!mode) return null;

  const handleDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as CharacterSheetState;
        if (!parsed || !Array.isArray(parsed.cards)) {
          setImportError('Arquivo JSON inválido: estrutura de cartões ausente.');
          return;
        }
        setImportError(null);
        onImportJson(parsed);
        onClose();
      } catch {
        setImportError('Não foi possível ler o arquivo JSON selecionado.');
      }
    };
    reader.readAsText(file);
  };

  const handleCopyQss = async () => {
    try {
      await navigator.clipboard.writeText(QSS_VARIABLES_GUIDE);
      setCopiedQss(true);
      setTimeout(() => setCopiedQss(false), 1800);
    } catch {
      // Fallback ignored in headless
    }
  };

  return (
    <div
      className="no-print print:hidden mobile-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'new' ? t.newTitle : mode === 'open' ? t.openTitle : t.saveTitle}
        className="bento-card mobile-modal-dialog w-full max-w-lg max-h-[100dvh] overflow-y-auto bg-[var(--bg-card)] shadow-[6px_6px_0_#0B0B0B]"
      >
        <header className="bento-card-header sticky top-0 z-10">
          <div className="bento-card-header-title flex flex-wrap items-center gap-2 min-w-0">
            {mode !== 'new' && (
              <span className="font-mono-tech text-xs font-bold text-[var(--accent-wine)] shrink-0">
                {mode === 'open' ? '//OPEN_SYSTEM' : '//EXPORT_SAVE'}
              </span>
            )}
            <h2 className="font-display text-lg sm:text-xl font-extrabold uppercase leading-tight">
              {mode === 'new' ? t.newTitle : mode === 'open' ? t.openTitle : t.saveTitle}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t.closeAria}
            className="cyber-btn-outline mobile-touch-stepper w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        <div className="p-4 flex flex-col gap-3">
          {mode === 'new' ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onCreateNewSheet(selectedSystem, {
                  characterName: charName,
                  secondaryTrait: selectedSystem === 'blank' ? undefined : secondaryTrait,
                });
                onClose();
              }}
            >
              <p className="font-mono-tech text-xs text-[var(--ink-secondary)]">
                {t.newSubtitle}
              </p>

              <div className="flex flex-col gap-2">
                <span className="font-mono-tech text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  {t.newSystemListLabel}
                </span>
                <div
                  role="radiogroup"
                  aria-label={t.newSystemListLabel}
                  className="grid grid-cols-1 gap-2"
                >
                  {[
                    ...SYSTEM_OPTIONS.filter((opt) => opt.id !== 'blank' && opt.id === activeSystemId),
                    ...SYSTEM_OPTIONS.filter((opt) => opt.id !== 'blank' && opt.id !== activeSystemId),
                    ...SYSTEM_OPTIONS.filter((opt) => opt.id === 'blank'),
                  ].map((opt) => {
                    const isSelected = opt.id === selectedSystem;
                    const isCurrent = opt.id === activeSystemId;
                    const isBlank = opt.id === 'blank';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`new-sheet-system-${opt.id}`}
                        onClick={() => setSelectedSystem(opt.id)}
                        className={`cyber-btn-outline p-3 text-left flex items-center justify-between gap-3 cursor-pointer ${
                          isBlank ? 'border-dashed' : ''
                        } ${
                          isSelected
                            ? 'bg-[var(--accent-cream-badge)] border-[var(--accent-wine)]'
                            : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-bold uppercase ${
                                isSelected
                                  ? 'text-[var(--accent-wine)]'
                                  : 'text-[var(--ink-primary)]'
                              }`}
                            >
                              {isBlank ? t.newBlankTitle : opt.label}
                            </span>
                            {isCurrent && (
                              <span className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[3px] uppercase">
                                {t.newCurrentBadge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--ink-muted)]">
                            {isBlank ? t.newBlankDesc : opt.description}
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            isSelected
                              ? 'border-[var(--accent-wine)] bg-[var(--accent-wine)]'
                              : 'border-[var(--border-ink)] bg-[var(--bg-card)]'
                          }`}
                        >
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-inverse)]" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
                <span className="font-mono-tech text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  {t.newIdentityHeading}
                </span>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="new-sheet-char-name"
                    className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                  >
                    {t.newCharNameLabel}
                  </label>
                  <input
                    id="new-sheet-char-name"
                    data-testid="new-sheet-name-input"
                    type="text"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder={
                      selectedSystem === 'wod'
                        ? 'Julian Cross'
                        : selectedSystem === 'dnd5e'
                          ? 'Lyra Vance'
                          : selectedSystem === 'cyberpunk'
                            ? 'Zero_K'
                            : t.newCharacterName
                    }
                    className="cyber-input mobile-touch-input px-2.5 py-2 text-xs font-semibold w-full"
                  />
                </div>

                {selectedSystem !== 'blank' && (
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="new-sheet-secondary-trait"
                      className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {selectedSystem === 'wod'
                        ? t.newClanFactionLabel
                        : selectedSystem === 'dnd5e'
                          ? t.newClassAncestryLabel
                          : t.newArchetypeLabel}
                    </label>
                    <input
                      id="new-sheet-secondary-trait"
                      data-testid="new-sheet-trait-input"
                      type="text"
                      value={secondaryTrait}
                      onChange={(e) => setSecondaryTrait(e.target.value)}
                      placeholder={
                        selectedSystem === 'wod'
                          ? 'Ventrue'
                          : selectedSystem === 'dnd5e'
                            ? 'Fighter · Half-Elf'
                            : selectedSystem === 'cyberpunk'
                              ? 'Netrunner'
                              : 'Vanguarda Tática'
                      }
                      className="cyber-input mobile-touch-input px-2.5 py-2 text-xs font-semibold w-full"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                data-testid="new-sheet-submit-btn"
                className="cyber-roll-btn mobile-touch-input w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                {t.createAction}
              </button>
            </form>
          ) : mode === 'open' ? (
            <>
              <p className="font-mono-tech text-xs text-[var(--ink-secondary)]">
                {t.presetsTitle}
              </p>

              <div className="grid grid-cols-1 gap-2">
                {SYSTEM_OPTIONS.map((opt) => {
                  const isActive = opt.id === activeSystemId;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onLoadPreset(opt.id);
                        onClose();
                      }}
                      className={`cyber-btn-outline p-3 text-left flex items-center justify-between gap-4 cursor-pointer ${
                        isActive ? 'bg-[var(--accent-cream-badge)] border-[var(--accent-wine)]' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-bold uppercase ${
                            isActive ? 'text-[var(--accent-wine)]' : 'text-[var(--ink-primary)]'
                          }`}
                        >
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-[var(--ink-muted)]">{opt.description}</div>
                      </div>
                      <span
                        className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                          isActive ? 'text-[var(--accent-wine)]' : ''
                        }`}
                      >
                        {isActive ? 'RESET ↗' : 'LOAD ↗'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="cyber-roll-btn px-3 py-2 text-xs font-bold uppercase inline-flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.importBtn}</span>
                </button>
                {importError && (
                  <span className="font-mono-tech text-[11px] text-[var(--accent-danger)]">
                    {importError}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onSaveLocal();
                    onClose();
                  }}
                  className="cyber-roll-btn p-3 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold uppercase">{t.saveLocalTitle}</div>
                    <div className="text-[11px] opacity-80">{t.saveLocalDesc}</div>
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap shrink-0">OK ↗</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.requestAnimationFrame(() => onPrintPdf());
                  }}
                  className="cyber-btn-outline p-3 text-left flex items-center justify-between gap-4 bg-[var(--accent-cream-badge)] cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold uppercase text-[var(--accent-wine)]">
                      {t.printPdfTitle}
                    </div>
                    <div className="text-[11px] text-[var(--ink-secondary)]">
                      {t.printPdfDesc}
                    </div>
                  </div>
                  <Printer className="w-4 h-4 shrink-0 text-[var(--accent-wine)]" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      'ficha-agnóstica.json',
                      JSON.stringify(sheet, null, 2),
                      'application/json',
                    )
                  }
                  className="cyber-btn-outline p-3 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold uppercase">{t.downloadJsonTitle}</div>
                    <div className="text-[11px] text-[var(--ink-muted)]">{t.downloadJsonDesc}</div>
                  </div>
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      'prototipo-ficha-rpg.html',
                      generateSingleFilePureHtml(sheet),
                      'text/html',
                    )
                  }
                  className="cyber-btn-outline p-3 text-left flex items-center justify-between gap-4 bg-[var(--accent-cream-badge)] cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold uppercase text-[var(--accent-wine)]">
                      {t.downloadHtmlTitle}
                    </div>
                    <div className="text-[11px] text-[var(--ink-secondary)]">
                      {t.downloadHtmlDesc}
                    </div>
                  </div>
                  <Download className="w-4 h-4 shrink-0 text-[var(--accent-wine)]" aria-hidden="true" />
                </button>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <span className="font-mono-tech text-[11px] text-[var(--ink-muted)]">
                  Tokens :root (PySide6 QSS)
                </span>
                <button
                  type="button"
                  onClick={handleCopyQss}
                  className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedQss ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--accent-wine)]" aria-hidden="true" />
                      <span>{t.copiedQss}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.copyQss}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
