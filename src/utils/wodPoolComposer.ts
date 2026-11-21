import { getV5BloodSurgeBonus } from '../core/formula.ts';
import type { AppLanguage } from '../core/i18n.ts';
import {
  type AttributeGroup,
  type CharacterSheetState,
  getSheetVirtues,
  resolveRulePreset,
  type SheetField,
} from '../core/sheetModel.ts';
import { classifyTraitField } from '../core/xpSystem.ts';

export type WodTraitGroup = 'attributes' | 'skills' | 'disciplines' | 'virtues';
export type WodComposerRulePreset = 'storyteller-v20' | 'vampire-v5';

export interface WodRollableTrait {
  id: string;
  key: string;
  label: string;
  value: number;
  group: WodTraitGroup;
  specialty?: boolean;
  specialtyLabel?: string;
}

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
}

export interface WodComposedPoolInput {
  rulePreset: WodComposerRulePreset;
  primaryTrait: Pick<WodRollableTrait, 'label' | 'value'> | null;
  secondaryTrait?: Pick<WodRollableTrait, 'label' | 'value'> | null;
  modifier?: number;
  woundPenalty?: number;
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
  rawPool: number;
  appliedWoundPenalty: number;
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
]);

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

  const rawPool = primaryValue + secondaryValue + modifier + bloodSurgeBonus;
  const rawWound =
    typeof input.woundPenalty === 'number' && Number.isFinite(input.woundPenalty)
      ? Math.min(0, Math.round(input.woundPenalty))
      : 0;
  const appliedWoundPenalty = input.ignoreWoundPenalty ? 0 : rawWound;
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
  const modPart = modifier > 0 ? ` +${modifier}` : modifier < 0 ? ` ${modifier}` : '';
  const displayLabel = `${traitParts.join(' + ')}${modPart}`.trim();

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
    rawPool,
    appliedWoundPenalty,
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
