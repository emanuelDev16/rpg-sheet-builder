import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Upload,
  Printer,
  BookmarkPlus,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  CharacterSheetState,
  NewSheetIdentityInput,
  parseAndValidateImportPayload,
  RulePreset,
  Sheet,
  SystemId,
} from '../core/sheetModel';
import {
  createWorkspaceSnapshot,
  CustomSheetTemplate,
  listWorkspaceSnapshots,
  resolveSheetRecordId,
  restoreWorkspaceSnapshot,
  WorkspaceSnapshotMetadata,
  WorkspaceSnapshotReason,
} from '../core/sheetsStore';
import {
  type AppLanguage,
  type AppTranslations,
  getLocalizedSystemOptions,
  getTranslations,
} from '../core/i18n';
import { generateSingleFilePureHtml, QSS_VARIABLES_GUIDE } from '../core/pureHtmlExporter';
import { useFocusTrap } from '../utils/useFocusTrap';

interface SheetModalProps {
  mode: 'new' | 'open' | 'save' | null;
  sheet: CharacterSheetState;
  activeSystemId: SystemId;
  workspaceSheets?: CharacterSheetState[];
  customTemplates?: CustomSheetTemplate[];
  language?: AppLanguage;
  t?: AppTranslations['modal'];
  onClose: () => void;
  onCreateNewSheet: (systemId: SystemId, identity?: NewSheetIdentityInput) => void;
  onLoadPreset: (presetId: SystemId) => void;
  onImportJson?: (nextSheet: CharacterSheetState) => void;
  onImportSheets?: (sheets: CharacterSheetState[], mode: 'overwrite' | 'keep') => void | Promise<void>;
  onRestoreSnapshot?: (snapshotId: string) => Promise<Sheet[]>;
  onCreateSnapshot?: (
    sheets: Sheet[],
    reason: WorkspaceSnapshotReason,
  ) => Promise<WorkspaceSnapshotMetadata>;
  onListSnapshots?: () => Promise<WorkspaceSnapshotMetadata[]>;
  onSaveLocal: () => void | Promise<void>;
  onPrintPdf: () => void;
  onFlushSave?: () => void | Promise<void>;
  onSaveCustomTemplate?: (templateName: string) => void | Promise<void>;
  onLoadCustomTemplate?: (template: CustomSheetTemplate) => void;
  onDeleteCustomTemplate?: (templateId: string) => void | Promise<void>;
}

const DEFAULT_MODAL_T = getTranslations('pt-BR').modal;

const WOD_CLAN_SUGGESTIONS = [
  'Banu Haqim',
  'Brujah',
  'Gangrel',
  'Hecata',
  'Lasombra',
  'Malkavian',
  'Ministry',
  'Nosferatu',
  'Ravnos',
  'Salubri',
  'Toreador',
  'Tremere',
  'Tzimisce',
  'Ventrue',
  'Caitiff',
  'Thin-Blood',
] as const;

export const SheetModal: React.FC<SheetModalProps> = ({
  mode,
  sheet,
  activeSystemId,
  workspaceSheets,
  customTemplates = [],
  language = 'pt-BR',
  t = DEFAULT_MODAL_T,
  onClose,
  onCreateNewSheet,
  onLoadPreset,
  onImportJson,
  onImportSheets,
  onRestoreSnapshot,
  onCreateSnapshot,
  onListSnapshots,
  onSaveLocal,
  onPrintPdf,
  onFlushSave,
  onSaveCustomTemplate,
  onLoadCustomTemplate,
  onDeleteCustomTemplate,
}) => {
  const localizedSystems = getLocalizedSystemOptions(language);
  const dateLocale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{
    count: number;
    snapshotId: string | null;
  } | null>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'keep'>('overwrite');
  const [isImporting, setIsImporting] = useState(false);
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshotMetadata[]>([]);
  const [snapshotsExpanded, setSnapshotsExpanded] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);
  const [copiedQss, setCopiedQss] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<SystemId>(activeSystemId);
  const [selectedWodEdition, setSelectedWodEdition] = useState<'vampire-v5' | 'storyteller-v20'>(
    () => (sheet.rulePreset === 'vampire-v5' ? 'vampire-v5' : 'storyteller-v20'),
  );
  const [charName, setCharName] = useState('');
  const [secondaryTrait, setSecondaryTrait] = useState('');
  const [templateName, setTemplateName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(Boolean(mode), dialogRef, onClose, closeButtonRef);

  const refreshSnapshots = async () => {
    try {
      const listFn = onListSnapshots ?? listWorkspaceSnapshots;
      const items = await listFn();
      setSnapshots(items);
    } catch {
      // Ignore snapshot listing errors
    }
  };

  useEffect(() => {
    if (mode === 'new') {
      setSelectedSystem(activeSystemId);
      setSelectedWodEdition(sheet.rulePreset === 'vampire-v5' ? 'vampire-v5' : 'storyteller-v20');
      setCharName('');
      setSecondaryTrait('');
    } else if (mode === 'save') {
      setTemplateName(sheet.characterName || '');
    } else if (mode === 'open') {
      setImportError(null);
      setImportSuccess(null);
      void refreshSnapshots();
    }
  }, [mode, activeSystemId, sheet.characterName, sheet.rulePreset]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const contents = await Promise.all(files.map((file) => file.text()));
      const importedSheets: CharacterSheetState[] = [];

      for (const rawText of contents) {
        const result = parseAndValidateImportPayload(rawText);
        if (!result.valid) {
          const preview = result.errors.slice(0, 3).join(' | ');
          setImportError(t.t('modal.errImportSchema', { preview }));
          return;
        }
        importedSheets.push(...result.sheets);
      }

      const currentSheets =
        workspaceSheets && workspaceSheets.length > 0 ? workspaceSheets : [sheet];
      const existingIds = new Set(currentSheets.map((item) => resolveSheetRecordId(item)));
      const hasCollision = importedSheets.some((imp) =>
        existingIds.has(resolveSheetRecordId(imp)),
      );

      let createdSnapshotId: string | null = null;
      if (importMode === 'overwrite' && hasCollision) {
        const createSnap = onCreateSnapshot ?? createWorkspaceSnapshot;
        const snapshotMeta = await createSnap(currentSheets, 'pre-import-overwrite');
        createdSnapshotId = snapshotMeta.snapshotId;
        await refreshSnapshots();
      }

      if (onImportSheets) {
        await onImportSheets(importedSheets, importMode);
      } else if (onImportJson) {
        for (const imported of importedSheets) {
          onImportJson(imported);
        }
      }

      if (createdSnapshotId) {
        setImportSuccess({
          count: importedSheets.length,
          snapshotId: createdSnapshotId,
        });
      } else {
        onClose();
      }
    } catch {
      setImportError(t.t('modal.errImportRead'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    setRestoringSnapshotId(snapshotId);
    setImportError(null);
    try {
      const restoreFn = onRestoreSnapshot ?? restoreWorkspaceSnapshot;
      await restoreFn(snapshotId);
      setImportSuccess(null);
      await refreshSnapshots();
      onClose();
    } catch {
      setImportError(t.t('modal.errRestoreSnapshot'));
    } finally {
      setRestoringSnapshotId(null);
    }
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
      className="no-print print:hidden mobile-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay-backdrop)]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'new' ? t.newTitle : mode === 'open' ? t.openTitle : t.saveTitle}
        className="bento-card mobile-modal-dialog w-full max-w-lg max-h-[100dvh] overflow-y-auto overscroll-contain bg-[var(--bg-card)] shadow-[var(--shadow-modal)]"
      >
        <header className="bento-card-header sticky top-0 z-10">
          <div className="bento-card-header-title flex flex-wrap items-center gap-2 min-w-0">
            {mode !== 'new' && (
              <span className="font-mono-tech text-xs font-bold text-[var(--accent-wine)] shrink-0">
                {mode === 'open' ? t.t('modal.openTag') : t.t('modal.saveTag')}
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
                  rulePreset:
                    selectedSystem === 'wod' ? (selectedWodEdition as RulePreset) : undefined,
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
                    ...localizedSystems.filter((opt) => opt.id !== 'blank' && opt.id === activeSystemId),
                    ...localizedSystems.filter((opt) => opt.id !== 'blank' && opt.id !== activeSystemId),
                    ...localizedSystems.filter((opt) => opt.id === 'blank'),
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
                        className={`cyber-btn-outline !rounded-[var(--radius-card)] p-3 text-left flex items-center justify-between gap-3 cursor-pointer ${
                          isBlank ? 'border-dashed' : ''
                        } ${isSelected ? 'cyber-active-tint' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-bold uppercase ${
                                isSelected
                                  ? 'cyber-active-title'
                                  : 'text-[var(--ink-primary)]'
                              }`}
                            >
                              {isBlank ? t.newBlankTitle : opt.label}
                            </span>
                            {isCurrent && (
                              <span className="cyber-active-badge font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] rounded-[var(--radius-pill)] uppercase">
                                {t.newCurrentBadge}
                              </span>
                            )}
                          </div>
                          <div className="cyber-active-muted text-[11px] text-[var(--ink-muted)]">
                            {isBlank ? t.newBlankDesc : opt.description}
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`cyber-radio-ring w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            isSelected
                              ? 'border-[var(--accent-wine)] bg-[var(--accent-wine)]'
                              : 'border-[var(--border-ink)] bg-[var(--bg-card)]'
                          }`}
                        >
                          {isSelected && (
                            <span className="cyber-radio-dot w-1.5 h-1.5 rounded-full bg-[var(--ink-inverse)]" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedSystem === 'wod' && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono-tech text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    {t.t('modal.wodEditionLabel')}
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={t.t('modal.wodEditionLabel')}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    {(
                      [
                        {
                          id: 'vampire-v5' as const,
                          testId: 'new-sheet-wod-edition-v5',
                          title: t.t('modal.wodEditionV5'),
                          hint: t.t('modal.wodEditionV5Hint'),
                        },
                        {
                          id: 'storyteller-v20' as const,
                          testId: 'new-sheet-wod-edition-v20',
                          title: t.t('modal.wodEditionV20'),
                          hint: t.t('modal.wodEditionV20Hint'),
                        },
                      ] as const
                    ).map((ed) => {
                      const active = selectedWodEdition === ed.id;
                      return (
                        <button
                          key={ed.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-testid={ed.testId}
                          onClick={() => setSelectedWodEdition(ed.id)}
                          className={`cyber-btn-outline !rounded-[var(--radius-card)] p-2.5 text-left flex flex-col gap-0.5 cursor-pointer ${
                            active ? 'cyber-active-tint' : ''
                          }`}
                        >
                          <span
                            className={`font-mono-tech text-xs font-extrabold uppercase ${
                              active ? 'cyber-active-title' : 'text-[var(--ink-primary)]'
                            }`}
                          >
                            {ed.title}
                          </span>
                          <span className="cyber-active-muted font-mono-tech text-[10px] text-[var(--ink-muted)]">
                            {ed.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                      list={selectedSystem === 'wod' ? 'wod-clan-suggestions' : undefined}
                      value={secondaryTrait}
                      onChange={(e) => setSecondaryTrait(e.target.value)}
                      placeholder={
                        selectedSystem === 'wod'
                          ? 'Ventrue'
                          : selectedSystem === 'dnd5e'
                            ? 'Fighter · Half-Elf'
                            : selectedSystem === 'cyberpunk'
                              ? 'Netrunner'
                              : t.t('modal.defaultTraitPlaceholder')
                      }
                      className="cyber-input mobile-touch-input px-2.5 py-2 text-xs font-semibold w-full"
                    />
                    {selectedSystem === 'wod' && (
                      <datalist id="wod-clan-suggestions">
                        {WOD_CLAN_SUGGESTIONS.map((clan) => (
                          <option key={clan} value={clan} />
                        ))}
                      </datalist>
                    )}
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
                {localizedSystems.map((opt) => {
                  const isActive = opt.id === activeSystemId;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onLoadPreset(opt.id);
                        onClose();
                      }}
                      className={`cyber-btn-outline !rounded-[var(--radius-card)] min-h-[36px] p-3 text-left flex items-center justify-between gap-4 cursor-pointer ${
                        isActive ? 'cyber-active-tint' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-bold uppercase ${
                            isActive ? 'cyber-active-title' : 'text-[var(--ink-primary)]'
                          }`}
                        >
                          {opt.label}
                        </div>
                        <div className="cyber-active-muted text-[11px] text-[var(--ink-muted)]">{opt.description}</div>
                      </div>
                      <span
                        className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                          isActive ? 'cyber-active-title' : ''
                        }`}
                      >
                        {isActive ? t.t('modal.presetResetBtn') : t.t('modal.presetLoadBtn')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {customTemplates.length > 0 && onLoadCustomTemplate && (
                <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-2">
                  <span className="font-mono-tech text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    {t.t('modal.customTemplatesTitle')}
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {customTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onLoadCustomTemplate(tpl);
                            onClose();
                          }}
                          className="cyber-btn-outline !rounded-[var(--radius-card)] min-h-[36px] flex-1 p-2.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold uppercase truncate">{tpl.name}</div>
                            <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] uppercase">
                              {tpl.systemId} ·{' '}
                              {t.t('modal.templateBlocksCount', {
                                count: tpl.sheet.cards.length,
                              })}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-[var(--accent-wine)] shrink-0">
                            {t.t('modal.templateUseBtn')}
                          </span>
                        </button>
                        {onDeleteCustomTemplate && (
                          <button
                            type="button"
                            onClick={() => void onDeleteCustomTemplate(tpl.id)}
                            aria-label={t.t('modal.removeTemplateAria', { name: tpl.name })}
                            className="cyber-btn-outline min-h-[36px] p-2.5 text-[var(--accent-danger)] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className="inline-flex flex-wrap items-center gap-1"
                    role="group"
                    aria-label={t.t('modal.importModeAria')}
                  >
                    <button
                      type="button"
                      onClick={() => setImportMode('overwrite')}
                      className={`cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[10px] font-bold uppercase cursor-pointer ${
                        importMode === 'overwrite'
                          ? 'cyber-active-tint'
                          : 'text-[var(--ink-secondary)]'
                      }`}
                    >
                      {t.t('modal.importModeOverwrite')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('keep')}
                      className={`cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[10px] font-bold uppercase cursor-pointer ${
                        importMode === 'keep'
                          ? 'cyber-active-tint'
                          : 'text-[var(--ink-secondary)]'
                      }`}
                    >
                      {t.t('modal.importModeKeep')}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    multiple
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => fileInputRef.current?.click()}
                    className="cyber-roll-btn min-h-[36px] px-3 py-2 text-xs font-bold uppercase inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t.importBtn}</span>
                  </button>
                </div>

                {importSuccess && importSuccess.snapshotId && (
                  <div
                    role="status"
                    data-testid="import-snapshot-banner"
                    className="rounded-[var(--radius-card)] border-2 border-[var(--border-ink)] bg-[var(--accent-cream-badge)] px-2.5 py-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck
                        className="w-4 h-4 text-[var(--accent-wine)] shrink-0"
                        aria-hidden="true"
                      />
                      <span className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)]">
                        {t.t('modal.snapshotSavedBanner')}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="undo-import-btn"
                      disabled={restoringSnapshotId === importSuccess.snapshotId}
                      onClick={() => void handleRestoreSnapshot(importSuccess.snapshotId!)}
                      className="cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] border-[var(--accent-wine)] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>{t.t('modal.undoImportBtn')}</span>
                    </button>
                  </div>
                )}

                {importError && (
                  <div
                    role="alert"
                    className="rounded-[var(--radius-card)] font-mono-tech text-[11px] font-bold text-[var(--accent-danger)] border-2 border-[var(--accent-danger)] bg-[var(--bg-card)] px-2.5 py-1.5"
                  >
                    {importError}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] pb-[max(4px,env(safe-area-inset-bottom,0px))] flex flex-col gap-2">
                <button
                  type="button"
                  aria-expanded={snapshotsExpanded}
                  data-testid="snapshots-toggle-btn"
                  onClick={() => setSnapshotsExpanded((prev) => !prev)}
                  className="cyber-btn-outline min-h-[36px] px-2.5 py-1.5 w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="font-mono-tech text-[11px] font-bold uppercase tracking-wider text-[var(--ink-primary)]">
                    {t.t('modal.snapshotsToggle', { count: snapshots.length })}
                  </span>
                  {snapshotsExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" aria-hidden="true" />
                  )}
                </button>

                {snapshotsExpanded && (
                  <div className="flex flex-col gap-1.5">
                    {snapshots.length === 0 ? (
                      <div className="font-mono-tech text-[11px] text-[var(--ink-muted)] px-1 py-1">
                        {t.t('modal.snapshotsEmpty')}
                      </div>
                    ) : (
                      snapshots.map((snap) => (
                        <div
                          key={snap.snapshotId}
                          data-testid={`snapshot-item-${snap.snapshotId}`}
                          className="rounded-[var(--radius-card)] border-2 border-[var(--border-ink)] bg-[var(--bg-card-alt)] px-2.5 py-1.5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] truncate">
                              {new Date(snap.createdAt).toLocaleString(dateLocale)}
                            </div>
                            <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] uppercase">
                              {snap.sheetCount}{' '}
                              {snap.sheetCount === 1
                                ? t.t('modal.snapshotSheetSingular')
                                : t.t('modal.snapshotSheetPlural')}{' '}
                              ·{' '}
                              {snap.reason === 'pre-import-overwrite'
                                ? t.t('modal.snapshotReasonPreImport')
                                : t.t('modal.snapshotReasonManual')}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={restoringSnapshotId === snap.snapshotId}
                            onClick={() => void handleRestoreSnapshot(snap.snapshotId)}
                            className="cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" aria-hidden="true" />
                            <span>{t.t('modal.restoreBtn')}</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    void Promise.resolve(onSaveLocal()).finally(() => onClose());
                  }}
                  className="cyber-roll-btn !rounded-[var(--radius-card)] p-3 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold uppercase">{t.saveLocalTitle}</div>
                    <div className="text-[11px] opacity-80">{t.saveLocalDesc}</div>
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap shrink-0">OK ↗</span>
                </button>

                {onSaveCustomTemplate && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = templateName.trim() || sheet.characterName || 'TEMPLATE';
                      void Promise.resolve(onSaveCustomTemplate(clean)).finally(() => onClose());
                    }}
                    className="cyber-btn-outline !rounded-[var(--radius-card)] p-3 flex flex-col gap-2 bg-[var(--bg-card-alt)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]">
                        {t.t('modal.saveTemplateTitle')}
                      </span>
                      <BookmarkPlus className="w-3.5 h-3.5 text-[var(--accent-wine)] shrink-0" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder={t.t('modal.saveTemplatePlaceholder')}
                        className="cyber-input min-h-[36px] px-2 py-1 text-xs font-semibold flex-1 min-w-0"
                      />
                      <button
                        type="submit"
                        className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[11px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t.t('modal.saveTemplateBtn')}
                      </button>
                    </div>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void onFlushSave?.();
                    onClose();
                    window.requestAnimationFrame(() => onPrintPdf());
                  }}
                  className="cyber-btn-outline !rounded-[var(--radius-card)] p-3 text-left flex items-center justify-between gap-4 bg-[var(--accent-cream-badge)] cursor-pointer"
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
                  onClick={() => {
                    void Promise.resolve(onFlushSave?.()).finally(() => {
                      handleDownload(
                        t.t('modal.downloadJsonFilename'),
                        JSON.stringify(sheet, null, 2),
                        'application/json',
                      );
                    });
                  }}
                  className="cyber-btn-outline !rounded-[var(--radius-card)] p-3 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold uppercase">{t.downloadJsonTitle}</div>
                    <div className="text-[11px] text-[var(--ink-muted)]">{t.downloadJsonDesc}</div>
                  </div>
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void Promise.resolve(onFlushSave?.()).finally(() => {
                      handleDownload(
                        t.t('modal.downloadHtmlFilename'),
                        generateSingleFilePureHtml(sheet, language),
                        'text/html',
                      );
                    });
                  }}
                  className="cyber-btn-outline !rounded-[var(--radius-card)] p-3 text-left flex items-center justify-between gap-4 bg-[var(--accent-cream-badge)] cursor-pointer"
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

              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono-tech text-[11px] text-[var(--ink-muted)]">
                  {t.t('modal.qssTokensTitle')}
                </span>
                <button
                  type="button"
                  onClick={handleCopyQss}
                  className="cyber-btn-outline min-h-[36px] px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
