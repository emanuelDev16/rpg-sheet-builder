import type { SheetCard, SheetField } from './sheetModel';

export interface FilteredCardResult {
  card: SheetCard;
  matchedFields: SheetField[];
  totalFieldCount: number;
  isFiltered: boolean;
}

export function normalizeSearchText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function fieldMatchesQuery(field: SheetField, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;

  const candidates: Array<string | undefined> = [
    field.label,
    field.key,
    field.rollLabel,
    field.hint,
    field.formula,
  ];

  if (field.damageTrack) {
    candidates.push(
      'superficial',
      'aggravated',
      'agravated',
      'agravado',
      'dano superficial',
      'dano agravado',
    );
  }

  for (const candidate of candidates) {
    if (candidate && normalizeSearchText(candidate).includes(normalizedQuery)) {
      return true;
    }
  }

  if (field.kind === 'repeatable' && Array.isArray(field.rows)) {
    for (const row of field.rows) {
      if (
        normalizeSearchText(row.col1).includes(normalizedQuery) ||
        normalizeSearchText(String(row.col2)).includes(normalizedQuery)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function filterCardsByQuery(
  cards: SheetCard[],
  rawQuery: string,
): FilteredCardResult[] {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) {
    return cards.map((card) => ({
      card,
      matchedFields: card.fields,
      totalFieldCount: card.fields.length,
      isFiltered: false,
    }));
  }

  const results: FilteredCardResult[] = [];

  for (const card of cards) {
    const cardHeaderMatches =
      normalizeSearchText(card.title).includes(normalizedQuery) ||
      normalizeSearchText(card.code).includes(normalizedQuery);

    if (cardHeaderMatches) {
      results.push({
        card,
        matchedFields: card.fields,
        totalFieldCount: card.fields.length,
        isFiltered: false,
      });
      continue;
    }

    const matchingFields = card.fields.filter((f) => fieldMatchesQuery(f, normalizedQuery));
    if (matchingFields.length > 0) {
      results.push({
        card,
        matchedFields: matchingFields,
        totalFieldCount: card.fields.length,
        isFiltered: true,
      });
    }
  }

  return results;
}
