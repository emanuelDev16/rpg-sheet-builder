import { evaluateFormula, rollDiceExpression, VariableMap } from './formula';

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
    description: 'Atributos, Health, Willpower, Blood Pool, Disciplines e pools Nd10',
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
  formula?: string;
  showPlus?: boolean;
  rollLabel?: string;
  rollExpr?: string;
  columns?: [string, string];
  col2Type?: 'number' | 'text';
  rows?: RepeatableRow[];
  hint?: string;
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
  systemId?: SystemId;
  systemName: string;
  systemCode: string;
  characterName: string;
  cards: SheetCard[];
  rollLogs: RollLogEntry[];
  xp?: XpState;
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
    systemId: 'wod',
    systemName: 'WORLD OF DARKNESS // STORYTELLER',
    systemCode: '/SYS: WORLD OF DARKNESS · d10 STORYTELLER',
    characterName: 'JULIAN CROSS · NEONATE (VENTRUE)',
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
        title: 'HEALTH · WILLPOWER · BLOOD',
        colSpan: 1,
        fields: [
          {
            id: 'f_health',
            key: 'health',
            label: 'HEALTH',
            kind: 'resource',
            value: 7,
            max: 7,
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
            id: 'f_blood_pool',
            key: 'blood_pool',
            label: 'BLOOD POOL',
            kind: 'resource',
            value: 9,
            max: 13,
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
            id: 'f_wp_boost',
            key: 'wp_boost',
            label: 'WILLPOWER SURGE (+1 DIE)',
            kind: 'boolean',
            value: false,
            hint: 'SPENT THIS TURN',
          },
          {
            id: 'f_soak',
            key: 'soak_roll',
            label: 'SOAK DAMAGE',
            kind: 'roll',
            rollLabel: 'ROLL SOAK',
            rollExpr: 'pool(stamina, 6)',
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
            rollExpr: 'pool(strength + brawl + wp_boost, 6)',
          },
          {
            id: 'f_roll_firearms',
            key: 'roll_firearms',
            label: 'RANGED ATTACK',
            kind: 'roll',
            rollLabel: 'ROLL FIREARMS',
            rollExpr: 'pool(dexterity + firearms + wp_boost, 6)',
          },
          {
            id: 'f_roll_subterfuge',
            key: 'roll_subterfuge',
            label: 'SOCIAL MANIPULATION',
            kind: 'roll',
            rollLabel: 'ROLL SUBTERFUGE',
            rollExpr: 'pool(manipulation + subterfuge + wp_boost, 6)',
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
            rollExpr: 'pool(manipulation + dominate + wp_boost, 6)',
          },
          {
            id: 'f_roll_occult',
            key: 'roll_occult',
            label: 'ARCANE LORE CHECK',
            kind: 'roll',
            rollLabel: 'ROLL OCCULT',
            rollExpr: 'pool(wits + occult + wp_boost, 7)',
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
        isPoolRoll: true,
      },
      {
        id: 'log_wod_2',
        timestamp: '22:58',
        label: 'ROLL DOMINATE',
        total: 3,
        formula: '7d10 (DIFF 6)',
        breakdown: '7d10[8, 6, 4, 9, 2, 7, 1] ≥6 → 3 SUCESSOS',
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
    systemId: 'dnd5e',
    systemName: 'D&D 5E // D20 SYSTEM',
    systemCode: '/SYS: D&D 5E · D20 HEROIC EDITION',
    characterName: 'LYRA VANCE · ELDRITCH KNIGHT (LV 5)',
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
    systemId: 'default',
    systemName: 'SISTEMA GENÉRICO EXEMPLO',
    systemCode: '/SYS: SISTEMA GENÉRICO EXEMPLO',
    characterName: 'KAELEN VANCE · OPERADOR',
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
    systemId: 'blank',
    systemName: 'SISTEMA CUSTOMIZADO',
    systemCode: '/SYS: SISTEMA CUSTOMIZADO',
    characterName: 'NOVO PERSONAGEM',
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
    systemId: 'cyberpunk',
    systemName: 'NET//RUNNER D10 PROTOCOL',
    systemCode: '/SYS: CYBERPUNK D10 PROTOCOL',
    characterName: 'ZERO_K · NETRUNNER',
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
        const num = typeof field.value === 'number' ? field.value : 0;
        variables[key] = num;
        variables[`${key}_max`] = field.max ?? num;
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

export function resolveRollPreview(expression: string, vars: VariableMap): string {
  const cleaned = expression.trim();
  if (!cleaned) return '';

  const poolFnMatch = cleaned.match(/^pool\((.+)\)$/i);
  if (poolFnMatch) {
    const inner = poolFnMatch[1];
    let depth = 0;
    let splitIdx = -1;
    for (let i = 0; i < inner.length; i += 1) {
      if (inner[i] === '(') depth += 1;
      else if (inner[i] === ')') depth -= 1;
      else if (inner[i] === ',' && depth === 0) {
        splitIdx = i;
        break;
      }
    }
    const countPart = splitIdx === -1 ? inner : inner.slice(0, splitIdx);
    const diffPart = splitIdx === -1 ? '6' : inner.slice(splitIdx + 1);
    const countRes = evaluateFormula(countPart, vars, false);
    const diffRes = evaluateFormula(diffPart, vars, false);
    if (countRes.ok && diffRes.ok) {
      const poolSize = Math.max(0, Math.min(30, Math.round(countRes.value)));
      const diff = Math.max(2, Math.min(10, Math.round(diffRes.value)));
      return `${poolSize}d10 @ DIFF ${diff}`;
    }
  }

  const shortPoolMatch = cleaned.match(/^(.+?)d10\s*(?:@|>=)\s*(\d+)$/i);
  if (shortPoolMatch) {
    const countRes = evaluateFormula(shortPoolMatch[1], vars, false);
    if (countRes.ok) {
      const poolSize = Math.max(0, Math.min(30, Math.round(countRes.value)));
      return `${poolSize}d10 @ DIFF ${shortPoolMatch[2]}`;
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

export function updateFieldValue(
  sheet: CharacterSheetState,
  fieldId: string,
  nextValue: number | string | boolean,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => (f.id === fieldId ? { ...f, value: nextValue } : f)),
    })),
  };
}

export function adjustResourceValue(
  sheet: CharacterSheetState,
  fieldId: string,
  delta: number,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'resource') return f;
        const max = f.max ?? 12;
        const current = typeof f.value === 'number' ? f.value : 0;
        const clamped = Math.max(0, Math.min(max, current + delta));
        return { ...f, value: clamped };
      }),
    })),
  };
}

export function addRepeatableRow(
  sheet: CharacterSheetState,
  fieldId: string,
  newId: string,
): CharacterSheetState {
  return {
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
  };
}

export function updateRepeatableRow(
  sheet: CharacterSheetState,
  fieldId: string,
  rowId: string,
  col: 'col1' | 'col2',
  val: string | number,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'repeatable') return f;
        const rows = (f.rows ?? []).map((r) => (r.id === rowId ? { ...r, [col]: val } : r));
        return { ...f, rows };
      }),
    })),
  };
}

export function removeRepeatableRow(
  sheet: CharacterSheetState,
  fieldId: string,
  rowId: string,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId || f.kind !== 'repeatable') return f;
        const rows = (f.rows ?? []).filter((r) => r.id !== rowId);
        return { ...f, rows };
      }),
    })),
  };
}

export function updateFieldSchema(
  sheet: CharacterSheetState,
  fieldId: string,
  patch: Partial<SheetField>,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    })),
  };
}

export function addFieldToCard(
  sheet: CharacterSheetState,
  cardId: string,
  newField: SheetField,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) =>
      card.id === cardId ? { ...card, fields: [...card.fields, newField] } : card,
    ),
  };
}

export function removeFieldFromCard(
  sheet: CharacterSheetState,
  cardId: string,
  fieldId: string,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) =>
      card.id === cardId
        ? { ...card, fields: card.fields.filter((f) => f.id !== fieldId) }
        : card,
    ),
  };
}

export function addCardToSheet(
  sheet: CharacterSheetState,
  newCard: SheetCard,
): CharacterSheetState {
  return {
    ...sheet,
    cards: [...sheet.cards, newCard],
  };
}

export function updateCardSchema(
  sheet: CharacterSheetState,
  cardId: string,
  patch: Partial<Pick<SheetCard, 'code' | 'title' | 'colSpan' | 'tab'>>,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
  };
}

export function removeCardFromSheet(
  sheet: CharacterSheetState,
  cardId: string,
): CharacterSheetState {
  return {
    ...sheet,
    cards: sheet.cards.filter((card) => card.id !== cardId),
  };
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

