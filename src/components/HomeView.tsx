import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Copy,
  FileJson,
  FolderOpen,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AppLanguage, createTranslator } from '../core/i18n';
import type { RulePreset, WodEdition } from '../core/sheetModel';
import { ThemeMode } from '../utils/theme';
import { useFocusTrap } from '../utils/useFocusTrap';
import {
  getNextClanPresetForEdition,
  resolveWodClanSelection,
  WodClanField,
  WodEditionFieldset,
} from './SheetModal';
import { ThemeSelector } from './ThemeSelector';

export interface HomeSheetItem {
  id: string;
  name: string;
  systemId: string;
  updatedAt: string;
}

export interface HomeSystemItem {
  id: string;
  name: string;
  description: string;
}

export interface HomeViewProps {
  sheets: HomeSheetItem[];
  activeSheet?: HomeSheetItem;
  systems: HomeSystemItem[];
  language?: AppLanguage;
  theme?: ThemeMode;
  onChangeTheme?: (theme: ThemeMode) => void;
  onContinueSheet: () => void;
  onSelectSheet: (id: string) => void;
  onCreateSheet: (
    systemId: string,
    customName?: string,
    rulePreset?: RulePreset,
    clan?: string,
  ) => void;
  onDuplicateSheet: (id: string) => void;
  onDeleteSheet: (id: string) => void;
  onOpenImportExport: () => void;
  onOpenRules: () => void;
}

function getDateLocale(language: AppLanguage): string {
  if (language === 'en') return 'en-US';
  if (language === 'es') return 'es-ES';
  return 'pt-BR';
}

function formatUpdatedAt(value: string, language: AppLanguage): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value.trim() || '—';
  }
  try {
    return new Intl.DateTimeFormat(getDateLocale(language), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed));
  } catch {
    return value;
  }
}

function resolveSystemName(systemId: string, systems: HomeSystemItem[]): string {
  const found = systems.find((sys) => sys.id === systemId);
  return found ? found.name : systemId.toUpperCase();
}

export const HomeView: React.FC<HomeViewProps> = ({
  sheets,
  activeSheet,
  systems,
  language = 'pt-BR',
  theme = 'light',
  onChangeTheme,
  onContinueSheet,
  onSelectSheet,
  onCreateSheet,
  onDuplicateSheet,
  onDeleteSheet,
  onOpenImportExport,
  onOpenRules,
}) => {
  const t = useMemo(() => createTranslator(language), [language]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystemFilter, setSelectedSystemFilter] = useState<string>('all');
  const [customSheetName, setCustomSheetName] = useState('');
  const [wodModalOpen, setWodModalOpen] = useState(false);
  const [wodEdition, setWodEdition] = useState<WodEdition>('vampire-v5');
  const [wodClanPreset, setWodClanPreset] = useState('');
  const [wodCustomClan, setWodCustomClan] = useState('');
  const [wodCharName, setWodCharName] = useState('');
  const wodDialogRef = useRef<HTMLDivElement>(null);
  const wodCloseBtnRef = useRef<HTMLButtonElement>(null);
  const wodOverlayPointerDownRef = useRef(false);

  const closeWodModal = () => {
    setWodModalOpen(false);
  };

  useFocusTrap(wodModalOpen, wodDialogRef, closeWodModal, wodCloseBtnRef);

  const openWodModal = (initialEdition: WodEdition) => {
    setWodEdition(initialEdition);
    setWodClanPreset('');
    setWodCustomClan('');
    setWodCharName('');
    setWodModalOpen(true);
  };

  const handleSelectWodEdition = (nextEdition: WodEdition) => {
    setWodEdition(nextEdition);
    setWodClanPreset((prev) => getNextClanPresetForEdition(nextEdition, prev));
  };

  const handleConfirmWodCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = wodCharName.trim();
    const resolvedClan = resolveWodClanSelection(
      wodEdition,
      wodClanPreset,
      wodCustomClan,
      language,
    );
    onCreateSheet(
      'wod',
      trimmedName.length > 0 ? trimmedName : undefined,
      wodEdition,
      resolvedClan.length > 0 ? resolvedClan : undefined,
    );
    setWodModalOpen(false);
  };

  const customSystemId = useMemo(() => {
    const customMatch = systems.find((sys) => sys.id === 'blank' || sys.id === 'custom');
    return customMatch?.id ?? 'blank';
  }, [systems]);

  const filterSystemOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string }> = [];

    for (const sys of systems) {
      if (!seen.has(sys.id)) {
        seen.add(sys.id);
        list.push({ id: sys.id, label: sys.name });
      }
    }

    for (const sheet of sheets) {
      if (!seen.has(sheet.systemId)) {
        seen.add(sheet.systemId);
        list.push({ id: sheet.systemId, label: sheet.systemId.toUpperCase() });
      }
    }

    return list;
  }, [systems, sheets]);

  const filteredSheets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return sheets.filter((item) => {
      const matchesSystem =
        selectedSystemFilter === 'all' || item.systemId === selectedSystemFilter;
      const matchesName =
        normalizedQuery.length === 0 || item.name.toLowerCase().includes(normalizedQuery);
      return matchesSystem && matchesName;
    });
  }, [sheets, searchQuery, selectedSystemFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedSystemFilter !== 'all';

  const handleCreateCustomSheet = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSheetName.trim();
    onCreateSheet(customSystemId, trimmed.length > 0 ? trimmed : undefined);
    setCustomSheetName('');
  };

  return (
    <>
    <div className="mx-auto w-full max-w-[1320px] space-y-6 pb-8">
      {onChangeTheme && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 py-2 shadow-[var(--shadow-btn)]">
          <span className="font-mono-tech text-[11px] font-bold tracking-[0.14em] text-[var(--accent-primary)] uppercase">
            {t('home.themeBadge')}
          </span>
          <ThemeSelector theme={theme} language={language} onChangeTheme={onChangeTheme} />
        </div>
      )}

      {/* 1. Active Session */}
      <section className="bento-card" aria-labelledby="home-active-session-heading">
        <header className="bento-card-header">
          <div className="bento-card-header-title flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="font-mono-tech shrink-0 text-[11px] font-bold tracking-[0.14em] text-[var(--accent-wine)]">
              {t('home.sessionTag')}
            </span>
            <h2
              id="home-active-session-heading"
              className="font-display text-lg leading-tight font-extrabold tracking-wide text-[var(--ink-primary)] uppercase break-words sm:text-xl"
            >
              {t('home.sessionHeading')}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {activeSheet && (
              <span className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--accent-wine)] bg-[var(--accent-wine-soft)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase whitespace-nowrap">
                {t('home.inUseBadge')}
              </span>
            )}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-5">
          {activeSheet ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--border-ink)] bg-[var(--accent-cream-badge)] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[var(--ink-primary)] uppercase">
                    {resolveSystemName(activeSheet.systemId, systems)}
                  </span>
                  <span className="font-mono-tech text-[11px] font-medium text-[var(--ink-muted)]">
                    {t('home.updatedAt', { date: formatUpdatedAt(activeSheet.updatedAt, language) })}
                  </span>
                </div>

                <h3 className="font-display text-2xl leading-tight font-extrabold tracking-wide text-[var(--ink-primary)] uppercase break-words sm:text-3xl">
                  {activeSheet.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={onContinueSheet}
                className="cyber-roll-btn flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold tracking-[0.12em] uppercase sm:w-auto cursor-pointer"
              >
                <span>{t('home.continueSheet')}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-dashed border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-mono-tech text-xs font-bold tracking-wider text-[var(--ink-primary)] uppercase">
                  {t('home.noActiveTitle')}
                </p>
                <p className="text-sm text-[var(--ink-secondary)]">
                  {t('home.noActiveDesc')}
                </p>
              </div>
              {sheets.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectSheet(sheets[0].id)}
                  className="cyber-btn-outline flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
                >
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('home.openLastSheet')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. New Character */}
      <section className="bento-card" aria-labelledby="home-new-character-heading">
        <header className="bento-card-header">
          <div className="bento-card-header-title flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="font-mono-tech shrink-0 text-[11px] font-bold tracking-[0.14em] text-[var(--accent-wine)]">
              {t('home.newCharTag')}
            </span>
            <h2
              id="home-new-character-heading"
              className="font-display text-lg leading-tight font-extrabold tracking-wide text-[var(--ink-primary)] uppercase break-words sm:text-xl"
            >
              {t('home.newCharHeading')}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 p-4 min-[560px]:grid-cols-2 lg:grid-cols-3 sm:p-5">
          {systems.map((sys) => (
            <article
              key={sys.id}
              className="flex flex-col justify-between gap-4 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-[var(--border-color)] bg-[var(--bg-input)] p-4 transition-colors hover:bg-[var(--bg-card-alt)]"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--border-ink)] bg-[var(--accent-cream-badge)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase">
                    SYS::{sys.id}
                  </span>
                </div>
                <h3 className="font-display text-lg leading-snug font-extrabold tracking-wide text-[var(--ink-primary)] uppercase">
                  {sys.name}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {sys.description}
                </p>
              </div>

              {sys.id === 'wod' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="home-create-wod-v5"
                    onClick={() => openWodModal('vampire-v5')}
                    className="cyber-roll-btn flex min-h-[40px] w-full items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t('home.createWodV5')}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="home-create-wod-v20"
                    onClick={() => openWodModal('storyteller-v20')}
                    className="cyber-btn-outline flex min-h-[40px] w-full items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t('home.createWodV20')}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onCreateSheet(sys.id)}
                  className="cyber-btn-outline flex min-h-[40px] w-full items-center justify-center gap-2 px-3 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('home.createInSystem', { system: sys.id.toUpperCase() })}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              )}
            </article>
          ))}

          {/* Dashed Custom Sheet card */}
          <form
            onSubmit={handleCreateCustomSheet}
            className="flex flex-col justify-between gap-4 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-dashed border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-tech inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--accent-wine)] bg-[var(--accent-wine-soft)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {t('home.customGridTag')}
                </span>
              </div>
              <h3 className="font-display text-lg leading-snug font-extrabold tracking-wide text-[var(--ink-primary)] uppercase">
                {t('home.customSheetTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                {t('home.customSheetDesc')}
              </p>

              <div className="pt-1">
                <label
                  htmlFor="home-custom-sheet-name"
                  className="font-mono-tech mb-1 block text-[10px] font-bold tracking-wider text-[var(--ink-muted)] uppercase"
                >
                  {t('home.customNameLabel')}
                </label>
                <input
                  id="home-custom-sheet-name"
                  type="text"
                  value={customSheetName}
                  onChange={(e) => setCustomSheetName(e.target.value)}
                  placeholder={t('home.customNamePlaceholder')}
                  className="cyber-input min-h-[38px] w-full px-3 py-2 text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="cyber-roll-btn flex min-h-[40px] w-full items-center justify-center gap-2 px-3 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('home.customSheetBtn')}</span>
            </button>
          </form>
        </div>
      </section>

      {/* 3. Saved Characters */}
      <section className="bento-card" aria-labelledby="home-my-characters-heading">
        <header className="bento-card-header flex-wrap">
          <div className="bento-card-header-title flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="font-mono-tech shrink-0 text-[11px] font-bold tracking-[0.14em] text-[var(--accent-wine)]">
              {t('home.myCharsTag')}
            </span>
            <h2
              id="home-my-characters-heading"
              className="font-display text-lg leading-tight font-extrabold tracking-wide text-[var(--ink-primary)] uppercase break-words sm:text-xl"
            >
              {t('home.myCharsHeading')}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--border-ink)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-primary)]">
              {filteredSheets.length} / {sheets.length}
            </span>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
            </div>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          {/* Search + filter */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('home.searchPlaceholder')}
                aria-label={t('home.searchAria')}
                className="cyber-input min-h-[40px] w-full py-2 pr-9 pl-9 text-sm"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('home.clearSearchAria')}
                  className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={t('home.filterBySystemAria')}
            >
              <button
                type="button"
                onClick={() => setSelectedSystemFilter('all')}
                aria-pressed={selectedSystemFilter === 'all'}
                className={`font-mono-tech min-h-[36px] rounded-[var(--radius-control)] border-[1.5px] px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                  selectedSystemFilter === 'all'
                    ? 'border-[var(--border-ink)] bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                    : 'border-[var(--border-ink)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {t('home.allFilter', { count: sheets.length })}
              </button>

              {filterSystemOptions.map((opt) => {
                const isActive = selectedSystemFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedSystemFilter(opt.id)}
                    aria-pressed={isActive}
                    className={`font-mono-tech min-h-[36px] rounded-[var(--radius-control)] border-[1.5px] px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[var(--border-ink)] bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                        : 'border-[var(--border-ink)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Responsive Grid */}
          {filteredSheets.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border-[length:var(--border-width)] border-dashed border-[var(--border-color)] bg-[var(--bg-card-alt)] p-6 text-center">
              {sheets.length === 0 ? (
                <div className="mx-auto max-w-md space-y-2">
                  <p className="font-mono-tech text-xs font-bold tracking-wider text-[var(--ink-primary)] uppercase">
                    {t('home.emptyVaultTitle')}
                  </p>
                  <p className="text-sm text-[var(--ink-secondary)]">
                    {t('home.emptyVaultDesc')}
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-md space-y-3">
                  <p className="font-mono-tech text-xs font-bold tracking-wider text-[var(--ink-primary)] uppercase">
                    {t('home.emptyFilterTitle')}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSystemFilter('all');
                      }}
                      className="cyber-btn-outline inline-flex min-h-[38px] items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('home.clearFilters')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-3">
              {filteredSheets.map((item) => {
                const isCurrentActive = activeSheet?.id === item.id;
                return (
                  <article
                    key={item.id}
                    className={`flex flex-col justify-between gap-4 rounded-[var(--radius-card)] border-[length:var(--border-width)] p-4 transition-colors ${
                      isCurrentActive
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-card-alt)] shadow-[var(--shadow-btn)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)]'
                    }`}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--border-ink)] bg-[var(--accent-cream-badge)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--ink-primary)] uppercase">
                          {resolveSystemName(item.systemId, systems)}
                        </span>

                        {isCurrentActive && (
                          <span className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--accent-wine)] bg-[var(--accent-wine-soft)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase">
                            {t('home.activeBadge')}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-xl leading-tight font-extrabold tracking-wide text-[var(--ink-primary)] uppercase break-words">
                        {item.name}
                      </h3>

                      <p className="font-mono-tech text-[11px] text-[var(--ink-muted)]">
                        {t('home.updatedShort', { date: formatUpdatedAt(item.updatedAt, language) })}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectSheet(item.id)}
                        aria-label={t('home.openSheetAria', { name: item.name })}
                        className="cyber-roll-btn flex min-h-[38px] flex-1 min-w-[82px] items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase cursor-pointer whitespace-nowrap"
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{t('home.openBtn')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDuplicateSheet(item.id)}
                        aria-label={t('home.duplicateSheetAria', { name: item.name })}
                        className="cyber-btn-outline flex min-h-[38px] flex-1 min-w-[92px] items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase cursor-pointer whitespace-nowrap"
                      >
                        <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{t('home.duplicateBtn')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteSheet(item.id)}
                        aria-label={t('home.deleteSheetAria', { name: item.name })}
                        className="font-mono-tech flex min-h-[38px] flex-1 min-w-[86px] items-center justify-center gap-1 rounded-[var(--radius-control)] border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[11px] font-bold tracking-wider text-[var(--accent-danger)] uppercase transition-colors hover:border-[var(--accent-danger)] hover:bg-[var(--accent-danger-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-wine)] cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{t('home.deleteBtn')}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. Portability & Rules */}
      <section className="bento-card" aria-labelledby="home-portability-rules-heading">
        <header className="bento-card-header">
          <div className="bento-card-header-title flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="font-mono-tech shrink-0 text-[11px] font-bold tracking-[0.14em] text-[var(--accent-wine)]">
              {t('home.portabilityTag')}
            </span>
            <h2
              id="home-portability-rules-heading"
              className="font-display text-lg leading-tight font-extrabold tracking-wide text-[var(--ink-primary)] uppercase break-words sm:text-xl"
            >
              {t('home.portabilityHeading')}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 sm:p-5">
          <div className="flex flex-col justify-between gap-4 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-[var(--border-color)] bg-[var(--bg-input)] p-4">
            <div className="space-y-1.5">
              <span className="font-mono-tech text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase">
                {t('home.localPortabilityTag')}
              </span>
              <h3 className="font-display text-lg font-extrabold tracking-wide text-[var(--ink-primary)] uppercase">
                {t('home.exportRestoreTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                {t('home.exportRestoreDesc')}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenImportExport}
              className="cyber-btn-outline flex min-h-[42px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-bold tracking-wider uppercase sm:w-auto cursor-pointer"
            >
              <FileJson className="h-4 w-4 text-[var(--accent-wine)]" aria-hidden="true" />
              <span>{t('home.importBackupBtn')}</span>
            </button>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-[var(--border-color)] bg-[var(--bg-input)] p-4">
            <div className="space-y-1.5">
              <span className="font-mono-tech text-[10px] font-bold tracking-wider text-[var(--accent-wine)] uppercase">
                {t('home.offlineIndexTag')}
              </span>
              <h3 className="font-display text-lg font-extrabold tracking-wide text-[var(--ink-primary)] uppercase">
                {t('home.localRulesLibTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                {t('home.localRulesLibDesc')}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenRules}
              className="cyber-btn-outline flex min-h-[42px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-bold tracking-wider uppercase sm:w-auto cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-[var(--accent-wine)]" aria-hidden="true" />
              <span>{t('home.rulesPdfBtn')}</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    {wodModalOpen && (
      <div
        className="no-print print:hidden mobile-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay-backdrop)]"
        role="presentation"
        onPointerDown={(e) => {
          wodOverlayPointerDownRef.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (wodOverlayPointerDownRef.current && e.target === e.currentTarget) {
            closeWodModal();
          }
          wodOverlayPointerDownRef.current = false;
        }}
      >
        <div
          ref={wodDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-wod-modal-title"
          data-testid="home-wod-modal"
          className="bento-card mobile-modal-dialog w-full max-w-md max-h-[100dvh] overflow-y-auto overscroll-contain bg-[var(--bg-card)] shadow-[var(--shadow-modal)]"
        >
          <header className="bento-card-header sticky top-0 z-10">
            <div className="bento-card-header-title flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-mono-tech text-xs font-bold text-[var(--accent-wine)] shrink-0">
                {t('home.wodModalTag')}
              </span>
              <h2
                id="home-wod-modal-title"
                className="font-display text-lg sm:text-xl font-extrabold uppercase leading-tight text-[var(--ink-primary)]"
              >
                {t('home.wodModalTitle')}
              </h2>
            </div>
            <button
              ref={wodCloseBtnRef}
              type="button"
              onClick={closeWodModal}
              aria-label={t('modal.closeAria')}
              className="cyber-btn-outline mobile-touch-stepper min-h-[36px] min-w-[36px] w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </header>

          <div className="p-4 flex flex-col gap-3">
            <p className="font-mono-tech text-xs leading-relaxed text-[var(--ink-secondary)]">
              {t('home.wodModalSubtitle')}
            </p>

            <form
              aria-labelledby="home-wod-modal-title"
              onSubmit={handleConfirmWodCreate}
              className="flex flex-col gap-4"
            >
              <WodEditionFieldset
                edition={wodEdition}
                radioGroupName="homeWodEdition"
                testIdPrefix="home-wod-edition"
                t={t}
                onSelectEdition={handleSelectWodEdition}
              />

              <WodClanField
                edition={wodEdition}
                clanPreset={wodClanPreset}
                customClan={wodCustomClan}
                language={language}
                selectId="home-wod-clan-select"
                selectTestId="home-wod-clan-select"
                hintId="home-wod-clan-hint"
                customInputId="home-wod-clan-custom"
                customTestId="home-wod-clan-custom-input"
                t={t}
                onChangeClanPreset={setWodClanPreset}
                onChangeCustomClan={setWodCustomClan}
              />

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="home-wod-char-name"
                  className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('modal.newCharNameOptionalLabel')}
                </label>
                <input
                  id="home-wod-char-name"
                  name="characterName"
                  data-testid="home-wod-name-input"
                  type="text"
                  value={wodCharName}
                  onChange={(e) => setWodCharName(e.target.value)}
                  placeholder={wodEdition === 'vampire-v5' ? 'Nadia Voss' : 'Julian Cross'}
                  enterKeyHint="done"
                  className="cyber-input mobile-touch-input min-h-[40px] px-2.5 py-2 text-base sm:text-xs font-semibold w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeWodModal}
                  className="cyber-btn-outline min-h-[40px] px-3.5 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
                >
                  {t('home.wodModalCancel')}
                </button>
                <button
                  type="submit"
                  data-testid="home-wod-submit-btn"
                  className="cyber-roll-btn min-h-[40px] flex-1 sm:flex-initial px-4 py-2 text-xs font-bold tracking-wider uppercase cursor-pointer"
                >
                  {t('modal.createAction')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default HomeView;
