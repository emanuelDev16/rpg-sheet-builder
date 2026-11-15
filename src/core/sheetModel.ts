import {
  evaluateFormula,
  parseWodPoolExpression,
  rollDiceExpression,
  type VariableMap,
  type WodOutcome,
} from './formula.ts';

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
  value?: number | string | boolean;
  max?: number;
  damageTrack?: boolean;
  superficialDamage?: number;
  aggravatedDamage?: number;
  formula?: string;
  showPlus?: boolean;
  rollLabel?: string;
  rollExpr?: string;
  rollDifficulty?: number;
  rollSpecialty?: boolean;
  rollMod?: number;
  isSoak?: boolean;
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
  onesCount?: number;
  canceledOnes?: number;
  doubledTensCount?: number;
  outcome?: WodOutcome;
  isCritical?: boolean;
  isFumble?: boolean;
  isPoolRoll?: boolean;
}

export type XpUpgradeCategory = 'attribute' | 'skill' | 'discipline';

export interface XpLedgerEntry {
  id: string;
  timestamp: string;
  kind: 'award' | 'upgrade';
  delta: number;
  label: string;
  fieldId?: string;
  category?: XpUpgradeCategory;
  fromValue?: number;
  toValue?: number;
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
        ],
      },
      {
        id: 'card_atributos',
        tab: 'geral',
        code: '//ATTRIBUTES',
        title: 'PHYSICAL · SOCIAL · MENTAL',
        colSpan: 1,
        fields: [
          { id: 'f_strength', key: 'strength', label: 'STRENGTH', kind: 'number', value: 3 },
          { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', kind: 'number', value: 4 },
          { id: 'f_stamina', key: 'stamina', label: 'STAMINA', kind: 'number', value: 3 },
          { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', kind: 'number', value: 3 },
          { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', kind: 'number', value: 4 },
          { id: 'f_wits', key: 'wits', label: 'WITS', kind: 'number', value: 3 },
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

export function createBlankSheet(): CharacterSheetState {
  return {
    id: 'sheet_blank',
    systemId: 'blank',
    systemName: 'SISTEMA CUSTOMIZADO',
    systemCode: '/SYS: SISTEMA CUSTOMIZADO',
    characterName: 'NOVO PERSONAGEM',
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

  // Pass 2 & 3: evaluate calculated fields (2 passes to allow chained calculated fields)
  const calcFields = sheet.cards.flatMap((c) => c.fields).filter((f) => f.kind === 'calculated');
  for (let pass = 0; pass < 2; pass += 1) {
    for (const field of calcFields) {
      const res = evaluateFormula(field.formula ?? '0', variables, field.showPlus ?? true);
      computedByFieldId[field.id] = {
        value: res.value,
        formatted: res.formatted,
        ok: res.ok,
        error: res.error,
      };
      if (res.ok && field.key.trim()) {
        variables[field.key.trim().toLowerCase()] = res.value;
      }
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
  options?: { difficulty?: number; modifier?: number; specialty?: boolean },
): string {
  const cleaned = expression.trim();
  if (!cleaned) return '';

  const parsedPool = parseWodPoolExpression(cleaned);
  if (parsedPool) {
    const countRes = evaluateFormula(parsedPool.countExpr, vars, false);
    const diffRes = evaluateFormula(parsedPool.diffExpr, vars, false);
    if (countRes.ok && (diffRes.ok || options?.difficulty !== undefined)) {
      const mod =
        typeof options?.modifier === 'number' && Number.isFinite(options.modifier)
          ? Math.round(options.modifier)
          : 0;
      const poolSize = Math.max(0, Math.min(30, Math.round(countRes.value) + mod));
      const rawDiff =
        typeof options?.difficulty === 'number' && Number.isFinite(options.difficulty)
          ? options.difficulty
          : diffRes.value;
      const diff = Math.max(2, Math.min(10, Math.round(rawDiff)));
      return `${poolSize}d10 @ DIFF ${diff}${options?.specialty ? ' · SPEC' : ''}`;
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

  return {
    ...sheet,
    id,
    systemId: sysId,
    revision,
    updatedAt,
    deviceId,
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

export function updateFieldValue(
  sheet: CharacterSheetState,
  fieldId: string,
  nextValue: number | string | boolean,
): CharacterSheetState {
  const updated: CharacterSheetState = touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => (f.id === fieldId ? { ...f, value: nextValue } : f)),
    })),
  });
  return syncWillpowerToggleWithResource(updated);
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

export function migrateLegacyWodSheet(
  sheet: CharacterSheetState,
  options?: {
    deviceId?: string;
    nowIso?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): CharacterSheetState {
  const withMeta = migrateLegacySheetMetadata(sheet, options);
  if (detectSystemId(withMeta) !== 'wod') return withMeta;
  let changed = false;

  const cards = withMeta.cards.map((card) => {
    let cardChanged = false;
    let nextTitle = card.title;

    if (card.id === 'card_combate' && card.title === 'HEALTH · WILLPOWER · BLOOD') {
      nextTitle = 'HEALTH · WILLPOWER · HUNGER';
      cardChanged = true;
    }

    let fields = card.fields.map((field) => {
      if (card.id === 'card_combate' && (field.id === 'f_blood_pool' || field.key === 'blood_pool')) {
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
        };
      }
      if (
        (field.id === 'f_wp_boost' || field.key === 'wp_boost') &&
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

  return changed
    ? syncWillpowerToggleWithResource({ ...withMeta, cards })
    : syncWillpowerToggleWithResource(withMeta);
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

export function addFieldToCard(
  sheet: CharacterSheetState,
  cardId: string,
  newField: SheetField,
): CharacterSheetState {
  return touchSheetMetadata({
    ...sheet,
    cards: sheet.cards.map((card) =>
      card.id === cardId ? { ...card, fields: [...card.fields, newField] } : card,
    ),
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
  patch: Partial<Pick<SheetCard, 'code' | 'title' | 'colSpan' | 'tab'>>,
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
  'wits',
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

export interface NewSheetIdentityInput {
  characterName?: string;
  secondaryTrait?: string;
}

export function createNewSheetForSystem(
  systemId: SystemId,
  identity?: NewSheetIdentityInput,
): CharacterSheetState {
  const validIds: SystemId[] = ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'];
  const resolvedId: SystemId = validIds.includes(systemId) ? systemId : 'blank';
  const customCharName = identity?.characterName?.trim() ?? '';
  const customSecondaryTrait = identity?.secondaryTrait?.trim() ?? '';

  if (resolvedId === 'blank') {
    const blank = createBlankSheet();
    return customCharName
      ? { ...blank, characterName: customCharName.toUpperCase() }
      : blank;
  }

  const preset = createPresetBySystemId(resolvedId);
  return {
    ...preset,
    systemId: resolvedId,
    characterName: customCharName ? customCharName.toUpperCase() : 'NOVO PERSONAGEM',
    revision: 1,
    updatedAt: nowIsoUtc(),
    deviceId: getOrCreateDeviceId(),
    cards: preset.cards.map((card) => ({
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
            return {
              ...field,
              value: max,
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
    })),
    rollLogs: [],
    xp: {
      totalEarned: 0,
      spent: 0,
      ledger: [],
    },
  };
}

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
            rollConfig.difficulty = Math.max(2, Math.min(10, Math.round(field.rollDifficulty)));
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

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
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
const ALLOWED_XP_CATEGORIES = new Set(['attribute', 'skill', 'discipline']);

const ROOT_SHEET_KEYS = new Set([
  'id',
  'systemId',
  'systemName',
  'systemCode',
  'characterName',
  'revision',
  'updatedAt',
  'deviceId',
  'tabs',
  'cards',
  'rollLogs',
  'xp',
]);
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
  'damageTrack',
  'superficialDamage',
  'aggravatedDamage',
  'formula',
  'showPlus',
  'rollLabel',
  'rollExpr',
  'rollDifficulty',
  'rollMod',
  'rollSpecialty',
  'useWillpower',
  'isSoak',
  'columns',
  'col2Type',
  'rows',
  'hint',
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
  'onesCount',
  'canceledOnes',
  'outcome',
]);
const XP_STATE_KEYS = new Set(['totalEarned', 'spent', 'ledger']);
const XP_LEDGER_KEYS = new Set([
  'id',
  'timestamp',
  'kind',
  'delta',
  'label',
  'fieldId',
  'category',
  'fromValue',
  'toValue',
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
        if (
          field.max !== undefined &&
          (typeof field.max !== 'number' || !Number.isInteger(field.max) || field.max < 1 || field.max > 100000)
        ) {
          errors.push(`${fPath}.max: deve ser inteiro entre 1 e 100000.`);
        }
        if (
          field.rollDifficulty !== undefined &&
          (typeof field.rollDifficulty !== 'number' ||
            !Number.isInteger(field.rollDifficulty) ||
            field.rollDifficulty < 2 ||
            field.rollDifficulty > 10)
        ) {
          errors.push(`${fPath}.rollDifficulty: deve ser inteiro entre 2 e 10.`);
        }
        if (field.rollSpecialty !== undefined && typeof field.rollSpecialty !== 'boolean') {
          errors.push(`${fPath}.rollSpecialty: deve ser booleano.`);
        }
        if (field.useWillpower !== undefined && typeof field.useWillpower !== 'boolean') {
          errors.push(`${fPath}.useWillpower: deve ser booleano.`);
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
      if (!Array.isArray(data.xp.ledger)) {
        errors.push('$.xp.ledger: array obrigatório.');
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
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
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


