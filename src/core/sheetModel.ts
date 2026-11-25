import {
  evaluateFormula,
  type FrenzyKind,
  getV5BloodSurgeBonus,
  normalizeRulePreset,
  parseWodPoolExpression,
  rollDiceExpression,
  type RulePreset,
  type SoakDamageType,
  type V5RollStatus,
  type VariableMap,
  type WodOutcome,
} from './formula.ts';
import type { AppLanguage } from './i18n.ts';
import {
  type DisciplineAffinity,
  findClanByIdOrName,
  getClansForEdition,
} from './wodClansDisciplinesCatalog.ts';
import {
  createDefaultDnd5eSlots,
  createDefaultDnd5eState,
  DND5E_SKILLS,
  type Dnd5eAbilityKey,
  type Dnd5eHitDieType,
  type Dnd5eRollMode,
  type Dnd5eSkillKey,
  type Dnd5eSkillProficiency,
  type Dnd5eSpellcastingAbilityKey,
  type Dnd5eState,
  normalizeDnd5eState,
} from './dnd5eRules.ts';

export type { RulePreset, SoakDamageType };
export type {
  Dnd5eAbilityKey,
  Dnd5eDeathSavesState,
  Dnd5eHitDiceState,
  Dnd5eHitDieType,
  Dnd5eRollMode,
  Dnd5eSaveProficiencies,
  Dnd5eSkillKey,
  Dnd5eSkillProficiencies,
  Dnd5eSkillProficiency,
  Dnd5eSpellcastingAbilityKey,
  Dnd5eSpellcastingState,
  Dnd5eSpellSlotEntry,
  Dnd5eState,
} from './dnd5eRules.ts';

export const DEVICE_ID_STORAGE_KEY = 'grid_sheet_device_id_v1';

let fallbackInMemoryDeviceId: string | null = null;

function generateUuidV4(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeviceId(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): string {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage
        : null;

  if (targetStorage) {
    try {
      const existing = targetStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (typeof existing === 'string' && existing.trim().length > 0) {
        return existing.trim();
      }
      const created = generateUuidV4();
      targetStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
      fallbackInMemoryDeviceId = created;
      return created;
    } catch {
      // Fall through to in-memory UUID when storage is blocked
    }
  }

  if (!fallbackInMemoryDeviceId) {
    fallbackInMemoryDeviceId = generateUuidV4();
  }
  return fallbackInMemoryDeviceId;
}

export function nowIsoUtc(): string {
  return new Date().toISOString();
}

export function isValidIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}


export type TabId = 'geral' | 'magias' | 'xp';
export type AppMode = 'jogo' | 'edicao';
export type SystemId = 'wod' | 'dnd5e' | 'cyberpunk' | 'default' | 'blank';

export interface SystemOption {
  id: SystemId;
  label: string;
  shortLabel: string;
  description: string;
}

export const SYSTEM_OPTIONS: SystemOption[] = [
  {
    id: 'wod',
    label: 'WORLD OF DARKNESS (STORYTELLER d10)',
    shortLabel: 'WOD · STORYTELLER d10',
    description: 'Atributos, Health (Superficial/Aggravated), Willpower, Hunger, Disciplines e pools Nd10',
  },
  {
    id: 'dnd5e',
    label: 'D&D 5E (D20 SYSTEM)',
    shortLabel: 'D&D 5E · d20',
    description: '6 Atributos D&D 5e, Modificadores, HP, Slots de Magia, Perícias e 1d20',
  },
  {
    id: 'cyberpunk',
    label: 'NET//RUNNER D10 PROTOCOL',
    shortLabel: 'CYBERPUNK · d10',
    description: 'Sistema cyberpunk 1d10 com Reflexos, Interface e Invasão ICE',
  },
  {
    id: 'default',
    label: 'SISTEMA GENÉRICO EXEMPLO (D20)',
    shortLabel: 'GENÉRICO · d20',
    description: 'Atributos D20, PV segmentado, mochila com peso e módulo arcano',
  },
  {
    id: 'blank',
    label: 'CUSTOM · CRIAR DO ZERO',
    shortLabel: 'CUSTOM · DO ZERO',
    description: 'Ficha vazia para criar cada bloco e cada campo manualmente no Modo Edição',
  },
];

export type FieldKind =
  | 'number'
  | 'text'
  | 'calculated'
  | 'resource'
  | 'boolean'
  | 'roll'
  | 'repeatable';

export type AttributeGroup = 'physical' | 'social' | 'mental';

export interface RepeatableRow {
  id: string;
  col1: string;
  col2: number | string;
}

export interface SheetField {
  id: string;
  key: string; // variable identifier used in formulas (e.g. 'forca', 'mod_forca')
  label: string;
  kind: FieldKind;
  attributeGroup?: AttributeGroup;
  value?: number | string | boolean;
  max?: number;
  maxFormula?: string;
  damageTrack?: boolean;
  bashingDamage?: number;
  lethalDamage?: number;
  superficialDamage?: number;
  aggravatedDamage?: number;
  stains?: number;
  soakDamageType?: SoakDamageType;
  formula?: string;
  showPlus?: boolean;
  rollLabel?: string;
  rollExpr?: string;
  rollDifficulty?: number;
  rollDifficultyV5?: number;
  rollSpecialty?: boolean;
  rollMod?: number;
  isSoak?: boolean;
  xpCategory?: FieldXpCategory;
  columns?: [string, string];
  col2Type?: 'number' | 'text';
  rows?: RepeatableRow[];
  hint?: string;
  placeholder?: string;
}

export interface SheetCard {
  id: string;
  tab: TabId;
  code: string; // e.g. "//ATRIBUTOS"
  title: string;
  colSpan?: 1 | 2;
  fields: SheetField[];
}

export interface RollLogEntry {
  id: string;
  timestamp: string;
  label: string;
  total: number;
  formula: string;
  breakdown: string;
  rolls?: number[];
  difficulty?: number;
  specialty?: boolean;
  willpowerUsed?: boolean;
  isSoak?: boolean;
  soakDamageType?: SoakDamageType;
  onesCount?: number;
  canceledOnes?: number;
  doubledTensCount?: number;
  outcome?: WodOutcome;
  status?: V5RollStatus;
  margin?: number;
  isCritical?: boolean;
  isFumble?: boolean;
  isPoolRoll?: boolean;
  rulePreset?: RulePreset;
  woundPenalty?: number;
  normalDice?: number[];
  normalRolls?: number[];
  hungerDice?: number;
  hungerRolls?: number[];
  messyCritical?: boolean;
  isMessyCritical?: boolean;
  bestialFailure?: boolean;
  isBestialFailure?: boolean;
  critPairsCount?: number;
  isRouseCheck?: boolean;
  isBloodSurge?: boolean;
  isWillpowerReroll?: boolean;
  isRemorseCheck?: boolean;
  isFrenzyRoll?: boolean;
  frenzyKind?: FrenzyKind;
  humanityLost?: boolean;
  rerolledIndices?: number[];
  d20Mode?: Dnd5eRollMode;
  d20Dice?: number[];
  d20Kept?: number;
  d20Discarded?: number | null;
  isDeathSave?: boolean;
}

export type XpUpgradeCategory = 'attribute' | 'skill' | 'discipline' | 'virtue';
export type FieldXpCategory = XpUpgradeCategory | DisciplineAffinity | 'advantage';
export type XpRulePreset = RulePreset;

export interface VirtuesState {
  conscience: number;
  selfControl: number;
  courage: number;
}

export interface TouchstoneEntry {
  id: string;
  conviction: string;
  touchstone: string;
  notes?: string;
}

export type MeritFlawKind = 'merit' | 'flaw';

export interface MeritFlawEntry {
  id: string;
  kind: MeritFlawKind;
  name: string;
  rating: number;
  notes?: string;
  catalogId?: string;
}

export interface HavenEntry {
  id: string;
  name: string;
  location?: string;
  rating: number;
  traits: string[];
  notes?: string;
}

export interface XpLedgerEntry {
  id: string;
  timestamp: string;
  kind: 'award' | 'upgrade';
  delta: number;
  xpSpent?: number;
  label: string;
  fieldId?: string;
  category?: XpUpgradeCategory;
  fromValue?: number;
  toValue?: number;
  createdField?: boolean;
  createdFieldIds?: string[];
  createdCardId?: string;
  prevSpecialtyLabel?: string;
  prevRollSpecialty?: boolean;
}

export interface XpState {
  totalEarned: number;
  spent: number;
  ledger: XpLedgerEntry[];
}

export interface CharacterSheetState {
  id?: string;
  systemId?: SystemId;
  systemName: string;
  systemCode: string;
  characterName: string;
  revision: number;
  updatedAt: string;
  deviceId: string;
  rulePreset?: RulePreset;
  xpRulePreset?: XpRulePreset;
  customUseNewLevelBase?: boolean;
  bloodPool?: number;
  bloodSurge?: boolean;
  stains?: number;
  virtues?: VirtuesState;
  touchstones?: TouchstoneEntry[];
  meritsFlaws?: MeritFlawEntry[];
  havens?: HavenEntry[];
  dnd5eState?: Dnd5eState;
  cards: SheetCard[];
  rollLogs: RollLogEntry[];
  xp?: XpState;
}

export type Sheet = CharacterSheetState;

export type CanonicalFieldType =
  | 'number'
  | 'text'
  | 'resource'
  | 'calculated'
  | 'boolean'
  | 'dots'
  | 'roll_button'
  | 'repeatable_list';

export interface CanonicalRollConfig {
  mode: 'standard' | 'storyteller_skill' | 'storyteller_soak';
  expression: string;
  difficulty?: number;
  specialty?: boolean;
  useWillpower?: boolean;
}

export interface CanonicalField {
  id: string;
  label: string;
  type: CanonicalFieldType;
  value?: number | string | boolean | null;
  maxValue?: number | null;
  maxDots?: number;
  formula?: string;
  rollConfig?: CanonicalRollConfig;
  subFields?: CanonicalField[];
  rows?: Array<Record<string, number | string | boolean | null>>;
}

export interface CanonicalBentoCard {
  id: string;
  tag?: string;
  title: string;
  columns: number;
  fields: CanonicalField[];
}

export interface CanonicalTab {
  id: string;
  title: string;
  cards: CanonicalBentoCard[];
}

export interface CanonicalSheet {
  id: string;
  name: string;
  systemId: string;
  revision: number;
  updatedAt: string;
  deviceId: string;
  tabs: CanonicalTab[];
}

export interface WorkspaceState {
  activeSystemId: SystemId;
  sheetsBySystem: Partial<Record<SystemId, CharacterSheetState>>;
}

export interface ComputedFieldInfo {
  value: number;
  formatted: string;
  ok: boolean;
  error?: string;
}

export interface SheetEvaluation {
  variables: VariableMap;
  computedByFieldId: Record<string, ComputedFieldInfo>;
  formulaErrors: Array<{ fieldId: string; label: string; error: string }>;
  totalCargoWeight: number;
}

interface WodAttributeSpec {
  id: string;
  key: string;
  label: string;
  attributeGroup: AttributeGroup;
}

interface WodIdentitySpec {
  id: string;
  key: string;
  label: string;
  placeholder?: string;
}

const WOD_V20_ATTRIBUTE_SPECS: readonly WodAttributeSpec[] = [
  { id: 'f_strength', key: 'strength', label: 'STRENGTH', attributeGroup: 'physical' },
  { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', attributeGroup: 'physical' },
  { id: 'f_stamina', key: 'stamina', label: 'STAMINA', attributeGroup: 'physical' },
  { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', attributeGroup: 'social' },
  { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', attributeGroup: 'social' },
  { id: 'f_appearance', key: 'appearance', label: 'APPEARANCE', attributeGroup: 'social' },
  { id: 'f_perception', key: 'perception', label: 'PERCEPTION', attributeGroup: 'mental' },
  { id: 'f_intelligence', key: 'intelligence', label: 'INTELLIGENCE', attributeGroup: 'mental' },
  { id: 'f_wits', key: 'wits', label: 'WITS', attributeGroup: 'mental' },
];

const WOD_V5_ATTRIBUTE_SPECS: readonly WodAttributeSpec[] = [
  { id: 'f_strength', key: 'strength', label: 'STRENGTH', attributeGroup: 'physical' },
  { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', attributeGroup: 'physical' },
  { id: 'f_stamina', key: 'stamina', label: 'STAMINA', attributeGroup: 'physical' },
  { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', attributeGroup: 'social' },
  { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', attributeGroup: 'social' },
  { id: 'f_composure', key: 'composure', label: 'COMPOSURE', attributeGroup: 'social' },
  { id: 'f_intelligence', key: 'intelligence', label: 'INTELLIGENCE', attributeGroup: 'mental' },
  { id: 'f_wits', key: 'wits', label: 'WITS', attributeGroup: 'mental' },
  { id: 'f_resolve', key: 'resolve', label: 'RESOLVE', attributeGroup: 'mental' },
];

const WOD_V20_IDENTITY_SPECS: readonly WodIdentitySpec[] = [
  { id: 'f_concept', key: 'concept', label: 'CONCEPT' },
  { id: 'f_sire', key: 'sire', label: 'SIRE' },
  { id: 'f_chronicle', key: 'chronicle', label: 'CHRONICLE' },
  { id: 'f_nature', key: 'nature', label: 'NATURE' },
  { id: 'f_demeanor', key: 'demeanor', label: 'DEMEANOR' },
  { id: 'f_clan_weakness', key: 'clan_weakness', label: 'CLAN WEAKNESS' },
];

const WOD_V5_IDENTITY_SPECS: readonly WodIdentitySpec[] = [
  { id: 'f_concept', key: 'concept', label: 'CONCEPT' },
  { id: 'f_sire', key: 'sire', label: 'SIRE' },
  { id: 'f_chronicle', key: 'chronicle', label: 'CHRONICLE' },
  { id: 'f_predator_type', key: 'predator_type', label: 'PREDATOR TYPE', placeholder: 'Siren' },
  { id: 'f_ambition', key: 'ambition', label: 'AMBITION', placeholder: 'Control the Harbor Elysium' },
  { id: 'f_desire', key: 'desire', label: 'DESIRE', placeholder: 'Expose the rival Primogen' },
  { id: 'f_clan_bane', key: 'clan_bane', label: 'CLAN BANE', placeholder: 'Rarefied Tastes' },
  { id: 'f_clan_compulsion', key: 'clan_compulsion', label: 'CLAN COMPULSION', placeholder: 'Arrogance' },
];

export function createWorldOfDarknessSheet(): CharacterSheetState {
  return {
    id: 'sheet_wod',
    systemId: 'wod',
    systemName: 'WORLD OF DARKNESS // STORYTELLER',
    systemCode: '/SYS: WORLD OF DARKNESS · d10 STORYTELLER',
    characterName: 'JULIAN CROSS · NEONATE (VENTRUE)',
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    rulePreset: 'storyteller-v20',
    xpRulePreset: 'storyteller-v20',
    bloodPool: 10,
    virtues: { conscience: 3, selfControl: 3, courage: 4 },
    cards: [
      {
        id: 'card_identidade',
        tab: 'geral',
        code: '//CHRONICLE_ID',
        title: 'IDENTITY & LINEAGE',
        colSpan: 2,
        fields: [
          {
            id: 'f_nome',
            key: 'character_name',
            label: 'NAME',
            kind: 'text',
            value: 'Julian Cross',
          },
          {
            id: 'f_clan',
            key: 'clan',
            label: 'CLAN / FACTION',
            kind: 'text',
            value: 'Ventrue',
          },
          {
            id: 'f_generation',
            key: 'generation',
            label: 'GENERATION',
            kind: 'number',
            value: 10,
          },
          {
            id: 'f_blood_potency',
            key: 'blood_potency',
            label: 'BLOOD_POTENCY',
            kind: 'calculated',
            formula: 'max(1, 13 - generation)',
            showPlus: false,
          },
          { id: 'f_concept', key: 'concept', label: 'CONCEPT', kind: 'text', value: 'Corporate Fixer' },
          { id: 'f_sire', key: 'sire', label: 'SIRE', kind: 'text', value: 'Helena Vance' },
          { id: 'f_chronicle', key: 'chronicle', label: 'CHRONICLE', kind: 'text', value: 'Nocturne Harbor' },
          { id: 'f_nature', key: 'nature', label: 'NATURE', kind: 'text', value: 'Director' },
          { id: 'f_demeanor', key: 'demeanor', label: 'DEMEANOR', kind: 'text', value: 'Architect' },
          {
            id: 'f_clan_weakness',
            key: 'clan_weakness',
            label: 'CLAN WEAKNESS',
            kind: 'text',
            value: 'Refined Palate (Specific Vessel Type)',
          },
        ],
      },
      {
        id: 'card_atributos',
        tab: 'geral',
        code: '//ATTRIBUTES',
        title: 'PHYSICAL · SOCIAL · MENTAL',
        colSpan: 1,
        fields: [
          { id: 'f_strength', key: 'strength', label: 'STRENGTH', kind: 'number', attributeGroup: 'physical', value: 3 },
          { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', kind: 'number', attributeGroup: 'physical', value: 4 },
          { id: 'f_stamina', key: 'stamina', label: 'STAMINA', kind: 'number', attributeGroup: 'physical', value: 3 },
          { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', kind: 'number', attributeGroup: 'social', value: 3 },
          { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', kind: 'number', attributeGroup: 'social', value: 4 },
          { id: 'f_appearance', key: 'appearance', label: 'APPEARANCE', kind: 'number', attributeGroup: 'social', value: 3 },
          { id: 'f_perception', key: 'perception', label: 'PERCEPTION', kind: 'number', attributeGroup: 'mental', value: 3 },
          { id: 'f_intelligence', key: 'intelligence', label: 'INTELLIGENCE', kind: 'number', attributeGroup: 'mental', value: 3 },
          { id: 'f_wits', key: 'wits', label: 'WITS', kind: 'number', attributeGroup: 'mental', value: 3 },
          {
            id: 'f_initiative',
            key: 'initiative',
            label: 'INITIATIVE_MOD',
            kind: 'calculated',
            formula: 'dexterity + wits',
            showPlus: true,
          },
          {
            id: 'f_defense',
            key: 'defense',
            label: 'DEFENSE',
            kind: 'calculated',
            formula: 'min(dexterity, wits)',
            showPlus: false,
          },
        ],
      },
      {
        id: 'card_combate',
        tab: 'geral',
        code: '//VITAL_STATUS',
        title: 'HEALTH · WILLPOWER · HUNGER',
        colSpan: 1,
        fields: [
          {
            id: 'f_health',
            key: 'health',
            label: 'HEALTH',
            kind: 'resource',
            value: 7,
            max: 7,
            damageTrack: true,
            superficialDamage: 0,
            aggravatedDamage: 0,
          },
          {
            id: 'f_willpower',
            key: 'willpower',
            label: 'WILLPOWER',
            kind: 'resource',
            value: 6,
            max: 8,
          },
          {
            id: 'f_hunger',
            key: 'hunger',
            label: 'HUNGER',
            kind: 'resource',
            value: 1,
            max: 5,
          },
          {
            id: 'f_humanity',
            key: 'humanity',
            label: 'HUMANITY',
            kind: 'resource',
            value: 7,
            max: 10,
          },
          {
            id: 'f_fortitude_armor',
            key: 'fortitude_armor',
            label: 'FORTITUDE / ARMOR',
            kind: 'number',
            value: 0,
          },
          {
            id: 'f_wp_boost',
            key: 'wp_boost',
            label: 'WILLPOWER (+1 AUTO SUCCESS)',
            kind: 'boolean',
            value: false,
            hint: 'SPENT ON NEXT ROLL',
          },
          {
            id: 'f_soak',
            key: 'soak_roll',
            label: 'SOAK DAMAGE',
            kind: 'roll',
            rollLabel: 'ROLL SOAK',
            rollExpr: 'pool(stamina + fortitude_armor, 6)',
            rollDifficulty: 6,
            rollSpecialty: false,
            rollMod: 0,
            isSoak: true,
          },
        ],
      },
      {
        id: 'card_skills',
        tab: 'geral',
        code: '//SKILLS_&_POOLS',
        title: 'ABILITIES & DICE POOLS',
        colSpan: 1,
        fields: [
          { id: 'f_brawl', key: 'brawl', label: 'BRAWL', kind: 'number', value: 2 },
          { id: 'f_firearms', key: 'firearms', label: 'FIREARMS', kind: 'number', value: 3 },
          { id: 'f_stealth', key: 'stealth', label: 'STEALTH', kind: 'number', value: 3 },
          { id: 'f_subterfuge', key: 'subterfuge', label: 'SUBTERFUGE', kind: 'number', value: 4 },
          {
            id: 'f_roll_brawl',
            key: 'roll_brawl',
            label: 'MELEE / BRAWL',
            kind: 'roll',
            rollLabel: 'ROLL BRAWL',
            rollExpr: 'pool(strength + brawl, 6)',
            rollDifficulty: 6,
            rollSpecialty: false,
            rollMod: 0,
          },
          {
            id: 'f_roll_firearms',
            key: 'roll_firearms',
            label: 'RANGED ATTACK',
            kind: 'roll',
            rollLabel: 'ROLL FIREARMS',
            rollExpr: 'pool(dexterity + firearms, 6)',
            rollDifficulty: 6,
            rollSpecialty: false,
            rollMod: 0,
          },
          {
            id: 'f_roll_stealth',
            key: 'roll_stealth',
            label: 'STEALTH / SNEAK',
            kind: 'roll',
            rollLabel: 'ROLL STEALTH',
            rollExpr: 'pool(dexterity + stealth, 6)',
            rollDifficulty: 6,
            rollSpecialty: false,
            rollMod: 0,
          },
          {
            id: 'f_roll_subterfuge',
            key: 'roll_subterfuge',
            label: 'SOCIAL MANIPULATION',
            kind: 'roll',
            rollLabel: 'ROLL SUBTERFUGE',
            rollExpr: 'pool(manipulation + subterfuge, 6)',
            rollDifficulty: 6,
            rollSpecialty: false,
            rollMod: 0,
          },
        ],
      },
      {
        id: 'card_inventario',
        tab: 'geral',
        code: '//INVENTORY',
        title: 'GEAR & CONCEALMENT',
        colSpan: 1,
        fields: [
          {
            id: 'f_mochila',
            key: 'gear',
            label: 'EQUIPMENT',
            kind: 'repeatable',
            columns: ['ITEM', 'WEIGHT (KG)'],
            col2Type: 'number',
            rows: [
              { id: 'r_1', col1: 'Heavy Pistol (9mm)', col2: 1.2 },
              { id: 'r_2', col1: 'Kevlar Trench Coat', col2: 2.5 },
              { id: 'r_3', col1: 'Silver Dagger', col2: 0.5 },
              { id: 'r_4', col1: 'Encrypted Burner Phone', col2: 0.3 },
            ],
          },
          {
            id: 'f_carga_max',
            key: 'carry_limit',
            label: 'CARRY_CAPACITY',
            kind: 'calculated',
            formula: 'strength * 15',
            showPlus: false,
          },
        ],
      },
      {
        id: 'card_arcano',
        tab: 'magias',
        code: '//DISCIPLINES',
        title: 'DISCIPLINES & OCCULT',
        colSpan: 1,
        fields: [
          { id: 'f_dominate', key: 'dominate', label: 'DOMINATE', kind: 'number', value: 3 },
          { id: 'f_presence', key: 'presence', label: 'PRESENCE', kind: 'number', value: 2 },
          { id: 'f_occult', key: 'occult', label: 'OCCULT', kind: 'number', value: 3 },
          {
            id: 'f_dominate_pool',
            key: 'dominate_pool',
            label: 'DOMINATE_POOL',
            kind: 'calculated',
            formula: 'manipulation + dominate',
            showPlus: false,
          },
          {
            id: 'f_roll_dominate',
            key: 'roll_dominate',
            label: 'MESMERIZE / COMMAND',
            kind: 'roll',
            rollLabel: 'ROLL DOMINATE',
            rollExpr: 'pool(manipulation + dominate, 6)',
            rollDifficulty: 6,
            rollSpecialty: false,
            rollMod: 0,
          },
          {
            id: 'f_roll_occult',
            key: 'roll_occult',
            label: 'ARCANE LORE CHECK',
            kind: 'roll',
            rollLabel: 'ROLL OCCULT',
            rollExpr: 'pool(wits + occult, 7)',
            rollDifficulty: 7,
            rollSpecialty: false,
            rollMod: 0,
          },
        ],
      },
      {
        id: 'card_grimorio',
        tab: 'magias',
        code: '//MERITS_&_POWERS',
        title: 'DISCIPLINE POWERS & MERITS',
        colSpan: 1,
        fields: [
          {
            id: 'f_lista_magias',
            key: 'powers',
            label: 'ACTIVE POWERS & BACKGROUNDS',
            kind: 'repeatable',
            columns: ['POWER / MERIT', 'COST / DOTS'],
            col2Type: 'text',
            rows: [
              { id: 'm_1', col1: 'Command (Dominate 1)', col2: 'FREE' },
              { id: 'm_2', col1: 'Mesmerize (Dominate 3)', col2: '1 WP' },
              { id: 'm_3', col1: 'Awe (Presence 1)', col2: '1 BLOOD' },
              { id: 'm_4', col1: 'Haven: Old Observatory', col2: '•••' },
            ],
          },
          {
            id: 'f_frenzy_check',
            key: 'frenzy_resisted',
            label: 'FRENZY RESISTED',
            kind: 'boolean',
            value: true,
            hint: 'BEAST CALMED THIS SCENE',
          },
        ],
      },
      {
        id: 'card_wod_dossier',
        tab: 'magias',
        code: '//TRAITS_&_HAVENS',
        title: 'QUALITIES, FLAWS & HAVENS',
        colSpan: 2,
        fields: [],
      },
      {
        id: 'card_notas',
        tab: 'magias',
        code: '//CHRONICLE_LOG',
        title: 'COTERIE & SESSION NOTES',
        colSpan: 2,
        fields: [
          {
            id: 'f_notas',
            key: 'notas_campanha',
            label: 'CHRONICLE RECORDS',
            kind: 'text',
            value:
              'Elysium meeting confirmed at 02:00. Sheriff suspects Masquerade breach in the Harbor District; secure the obsidian ledger before sunrise.',
          },
        ],
      },
    ],
    meritsFlaws: [
      {
        id: 'mf_v20_1',
        kind: 'merit',
        name: 'Status (Camarilla)',
        rating: 2,
        catalogId: 'status',
        notes: 'Recognized Neonate in the Harbor Court.',
      },
      {
        id: 'mf_v20_2',
        kind: 'flaw',
        name: 'Enemy',
        rating: 2,
        catalogId: 'enemy',
        notes: 'Rival Anarchs tracking Harbor investments.',
      },
    ],
    havens: [
      {
        id: 'hv_v20_1',
        name: 'Old Observatory',
        location: 'Nocturne Heights',
        rating: 3,
        traits: ['library', 'security_system'],
        notes: 'Reinforced shutters and private occult archive.',
      },
    ],
    rollLogs: [
      {
        id: 'log_wod_1',
        timestamp: '23:14',
        label: 'ROLL SUBTERFUGE',
        total: 4,
        formula: '8d10 (DIFF 6)',
        breakdown: '8d10[9, 6, 3, 10, 7, 2, 8, 5] ≥6 → 4 SUCESSOS',
        rolls: [9, 6, 3, 10, 7, 2, 8, 5],
        difficulty: 6,
        outcome: 'success',
        isPoolRoll: true,
      },
      {
        id: 'log_wod_2',
        timestamp: '22:58',
        label: 'ROLL DOMINATE',
        total: 3,
        formula: '7d10 (DIFF 6)',
        breakdown: '7d10[8, 6, 4, 9, 2, 7, 1] ≥6 (-1 CANC BY 1s) → 3 SUCESSOS',
        rolls: [8, 6, 4, 9, 2, 7, 1],
        difficulty: 6,
        onesCount: 1,
        canceledOnes: 1,
        outcome: 'success',
        isPoolRoll: true,
      },
    ],
    xp: {
      totalEarned: 14,
      spent: 0,
      ledger: [
        {
          id: 'xp_seed_1',
          timestamp: '22:00',
          kind: 'award',
          delta: 14,
          label: 'CHRONICLE SESSION AWARD',
        },
      ],
    },
  };
}

export function createDefaultSheet(): CharacterSheetState {
  return createWorldOfDarknessSheet();
}

export function createWorldOfDarknessV5Sheet(): CharacterSheetState {
  const base = createWorldOfDarknessSheet();
  const v5Samples: Record<string, number> = {
    strength: 2,
    dexterity: 3,
    stamina: 3,
    charisma: 3,
    manipulation: 4,
    composure: 3,
    intelligence: 3,
    wits: 3,
    resolve: 2,
  };
  const v5IdentityValues: Record<string, string> = {
    character_name: 'Nadia Voss',
    clan: 'Lasombra',
    concept: 'Harbor Broker',
    sire: 'Marcus Vane',
    chronicle: 'Nocturne Harbor',
    predator_type: 'Siren',
    ambition: 'Control the Harbor Elysium',
    desire: 'Expose the rival Primogen',
    clan_bane: 'Distorted Reflection',
    clan_compulsion: 'Ruthlessness',
  };

  const transformedCards = buildWodV5EditionCards(base.cards).map((card) => {
    if (card.id === 'card_identidade') {
      return {
        ...card,
        fields: card.fields.map((f) => {
          const k = (f.key ?? '').trim().toLowerCase();
          if (k === 'generation') return { ...f, value: 12 };
          if (Object.prototype.hasOwnProperty.call(v5IdentityValues, k)) {
            return { ...f, value: v5IdentityValues[k], placeholder: undefined };
          }
          return f;
        }),
      };
    }
    if (card.id === 'card_atributos') {
      return {
        ...card,
        fields: card.fields.map((f) => {
          const k = (f.key ?? '').trim().toLowerCase();
          return f.kind === 'number' && Object.prototype.hasOwnProperty.call(v5Samples, k)
            ? { ...f, value: v5Samples[k] }
            : f;
        }),
      };
    }
    if (card.id === 'card_combate') {
      const healthMax = Math.max(4, v5Samples.stamina + 3);
      const wpMax = Math.max(2, v5Samples.composure + v5Samples.resolve);
      return {
        ...card,
        fields: card.fields.map((f) => {
          if (f.id === 'f_health' || f.key === 'health') {
            return { ...f, max: healthMax, value: healthMax };
          }
          if (f.id === 'f_willpower' || f.key === 'willpower') {
            return { ...f, max: wpMax, value: wpMax };
          }
          return f;
        }),
      };
    }
    if (card.id === 'card_grimorio') {
      return {
        ...card,
        fields: card.fields.map((f) => {
          if (f.id === 'f_lista_magias' && Array.isArray(f.rows)) {
            return {
              ...f,
              rows: f.rows.map((r) =>
                r.id === 'm_2' || r.id === 'm_3' ? { ...r, col2: '1 ROUSE' } : r,
              ),
            };
          }
          if (f.id === 'f_frenzy_check') {
            return { ...f, value: false };
          }
          return f;
        }),
      };
    }
    return card;
  });

  const {
    bloodPool: _droppedBloodPool,
    virtues: _droppedVirtues,
    meritsFlaws: _droppedMeritsFlaws,
    havens: _droppedHavens,
    ...baseClean
  } = base;

  return {
    ...baseClean,
    id: 'sheet_wod_v5',
    systemId: 'wod',
    systemName: 'VAMPIRE: THE MASQUERADE // V5',
    systemCode: '/SYS: WORLD OF DARKNESS · VAMPIRE V5',
    characterName: 'NADIA VOSS · NEONATE (LASOMBRA)',
    rulePreset: 'vampire-v5',
    xpRulePreset: 'vampire-v5',
    cards: transformedCards,
    touchstones: [
      {
        id: 'ts_v5_1',
        conviction: 'Never break an oath sealed in blood',
        touchstone: 'Mateo Voss (Archivist Cousin)',
        notes: 'Keeps the old harbor ledgers safe during daylight.',
      },
    ],
    meritsFlaws: [
      {
        id: 'mf_v5_1',
        kind: 'merit',
        name: 'Linguistics',
        rating: 2,
        catalogId: 'linguistics',
        notes: 'Latin and Old Venetian.',
      },
      {
        id: 'mf_v5_2',
        kind: 'flaw',
        name: 'Dark Secret',
        rating: 1,
        catalogId: 'dark_secret',
        notes: 'Smuggled an unauthorized fledgling into the city.',
      },
    ],
    havens: [
      {
        id: 'hv_v5_1',
        name: 'Harbor Sub-Vault',
        location: 'Pier 14 Warehouse District',
        rating: 2,
        traits: ['postern', 'security_system'],
        notes: 'Floodgate escape tunnel to the canal.',
      },
    ],
    rollLogs: [],
    xp: {
      totalEarned: 15,
      spent: 0,
      ledger: [],
    },
  };
}

export function createDnd5ePreset(): CharacterSheetState {
  return {
    id: 'sheet_dnd5e',
    systemId: 'dnd5e',
    systemName: 'D&D 5E // D20 SYSTEM',
    systemCode: '/SYS: D&D 5E · D20 HEROIC EDITION',
    characterName: 'LYRA VANCE · ELDRITCH KNIGHT (LV 5)',
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    cards: [
      {
        id: 'card_identidade',
        tab: 'geral',
        code: '//CHARACTER_ID',
        title: 'IDENTITY & CLASS',
        colSpan: 2,
        fields: [
          {
            id: 'f_nome',
            key: 'character_name',
            label: 'CHARACTER NAME',
            kind: 'text',
            value: 'Lyra Vance',
          },
          {
            id: 'f_classe',
            key: 'class_race',
            label: 'CLASS & ANCESTRY',
            kind: 'text',
            value: 'Fighter (Eldritch Knight) · Half-Elf',
          },
          {
            id: 'f_nivel',
            key: 'level',
            label: 'LEVEL',
            kind: 'number',
            value: 5,
          },
          {
            id: 'f_prof',
            key: 'prof',
            label: 'PROFICIENCY_BONUS',
            kind: 'calculated',
            formula: 'floor((level - 1) / 4) + 2',
            showPlus: true,
          },
        ],
      },
      {
        id: 'card_atributos',
        tab: 'geral',
        code: '//ABILITY_SCORES',
        title: 'ATTRIBUTES & MODIFIERS',
        colSpan: 1,
        fields: [
          { id: 'f_strength', key: 'strength', label: 'STRENGTH', kind: 'number', value: 16 },
          {
            id: 'f_mod_str',
            key: 'mod_str',
            label: 'MOD_STR',
            kind: 'calculated',
            formula: 'floor((strength - 10) / 2)',
            showPlus: true,
          },
          { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', kind: 'number', value: 14 },
          {
            id: 'f_mod_dex',
            key: 'mod_dex',
            label: 'MOD_DEX',
            kind: 'calculated',
            formula: 'floor((dexterity - 10) / 2)',
            showPlus: true,
          },
          { id: 'f_constitution', key: 'constitution', label: 'CONSTITUTION', kind: 'number', value: 15 },
          {
            id: 'f_mod_con',
            key: 'mod_con',
            label: 'MOD_CON',
            kind: 'calculated',
            formula: 'floor((constitution - 10) / 2)',
            showPlus: true,
          },
          { id: 'f_intelligence', key: 'intelligence', label: 'INTELLIGENCE', kind: 'number', value: 14 },
          {
            id: 'f_mod_int',
            key: 'mod_int',
            label: 'MOD_INT',
            kind: 'calculated',
            formula: 'floor((intelligence - 10) / 2)',
            showPlus: true,
          },
          { id: 'f_wisdom', key: 'wisdom', label: 'WISDOM', kind: 'number', value: 12 },
          {
            id: 'f_mod_wis',
            key: 'mod_wis',
            label: 'MOD_WIS',
            kind: 'calculated',
            formula: 'floor((wisdom - 10) / 2)',
            showPlus: true,
          },
          { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', kind: 'number', value: 10 },
          {
            id: 'f_mod_cha',
            key: 'mod_cha',
            label: 'MOD_CHA',
            kind: 'calculated',
            formula: 'floor((charisma - 10) / 2)',
            showPlus: true,
          },
        ],
      },
      {
        id: 'card_combate',
        tab: 'geral',
        code: '//COMBAT_STATUS',
        title: 'HP · DEFENSE · ACTIONS',
        colSpan: 1,
        fields: [
          {
            id: 'f_hp',
            key: 'hp',
            label: 'HIT POINTS',
            kind: 'resource',
            value: 44,
            max: 44,
          },
          {
            id: 'f_hit_dice',
            key: 'hit_dice',
            label: 'HIT DICE (d10)',
            kind: 'resource',
            value: 5,
            max: 5,
          },
          {
            id: 'f_action_surge',
            key: 'action_surge',
            label: 'ACTION SURGE',
            kind: 'resource',
            value: 1,
            max: 1,
          },
          {
            id: 'f_ac',
            key: 'armor_class',
            label: 'ARMOR_CLASS',
            kind: 'calculated',
            formula: '16 + min(2, mod_dex)',
            showPlus: false,
          },
          {
            id: 'f_initiative',
            key: 'initiative',
            label: 'INITIATIVE',
            kind: 'calculated',
            formula: 'mod_dex',
            showPlus: true,
          },
          {
            id: 'f_inspiration',
            key: 'inspiration',
            label: 'HEROIC INSPIRATION',
            kind: 'boolean',
            value: true,
            hint: 'REROLL / ADVANTAGE',
          },
          {
            id: 'f_roll_sword',
            key: 'roll_sword',
            label: 'LONGSWORD ATTACK',
            kind: 'roll',
            rollLabel: 'ATTACK LONGSWORD',
            rollExpr: '1d20 + mod_str + prof',
          },
          {
            id: 'f_roll_dmg',
            key: 'roll_dmg',
            label: 'LONGSWORD DAMAGE',
            kind: 'roll',
            rollLabel: 'ROLL DAMAGE',
            rollExpr: '1d8 + mod_str',
          },
        ],
      },
      {
        id: 'card_skills',
        tab: 'geral',
        code: '//SKILLS_&_SAVES',
        title: 'PROFICIENCIES & CHECKS',
        colSpan: 1,
        fields: [
          { id: 'f_athletics', key: 'athletics', label: 'ATHLETICS', kind: 'number', value: 3 },
          { id: 'f_perception', key: 'perception', label: 'PERCEPTION', kind: 'number', value: 3 },
          { id: 'f_arcana', key: 'arcana', label: 'ARCANA', kind: 'number', value: 2 },
          { id: 'f_stealth', key: 'stealth', label: 'STEALTH', kind: 'number', value: 1 },
          {
            id: 'f_roll_athletics',
            key: 'roll_athletics',
            label: 'ATHLETICS CHECK',
            kind: 'roll',
            rollLabel: 'ROLL ATHLETICS',
            rollExpr: '1d20 + mod_str + athletics',
          },
          {
            id: 'f_roll_perception',
            key: 'roll_perception',
            label: 'PERCEPTION CHECK',
            kind: 'roll',
            rollLabel: 'ROLL PERCEPTION',
            rollExpr: '1d20 + mod_wis + perception',
          },
          {
            id: 'f_roll_con_save',
            key: 'roll_con_save',
            label: 'CON SAVING THROW',
            kind: 'roll',
            rollLabel: 'CON SAVE',
            rollExpr: '1d20 + mod_con + prof',
          },
        ],
      },
      {
        id: 'card_inventario',
        tab: 'geral',
        code: '//INVENTORY',
        title: 'ADVENTURING GEAR',
        colSpan: 1,
        fields: [
          {
            id: 'f_mochila',
            key: 'gear',
            label: 'BACKPACK',
            kind: 'repeatable',
            columns: ['ITEM', 'WEIGHT (LB)'],
            col2Type: 'number',
            rows: [
              { id: 'd_1', col1: 'Longsword +1', col2: 3 },
              { id: 'd_2', col1: 'Half Plate Armor', col2: 40 },
              { id: 'd_3', col1: 'Healer Kit & Potions (2x)', col2: 4 },
              { id: 'd_4', col1: 'Explorer Pack', col2: 12 },
            ],
          },
          {
            id: 'f_carga_max',
            key: 'carry_limit',
            label: 'CARRY_CAPACITY',
            kind: 'calculated',
            formula: 'strength * 15',
            showPlus: false,
          },
        ],
      },
      {
        id: 'card_arcano',
        tab: 'magias',
        code: '//SPELLCASTING',
        title: 'ARCANE SLOTS & SAVE DC',
        colSpan: 1,
        fields: [
          {
            id: 'f_spell_dc',
            key: 'spell_dc',
            label: 'SPELL_SAVE_DC',
            kind: 'calculated',
            formula: '8 + prof + mod_int',
            showPlus: false,
          },
          {
            id: 'f_spell_atk',
            key: 'spell_atk',
            label: 'SPELL_ATTACK_MOD',
            kind: 'calculated',
            formula: 'prof + mod_int',
            showPlus: true,
          },
          {
            id: 'f_slots_1',
            key: 'slots_1st',
            label: '1ST LEVEL SLOTS',
            kind: 'resource',
            value: 3,
            max: 4,
          },
          {
            id: 'f_slots_2',
            key: 'slots_2nd',
            label: '2ND LEVEL SLOTS',
            kind: 'resource',
            value: 2,
            max: 2,
          },
          {
            id: 'f_roll_firebolt',
            key: 'roll_firebolt',
            label: 'CANTRIP ATTACK',
            kind: 'roll',
            rollLabel: 'CAST FIRE BOLT',
            rollExpr: '1d20 + mod_int + prof',
          },
        ],
      },
      {
        id: 'card_grimorio',
        tab: 'magias',
        code: '//GRIMOIRE_&_FEATS',
        title: 'PREPARED SPELLS & FEATURES',
        colSpan: 1,
        fields: [
          {
            id: 'f_lista_magias',
            key: 'spells',
            label: 'SPELLS & CLASS FEATURES',
            kind: 'repeatable',
            columns: ['SPELL / FEATURE', 'SLOT / COST'],
            col2Type: 'text',
            rows: [
              { id: 's_1', col1: 'Shield (+5 AC)', col2: '1ST · REACT' },
              { id: 's_2', col1: 'Misty Step (30ft)', col2: '2ND · BONUS' },
              { id: 's_3', col1: 'Magic Missile (3 darts)', col2: '1ST · ACTION' },
              { id: 's_4', col1: 'Extra Attack (2x)', col2: 'PASSIVE' },
            ],
          },
          {
            id: 'f_concentration',
            key: 'concentration',
            label: 'CONCENTRATION ACTIVE',
            kind: 'boolean',
            value: false,
            hint: 'CON SAVE ON DAMAGE',
          },
        ],
      },
      {
        id: 'card_notas',
        tab: 'magias',
        code: '//CAMPAIGN_LOG',
        title: 'PARTY & QUEST NOTES',
        colSpan: 2,
        fields: [
          {
            id: 'f_notas',
            key: 'notas_campanha',
            label: 'ADVENTURE RECORDS',
            kind: 'text',
            value:
              'Cleared the Sunless Citadel lower gate. Recover the Obsidian Signet from the Red Wizard enclave before the next long rest.',
          },
        ],
      },
    ],
    rollLogs: [
      {
        id: 'log_dnd_1',
        timestamp: '21:40',
        label: 'ATTACK LONGSWORD',
        total: 19,
        formula: '1d20 + 3 + 3',
        breakdown: '1d20[13] → 13 + 3 + 3',
      },
      {
        id: 'log_dnd_2',
        timestamp: '21:35',
        label: 'ROLL PERCEPTION',
        total: 16,
        formula: '1d20 + 1 + 3',
        breakdown: '1d20[12] → 12 + 1 + 3',
      },
    ],
    xp: {
      totalEarned: 1800,
      spent: 0,
      ledger: [
        {
          id: 'xp_dnd_seed_1',
          timestamp: '21:00',
          kind: 'award',
          delta: 1800,
          label: 'MILESTONE TRAINING POOL',
        },
      ],
    },
    dnd5eState: createDefaultDnd5eState({
      level: 5,
      inspiration: true,
      tempHp: 0,
      hitDice: { die: 'd10', current: 5, max: 5 },
      deathSaves: { successes: 0, failures: 0 },
      saveProficiencies: { str: true, dex: false, con: true, int: false, wis: false, cha: false },
      skillProficiencies: {
        acrobatics: 'none',
        animal_handling: 'none',
        arcana: 'proficient',
        athletics: 'proficient',
        deception: 'none',
        history: 'none',
        insight: 'none',
        intimidation: 'none',
        investigation: 'none',
        medicine: 'none',
        nature: 'none',
        perception: 'proficient',
        performance: 'none',
        persuasion: 'none',
        religion: 'none',
        sleight_of_hand: 'none',
        stealth: 'proficient',
        survival: 'none',
      },
      spellcasting: {
        ability: 'int',
        slots: createDefaultDnd5eSlots().map((s) =>
          s.level === 1
            ? { level: 1, max: 4, used: 1 }
            : s.level === 2
              ? { level: 2, max: 2, used: 0 }
              : s,
        ),
      },
    }),
  };
}

export function createGenericD20Preset(): CharacterSheetState {
  return {
    id: 'sheet_default',
    systemId: 'default',
    systemName: 'SISTEMA GENÉRICO EXEMPLO',
    systemCode: '/SYS: SISTEMA GENÉRICO EXEMPLO',
    characterName: 'KAELEN VANCE · OPERADOR',
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    cards: [
      {
        id: 'card_identidade',
        tab: 'geral',
        code: '//IDENTIFICAÇÃO',
        title: 'PERFIL DO PERSONAGEM',
        colSpan: 2,
        fields: [
          {
            id: 'f_nome',
            key: 'nome_personagem',
            label: 'NOME_OPERATIVO',
            kind: 'text',
            value: 'Kaelen Vance',
          },
          {
            id: 'f_arquetipo',
            key: 'arquetipo',
            label: 'ARQUÉTIPO / CLASSE',
            kind: 'text',
            value: 'Vanguarda Tática',
          },
          {
            id: 'f_nivel',
            key: 'nivel',
            label: 'NÍVEL',
            kind: 'number',
            value: 3,
          },
          {
            id: 'f_bonus_prof',
            key: 'prof',
            label: 'BÔNUS_MAESTRIA',
            kind: 'calculated',
            formula: 'floor((nivel - 1) / 4) + 2',
            showPlus: true,
          },
        ],
      },
      {
        id: 'card_atributos',
        tab: 'geral',
        code: '//ATRIBUTOS',
        title: 'NÚCLEO DE ATRIBUTOS',
        colSpan: 1,
        fields: [
          {
            id: 'f_forca',
            key: 'forca',
            label: 'FORÇA',
            kind: 'number',
            value: 14,
          },
          {
            id: 'f_mod_forca',
            key: 'mod_forca',
            label: 'MOD_FORCA',
            kind: 'calculated',
            formula: 'floor((forca - 10) / 2)',
            showPlus: true,
          },
          {
            id: 'f_roll_forca',
            key: 'roll_forca',
            label: 'TESTE DE FORÇA',
            kind: 'roll',
            rollLabel: 'ROLAR FORÇA',
            rollExpr: '1d20 + mod_forca',
          },
          {
            id: 'f_destreza',
            key: 'destreza',
            label: 'DESTREZA',
            kind: 'number',
            value: 16,
          },
          {
            id: 'f_mod_destreza',
            key: 'mod_destreza',
            label: 'MOD_DESTREZA',
            kind: 'calculated',
            formula: 'floor((destreza - 10) / 2)',
            showPlus: true,
          },
          {
            id: 'f_roll_destreza',
            key: 'roll_destreza',
            label: 'TESTE DE DESTREZA',
            kind: 'roll',
            rollLabel: 'ROLAR DESTREZA',
            rollExpr: '1d20 + mod_destreza',
          },
        ],
      },
      {
        id: 'card_combate',
        tab: 'geral',
        code: '//STATUS_VITAL',
        title: 'COMBATE & RECURSOS',
        colSpan: 1,
        fields: [
          {
            id: 'f_pv',
            key: 'pv',
            label: 'PONTOS DE VIDA',
            kind: 'resource',
            value: 12,
            max: 12,
          },
          {
            id: 'f_estamina',
            key: 'estamina',
            label: 'ENERGIA / FOCO',
            kind: 'resource',
            value: 6,
            max: 8,
          },
          {
            id: 'f_defesa',
            key: 'defesa',
            label: 'DEFESA_BASE',
            kind: 'calculated',
            formula: '10 + mod_destreza',
            showPlus: false,
          },
          {
            id: 'f_inspiracao',
            key: 'inspiracao',
            label: 'INSPIRAÇÃO',
            kind: 'boolean',
            value: true,
            hint: 'MARCADOR TÁTICO / VANTAGEM',
          },
          {
            id: 'f_ataque_espada',
            key: 'ataque_principal',
            label: 'GOLPE TÁTICO',
            kind: 'roll',
            rollLabel: 'ATACAR LÂMINA',
            rollExpr: '1d20 + mod_forca + prof',
          },
          {
            id: 'f_dano_espada',
            key: 'dano_principal',
            label: 'DANO DA LÂMINA',
            kind: 'roll',
            rollLabel: 'ROLAR DANO',
            rollExpr: '1d8 + mod_forca',
          },
        ],
      },
      {
        id: 'card_inventario',
        tab: 'geral',
        code: '//INVENTÁRIO',
        title: 'MOCHILA & CARGA',
        colSpan: 2,
        fields: [
          {
            id: 'f_mochila',
            key: 'mochila',
            label: 'MOCHILA',
            kind: 'repeatable',
            columns: ['ITEM', 'PESO (KG)'],
            col2Type: 'number',
            rows: [
              { id: 'r_1', col1: 'Lâmina Monomolecular', col2: 2.5 },
              { id: 'r_2', col1: 'Kit de Primeiros Socorros', col2: 1.5 },
              { id: 'r_3', col1: 'Corda Sintética (15m)', col2: 2.0 },
              { id: 'r_4', col1: 'Ração Desidratada (3x)', col2: 1.0 },
            ],
          },
          {
            id: 'f_carga_max',
            key: 'carga_max',
            label: 'CAPACIDADE_CARGA',
            kind: 'calculated',
            formula: 'forca * 5',
            showPlus: false,
          },
        ],
      },
      {
        id: 'card_arcano',
        tab: 'magias',
        code: '//MÓDULO_ARCANO',
        title: 'CONJURAÇÃO & RESERVA',
        colSpan: 1,
        fields: [
          {
            id: 'f_intelecto',
            key: 'intelecto',
            label: 'INTELECTO',
            kind: 'number',
            value: 15,
          },
          {
            id: 'f_mod_int',
            key: 'mod_int',
            label: 'MOD_INTELECTO',
            kind: 'calculated',
            formula: 'floor((intelecto - 10) / 2)',
            showPlus: true,
          },
          {
            id: 'f_slots',
            key: 'espacos_magia',
            label: 'SLOTS DE CONJURAÇÃO',
            kind: 'resource',
            value: 3,
            max: 4,
          },
          {
            id: 'f_cd_magia',
            key: 'cd_magia',
            label: 'CD_RESISTÊNCIA',
            kind: 'calculated',
            formula: '8 + prof + mod_int',
            showPlus: false,
          },
          {
            id: 'f_ataque_magico',
            key: 'ataque_magico',
            label: 'CONJURAÇÃO OFENSIVA',
            kind: 'roll',
            rollLabel: 'ROLAR ATAQUE ARCANO',
            rollExpr: '1d20 + mod_int + prof',
          },
        ],
      },
      {
        id: 'card_grimorio',
        tab: 'magias',
        code: '//GRIMÓRIO',
        title: 'MAGIAS & HABILIDADES',
        colSpan: 1,
        fields: [
          {
            id: 'f_lista_magias',
            key: 'grimorio',
            label: 'LISTA DE CONJURAÇÕES',
            kind: 'repeatable',
            columns: ['MAGIA / PROTOCOLO', 'CUSTO'],
            col2Type: 'text',
            rows: [
              { id: 'm_1', col1: 'Disparo de Éter', col2: '1 SLOT' },
              { id: 'm_2', col1: 'Barreira Cinética', col2: '1 SLOT' },
              { id: 'm_3', col1: 'Passo Dimensional', col2: '2 SLOTS' },
            ],
          },
          {
            id: 'f_concentracao',
            key: 'concentracao',
            label: 'CONCENTRAÇÃO ATIVA',
            kind: 'boolean',
            value: false,
            hint: 'MANTER EFEITO CONTÍNUO',
          },
        ],
      },
      {
        id: 'card_notas',
        tab: 'magias',
        code: '//DIÁRIO_CAMPO',
        title: 'ANOTAÇÕES DE CAMPANHA',
        colSpan: 2,
        fields: [
          {
            id: 'f_notas',
            key: 'notas_campanha',
            label: 'REGISTROS DA SESSÃO',
            kind: 'text',
            value:
              'Contato confirmado no Setor 04. Chave de acesso ao arquivo antigo recuperada; verificar selo rúnico antes da próxima descida.',
          },
        ],
      },
    ],
    rollLogs: [
      {
        id: 'log_init_1',
        timestamp: '14:42',
        label: 'ROLAR FORÇA',
        total: 17,
        formula: '1d20 + 2',
        breakdown: '1d20[15] → 15 + 2',
      },
      {
        id: 'log_init_2',
        timestamp: '14:38',
        label: 'ATACAR LÂMINA',
        total: 22,
        formula: '1d20 + 2 + 2',
        breakdown: '1d20[18] → 18 + 2 + 2',
      },
    ],
    xp: {
      totalEarned: 12,
      spent: 0,
      ledger: [],
    },
  };
}

export function createBlankSheet(localeOptions?: {
  newCharacterName?: string;
  customSystemName?: string;
  customSystemCode?: string;
}): CharacterSheetState {
  return {
    id: 'sheet_blank',
    systemId: 'blank',
    systemName: localeOptions?.customSystemName ?? 'SISTEMA CUSTOMIZADO',
    systemCode: localeOptions?.customSystemCode ?? '/SYS: SISTEMA CUSTOMIZADO',
    characterName: localeOptions?.newCharacterName ?? 'NOVO PERSONAGEM',
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    cards: [],
    rollLogs: [],
    xp: {
      totalEarned: 0,
      spent: 0,
      ledger: [],
    },
  };
}

export function createCyberpunkPreset(): CharacterSheetState {
  const base = createGenericD20Preset();
  return {
    ...base,
    id: 'sheet_cyberpunk',
    systemId: 'cyberpunk',
    systemName: 'NET//RUNNER D10 PROTOCOL',
    systemCode: '/SYS: CYBERPUNK D10 PROTOCOL',
    characterName: 'ZERO_K · NETRUNNER',
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    cards: base.cards.map((c) => {
      if (c.id === 'card_atributos') {
        return {
          ...c,
          fields: [
            { id: 'f_forca', key: 'forca', label: 'REFLEXOS', kind: 'number', value: 8 },
            {
              id: 'f_mod_forca',
              key: 'mod_forca',
              label: 'INICIATIVA_NET',
              kind: 'calculated',
              formula: 'forca + 2',
              showPlus: true,
            },
            {
              id: 'f_roll_forca',
              key: 'roll_forca',
              label: 'TESTE REFLEXOS',
              kind: 'roll',
              rollLabel: 'ROLAR REFLEXOS',
              rollExpr: '1d10 + forca',
            },
            { id: 'f_destreza', key: 'destreza', label: 'INTERFACE', kind: 'number', value: 9 },
            {
              id: 'f_mod_destreza',
              key: 'mod_destreza',
              label: 'PODER_ICE',
              kind: 'calculated',
              formula: 'destreza * 2',
              showPlus: false,
            },
            {
              id: 'f_roll_destreza',
              key: 'roll_destreza',
              label: 'INVASÃO ICE',
              kind: 'roll',
              rollLabel: 'HACKEAR NÓ',
              rollExpr: '1d10 + destreza',
            },
          ],
        };
      }
      return c;
    }),
  };
}

export function evaluateSheet(sheet: CharacterSheetState): SheetEvaluation {
  const variables: VariableMap = {};
  const computedByFieldId: Record<string, ComputedFieldInfo> = {};
  const formulaErrors: Array<{ fieldId: string; label: string; error: string }> = [];
  let totalCargoWeight = 0;

  // Pass 1: collect direct numeric, resource, and boolean variables
  for (const card of sheet.cards) {
    for (const field of card.fields) {
      const key = field.key.trim().toLowerCase();
      if (!key) continue;
      if (field.kind === 'number') {
        const num = typeof field.value === 'number' ? field.value : Number(field.value ?? 0);
        variables[key] = Number.isFinite(num) ? num : 0;
      } else if (field.kind === 'resource') {
        const max = Math.max(1, field.max ?? 12);
        const num = typeof field.value === 'number' ? field.value : 0;
        variables[key] = num;
        variables[`${key}_max`] = max;
        if (field.damageTrack) {
          const sup = Math.max(0, field.superficialDamage ?? 0);
          const agg = Math.max(0, field.aggravatedDamage ?? 0);
          variables[`${key}_superficial`] = sup;
          variables[`${key}_aggravated`] = agg;
          variables[`${key}_total_sup_eq`] = agg * max + sup;
        }
      } else if (field.kind === 'boolean') {
        variables[key] = field.value ? 1 : 0;
      } else if (field.kind === 'repeatable' && field.col2Type === 'number') {
        for (const row of field.rows ?? []) {
          const w = typeof row.col2 === 'number' ? row.col2 : Number(row.col2);
          if (Number.isFinite(w)) totalCargoWeight += w;
        }
      }
    }
  }

  variables['carga_total'] = Number(totalCargoWeight.toFixed(2));
  variables['wound_penalty'] = computeWoundPenalty(sheet);

  // Resolve dynamic resource maxFormula expressions (e.g. V5 health = stamina + 3, willpower = composure + resolve)
  for (const card of sheet.cards) {
    for (const field of card.fields) {
      if (field.kind !== 'resource' || !field.maxFormula?.trim()) continue;
      const key = field.key.trim().toLowerCase();
      const maxRes = evaluateFormula(field.maxFormula, variables, false);
      if (maxRes.ok && Number.isFinite(maxRes.value)) {
        if (key) {
          variables[`${key}_max`] = Math.max(1, Math.round(maxRes.value));
        }
      } else {
        formulaErrors.push({
          fieldId: field.id,
          label: field.label,
          error: maxRes.error ?? 'Fórmula de máximo inválida',
        });
      }
    }
  }

  // Pass 2: evaluate calculated fields with formulaMap, cycle detection, and memoization
  const calcFields = sheet.cards.flatMap((c) => c.fields).filter((f) => f.kind === 'calculated');
  const formulaMap: Record<string, string> = {};
  for (const field of calcFields) {
    const key = field.key.trim().toLowerCase();
    if (key) {
      formulaMap[key] = field.formula ?? '0';
    }
  }
  const resolvedMemo: Record<string, number> = {};
  for (const field of calcFields) {
    const key = field.key.trim().toLowerCase();
    const res = evaluateFormula(field.formula ?? '0', variables, field.showPlus ?? true, {
      formulaMap,
      visited: key ? new Set([key]) : new Set(),
      resolvedMemo,
    });
    computedByFieldId[field.id] = {
      value: res.value,
      formatted: res.formatted,
      ok: res.ok,
      error: res.error,
    };
    if (res.ok && key) {
      variables[key] = res.value;
      resolvedMemo[key] = res.value;
    }
  }

  for (const field of calcFields) {
    const info = computedByFieldId[field.id];
    if (info && !info.ok) {
      formulaErrors.push({
        fieldId: field.id,
        label: field.label,
        error: info.error ?? 'Erro de fórmula',
      });
    }
  }

  // Also validate roll button formulas so status bar catches broken roll formulas too
  const rollFields = sheet.cards.flatMap((c) => c.fields).filter((f) => f.kind === 'roll');
  for (const field of rollFields) {
    const testRoll = rollDiceExpression(field.rollExpr ?? '', variables, () => 0.5);
    if (!testRoll.ok) {
      formulaErrors.push({
        fieldId: field.id,
        label: field.rollLabel ?? field.label,
        error: testRoll.error ?? 'Fórmula de dado inválida',
      });
    }
  }

  return {
    variables,
    computedByFieldId,
    formulaErrors,
    totalCargoWeight: Number(totalCargoWeight.toFixed(2)),
  };
}

export function resolveRollPreview(
  expression: string,
  vars: VariableMap,
  options?: {
    difficulty?: number;
    modifier?: number;
    specialty?: boolean;
    rulePreset?: RulePreset;
    woundPenalty?: number;
    isSoak?: boolean;
    soakDamageType?: SoakDamageType;
    bloodSurge?: boolean;
  },
): string {
  const cleaned = expression.trim();
  if (!cleaned) return '';

  const parsedPool = parseWodPoolExpression(cleaned);
  if (parsedPool) {
    const preset: RulePreset = options?.rulePreset ?? 'storyteller-v20';
    const isSoak = Boolean(options?.isSoak);
    const soakType: SoakDamageType = options?.soakDamageType ?? 'lethal';
    const effectiveVars =
      isSoak && preset !== 'vampire-v5' && soakType === 'aggravated'
        ? { ...vars, stamina: 0, vigor: 0 }
        : vars;

    const countRes = evaluateFormula(parsedPool.countExpr, effectiveVars, false);
    const diffRes = evaluateFormula(parsedPool.diffExpr, effectiveVars, false);
    if (countRes.ok && (diffRes.ok || options?.difficulty !== undefined || preset === 'vampire-v5')) {
      const mod =
        typeof options?.modifier === 'number' && Number.isFinite(options.modifier)
          ? Math.round(options.modifier)
          : 0;
      const wound =
        !isSoak && typeof options?.woundPenalty === 'number' && Number.isFinite(options.woundPenalty)
          ? Math.min(0, Math.round(options.woundPenalty))
          : 0;
      const surge =
        preset === 'vampire-v5' && !isSoak && options?.bloodSurge
          ? getV5BloodSurgeBonus(vars.blood_potency)
          : 0;
      const poolSize = Math.max(0, Math.min(30, Math.round(countRes.value) + mod + surge + wound));
      if (preset === 'vampire-v5' && !isSoak) {
        const rawV5Target =
          typeof options?.difficulty === 'number' && Number.isFinite(options.difficulty)
            ? options.difficulty
            : parsedPool.hasExplicitDiff && diffRes.ok
              ? diffRes.value
              : 2;
        const v5Target = Math.max(1, Math.min(10, Math.round(rawV5Target)));
        return `${poolSize}d10 · DIFF (META) ${v5Target}`;
      }
      const rawDiff =
        typeof options?.difficulty === 'number' && Number.isFinite(options.difficulty)
          ? options.difficulty
          : diffRes.value;
      const diff = Math.max(2, Math.min(10, Math.round(rawDiff)));
      const specSuffix = options?.specialty ? ' · SPEC' : '';
      return `${poolSize}d10 @ DIFF ${diff}${specSuffix}`;
    }
  }

  return cleaned
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
      const lower = match.toLowerCase();
      if (/^d\d+$/i.test(lower)) return match;
      if (Object.prototype.hasOwnProperty.call(vars, lower)) {
        return `${vars[lower]}`;
      }
      return match;
    })
    .replace(/\+\s*-(\d+)/g, '- $1');
}

export function touchSheetMetadata(
  sheet: CharacterSheetState,
  options?: { updatedAt?: string; deviceId?: string },
): CharacterSheetState {
  const sysId = detectSystemId(sheet);
  const revision =
    typeof sheet.revision === 'number' && Number.isInteger(sheet.revision) && sheet.revision >= 1
      ? sheet.revision
      : 1;
  return {
    ...sheet,
    id:
      typeof sheet.id === 'string' && sheet.id.trim().length > 0
        ? sheet.id.trim()
        : `sheet_${sysId}`,
    systemId: sysId,
    revision,
    updatedAt: options?.updatedAt ?? nowIsoUtc(),
    deviceId:
      options?.deviceId ??
      (typeof sheet.deviceId === 'string' && sheet.deviceId.trim().length > 0
        ? sheet.deviceId.trim()
        : getOrCreateDeviceId()),
  };
}

export function migrateLegacySheetMetadata(
  sheet: Partial<CharacterSheetState> & Pick<CharacterSheetState, 'systemName' | 'systemCode' | 'characterName' | 'cards'>,
  options?: {
    deviceId?: string;
    nowIso?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): CharacterSheetState {
  const sysId = detectSystemId(sheet as CharacterSheetState);
  const revision =
    typeof sheet.revision === 'number' && Number.isInteger(sheet.revision) && sheet.revision >= 1
      ? sheet.revision
      : 1;
  const updatedAt = isValidIsoDateTime(sheet.updatedAt)
    ? sheet.updatedAt
    : options?.nowIso ?? nowIsoUtc();
  const deviceId =
    typeof sheet.deviceId === 'string' && sheet.deviceId.trim().length > 0
      ? sheet.deviceId.trim()
      : options?.deviceId ?? getOrCreateDeviceId(options?.storage);
  const id =
    typeof sheet.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(sheet.id.trim())
      ? sheet.id.trim()
      : `sheet_${sysId}`;

  const rawRulePreset = (sheet.rulePreset ?? sheet.xpRulePreset) as string | undefined;
  const resolvedRulePreset: RulePreset = normalizeRulePreset(rawRulePreset);

  return {
    ...sheet,
    id,
    systemId: sysId,
    revision,
    updatedAt,
    deviceId,
    rulePreset: resolvedRulePreset,
    xpRulePreset: resolvedRulePreset,
    rollLogs: Array.isArray(sheet.rollLogs) ? sheet.rollLogs : [],
  };
}

function syncWillpowerToggleWithResource(sheet: CharacterSheetState): CharacterSheetState {
  const wpField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_willpower' || f.key === 'willpower');
  const wpVal = typeof wpField?.value === 'number' ? wpField.value : 0;
  if (wpVal > 0) return sheet;

  const boostField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_wp_boost' || f.key === 'wp_boost');
  if (!boostField || !boostField.value) return sheet;

  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) =>
        f.id === boostField.id ? { ...f, value: false } : f,
      ),
    })),
  };
}

function syncV5DerivedTrackMaxes(
  sheet: CharacterSheetState,
  changedFieldId: string,
): CharacterSheetState {
  if (resolveRulePreset(sheet) !== 'vampire-v5') return sheet;

  const allFields = sheet.cards.flatMap((c) => c.fields);
  const editedField = allFields.find((f) => f.id === changedFieldId);
  if (!editedField || editedField.kind !== 'number') return sheet;

  const editedKey = (editedField.key ?? '').trim().toLowerCase();
  const editedVal = typeof editedField.value === 'number' && Number.isFinite(editedField.value)
    ? Math.round(editedField.value)
    : null;
  if (editedVal === null) return sheet;

  const isStaminaEdit = editedField.id === 'f_stamina' || editedKey === 'stamina';
  const isWillpowerAttrEdit = editedKey === 'composure' || editedKey === 'resolve';
  if (!isStaminaEdit && !isWillpowerAttrEdit) return sheet;

  const attrVars: VariableMap = {};
  for (const f of allFields) {
    if (f.kind !== 'number') continue;
    const fk = (f.key ?? '').trim().toLowerCase();
    if (fk && typeof f.value === 'number' && Number.isFinite(f.value)) {
      attrVars[fk] = Math.round(f.value);
    }
  }

  const evalDerivedMax = (
    maxFormula: string | undefined,
    defaultFormula: string,
    minFloor: number,
  ): number => {
    const expr = maxFormula?.trim() || defaultFormula;
    const res = evaluateFormula(expr, attrVars, false);
    if (res.ok && Number.isFinite(res.value)) {
      return Math.max(minFloor, Math.round(res.value));
    }
    const fallbackRes = evaluateFormula(defaultFormula, attrVars, false);
    return fallbackRes.ok && Number.isFinite(fallbackRes.value)
      ? Math.max(minFloor, Math.round(fallbackRes.value))
      : minFloor;
  };

  const hasComposure = allFields.some(
    (f) => f.kind === 'number' && (f.key ?? '').trim().toLowerCase() === 'composure',
  );
  const hasResolve = allFields.some(
    (f) => f.kind === 'number' && (f.key ?? '').trim().toLowerCase() === 'resolve',
  );

  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (isStaminaEdit && f.kind === 'resource' && (f.id === 'f_health' || f.key === 'health')) {
          const nextHealthMax = evalDerivedMax(f.maxFormula, 'stamina + 3', 4);
          const agg = Math.min(nextHealthMax, Math.max(0, f.aggravatedDamage ?? 0));
          const sup = Math.min(nextHealthMax - agg, Math.max(0, f.superficialDamage ?? 0));
          return {
            ...f,
            max: nextHealthMax,
            aggravatedDamage: agg,
            superficialDamage: sup,
            value: Math.max(0, nextHealthMax - agg - sup),
          };
        }
        if (
          isWillpowerAttrEdit &&
          hasComposure &&
          hasResolve &&
          f.kind === 'resource' &&
          (f.id === 'f_willpower' || f.key === 'willpower')
        ) {
          const nextWillpowerMax = evalDerivedMax(f.maxFormula, 'composure + resolve', 2);
          const agg = Math.min(nextWillpowerMax, Math.max(0, f.aggravatedDamage ?? 0));
          const sup = Math.min(nextWillpowerMax - agg, Math.max(0, f.superficialDamage ?? 0));
          const hasDamageTracking =
            typeof f.superficialDamage === 'number' || typeof f.aggravatedDamage === 'number';
          return {
            ...f,
            max: nextWillpowerMax,
            ...(hasDamageTracking
              ? { superficialDamage: sup, aggravatedDamage: agg }
              : {}),
            value: Math.max(0, nextWillpowerMax - agg - sup),
          };
        }
        return f;
      }),
    })),
  };
}

export function updateFieldValue(
  sheet: CharacterSheetState,
  fieldId: string,
  nextValue: number | string | boolean,
): CharacterSheetState {
  const updated: CharacterSheetState = touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId) return f;
        if (
          (f.id === 'f_humanity' || f.key === 'humanity') &&
          typeof nextValue === 'number' &&
          Number.isFinite(nextValue) &&
          typeof f.stains === 'number'
        ) {
          const clampedH = Math.max(0, Math.min(10, Math.round(nextValue)));
          return {
            ...f,
            value: clampedH,
            stains: Math.max(0, Math.min(10 - clampedH, Math.round(f.stains))),
          };
        }
        return { ...f, value: nextValue };
      }),
    })),
  });
  const withDerivedTracks =
    typeof nextValue === 'number' && Number.isFinite(nextValue)
      ? syncV5DerivedTrackMaxes(updated, fieldId)
      : updated;
  return syncWillpowerToggleWithResource(withDerivedTracks);
}

export function adjustResourceValue(
  sheet: CharacterSheetState,
  fieldId: string,
  delta: number,
): CharacterSheetState {
  const updated: CharacterSheetState = touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'resource') return f;
        const max = Math.max(1, f.max ?? 12);
        const current = typeof f.value === 'number' ? f.value : 0;
        const clamped = Math.max(0, Math.min(max, current + delta));
        if (f.damageTrack) {
          const nextAgg = Math.max(0, max - clamped);
          const nextSup = clamped === 0 ? 0 : Math.min(max - 1, f.superficialDamage ?? 0);
          return {
            ...f,
            value: clamped,
            aggravatedDamage: nextAgg,
            superficialDamage: nextSup,
          };
        }
        if ((f.id === 'f_humanity' || f.key === 'humanity') && typeof f.stains === 'number') {
          return {
            ...f,
            value: clamped,
            stains: Math.max(0, Math.min(10 - clamped, Math.round(f.stains))),
          };
        }
        return { ...f, value: clamped };
      }),
    })),
  });
  return syncWillpowerToggleWithResource(updated);
}

export function consumeWillpowerForRoll(sheet: CharacterSheetState): CharacterSheetState {
  const wpField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_willpower' || f.key === 'willpower');
  const wpVal = typeof wpField?.value === 'number' ? wpField.value : 0;
  const boostField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_wp_boost' || f.key === 'wp_boost');

  if (!wpField || !boostField || !boostField.value || wpVal <= 0) {
    return syncWillpowerToggleWithResource(sheet);
  }

  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id === wpField.id && f.kind === 'resource') {
          return { ...f, value: Math.max(0, wpVal - 1) };
        }
        if (f.id === boostField.id && f.kind === 'boolean') {
          return { ...f, value: false };
        }
        return f;
      }),
    })),
  });
}

export function adjustHealthDamage(
  sheet: CharacterSheetState,
  fieldId: string,
  damageType: 'superficial' | 'aggravated',
  delta: number,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'resource') return f;
        const max = Math.max(1, f.max ?? 7);
        const currentAgg = Math.max(
          0,
          Math.min(
            max,
            typeof f.aggravatedDamage === 'number'
              ? f.aggravatedDamage
              : Math.max(0, max - (typeof f.value === 'number' ? f.value : max)),
          ),
        );
        const currentSup =
          currentAgg >= max ? 0 : Math.max(0, Math.min(max - 1, f.superficialDamage ?? 0));

        const totalSup = currentAgg * max + currentSup;
        const maxTotalSup = max * max;
        const deltaSup = damageType === 'aggravated' ? delta * max : delta;
        const nextTotalSup = Math.max(0, Math.min(maxTotalSup, totalSup + deltaSup));

        const nextAgg = Math.floor(nextTotalSup / max);
        const nextSup = nextAgg >= max ? 0 : nextTotalSup % max;
        const nextHealth = Math.max(0, max - nextAgg);

        return {
          ...f,
          damageTrack: true,
          max,
          value: nextHealth,
          superficialDamage: nextSup,
          aggravatedDamage: nextAgg,
        };
      }),
    })),
  });
}

export function resolveRulePreset(sheet: CharacterSheetState): RulePreset {
  const raw = (sheet.rulePreset ?? sheet.xpRulePreset) as string | undefined;
  return normalizeRulePreset(raw);
}

export function setSheetRulePreset(
  sheet: CharacterSheetState,
  preset: RulePreset,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    rulePreset: preset,
    xpRulePreset: preset,
  });
}

export function getBloodPoolMaxByGeneration(generation?: number): number {
  if (typeof generation !== 'number' || !Number.isFinite(generation)) return 13;
  const gen = Math.round(generation);
  if (gen <= 4) return 50;
  if (gen === 5) return 40;
  if (gen === 6) return 30;
  if (gen === 7) return 20;
  if (gen === 8) return 15;
  if (gen === 9) return 14;
  if (gen === 10) return 13;
  if (gen === 11) return 12;
  if (gen === 12) return 11;
  return 10;
}

export function getSheetBloodPool(sheet: CharacterSheetState): { current: number; max: number } {
  const genField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_generation' || f.key === 'generation');
  const generation = typeof genField?.value === 'number' ? genField.value : 10;
  const max = getBloodPoolMaxByGeneration(generation);
  const bpField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_blood_pool' || f.key === 'blood_pool');
  const rawVal =
    typeof bpField?.value === 'number'
      ? bpField.value
      : typeof sheet.bloodPool === 'number'
        ? sheet.bloodPool
        : Math.min(max, 10);
  const current = Math.max(0, Math.min(max, Math.round(rawVal)));
  return { current, max };
}

export function adjustSheetBloodPool(
  sheet: CharacterSheetState,
  deltaOrValue: number,
  absolute = false,
): CharacterSheetState {
  const { current, max } = getSheetBloodPool(sheet);
  const nextVal = Math.max(0, Math.min(max, Math.round(absolute ? deltaOrValue : current + deltaOrValue)));
  const hasField = sheet.cards
    .flatMap((c) => c.fields)
    .some((f) => f.id === 'f_blood_pool' || f.key === 'blood_pool');

  return touchSheetMetadata({
    ...sheet,
    bloodPool: nextVal,
    cards: hasField
      ? sheet.cards.map((card) => ({
          ...card,
          fields: card.fields.map((f) =>
            f.id === 'f_blood_pool' || f.key === 'blood_pool' ? { ...f, value: nextVal, max } : f,
          ),
        }))
      : sheet.cards,
  });
}

export function getSheetVirtues(sheet: CharacterSheetState): VirtuesState {
  return {
    conscience: Math.max(1, Math.min(5, Math.round(sheet.virtues?.conscience ?? 3))),
    selfControl: Math.max(1, Math.min(5, Math.round(sheet.virtues?.selfControl ?? 3))),
    courage: Math.max(1, Math.min(5, Math.round(sheet.virtues?.courage ?? 4))),
  };
}

export function updateSheetVirtue(
  sheet: CharacterSheetState,
  virtue: keyof VirtuesState,
  nextVal: number,
): CharacterSheetState {
  const curr = getSheetVirtues(sheet);
  const clamped = Math.max(1, Math.min(5, Math.round(nextVal)));
  return touchSheetMetadata({
    ...sheet,
    virtues: {
      ...curr,
      [virtue]: clamped,
    },
  });
}

export function getV20HealthBreakdown(field: SheetField): {
  max: number;
  aggravated: number;
  lethal: number;
  bashing: number;
  totalDamage: number;
  healthy: number;
} {
  const max = Math.max(1, field.max ?? 7);
  const agg = Math.max(
    0,
    Math.min(
      max,
      typeof field.aggravatedDamage === 'number'
        ? field.aggravatedDamage
        : Math.max(0, max - (typeof field.value === 'number' ? field.value : max)),
    ),
  );
  const remainingAfterAgg = Math.max(0, max - agg);
  const letRaw = Math.max(0, field.lethalDamage ?? 0);
  const letDmg = Math.min(remainingAfterAgg, letRaw);
  const remainingAfterLet = Math.max(0, remainingAfterAgg - letDmg);
  const bashRaw = Math.max(
    0,
    typeof field.bashingDamage === 'number' ? field.bashingDamage : field.superficialDamage ?? 0,
  );
  const bashDmg = Math.min(remainingAfterLet, bashRaw);
  const totalDamage = agg + letDmg + bashDmg;
  return {
    max,
    aggravated: agg,
    lethal: letDmg,
    bashing: bashDmg,
    totalDamage,
    healthy: Math.max(0, max - totalDamage),
  };
}

export function adjustV20HealthDamage(
  sheet: CharacterSheetState,
  fieldId: string,
  damageType: 'bashing' | 'lethal' | 'aggravated',
  delta: number,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'resource') return f;
        const { max, aggravated, lethal, bashing } = getV20HealthBreakdown(f);
        let nextAgg = aggravated;
        let nextLet = lethal;
        let nextBash = bashing;

        if (delta > 0) {
          for (let step = 0; step < delta; step += 1) {
            const total = nextAgg + nextLet + nextBash;
            if (damageType === 'bashing') {
              if (total < max) {
                nextBash += 1;
              } else if (nextBash > 0) {
                // Overflow bashing upgrades existing bashing to lethal per Storyteller rules
                nextBash -= 1;
                nextLet += 1;
              }
            } else if (damageType === 'lethal') {
              if (total < max) {
                nextLet += 1;
              } else if (nextBash > 0) {
                nextBash -= 1;
                nextLet += 1;
              }
            } else if (damageType === 'aggravated') {
              if (total < max) {
                nextAgg += 1;
              } else if (nextBash > 0) {
                nextBash -= 1;
                nextAgg += 1;
              } else if (nextLet > 0) {
                nextLet -= 1;
                nextAgg += 1;
              }
            }
          }
        } else if (delta < 0) {
          const steps = Math.abs(delta);
          if (damageType === 'bashing') nextBash = Math.max(0, nextBash - steps);
          if (damageType === 'lethal') nextLet = Math.max(0, nextLet - steps);
          if (damageType === 'aggravated') nextAgg = Math.max(0, nextAgg - steps);
        }

        const healthy = Math.max(0, max - (nextAgg + nextLet + nextBash));
        return {
          ...f,
          damageTrack: true,
          max,
          value: healthy,
          aggravatedDamage: nextAgg,
          lethalDamage: nextLet,
          bashingDamage: nextBash,
          superficialDamage: nextBash,
        };
      }),
    })),
  });
}

export function cycleV20HealthCell(
  sheet: CharacterSheetState,
  fieldId: string,
  boxIndex: number,
): CharacterSheetState {
  const field = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === fieldId);
  if (!field) return sheet;
  const { max, aggravated, lethal, bashing } = getV20HealthBreakdown(field);
  if (boxIndex < 0 || boxIndex >= max) return sheet;

  let nextAgg = aggravated;
  let nextLet = lethal;
  let nextBash = bashing;

  if (boxIndex < aggravated) {
    // Aggravated -> cleared
    nextAgg = Math.max(0, aggravated - 1);
  } else if (boxIndex < aggravated + lethal) {
    // Lethal -> Aggravated
    nextLet = Math.max(0, lethal - 1);
    nextAgg = Math.min(max, aggravated + 1);
  } else if (boxIndex < aggravated + lethal + bashing) {
    // Bashing -> Lethal
    nextBash = Math.max(0, bashing - 1);
    nextLet = Math.min(max - nextAgg, lethal + 1);
  } else {
    // Empty -> Bashing
    if (nextAgg + nextLet + nextBash < max) {
      nextBash += 1;
    }
  }

  const healthy = Math.max(0, max - (nextAgg + nextLet + nextBash));
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              damageTrack: true,
              max,
              value: healthy,
              aggravatedDamage: nextAgg,
              lethalDamage: nextLet,
              bashingDamage: nextBash,
              superficialDamage: nextBash,
            }
          : f,
      ),
    })),
  });
}

export function getV5HealthBreakdown(field: SheetField): {
  max: number;
  aggravated: number;
  superficial: number;
  totalDamage: number;
  healthy: number;
} {
  const max = Math.max(1, field.max ?? 7);
  const agg = Math.max(
    0,
    Math.min(
      max,
      typeof field.aggravatedDamage === 'number'
        ? field.aggravatedDamage
        : Math.max(0, max - (typeof field.value === 'number' ? field.value : max)),
    ),
  );
  const remaining = Math.max(0, max - agg);
  const sup = Math.max(0, Math.min(remaining, field.superficialDamage ?? 0));
  const totalDamage = agg + sup;
  return {
    max,
    aggravated: agg,
    superficial: sup,
    totalDamage,
    healthy: Math.max(0, max - totalDamage),
  };
}

export function halveV5SuperficialDamage(rawDamage: number): number {
  const clean = Math.max(0, Math.round(rawDamage));
  return Math.ceil(clean / 2);
}

export function adjustV5HealthDamage(
  sheet: CharacterSheetState,
  fieldId: string,
  damageType: 'superficial' | 'aggravated',
  delta: number,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'resource') return f;
        const { max, aggravated, superficial } = getV5HealthBreakdown(f);
        let nextAgg = aggravated;
        let nextSup = superficial;

        if (delta > 0) {
          for (let step = 0; step < delta; step += 1) {
            if (damageType === 'superficial') {
              if (nextAgg + nextSup < max) {
                nextSup += 1;
              } else if (nextSup > 0) {
                // V5 overflow: excess superficial converts existing superficial into aggravated
                nextSup -= 1;
                nextAgg = Math.min(max, nextAgg + 1);
              }
            } else {
              if (nextAgg < max) {
                nextAgg += 1;
                nextSup = Math.min(nextSup, max - nextAgg);
              }
            }
          }
        } else if (delta < 0) {
          const steps = Math.abs(delta);
          if (damageType === 'superficial') {
            nextSup = Math.max(0, nextSup - steps);
          } else {
            nextAgg = Math.max(0, nextAgg - steps);
          }
        }

        const nextHealthy = Math.max(0, max - nextAgg);
        return {
          ...f,
          damageTrack: true,
          max,
          value: nextHealthy,
          superficialDamage: nextSup,
          aggravatedDamage: nextAgg,
        };
      }),
    })),
  });
}

export function applyV5SuperficialHalving(
  sheet: CharacterSheetState,
  fieldId: string,
  rawIncomingDamage: number,
): { sheet: CharacterSheetState; appliedDamage: number } {
  const appliedDamage = halveV5SuperficialDamage(rawIncomingDamage);
  if (appliedDamage <= 0) return { sheet, appliedDamage: 0 };
  return {
    sheet: adjustV5HealthDamage(sheet, fieldId, 'superficial', appliedDamage),
    appliedDamage,
  };
}

export function computeWoundPenalty(
  sheet: CharacterSheetState,
  presetOverride?: RulePreset,
): number {
  const sysId = detectSystemId(sheet);
  if (sysId !== 'wod') return 0;
  const healthField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_health' || (f.kind === 'resource' && f.damageTrack));
  if (!healthField) return 0;

  const preset = presetOverride ?? resolveRulePreset(sheet);
  if (preset === 'vampire-v5') {
    const { max, totalDamage } = getV5HealthBreakdown(healthField);
    return totalDamage >= max ? -2 : 0;
  }

  const { max, totalDamage } = getV20HealthBreakdown(healthField);
  if (totalDamage <= 0) return 0;
  if (max === 7) {
    if (totalDamage <= 1) return 0; // Bruised (0)
    if (totalDamage <= 3) return -1; // Hurt / Injured (-1)
    if (totalDamage <= 5) return -2; // Wounded / Mauled (-2)
    return -5; // Crippled / Incapacitated (-5)
  }
  const ratio = totalDamage / max;
  if (ratio <= 1 / 7) return 0;
  if (ratio <= 3 / 7) return -1;
  if (ratio <= 5 / 7) return -2;
  return -5;
}

export interface HumanityStainsResult {
  humanity: number;
  stains: number;
  overflowStains: number;
  isDegenerating: boolean;
  remorsePool: number;
}

export function applyHumanityStains(
  humanity: number,
  currentStains: number,
  delta: number,
): HumanityStainsResult {
  const clampedHumanity =
    typeof humanity === 'number' && Number.isFinite(humanity)
      ? Math.max(0, Math.min(10, Math.round(humanity)))
      : 7;
  const clampedCurrentStains =
    typeof currentStains === 'number' && Number.isFinite(currentStains)
      ? Math.max(0, Math.min(10, Math.round(currentStains)))
      : 0;
  const roundedDelta =
    typeof delta === 'number' && Number.isFinite(delta) ? Math.round(delta) : 0;

  const maxFitStains = Math.max(0, 10 - clampedHumanity);
  const rawNextStains = Math.max(0, clampedCurrentStains + roundedDelta);
  const overflowStains = Math.max(0, rawNextStains - maxFitStains);
  const stains = Math.min(maxFitStains, rawNextStains);
  const remorsePool = Math.max(1, 10 - clampedHumanity - stains);

  return {
    humanity: clampedHumanity,
    stains,
    overflowStains,
    isDegenerating: overflowStains > 0,
    remorsePool,
  };
}

export function getSheetHumanityStains(sheet: CharacterSheetState): {
  humanity: number;
  stains: number;
  remorsePool: number;
} {
  const humField = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_humanity' || f.key.trim().toLowerCase() === 'humanity');
  const rawHumanity =
    typeof humField?.value === 'number' && Number.isFinite(humField.value) ? humField.value : 7;
  const humanity = Math.max(0, Math.min(10, Math.round(rawHumanity)));
  const rawStains =
    typeof humField?.stains === 'number' && Number.isFinite(humField.stains)
      ? humField.stains
      : typeof sheet.stains === 'number' && Number.isFinite(sheet.stains)
        ? sheet.stains
        : 0;
  const stains = Math.max(0, Math.min(10 - humanity, Math.round(rawStains)));
  const remorsePool = Math.max(1, 10 - humanity - stains);
  return { humanity, stains, remorsePool };
}

export interface V5WillpowerState {
  max: number;
  superficial: number;
  aggravated: number;
  available: number;
  isImpaired: boolean;
  isFullyAggravated: boolean;
}

export function applyV5WillpowerDamage(
  willpowerField: SheetField,
  type: 'superficial' | 'aggravated',
  amount: number,
): SheetField {
  const max = Math.max(1, Math.round(willpowerField.max ?? 5));
  let nextAgg = Math.max(0, Math.min(max, Math.round(willpowerField.aggravatedDamage ?? 0)));
  let nextSup = Math.max(
    0,
    Math.min(max - nextAgg, Math.round(willpowerField.superficialDamage ?? 0)),
  );
  const delta = typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount) : 0;

  if (delta > 0) {
    for (let step = 0; step < delta; step += 1) {
      if (type === 'superficial') {
        if (nextAgg + nextSup < max) {
          nextSup += 1;
        } else if (nextSup > 0) {
          // Official V5 overflow: superficial on a full track converts 1 superficial into aggravated
          nextSup -= 1;
          nextAgg = Math.min(max, nextAgg + 1);
        }
      } else if (nextAgg < max) {
        nextAgg += 1;
        nextSup = Math.min(nextSup, max - nextAgg);
      }
    }
  } else if (delta < 0) {
    const steps = Math.abs(delta);
    if (type === 'superficial') {
      nextSup = Math.max(0, nextSup - steps);
    } else {
      nextAgg = Math.max(0, nextAgg - steps);
    }
  }

  const available = Math.max(0, max - nextAgg - nextSup);
  return {
    ...willpowerField,
    max,
    value: available,
    superficialDamage: nextSup,
    aggravatedDamage: nextAgg,
  };
}

export function healV5WillpowerDamage(
  willpowerField: SheetField,
  type: 'superficial' | 'aggravated',
  amount = 1,
): SheetField {
  const healSteps =
    typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return applyV5WillpowerDamage(willpowerField, type, -healSteps);
}

export function getV5WillpowerState(sheet: CharacterSheetState): V5WillpowerState {
  const allFields = sheet.cards.flatMap((c) => c.fields);
  const wpField = allFields.find(
    (f) => f.id === 'f_willpower' || f.key.trim().toLowerCase() === 'willpower',
  );
  const composureField = allFields.find(
    (f) => f.kind === 'number' && f.key.trim().toLowerCase() === 'composure',
  );
  const resolveField = allFields.find(
    (f) => f.kind === 'number' && f.key.trim().toLowerCase() === 'resolve',
  );
  const hasDerivedAttrs =
    resolveRulePreset(sheet) === 'vampire-v5' &&
    typeof composureField?.value === 'number' &&
    Number.isFinite(composureField.value) &&
    typeof resolveField?.value === 'number' &&
    Number.isFinite(resolveField.value);

  const max = hasDerivedAttrs
    ? Math.max(1, Math.round(composureField!.value as number) + Math.round(resolveField!.value as number))
    : Math.max(1, Math.round(wpField?.max ?? 5));
  const aggravated = Math.max(0, Math.min(max, Math.round(wpField?.aggravatedDamage ?? 0)));
  const remainingAfterAgg = Math.max(0, max - aggravated);
  const hasExplicitTrack =
    typeof wpField?.superficialDamage === 'number' ||
    typeof wpField?.aggravatedDamage === 'number';
  const superficial = hasExplicitTrack
    ? Math.max(0, Math.min(remainingAfterAgg, Math.round(wpField?.superficialDamage ?? 0)))
    : Math.max(
        0,
        Math.min(
          remainingAfterAgg,
          max -
            Math.round(
              typeof wpField?.value === 'number' && Number.isFinite(wpField.value)
                ? wpField.value
                : max,
            ),
        ),
      );
  const available = Math.max(0, max - superficial - aggravated);
  return {
    max,
    superficial,
    aggravated,
    available,
    isImpaired: max > 0 && superficial + aggravated >= max,
    isFullyAggravated: max > 0 && aggravated >= max,
  };
}

export function adjustV5WillpowerDamage(
  sheet: CharacterSheetState,
  damageType: 'superficial' | 'aggravated',
  delta: number,
): CharacterSheetState {
  const { max: derivedMax } = getV5WillpowerState(sheet);
  const updated = touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if ((f.id !== 'f_willpower' && f.key !== 'willpower') || f.kind !== 'resource') return f;
        const nextField = applyV5WillpowerDamage(
          { ...f, max: f.max ?? derivedMax },
          damageType,
          delta,
        );
        return nextField;
      }),
    })),
  });
  return syncWillpowerToggleWithResource(updated);
}

export function adjustSheetHumanityStains(
  sheet: CharacterSheetState,
  delta: number,
): {
  sheet: CharacterSheetState;
  humanity: number;
  stains: number;
  overflowStains: number;
} {
  const { humanity, stains } = getSheetHumanityStains(sheet);
  const res = applyHumanityStains(humanity, stains, delta);
  const hasHumField = sheet.cards
    .flatMap((c) => c.fields)
    .some((f) => f.id === 'f_humanity' || f.key.trim().toLowerCase() === 'humanity');

  let nextSheet: CharacterSheetState = touchSheetMetadata({
    ...sheet,
    ...(sheet.stains !== undefined ? { stains: res.stains } : {}),
    cards: hasHumField
      ? sheet.cards.map((card) => ({
          ...card,
          fields: card.fields.map((f) =>
            f.id === 'f_humanity' || f.key.trim().toLowerCase() === 'humanity'
              ? { ...f, value: res.humanity, max: 10, stains: res.stains }
              : f,
          ),
        }))
      : sheet.cards,
  });

  if (res.overflowStains > 0 && resolveRulePreset(nextSheet) === 'vampire-v5') {
    nextSheet = adjustV5WillpowerDamage(nextSheet, 'aggravated', res.overflowStains);
  }

  return {
    sheet: nextSheet,
    humanity: res.humanity,
    stains: res.stains,
    overflowStains: res.overflowStains,
  };
}

export function applyRemorseOutcomeToSheet(
  sheet: CharacterSheetState,
  nextHumanity: number,
): CharacterSheetState {
  const clampedHumanity = Math.max(0, Math.min(10, Math.round(nextHumanity)));
  return touchSheetMetadata({
    ...sheet,
    ...(sheet.stains !== undefined ? { stains: 0 } : {}),
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) =>
        f.id === 'f_humanity' || f.key.trim().toLowerCase() === 'humanity'
          ? { ...f, value: clampedHumanity, max: 10, stains: 0 }
          : f,
      ),
    })),
  });
}

export function applyV5WillpowerSuperficialDamage(
  sheet: CharacterSheetState,
  delta = 1,
): CharacterSheetState {
  const updated = touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if ((f.id !== 'f_willpower' && f.key !== 'willpower') || f.kind !== 'resource') return f;
        const max = Math.max(1, f.max ?? 8);
        const hasExplicitTrack =
          typeof f.superficialDamage === 'number' || typeof f.aggravatedDamage === 'number';
        const currentVal = typeof f.value === 'number' ? Math.max(0, Math.min(max, f.value)) : max;
        if (!hasExplicitTrack && currentVal < max) {
          const currentSup = Math.max(0, Math.min(max, f.superficialDamage ?? 0));
          if (delta > 0) {
            const spent = Math.min(currentVal, delta);
            return {
              ...f,
              value: Math.max(0, currentVal - spent),
              superficialDamage: Math.min(max, currentSup + spent),
            };
          }
          const healed = Math.min(currentSup, Math.abs(delta));
          return {
            ...f,
            value: Math.min(max, currentVal + healed),
            superficialDamage: Math.max(0, currentSup - healed),
          };
        }
        return applyV5WillpowerDamage(f, 'superficial', delta);
      }),
    })),
  });
  return syncWillpowerToggleWithResource(updated);
}

export function applyRouseCheckHunger(
  sheet: CharacterSheetState,
  hungerDelta: number,
): CharacterSheetState {
  if (hungerDelta <= 0) return sheet;
  return adjustResourceValue(sheet, 'f_hunger', hungerDelta);
}

export function toggleSheetBloodSurge(
  sheet: CharacterSheetState,
  nextState?: boolean,
): CharacterSheetState {
  const next = nextState !== undefined ? nextState : !Boolean(sheet.bloodSurge);
  return touchSheetMetadata({
    ...sheet,
    bloodSurge: next,
  });
}

function createWodDossierCard(isV5: boolean): SheetCard {
  return {
    id: 'card_wod_dossier',
    tab: 'magias',
    code: isV5 ? '//CHRONICLE_TRAITS' : '//TRAITS_&_HAVENS',
    title: isV5 ? 'CONVICTIONS, QUALITIES & HAVENS' : 'QUALITIES, FLAWS & HAVENS',
    colSpan: 2,
    fields: [],
  };
}

function clampMeritFlawRating(rating: number): number {
  return Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : 1;
}

function clampHavenRating(rating: number): number {
  return Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
}

export function addTouchstone(
  sheet: CharacterSheetState,
  entry: TouchstoneEntry,
): CharacterSheetState {
  const existing = Array.isArray(sheet.touchstones) ? sheet.touchstones : [];
  return touchSheetMetadata({
    ...sheet,
    touchstones: [...existing, entry],
  });
}

export function updateTouchstone(
  sheet: CharacterSheetState,
  id: string,
  patch: Partial<Omit<TouchstoneEntry, 'id'>>,
): CharacterSheetState {
  const existing = Array.isArray(sheet.touchstones) ? sheet.touchstones : [];
  return touchSheetMetadata({
    ...sheet,
    touchstones: existing.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  });
}

export function removeTouchstone(sheet: CharacterSheetState, id: string): CharacterSheetState {
  const existing = Array.isArray(sheet.touchstones) ? sheet.touchstones : [];
  return touchSheetMetadata({
    ...sheet,
    touchstones: existing.filter((item) => item.id !== id),
  });
}

export function addMeritFlaw(
  sheet: CharacterSheetState,
  entry: MeritFlawEntry,
): CharacterSheetState {
  const existing = Array.isArray(sheet.meritsFlaws) ? sheet.meritsFlaws : [];
  return touchSheetMetadata({
    ...sheet,
    meritsFlaws: [...existing, { ...entry, rating: clampMeritFlawRating(entry.rating) }],
  });
}

export function updateMeritFlaw(
  sheet: CharacterSheetState,
  id: string,
  patch: Partial<Omit<MeritFlawEntry, 'id'>>,
): CharacterSheetState {
  const existing = Array.isArray(sheet.meritsFlaws) ? sheet.meritsFlaws : [];
  return touchSheetMetadata({
    ...sheet,
    meritsFlaws: existing.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
            rating:
              patch.rating !== undefined ? clampMeritFlawRating(patch.rating) : item.rating,
          }
        : item,
    ),
  });
}

export function removeMeritFlaw(sheet: CharacterSheetState, id: string): CharacterSheetState {
  const existing = Array.isArray(sheet.meritsFlaws) ? sheet.meritsFlaws : [];
  return touchSheetMetadata({
    ...sheet,
    meritsFlaws: existing.filter((item) => item.id !== id),
  });
}

export function addHaven(sheet: CharacterSheetState, entry: HavenEntry): CharacterSheetState {
  const existing = Array.isArray(sheet.havens) ? sheet.havens : [];
  return touchSheetMetadata({
    ...sheet,
    havens: [
      ...existing,
      {
        ...entry,
        rating: clampHavenRating(entry.rating),
        traits: Array.isArray(entry.traits) ? [...entry.traits] : [],
      },
    ],
  });
}

export function updateHaven(
  sheet: CharacterSheetState,
  id: string,
  patch: Partial<Omit<HavenEntry, 'id'>>,
): CharacterSheetState {
  const existing = Array.isArray(sheet.havens) ? sheet.havens : [];
  return touchSheetMetadata({
    ...sheet,
    havens: existing.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
            rating: patch.rating !== undefined ? clampHavenRating(patch.rating) : item.rating,
            traits: patch.traits !== undefined ? [...patch.traits] : item.traits,
          }
        : item,
    ),
  });
}

export function removeHaven(sheet: CharacterSheetState, id: string): CharacterSheetState {
  const existing = Array.isArray(sheet.havens) ? sheet.havens : [];
  return touchSheetMetadata({
    ...sheet,
    havens: existing.filter((item) => item.id !== id),
  });
}

export function migrateLegacyDnd5eSheet(sheet: CharacterSheetState): CharacterSheetState {
  if (detectSystemId(sheet) !== 'dnd5e') return sheet;
  const allFields = sheet.cards.flatMap((c) => c.fields);
  const byKey = (k: string) => allFields.find((f) => f.key.trim().toLowerCase() === k);
  const levelVal = Number(byKey('level')?.value ?? byKey('nivel')?.value ?? 1);
  const level = Number.isFinite(levelVal) ? Math.max(1, Math.min(20, Math.trunc(levelVal))) : 1;
  const inspField = byKey('inspiration');
  const hdField = byKey('hit_dice');
  const hdMatch = String(hdField?.label ?? '').match(/\b(d6|d8|d10|d12)\b/i);
  const hdDie = (hdMatch ? hdMatch[1].toLowerCase() : 'd8') as Dnd5eHitDieType;
  const hdMax = typeof hdField?.max === 'number' && hdField.max >= 1 ? hdField.max : level;
  const hdCur = typeof hdField?.value === 'number' ? Math.max(0, Math.min(hdMax, Math.trunc(hdField.value))) : hdMax;

  const saveProficiencies = { str: false, dex: false, con: false, int: false, wis: false, cha: false };
  for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
    if (allFields.some((f) => new RegExp(`(?:roll_${ab}_save|save_${ab})`, 'i').test(f.key) && /prof/i.test(f.rollExpr ?? ''))) {
      saveProficiencies[ab] = true;
    }
  }

  const skillProficiencies = Object.fromEntries(
    DND5E_SKILLS.map((s) => {
      const f = byKey(s.key);
      const val = typeof f?.value === 'number' ? f.value : 0;
      const prof: Dnd5eSkillProficiency = val > 0 ? 'proficient' : 'none';
      return [s.key, prof];
    }),
  ) as Record<Dnd5eSkillKey, Dnd5eSkillProficiency>;

  const spellField = byKey('spell_dc') ?? byKey('spell_atk');
  const spellFormula = String(spellField?.formula ?? '').toLowerCase();
  const spellAbility: Dnd5eSpellcastingAbilityKey = spellFormula.includes('mod_wis')
    ? 'wis'
    : spellFormula.includes('mod_cha')
      ? 'cha'
      : 'int';
  const slots = createDefaultDnd5eSlots().map((def) => {
    const sf = allFields.find((f) => f.kind === 'resource' && new RegExp(`^slots_${def.level}(?:st|nd|rd|th)?$`, 'i').test(f.key));
    if (!sf) return def;
    const max = Math.max(0, Math.min(20, Math.trunc(sf.max ?? 0)));
    const avail = Math.max(0, Math.min(max, Math.trunc(typeof sf.value === 'number' ? sf.value : max)));
    return { level: def.level, max, used: Math.max(0, max - avail) };
  });

  const normalized = normalizeDnd5eState(sheet.dnd5eState, {
    level,
    inspiration: Boolean(inspField?.value),
    tempHp: 0,
    hitDice: { die: hdDie, current: hdCur, max: hdMax },
    deathSaves: { successes: 0, failures: 0 },
    saveProficiencies,
    skillProficiencies,
    spellcasting: { ability: spellAbility, slots },
  });

  if (sheet.dnd5eState && JSON.stringify(sheet.dnd5eState) === JSON.stringify(normalized)) {
    return sheet;
  }
  return { ...sheet, dnd5eState: normalized };
}

export function migrateLegacyWodSheet(
  sheet: CharacterSheetState,
  options?: {
    deviceId?: string;
    nowIso?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): CharacterSheetState {
  const withMeta = migrateLegacySheetMetadata(sheet, options);
  const sysId = detectSystemId(withMeta);
  if (sysId === 'dnd5e') return migrateLegacyDnd5eSheet(withMeta);
  if (sysId !== 'wod') return withMeta;
  const isV5 = resolveRulePreset(withMeta) === 'vampire-v5';
  const expectedAttrs = isV5 ? WOD_V5_ATTRIBUTE_SPECS : WOD_V20_ATTRIBUTE_SPECS;
  const attrGroupByKey = new Map(expectedAttrs.map((spec) => [spec.key, spec.attributeGroup]));
  const expectedIdentity = isV5 ? WOD_V5_IDENTITY_SPECS : WOD_V20_IDENTITY_SPECS;
  let changed = false;

  const cards = withMeta.cards.map((card) => {
    let cardChanged = false;
    let nextTitle = card.title;

    if (card.id === 'card_combate' && card.title === 'HEALTH · WILLPOWER · BLOOD') {
      nextTitle = 'HEALTH · WILLPOWER · HUNGER';
      cardChanged = true;
    }

    let fields = card.fields.map((field) => {
      const fk = (field.key ?? '').trim().toLowerCase();
      if (card.id === 'card_combate' && (field.id === 'f_blood_pool' || fk === 'blood_pool')) {
        cardChanged = true;
        return {
          id: 'f_hunger',
          key: 'hunger',
          label: 'HUNGER',
          kind: 'resource' as const,
          value: 1,
          max: 5,
        };
      }
      if (card.id === 'card_combate' && field.id === 'f_health' && !field.damageTrack) {
        cardChanged = true;
        const max = Math.max(1, field.max ?? 7);
        const currVal = typeof field.value === 'number' ? Math.max(0, Math.min(max, field.value)) : max;
        return {
          ...field,
          max,
          value: currVal,
          damageTrack: true,
          superficialDamage: field.superficialDamage ?? 0,
          aggravatedDamage: field.aggravatedDamage ?? Math.max(0, max - currVal),
          ...(isV5 && !field.maxFormula ? { maxFormula: 'stamina + 3' } : {}),
        };
      }
      if (
        card.id === 'card_combate' &&
        isV5 &&
        field.kind === 'resource' &&
        (field.id === 'f_health' || fk === 'health') &&
        !field.maxFormula
      ) {
        cardChanged = true;
        return {
          ...field,
          maxFormula: 'stamina + 3',
        };
      }
      if (
        card.id === 'card_combate' &&
        isV5 &&
        field.kind === 'resource' &&
        (field.id === 'f_willpower' || fk === 'willpower') &&
        (!field.maxFormula ||
          field.superficialDamage === undefined ||
          field.aggravatedDamage === undefined)
      ) {
        cardChanged = true;
        const wpMax = Math.max(1, Math.round(field.max ?? 5));
        const wpAgg = Math.max(0, Math.min(wpMax, Math.round(field.aggravatedDamage ?? 0)));
        const wpVal =
          typeof field.value === 'number' && Number.isFinite(field.value)
            ? Math.max(0, Math.min(wpMax, Math.round(field.value)))
            : wpMax - wpAgg;
        const wpSup =
          typeof field.superficialDamage === 'number'
            ? Math.max(0, Math.min(wpMax - wpAgg, Math.round(field.superficialDamage)))
            : Math.max(0, Math.min(wpMax - wpAgg, wpMax - wpAgg - wpVal));
        return {
          ...field,
          maxFormula: field.maxFormula || 'composure + resolve',
          superficialDamage: wpSup,
          aggravatedDamage: wpAgg,
        };
      }
      if (
        card.id === 'card_combate' &&
        isV5 &&
        field.kind === 'resource' &&
        (field.id === 'f_humanity' || fk === 'humanity')
      ) {
        const humVal =
          typeof field.value === 'number' && Number.isFinite(field.value)
            ? Math.max(0, Math.min(10, Math.round(field.value)))
            : 7;
        const rawStains = field.stains ?? withMeta.stains;
        const clampedStains =
          typeof rawStains === 'number' && Number.isFinite(rawStains)
            ? Math.max(0, Math.min(10 - humVal, Math.round(rawStains)))
            : 0;
        if (field.stains !== clampedStains || field.stains === undefined) {
          cardChanged = true;
          return {
            ...field,
            stains: clampedStains,
          };
        }
      }
      if (
        card.id === 'card_atributos' &&
        field.attributeGroup === undefined &&
        attrGroupByKey.has(fk)
      ) {
        cardChanged = true;
        return {
          ...field,
          attributeGroup: attrGroupByKey.get(fk),
        };
      }
      if (
        (field.id === 'f_wp_boost' || fk === 'wp_boost') &&
        field.label !== 'WILLPOWER (+1 AUTO SUCCESS)'
      ) {
        cardChanged = true;
        return {
          ...field,
          label: 'WILLPOWER (+1 AUTO SUCCESS)',
          hint: 'SPENT ON NEXT ROLL',
        };
      }
      if (
        field.id === 'f_soak' &&
        (field.rollExpr === 'pool(stamina, 6)' || !field.isSoak)
      ) {
        cardChanged = true;
        return {
          ...field,
          rollExpr: 'pool(stamina + fortitude_armor, 6)',
          rollDifficulty: field.rollDifficulty ?? 6,
          rollSpecialty: field.rollSpecialty ?? false,
          rollMod: field.rollMod ?? 0,
          isSoak: true,
        };
      }
      if (field.kind === 'roll' && field.rollExpr && /\+\s*wp_boost\b/i.test(field.rollExpr)) {
        cardChanged = true;
        return {
          ...field,
          rollExpr: field.rollExpr.replace(/\s*\+\s*wp_boost\b/gi, ''),
        };
      }
      return field;
    });

    if (card.id === 'card_atributos') {
      const existingIds = new Set(fields.map((f) => f.id));
      const existingKeys = new Set(fields.map((f) => (f.key ?? '').trim().toLowerCase()));
      const missingAttrs: SheetField[] = expectedAttrs
        .filter((spec) => !existingIds.has(spec.id) && !existingKeys.has(spec.key))
        .map((spec) => ({
          id: spec.id,
          key: spec.key,
          label: spec.label,
          kind: 'number' as const,
          attributeGroup: spec.attributeGroup,
          value: 1,
        }));
      if (missingAttrs.length > 0) {
        cardChanged = true;
        const firstCalcIdx = fields.findIndex((f) => f.kind === 'calculated');
        if (firstCalcIdx !== -1) {
          fields = [
            ...fields.slice(0, firstCalcIdx),
            ...missingAttrs,
            ...fields.slice(firstCalcIdx),
          ];
        } else {
          fields = [...fields, ...missingAttrs];
        }
      }
    }

    if (card.id === 'card_identidade') {
      const existingIds = new Set(fields.map((f) => f.id));
      const existingKeys = new Set(fields.map((f) => (f.key ?? '').trim().toLowerCase()));
      const missingIdentity: SheetField[] = expectedIdentity
        .filter((spec) => !existingIds.has(spec.id) && !existingKeys.has(spec.key))
        .map((spec) => ({
          id: spec.id,
          key: spec.key,
          label: spec.label,
          kind: 'text' as const,
          value: '',
        }));
      if (missingIdentity.length > 0) {
        cardChanged = true;
        fields = [...fields, ...missingIdentity];
      }
    }

    if (
      card.id === 'card_combate' &&
      !fields.some((f) => f.id === 'f_fortitude_armor' || f.key === 'fortitude_armor')
    ) {
      cardChanged = true;
      const armorField: SheetField = {
        id: 'f_fortitude_armor',
        key: 'fortitude_armor',
        label: 'FORTITUDE / ARMOR',
        kind: 'number',
        value: 0,
      };
      const wpIdx = fields.findIndex((f) => f.id === 'f_wp_boost');
      if (wpIdx !== -1) {
        fields = [...fields.slice(0, wpIdx), armorField, ...fields.slice(wpIdx)];
      } else {
        fields = [...fields, armorField];
      }
    }

    if (cardChanged) {
      changed = true;
      return { ...card, title: nextTitle, fields };
    }
    return card;
  });

  let nextCards = changed ? cards : withMeta.cards;
  let nextSheet: CharacterSheetState = changed ? { ...withMeta, cards: nextCards } : { ...withMeta };

  if (resolveRulePreset(nextSheet) !== 'custom' && !nextCards.some((c) => c.id === 'card_wod_dossier')) {
    const dossierCard = createWodDossierCard(isV5);
    const notesIdx = nextCards.findIndex((c) => c.id === 'card_notas');
    nextCards =
      notesIdx >= 0
        ? [...nextCards.slice(0, notesIdx), dossierCard, ...nextCards.slice(notesIdx)]
        : [...nextCards, dossierCard];
    nextSheet = { ...nextSheet, cards: nextCards };
  }

  if (nextSheet.meritsFlaws === undefined) {
    nextSheet = { ...nextSheet, meritsFlaws: [] };
  }
  if (nextSheet.havens === undefined) {
    nextSheet = { ...nextSheet, havens: [] };
  }
  if (isV5 && nextSheet.touchstones === undefined) {
    nextSheet = { ...nextSheet, touchstones: [] };
  }

  return syncWillpowerToggleWithResource(nextSheet);
}

export function migrateLocalStorageSheet(
  raw: unknown,
  options?: {
    deviceId?: string;
    nowIso?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): CharacterSheetState | null {
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<CharacterSheetState>;
    if (!Array.isArray(candidate.cards)) return null;
    const base: CharacterSheetState = {
      id: candidate.id,
      systemId: candidate.systemId,
      systemName: typeof candidate.systemName === 'string' ? candidate.systemName : 'SISTEMA CUSTOMIZADO',
      systemCode: typeof candidate.systemCode === 'string' ? candidate.systemCode : '/SYS: CUSTOM',
      characterName:
        typeof candidate.characterName === 'string' && candidate.characterName.trim().length > 0
          ? candidate.characterName
          : 'NOVO PERSONAGEM',
      revision: candidate.revision as number,
      updatedAt: candidate.updatedAt as string,
      deviceId: candidate.deviceId as string,
      rulePreset: candidate.rulePreset ?? candidate.xpRulePreset,
      xpRulePreset: candidate.xpRulePreset ?? candidate.rulePreset,
      customUseNewLevelBase: candidate.customUseNewLevelBase,
      bloodPool: candidate.bloodPool,
      bloodSurge: candidate.bloodSurge,
      stains: candidate.stains,
      virtues: candidate.virtues,
      touchstones: candidate.touchstones,
      meritsFlaws: candidate.meritsFlaws,
      havens: candidate.havens,
      ...(candidate.dnd5eState !== undefined ? { dnd5eState: candidate.dnd5eState } : {}),
      cards: candidate.cards,
      rollLogs: Array.isArray(candidate.rollLogs) ? candidate.rollLogs : [],
      xp: candidate.xp,
    };
    return migrateLegacyWodSheet(base, options);
  } catch {
    return null;
  }
}

export function migrateWorkspaceSheets(
  workspace: WorkspaceState,
  options?: {
    deviceId?: string;
    nowIso?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): WorkspaceState {
  const migratedSheets: Partial<Record<SystemId, CharacterSheetState>> = {};
  for (const [key, sheetVal] of Object.entries(workspace.sheetsBySystem)) {
    if (!sheetVal) continue;
    const sysId = key as SystemId;
    const migrated = migrateLegacyWodSheet({ ...sheetVal, systemId: sysId }, options);
    migratedSheets[sysId] = { ...migrated, systemId: sysId };
  }
  return {
    activeSystemId: workspace.activeSystemId,
    sheetsBySystem: migratedSheets,
  };
}

export function addRepeatableRow(
  sheet: CharacterSheetState,
  fieldId: string,
  newId: string,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'repeatable') return f;
        const defaultCol2 = f.col2Type === 'number' ? 1.0 : '1 SLOT';
        const rows = [...(f.rows ?? []), { id: newId, col1: 'Novo Item', col2: defaultCol2 }];
        return { ...f, rows };
      }),
    })),
  });
}

export function updateRepeatableRow(
  sheet: CharacterSheetState,
  fieldId: string,
  rowId: string,
  col: 'col1' | 'col2',
  val: string | number,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'repeatable') return f;
        const rows = (f.rows ?? []).map((r) => (r.id === rowId ? { ...r, [col]: val } : r));
        return { ...f, rows };
      }),
    })),
  });
}

export function removeRepeatableRow(
  sheet: CharacterSheetState,
  fieldId: string,
  rowId: string,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'repeatable') return f;
        const rows = (f.rows ?? []).filter((r) => r.id !== rowId);
        return { ...f, rows };
      }),
    })),
  });
}

export function updateFieldSchema(
  sheet: CharacterSheetState,
  fieldId: string,
  patch: Partial<SheetField>,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    })),
  });
}

function buildUniqueFieldKey(existingKeys: Set<string>, rawKey: string): string {
  const base = rawKey.trim() || 'field';
  if (!existingKeys.has(base)) return base;
  let suffix = 2;
  while (existingKeys.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function reorderFieldInCard(
  fields: SheetField[],
  fieldId: string,
  direction: 'up' | 'down',
): SheetField[] {
  const idx = fields.findIndex((f) => f.id === fieldId);
  if (idx === -1) return fields;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= fields.length) return fields;
  const next = [...fields];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

export function addFieldToCard(
  sheet: CharacterSheetState,
  cardId: string,
  newField: SheetField,
): CharacterSheetState {
  const sysId = detectSystemId(sheet);

  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => {
      if (card.id !== cardId) return card;

      const existingKeys = new Set(card.fields.map((f) => f.key));
      let normalizedField: SheetField = { ...newField };

      if (normalizedField.kind === 'roll') {
        const clampedDiff = Math.max(
          1,
          Math.min(10, Math.round(normalizedField.rollDifficulty ?? 6)),
        );
        const matchingNumericField = card.fields.find(
          (f) => f.kind === 'number' && f.key === normalizedField.key,
        );
        const cardSig = `${card.code} ${card.title}`.toUpperCase();
        const isD10RollCard =
          sysId === 'wod' ||
          /SKILL|PERICIA|PERÍCIA|HABILIDAD|ABILIT|DISCIPLIN|PODER|POWER|ARCANO|POOL|D10/.test(
            cardSig,
          );

        const nextKey = matchingNumericField
          ? buildUniqueFieldKey(existingKeys, `roll_${matchingNumericField.key}`)
          : buildUniqueFieldKey(existingKeys, normalizedField.key);

        let nextExpr = normalizedField.rollExpr ?? '2d6';
        if (nextExpr.trim() === '2d6') {
          if (matchingNumericField) {
            nextExpr = `pool(${matchingNumericField.key}, ${clampedDiff})`;
          } else if (isD10RollCard) {
            nextExpr = `pool(1, ${clampedDiff})`;
          }
        }

        normalizedField = {
          ...normalizedField,
          key: nextKey,
          rollExpr: nextExpr,
          rollDifficulty: clampedDiff,
          rollSpecialty: Boolean(normalizedField.rollSpecialty ?? false),
          rollMod:
            typeof normalizedField.rollMod === 'number' && Number.isFinite(normalizedField.rollMod)
              ? Math.round(normalizedField.rollMod)
              : 0,
        };
      } else {
        normalizedField = {
          ...normalizedField,
          key: buildUniqueFieldKey(existingKeys, normalizedField.key),
        };
      }

      return { ...card, fields: [...card.fields, normalizedField] };
    }),
  });
}

export function removeFieldFromCard(
  sheet: CharacterSheetState,
  cardId: string,
  fieldId: string,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) =>
      card.id === cardId
        ? { ...card, fields: card.fields.filter((f) => f.id !== fieldId) }
        : card,
    ),
  });
}

export function addCardToSheet(
  sheet: CharacterSheetState,
  newCard: SheetCard,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: [...sheet.cards, newCard],
  });
}

export function updateCardSchema(
  sheet: CharacterSheetState,
  cardId: string,
  patch: Partial<Pick<SheetCard, 'code' | 'title' | 'colSpan' | 'tab' | 'fields'>>,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
  });
}

export function removeCardFromSheet(
  sheet: CharacterSheetState,
  cardId: string,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.filter((card) => card.id !== cardId),
  });
}

export function detectSystemId(sheet: CharacterSheetState): SystemId {
  if (sheet.systemId) return sheet.systemId;
  const sig = `${sheet.systemName} ${sheet.systemCode}`.toUpperCase();
  if (sig.includes('DARKNESS') || sig.includes('STORYTELLER') || sig.includes('VAMPIRE')) {
    return 'wod';
  }
  if (sig.includes('D&D') || sig.includes('DND') || sig.includes('5E')) {
    return 'dnd5e';
  }
  if (sig.includes('CYBERPUNK') || sig.includes('RUNNER')) {
    return 'cyberpunk';
  }
  if (sig.includes('GENÉRICO') || sig.includes('GENERICO')) {
    return 'default';
  }
  return 'blank';
}

export function createPresetBySystemId(systemId: SystemId): CharacterSheetState {
  switch (systemId) {
    case 'wod':
      return createWorldOfDarknessSheet();
    case 'dnd5e':
      return createDnd5ePreset();
    case 'cyberpunk':
      return createCyberpunkPreset();
    case 'default':
      return createGenericD20Preset();
    case 'blank':
    default:
      return createBlankSheet();
  }
}

const WOD_BASE_ONE_KEYS = new Set([
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
]);

const DND_ABILITY_KEYS = new Set([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
  'forca',
  'destreza',
  'constituicao',
  'inteligencia',
  'sabedoria',
  'carisma',
  'intelecto',
]);

export type WodEdition = 'vampire-v5' | 'storyteller-v20';

export interface WodClanPreset {
  id: string;
  editions: readonly WodEdition[];
  labels: Record<'pt-BR' | 'en' | 'es', string>;
  clanDisciplines: readonly string[];
  isCaitiff: boolean;
  isThinBlood?: boolean;
}

export function getWodClansForEdition(edition: WodEdition): readonly WodClanPreset[] {
  return getClansForEdition(edition).map((clan) => ({
    id: clan.id,
    editions: [clan.edition] as const,
    labels: { ...clan.name },
    clanDisciplines: clan.clanDisciplines,
    isCaitiff: clan.isCaitiff,
    ...('isThinBlood' in clan ? { isThinBlood: clan.isThinBlood } : {}),
  }));
}

export interface NewSheetIdentityInput {
  characterName?: string;
  name?: string;
  secondaryTrait?: string;
  clan?: string;
  rulePreset?: RulePreset;
  edition?: WodEdition;
  language?: AppLanguage;
  clanWeakness?: string;
  clanBane?: string;
  clanCompulsion?: string;
  localeOptions?: {
    newCharacterName?: string;
    customSystemName?: string;
    customSystemCode?: string;
  };
}

const V20_ONLY_IDENTITY_IDS = new Set(['f_nature', 'f_demeanor', 'f_clan_weakness']);

function buildWodV5EditionCards(cards: SheetCard[]): SheetCard[] {
  const v5IdentityExtras: SheetField[] = WOD_V5_IDENTITY_SPECS
    .filter((spec) => !['concept', 'sire', 'chronicle'].includes(spec.key))
    .map((spec) => ({
      id: spec.id,
      key: spec.key,
      label: spec.label,
      kind: 'text' as const,
      value: '',
      ...(spec.placeholder ? { placeholder: spec.placeholder } : {}),
    }));

  const v5Attributes: SheetField[] = WOD_V5_ATTRIBUTE_SPECS.map((spec) => ({
    id: spec.id,
    key: spec.key,
    label: spec.label,
    kind: 'number' as const,
    attributeGroup: spec.attributeGroup,
    value: 1,
  }));

  const staminaInit = Number(v5Attributes.find((a) => a.key === 'stamina')?.value ?? 1);
  const composureInit = Number(v5Attributes.find((a) => a.key === 'composure')?.value ?? 1);
  const resolveInit = Number(v5Attributes.find((a) => a.key === 'resolve')?.value ?? 1);
  const initialHealthMax = Math.max(4, staminaInit + 3);
  const initialWillpowerMax = Math.max(2, composureInit + resolveInit);

  return cards.map((card) => {
    let nextFields = card.fields;

    if (card.id === 'card_wod_dossier') {
      return {
        ...card,
        code: '//CHRONICLE_TRAITS',
        title: 'CONVICTIONS, QUALITIES & HAVENS',
      };
    }

    if (card.id === 'card_identidade') {
      const baseIdentity = nextFields.filter(
        (f) => !V20_ONLY_IDENTITY_IDS.has(f.id) && !['nature', 'demeanor', 'clan_weakness'].includes((f.key ?? '').trim().toLowerCase()),
      );
      nextFields = [...baseIdentity, ...v5IdentityExtras];
    } else if (card.id === 'card_atributos') {
      const derivedFields = nextFields.filter((f) => f.kind === 'calculated');
      nextFields = [...v5Attributes, ...derivedFields];
    } else if (card.id === 'card_combate') {
      nextFields = nextFields.map((f) => {
        const k = (f.key ?? '').trim().toLowerCase();
        if (f.id === 'f_health' || k === 'health') {
          const {
            bashingDamage: _dropBashing,
            lethalDamage: _dropLethal,
            ...restHealth
          } = f;
          return {
            ...restHealth,
            max: initialHealthMax,
            maxFormula: 'stamina + 3',
            value: initialHealthMax,
            superficialDamage: 0,
            aggravatedDamage: 0,
          };
        }
        if (f.id === 'f_willpower' || k === 'willpower') {
          return {
            ...f,
            max: initialWillpowerMax,
            maxFormula: 'composure + resolve',
            value: initialWillpowerMax,
            superficialDamage: 0,
            aggravatedDamage: 0,
          };
        }
        if (f.id === 'f_hunger' || k === 'hunger') {
          return { ...f, value: 1 };
        }
        if (f.id === 'f_humanity' || k === 'humanity') {
          return { ...f, value: 7, stains: 0 };
        }
        return f;
      });
    }

    return {
      ...card,
      fields: nextFields.map((f) => {
        const isSoak = Boolean(f.isSoak || f.id === 'f_soak' || f.key === 'soak_roll');
        if (f.kind !== 'roll' || isSoak) return f;
        const normalizedExpr =
          typeof f.rollExpr === 'string' && /^pool\(.+,\s*\d+\s*\)$/i.test(f.rollExpr.trim())
            ? f.rollExpr.trim().replace(/,\s*\d+\s*\)$/, ', 2)')
            : f.rollExpr;
        return {
          ...f,
          rollExpr: normalizedExpr,
          rollDifficulty: 2,
          rollDifficultyV5: 2,
          rollSpecialty: false,
        };
      }),
    };
  });
}

export function createNewSheetForSystem(
  systemId: SystemId | string,
  identity?: NewSheetIdentityInput,
): CharacterSheetState {
  const validIds: SystemId[] = ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'];
  const rawSystemId = String(systemId ?? '').toLowerCase();
  const isV5System = rawSystemId.includes('v5');
  const resolvedId: SystemId = validIds.includes(systemId as SystemId)
    ? (systemId as SystemId)
    : isV5System
      ? 'wod'
      : 'blank';
  const rawPreset =
    resolvedId === 'wod' ? (identity?.edition ?? identity?.rulePreset) : identity?.rulePreset;
  const defaultXpRulePreset: XpRulePreset = rawPreset
    ? normalizeRulePreset(rawPreset)
    : isV5System
      ? 'vampire-v5'
      : 'storyteller-v20';
  const customCharName = identity?.characterName?.trim() || identity?.name?.trim() || '';
  const customSecondaryTrait =
    resolvedId === 'wod'
      ? identity?.clan?.trim() || identity?.secondaryTrait?.trim() || ''
      : identity?.secondaryTrait?.trim() || '';
  const defaultNewName = identity?.localeOptions?.newCharacterName ?? 'NOVO PERSONAGEM';

  if (resolvedId === 'blank') {
    const blank = createBlankSheet(identity?.localeOptions);
    return customCharName
      ? {
          ...blank,
          characterName: customCharName.toUpperCase(),
          rulePreset: defaultXpRulePreset,
          xpRulePreset: defaultXpRulePreset,
        }
      : { ...blank, rulePreset: defaultXpRulePreset, xpRulePreset: defaultXpRulePreset };
  }

  const preset = createPresetBySystemId(resolvedId);
  const freshCards = preset.cards.map((card) => ({
    ...card,
    fields: card.fields.map((field) => {
      const k = (field.key ?? '').trim().toLowerCase();

      if (field.kind === 'text') {
        const sample = typeof field.value === 'string' ? field.value.trim() : '';
        const shouldHint =
          sample.length > 0 && sample.length <= 48 && field.key !== 'notas_campanha';
        let nextTextVal = '';
        if (
          customCharName &&
          (field.id === 'f_nome' || k === 'character_name' || k === 'nome_personagem')
        ) {
          nextTextVal = customCharName;
        } else if (
          customSecondaryTrait &&
          (field.id === 'f_clan' ||
            field.id === 'f_classe' ||
            field.id === 'f_arquetipo' ||
            k === 'clan' ||
            k === 'class_race' ||
            k === 'arquetipo')
        ) {
          nextTextVal = customSecondaryTrait;
        }
        return {
          ...field,
          value: nextTextVal,
          placeholder: shouldHint ? sample : field.placeholder,
        };
      }

      if (field.kind === 'number') {
        let nextNum = 0;
        if (resolvedId === 'wod') {
          if (k === 'generation') nextNum = 13;
          else if (WOD_BASE_ONE_KEYS.has(k)) nextNum = 1;
          else nextNum = 0;
        } else if (resolvedId === 'cyberpunk') {
          if (k === 'nivel' || k === 'level') nextNum = 1;
          else if (DND_ABILITY_KEYS.has(k)) nextNum = 5;
          else nextNum = 0;
        } else {
          if (k === 'level' || k === 'nivel') nextNum = 1;
          else if (DND_ABILITY_KEYS.has(k)) nextNum = 10;
          else nextNum = 0;
        }
        return { ...field, value: nextNum };
      }

      if (field.kind === 'resource') {
        const max = Math.max(1, field.max ?? 10);
        if (field.damageTrack) {
          const isWodV20 = resolvedId === 'wod' && defaultXpRulePreset !== 'vampire-v5';
          return {
            ...field,
            value: max,
            ...(isWodV20 ? { bashingDamage: 0, lethalDamage: 0 } : {}),
            superficialDamage: 0,
            aggravatedDamage: 0,
          };
        }
        if (k === 'hunger') {
          return { ...field, value: 1 };
        }
        if (k === 'humanity') {
          return { ...field, value: Math.min(max, 7) };
        }
        return { ...field, value: max };
      }

      if (field.kind === 'boolean') {
        return { ...field, value: false };
      }

      if (field.kind === 'repeatable') {
        return { ...field, rows: [] };
      }

      return field;
    }),
  }));

  const isWodV5 = resolvedId === 'wod' && defaultXpRulePreset === 'vampire-v5';
  const isWodV20 = resolvedId === 'wod' && !isWodV5;
  const {
    bloodPool: _dropBloodPool,
    virtues: _dropVirtues,
    meritsFlaws: _dropMeritsFlaws,
    havens: _dropHavens,
    touchstones: _dropTouchstones,
    ...presetClean
  } = preset;
  const basePreset = resolvedId === 'wod' ? presetClean : preset;

  const editionCards = isWodV5 ? buildWodV5EditionCards(freshCards) : freshCards;
  const wodEdition =
    resolvedId === 'wod' &&
    (defaultXpRulePreset === 'storyteller-v20' || defaultXpRulePreset === 'vampire-v5')
      ? defaultXpRulePreset
      : null;
  const lang: AppLanguage = identity?.language ?? 'pt-BR';
  const matchedClan =
    wodEdition && customSecondaryTrait
      ? findClanByIdOrName(customSecondaryTrait, wodEdition)
      : null;
  const customWeakness = identity?.clanWeakness?.trim();
  const customBane = identity?.clanBane?.trim();
  const customCompulsion = identity?.clanCompulsion?.trim();

  const resolvedCards = wodEdition
    ? editionCards.map((card) => {
        if (card.id !== 'card_identidade') return card;
        return {
          ...card,
          fields: card.fields.map((f) => {
            const fk = (f.key ?? '').trim().toLowerCase();
            if (fk === 'clan_weakness') {
              if (customWeakness) return { ...f, value: customWeakness };
              if (matchedClan?.edition === 'storyteller-v20') {
                return { ...f, value: matchedClan.weakness[lang] };
              }
            } else if (fk === 'clan_bane') {
              if (customBane) return { ...f, value: customBane };
              if (matchedClan?.edition === 'vampire-v5') {
                return { ...f, value: matchedClan.bane[lang] };
              }
            } else if (fk === 'clan_compulsion') {
              if (customCompulsion) return { ...f, value: customCompulsion };
              if (matchedClan?.edition === 'vampire-v5') {
                return { ...f, value: matchedClan.compulsion[lang] };
              }
            }
            return f;
          }),
        };
      })
    : editionCards;

  return {
    ...basePreset,
    ...(isWodV5
      ? {
          systemName: 'VAMPIRE: THE MASQUERADE // V5',
          systemCode: '/SYS: WORLD OF DARKNESS · VAMPIRE V5',
          touchstones: [],
          meritsFlaws: [],
          havens: [],
        }
      : {}),
    ...(isWodV20
      ? {
          bloodPool: getBloodPoolMaxByGeneration(13),
          virtues: { conscience: 1, selfControl: 1, courage: 1 },
          meritsFlaws: [],
          havens: [],
        }
      : {}),
    ...(resolvedId === 'dnd5e'
      ? {
          dnd5eState: createDefaultDnd5eState({
            level: 1,
            inspiration: false,
            tempHp: 0,
            hitDice: { die: 'd8', current: 1, max: 1 },
          }),
        }
      : {}),
    systemId: resolvedId,
    characterName: customCharName ? customCharName.toUpperCase() : defaultNewName,
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    rulePreset: defaultXpRulePreset,
    xpRulePreset: defaultXpRulePreset,
    cards: resolvedCards,
    rollLogs: [],
    xp: {
      totalEarned: 0,
      spent: 0,
      ledger: [],
    },
  };
}

export const createFreshSheetForSystem = createNewSheetForSystem;

function sanitizeCanonicalFieldId(rawId: string, fallbackIndex: number): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  const prefixed = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `f_${cleaned || fallbackIndex}`;
  return prefixed.slice(0, 64);
}

export function toCanonicalSheet(sheet: CharacterSheetState): CanonicalSheet {
  const migrated = migrateLegacySheetMetadata(sheet);
  const sysId = detectSystemId(migrated);
  const tabDefs: Array<{ id: TabId; title: string }> = [
    { id: 'geral', title: 'GERAL' },
    { id: 'magias', title: 'MAGIAS' },
    { id: 'xp', title: 'XP' },
  ];

  const tabs: CanonicalTab[] = tabDefs.map((tabDef) => {
    const tabCards = migrated.cards.filter((c) => c.tab === tabDef.id);
    const cards: CanonicalBentoCard[] = tabCards.slice(0, 50).map((card, cIdx) => {
      const fields: CanonicalField[] = card.fields.slice(0, 100).map((field, fIdx) => {
        const canonicalId = sanitizeCanonicalFieldId(field.key || field.id, fIdx);
        const label = (field.label || canonicalId).slice(0, 100);

        if (field.kind === 'roll') {
          const expr = (field.rollExpr || '1d20').slice(0, 256);
          const isPool = Boolean(parseWodPoolExpression(expr));
          const mode: CanonicalRollConfig['mode'] = field.isSoak
            ? 'storyteller_soak'
            : isPool
              ? 'storyteller_skill'
              : 'standard';
          const rollConfig: CanonicalRollConfig = {
            mode,
            expression: expr,
          };
          if (typeof field.rollDifficulty === 'number') {
            rollConfig.difficulty = Math.max(1, Math.min(10, Math.round(field.rollDifficulty)));
          }
          if (typeof field.rollSpecialty === 'boolean') {
            rollConfig.specialty = field.rollSpecialty;
          }
          return {
            id: canonicalId,
            label,
            type: 'roll_button',
            rollConfig,
          };
        }

        if (field.kind === 'repeatable') {
          return {
            id: canonicalId,
            label,
            type: 'repeatable_list',
            rows: (field.rows ?? []).slice(0, 200).map((r) => ({
              id: r.id,
              col1: r.col1,
              col2: r.col2,
            })),
          };
        }

        if (field.kind === 'calculated') {
          return {
            id: canonicalId,
            label,
            type: 'calculated',
            formula: (field.formula ?? '0').slice(0, 256),
          };
        }

        if (field.kind === 'resource') {
          return {
            id: canonicalId,
            label,
            type: 'resource',
            value: typeof field.value === 'number' ? field.value : 0,
            maxValue: typeof field.max === 'number' ? field.max : 10,
          };
        }

        if (field.kind === 'boolean') {
          return {
            id: canonicalId,
            label,
            type: 'boolean',
            value: Boolean(field.value),
          };
        }

        if (field.kind === 'text') {
          return {
            id: canonicalId,
            label,
            type: 'text',
            value: typeof field.value === 'string' ? field.value : String(field.value ?? ''),
          };
        }

        return {
          id: canonicalId,
          label,
          type: 'number',
          value: typeof field.value === 'number' ? field.value : Number(field.value ?? 0),
        };
      });

      const canonicalCard: CanonicalBentoCard = {
        id: (card.id || `card_${cIdx}`).slice(0, 64),
        title: (card.title || 'BLOCO').slice(0, 80),
        columns: Math.max(1, Math.min(4, card.colSpan ?? 1)),
        fields,
      };
      if (card.code) {
        canonicalCard.tag = card.code.slice(0, 40);
      }
      return canonicalCard;
    });

    return {
      id: tabDef.id,
      title: tabDef.title,
      cards,
    };
  });

  return {
    id: (migrated.id || `sheet_${sysId}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
    name: (migrated.characterName || 'NOVO PERSONAGEM').slice(0, 120),
    systemId: sysId,
    revision: Math.max(1, Math.floor(migrated.revision)),
    updatedAt: migrated.updatedAt,
    deviceId: migrated.deviceId,
    tabs,
  };
}

export interface SheetPayloadValidationResult {
  valid: boolean;
  errors: string[];
}

export const MAX_IMPORT_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_SHEETS = 100;
export const MAX_VALIDATION_DEPTH = 32;

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function findDangerousKeyPath(
  value: unknown,
  path = '$',
  depth = 0,
): string | null {
  if (depth > MAX_VALIDATION_DEPTH) {
    return `${path} (profundidade máxima excedida)`;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findDangerousKeyPath(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(record)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) {
      return `${path}.${key}`;
    }
    const hit = findDangerousKeyPath(record[key], `${path}.${key}`, depth + 1);
    if (hit) return hit;
  }
  return null;
}
const ALLOWED_SYSTEM_IDS = new Set(['wod', 'dnd5e', 'cyberpunk', 'default', 'blank']);
const ALLOWED_TAB_IDS = new Set(['geral', 'magias', 'xp']);
const ALLOWED_FIELD_KINDS = new Set([
  'number',
  'text',
  'calculated',
  'resource',
  'boolean',
  'roll',
  'repeatable',
]);
const ALLOWED_XP_CATEGORIES = new Set(['attribute', 'skill', 'discipline', 'virtue']);
const ALLOWED_FIELD_XP_CATEGORIES = new Set([
  'attribute',
  'skill',
  'discipline',
  'virtue',
  'advantage',
  'discipline_clan',
  'discipline_out_of_clan',
  'discipline_caitiff',
]);
const ALLOWED_ATTRIBUTE_GROUPS = new Set(['physical', 'social', 'mental']);
const ALLOWED_XP_RULE_PRESETS = new Set([
  'storyteller-v20',
  'storyteller_v20',
  'vampire-v5',
  'vampire_v5',
  'custom',
]);

const ROOT_SHEET_KEYS = new Set([
  'id',
  'systemId',
  'systemName',
  'systemCode',
  'characterName',
  'revision',
  'updatedAt',
  'deviceId',
  'rulePreset',
  'xpRulePreset',
  'customUseNewLevelBase',
  'bloodPool',
  'bloodSurge',
  'stains',
  'virtues',
  'touchstones',
  'meritsFlaws',
  'havens',
  'dnd5eState',
  'tabs',
  'cards',
  'rollLogs',
  'xp',
]);
const TOUCHSTONE_KEYS = new Set(['id', 'conviction', 'touchstone', 'notes']);
const MERIT_FLAW_KEYS = new Set(['id', 'kind', 'name', 'rating', 'notes', 'catalogId']);
const HAVEN_KEYS = new Set(['id', 'name', 'location', 'rating', 'traits', 'notes']);
const CARD_KEYS = new Set(['id', 'tab', 'code', 'title', 'colSpan', 'fields']);
const FIELD_KEYS = new Set([
  'id',
  'key',
  'label',
  'kind',
  'value',
  'numValue',
  'textValue',
  'boolValue',
  'max',
  'maxFormula',
  'attributeGroup',
  'damageTrack',
  'bashingDamage',
  'lethalDamage',
  'superficialDamage',
  'aggravatedDamage',
  'stains',
  'soakDamageType',
  'formula',
  'showPlus',
  'rollLabel',
  'rollExpr',
  'rollDifficulty',
  'rollDifficultyV5',
  'rollMod',
  'rollSpecialty',
  'useWillpower',
  'isSoak',
  'xpCategory',
  'columns',
  'col2Type',
  'rows',
  'hint',
  'placeholder',
]);
const ROW_KEYS = new Set(['id', 'col1', 'col2']);
const ROLL_LOG_KEYS = new Set([
  'id',
  'timestamp',
  'label',
  'total',
  'formula',
  'breakdown',
  'isCritical',
  'isFumble',
  'isPoolRoll',
  'rolls',
  'difficulty',
  'specialty',
  'willpowerUsed',
  'isSoak',
  'soakDamageType',
  'doubledTensCount',
  'onesCount',
  'canceledOnes',
  'outcome',
  'status',
  'margin',
  'rulePreset',
  'woundPenalty',
  'normalDice',
  'normalRolls',
  'hungerDice',
  'hungerRolls',
  'messyCritical',
  'isMessyCritical',
  'bestialFailure',
  'isBestialFailure',
  'critPairsCount',
  'isRouseCheck',
  'isBloodSurge',
  'isWillpowerReroll',
  'isRemorseCheck',
  'isFrenzyRoll',
  'frenzyKind',
  'humanityLost',
  'rerolledIndices',
  'd20Mode',
  'd20Dice',
  'd20Kept',
  'd20Discarded',
  'isDeathSave',
]);
const DND5E_STATE_KEYS = new Set([
  'level',
  'inspiration',
  'tempHp',
  'hitDice',
  'deathSaves',
  'saveProficiencies',
  'skillProficiencies',
  'spellcasting',
]);
const DND5E_HIT_DICE_KEYS = new Set(['die', 'current', 'max']);
const DND5E_DEATH_SAVE_KEYS = new Set(['successes', 'failures']);
const DND5E_ABILITY_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const DND5E_SKILL_KEYS = new Set(DND5E_SKILLS.map((s) => s.key));
const DND5E_SKILL_PROF_VALUES = new Set(['none', 'proficient', 'expertise']);
const DND5E_SPELLCASTING_KEYS = new Set(['ability', 'slots']);
const DND5E_SPELL_SLOT_KEYS = new Set(['level', 'max', 'used']);
const XP_STATE_KEYS = new Set([
  'totalEarned',
  'spent',
  'ledger',
  'outOfClanFieldIds',
  'customMultipliers',
  'xpRulePreset',
  'customUseNewLevelBase',
]);
const XP_LEDGER_KEYS = new Set([
  'id',
  'timestamp',
  'kind',
  'delta',
  'xpSpent',
  'label',
  'fieldId',
  'category',
  'fromValue',
  'toValue',
  'createdField',
  'createdFieldIds',
  'createdCardId',
  'prevSpecialtyLabel',
  'prevRollSpecialty',
]);

function checkPlainObject(
  value: unknown,
  path: string,
  allowedKeys: Set<string>,
  errors: string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path}: esperado objeto JSON.`);
    return false;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(obj)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) {
      errors.push(`${path}: chave proibida "${key}" (risco de Prototype Pollution).`);
    } else if (!allowedKeys.has(key)) {
      errors.push(`${path}: propriedade não permitida "${key}" (additionalProperties: false).`);
    }
  }
  return true;
}

export function validateSheetPayload(data: unknown): SheetPayloadValidationResult {
  const errors: string[] = [];
  const dangerousPath = findDangerousKeyPath(data);
  if (dangerousPath) {
    errors.push(`${dangerousPath}: chave proibida (risco de Prototype Pollution).`);
    return { valid: false, errors };
  }
  if (!checkPlainObject(data, '$', ROOT_SHEET_KEYS, errors)) {
    return { valid: false, errors };
  }

  const reqStrings: Array<[string, number, number]> = [
    ['systemName', 1, 120],
    ['systemCode', 1, 80],
    ['characterName', 1, 120],
  ];
  for (const [key, minLen, maxLen] of reqStrings) {
    const v = data[key];
    if (typeof v !== 'string' || v.length < minLen || v.length > maxLen) {
      errors.push(`$.${key}: string obrigatória (${minLen}..${maxLen} caracteres).`);
    }
  }

  if (data.id !== undefined) {
    if (
      typeof data.id !== 'string' ||
      data.id.length < 1 ||
      data.id.length > 64 ||
      !/^[a-zA-Z0-9_-]+$/.test(data.id)
    ) {
      errors.push('$.id: identificador inválido.');
    }
  }
  if (data.systemId !== undefined && !ALLOWED_SYSTEM_IDS.has(String(data.systemId))) {
    errors.push(`$.systemId: sistema inválido "${String(data.systemId)}".`);
  }
  if (data.revision !== undefined) {
    if (typeof data.revision !== 'number' || !Number.isInteger(data.revision) || data.revision < 1) {
      errors.push('$.revision: deve ser inteiro >= 1.');
    }
  }
  if (data.updatedAt !== undefined) {
    if (!isValidIsoDateTime(data.updatedAt)) {
      errors.push('$.updatedAt: deve ser timestamp ISO-8601 válido.');
    }
  }
  if (data.deviceId !== undefined) {
    if (typeof data.deviceId !== 'string' || data.deviceId.length < 1 || data.deviceId.length > 128) {
      errors.push('$.deviceId: string inválida (1..128 caracteres).');
    }
  }
  if (data.rulePreset !== undefined && !ALLOWED_XP_RULE_PRESETS.has(String(data.rulePreset))) {
    errors.push(`$.rulePreset: preset de regras inválido "${String(data.rulePreset)}".`);
  }
  if (data.xpRulePreset !== undefined && !ALLOWED_XP_RULE_PRESETS.has(String(data.xpRulePreset))) {
    errors.push(`$.xpRulePreset: preset de XP inválido "${String(data.xpRulePreset)}".`);
  }
  if (data.customUseNewLevelBase !== undefined && typeof data.customUseNewLevelBase !== 'boolean') {
    errors.push('$.customUseNewLevelBase: deve ser booleano.');
  }
  if (
    data.bloodPool !== undefined &&
    (typeof data.bloodPool !== 'number' || !Number.isInteger(data.bloodPool) || data.bloodPool < 0 || data.bloodPool > 50)
  ) {
    errors.push('$.bloodPool: deve ser inteiro entre 0 e 50.');
  }
  if (data.bloodSurge !== undefined && typeof data.bloodSurge !== 'boolean') {
    errors.push('$.bloodSurge: deve ser booleano.');
  }
  if (
    data.stains !== undefined &&
    (typeof data.stains !== 'number' || !Number.isInteger(data.stains) || data.stains < 0 || data.stains > 10)
  ) {
    errors.push('$.stains: deve ser inteiro entre 0 e 10.');
  }
  if (data.virtues !== undefined) {
    if (checkPlainObject(data.virtues, '$.virtues', new Set(['conscience', 'selfControl', 'courage']), errors)) {
      for (const vk of ['conscience', 'selfControl', 'courage']) {
        const vv = data.virtues[vk];
        if (vv !== undefined && (typeof vv !== 'number' || !Number.isInteger(vv) || vv < 1 || vv > 5)) {
          errors.push(`$.virtues.${vk}: deve ser inteiro entre 1 e 5.`);
        }
      }
    }
  }

  if (data.tabs !== undefined) {
    if (!Array.isArray(data.tabs) || data.tabs.length > 20) {
      errors.push('$.tabs: esperado array com até 20 itens.');
    } else {
      data.tabs.forEach((tab, idx) => {
        if (checkPlainObject(tab, `$.tabs[${idx}]`, new Set(['id', 'label']), errors)) {
          if (!ALLOWED_TAB_IDS.has(String(tab.id))) {
            errors.push(`$.tabs[${idx}].id: valor inválido.`);
          }
          if (typeof tab.label !== 'string' || tab.label.length < 1 || tab.label.length > 80) {
            errors.push(`$.tabs[${idx}].label: string obrigatória.`);
          }
        }
      });
    }
  }

  if (!Array.isArray(data.cards)) {
    errors.push('$.cards: array obrigatório.');
  } else {
    if (data.cards.length > 50) {
      errors.push('$.cards: máximo de 50 cartões excedido.');
    }
    data.cards.forEach((card, cIdx) => {
      const cPath = `$.cards[${cIdx}]`;
      if (!checkPlainObject(card, cPath, CARD_KEYS, errors)) return;
      if (typeof card.id !== 'string' || card.id.length < 1 || card.id.length > 64) {
        errors.push(`${cPath}.id: string obrigatória.`);
      }
      if (!ALLOWED_TAB_IDS.has(String(card.tab))) {
        errors.push(`${cPath}.tab: aba inválida "${String(card.tab)}".`);
      }
      if (typeof card.code !== 'string' || card.code.length > 64) {
        errors.push(`${cPath}.code: string obrigatória.`);
      }
      if (typeof card.title !== 'string' || card.title.length < 1 || card.title.length > 100) {
        errors.push(`${cPath}.title: string obrigatória.`);
      }
      if (
        typeof card.colSpan !== 'number' ||
        !Number.isInteger(card.colSpan) ||
        card.colSpan < 1 ||
        card.colSpan > 4
      ) {
        errors.push(`${cPath}.colSpan: deve ser inteiro entre 1 e 4.`);
      }
      if (!Array.isArray(card.fields) || card.fields.length > 100) {
        errors.push(`${cPath}.fields: array obrigatório (máx 100).`);
        return;
      }

      card.fields.forEach((field, fIdx) => {
        const fPath = `${cPath}.fields[${fIdx}]`;
        if (!checkPlainObject(field, fPath, FIELD_KEYS, errors)) return;
        if (
          typeof field.id !== 'string' ||
          field.id.length < 1 ||
          field.id.length > 64 ||
          !/^[a-zA-Z0-9_-]+$/.test(field.id)
        ) {
          errors.push(`${fPath}.id: identificador inválido.`);
        }
        if (typeof field.key !== 'string' || field.key.length < 1 || field.key.length > 64) {
          errors.push(`${fPath}.key: string obrigatória.`);
        }
        if (typeof field.label !== 'string' || field.label.length < 1 || field.label.length > 100) {
          errors.push(`${fPath}.label: string obrigatória.`);
        }
        if (!ALLOWED_FIELD_KINDS.has(String(field.kind))) {
          errors.push(`${fPath}.kind: tipo de campo inválido "${String(field.kind)}".`);
        }
        if (field.value !== undefined && field.value !== null) {
          const isValidValue =
            typeof field.value === 'boolean' ||
            (typeof field.value === 'string' && field.value.length <= 20000) ||
            (typeof field.value === 'number' && Number.isFinite(field.value));
          if (!isValidValue) {
            errors.push(`${fPath}.value: valor inválido ou excede limite permitido.`);
          }
        }
        if (
          (field.id === 'f_blood_potency' ||
            (typeof field.key === 'string' && field.key.trim().toLowerCase() === 'blood_potency')) &&
          field.kind === 'number' &&
          typeof field.value === 'number' &&
          (!Number.isInteger(field.value) || field.value < 0 || field.value > 10)
        ) {
          errors.push(`${fPath}.value: blood_potency deve ser inteiro entre 0 e 10.`);
        }
        if (
          field.max !== undefined &&
          (typeof field.max !== 'number' || !Number.isInteger(field.max) || field.max < 1 || field.max > 100000)
        ) {
          errors.push(`${fPath}.max: deve ser inteiro entre 1 e 100000.`);
        }
        if (
          field.maxFormula !== undefined &&
          (typeof field.maxFormula !== 'string' || field.maxFormula.length > 256)
        ) {
          errors.push(`${fPath}.maxFormula: deve ser string (máx 256 caracteres).`);
        }
        if (
          field.formula !== undefined &&
          (typeof field.formula !== 'string' || field.formula.length > 256)
        ) {
          errors.push(`${fPath}.formula: deve ser string (máx 256 caracteres).`);
        }
        if (
          field.rollExpr !== undefined &&
          (typeof field.rollExpr !== 'string' || field.rollExpr.length > 256)
        ) {
          errors.push(`${fPath}.rollExpr: deve ser string (máx 256 caracteres).`);
        }
        if (
          field.rollMod !== undefined &&
          (typeof field.rollMod !== 'number' ||
            !Number.isInteger(field.rollMod) ||
            field.rollMod < -100 ||
            field.rollMod > 100)
        ) {
          errors.push(`${fPath}.rollMod: deve ser inteiro entre -100 e 100.`);
        }
        if (
          field.attributeGroup !== undefined &&
          !ALLOWED_ATTRIBUTE_GROUPS.has(String(field.attributeGroup))
        ) {
          errors.push(`${fPath}.attributeGroup: grupo inválido "${String(field.attributeGroup)}".`);
        }
        if (
          field.rollDifficulty !== undefined &&
          (typeof field.rollDifficulty !== 'number' ||
            !Number.isInteger(field.rollDifficulty) ||
            field.rollDifficulty < 1 ||
            field.rollDifficulty > 10)
        ) {
          errors.push(`${fPath}.rollDifficulty: deve ser inteiro entre 1 e 10.`);
        }
        if (
          field.rollDifficultyV5 !== undefined &&
          (typeof field.rollDifficultyV5 !== 'number' ||
            !Number.isInteger(field.rollDifficultyV5) ||
            field.rollDifficultyV5 < 1 ||
            field.rollDifficultyV5 > 10)
        ) {
          errors.push(`${fPath}.rollDifficultyV5: deve ser inteiro entre 1 e 10.`);
        }
        if (field.rollSpecialty !== undefined && typeof field.rollSpecialty !== 'boolean') {
          errors.push(`${fPath}.rollSpecialty: deve ser booleano.`);
        }
        if (field.useWillpower !== undefined && typeof field.useWillpower !== 'boolean') {
          errors.push(`${fPath}.useWillpower: deve ser booleano.`);
        }
        if (
          field.xpCategory !== undefined &&
          !ALLOWED_FIELD_XP_CATEGORIES.has(String(field.xpCategory))
        ) {
          errors.push(`${fPath}.xpCategory: categoria XP inválida "${String(field.xpCategory)}".`);
        }
        if (
          field.bashingDamage !== undefined &&
          (typeof field.bashingDamage !== 'number' ||
            !Number.isInteger(field.bashingDamage) ||
            field.bashingDamage < 0 ||
            field.bashingDamage > 100000)
        ) {
          errors.push(`${fPath}.bashingDamage: deve ser inteiro entre 0 e 100000.`);
        }
        if (
          field.lethalDamage !== undefined &&
          (typeof field.lethalDamage !== 'number' ||
            !Number.isInteger(field.lethalDamage) ||
            field.lethalDamage < 0 ||
            field.lethalDamage > 100000)
        ) {
          errors.push(`${fPath}.lethalDamage: deve ser inteiro entre 0 e 100000.`);
        }
        if (
          field.superficialDamage !== undefined &&
          (typeof field.superficialDamage !== 'number' ||
            !Number.isInteger(field.superficialDamage) ||
            field.superficialDamage < 0 ||
            field.superficialDamage > 100000)
        ) {
          errors.push(`${fPath}.superficialDamage: deve ser inteiro entre 0 e 100000.`);
        }
        if (
          field.aggravatedDamage !== undefined &&
          (typeof field.aggravatedDamage !== 'number' ||
            !Number.isInteger(field.aggravatedDamage) ||
            field.aggravatedDamage < 0 ||
            field.aggravatedDamage > 100000)
        ) {
          errors.push(`${fPath}.aggravatedDamage: deve ser inteiro entre 0 e 100000.`);
        }
        if (
          field.stains !== undefined &&
          (typeof field.stains !== 'number' ||
            !Number.isInteger(field.stains) ||
            field.stains < 0 ||
            field.stains > 10)
        ) {
          errors.push(`${fPath}.stains: deve ser inteiro entre 0 e 10.`);
        }
        if (field.rows !== undefined) {
          if (!Array.isArray(field.rows) || field.rows.length > 200) {
            errors.push(`${fPath}.rows: esperado array com até 200 linhas.`);
          } else {
            field.rows.forEach((row, rIdx) => {
              const rPath = `${fPath}.rows[${rIdx}]`;
              if (!checkPlainObject(row, rPath, ROW_KEYS, errors)) return;
              if (typeof row.id !== 'string' || row.id.length < 1 || row.id.length > 64) {
                errors.push(`${rPath}.id: string obrigatória.`);
              }
              if (typeof row.col1 !== 'string' || row.col1.length > 200) {
                errors.push(`${rPath}.col1: string obrigatória.`);
              }
              if (typeof row.col2 !== 'string' && typeof row.col2 !== 'number') {
                errors.push(`${rPath}.col2: deve ser string ou número.`);
              }
            });
          }
        }
      });
    });
  }

  if (data.rollLogs !== undefined) {
    if (!Array.isArray(data.rollLogs) || data.rollLogs.length > 200) {
      errors.push('$.rollLogs: esperado array com até 200 entradas.');
    } else {
      data.rollLogs.forEach((log, lIdx) => {
        const lPath = `$.rollLogs[${lIdx}]`;
        if (!checkPlainObject(log, lPath, ROLL_LOG_KEYS, errors)) return;
        if (typeof log.id !== 'string' || typeof log.timestamp !== 'string' || typeof log.label !== 'string') {
          errors.push(`${lPath}: campos de texto obrigatórios ausentes.`);
        }
        if (typeof log.total !== 'number' || !Number.isFinite(log.total)) {
          errors.push(`${lPath}.total: número finito obrigatório.`);
        }
        if (typeof log.formula !== 'string' || typeof log.breakdown !== 'string') {
          errors.push(`${lPath}: formula e breakdown obrigatórios.`);
        }
        if (log.isRemorseCheck !== undefined && typeof log.isRemorseCheck !== 'boolean') {
          errors.push(`${lPath}.isRemorseCheck: deve ser booleano.`);
        }
        if (log.isFrenzyRoll !== undefined && typeof log.isFrenzyRoll !== 'boolean') {
          errors.push(`${lPath}.isFrenzyRoll: deve ser booleano.`);
        }
        if (
          log.frenzyKind !== undefined &&
          log.frenzyKind !== 'frenzy' &&
          log.frenzyKind !== 'rotschreck'
        ) {
          errors.push(`${lPath}.frenzyKind: deve ser "frenzy" ou "rotschreck".`);
        }
        if (log.humanityLost !== undefined && typeof log.humanityLost !== 'boolean') {
          errors.push(`${lPath}.humanityLost: deve ser booleano.`);
        }
        if (
          log.d20Mode !== undefined &&
          log.d20Mode !== 'normal' &&
          log.d20Mode !== 'advantage' &&
          log.d20Mode !== 'disadvantage'
        ) {
          errors.push(`${lPath}.d20Mode: modo inválido.`);
        }
        if (log.d20Dice !== undefined) {
          if (
            !Array.isArray(log.d20Dice) ||
            log.d20Dice.length > 2 ||
            log.d20Dice.some((d) => typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 20)
          ) {
            errors.push(`${lPath}.d20Dice: esperado array de 1..2 inteiros entre 1 e 20.`);
          }
        }
        if (
          log.d20Kept !== undefined &&
          (typeof log.d20Kept !== 'number' || !Number.isInteger(log.d20Kept) || log.d20Kept < 1 || log.d20Kept > 20)
        ) {
          errors.push(`${lPath}.d20Kept: deve ser inteiro entre 1 e 20.`);
        }
        if (
          log.d20Discarded !== undefined &&
          log.d20Discarded !== null &&
          (typeof log.d20Discarded !== 'number' ||
            !Number.isInteger(log.d20Discarded) ||
            log.d20Discarded < 1 ||
            log.d20Discarded > 20)
        ) {
          errors.push(`${lPath}.d20Discarded: deve ser null ou inteiro entre 1 e 20.`);
        }
        if (log.isDeathSave !== undefined && typeof log.isDeathSave !== 'boolean') {
          errors.push(`${lPath}.isDeathSave: deve ser booleano.`);
        }
      });
    }
  }

  if (data.xp !== undefined) {
    if (checkPlainObject(data.xp, '$.xp', XP_STATE_KEYS, errors)) {
      if (
        typeof data.xp.totalEarned !== 'number' ||
        !Number.isInteger(data.xp.totalEarned) ||
        data.xp.totalEarned < 0
      ) {
        errors.push('$.xp.totalEarned: deve ser inteiro >= 0.');
      }
      if (typeof data.xp.spent !== 'number' || !Number.isInteger(data.xp.spent) || data.xp.spent < 0) {
        errors.push('$.xp.spent: deve ser inteiro >= 0.');
      }
      if (!Array.isArray(data.xp.ledger) || data.xp.ledger.length > 500) {
        errors.push('$.xp.ledger: array obrigatório (máx 500 itens).');
      } else {
        data.xp.ledger.forEach((entry, xIdx) => {
          const xPath = `$.xp.ledger[${xIdx}]`;
          if (!checkPlainObject(entry, xPath, XP_LEDGER_KEYS, errors)) return;
          if (entry.kind !== 'award' && entry.kind !== 'upgrade') {
            errors.push(`${xPath}.kind: deve ser "award" ou "upgrade".`);
          }
          if (entry.category !== undefined && !ALLOWED_XP_CATEGORIES.has(String(entry.category))) {
            errors.push(`${xPath}.category: categoria inválida.`);
          }
          if (
            entry.xpSpent !== undefined &&
            (typeof entry.xpSpent !== 'number' || !Number.isFinite(entry.xpSpent) || entry.xpSpent < 0)
          ) {
            errors.push(`${xPath}.xpSpent: deve ser número >= 0.`);
          }
          if (entry.createdFieldIds !== undefined) {
            if (
              !Array.isArray(entry.createdFieldIds) ||
              entry.createdFieldIds.length > 8 ||
              entry.createdFieldIds.some(
                (fid) => typeof fid !== 'string' || fid.length < 1 || fid.length > 64,
              )
            ) {
              errors.push(`${xPath}.createdFieldIds: esperado array de até 8 IDs válidos.`);
            }
          }
        });
      }
      if (data.xp.outOfClanFieldIds !== undefined) {
        if (
          !Array.isArray(data.xp.outOfClanFieldIds) ||
          data.xp.outOfClanFieldIds.some(
            (fid) => typeof fid !== 'string' || fid.length < 1 || fid.length > 64,
          )
        ) {
          errors.push('$.xp.outOfClanFieldIds: esperado array de IDs válidos (1..64 caracteres).');
        }
      }
      if (data.xp.customMultipliers !== undefined) {
        if (
          !data.xp.customMultipliers ||
          typeof data.xp.customMultipliers !== 'object' ||
          Array.isArray(data.xp.customMultipliers)
        ) {
          errors.push('$.xp.customMultipliers: esperado objeto JSON.');
        } else {
          const multObj = data.xp.customMultipliers as Record<string, unknown>;
          for (const mk of Object.getOwnPropertyNames(multObj)) {
            if (DANGEROUS_OBJECT_KEYS.has(mk)) {
              errors.push(`$.xp.customMultipliers.${mk}: chave proibida (risco de Prototype Pollution).`);
              continue;
            }
            const mv = multObj[mk];
            if (typeof mv !== 'number' || !Number.isInteger(mv) || mv < 1) {
              errors.push(`$.xp.customMultipliers.${mk}: deve ser inteiro >= 1.`);
            }
          }
        }
      }
      if (
        data.xp.xpRulePreset !== undefined &&
        !ALLOWED_XP_RULE_PRESETS.has(String(data.xp.xpRulePreset))
      ) {
        errors.push(`$.xp.xpRulePreset: preset de XP inválido "${String(data.xp.xpRulePreset)}".`);
      }
      if (
        data.xp.customUseNewLevelBase !== undefined &&
        typeof data.xp.customUseNewLevelBase !== 'boolean'
      ) {
        errors.push('$.xp.customUseNewLevelBase: deve ser booleano.');
      }
    }
  }

  if (data.touchstones !== undefined) {
    if (!Array.isArray(data.touchstones) || data.touchstones.length > 20) {
      errors.push('$.touchstones: esperado array com até 20 entradas.');
    } else {
      data.touchstones.forEach((item, tIdx) => {
        const tPath = `$.touchstones[${tIdx}]`;
        if (!checkPlainObject(item, tPath, TOUCHSTONE_KEYS, errors)) return;
        if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 64) {
          errors.push(`${tPath}.id: string obrigatória (1..64 caracteres).`);
        }
        if (typeof item.conviction !== 'string' || item.conviction.length > 240) {
          errors.push(`${tPath}.conviction: string obrigatória (máx 240 caracteres).`);
        }
        if (typeof item.touchstone !== 'string' || item.touchstone.length > 160) {
          errors.push(`${tPath}.touchstone: string obrigatória (máx 160 caracteres).`);
        }
        if (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 500)) {
          errors.push(`${tPath}.notes: string inválida (máx 500 caracteres).`);
        }
      });
    }
  }

  if (data.meritsFlaws !== undefined) {
    if (!Array.isArray(data.meritsFlaws) || data.meritsFlaws.length > 100) {
      errors.push('$.meritsFlaws: esperado array com até 100 entradas.');
    } else {
      data.meritsFlaws.forEach((item, mIdx) => {
        const mPath = `$.meritsFlaws[${mIdx}]`;
        if (!checkPlainObject(item, mPath, MERIT_FLAW_KEYS, errors)) return;
        if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 64) {
          errors.push(`${mPath}.id: string obrigatória (1..64 caracteres).`);
        }
        if (item.kind !== 'merit' && item.kind !== 'flaw') {
          errors.push(`${mPath}.kind: deve ser "merit" ou "flaw".`);
        }
        if (typeof item.name !== 'string' || item.name.length > 120) {
          errors.push(`${mPath}.name: string obrigatória (máx 120 caracteres).`);
        }
        if (
          typeof item.rating !== 'number' ||
          !Number.isInteger(item.rating) ||
          item.rating < 1 ||
          item.rating > 5
        ) {
          errors.push(`${mPath}.rating: deve ser inteiro entre 1 e 5.`);
        }
        if (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 500)) {
          errors.push(`${mPath}.notes: string inválida (máx 500 caracteres).`);
        }
        if (
          item.catalogId !== undefined &&
          (typeof item.catalogId !== 'string' ||
            item.catalogId.length < 1 ||
            item.catalogId.length > 64)
        ) {
          errors.push(`${mPath}.catalogId: string inválida (1..64 caracteres).`);
        }
      });
    }
  }

  if (data.havens !== undefined) {
    if (!Array.isArray(data.havens) || data.havens.length > 20) {
      errors.push('$.havens: esperado array com até 20 entradas.');
    } else {
      data.havens.forEach((item, hIdx) => {
        const hPath = `$.havens[${hIdx}]`;
        if (!checkPlainObject(item, hPath, HAVEN_KEYS, errors)) return;
        if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 64) {
          errors.push(`${hPath}.id: string obrigatória (1..64 caracteres).`);
        }
        if (typeof item.name !== 'string' || item.name.length > 120) {
          errors.push(`${hPath}.name: string obrigatória (máx 120 caracteres).`);
        }
        if (
          item.location !== undefined &&
          (typeof item.location !== 'string' || item.location.length > 200)
        ) {
          errors.push(`${hPath}.location: string inválida (máx 200 caracteres).`);
        }
        if (
          typeof item.rating !== 'number' ||
          !Number.isInteger(item.rating) ||
          item.rating < 0 ||
          item.rating > 5
        ) {
          errors.push(`${hPath}.rating: deve ser inteiro entre 0 e 5.`);
        }
        if (
          !Array.isArray(item.traits) ||
          item.traits.length > 30 ||
          item.traits.some(
            (trait) => typeof trait !== 'string' || trait.length < 1 || trait.length > 80,
          )
        ) {
          errors.push(`${hPath}.traits: esperado array de até 30 strings (1..80 caracteres).`);
        }
        if (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 500)) {
          errors.push(`${hPath}.notes: string inválida (máx 500 caracteres).`);
        }
      });
    }
  }

  if (data.dnd5eState !== undefined) {
    const ds = data.dnd5eState;
    if (checkPlainObject(ds, '$.dnd5eState', DND5E_STATE_KEYS, errors)) {
      if (typeof ds.level !== 'number' || !Number.isInteger(ds.level) || ds.level < 1 || ds.level > 20) {
        errors.push('$.dnd5eState.level: deve ser inteiro entre 1 e 20.');
      }
      if (typeof ds.inspiration !== 'boolean') {
        errors.push('$.dnd5eState.inspiration: deve ser booleano.');
      }
      if (typeof ds.tempHp !== 'number' || !Number.isInteger(ds.tempHp) || ds.tempHp < 0 || ds.tempHp > 100000) {
        errors.push('$.dnd5eState.tempHp: deve ser inteiro >= 0.');
      }
      if (checkPlainObject(ds.hitDice, '$.dnd5eState.hitDice', DND5E_HIT_DICE_KEYS, errors)) {
        if (!['d6', 'd8', 'd10', 'd12'].includes(String(ds.hitDice.die))) {
          errors.push('$.dnd5eState.hitDice.die: dado inválido.');
        }
        if (typeof ds.hitDice.current !== 'number' || !Number.isInteger(ds.hitDice.current) || ds.hitDice.current < 0 || ds.hitDice.current > 20) {
          errors.push('$.dnd5eState.hitDice.current: deve ser inteiro entre 0 e 20.');
        }
        if (typeof ds.hitDice.max !== 'number' || !Number.isInteger(ds.hitDice.max) || ds.hitDice.max < 1 || ds.hitDice.max > 20) {
          errors.push('$.dnd5eState.hitDice.max: deve ser inteiro entre 1 e 20.');
        }
      }
      if (checkPlainObject(ds.deathSaves, '$.dnd5eState.deathSaves', DND5E_DEATH_SAVE_KEYS, errors)) {
        if (typeof ds.deathSaves.successes !== 'number' || !Number.isInteger(ds.deathSaves.successes) || ds.deathSaves.successes < 0 || ds.deathSaves.successes > 3) {
          errors.push('$.dnd5eState.deathSaves.successes: deve ser inteiro entre 0 e 3.');
        }
        if (typeof ds.deathSaves.failures !== 'number' || !Number.isInteger(ds.deathSaves.failures) || ds.deathSaves.failures < 0 || ds.deathSaves.failures > 3) {
          errors.push('$.dnd5eState.deathSaves.failures: deve ser inteiro entre 0 e 3.');
        }
      }
      if (checkPlainObject(ds.saveProficiencies, '$.dnd5eState.saveProficiencies', DND5E_ABILITY_KEYS, errors)) {
        for (const ab of DND5E_ABILITY_KEYS) {
          if (typeof ds.saveProficiencies[ab] !== 'boolean') {
            errors.push(`$.dnd5eState.saveProficiencies.${ab}: deve ser booleano.`);
          }
        }
      }
      if (checkPlainObject(ds.skillProficiencies, '$.dnd5eState.skillProficiencies', DND5E_SKILL_KEYS, errors)) {
        for (const sk of DND5E_SKILL_KEYS) {
          if (!DND5E_SKILL_PROF_VALUES.has(String(ds.skillProficiencies[sk]))) {
            errors.push(`$.dnd5eState.skillProficiencies.${sk}: valor inválido.`);
          }
        }
      }
      if (checkPlainObject(ds.spellcasting, '$.dnd5eState.spellcasting', DND5E_SPELLCASTING_KEYS, errors)) {
        if (!['int', 'wis', 'cha'].includes(String(ds.spellcasting.ability))) {
          errors.push('$.dnd5eState.spellcasting.ability: atributo inválido.');
        }
        if (!Array.isArray(ds.spellcasting.slots) || ds.spellcasting.slots.length > 9) {
          errors.push('$.dnd5eState.spellcasting.slots: esperado array com até 9 itens.');
        } else {
          ds.spellcasting.slots.forEach((slot, sIdx) => {
            const sp = `$.dnd5eState.spellcasting.slots[${sIdx}]`;
            if (!checkPlainObject(slot, sp, DND5E_SPELL_SLOT_KEYS, errors)) return;
            if (typeof slot.level !== 'number' || !Number.isInteger(slot.level) || slot.level < 1 || slot.level > 9) {
              errors.push(`${sp}.level: deve ser inteiro entre 1 e 9.`);
            }
            if (typeof slot.max !== 'number' || !Number.isInteger(slot.max) || slot.max < 0 || slot.max > 20) {
              errors.push(`${sp}.max: deve ser inteiro entre 0 e 20.`);
            }
            if (typeof slot.used !== 'number' || !Number.isInteger(slot.used) || slot.used < 0 || slot.used > 20) {
              errors.push(`${sp}.used: deve ser inteiro entre 0 e 20.`);
            }
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface ParsedImportPayloadResult {
  valid: boolean;
  sheets: CharacterSheetState[];
  errors: string[];
}

export function parseAndValidateImportPayload(rawText: string): ParsedImportPayloadResult {
  if (
    typeof rawText !== 'string' ||
    new TextEncoder().encode(rawText).byteLength > MAX_IMPORT_PAYLOAD_BYTES
  ) {
    return {
      valid: false,
      sheets: [],
      errors: ['Payload JSON excede o tamanho máximo permitido (2 MB).'],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      sheets: [],
      errors: ['Não foi possível ler o arquivo JSON selecionado.'],
    };
  }

  const dangerousPath = findDangerousKeyPath(parsed);
  if (dangerousPath) {
    return {
      valid: false,
      sheets: [],
      errors: [`${dangerousPath}: chave proibida (risco de Prototype Pollution).`],
    };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        valid: false,
        sheets: [],
        errors: ['O arquivo JSON contém uma lista vazia de fichas.'],
      };
    }
    if (parsed.length > MAX_IMPORT_SHEETS) {
      return {
        valid: false,
        sheets: [],
        errors: [`O arquivo JSON excede o limite de ${MAX_IMPORT_SHEETS} fichas por importação.`],
      };
    }
    const validSheets: CharacterSheetState[] = [];
    for (let i = 0; i < parsed.length; i += 1) {
      const validation = validateSheetPayload(parsed[i]);
      if (!validation.valid) {
        return {
          valid: false,
          sheets: [],
          errors: validation.errors.map((err) => `[#${i + 1}] ${err}`),
        };
      }
      validSheets.push(migrateLegacyWodSheet(parsed[i] as CharacterSheetState, { storage: null }));
    }
    return { valid: true, sheets: validSheets, errors: [] };
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    'sheets' in parsed &&
    Array.isArray((parsed as { sheets: unknown }).sheets)
  ) {
    const bundle = parsed as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(bundle)) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) {
        return {
          valid: false,
          sheets: [],
          errors: [`$.${key}: chave proibida (risco de Prototype Pollution).`],
        };
      }
    }
    const bundleSheets = bundle.sheets as unknown[];
    if (bundleSheets.length === 0) {
      return {
        valid: false,
        sheets: [],
        errors: ['O pacote JSON não contém nenhuma ficha.'],
      };
    }
    if (bundleSheets.length > MAX_IMPORT_SHEETS) {
      return {
        valid: false,
        sheets: [],
        errors: [`O pacote JSON excede o limite de ${MAX_IMPORT_SHEETS} fichas por importação.`],
      };
    }
    const validSheets: CharacterSheetState[] = [];
    for (let i = 0; i < bundleSheets.length; i += 1) {
      const validation = validateSheetPayload(bundleSheets[i]);
      if (!validation.valid) {
        return {
          valid: false,
          sheets: [],
          errors: validation.errors.map((err) => `[#${i + 1}] ${err}`),
        };
      }
      validSheets.push(
        migrateLegacyWodSheet(bundleSheets[i] as CharacterSheetState, { storage: null }),
      );
    }
    return { valid: true, sheets: validSheets, errors: [] };
  }

  const validation = validateSheetPayload(parsed);
  if (!validation.valid) {
    return {
      valid: false,
      sheets: [],
      errors: validation.errors,
    };
  }
  return {
    valid: true,
    sheets: [migrateLegacyWodSheet(parsed as CharacterSheetState, { storage: null })],
    errors: [],
  };
}

export function fromCanonicalSheet(
  canonical: CanonicalSheet,
  baseSheet?: CharacterSheetState,
): CharacterSheetState {
  const validSysIds: SystemId[] = ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'];
  const sysId: SystemId = validSysIds.includes(canonical.systemId as SystemId)
    ? (canonical.systemId as SystemId)
    : baseSheet
      ? detectSystemId(baseSheet)
      : 'wod';

  const template = baseSheet ?? createPresetBySystemId(sysId);
  const existingFieldsById = new Map<string, SheetField>();
  for (const c of template.cards) {
    for (const f of c.fields) {
      existingFieldsById.set(f.id, f);
      existingFieldsById.set(f.key, f);
    }
  }

  const cards: SheetCard[] = [];
  for (const tab of canonical.tabs) {
    const tabId: TabId =
      tab.id === 'magias' || tab.id === 'xp' ? (tab.id as TabId) : 'geral';
    for (const cCard of tab.cards) {
      const existingCard = template.cards.find((c) => c.id === cCard.id);
      const fields: SheetField[] = cCard.fields.map((cf) => {
        const prev = existingFieldsById.get(cf.id);
        const kind: FieldKind =
          cf.type === 'roll_button'
            ? 'roll'
            : cf.type === 'repeatable_list'
              ? 'repeatable'
              : cf.type === 'dots'
                ? 'number'
                : (cf.type as FieldKind);

        return {
          ...prev,
          id: prev?.id ?? cf.id,
          key: prev?.key ?? cf.id,
          label: cf.label,
          kind,
          value: cf.value !== null && cf.value !== undefined ? cf.value : prev?.value,
          max: typeof cf.maxValue === 'number' ? cf.maxValue : prev?.max,
          formula: cf.formula ?? prev?.formula,
          rollExpr: cf.rollConfig?.expression ?? prev?.rollExpr,
          rollDifficulty: cf.rollConfig?.difficulty ?? prev?.rollDifficulty,
          rollSpecialty: cf.rollConfig?.specialty ?? prev?.rollSpecialty,
          isSoak:
            cf.rollConfig?.mode === 'storyteller_soak'
              ? true
              : prev?.isSoak,
          rows: Array.isArray(cf.rows)
            ? cf.rows.map((r, idx) => ({
                id: String(r.id ?? `r_${idx}`),
                col1: String(r.col1 ?? ''),
                col2: typeof r.col2 === 'number' || typeof r.col2 === 'string' ? r.col2 : String(r.col2 ?? ''),
              }))
            : prev?.rows,
        };
      });

      cards.push({
        id: cCard.id,
        tab: tabId,
        code: cCard.tag ?? existingCard?.code ?? '//BLOCO',
        title: cCard.title,
        colSpan: cCard.columns === 2 ? 2 : 1,
        fields,
      });
    }
  }

  return {
    ...template,
    id: canonical.id,
    systemId: sysId,
    characterName: canonical.name,
    revision: Math.max(1, Math.floor(canonical.revision)),
    updatedAt: canonical.updatedAt,
    deviceId: canonical.deviceId,
    cards,
  };
}


