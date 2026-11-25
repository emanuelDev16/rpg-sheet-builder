import type {
  HavenEntry,
  MeritFlawEntry,
  RulePreset,
  SheetCard,
  SheetField,
  SystemId,
  TouchstoneEntry,
} from './sheetModel.ts';
import {
  findAdvantageByIdOrName,
  findFlawByIdOrName,
  findHavenTraitByIdOrName,
} from './wodAdvantagesCatalog.ts';
import { isOfficialVampireSheet } from './wodSkillsCatalog.ts';

export interface SheetStructuredSearchContext {
  systemId?: SystemId;
  rulePreset?: RulePreset;
  touchstones?: readonly TouchstoneEntry[];
  meritsFlaws?: readonly MeritFlawEntry[];
  havens?: readonly HavenEntry[];
}

export interface FilteredCardResult {
  card: SheetCard;
  matchedFields: SheetField[];
  totalFieldCount: number;
  isFiltered: boolean;
  structuredMatchesCount?: number;
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

function anyCandidateMatches(
  candidates: ReadonlyArray<string | undefined | null>,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  for (const candidate of candidates) {
    if (candidate && normalizeSearchText(candidate).includes(normalizedQuery)) {
      return true;
    }
  }
  return false;
}

export function touchstoneMatchesQuery(
  entry: TouchstoneEntry,
  normalizedQuery: string,
): boolean {
  return anyCandidateMatches([entry.conviction, entry.touchstone, entry.notes], normalizedQuery);
}

export function meritFlawMatchesQuery(
  entry: MeritFlawEntry,
  normalizedQuery: string,
  edition?: 'vampire-v5' | 'storyteller-v20',
): boolean {
  const catalogEntry = entry.catalogId
    ? entry.kind === 'flaw'
      ? findFlawByIdOrName(entry.catalogId, edition)
      : findAdvantageByIdOrName(entry.catalogId, edition)
    : null;
  const kindTerms =
    entry.kind === 'flaw'
      ? ['flaw', 'flaws', 'defeito', 'defeitos', 'defecto', 'defectos']
      : ['merit', 'merits', 'qualidade', 'qualidades', 'merito', 'meritos', 'cualidad'];
  return anyCandidateMatches(
    [
      entry.name,
      entry.notes,
      entry.catalogId,
      ...kindTerms,
      ...(catalogEntry
        ? [
            catalogEntry.name['pt-BR'],
            catalogEntry.name.en,
            catalogEntry.name.es,
            ...(catalogEntry.aliases ?? []),
          ]
        : []),
    ],
    normalizedQuery,
  );
}

export function havenMatchesQuery(
  entry: HavenEntry,
  normalizedQuery: string,
  edition?: 'vampire-v5' | 'storyteller-v20',
): boolean {
  const traitTerms = entry.traits.flatMap((traitId) => {
    const traitEntry = findHavenTraitByIdOrName(traitId, edition);
    return traitEntry
      ? [
          traitId,
          traitEntry.name['pt-BR'],
          traitEntry.name.en,
          traitEntry.name.es,
          ...(traitEntry.aliases ?? []),
        ]
      : [traitId];
  });
  return anyCandidateMatches(
    [entry.name, entry.location, entry.notes, ...traitTerms],
    normalizedQuery,
  );
}

export function countStructuredWodMatches(
  context: SheetStructuredSearchContext,
  normalizedQuery: string,
): number {
  if (!normalizedQuery || !isOfficialVampireSheet(context.systemId, context.rulePreset)) {
    return 0;
  }
  const edition = context.rulePreset;
  let matches = 0;

  if (edition === 'vampire-v5' && Array.isArray(context.touchstones)) {
    for (const ts of context.touchstones) {
      if (touchstoneMatchesQuery(ts, normalizedQuery)) matches += 1;
    }
  }
  if (Array.isArray(context.meritsFlaws)) {
    for (const mf of context.meritsFlaws) {
      if (meritFlawMatchesQuery(mf, normalizedQuery, edition)) matches += 1;
    }
  }
  if (Array.isArray(context.havens)) {
    for (const hv of context.havens) {
      if (havenMatchesQuery(hv, normalizedQuery, edition)) matches += 1;
    }
  }
  return matches;
}

const DOSSIER_SHARED_KEYWORDS = [
  'qualidade',
  'qualidades',
  'defeito',
  'defeitos',
  'merito',
  'meritos',
  'refugio',
  'refugios',
  'defecto',
  'defectos',
  'cualidad',
  'cualidades',
];
const DOSSIER_V5_KEYWORDS = [
  'conviccao',
  'conviccoes',
  'pedra de toque',
  'pedras de toque',
  'piedra de toque',
  'piedras de toque',
  'conviccion',
  'convicciones',
  'touchstone',
  'touchstones',
  'conviction',
  'convictions',
];

export function filterCardsByQuery(
  cards: SheetCard[],
  rawQuery: string,
  structuredContext?: SheetStructuredSearchContext,
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
  const isOfficialWod =
    structuredContext !== undefined &&
    isOfficialVampireSheet(structuredContext.systemId, structuredContext.rulePreset);

  for (const card of cards) {
    let cardHeaderMatches =
      normalizeSearchText(card.title).includes(normalizedQuery) ||
      normalizeSearchText(card.code).includes(normalizedQuery);

    const isDossierCard = card.id === 'card_wod_dossier' && isOfficialWod;
    if (isDossierCard && !cardHeaderMatches) {
      const sectionKeywords =
        structuredContext?.rulePreset === 'vampire-v5'
          ? [...DOSSIER_SHARED_KEYWORDS, ...DOSSIER_V5_KEYWORDS]
          : DOSSIER_SHARED_KEYWORDS;
      cardHeaderMatches = sectionKeywords.some((kw) => kw.includes(normalizedQuery));
    }

    if (cardHeaderMatches) {
      const structuredCount = isDossierCard && structuredContext
        ? (structuredContext.rulePreset === 'vampire-v5'
            ? structuredContext.touchstones?.length ?? 0
            : 0) +
          (structuredContext.meritsFlaws?.length ?? 0) +
          (structuredContext.havens?.length ?? 0)
        : 0;
      results.push({
        card,
        matchedFields: card.fields,
        totalFieldCount: card.fields.length,
        isFiltered: false,
        ...(isDossierCard ? { structuredMatchesCount: structuredCount } : {}),
      });
      continue;
    }

    const matchingFields = card.fields.filter((f) => fieldMatchesQuery(f, normalizedQuery));
    const structuredCount =
      isDossierCard && structuredContext
        ? countStructuredWodMatches(structuredContext, normalizedQuery)
        : 0;

    if (matchingFields.length > 0 || structuredCount > 0) {
      results.push({
        card,
        matchedFields: matchingFields,
        totalFieldCount: card.fields.length,
        isFiltered: matchingFields.length > 0 && matchingFields.length < card.fields.length,
        ...(isDossierCard ? { structuredMatchesCount: structuredCount } : {}),
      });
    }
  }

  return results;
}
