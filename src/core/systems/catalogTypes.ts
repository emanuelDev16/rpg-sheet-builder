export type LocalizedText = { 'pt-BR': string; en: string; es: string };
export interface SystemCatalogFilterOption { value: string; label: LocalizedText; }
export interface SystemCatalogFilterGroup {
  id: string;
  label: LocalizedText;
  options: SystemCatalogFilterOption[];
}
export interface SystemCatalogItem {
  id: string;
  sectionId: string;
  name: LocalizedText;
  summary: LocalizedText;
  costLabel?: LocalizedText;
  level?: number;
  tags?: string[];
  badges?: string[];
  meta?: Record<string, string | number | boolean | string[]>;
}
export interface SystemCatalogSection {
  id: string;
  label: LocalizedText;
  filterGroups?: SystemCatalogFilterGroup[];
  items: SystemCatalogItem[];
}
export interface SystemCatalog { systemId: string; attribution?: string; sections: SystemCatalogSection[]; }

function safeScalar(val: unknown): string | null {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return `${val}`;
  return null;
}

/** Case- and diacritic-insensitive normalization for catalog search and keys. */
export function normalizeCatalogText(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Matches a pre-normalized query against item id, localized texts, tags, and badges. */
export function matchesCatalogQuery(item: SystemCatalogItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const fields: Array<unknown> = [
    item.id, item.name['pt-BR'], item.name.en, item.name.es,
    item.summary['pt-BR'], item.summary.en, item.summary.es,
    item.costLabel?.['pt-BR'], item.costLabel?.en, item.costLabel?.es,
    ...(item.tags ?? []), ...(item.badges ?? []),
  ];
  return fields.some((val) => typeof val === 'string' && normalizeCatalogText(val).includes(normalizedQuery));
}

/** Checks whether an item satisfies all active filter group selections. */
export function matchesCatalogFilters(
  item: SystemCatalogItem,
  activeFilters: Record<string, string>,
): boolean {
  for (const [groupId, selected] of Object.entries(activeFilters)) {
    if (!selected) continue;
    const target = normalizeCatalogText(selected);
    if (item.meta && Object.hasOwn(item.meta, groupId)) {
      const metaVal = item.meta[groupId];
      const ok = Array.isArray(metaVal)
        ? metaVal.some((v) => { const s = safeScalar(v); return s !== null && normalizeCatalogText(s) === target; })
        : (() => { const s = safeScalar(metaVal); return s !== null && normalizeCatalogText(s) === target; })();
      if (!ok) return false;
      continue;
    }
    if (groupId === 'level' && typeof item.level === 'number') {
      if (`${item.level}` !== target) return false;
      continue;
    }
    if (item.tags?.some((t) => typeof t === 'string' && normalizeCatalogText(t) === target)) continue;
    return false;
  }
  return true;
}

/** Checks whether an item is already present on the sheet via normalized id/name keys. */
export function isCatalogItemPresent(
  item: SystemCatalogItem,
  existingItemKeys: ReadonlySet<string>,
): boolean {
  if (existingItemKeys.size === 0) return false;
  const keys = [item.id, item.name['pt-BR'], item.name.en, item.name.es];
  return keys.some((k) => typeof k === 'string' && k.length > 0 && (existingItemKeys.has(k) || existingItemKeys.has(normalizeCatalogText(k))));
}
