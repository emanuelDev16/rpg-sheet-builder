import React, { useId, useMemo, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { AppLanguage, AppTranslations } from '../core/i18n';
import type {
  HavenEntry,
  MeritFlawEntry,
  MeritFlawKind,
  TouchstoneEntry,
} from '../core/sheetModel';
import {
  havenMatchesQuery,
  meritFlawMatchesQuery,
  normalizeSearchText,
  touchstoneMatchesQuery,
} from '../core/sheetSearch';
import {
  getAdvantagesForEdition,
  getFlawsForEdition,
  getHavenTraitsForEdition,
  type WodAdvantageCatalogEntry,
  type WodCatalogEdition,
} from '../core/wodAdvantagesCatalog';
import { normalizeCatalogText } from '../core/wodSkillsCatalog';
import { DotRating } from './DotRating';

export interface WodStructuredBlocksProps {
  edition: WodCatalogEdition;
  cardTitle?: string;
  cardCode?: string;
  searchQuery?: string;
  touchstones: readonly TouchstoneEntry[];
  meritsFlaws: readonly MeritFlawEntry[];
  havens: readonly HavenEntry[];
  t: AppTranslations['cards'];
  onAddTouchstone?: (entry: TouchstoneEntry) => void;
  onUpdateTouchstone?: (id: string, patch: Partial<Omit<TouchstoneEntry, 'id'>>) => void;
  onRemoveTouchstone?: (id: string) => void;
  onAddMeritFlaw?: (entry: MeritFlawEntry) => void;
  onUpdateMeritFlaw?: (id: string, patch: Partial<Omit<MeritFlawEntry, 'id'>>) => void;
  onRemoveMeritFlaw?: (id: string) => void;
  onAddHaven?: (entry: HavenEntry) => void;
  onUpdateHaven?: (id: string, patch: Partial<Omit<HavenEntry, 'id'>>) => void;
  onRemoveHaven?: (id: string) => void;
}

function makeUid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

interface ConfirmRemoveControlProps {
  id: string;
  pendingId: string | null;
  targetLabel: string;
  testIdPrefix: string;
  t: AppTranslations['cards'];
  onRequest: (id: string) => void;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

const ConfirmRemoveControl: React.FC<ConfirmRemoveControlProps> = ({
  id,
  pendingId,
  targetLabel,
  testIdPrefix,
  t,
  onRequest,
  onConfirm,
  onCancel,
}) => {
  const isConfirming = pendingId === id;
  if (isConfirming) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          data-testid={`${testIdPrefix}-confirm-remove-${id}`}
          aria-label={`${t.t('cards.structured.confirmRemoveBtn')} ${targetLabel}`}
          onClick={() => onConfirm(id)}
          className="wod-structured-danger-btn font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-extrabold uppercase cursor-pointer"
        >
          {t.t('cards.structured.confirmRemoveBtn')}
        </button>
        <button
          type="button"
          data-testid={`${testIdPrefix}-cancel-remove-${id}`}
          aria-label={`${t.t('cards.structured.cancelBtn')} ${targetLabel}`}
          onClick={onCancel}
          className="cyber-btn-outline min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
        >
          {t.t('cards.structured.cancelBtn')}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={`${testIdPrefix}-remove-${id}`}
      aria-label={`${t.t('cards.structured.removeBtn')} ${targetLabel}`}
      onClick={() => onRequest(id)}
      className="cyber-btn-outline min-h-[36px] min-w-[36px] px-2 py-1 text-[10px] font-bold uppercase inline-flex items-center justify-center gap-1 shrink-0 cursor-pointer"
    >
      <Trash2 className="w-3.5 h-3.5 text-[var(--accent-danger)]" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{t.t('cards.structured.removeBtn')}</span>
    </button>
  );
};

function catalogEntryMatches(entry: WodAdvantageCatalogEntry, normQuery: string): boolean {
  if (!normQuery) return true;
  return [
    entry.id,
    entry.varName,
    entry.name['pt-BR'],
    entry.name.en,
    entry.name.es,
    entry.summary['pt-BR'],
    entry.summary.en,
    entry.summary.es,
    ...(entry.aliases ?? []),
  ]
    .map(normalizeCatalogText)
    .some((token) => token.includes(normQuery));
}

export const WodStructuredBlocks: React.FC<WodStructuredBlocksProps> = ({
  edition,
  cardTitle = '',
  cardCode = '',
  searchQuery = '',
  touchstones,
  meritsFlaws,
  havens,
  t,
  onAddTouchstone,
  onUpdateTouchstone,
  onRemoveTouchstone,
  onAddMeritFlaw,
  onUpdateMeritFlaw,
  onRemoveMeritFlaw,
  onAddHaven,
  onUpdateHaven,
  onRemoveHaven,
}) => {
  const lang: AppLanguage = t.language ?? 'pt-BR';
  const baseId = useId();

  const [pendingRemoveTouchstoneId, setPendingRemoveTouchstoneId] = useState<string | null>(null);
  const [pendingRemoveMfId, setPendingRemoveMfId] = useState<string | null>(null);
  const [pendingRemoveHavenId, setPendingRemoveHavenId] = useState<string | null>(null);

  const [mfFilter, setMfFilter] = useState<'all' | MeritFlawKind>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<MeritFlawKind>('merit');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [customMfName, setCustomMfName] = useState('');
  const [customMfRating, setCustomMfRating] = useState(1);

  const normSearch = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);
  const headerMatchesSearch = useMemo(
    () =>
      Boolean(normSearch) &&
      (normalizeSearchText(cardTitle).includes(normSearch) ||
        normalizeSearchText(cardCode).includes(normSearch)),
    [normSearch, cardTitle, cardCode],
  );
  const applyItemSearchFilter = Boolean(normSearch) && !headerMatchesSearch;

  const touchstonesHeadingMatches =
    applyItemSearchFilter &&
    normalizeSearchText(t.t('cards.structured.touchstonesHeading')).includes(normSearch);
  const meritsFlawsHeadingMatches =
    applyItemSearchFilter &&
    normalizeSearchText(t.t('cards.structured.meritsFlawsHeading')).includes(normSearch);
  const havensHeadingMatches =
    applyItemSearchFilter &&
    normalizeSearchText(t.t('cards.structured.havensHeading')).includes(normSearch);

  const visibleTouchstones = useMemo(() => {
    if (!applyItemSearchFilter || touchstonesHeadingMatches) return touchstones;
    return touchstones.filter((ts) => touchstoneMatchesQuery(ts, normSearch));
  }, [applyItemSearchFilter, touchstonesHeadingMatches, touchstones, normSearch]);

  const { meritsTotal, flawsTotal } = useMemo(() => {
    let merits = 0;
    let flaws = 0;
    for (const item of meritsFlaws) {
      const val = Number.isFinite(item.rating) ? Math.max(1, Math.min(5, Math.round(item.rating))) : 1;
      if (item.kind === 'flaw') flaws += val;
      else merits += val;
    }
    return { meritsTotal: merits, flawsTotal: flaws };
  }, [meritsFlaws]);

  const visibleMeritsFlaws = useMemo(() => {
    const byKind =
      mfFilter === 'all' ? meritsFlaws : meritsFlaws.filter((item) => item.kind === mfFilter);
    if (!applyItemSearchFilter || meritsFlawsHeadingMatches) return byKind;
    return byKind.filter((item) => meritFlawMatchesQuery(item, normSearch, edition));
  }, [
    mfFilter,
    meritsFlaws,
    applyItemSearchFilter,
    meritsFlawsHeadingMatches,
    edition,
    normSearch,
  ]);

  const visibleHavens = useMemo(() => {
    if (!applyItemSearchFilter || havensHeadingMatches) return havens;
    return havens.filter((haven) => havenMatchesQuery(haven, normSearch, edition));
  }, [applyItemSearchFilter, havensHeadingMatches, havens, edition, normSearch]);

  const catalogOptions = useMemo(() => {
    const normQ = normalizeCatalogText(catalogQuery);
    if (pickerKind === 'flaw') {
      return getFlawsForEdition(edition).filter((entry) => catalogEntryMatches(entry, normQ));
    }
    const advantages = [...getAdvantagesForEdition(edition)].sort((a, b) => {
      if (a.group !== b.group) return a.group === 'merit' ? -1 : 1;
      return a.name[lang].localeCompare(b.name[lang]);
    });
    return advantages.filter((entry) => catalogEntryMatches(entry, normQ));
  }, [pickerKind, edition, catalogQuery, lang]);

  const havenTraitGroups = useMemo(() => {
    return {
      merits: getHavenTraitsForEdition(edition, 'merit'),
      flaws: getHavenTraitsForEdition(edition, 'flaw'),
    };
  }, [edition]);

  const handleAddCustomMeritFlaw = () => {
    const clean = customMfName.trim();
    if (!clean) return;
    onAddMeritFlaw?.({
      id: makeUid('mf'),
      kind: pickerKind,
      name: clean,
      rating: customMfRating,
    });
    setCustomMfName('');
    setCustomMfRating(1);
  };

  const pickerPanelId = `${baseId}-mf-picker`;
  const catalogSearchId = `${baseId}-mf-catalog-search`;
  const customMfNameId = `${baseId}-mf-custom-name`;
  const customMfRatingId = `${baseId}-mf-custom-rating`;

  const showTouchstonesBlock =
    edition === 'vampire-v5' &&
    (!applyItemSearchFilter || touchstonesHeadingMatches || visibleTouchstones.length > 0);
  const showMeritsFlawsBlock =
    !applyItemSearchFilter || meritsFlawsHeadingMatches || visibleMeritsFlaws.length > 0;
  const showHavensBlock =
    !applyItemSearchFilter || havensHeadingMatches || visibleHavens.length > 0;

  return (
    <div className="wod-structured-blocks flex flex-col gap-4" data-testid="wod-structured-blocks">
      {/* BLOCK 1: Touchstones & Convictions (V5 only) */}
      {showTouchstonesBlock && (
        <section
          data-testid="wod-touchstones-block"
          aria-labelledby={`${baseId}-touchstones-heading`}
          className="wod-structured-panel p-3 flex flex-col gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3
                id={`${baseId}-touchstones-heading`}
                className="font-mono-tech text-xs font-extrabold uppercase tracking-wider text-[var(--accent-wine)]"
              >
                {t.t('cards.structured.touchstonesHeading')}
              </h3>
              <span
                data-testid="wod-touchstones-counter"
                className="wod-structured-summary-pill font-mono-tech text-[10px] font-extrabold px-2 py-0.5 tabular-nums uppercase"
              >
                {t.t('cards.structured.touchstonesCounter', { count: touchstones.length })}
              </span>
            </div>
            <button
              type="button"
              data-testid="wod-add-touchstone-btn"
              onClick={() =>
                onAddTouchstone?.({
                  id: makeUid('ts'),
                  conviction: '',
                  touchstone: '',
                  notes: '',
                })
              }
              className="cyber-roll-btn min-h-[36px] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap cursor-pointer"
            >
              {t.t('cards.structured.touchstonesAddBtn')}
            </button>
          </div>

          <p className="font-mono-tech text-[11px] text-[var(--ink-secondary)]">
            {t.t('cards.structured.touchstonesHint')}
          </p>

          {visibleTouchstones.length === 0 ? (
            <p
              data-testid="wod-touchstones-empty"
              className="font-mono-tech text-[11px] text-[var(--ink-muted)] py-1"
            >
              {t.t('cards.structured.touchstonesEmpty')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleTouchstones.map((entry, idx) => {
                const convId = `${baseId}-ts-conv-${entry.id}`;
                const stoneId = `${baseId}-ts-stone-${entry.id}`;
                const notesId = `${baseId}-ts-notes-${entry.id}`;
                return (
                  <div
                    key={entry.id}
                    data-testid={`wod-touchstone-item-${entry.id}`}
                    className="wod-structured-item p-2.5 flex flex-col gap-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1 min-w-0">
                        <label
                          htmlFor={convId}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                        >
                          {t.t('cards.structured.convictionLabel')} #{idx + 1}
                        </label>
                        <input
                          id={convId}
                          type="text"
                          maxLength={240}
                          data-testid={`wod-ts-conviction-${entry.id}`}
                          value={entry.conviction}
                          onChange={(e) =>
                            onUpdateTouchstone?.(entry.id, { conviction: e.target.value })
                          }
                          placeholder={t.t('cards.structured.convictionPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1 min-w-0">
                        <label
                          htmlFor={stoneId}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                        >
                          {t.t('cards.structured.touchstoneLabel')}
                        </label>
                        <input
                          id={stoneId}
                          type="text"
                          maxLength={160}
                          data-testid={`wod-ts-touchstone-${entry.id}`}
                          value={entry.touchstone}
                          onChange={(e) =>
                            onUpdateTouchstone?.(entry.id, { touchstone: e.target.value })
                          }
                          placeholder={t.t('cards.structured.touchstonePlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs w-full"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-end gap-2">
                      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                        <label
                          htmlFor={notesId}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]"
                        >
                          {t.t('cards.structured.notesLabel')}
                        </label>
                        <input
                          id={notesId}
                          type="text"
                          maxLength={500}
                          data-testid={`wod-ts-notes-${entry.id}`}
                          value={entry.notes ?? ''}
                          onChange={(e) =>
                            onUpdateTouchstone?.(entry.id, { notes: e.target.value })
                          }
                          placeholder={t.t('cards.structured.notesPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs w-full"
                        />
                      </div>

                      <ConfirmRemoveControl
                        id={entry.id}
                        pendingId={pendingRemoveTouchstoneId}
                        targetLabel={entry.touchstone || entry.conviction || `#${idx + 1}`}
                        testIdPrefix="wod-ts"
                        t={t}
                        onRequest={setPendingRemoveTouchstoneId}
                        onConfirm={(id) => {
                          setPendingRemoveTouchstoneId(null);
                          onRemoveTouchstone?.(id);
                        }}
                        onCancel={() => setPendingRemoveTouchstoneId(null)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* BLOCK 2: Merits & Flaws (V5 + V20) */}
      {showMeritsFlawsBlock && (
        <section
          data-testid="wod-merits-flaws-block"
          aria-labelledby={`${baseId}-mf-heading`}
          className="wod-structured-panel p-3 flex flex-col gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3
                id={`${baseId}-mf-heading`}
                className="font-mono-tech text-xs font-extrabold uppercase tracking-wider text-[var(--accent-wine)]"
              >
                {t.t('cards.structured.meritsFlawsHeading')}
              </h3>
              <span
                data-testid="wod-mf-summary"
                className="wod-structured-summary-pill font-mono-tech text-[10px] font-extrabold px-2 py-0.5 tabular-nums uppercase"
              >
                {t.t('cards.structured.meritsFlawsSummary', {
                  merits: meritsTotal,
                  flaws: flawsTotal,
                })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t.t('cards.structured.meritsFlawsHeading')}>
              {(
                [
                  ['all', t.t('cards.structured.filterAll')],
                  ['merit', t.t('cards.structured.filterMerits')],
                  ['flaw', t.t('cards.structured.filterFlaws')],
                ] as const
              ).map(([filterId, label]) => {
                const active = mfFilter === filterId;
                return (
                  <button
                    key={filterId}
                    type="button"
                    data-testid={`wod-mf-filter-${filterId}`}
                    aria-pressed={active}
                    onClick={() => setMfFilter(filterId)}
                    className={`wod-structured-filter-chip font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer ${
                      active ? 'is-active' : ''
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {visibleMeritsFlaws.length === 0 ? (
            <p
              data-testid="wod-mf-empty"
              className="font-mono-tech text-[11px] text-[var(--ink-muted)] py-1"
            >
              {t.t('cards.structured.meritsFlawsEmpty')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleMeritsFlaws.map((item) => {
                const nameId = `${baseId}-mf-name-${item.id}`;
                const notesId = `${baseId}-mf-notes-${item.id}`;
                const isFlaw = item.kind === 'flaw';
                return (
                  <div
                    key={item.id}
                    data-testid={`wod-mf-item-${item.id}`}
                    className="wod-structured-item p-2.5 flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[180px]">
                        <span
                          data-testid={`wod-mf-badge-${item.id}`}
                          className={`font-mono-tech text-[9px] font-extrabold uppercase px-2 py-0.5 shrink-0 ${
                            isFlaw ? 'wod-mf-badge--flaw' : 'wod-mf-badge--merit'
                          }`}
                        >
                          {isFlaw
                            ? t.t('cards.structured.badgeFlaw')
                            : t.t('cards.structured.badgeMerit')}
                        </span>
                        <label htmlFor={nameId} className="sr-only">
                          {t.t('cards.structured.mfNameAria', { name: item.name || item.kind })}
                        </label>
                        <input
                          id={nameId}
                          type="text"
                          maxLength={120}
                          data-testid={`wod-mf-name-${item.id}`}
                          value={item.name}
                          onChange={(e) =>
                            onUpdateMeritFlaw?.(item.id, { name: e.target.value })
                          }
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs font-bold flex-1 min-w-[140px]"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <DotRating
                          label={item.name || item.kind}
                          value={item.rating}
                          min={1}
                          max={5}
                          compact
                          showQuickEdit={false}
                          onChange={(nextRating) =>
                            onUpdateMeritFlaw?.(item.id, { rating: nextRating })
                          }
                          t={t}
                          testId={`wod-mf-rating-${item.id}`}
                        />
                        <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)] min-w-[28px] text-center">
                          {item.rating}/5
                        </span>
                        <ConfirmRemoveControl
                          id={item.id}
                          pendingId={pendingRemoveMfId}
                          targetLabel={item.name || item.kind}
                          testIdPrefix="wod-mf"
                          t={t}
                          onRequest={setPendingRemoveMfId}
                          onConfirm={(id) => {
                            setPendingRemoveMfId(null);
                            onRemoveMeritFlaw?.(id);
                          }}
                          onCancel={() => setPendingRemoveMfId(null)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={notesId} className="sr-only">
                        {t.t('cards.structured.notesLabel')}
                      </label>
                      <input
                        id={notesId}
                        type="text"
                        maxLength={500}
                        data-testid={`wod-mf-notes-${item.id}`}
                        value={item.notes ?? ''}
                        onChange={(e) =>
                          onUpdateMeritFlaw?.(item.id, { notes: e.target.value })
                        }
                        placeholder={t.t('cards.structured.notesPlaceholder')}
                        className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs w-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              data-testid="wod-mf-picker-toggle"
              aria-expanded={pickerOpen}
              aria-controls={pickerPanelId}
              onClick={() => setPickerOpen((prev) => !prev)}
              className="cyber-btn-outline min-h-[36px] self-start px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              {pickerOpen ? (
                <>
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.t('cards.structured.pickerCloseBtn')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.t('cards.structured.pickerOpenBtn')}</span>
                </>
              )}
            </button>

            {pickerOpen && (
              <div
                id={pickerPanelId}
                data-testid="wod-mf-picker"
                className="wod-structured-item p-2.5 flex flex-col gap-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        ['merit', t.t('cards.structured.pickerKindMerit')],
                        ['flaw', t.t('cards.structured.pickerKindFlaw')],
                      ] as const
                    ).map(([kindId, kindLabel]) => {
                      const active = pickerKind === kindId;
                      return (
                        <button
                          key={kindId}
                          type="button"
                          data-testid={`wod-mf-picker-kind-${kindId}`}
                          aria-pressed={active}
                          onClick={() => setPickerKind(kindId)}
                          className={`wod-structured-filter-chip font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-extrabold uppercase cursor-pointer ${
                            active ? 'is-active' : ''
                          }`}
                        >
                          {kindLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative">
                  <label htmlFor={catalogSearchId} className="sr-only">
                    {t.t('cards.structured.catalogSearchAria')}
                  </label>
                  <Search
                    className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id={catalogSearchId}
                    type="search"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-testid="wod-mf-catalog-search"
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder={t.t('cards.structured.catalogSearchPlaceholder')}
                    className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-2.5 py-1 text-[16px] sm:text-xs w-full"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto pr-0.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {catalogOptions.length === 0 ? (
                    <p className="sm:col-span-2 font-mono-tech text-[11px] text-[var(--ink-muted)] text-center py-2">
                      {t.t('cards.structured.catalogEmptySearch', { query: catalogQuery })}
                    </p>
                  ) : (
                    catalogOptions.map((entry) => {
                      const alreadyAdded = meritsFlaws.some(
                        (item) => item.catalogId === entry.id && item.kind === pickerKind,
                      );
                      return (
                        <button
                          key={`${pickerKind}-${entry.id}`}
                          type="button"
                          data-testid={`wod-mf-catalog-${pickerKind}-${entry.id}`}
                          onClick={() =>
                            onAddMeritFlaw?.({
                              id: makeUid('mf'),
                              kind: pickerKind,
                              name: entry.name[lang],
                              rating: 1,
                              catalogId: entry.id,
                            })
                          }
                          className="wod-structured-catalog-btn font-mono-tech min-h-[36px] px-2.5 py-1.5 text-[10px] font-bold flex items-center justify-between gap-2 text-left cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="uppercase truncate">{entry.name[lang]}</span>
                            <span className="text-[9px] font-normal normal-case line-clamp-1 opacity-85">
                              {entry.summary[lang]}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 shrink-0">
                            {alreadyAdded && (
                              <span className="wod-structured-added-pill text-[8px] font-extrabold uppercase px-1.5 py-0.5">
                                {t.t('cards.structured.alreadyAdded')}
                              </span>
                            )}
                            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-dashed border-[var(--border-ink)]/35 flex flex-col gap-1.5">
                  <span className="font-mono-tech text-[9px] font-extrabold uppercase text-[var(--ink-muted)]">
                    {t.t('cards.structured.customHeading')}
                  </span>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                    <label htmlFor={customMfNameId} className="sr-only">
                      {t.t('cards.structured.customNameAria')}
                    </label>
                    <input
                      id={customMfNameId}
                      type="text"
                      maxLength={120}
                      data-testid="wod-mf-custom-name"
                      value={customMfName}
                      onChange={(e) => setCustomMfName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
                            return;
                          }
                          handleAddCustomMeritFlaw();
                        }
                      }}
                      placeholder={t.t('cards.structured.customNamePlaceholder')}
                      className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs flex-1 min-w-[150px]"
                    />
                    <label htmlFor={customMfRatingId} className="sr-only">
                      {t.t('cards.structured.customRatingAria')}
                    </label>
                    <select
                      id={customMfRatingId}
                      data-testid="wod-mf-custom-rating"
                      value={customMfRating}
                      onChange={(e) => setCustomMfRating(Number(e.target.value) || 1)}
                      className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1 text-[16px] sm:text-xs font-bold shrink-0"
                    >
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          {r} ●
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid="wod-mf-custom-add"
                      disabled={!customMfName.trim()}
                      onClick={handleAddCustomMeritFlaw}
                      className="cyber-roll-btn min-h-[36px] px-3 py-1 text-[10px] font-extrabold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.t('cards.structured.customAddBtn')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* BLOCK 3: Havens (V5 + V20) */}
      {showHavensBlock && (
        <section
          data-testid="wod-havens-block"
          aria-labelledby={`${baseId}-havens-heading`}
          className="wod-structured-panel p-3 flex flex-col gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3
                id={`${baseId}-havens-heading`}
                className="font-mono-tech text-xs font-extrabold uppercase tracking-wider text-[var(--accent-wine)]"
              >
                {t.t('cards.structured.havensHeading')}
              </h3>
              <span
                data-testid="wod-havens-count"
                className="wod-structured-summary-pill font-mono-tech text-[10px] font-extrabold px-2 py-0.5 tabular-nums uppercase"
              >
                {t.t('cards.structured.havensCount', { count: havens.length })}
              </span>
            </div>

            <button
              type="button"
              data-testid="wod-add-haven-btn"
              onClick={() =>
                onAddHaven?.({
                  id: makeUid('hv'),
                  name: '',
                  location: '',
                  rating: 1,
                  traits: [],
                  notes: '',
                })
              }
              className="cyber-roll-btn min-h-[36px] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap cursor-pointer"
            >
              {t.t('cards.structured.havensAddBtn')}
            </button>
          </div>

          {visibleHavens.length === 0 ? (
            <p
              data-testid="wod-havens-empty"
              className="font-mono-tech text-[11px] text-[var(--ink-muted)] py-1"
            >
              {t.t('cards.structured.havensEmpty')}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visibleHavens.map((haven, idx) => {
                const nameId = `${baseId}-hv-name-${haven.id}`;
                const locId = `${baseId}-hv-loc-${haven.id}`;
                const notesId = `${baseId}-hv-notes-${haven.id}`;
                const knownIds = new Set(
                  [...havenTraitGroups.merits, ...havenTraitGroups.flaws].map((tr) => tr.id),
                );
                const extraTraits = haven.traits.filter((tr) => !knownIds.has(tr));

                const toggleTrait = (traitId: string) => {
                  const exists = haven.traits.includes(traitId);
                  const nextTraits = exists
                    ? haven.traits.filter((tr) => tr !== traitId)
                    : [...haven.traits, traitId];
                  onUpdateHaven?.(haven.id, { traits: nextTraits });
                };

                return (
                  <div
                    key={haven.id}
                    data-testid={`wod-haven-card-${haven.id}`}
                    className="wod-structured-item p-2.5 flex flex-col gap-2.5"
                  >
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-w-[200px]">
                        <div className="flex flex-col gap-1 min-w-0">
                          <label
                            htmlFor={nameId}
                            className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                          >
                            {t.t('cards.structured.havenNameLabel')} #{idx + 1}
                          </label>
                          <input
                            id={nameId}
                            type="text"
                            maxLength={120}
                            data-testid={`wod-haven-name-${haven.id}`}
                            value={haven.name}
                            onChange={(e) => onUpdateHaven?.(haven.id, { name: e.target.value })}
                            placeholder={t.t('cards.structured.havenNamePlaceholder')}
                            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs font-bold w-full"
                          />
                        </div>

                        <div className="flex flex-col gap-1 min-w-0">
                          <label
                            htmlFor={locId}
                            className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                          >
                            {t.t('cards.structured.havenLocationLabel')}
                          </label>
                          <input
                            id={locId}
                            type="text"
                            maxLength={200}
                            data-testid={`wod-haven-location-${haven.id}`}
                            value={haven.location ?? ''}
                            onChange={(e) =>
                              onUpdateHaven?.(haven.id, { location: e.target.value })
                            }
                            placeholder={t.t('cards.structured.havenLocationPlaceholder')}
                            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs w-full"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                            {t.t('cards.structured.havenRatingLabel')}
                          </span>
                          <DotRating
                            label={haven.name || t.t('cards.structured.havenRatingLabel')}
                            value={haven.rating}
                            min={0}
                            max={5}
                            compact
                            showQuickEdit={false}
                            onChange={(nextRating) =>
                              onUpdateHaven?.(haven.id, { rating: nextRating })
                            }
                            t={t}
                            testId={`wod-haven-rating-${haven.id}`}
                          />
                          <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)] min-w-[28px] text-center">
                            {haven.rating}/5
                          </span>
                        </div>

                        <ConfirmRemoveControl
                          id={haven.id}
                          pendingId={pendingRemoveHavenId}
                          targetLabel={haven.name || `#${idx + 1}`}
                          testIdPrefix="wod-haven"
                          t={t}
                          onRequest={setPendingRemoveHavenId}
                          onConfirm={(id) => {
                            setPendingRemoveHavenId(null);
                            onRemoveHaven?.(id);
                          }}
                          onCancel={() => setPendingRemoveHavenId(null)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                        {t.t('cards.structured.havenTraitsLabel')}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {havenTraitGroups.merits.map((trait) => {
                          const active = haven.traits.includes(trait.id);
                          return (
                            <button
                              key={trait.id}
                              type="button"
                              aria-pressed={active}
                              title={trait.summary[lang]}
                              data-testid={`wod-haven-trait-${haven.id}-${trait.id}`}
                              onClick={() => toggleTrait(trait.id)}
                              className={`wod-haven-trait-chip font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer ${
                                active ? 'is-active' : ''
                              }`}
                            >
                              {trait.name[lang]}
                            </button>
                          );
                        })}
                        {havenTraitGroups.flaws.map((trait) => {
                          const active = haven.traits.includes(trait.id);
                          return (
                            <button
                              key={trait.id}
                              type="button"
                              aria-pressed={active}
                              title={trait.summary[lang]}
                              data-testid={`wod-haven-trait-${haven.id}-${trait.id}`}
                              onClick={() => toggleTrait(trait.id)}
                              className={`wod-haven-trait-chip is-flaw font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer ${
                                active ? 'is-active' : ''
                              }`}
                            >
                              {t.t('cards.structured.badgeFlaw')}: {trait.name[lang]}
                            </button>
                          );
                        })}
                        {extraTraits.map((customTrait) => (
                          <button
                            key={customTrait}
                            type="button"
                            aria-pressed={true}
                            data-testid={`wod-haven-trait-${haven.id}-${customTrait}`}
                            onClick={() => toggleTrait(customTrait)}
                            className="wod-haven-trait-chip is-active font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {customTrait} ×
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={notesId} className="sr-only">
                        {t.t('cards.structured.notesLabel')}
                      </label>
                      <input
                        id={notesId}
                        type="text"
                        maxLength={500}
                        data-testid={`wod-haven-notes-${haven.id}`}
                        value={haven.notes ?? ''}
                        onChange={(e) => onUpdateHaven?.(haven.id, { notes: e.target.value })}
                        placeholder={t.t('cards.structured.havenNotesPlaceholder')}
                        className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-xs w-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
