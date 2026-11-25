import type { RulePreset } from '../core/formula.ts';
import type { SheetCard, SheetField, SystemId } from '../core/sheetModel.ts';
import { findDisciplineByIdOrName } from '../core/wodClansDisciplinesCatalog.ts';
import { V20_SKILLS_CATALOG, V5_SKILLS_CATALOG } from '../core/wodSkillsCatalog.ts';

export type DotRatingScale = 5 | 10;

export interface WodDotRatingConfig {
  enabled: boolean;
  min: number;
  max: DotRatingScale;
}

const DISABLED_CONFIG: WodDotRatingConfig = {
  enabled: false,
  min: 0,
  max: 5,
};

const IGNORED_KEYS = new Set([
  'generation',
  'nivel',
  'level',
  'fortitude_armor',
  'hunger',
  'health',
  'blood_pool',
  'hp',
  'pv',
  'estamina',
  'slots_1st',
  'slots_2nd',
  'espacos_magia',
  'hit_dice',
  'action_surge',
]);

const ATTRIBUTE_KEYS = new Set([
  'strength',
  'dexterity',
  'stamina',
  'charisma',
  'manipulation',
  'appearance',
  'composure',
  'perception',
  'intelligence',
  'wits',
  'resolve',
  'forca',
  'destreza',
  'vigor',
  'carisma',
  'manipulacao',
  'aparencia',
  'autocontrole',
  'percepcao',
  'inteligencia',
  'raciocinio',
  'determinacao',
]);

const HUMANITY_PATH_KEYS = new Set([
  'humanity',
  'humanidade',
  'trilha',
  'path',
  'road',
  'via',
  'moralidade',
]);

const WILLPOWER_BASE_KEYS = new Set([
  'willpower',
  'willpower_base',
  'willpower_rating',
  'forca_de_vontade',
  'vontade',
]);

const VIRTUE_KEYS = new Set([
  'conscience',
  'consciencia',
  'conviction',
  'conviccao',
  'self_control',
  'autocontrole',
  'instinct',
  'instinto',
  'courage',
  'coragem',
]);

const BACKGROUND_KEYS = new Set([
  'allies',
  'contacts',
  'fame',
  'herd',
  'influence',
  'mentor',
  'resources',
  'retainers',
  'status',
  'haven',
  'domain',
  'mask',
  'mawla',
  'generation_bg',
  'aliados',
  'contatos',
  'fama',
  'rebanho',
  'influencia',
  'recursos',
  'lacaios',
  'refugio',
  'dominio',
]);

const CATALOG_SKILL_KEYS = new Set([
  ...V20_SKILLS_CATALOG.map((s) => s.varName),
  ...V5_SKILLS_CATALOG.map((s) => s.varName),
  'brawl',
  'firearms',
  'stealth',
  'subterfuge',
  'occult',
  'briga',
  'armas_de_fogo',
  'furtividade',
  'labia',
  'ocultismo',
  'atletismo',
  'investigacao',
  'lideranca',
]);

/**
 * Resolves the next numeric rating when a dot is clicked/tapped.
 * Clicking the currently active dot (`clickedDot === currentValue`) decrements to `N - 1`
 * clamped at `min` (allowing 1 -> 0 when `min === 0`, or protecting `min === 1`).
 */
export function resolveDotClickValue(
  currentValue: number,
  clickedDot: number,
  min = 0,
  max = 5,
): number {
  const safeMin = Number.isFinite(min) ? Math.max(0, Math.round(min)) : 0;
  const safeMax = Number.isFinite(max)
    ? Math.max(safeMin, Math.round(max))
    : Math.max(safeMin, 5);
  const safeCurrent = Number.isFinite(currentValue) ? Math.round(currentValue) : safeMin;
  const safeClicked = Number.isFinite(clickedDot) ? Math.round(clickedDot) : safeMin;

  if (safeClicked === safeCurrent) {
    return Math.min(safeMax, Math.max(safeMin, safeCurrent - 1));
  }
  return Math.min(safeMax, Math.max(safeMin, safeClicked));
}

/**
 * Resolves the next numeric rating for accessible keyboard navigation on a DotRating group.
 * Returns `null` when the key is not a rating navigation key.
 */
export function resolveDotKeyboardValue(
  currentValue: number,
  key: string,
  min = 0,
  max = 5,
): number | null {
  const safeMin = Number.isFinite(min) ? Math.max(0, Math.round(min)) : 0;
  const safeMax = Number.isFinite(max)
    ? Math.max(safeMin, Math.round(max))
    : Math.max(safeMin, 5);
  const rawCurrent = Number.isFinite(currentValue) ? Math.round(currentValue) : safeMin;
  const safeCurrent = Math.min(safeMax, Math.max(safeMin, rawCurrent));

  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return Math.min(safeMax, safeCurrent + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return Math.max(safeMin, safeCurrent - 1);
    case 'Home':
      return safeMin;
    case 'End':
      return safeMax;
    default:
      return null;
  }
}

/**
 * Determines whether a sheet field is eligible for the WoD DotRating control
 * and resolves its scale (`5` or `10`) and lower bound (`min`).
 */
export function resolveWodDotRatingConfig(
  field: Pick<
    SheetField,
    'id' | 'key' | 'label' | 'kind' | 'max' | 'damageTrack' | 'attributeGroup' | 'xpCategory'
  >,
  card?: Pick<SheetCard, 'id' | 'code' | 'title'> | null,
  rulePreset?: RulePreset | null,
  systemId?: SystemId,
): WodDotRatingConfig {
  if (rulePreset !== 'storyteller-v20' && rulePreset !== 'vampire-v5') {
    return DISABLED_CONFIG;
  }
  if (systemId !== undefined && systemId !== 'wod') {
    return DISABLED_CONFIG;
  }

  const cardSig = card ? `${card.code ?? ''} ${card.title ?? ''}`.toUpperCase() : '';
  if (/ABILITY_SCORES|SPELLCASTING|CYBERPUNK|NETRUNNER|NET\/\/RUNNER/.test(cardSig)) {
    return DISABLED_CONFIG;
  }

  if (field.kind !== 'number' && field.kind !== 'resource') {
    return DISABLED_CONFIG;
  }
  if (field.damageTrack) {
    return DISABLED_CONFIG;
  }
  if (typeof field.max === 'number' && Number.isFinite(field.max) && field.max > 10) {
    return DISABLED_CONFIG;
  }

  const key = (field.key ?? '').trim().toLowerCase();
  if (!key || IGNORED_KEYS.has(key)) {
    return DISABLED_CONFIG;
  }

  if (field.kind === 'resource') {
    // Willpower resource tracks current/max points and V5 superficial damage; keep segmented track.
    if (field.id === 'f_willpower' || WILLPOWER_BASE_KEYS.has(key)) {
      return DISABLED_CONFIG;
    }
    if (field.id === 'f_humanity' || HUMANITY_PATH_KEYS.has(key)) {
      const scale: DotRatingScale =
        typeof field.max === 'number' && Number.isFinite(field.max) && field.max <= 5 ? 5 : 10;
      return { enabled: true, min: 0, max: scale };
    }
    if (
      VIRTUE_KEYS.has(key) &&
      (field.max === undefined || (Number.isFinite(field.max) && field.max <= 5))
    ) {
      return { enabled: true, min: 0, max: 5 };
    }
    return DISABLED_CONFIG;
  }

  const isAttribute =
    field.attributeGroup !== undefined ||
    field.xpCategory === 'attribute' ||
    ATTRIBUTE_KEYS.has(key) ||
    card?.id === 'card_atributos' ||
    /ATTRIBUTE|ATRIBUTO/.test(cardSig);

  const isSkill =
    field.xpCategory === 'skill' ||
    CATALOG_SKILL_KEYS.has(key) ||
    card?.id === 'card_skills' ||
    /SKILL|PERICIA|PERÍCIA|HABILIDAD|TALENT|KNOWLEDGE/.test(cardSig);

  const isDiscipline =
    field.xpCategory === 'discipline' ||
    field.xpCategory === 'discipline_clan' ||
    field.xpCategory === 'discipline_out_of_clan' ||
    field.xpCategory === 'discipline_caitiff' ||
    findDisciplineByIdOrName(key) !== null ||
    card?.id === 'card_arcano' ||
    /DISCIPLIN|ARCANO|PODER|POWER|GIFT|SPHERE|ESFERA/.test(cardSig);

  const isVirtueOrTrack =
    field.xpCategory === 'virtue' ||
    VIRTUE_KEYS.has(key) ||
    HUMANITY_PATH_KEYS.has(key) ||
    WILLPOWER_BASE_KEYS.has(key) ||
    /VIRTUE|VIRTUDE|MORAL|TRILHA|PATH|CONVIC/.test(cardSig);

  const isBackground =
    field.xpCategory === 'advantage' ||
    card?.id === 'card_backgrounds' ||
    field.id.startsWith('f_adv_') ||
    field.id.startsWith('f_bg_') ||
    BACKGROUND_KEYS.has(key) ||
    /ANTECEDENT|BACKGROUND|VANTAG|ADVANTAGE|MERIT|MÉRITO/.test(cardSig);

  if (!isAttribute && !isSkill && !isDiscipline && !isVirtueOrTrack && !isBackground) {
    return DISABLED_CONFIG;
  }

  let max: DotRatingScale = 5;
  if (typeof field.max === 'number' && Number.isFinite(field.max)) {
    max = field.max > 5 ? 10 : 5;
  } else if (HUMANITY_PATH_KEYS.has(key) || WILLPOWER_BASE_KEYS.has(key)) {
    max = 10;
  }

  return {
    enabled: true,
    min: 0,
    max,
  };
}
