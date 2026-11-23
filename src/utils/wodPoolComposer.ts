import { getV5BloodPotencyStats, getV5BloodSurgeBonus } from '../core/formula.ts';
import type { AppLanguage } from '../core/i18n.ts';
import {
  type AttributeGroup,
  type CharacterSheetState,
  getSheetVirtues,
  resolveRulePreset,
  type SheetField,
} from '../core/sheetModel.ts';
import { normalizeCatalogText, V5_SKILLS_CATALOG } from '../core/wodSkillsCatalog.ts';
import { classifyTraitField } from '../core/xpSystem.ts';

export type WodTraitGroup = 'attributes' | 'skills' | 'disciplines' | 'virtues';
export type WodComposerRulePreset = 'storyteller-v20' | 'vampire-v5';
export type WodTraitDomain = 'physical' | 'social_mental' | 'unknown';
export type WodPoolDomain = 'physical' | 'social_mental' | 'mixed' | 'unknown';

export interface WodRollableTrait {
  id: string;
  key: string;
  label: string;
  value: number;
  group: WodTraitGroup;
  attributeGroup?: AttributeGroup;
  specialty?: boolean;
  specialtyLabel?: string;
}

export type WodComposedTraitInput = Pick<WodRollableTrait, 'label' | 'value'> &
  Partial<Pick<WodRollableTrait, 'id' | 'key' | 'group' | 'attributeGroup'>>;

export interface WodRollableTraitGroups {
  attributes: WodRollableTrait[];
  skills: WodRollableTrait[];
  disciplines: WodRollableTrait[];
  virtues: WodRollableTrait[];
  all: WodRollableTrait[];
}

export interface WodComposedPoolLabels {
  diffTn?: string;
  diffMeta?: string;
  hungerWord?: string;
  specTag?: string;
  wpTag?: string;
  powerTag?: string;
}

export interface WodComposedPoolInput {
  rulePreset: WodComposerRulePreset;
  primaryTrait: WodComposedTraitInput | null;
  secondaryTrait?: WodComposedTraitInput | null;
  modifier?: number;
  woundPenalty?: number;
  isWillpowerImpaired?: boolean;
  ignoreWoundPenalty?: boolean;
  bloodSurgeActive?: boolean;
  bloodSurgeBonus?: number;
  bloodPotency?: number;
  hunger?: number;
  difficulty?: number;
  specialty?: boolean;
  useWillpower?: boolean;
  willpowerAvailable?: number;
  labels?: WodComposedPoolLabels;
}

export interface WodComposedPoolBreakdown {
  rulePreset: WodComposerRulePreset;
  primaryValue: number;
  secondaryValue: number;
  modifier: number;
  bloodSurgeApplied: boolean;
  bloodSurgeBonus: number;
  powerBonusDiceApplied: number;
  poolDomain: WodPoolDomain;
  rawPool: number;
  appliedWoundPenalty: number;
  healthImpairedApplied: boolean;
  isWillpowerImpaired: boolean;
  willpowerImpairedApplied: boolean;
  impairedPenaltySource: 'none' | 'health' | 'willpower' | 'both';
  effectivePool: number;
  isIncapacitated: boolean;
  canRoll: boolean;
  hungerDiceCount: number;
  normalDiceCount: number;
  difficulty: number;
  specialty: boolean;
  useWillpower: boolean;
  displayLabel: string;
  formulaSummary: string;
}

export interface WodComposedRollRequest {
  label: string;
  formulaSummary: string;
  rulePreset: WodComposerRulePreset;
  basePool: number;
  modifier: number;
  difficulty: number;
  woundPenalty: number;
  ignoreWoundPenalty: boolean;
  specialty: boolean;
  useWillpower: boolean;
  bloodSurge: boolean;
  bloodSurgeBonus: number;
  powerBonusDice?: number;
}

const ATTRIBUTE_GROUP_ORDER: Record<AttributeGroup, number> = {
  physical: 0,
  social: 1,
  mental: 2,
};

const VIRTUE_KEYS = new Set([
  'conscience',
  'consciencia',
  'conviction',
  'conviccao',
  'self_control',
  'selfcontrol',
  'autocontrole',
  'instinct',
  'instinto',
  'courage',
  'coragem',
  'coraje',
]);

function normalizeTraitDomainToken(value: string): string {
  return normalizeCatalogText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const WOD_TRAIT_DOMAIN_BY_TOKEN: ReadonlyMap<string, 'physical' | 'social_mental'> = (() => {
  const map = new Map<string, 'physical' | 'social_mental'>();
  const addTokens = (tokens: readonly string[], domain: 'physical' | 'social_mental') => {
    for (const token of tokens) {
      const normalized = normalizeTraitDomainToken(token);
      if (normalized) {
        map.set(normalized, domain);
      }
    }
  };

  // Standard WoD physical attributes & fallback physical skills
  addTokens(
    [
      'strength',
      'forca',
      'fuerza',
      'dexterity',
      'destreza',
      'stamina',
      'vigor',
      'resistencia',
      'dodge',
      'esquiva',
    ],
    'physical',
  );

  // Standard WoD social & mental attributes, virtues, and fallback social/mental skills
  addTokens(
    [
      'charisma',
      'carisma',
      'manipulation',
      'manipulacao',
      'manipulacion',
      'appearance',
      'aparencia',
      'apariencia',
      'composure',
      'compostura',
      'perception',
      'percepcao',
      'percepcion',
      'intelligence',
      'inteligencia',
      'wits',
      'raciocinio',
      'astucia',
      'resolve',
      'determinacao',
      'determinacion',
      'resolucao',
      'alertness',
      'prontidao',
      'empathy',
      'empatia',
      'expression',
      'expressao',
      'enigmas',
      'law',
      'direito',
      'linguistics',
      'linguistica',
      'security',
      'seguranca',
    ],
    'social_mental',
  );

  for (const virtueKey of VIRTUE_KEYS) {
    map.set(virtueKey, 'social_mental');
  }

  for (const skill of V5_SKILLS_CATALOG) {
    const domain: 'physical' | 'social_mental' =
      skill.category === 'physical' ? 'physical' : 'social_mental';
    addTokens([skill.varName, ...(skill.aliases ?? []), ...Object.values(skill.labels)], domain);
  }

  return map;
})();

/**
 * Classifies a WoD trait as 'physical', 'social_mental', or 'unknown' (e.g. standalone Discipline).
 */
export function classifyWodTraitDomain(
  trait?: WodComposedTraitInput | null,
): WodTraitDomain {
  if (!trait) return 'unknown';
  if (trait.attributeGroup === 'physical') return 'physical';
  if (trait.attributeGroup === 'social' || trait.attributeGroup === 'mental') {
    return 'social_mental';
  }
  if (trait.group === 'virtues') return 'social_mental';

  for (const candidate of [trait.key, trait.label]) {
    if (!candidate) continue;
    const token = normalizeTraitDomainToken(candidate);
    if (!token) continue;
    const direct = WOD_TRAIT_DOMAIN_BY_TOKEN.get(token);
    if (direct) return direct;
    const stripped = token.replace(/^(?:f|attr|skill|hab)_/, '');
    const strippedMatch = WOD_TRAIT_DOMAIN_BY_TOKEN.get(stripped);
    if (strippedMatch) return strippedMatch;
  }

  return 'unknown';
}

const SYNTHETIC_V20_VIRTUE_DEFS: ReadonlyArray<{
  id: string;
  key: string;
  prop: 'conscience' | 'selfControl' | 'courage';
  aliases: readonly string[];
  labels: Readonly<Record<AppLanguage, string>>;
}> = [
  {
    id: 'v20_virtue_conscience',
    key: 'conscience',
    prop: 'conscience',
    aliases: ['conscience', 'consciencia', 'conviction', 'conviccao'],
    labels: {
      'pt-BR': 'CONSCIÊNCIA',
      en: 'CONSCIENCE',
      es: 'CONCIENCIA',
    },
  },
  {
    id: 'v20_virtue_self_control',
    key: 'self_control',
    prop: 'selfControl',
    aliases: ['self_control', 'selfcontrol', 'autocontrole', 'instinct', 'instinto'],
    labels: {
      'pt-BR': 'AUTOCONTROLE',
      en: 'SELF-CONTROL',
      es: 'AUTOCONTROL',
    },
  },
  {
    id: 'v20_virtue_courage',
    key: 'courage',
    prop: 'courage',
    aliases: ['courage', 'coragem'],
    labels: {
      'pt-BR': 'CORAGEM',
      en: 'COURAGE',
      es: 'CORAJE',
    },
  },
];

/**
 * Extracts ordered, rollable WoD traits (`attributes`, `skills`, `disciplines`, `virtues`)
 * from a character sheet, excluding text, non-rollable calculated fields, and resource tracks.
 */
export function extractWodRollableTraits(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): WodRollableTraitGroups {
  const attributesWithOrder: Array<{ trait: WodRollableTrait; groupRank: number; idx: number }> = [];
  const skills: WodRollableTrait[] = [];
  const disciplines: WodRollableTrait[] = [];
  const virtues: WodRollableTrait[] = [];
  const seenIds = new Set<string>();

  const pairedRollByTraitKey = new Map<string, SheetField>();
  for (const card of sheet.cards) {
    for (const field of card.fields) {
      if (field.kind !== 'roll') continue;
      const rfKey = field.key.trim().toLowerCase();
      if (rfKey.startsWith('roll_') && rfKey.length > 5) {
        const target = rfKey.slice(5);
        if (!pairedRollByTraitKey.has(target)) {
          pairedRollByTraitKey.set(target, field);
        }
      }
      const rfId = field.id.trim().toLowerCase();
      if (rfId.startsWith('f_roll_') && rfId.length > 7) {
        const target = rfId.slice(7);
        if (!pairedRollByTraitKey.has(target)) {
          pairedRollByTraitKey.set(target, field);
        }
      }
    }
  }

  let attrOrderIdx = 0;
  for (const card of sheet.cards) {
    const cardSig = `${card.code ?? ''} ${card.title ?? ''}`.toUpperCase();
    for (const field of card.fields) {
      if (field.kind !== 'number') continue;
      if (typeof field.value !== 'number' || !Number.isFinite(field.value)) continue;
      if (seenIds.has(field.id)) continue;

      const category = classifyTraitField(card, field);
      if (!category) continue;

      const normalizedKey = field.key.trim().toLowerCase();
      const pairedRoll = pairedRollByTraitKey.get(normalizedKey);
      const hasSpecialty = Boolean(field.rollSpecialty || pairedRoll?.rollSpecialty);
      const specialtyLabel = hasSpecialty
        ? field.hint?.trim() || pairedRoll?.hint?.trim() || undefined
        : undefined;
      const traitValue = Math.max(0, Math.round(field.value));

      if (category === 'attribute') {
        seenIds.add(field.id);
        const groupRank = field.attributeGroup
          ? ATTRIBUTE_GROUP_ORDER[field.attributeGroup]
          : 3;
        attributesWithOrder.push({
          trait: {
            id: field.id,
            key: field.key,
            label: field.label,
            value: traitValue,
            group: 'attributes',
            ...(field.attributeGroup ? { attributeGroup: field.attributeGroup } : {}),
            ...(hasSpecialty ? { specialty: true, ...(specialtyLabel ? { specialtyLabel } : {}) } : {}),
          },
          groupRank,
          idx: attrOrderIdx++,
        });
        continue;
      }

      if (category === 'skill') {
        seenIds.add(field.id);
        skills.push({
          id: field.id,
          key: field.key,
          label: field.label,
          value: traitValue,
          group: 'skills',
          ...(hasSpecialty ? { specialty: true, ...(specialtyLabel ? { specialtyLabel } : {}) } : {}),
        });
        continue;
      }

      if (category === 'discipline') {
        seenIds.add(field.id);
        disciplines.push({
          id: field.id,
          key: field.key,
          label: field.label,
          value: traitValue,
          group: 'disciplines',
          ...(hasSpecialty ? { specialty: true, ...(specialtyLabel ? { specialtyLabel } : {}) } : {}),
        });
        continue;
      }

      // Exclude Background/Merit fields classified as 'virtue' for XP unless they are actual Virtues.
      const isActualVirtue =
        VIRTUE_KEYS.has(normalizedKey) ||
        (/VIRTUE|VIRTUDE/.test(cardSig) && !/ANTECEDENT|BACKGROUND|MERIT|MÉRITO/.test(cardSig));
      if (isActualVirtue) {
        seenIds.add(field.id);
        virtues.push({
          id: field.id,
          key: field.key,
          label: field.label,
          value: traitValue,
          group: 'virtues',
          ...(hasSpecialty ? { specialty: true, ...(specialtyLabel ? { specialtyLabel } : {}) } : {}),
        });
      }
    }
  }

  attributesWithOrder.sort((a, b) => a.groupRank - b.groupRank || a.idx - b.idx);
  const attributes = attributesWithOrder.map((entry) => entry.trait);

  const preset = resolveRulePreset(sheet);
  const isWodTarget = sheet.systemId === undefined || sheet.systemId === 'wod';
  if (
    isWodTarget &&
    preset !== 'vampire-v5' &&
    (preset === 'storyteller-v20' || sheet.virtues !== undefined)
  ) {
    const sheetVirtues = getSheetVirtues(sheet);
    const existingVirtueKeys = new Set(virtues.map((v) => v.key.trim().toLowerCase()));
    for (const def of SYNTHETIC_V20_VIRTUE_DEFS) {
      if (def.aliases.some((alias) => existingVirtueKeys.has(alias))) continue;
      if (seenIds.has(def.id)) continue;
      seenIds.add(def.id);
      virtues.push({
        id: def.id,
        key: def.key,
        label: def.labels[lang],
        value: sheetVirtues[def.prop],
        group: 'virtues',
      });
    }
  }

  return {
    attributes,
    skills,
    disciplines,
    virtues,
    all: [...attributes, ...skills, ...disciplines, ...virtues],
  };
}

/**
 * Computes the deterministic dice pool breakdown for a free combined WoD roll (V20 or V5).
 */
export function computeWodComposedPool(
  input: WodComposedPoolInput,
): WodComposedPoolBreakdown {
  const isV5 = input.rulePreset === 'vampire-v5';
  const primaryValue =
    input.primaryTrait && Number.isFinite(input.primaryTrait.value)
      ? Math.max(0, Math.round(input.primaryTrait.value))
      : 0;
  const secondaryValue =
    input.secondaryTrait && Number.isFinite(input.secondaryTrait.value)
      ? Math.max(0, Math.round(input.secondaryTrait.value))
      : 0;
  const modifier =
    typeof input.modifier === 'number' && Number.isFinite(input.modifier)
      ? Math.max(-10, Math.min(10, Math.round(input.modifier)))
      : 0;

  const bloodSurgeApplied = isV5 && Boolean(input.bloodSurgeActive);
  const resolvedSurgeBonus =
    typeof input.bloodSurgeBonus === 'number' && Number.isFinite(input.bloodSurgeBonus)
      ? Math.max(0, Math.round(input.bloodSurgeBonus))
      : getV5BloodSurgeBonus(input.bloodPotency);
  const bloodSurgeBonus = bloodSurgeApplied ? resolvedSurgeBonus : 0;

  const hasDisciplineTrait =
    input.primaryTrait?.group === 'disciplines' ||
    input.secondaryTrait?.group === 'disciplines';
  const resolvedPowerBonus =
    typeof input.bloodPotency === 'number' && Number.isFinite(input.bloodPotency)
      ? getV5BloodPotencyStats(input.bloodPotency).powerBonusDice
      : 0;
  const powerBonusDiceApplied = isV5 && hasDisciplineTrait ? resolvedPowerBonus : 0;

  const rawPool =
    primaryValue + secondaryValue + modifier + bloodSurgeBonus + powerBonusDiceApplied;

  const primaryDomain = classifyWodTraitDomain(input.primaryTrait);
  const secondaryDomain = classifyWodTraitDomain(input.secondaryTrait);
  const hasPhysicalTrait =
    primaryDomain === 'physical' || secondaryDomain === 'physical';
  const hasSocialMentalTrait =
    primaryDomain === 'social_mental' || secondaryDomain === 'social_mental';
  const poolDomain: WodPoolDomain =
    hasPhysicalTrait && hasSocialMentalTrait
      ? 'mixed'
      : hasPhysicalTrait
        ? 'physical'
        : hasSocialMentalTrait
          ? 'social_mental'
          : 'unknown';

  const rawWound =
    typeof input.woundPenalty === 'number' && Number.isFinite(input.woundPenalty)
      ? Math.min(0, Math.round(input.woundPenalty))
      : 0;
  const healthImpairedOnSheet = rawWound < 0;
  const isWillpowerImpaired = isV5 && Boolean(input.isWillpowerImpaired);
  // V5 RAW: Health Impaired penalizes Physical pools; Willpower Impaired penalizes Social/Mental pools.
  // Both apply a maximum single -2 cap even on mixed pools. V20 wound penalties remain global.
  const healthEligible = isV5
    ? healthImpairedOnSheet && hasPhysicalTrait
    : healthImpairedOnSheet;
  const willpowerEligible = isV5 && isWillpowerImpaired && hasSocialMentalTrait;
  const impairedPenaltySource: 'none' | 'health' | 'willpower' | 'both' =
    healthEligible && willpowerEligible
      ? 'both'
      : healthEligible
        ? 'health'
        : willpowerEligible
          ? 'willpower'
          : 'none';
  const healthImpairedApplied = !input.ignoreWoundPenalty && healthEligible;
  const willpowerImpairedApplied =
    !input.ignoreWoundPenalty && !healthEligible && willpowerEligible;
  const appliedWoundPenalty = input.ignoreWoundPenalty
    ? 0
    : healthEligible
      ? rawWound
      : willpowerEligible
        ? -2
        : 0;
  const effectivePool = Math.max(0, Math.min(30, rawPool + appliedWoundPenalty));

  const specialty = !isV5 && Boolean(input.specialty);
  const useWillpower =
    !isV5 &&
    Boolean(input.useWillpower) &&
    (input.willpowerAvailable === undefined || input.willpowerAvailable > 0);

  const hasSelectedTrait = Boolean(input.primaryTrait || input.secondaryTrait);
  const isIncapacitated = hasSelectedTrait && effectivePool <= 0;
  const canRoll = hasSelectedTrait && (effectivePool > 0 || useWillpower);

  const clampedHunger =
    typeof input.hunger === 'number' && Number.isFinite(input.hunger)
      ? Math.max(0, Math.min(5, Math.round(input.hunger)))
      : 0;
  const hungerDiceCount = isV5 ? Math.min(effectivePool, clampedHunger) : 0;
  const normalDiceCount = effectivePool - hungerDiceCount;

  const rawDifficulty =
    typeof input.difficulty === 'number' && Number.isFinite(input.difficulty)
      ? input.difficulty
      : isV5
        ? 2
        : 6;
  const difficulty = isV5
    ? Math.max(1, Math.min(10, Math.round(rawDifficulty)))
    : Math.max(2, Math.min(10, Math.round(rawDifficulty)));

  const traitParts = [
    input.primaryTrait ? `${input.primaryTrait.label} (${primaryValue})` : null,
    input.secondaryTrait ? `${input.secondaryTrait.label} (${secondaryValue})` : null,
  ].filter(Boolean);
  const powerTag = input.labels?.powerTag ?? 'PODER';
  const powerPart = powerBonusDiceApplied > 0 ? ` +${powerBonusDiceApplied} ${powerTag}` : '';
  const modPart = modifier > 0 ? ` +${modifier}` : modifier < 0 ? ` ${modifier}` : '';
  const displayLabel = `${traitParts.join(' + ')}${powerPart}${modPart}`.trim();

  const diffTn = input.labels?.diffTn ?? 'DIFF';
  const diffMeta = input.labels?.diffMeta ?? 'META';
  const hungerWord = input.labels?.hungerWord ?? 'FOME';
  const specTag = input.labels?.specTag ?? 'SPEC';
  const wpTag = input.labels?.wpTag ?? '+1 WP';

  const formulaSummary = isV5
    ? `${effectivePool}d10${hungerDiceCount > 0 ? ` (${hungerDiceCount} ${hungerWord})` : ''} · ${diffMeta} ${difficulty}`
    : `${effectivePool}d10 @ ${diffTn} ${difficulty}${specialty ? ` · ${specTag}` : ''}${useWillpower ? ` · ${wpTag}` : ''}`;

  return {
    rulePreset: input.rulePreset,
    primaryValue,
    secondaryValue,
    modifier,
    bloodSurgeApplied,
    bloodSurgeBonus,
    powerBonusDiceApplied,
    poolDomain,
    rawPool,
    appliedWoundPenalty,
    healthImpairedApplied,
    isWillpowerImpaired,
    willpowerImpairedApplied,
    impairedPenaltySource,
    effectivePool,
    isIncapacitated,
    canRoll,
    hungerDiceCount,
    normalDiceCount,
    difficulty,
    specialty,
    useWillpower,
    displayLabel,
    formulaSummary,
  };
}
