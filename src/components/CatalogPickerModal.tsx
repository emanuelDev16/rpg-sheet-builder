import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type AppLanguage, translate } from '../core/i18n';
import {
  isCatalogItemPresent, matchesCatalogFilters, matchesCatalogQuery, normalizeCatalogText,
  type SystemCatalog, type SystemCatalogItem,
} from '../core/systems/catalogTypes';
import { useFocusTrap } from '../utils/useFocusTrap';

const PAGE_SIZE = 60;

export interface CatalogPickerModalProps {
  isOpen: boolean;
  lang: AppLanguage;
  catalog?: SystemCatalog | null;
  loadCatalog?: () => Promise<SystemCatalog>;
  initialSectionId?: string;
  initialFilters?: Record<string, string>;
  existingItemKeys: ReadonlySet<string>;
  allowDuplicates?: boolean;
  title?: string;
  onSelect: (item: SystemCatalogItem) => void;
  onAddCustom?: (sectionId: string) => void;
  onClose: () => void;
}

/** Reusable 3-zone modal picker for multi-system lazy-loaded RPG catalogs. */
export const CatalogPickerModal: React.FC<CatalogPickerModalProps> = ({
  isOpen, lang, catalog, loadCatalog, initialSectionId, initialFilters,
  existingItemKeys, allowDuplicates = false, title, onSelect, onAddCustom, onClose,
}) => {
  const [loadedCatalog, setLoadedCatalog] = useState<SystemCatalog | null>(catalog ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(initialSectionId ?? '');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters ?? {});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const overlayPointerRef = useRef(false);
  const initialFiltersRef = useRef(initialFilters);
  initialFiltersRef.current = initialFilters;
  const searchInputId = useId();
  const titleId = useId();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);

  useFocusTrap(isOpen, dialogRef, undefined, closeBtnRef);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(''); setVisibleCount(PAGE_SIZE); setActiveSectionId(initialSectionId ?? ''); setFilters(initialFiltersRef.current ?? {});
  }, [isOpen, initialSectionId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadError(false);
    if (catalog || !loadCatalog) { setLoadedCatalog(catalog ?? null); setIsLoading(false); return; }
    let cancelled = false;
    setLoadedCatalog(null); setIsLoading(true);
    loadCatalog().then((res) => { if (!cancelled) setLoadedCatalog(res); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, catalog, loadCatalog]);

  const resolvedCatalog = catalog ?? loadedCatalog;
  const sections = resolvedCatalog?.sections ?? [];
  const activeSection = useMemo(() => sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? null, [sections, activeSectionId]);
  const normalizedKeys = useMemo(
    () => new Set(Array.from(existingItemKeys, (k) => (typeof k === 'string' ? normalizeCatalogText(k) : '')).filter(Boolean)),
    [existingItemKeys],
  );
  const normalizedQuery = useMemo(() => normalizeCatalogText(query), [query]);
  const filteredItems = useMemo(
    () => (activeSection ? activeSection.items.filter((i) => matchesCatalogQuery(i, normalizedQuery) && matchesCatalogFilters(i, filters)) : []),
    [activeSection, normalizedQuery, filters],
  );

  if (!isOpen) return null;
  const showControls = !isLoading && !loadError && Boolean(resolvedCatalog);
  const visibleItems = filteredItems.slice(0, visibleCount);
  const remainingCount = Math.max(0, filteredItems.length - visibleItems.length);
  const hasActiveFilters = Boolean(normalizedQuery) || Object.values(filters).some(Boolean);

  return (
    <div className="no-print print:hidden mobile-modal-overlay fixed inset-0 flex justify-center bg-[var(--overlay-backdrop)]" role="presentation"
      onPointerDown={(e) => { overlayPointerRef.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (overlayPointerRef.current && e.target === e.currentTarget) onClose(); overlayPointerRef.current = false; }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="catalog-picker-dialog"
        className="bento-card mobile-modal-dialog catalog-picker-dialog w-full max-w-2xl bg-[var(--bg-card)] shadow-[var(--shadow-modal)]">
        <header className="bento-card-header modal-dialog-header">
          <div className="bento-card-header-title flex items-center gap-2 min-w-0">
            <span className="font-mono-tech text-xs font-bold text-[var(--accent-wine)] shrink-0">{t('catalogPicker.tag')}</span>
            <h2 id={titleId} className="font-display text-lg font-extrabold uppercase truncate">{title || t('catalogPicker.title')}</h2>
          </div>
          <button ref={closeBtnRef} type="button" onClick={onClose} aria-label={t('catalogPicker.closeAria')} className="cyber-btn-outline mobile-touch-stepper min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"><X className="w-4 h-4" aria-hidden="true" /></button>
        </header>

        <div className="modal-dialog-body p-3.5 sm:p-4 flex flex-col gap-3">
          {isLoading ? (
            <div role="status" className="font-mono-tech text-xs text-[var(--ink-muted)] py-6 text-center">{t('catalogPicker.loading')}</div>
          ) : loadError ? (
            <div role="alert" className="font-mono-tech text-xs font-bold text-[var(--accent-danger)] py-4 text-center">{t('catalogPicker.error')}</div>
          ) : (
            <>
              {showControls && (<>
                {sections.length > 0 && (
                  <div role="tablist" aria-label={t('catalogPicker.sectionsAria')} className="flex flex-wrap gap-1.5">
                    {sections.map((sec) => {
                      const selected = sec.id === activeSection?.id;
                      return (
                        <button key={sec.id} type="button" role="tab" aria-selected={selected} data-testid={`catalog-section-tab-${sec.id}`}
                          onClick={() => { setActiveSectionId(sec.id); setFilters({}); setVisibleCount(PAGE_SIZE); }}
                          className={`catalog-picker-tab cyber-btn-outline min-h-[36px] px-3 py-1 font-mono-tech text-xs font-bold uppercase cursor-pointer ${selected ? 'is-active' : ''}`}
                        >{sec.label[lang]}</button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label htmlFor={searchInputId} className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-secondary)]">{t('catalogPicker.searchLabel')}</label>
                  <input id={searchInputId} type="search" data-testid="catalog-picker-search" value={query}
                    onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                    placeholder={t('catalogPicker.searchPlaceholder')} autoCorrect="off" autoCapitalize="none" spellCheck={false}
                    className="cyber-input min-h-[38px] px-3 py-1.5 w-full" />
                </div>
                {activeSection?.filterGroups?.map((group) => (
                  <div key={group.id} role="group" aria-label={group.label[lang]} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)] mr-1">{group.label[lang]}:</span>
                    <button type="button" aria-pressed={!filters[group.id]} onClick={() => { setFilters((prev) => ({ ...prev, [group.id]: '' })); setVisibleCount(PAGE_SIZE); }}
                      className={`catalog-picker-chip cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[11px] font-bold uppercase cursor-pointer ${!filters[group.id] ? 'is-active' : ''}`}>{t('catalogPicker.filterAll')}</button>
                    {group.options.map((opt) => {
                      const active = filters[group.id] === opt.value;
                      return (
                        <button key={opt.value} type="button" aria-pressed={active} data-testid={`catalog-filter-${group.id}-${opt.value}`}
                          onClick={() => { setFilters((prev) => ({ ...prev, [group.id]: active ? '' : opt.value })); setVisibleCount(PAGE_SIZE); }}
                          className={`catalog-picker-chip cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[11px] font-bold uppercase cursor-pointer ${active ? 'is-active' : ''}`}
                        >{opt.label[lang]}</button>
                      );
                    })}
                  </div>
                ))}
              </>)}
              <div className="flex items-center justify-between gap-2 font-mono-tech text-[11px] text-[var(--ink-muted)]">
                <span>{t('catalogPicker.countLabel', { shown: visibleItems.length, total: filteredItems.length })}</span>
                {hasActiveFilters && <button type="button" onClick={() => { setQuery(''); setFilters({}); setVisibleCount(PAGE_SIZE); }} className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer">{t('catalogPicker.clearFilters')}</button>}
              </div>
              {visibleItems.length === 0 ? (
                <div className="font-mono-tech text-xs text-[var(--ink-muted)] py-6 text-center border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-card)]">{t('catalogPicker.empty')}</div>
              ) : (
                <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                  {visibleItems.map((item) => {
                    const present = isCatalogItemPresent(item, normalizedKeys);
                    const blocked = present && !allowDuplicates;
                    return (
                      <li key={item.id} data-testid={`catalog-item-${item.id}`} className="catalog-picker-item p-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-[var(--ink-primary)]">{item.name[lang]}</span>
                            {item.costLabel && <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--ink-secondary)] rounded-[var(--radius-pill)]">{item.costLabel[lang]}</span>}
                            {item.badges?.map((b, idx) => <span key={`${b}-${idx}`} className="catalog-picker-badge font-mono-tech text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-pill)] uppercase">{b}</span>)}
                            {present && <span className="catalog-picker-present-badge font-mono-tech text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-pill)] uppercase">{t('catalogPicker.alreadyOnSheet')}</span>}
                          </div>
                          <p className="text-xs text-[var(--ink-secondary)] m-0 leading-snug">{item.summary[lang]}</p>
                        </div>
                        <button type="button" aria-disabled={blocked ? 'true' : undefined} aria-label={`${t('catalogPicker.addAction')} ${item.name[lang]}`} data-testid={`catalog-select-${item.id}`} onClick={() => { if (!blocked) onSelect(item); }} className="cyber-roll-btn min-h-[36px] px-3 py-1.5 font-mono-tech text-xs font-bold uppercase shrink-0 cursor-pointer">{t('catalogPicker.addAction')}</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {remainingCount > 0 && <button type="button" data-testid="catalog-show-more-btn" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)} className="cyber-btn-outline min-h-[36px] px-3 py-2 font-mono-tech text-xs font-bold uppercase w-full cursor-pointer">{t('catalogPicker.showMore', { remaining: remainingCount })}</button>}
              {resolvedCatalog?.attribution && <p className="font-mono-tech text-[10px] text-[var(--ink-muted)] m-0 pt-1">{resolvedCatalog.attribution}</p>}
            </>
          )}
        </div>

        <footer className="modal-dialog-footer flex flex-wrap items-center justify-between gap-2">
          <div>{onAddCustom && <button type="button" data-testid="catalog-add-custom-btn" onClick={() => onAddCustom(activeSection?.id ?? initialSectionId ?? '')} className="cyber-btn-outline min-h-[36px] px-3 py-1.5 font-mono-tech text-xs font-bold uppercase cursor-pointer">{t('catalogPicker.addCustom')}</button>}</div>
          <button type="button" onClick={onClose} className="cyber-btn-outline min-h-[36px] px-3.5 py-1.5 font-mono-tech text-xs font-bold uppercase cursor-pointer">{t('catalogPicker.closeBtn')}</button>
        </footer>
      </div>
    </div>
  );
};
