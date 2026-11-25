import { getV5BloodPotencyStats } from './formula.ts';
import { type AppLanguage, getLocalizedTabLabels, getTranslations } from './i18n.ts';
import {
  localizeCardTag,
  localizeCardTitle,
  localizeFieldLabel,
  localizeFieldRollLabel,
  localizeSystemName,
  localizeTableColumn,
  localizeTabTitle,
} from './presetI18n.ts';
import {
  type CharacterSheetState,
  detectSystemId,
  evaluateSheet,
  getSheetBloodPool,
  getSheetHumanityStains,
  getSheetVirtues,
  getV20HealthBreakdown,
  getV5HealthBreakdown,
  getV5WillpowerState,
  resolveRollPreview,
  resolveRulePreset,
  type SheetCard,
  type SheetEvaluation,
  type SheetField,
  type SystemId,
  type TabId,
} from './sheetModel.ts';
import {
  findAdvantageByIdOrName,
  findHavenTraitByIdOrName,
  type WodCatalogEdition,
} from './wodAdvantagesCatalog.ts';
import { findDisciplineByIdOrName, WOD_DISCIPLINES_CATALOG } from './wodClansDisciplinesCatalog.ts';
import {
  isOfficialVampireSheet,
  normalizeCatalogText,
  V20_SKILLS_CATALOG,
  V5_SKILLS_CATALOG,
  WOD_CATEGORY_LABELS,
  type WodSkillCategory,
} from './wodSkillsCatalog.ts';
import { getAvailableXp, normalizeXpState } from './xpSystem.ts';

export type PaperSheetLayout = 'wod-v5' | 'wod-v20' | 'dnd5e' | 'generic';

export interface PaperIdentityCell {
  key: string;
  label: string;
  value: string;
  badge?: string;
}

export interface PaperDotRow {
  id: string;
  key: string;
  label: string;
  value: number;
  max: 5 | 10;
  specialty?: string;
}

export interface PaperTrackBox {
  kind: 'empty' | 'superficial' | 'aggravated' | 'bashing' | 'lethal' | 'filled' | 'stain' | 'filled-stain';
  symbol: string;
  title?: string;
}

export interface PaperTrack {
  testId?: string;
  label: string;
  summary: string;
  badge?: string;
  legend?: string;
  boxes: PaperTrackBox[];
  isContinuous?: boolean;
  pct?: number;
}

export interface PaperFieldItem {
  id: string;
  key: string;
  kind: SheetField['kind'] | 'dots';
  label: string;
  value: string;
  rawUrl?: string;
  hint?: string;
  badge?: string;
  formula?: string;
  checked?: boolean;
  dots?: { value: number; max: 5 | 10 };
  track?: PaperTrack;
  table?: {
    col1Header: string;
    col2Header: string;
    cargoBadge?: string;
    rows: Array<{ col1: string; col2: string }>;
  };
}

export interface PaperExtraCard {
  id: string;
  tab: TabId;
  code: string;
  title: string;
  colSpan: 1 | 2;
  fields: PaperFieldItem[];
}

export interface PaperXpSummary {
  totalEarned: number;
  spent: number;
  available: number;
  recentEntries: Array<{
    id: string;
    timestamp: string;
    kind: 'award' | 'upgrade';
    delta: number;
    label: string;
  }>;
}

export interface PaperDisciplineSlot {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  cost: string;
}

export interface PaperDisciplineBlock {
  id: string;
  label: string;
  value: number;
  slots: PaperDisciplineSlot[];
}

export interface PaperWodTouchstoneItem {
  id: string;
  conviction: string;
  touchstone: string;
  notes?: string;
}

export interface PaperWodMeritFlawItem {
  id: string;
  kind: 'merit' | 'flaw';
  badge: string;
  name: string;
  rating: number;
  notes?: string;
}

export interface PaperWodHavenItem {
  id: string;
  name: string;
  location?: string;
  rating: number;
  traits: Array<{ label: string; isFlaw: boolean }>;
  notes?: string;
}

export interface PaperWodV5Model {
  page1: {
    header3x3: PaperIdentityCell[];
    attributes3x3: Array<{ id: 'physical' | 'social' | 'mental'; title: string; items: PaperDotRow[] }>;
    skills3Col: Array<{ id: 'physical' | 'social' | 'mental'; title: string; items: PaperDotRow[] }>;
    middleStrip3Col: {
      chronicleTenets: string[];
      convictionsSummary: PaperWodTouchstoneItem[];
      bane: { label: string; value: string; severityBadge: string };
      compulsion: { label: string; value: string };
    };
    disciplines: PaperDisciplineBlock[];
    vitalColumn: {
      health: PaperTrack;
      willpower: PaperTrack;
      humanity: PaperTrack;
      hunger: { label: string; value: number; max: number; boxes: PaperTrackBox[] };
      bloodPotency: {
        testId: string;
        level: number;
        title: string;
        stats: Array<{ label: string; value: string }>;
      };
      resonance: { label: string; value: string };
      hunting: { label: string; value: string };
    };
  };
  page2: {
    backgrounds: PaperDotRow[];
    merits: PaperWodMeritFlawItem[];
    flaws: PaperWodMeritFlawItem[];
    meritsFlaws: {
      testId: string;
      heading: string;
      summary: string;
      items: PaperWodMeritFlawItem[];
    };
    havens: {
      testId: string;
      heading: string;
      countLabel: string;
      items: PaperWodHavenItem[];
    };
    touchstones: {
      testId: string;
      heading: string;
      counter: string;
      items: PaperWodTouchstoneItem[];
    };
    xpSummary: PaperXpSummary;
    equipment: PaperFieldItem[];
    notes: Array<{ id: string; label: string; value: string }>;
    extraCards: PaperExtraCard[];
  };
}

export interface PaperV20HealthRow {
  label: string;
  penalty: string;
  box: PaperTrackBox;
}

export interface PaperWodV20Model {
  page1: {
    header3x3: PaperIdentityCell[];
    attributes3x3: Array<{ id: 'physical' | 'social' | 'mental'; title: string; items: PaperDotRow[] }>;
    abilities3Col: Array<{ id: 'talents' | 'skills' | 'knowledges'; title: string; items: PaperDotRow[] }>;
    advantages3Col: {
      disciplines: PaperDotRow[];
      backgrounds: PaperDotRow[];
      virtues: {
        testId: string;
        heading: string;
        items: PaperDotRow[];
      };
    };
    bottom3Col: {
      humanity: { label: string; value: number };
      willpower: { label: string; value: number; max: number; boxes: PaperTrackBox[] };
      bloodPool: PaperTrack & { maxPerTurnLabel: string; maxPerTurn: number };
      health: {
        testId: string;
        label: string;
        summary: string;
        levels: PaperV20HealthRow[];
        soakLabel: string;
        soakValue: string;
      };
      clanWeakness: { label: string; value: string };
      xpCompact: { totalEarned: number; spent: number; available: number };
    };
  };
  page2: {
    meritsFlaws: {
      testId: string;
      heading: string;
      summary: string;
      items: PaperWodMeritFlawItem[];
    };
    havens: {
      testId: string;
      heading: string;
      countLabel: string;
      items: PaperWodHavenItem[];
    };
    powersRituals: PaperFieldItem[];
    combatEquipment: PaperFieldItem[];
    xpSummary: PaperXpSummary;
    notes: Array<{ id: string; label: string; value: string }>;
    extraCards: PaperExtraCard[];
  };
}

export interface PaperDndAbilityItem {
  key: string;
  label: string;
  shortLabel: string;
  score: number;
  modifier: string;
  modifierValue: number;
}

export interface PaperDndSkillItem {
  key: string;
  label: string;
  abilityShort: string;
  modifier: string;
  proficient: boolean;
}

export interface PaperDnd5eModel {
  page1: {
    identityBanner: {
      characterName: string;
      classLevel: string;
      race: string;
      alignment: string;
      xpTotal: number;
      proficiencyBonus: string;
    };
    col1: {
      abilities: PaperDndAbilityItem[];
      savingThrows: Array<{ key: string; label: string; modifier: string; proficient: boolean }>;
      skills18: PaperDndSkillItem[];
      passivePerception: number;
      proficiencies: string[];
    };
    col2: {
      armorClass: string;
      hitPoints: { label: string; current: number; max: number; temp: string };
      hitDice: { label: string; current: number; max: number };
      deathSaves: { successes: number; failures: number };
      attacks: Array<{ id: string; name: string; expr: string }>;
    };
    col3: {
      inspiration: boolean;
      initiative: string;
      speed: string;
      classResources: PaperFieldItem[];
      features: PaperFieldItem[];
      currency: Array<{ code: string; value: string }>;
      equipment: PaperFieldItem[];
    };
  };
  page2: {
    notes: Array<{ id: string; label: string; value: string }>;
    xpSummary: PaperXpSummary;
    extraCards: PaperExtraCard[];
  };
  page3: {
    spellDc: string;
    spellAtk: string;
    concentration: boolean;
    slots: PaperTrack[];
    spellRolls: Array<{ id: string; name: string; expr: string }>;
    grimoire: PaperFieldItem[];
  } | null;
}

export interface PaperGenericPage {
  pageNumber: number;
  tabLabel: string;
  cards: PaperExtraCard[];
  xpSummary?: PaperXpSummary;
}

export interface PaperEditorialLabels {
  attributes: string;
  skills: string;
  abilities: string;
  advantages: string;
  disciplines: string;
  backgrounds: string;
  backgroundsMerits: string;
  merits: string;
  flaws: string;
  virtues: string;
  health: string;
  willpower: string;
  humanity: string;
  hunger: string;
  bloodPool: string;
  bloodPotency: string;
  maxPerTurn: string;
  soak: string;
  clanWeakness: string;
  chronicleTenets: string;
  convictionsSummary: string;
  resonance: string;
  hunting: string;
  haven: string;
  powersRituals: string;
  combatEquipment: string;
  notes: string;
  extraSections: string;
  xpSection: string;
  xpTotal: string;
  xpSpent: string;
  xpAvailable: string;
  xpRecent: string;
  savingThrows: string;
  deathSaves: string;
  deathSuccesses: string;
  deathFailures: string;
  armorClass: string;
  hitPoints: string;
  tempHp: string;
  hitDice: string;
  attacks: string;
  inspiration: string;
  initiative: string;
  speed: string;
  passivePerception: string;
  proficiencies: string;
  features: string;
  currency: string;
  equipment: string;
  spellcasting: string;
  spellSaveDc: string;
  spellAttack: string;
  concentration: string;
  spellSlots: string;
  grimoire: string;
  biographyNotes: string;
  classLevel: string;
  race: string;
  alignment: string;
  proficiencyBonus: string;
  rollLogs: string;
  pageLabel: string;
  emptyNone: string;
}

export interface PaperSheetModel {
  layout: PaperSheetLayout;
  systemId: SystemId;
  systemName: string;
  systemCode: string;
  sheetTitle: string;
  sheetSubtitle: string;
  characterName: string;
  lang: AppLanguage;
  pageCount: number;
  labels: PaperEditorialLabels;
  rollLogs: Array<{ id: string; label: string; timestamp: string; total: number; breakdown: string }>;
  wodV5?: PaperWodV5Model;
  wodV20?: PaperWodV20Model;
  dnd5e?: PaperDnd5eModel;
  generic?: { pages: PaperGenericPage[] };
}

const PAPER_LABELS: Record<AppLanguage, PaperEditorialLabels> = {
  'pt-BR': {
    attributes: 'ATRIBUTOS',
    skills: 'PERÍCIAS',
    abilities: 'HABILIDADES',
    advantages: 'VANTAGENS',
    disciplines: 'DISCIPLINAS',
    backgrounds: 'ANTECEDENTES',
    backgroundsMerits: 'ANTECEDENTES & QUALIDADES',
    merits: 'QUALIDADES',
    flaws: 'DEFEITOS',
    virtues: 'VIRTUDES',
    health: 'VITALIDADE',
    willpower: 'FORÇA DE VONTADE',
    humanity: 'HUMANIDADE',
    hunger: 'FOME',
    bloodPool: 'RESERVA DE SANGUE',
    bloodPotency: 'POTÊNCIA DE SANGUE',
    maxPerTurn: 'SANGUE / TURNO',
    soak: 'ABSORÇÃO (SOAK)',
    clanWeakness: 'FRAQUEZA DE CLÃ',
    chronicleTenets: 'PRINCÍPIOS DA CRÔNICA',
    convictionsSummary: 'PEDRAS DE TOQUE & CONVICÇÕES',
    resonance: 'RESSONÂNCIA',
    hunting: 'CAÇA',
    haven: 'REFÚGIO',
    powersRituals: 'PODERES & RITUAIS',
    combatEquipment: 'COMBATE & EQUIPAMENTOS',
    notes: 'BIOGRAFIA & ANOTAÇÕES',
    extraSections: 'CARTÕES & CAMPOS ADICIONAIS',
    xpSection: 'EXPERIÊNCIA',
    xpTotal: 'TOTAL',
    xpSpent: 'GASTO',
    xpAvailable: 'DISPONÍVEL',
    xpRecent: 'HISTÓRICO RECENTE',
    savingThrows: 'TESTES DE RESISTÊNCIA',
    deathSaves: 'TESTES CONTRA A MORTE',
    deathSuccesses: 'SUCESSOS',
    deathFailures: 'FALHAS',
    armorClass: 'CA',
    hitPoints: 'PONTOS DE VIDA',
    tempHp: 'PV TEMP.',
    hitDice: 'DADOS DE VIDA',
    attacks: 'ATAQUES & CONJURAÇÃO',
    inspiration: 'INSPIRAÇÃO',
    initiative: 'INICIATIVA',
    speed: 'DESLOCAMENTO',
    passivePerception: 'PERCEPÇÃO PASSIVA',
    proficiencies: 'PROFICIÊNCIAS & IDIOMAS',
    features: 'CARACTERÍSTICAS & RECURSOS',
    currency: 'MOEDAS',
    equipment: 'EQUIPAMENTO',
    spellcasting: 'CONJURAÇÃO & GRIMÓRIO',
    spellSaveDc: 'CD DE MAGIA',
    spellAttack: 'BÔNUS DE ATAQUE',
    concentration: 'CONCENTRAÇÃO',
    spellSlots: 'ESPAÇOS DE MAGIA',
    grimoire: 'MAGIAS PREPARADAS',
    biographyNotes: 'BIOGRAFIA & ANOTAÇÕES',
    classLevel: 'CLASSE & NÍVEL',
    race: 'RAÇA / ESPÉCIE',
    alignment: 'TENDÊNCIA',
    proficiencyBonus: 'PROFICIÊNCIA',
    rollLogs: 'HISTÓRICO DE ROLAGENS',
    pageLabel: 'PÁG.',
    emptyNone: '',
  },
  en: {
    attributes: 'ATTRIBUTES',
    skills: 'SKILLS',
    abilities: 'ABILITIES',
    advantages: 'ADVANTAGES',
    disciplines: 'DISCIPLINES',
    backgrounds: 'BACKGROUNDS',
    backgroundsMerits: 'BACKGROUNDS & MERITS',
    merits: 'MERITS',
    flaws: 'FLAWS',
    virtues: 'VIRTUES',
    health: 'HEALTH',
    willpower: 'WILLPOWER',
    humanity: 'HUMANITY',
    hunger: 'HUNGER',
    bloodPool: 'BLOOD POOL',
    bloodPotency: 'BLOOD POTENCY',
    maxPerTurn: 'BLOOD / TURN',
    soak: 'SOAK',
    clanWeakness: 'CLAN WEAKNESS',
    chronicleTenets: 'CHRONICLE TENETS',
    convictionsSummary: 'TOUCHSTONES & CONVICTIONS',
    resonance: 'RESONANCE',
    hunting: 'HUNTING',
    haven: 'HAVEN',
    powersRituals: 'POWERS & RITUALS',
    combatEquipment: 'COMBAT & EQUIPMENT',
    notes: 'BIOGRAPHY & NOTES',
    extraSections: 'EXTRA CARDS & CUSTOM FIELDS',
    xpSection: 'EXPERIENCE',
    xpTotal: 'TOTAL',
    xpSpent: 'SPENT',
    xpAvailable: 'AVAILABLE',
    xpRecent: 'RECENT LEDGER',
    savingThrows: 'SAVING THROWS',
    deathSaves: 'DEATH SAVES',
    deathSuccesses: 'SUCCESSES',
    deathFailures: 'FAILURES',
    armorClass: 'AC',
    hitPoints: 'HIT POINTS',
    tempHp: 'TEMP HP',
    hitDice: 'HIT DICE',
    attacks: 'ATTACKS & SPELLCASTING',
    inspiration: 'INSPIRATION',
    initiative: 'INITIATIVE',
    speed: 'SPEED',
    passivePerception: 'PASSIVE PERCEPTION',
    proficiencies: 'PROFICIENCIES & LANGUAGES',
    features: 'FEATURES & RESOURCES',
    currency: 'CURRENCY',
    equipment: 'EQUIPMENT',
    spellcasting: 'SPELLCASTING & GRIMOIRE',
    spellSaveDc: 'SPELL SAVE DC',
    spellAttack: 'SPELL ATTACK',
    concentration: 'CONCENTRATION',
    spellSlots: 'SPELL SLOTS',
    grimoire: 'PREPARED SPELLS',
    biographyNotes: 'BIOGRAPHY & NOTES',
    classLevel: 'CLASS & LEVEL',
    race: 'RACE / SPECIES',
    alignment: 'ALIGNMENT',
    proficiencyBonus: 'PROFICIENCY',
    rollLogs: 'ROLL LOGS',
    pageLabel: 'PAGE',
    emptyNone: '',
  },
  es: {
    attributes: 'ATRIBUTOS',
    skills: 'HABILIDADES',
    abilities: 'HABILIDADES',
    advantages: 'VENTAJAS',
    disciplines: 'DISCIPLINAS',
    backgrounds: 'TRASFONDOS',
    backgroundsMerits: 'TRASFONDOS Y MÉRITOS',
    merits: 'MÉRITOS',
    flaws: 'DEFECTOS',
    virtues: 'VIRTUDES',
    health: 'SALUD',
    willpower: 'FUERZA DE VOLUNTAD',
    humanity: 'HUMANIDAD',
    hunger: 'ANSIA',
    bloodPool: 'RESERVA DE SANGRE',
    bloodPotency: 'POTENCIA DE SANGRE',
    maxPerTurn: 'SANGRE / TURNO',
    soak: 'ABSORCIÓN (SOAK)',
    clanWeakness: 'DEBILIDAD DE CLAN',
    chronicleTenets: 'PRINCIPIOS DE LA CRÓNICA',
    convictionsSummary: 'PIEDRAS DE TOQUE Y CONVICCIONES',
    resonance: 'RESONANCIA',
    hunting: 'CAZA',
    haven: 'REFUGIO',
    powersRituals: 'PODERES Y RITUALES',
    combatEquipment: 'COMBATE Y EQUIPO',
    notes: 'BIOGRAFÍA Y NOTAS',
    extraSections: 'TARJETAS Y CAMPOS ADICIONALES',
    xpSection: 'EXPERIENCIA',
    xpTotal: 'TOTAL',
    xpSpent: 'GASTADO',
    xpAvailable: 'DISPONIBLE',
    xpRecent: 'REGISTRO RECIENTE',
    savingThrows: 'TIRADAS DE SALVACIÓN',
    deathSaves: 'SALVACIONES DE MUERTE',
    deathSuccesses: 'ÉXITOS',
    deathFailures: 'FALLOS',
    armorClass: 'CA',
    hitPoints: 'PUNTOS DE GOLPE',
    tempHp: 'PG TEMP.',
    hitDice: 'DADOS DE GOLPE',
    attacks: 'ATAQUES Y CONJUROS',
    inspiration: 'INSPIRACIÓN',
    initiative: 'INICIATIVA',
    speed: 'VELOCIDAD',
    passivePerception: 'PERCEPCIÓN PASIVA',
    proficiencies: 'COMPETENCIAS E IDIOMAS',
    features: 'RASGOS Y RECURSOS',
    currency: 'MONEDAS',
    equipment: 'EQUIPO',
    spellcasting: 'CONJUROS Y GRIMORIO',
    spellSaveDc: 'CD DE CONJURO',
    spellAttack: 'ATAQUE DE CONJURO',
    concentration: 'CONCENTRACIÓN',
    spellSlots: 'ESPACIOS DE CONJURO',
    grimoire: 'CONJUROS PREPARADOS',
    biographyNotes: 'BIOGRAFÍA Y NOTAS',
    classLevel: 'CLASE Y NIVEL',
    race: 'RAZA / ESPECIE',
    alignment: 'ALINEAMIENTO',
    proficiencyBonus: 'COMPETENCIA',
    rollLogs: 'REGISTRO DE TIRADAS',
    pageLabel: 'PÁG.',
    emptyNone: '',
  },
};

const EDITORIAL_HEADERS: Record<
  Exclude<PaperSheetLayout, 'generic'>,
  Record<AppLanguage, { title: string; subtitle: string }>
> = {
  'wod-v5': {
    'pt-BR': { title: 'VAMPIRO · A MÁSCARA', subtitle: '5ª EDIÇÃO' },
    en: { title: 'VAMPIRE · THE MASQUERADE', subtitle: '5TH EDITION' },
    es: { title: 'VAMPIRO · LA MASCARADA', subtitle: '5ª EDICIÓN' },
  },
  'wod-v20': {
    'pt-BR': { title: 'VAMPIRO · A MÁSCARA', subtitle: 'EDIÇÃO 20 ANOS' },
    en: { title: 'VAMPIRE · THE MASQUERADE', subtitle: '20TH ANNIVERSARY' },
    es: { title: 'VAMPIRO · LA MASCARADA', subtitle: '20º ANIVERSARIO' },
  },
  dnd5e: {
    'pt-BR': { title: 'DUNGEONS & DRAGONS · 5E', subtitle: 'FICHA DE PERSONAGEM' },
    en: { title: 'DUNGEONS & DRAGONS · 5E', subtitle: 'CHARACTER SHEET' },
    es: { title: 'DUNGEONS & DRAGONS · 5E', subtitle: 'HOJA DE PERSONAJE' },
  },
};

const V20_HEALTH_LEVELS: ReadonlyArray<{ penalty: string; labels: Record<AppLanguage, string> }> = [
  { penalty: '0', labels: { 'pt-BR': 'Escoriado', en: 'Bruised', es: 'Magullado' } },
  { penalty: '-1', labels: { 'pt-BR': 'Machucado', en: 'Hurt', es: 'Lastimado' } },
  { penalty: '-1', labels: { 'pt-BR': 'Ferido', en: 'Injured', es: 'Herido' } },
  { penalty: '-2', labels: { 'pt-BR': 'Ferido Grav.', en: 'Wounded', es: 'Herido Grave' } },
  { penalty: '-2', labels: { 'pt-BR': 'Espancado', en: 'Mauled', es: 'Maltrecho' } },
  { penalty: '-5', labels: { 'pt-BR': 'Aleijado', en: 'Crippled', es: 'Tullido' } },
  { penalty: 'INCAP', labels: { 'pt-BR': 'Incapacitado', en: 'Incapacitated', es: 'Incapacitado' } },
];

const DND_ABILITIES: ReadonlyArray<{
  key: string;
  modKey: string;
  short: Record<AppLanguage, string>;
  labels: Record<AppLanguage, string>;
}> = [
  { key: 'strength', modKey: 'mod_str', short: { 'pt-BR': 'FOR', en: 'STR', es: 'FUE' }, labels: { 'pt-BR': 'FORÇA', en: 'STRENGTH', es: 'FUERZA' } },
  { key: 'dexterity', modKey: 'mod_dex', short: { 'pt-BR': 'DES', en: 'DEX', es: 'DES' }, labels: { 'pt-BR': 'DESTREZA', en: 'DEXTERITY', es: 'DESTREZA' } },
  { key: 'constitution', modKey: 'mod_con', short: { 'pt-BR': 'CON', en: 'CON', es: 'CON' }, labels: { 'pt-BR': 'CONSTITUIÇÃO', en: 'CONSTITUTION', es: 'CONSTITUCIÓN' } },
  { key: 'intelligence', modKey: 'mod_int', short: { 'pt-BR': 'INT', en: 'INT', es: 'INT' }, labels: { 'pt-BR': 'INTELIGÊNCIA', en: 'INTELLIGENCE', es: 'INTELIGENCIA' } },
  { key: 'wisdom', modKey: 'mod_wis', short: { 'pt-BR': 'SAB', en: 'WIS', es: 'SAB' }, labels: { 'pt-BR': 'SABEDORIA', en: 'WISDOM', es: 'SABIDURÍA' } },
  { key: 'charisma', modKey: 'mod_cha', short: { 'pt-BR': 'CAR', en: 'CHA', es: 'CAR' }, labels: { 'pt-BR': 'CARISMA', en: 'CHARISMA', es: 'CARISMA' } },
];

const DND_SKILLS_18: ReadonlyArray<{
  key: string;
  ability: string;
  labels: Record<AppLanguage, string>;
}> = [
  { key: 'acrobatics', ability: 'dexterity', labels: { 'pt-BR': 'Acrobacia', en: 'Acrobatics', es: 'Acrobacias' } },
  { key: 'animal_handling', ability: 'wisdom', labels: { 'pt-BR': 'Adestrar Animais', en: 'Animal Handling', es: 'Trato con Animales' } },
  { key: 'arcana', ability: 'intelligence', labels: { 'pt-BR': 'Arcanismo', en: 'Arcana', es: 'Conocimiento Arcano' } },
  { key: 'athletics', ability: 'strength', labels: { 'pt-BR': 'Atletismo', en: 'Athletics', es: 'Atletismo' } },
  { key: 'deception', ability: 'charisma', labels: { 'pt-BR': 'Enganação', en: 'Deception', es: 'Engaño' } },
  { key: 'history', ability: 'intelligence', labels: { 'pt-BR': 'História', en: 'History', es: 'Historia' } },
  { key: 'insight', ability: 'wisdom', labels: { 'pt-BR': 'Intuição', en: 'Insight', es: 'Perspicacia' } },
  { key: 'intimidation', ability: 'charisma', labels: { 'pt-BR': 'Intimidação', en: 'Intimidation', es: 'Intimidación' } },
  { key: 'investigation', ability: 'intelligence', labels: { 'pt-BR': 'Investigação', en: 'Investigation', es: 'Investigación' } },
  { key: 'medicine', ability: 'wisdom', labels: { 'pt-BR': 'Medicina', en: 'Medicine', es: 'Medicina' } },
  { key: 'nature', ability: 'intelligence', labels: { 'pt-BR': 'Natureza', en: 'Nature', es: 'Naturaleza' } },
  { key: 'perception', ability: 'wisdom', labels: { 'pt-BR': 'Percepção', en: 'Perception', es: 'Percepción' } },
  { key: 'performance', ability: 'charisma', labels: { 'pt-BR': 'Atuação', en: 'Performance', es: 'Interpretación' } },
  { key: 'persuasion', ability: 'charisma', labels: { 'pt-BR': 'Persuasão', en: 'Persuasion', es: 'Persuasión' } },
  { key: 'religion', ability: 'intelligence', labels: { 'pt-BR': 'Religião', en: 'Religion', es: 'Religión' } },
  { key: 'sleight_of_hand', ability: 'dexterity', labels: { 'pt-BR': 'Prestidigitação', en: 'Sleight of Hand', es: 'Juego de Manos' } },
  { key: 'stealth', ability: 'dexterity', labels: { 'pt-BR': 'Furtividade', en: 'Stealth', es: 'Sigilo' } },
  { key: 'survival', ability: 'wisdom', labels: { 'pt-BR': 'Sobrevivência', en: 'Survival', es: 'Supervivencia' } },
];

const PLACEHOLDER_NAMES = new Set([
  '',
  'NOVO PERSONAGEM',
  'NEW CHARACTER',
  'NUEVO PERSONAJE',
  'CHARACTER',
  'SEM NOME',
  'UNNAMED',
]);

function normalizeNameCmp(raw?: string): string {
  return (raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isPlaceholderName(raw?: string): boolean {
  return PLACEHOLDER_NAMES.has(normalizeNameCmp(raw));
}

function extractFieldCharacterName(sheet: CharacterSheetState): string {
  const match = findField(sheet.cards, ['character_name', 'nome_personagem', 'f_nome'], 'card_identidade');
  return typeof match?.field.value === 'string' ? match.field.value.trim() : '';
}

export function resolvePaperCharacterName(sheet: CharacterSheetState): string {
  const fieldName = extractFieldCharacterName(sheet);
  if (!isPlaceholderName(fieldName)) return fieldName;
  const sheetName = (sheet.characterName ?? '').trim();
  if (!isPlaceholderName(sheetName)) return sheetName;
  return '';
}

export function resolvePrintTitleCharacterName(sheet: CharacterSheetState): string {
  const fieldName = extractFieldCharacterName(sheet);
  const sheetName = (sheet.characterName ?? '').trim();
  if (isPlaceholderName(sheetName)) {
    return !isPlaceholderName(fieldName) ? fieldName : sheetName || 'CHARACTER';
  }
  if (!isPlaceholderName(fieldName)) {
    const normSheet = normalizeNameCmp(sheetName);
    const normField = normalizeNameCmp(fieldName);
    if (normSheet.includes(normField)) {
      return sheetName;
    }
    return fieldName;
  }
  return sheetName;
}

export function detectPaperSheetLayout(sheet: CharacterSheetState): PaperSheetLayout {
  const systemId = detectSystemId(sheet);
  const rulePreset = resolveRulePreset(sheet);
  if (isOfficialVampireSheet(systemId, rulePreset)) {
    return rulePreset === 'vampire-v5' ? 'wod-v5' : 'wod-v20';
  }
  if (systemId === 'dnd5e') return 'dnd5e';
  return 'generic';
}

function normKey(raw?: string): string {
  return (raw ?? '').trim().toLowerCase();
}

function clampInt(raw: unknown, min: number, max: number, fallback = 0): number {
  const num = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function formatMod(val: number): string {
  return val >= 0 ? `+${val}` : String(val);
}

function getBloodPerTurnByGen(generation: number): number {
  const gen = Math.round(generation);
  if (gen <= 4) return 10;
  if (gen === 5) return 8;
  if (gen === 6) return 6;
  if (gen === 7) return 4;
  if (gen === 8) return 3;
  if (gen === 9) return 2;
  return 1;
}

function buildXpSummary(sheet: CharacterSheetState): PaperXpSummary {
  const xp = normalizeXpState(sheet.xp);
  const available = getAvailableXp(xp);
  const recentEntries = [...xp.ledger]
    .slice(-6)
    .reverse()
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      kind: entry.kind,
      delta: entry.delta,
      label: entry.label,
    }));
  return {
    totalEarned: xp.totalEarned,
    spent: xp.spent,
    available,
    recentEntries,
  };
}

function findField(
  cards: readonly SheetCard[],
  keysOrIds: readonly string[],
  preferredCardId?: string,
): { field: SheetField; card: SheetCard } | undefined {
  const targets = keysOrIds.map((k) => normKey(k));
  const orderedCards = preferredCardId
    ? [
        ...cards.filter((c) => c.id === preferredCardId),
        ...cards.filter((c) => c.id !== preferredCardId),
      ]
    : cards;

  for (const card of orderedCards) {
    for (const field of card.fields) {
      if (targets.includes(normKey(field.key)) || targets.includes(normKey(field.id))) {
        return { field, card };
      }
    }
  }
  return undefined;
}

function buildGenericTrack(field: SheetField, lang: AppLanguage): PaperTrack {
  const val = Math.max(0, Number(field.value ?? 0));
  const max = Math.max(1, field.max ?? 10);
  const isContinuous = max > 20;
  const pct = isContinuous ? Math.max(0, Math.min(100, (val / max) * 100)) : undefined;
  const boxes: PaperTrackBox[] = isContinuous
    ? []
    : Array.from({ length: max }, (_, idx) => ({
        kind: idx < val ? 'filled' : 'empty',
        symbol: '',
      }));
  return {
    label: localizeFieldLabel(field, lang),
    summary: `${val} / ${max}`,
    boxes,
    isContinuous,
    pct,
  };
}

function buildPaperFieldItem(
  field: SheetField,
  evaluation: SheetEvaluation,
  lang: AppLanguage,
): PaperFieldItem {
  const i18n = getTranslations(lang);
  const t = i18n.t;
  const label = localizeFieldLabel(field, lang);
  const key = normKey(field.key);

  if (field.kind === 'calculated') {
    const info = evaluation.computedByFieldId[field.id];
    return {
      id: field.id,
      key,
      kind: 'calculated',
      label,
      value: info?.formatted ?? '0',
      formula: field.formula ?? '',
    };
  }

  if (field.kind === 'resource') {
    return {
      id: field.id,
      key,
      kind: 'resource',
      label,
      value: `${Number(field.value ?? 0)} / ${Math.max(1, field.max ?? 10)}`,
      track: buildGenericTrack(field, lang),
    };
  }

  if (field.kind === 'boolean') {
    return {
      id: field.id,
      key,
      kind: 'boolean',
      label,
      value: field.value ? '✓' : '—',
      checked: Boolean(field.value),
      hint: field.hint,
    };
  }

  if (field.kind === 'roll') {
    const preview = resolveRollPreview(field.rollExpr ?? '', evaluation.variables);
    return {
      id: field.id,
      key,
      kind: 'roll',
      label: localizeFieldRollLabel(field, lang),
      value: preview,
      formula: field.rollExpr ?? '',
    };
  }

  if (field.kind === 'repeatable') {
    const col1Header = field.columns?.[0]
      ? localizeTableColumn(field.columns[0], lang)
      : t('cards.defaultItemCol');
    const col2Header = field.columns?.[1]
      ? localizeTableColumn(field.columns[1], lang)
      : t('cards.defaultValueCol');
    const isCarry = field.id === 'f_mochila' || key === 'gear' || key === 'mochila';
    return {
      id: field.id,
      key,
      kind: 'repeatable',
      label,
      value: String((field.rows ?? []).length),
      table: {
        col1Header,
        col2Header,
        cargoBadge: isCarry ? `${t('cards.cargoBadge')} ${evaluation.totalCargoWeight} KG` : undefined,
        rows: (field.rows ?? []).map((r) => ({ col1: r.col1, col2: String(r.col2) })),
      },
    };
  }

  const rawStr = String(field.value ?? '');
  const looksLikeUrl = /^(?:https?:\/\/|data:|javascript:|vbscript:)/i.test(rawStr.trim());
  return {
    id: field.id,
    key,
    kind: field.kind,
    label,
    value: rawStr,
    rawUrl: field.kind === 'text' && looksLikeUrl ? rawStr.trim() : undefined,
    hint: field.hint,
  };
}

function collectExtraCards(
  sheet: CharacterSheetState,
  evaluation: SheetEvaluation,
  consumedCardIds: ReadonlySet<string>,
  consumedFieldIds: ReadonlySet<string>,
  lang: AppLanguage,
  includeTag: boolean,
): PaperExtraCard[] {
  const extras: PaperExtraCard[] = [];
  for (const card of sheet.cards) {
    if (consumedCardIds.has(card.id)) continue;
    const remaining = card.fields.filter((f) => !consumedFieldIds.has(f.id));
    if (remaining.length === 0) continue;
    extras.push({
      id: card.id,
      tab: card.tab,
      code: includeTag ? localizeCardTag(card, lang) : '',
      title: localizeCardTitle(card, lang),
      colSpan: (card.colSpan ?? 1) >= 2 ? 2 : 1,
      fields: remaining.map((f) => buildPaperFieldItem(f, evaluation, lang)),
    });
  }
  return extras;
}

function buildWodStructuredDossier(
  sheet: CharacterSheetState,
  edition: WodCatalogEdition,
  lang: AppLanguage,
) {
  const t = getTranslations(lang).t;
  const touchstones: PaperWodTouchstoneItem[] = (sheet.touchstones ?? []).map((ts) => ({
    id: ts.id,
    conviction: ts.conviction,
    touchstone: ts.touchstone,
    notes: ts.notes?.trim() || undefined,
  }));

  let meritsTotal = 0;
  let flawsTotal = 0;
  const mfItems: PaperWodMeritFlawItem[] = (sheet.meritsFlaws ?? []).map((mf) => {
    const rating = clampInt(mf.rating, 1, 5, 1);
    if (mf.kind === 'flaw') flawsTotal += rating;
    else meritsTotal += rating;
    return {
      id: mf.id,
      kind: mf.kind,
      badge: mf.kind === 'flaw' ? t('cards.structured.badgeFlaw') : t('cards.structured.badgeMerit'),
      name: mf.name,
      rating,
      notes: mf.notes?.trim() || undefined,
    };
  });

  const havenItems: PaperWodHavenItem[] = (sheet.havens ?? []).map((hv) => ({
    id: hv.id,
    name: hv.name,
    location: hv.location?.trim() || undefined,
    rating: clampInt(hv.rating, 1, 5, 1),
    traits: (hv.traits ?? []).map((traitId) => {
      const match = findHavenTraitByIdOrName(traitId, edition);
      return {
        label: match ? match.name[lang] : traitId,
        isFlaw: match?.kind === 'flaw',
      };
    }),
    notes: hv.notes?.trim() || undefined,
  }));

  return {
    meritsFlaws: {
      testId: 'pure-html-merits-flaws',
      heading: t('cards.structured.meritsFlawsHeading'),
      summary: t('cards.structured.meritsFlawsSummary', { merits: meritsTotal, flaws: flawsTotal }),
      items: mfItems,
    },
    havens: {
      testId: 'pure-html-havens',
      heading: t('cards.structured.havensHeading'),
      countLabel: t('cards.structured.havensCount', { count: havenItems.length }),
      items: havenItems,
    },
    touchstones: {
      testId: 'pure-html-touchstones',
      heading: t('cards.structured.touchstonesHeading'),
      counter: t('cards.structured.touchstonesCounter', { count: touchstones.length }),
      items: touchstones,
    },
  };
}

function buildWodAttributes3x3(
  sheet: CharacterSheetState,
  isV5: boolean,
  consumedFieldIds: Set<string>,
  lang: AppLanguage,
): Array<{ id: 'physical' | 'social' | 'mental'; title: string; items: PaperDotRow[] }> {
  const t = getTranslations(lang).t;
  const attrCard = sheet.cards.find((c) => c.id === 'card_atributos');
  if (attrCard) {
    for (const f of attrCard.fields) {
      const k = normKey(f.key);
      if (k === 'initiative' || k === 'defense') {
        consumedFieldIds.add(f.id);
      }
    }
  }

  const specs: Array<{ group: 'physical' | 'social' | 'mental'; title: string; keys: string[] }> = [
    { group: 'physical', title: t('cards.attributes.physical'), keys: ['strength', 'dexterity', 'stamina'] },
    { group: 'social', title: t('cards.attributes.social'), keys: ['charisma', 'manipulation', 'appearance'] },
    { group: 'mental', title: t('cards.attributes.mental'), keys: ['perception', 'intelligence', 'wits'] },
  ];
  if (isV5) {
    specs[1].keys = ['charisma', 'manipulation', 'composure'];
    specs[2].keys = ['intelligence', 'wits', 'resolve'];
  }

  return specs.map((spec) => ({
    id: spec.group,
    title: spec.title,
    items: spec.keys.map((key) => {
      const match = findField(sheet.cards, [key], 'card_atributos');
      if (match) consumedFieldIds.add(match.field.id);
      return {
        id: match?.field.id ?? `attr_${key}`,
        key,
        label: match ? localizeFieldLabel(match.field, lang) : localizeFieldLabel({ key, label: '' }, lang),
        value: clampInt(match?.field.value, 0, 5, 1),
        max: 5 as const,
      };
    }),
  }));
}

function buildWodSkills3Col<T extends WodSkillCategory>(
  sheet: CharacterSheetState,
  edition: WodCatalogEdition,
  categories: readonly T[],
  consumedFieldIds: Set<string>,
  lang: AppLanguage,
): Array<{ id: T; title: string; items: PaperDotRow[] }> {
  const catalog = edition === 'vampire-v5' ? V5_SKILLS_CATALOG : V20_SKILLS_CATALOG;
  const skillsCard = sheet.cards.find((c) => c.id === 'card_skills');
  const allSkillCandidates = skillsCard ? [...skillsCard.fields] : [];

  const groups = new Map<T, PaperDotRow[]>();
  for (const cat of categories) groups.set(cat, []);

  for (const entry of catalog) {
    const cat = entry.category as T;
    if (!groups.has(cat)) continue;
    const keys = [entry.varName, entry.id, ...(entry.aliases ?? [])];
    const matchInSkills = skillsCard ? findField([skillsCard], keys) : undefined;
    const matchAnywhere = matchInSkills ?? findField(sheet.cards.filter((c) => c.id !== 'card_atributos'), keys);
    const matchedField = matchInSkills?.field ?? (entry.varName === 'occult' ? matchAnywhere?.field : undefined);

    if (matchedField) consumedFieldIds.add(matchedField.id);
    const label = matchedField ? localizeFieldLabel(matchedField, lang) : entry.labels[lang];
    groups.get(cat)!.push({
      id: matchedField?.id ?? entry.id,
      key: entry.varName,
      label,
      value: clampInt(matchedField?.value, 0, 5, 0),
      max: 5,
      specialty: matchedField?.hint?.trim() || undefined,
    });
  }

  const lastCat = categories[categories.length - 1];
  for (const field of allSkillCandidates) {
    if (consumedFieldIds.has(field.id)) continue;
    if (field.kind === 'number') {
      consumedFieldIds.add(field.id);
      groups.get(lastCat)!.push({
        id: field.id,
        key: normKey(field.key),
        label: localizeFieldLabel(field, lang),
        value: clampInt(field.value, 0, 5, 0),
        max: 5,
        specialty: field.hint?.trim() || undefined,
      });
    } else if (field.kind === 'roll' && field.id.startsWith('f_roll_')) {
      consumedFieldIds.add(field.id);
    }
  }

  return categories.map((cat) => ({
    id: cat,
    title: WOD_CATEGORY_LABELS[cat][lang],
    items: groups.get(cat)!,
  }));
}

function buildWodV5Model(
  sheet: CharacterSheetState,
  evaluation: SheetEvaluation,
  consumedCardIds: Set<string>,
  consumedFieldIds: Set<string>,
  lang: AppLanguage,
): PaperWodV5Model {
  const t = getTranslations(lang).t;
  const labels = PAPER_LABELS[lang];
  const idCard = sheet.cards.find((c) => c.id === 'card_identidade');
  const getIdCell = (key: string, fallbackVal = ''): PaperIdentityCell => {
    const match = idCard ? findField([idCard], [key]) : findField(sheet.cards, [key]);
    if (match) consumedFieldIds.add(match.field.id);
    const rawVal = match?.field.value;
    const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== ''
      ? String(rawVal)
      : fallbackVal;
    return {
      key,
      label: match ? localizeFieldLabel(match.field, lang) : localizeFieldLabel({ key, label: '' }, lang),
      value: val,
    };
  };

  // Exact V5 3 cols x 3 rows:
  // Row 1: Nome | Ambição | Clã
  // Row 2: Conceito | Desejo | Geração
  // Row 3: Crônica | Predador | Senhor
  const charNameVal = resolvePaperCharacterName(sheet);
  const nameCell = getIdCell('character_name', charNameVal);
  nameCell.value = charNameVal;
  const header3x3: PaperIdentityCell[] = [
    nameCell,
    getIdCell('ambition'),
    getIdCell('clan'),
    getIdCell('concept'),
    getIdCell('desire'),
    getIdCell('generation'),
    getIdCell('chronicle'),
    getIdCell('predator_type'),
    getIdCell('sire'),
  ];

  const bpLevel =
    typeof evaluation.variables.blood_potency === 'number' && Number.isFinite(evaluation.variables.blood_potency)
      ? clampInt(evaluation.variables.blood_potency, 0, 10, 1)
      : 1;
  const bpStats = getV5BloodPotencyStats(bpLevel);
  const bpFieldMatch = findField(sheet.cards, ['blood_potency'], 'card_identidade');
  if (bpFieldMatch) consumedFieldIds.add(bpFieldMatch.field.id);

  const baneCell = getIdCell('clan_bane');
  const compulsionCell = getIdCell('clan_compulsion');
  const baneSeverityBadge = t('cards.vital.baneSeverityBadge', { severity: bpStats.baneSeverity });

  const tenetsMatch = findField(sheet.cards, ['chronicle_tenets', 'tenets', 'principios']);
  if (tenetsMatch) consumedFieldIds.add(tenetsMatch.field.id);
  const rawTenets = typeof tenetsMatch?.field.value === 'string'
    ? tenetsMatch.field.value.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean)
    : [];
  const chronicleTenets = Array.from({ length: 3 }, (_, idx) => rawTenets[idx] ?? '');

  const attributes3x3 = buildWodAttributes3x3(sheet, true, consumedFieldIds, lang);
  const skills3Col = buildWodSkills3Col(sheet, 'vampire-v5', ['physical', 'social', 'mental'], consumedFieldIds, lang);

  // Disciplines: always 6 slots (2 cols x 3 blocks) with 5 numbered slots each
  const arcanoCard = sheet.cards.find((c) => c.id === 'card_arcano');
  const grimorioCard = sheet.cards.find((c) => c.id === 'card_grimorio');
  const discFields: SheetField[] = [];
  if (arcanoCard) {
    for (const f of arcanoCard.fields) {
      const k = normKey(f.key);
      if (f.kind === 'number' && k !== 'occult') {
        discFields.push(f);
        consumedFieldIds.add(f.id);
      } else if (f.kind === 'roll' || k.endsWith('_pool')) {
        consumedFieldIds.add(f.id);
      }
    }
  }

  const powerRowsField = grimorioCard?.fields.find((f) => f.kind === 'repeatable');
  const powerRows = powerRowsField?.rows ?? [];
  if (powerRowsField) consumedFieldIds.add(powerRowsField.id);
  if (grimorioCard) {
    for (const f of grimorioCard.fields) {
      if (f.id === 'f_frenzy_check') consumedFieldIds.add(f.id);
    }
  }

  const disciplineBuckets = new Map<string, Array<{ name: string; cost: string }>>();
  for (const df of discFields) disciplineBuckets.set(df.id, []);
  const unmatchedPowers: Array<{ name: string; cost: string }> = [];

  for (const row of powerRows) {
    const rowNorm = normalizeCatalogText(row.col1);
    let assignedId: string | undefined;
    for (const df of discFields) {
      const dfNorm = normalizeCatalogText(df.label || df.key);
      const catDisc = findDisciplineByIdOrName(df.key, 'vampire-v5') ?? findDisciplineByIdOrName(df.label, 'vampire-v5');
      const matchesCatalogPower = catDisc?.powers.some((p) => {
        const names = [p.name['pt-BR'], p.name.en, p.name.es].map(normalizeCatalogText);
        return names.some((n) => rowNorm.includes(n) || n.includes(rowNorm));
      });
      if (matchesCatalogPower || (dfNorm && rowNorm.includes(dfNorm))) {
        assignedId = df.id;
        break;
      }
    }
    const item = { name: row.col1, cost: String(row.col2 ?? '') };
    if (assignedId) disciplineBuckets.get(assignedId)!.push(item);
    else unmatchedPowers.push(item);
  }

  if (unmatchedPowers.length > 0 && discFields.length > 0) {
    let idx = 0;
    for (const p of unmatchedPowers) {
      const target = discFields[idx % discFields.length];
      disciplineBuckets.get(target.id)!.push(p);
      idx += 1;
    }
  }

  const filledDisciplines: PaperDisciplineBlock[] = discFields.map((df) => {
    const rawPowers = disciplineBuckets.get(df.id) ?? [];
    const slots: PaperDisciplineSlot[] = Array.from({ length: 5 }, (_, idx) => {
      const lvl = (idx + 1) as 1 | 2 | 3 | 4 | 5;
      const p = rawPowers[idx];
      return { level: lvl, name: p?.name ?? '', cost: p?.cost ?? '' };
    });
    return {
      id: df.id,
      label: localizeFieldLabel(df, lang),
      value: clampInt(df.value, 0, 5, 0),
      slots,
    };
  });

  const disciplines: PaperDisciplineBlock[] = [...filledDisciplines];
  while (disciplines.length < 6) {
    const blankIdx = disciplines.length + 1;
    disciplines.push({
      id: `disc_slot_${blankIdx}`,
      label: '',
      value: 0,
      slots: [1, 2, 3, 4, 5].map((lvl) => ({
        level: lvl as 1 | 2 | 3 | 4 | 5,
        name: '',
        cost: '',
      })),
    });
  }

  // Vital column
  const combatCard = sheet.cards.find((c) => c.id === 'card_combate');
  const healthFieldMatch = findField(sheet.cards, ['health', 'f_health'], 'card_combate');
  const wpFieldMatch = findField(sheet.cards, ['willpower', 'f_willpower'], 'card_combate');
  const humFieldMatch = findField(sheet.cards, ['humanity', 'f_humanity'], 'card_combate');
  const hungerFieldMatch = findField(sheet.cards, ['hunger', 'f_hunger'], 'card_combate');
  const resMatch = findField(sheet.cards, ['resonance', 'ressonancia']);
  const huntMatch = findField(sheet.cards, ['hunting', 'caca', 'predator_hunting']);
  for (const m of [healthFieldMatch, wpFieldMatch, humFieldMatch, hungerFieldMatch, resMatch, huntMatch]) {
    if (m) consumedFieldIds.add(m.field.id);
  }
  if (combatCard) {
    for (const f of combatCard.fields) {
      if (f.id === 'f_wp_boost' || f.id === 'f_soak' || f.id === 'f_fortitude_armor') {
        consumedFieldIds.add(f.id);
      }
    }
  }

  const healthBreakdown = healthFieldMatch
    ? getV5HealthBreakdown(healthFieldMatch.field)
    : { max: 6, aggravated: 0, superficial: 0, healthy: 6, totalDamage: 0 };
  const healthBoxes: PaperTrackBox[] = Array.from({ length: healthBreakdown.max }, (_, idx) => {
    if (idx < healthBreakdown.aggravated) return { kind: 'aggravated', symbol: 'X', title: t('cards.aggravatedDmg') };
    if (idx < healthBreakdown.aggravated + healthBreakdown.superficial) return { kind: 'superficial', symbol: '/', title: t('cards.superficialDmg') };
    return { kind: 'empty', symbol: '' };
  });

  const wp = getV5WillpowerState(sheet);
  const wpBoxes: PaperTrackBox[] = Array.from({ length: wp.max }, (_, idx) => {
    if (idx < wp.aggravated) return { kind: 'aggravated', symbol: 'X', title: t('cards.vital.wpAggravatedDmg') };
    if (idx < wp.aggravated + wp.superficial) return { kind: 'superficial', symbol: '/', title: t('cards.vital.wpSuperficialDmg') };
    return { kind: 'empty', symbol: '' };
  });

  const humState = getSheetHumanityStains(sheet);
  const humBoxes: PaperTrackBox[] = Array.from({ length: 10 }, (_, idx) => {
    const isH = idx < humState.humanity;
    const isS = idx >= 10 - humState.stains;
    if (isH && isS) return { kind: 'filled-stain', symbol: '●/' };
    if (isS) return { kind: 'stain', symbol: '/' };
    if (isH) return { kind: 'filled', symbol: '●' };
    return { kind: 'empty', symbol: '' };
  });

  const hungerVal = clampInt(hungerFieldMatch?.field.value, 0, 5, 1);
  const hungerBoxes: PaperTrackBox[] = Array.from({ length: 5 }, (_, idx) => ({
    kind: idx < hungerVal ? 'filled' : 'empty',
    symbol: idx < hungerVal ? '●' : '',
  }));

  const rerollStr =
    bpStats.rouseRerollMaxLevel > 0
      ? t('cards.vital.bpRouseRerollValue', { level: bpStats.rouseRerollMaxLevel })
      : t('cards.vital.bpRouseRerollNone');

  const backgrounds: PaperDotRow[] = [];
  for (const card of sheet.cards) {
    for (const f of card.fields) {
      if (consumedFieldIds.has(f.id) || f.kind !== 'number') continue;
      const adv = findAdvantageByIdOrName(f.key, 'vampire-v5') ?? findAdvantageByIdOrName(f.label, 'vampire-v5');
      if (adv?.group === 'background' || f.xpCategory === 'advantage') {
        consumedFieldIds.add(f.id);
        backgrounds.push({
          id: f.id,
          key: normKey(f.key),
          label: localizeFieldLabel(f, lang),
          value: clampInt(f.value, 0, 5, 0),
          max: 5,
        });
      }
    }
  }

  consumedCardIds.add('card_wod_dossier');

  const equipment: PaperFieldItem[] = [];
  const invCard = sheet.cards.find((c) => c.id === 'card_inventario');
  if (invCard) {
    for (const f of invCard.fields) {
      consumedFieldIds.add(f.id);
      equipment.push(buildPaperFieldItem(f, evaluation, lang));
    }
  }

  const notesCard = sheet.cards.find((c) => c.id === 'card_notas');
  const notes: Array<{ id: string; label: string; value: string }> = [];
  if (notesCard) {
    for (const f of notesCard.fields) {
      if (f.kind === 'text' || f.kind === 'number') {
        consumedFieldIds.add(f.id);
        notes.push({
          id: f.id,
          label: localizeFieldLabel(f, lang),
          value: String(f.value ?? ''),
        });
      }
    }
  }

  const dossier = buildWodStructuredDossier(sheet, 'vampire-v5', lang);
  const convictionsSummary: PaperWodTouchstoneItem[] = [...dossier.touchstones.items];
  while (convictionsSummary.length < 3) {
    convictionsSummary.push({
      id: `ts_blank_${convictionsSummary.length + 1}`,
      conviction: '',
      touchstone: '',
    });
  }

  const extraCards = collectExtraCards(sheet, evaluation, consumedCardIds, consumedFieldIds, lang, false);

  return {
    page1: {
      header3x3,
      attributes3x3,
      skills3Col,
      middleStrip3Col: {
        chronicleTenets,
        convictionsSummary,
        bane: { label: baneCell.label, value: baneCell.value, severityBadge: baneSeverityBadge },
        compulsion: { label: compulsionCell.label, value: compulsionCell.value },
      },
      disciplines,
      vitalColumn: {
        health: {
          testId: 'pure-html-v5-health',
          label: healthFieldMatch ? localizeFieldLabel(healthFieldMatch.field, lang) : labels.health,
          summary: t('print.pureHtmlHealthV5Summary', {
            healthy: healthBreakdown.healthy,
            max: healthBreakdown.max,
            agg: healthBreakdown.aggravated,
            sup: healthBreakdown.superficial,
          }),
          badge: healthBreakdown.totalDamage >= healthBreakdown.max ? t('cards.vital.impairedBadge') : undefined,
          boxes: healthBoxes,
        },
        willpower: {
          testId: 'pure-html-v5-willpower',
          label: wpFieldMatch ? localizeFieldLabel(wpFieldMatch.field, lang) : labels.willpower,
          summary: t('print.pureHtmlWpValue', {
            available: wp.available,
            max: wp.max,
            sup: wp.superficial,
            agg: wp.aggravated,
          }),
          badge: wp.isImpaired ? t('cards.vital.wpImpairedBadge') : undefined,
          boxes: wpBoxes,
        },
        humanity: {
          testId: 'pure-html-v5-humanity',
          label: humFieldMatch ? localizeFieldLabel(humFieldMatch.field, lang) : labels.humanity,
          summary: t('print.pureHtmlHumanityValue', { humanity: humState.humanity, stains: humState.stains }),
          legend: t('print.pureHtmlStainsLegend'),
          boxes: humBoxes,
        },
        hunger: {
          label: hungerFieldMatch ? localizeFieldLabel(hungerFieldMatch.field, lang) : labels.hunger,
          value: hungerVal,
          max: 5,
          boxes: hungerBoxes,
        },
        bloodPotency: {
          testId: 'pure-html-v5-bp',
          level: clampInt(bpLevel, 0, 10, 1),
          title: t('cards.vital.bpPanelTitle', { level: bpStats.level }),
          stats: [
            { label: t('cards.vital.bpSurge'), value: `+${bpStats.bloodSurgeDice}d10` },
            { label: t('cards.vital.bpMend'), value: `${bpStats.mendSuperficialPerRouse} SUP` },
            { label: t('cards.vital.bpPowerBonus'), value: `+${bpStats.powerBonusDice}d10` },
            { label: t('cards.vital.bpRouseReroll'), value: rerollStr },
            { label: t('cards.vital.bpFeedingLabel'), value: t(`cards.vital.bpFeeding.${bpStats.feedingPenaltyKey}`) },
            { label: t('cards.vital.bpBaneSeverity'), value: String(bpStats.baneSeverity) },
          ],
        },
        resonance: {
          label: labels.resonance,
          value: resMatch?.field.value ? String(resMatch.field.value) : '',
        },
        hunting: {
          label: labels.hunting,
          value: huntMatch?.field.value ? String(huntMatch.field.value) : '',
        },
      },
    },
    page2: {
      backgrounds,
      merits: dossier.meritsFlaws.items.filter((m) => m.kind === 'merit'),
      flaws: dossier.meritsFlaws.items.filter((m) => m.kind === 'flaw'),
      meritsFlaws: dossier.meritsFlaws,
      havens: dossier.havens,
      touchstones: dossier.touchstones,
      xpSummary: buildXpSummary(sheet),
      equipment,
      notes,
      extraCards,
    },
  };
}

function buildWodV20Model(
  sheet: CharacterSheetState,
  evaluation: SheetEvaluation,
  consumedCardIds: Set<string>,
  consumedFieldIds: Set<string>,
  lang: AppLanguage,
): PaperWodV20Model {
  const t = getTranslations(lang).t;
  const labels = PAPER_LABELS[lang];
  const idCard = sheet.cards.find((c) => c.id === 'card_identidade');
  const getIdCell = (key: string, fallbackVal = ''): PaperIdentityCell => {
    const match = idCard ? findField([idCard], [key]) : findField(sheet.cards, [key]);
    if (match) consumedFieldIds.add(match.field.id);
    const rawVal = match?.field.value;
    const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== ''
      ? String(rawVal)
      : fallbackVal;
    return {
      key,
      label: match ? localizeFieldLabel(match.field, lang) : localizeFieldLabel({ key, label: '' }, lang),
      value: val,
    };
  };

  const genField = findField(sheet.cards, ['generation'], 'card_identidade');
  const generation = clampInt(genField?.field.value, 4, 15, 10);
  const maxBloodPerTurn = getBloodPerTurnByGen(generation);
  const bpCalc = findField(sheet.cards, ['blood_potency'], 'card_identidade');
  if (bpCalc) consumedFieldIds.add(bpCalc.field.id);

  const charNameVal = resolvePaperCharacterName(sheet);
  const nameCell = getIdCell('character_name', charNameVal);
  nameCell.value = charNameVal;
  const havenMatch = findField(sheet.cards, ['haven', 'refugio']);
  if (havenMatch) consumedFieldIds.add(havenMatch.field.id);
  const havenLabelValue =
    (typeof havenMatch?.field.value === 'string' && havenMatch.field.value.trim()) ||
    sheet.havens?.[0]?.name ||
    '';

  // Exact V20 3x3:
  // Nome / Natureza / Geração
  // Conceito / Comportamento / Senhor
  // Crônica / Clã / Refúgio
  const header3x3: PaperIdentityCell[] = [
    nameCell,
    getIdCell('nature'),
    getIdCell('generation', String(generation)),
    getIdCell('concept'),
    getIdCell('demeanor'),
    getIdCell('sire'),
    getIdCell('chronicle'),
    getIdCell('clan'),
    { key: 'haven', label: labels.haven, value: havenLabelValue },
  ];

  const weaknessCell = getIdCell('clan_weakness');
  const attributes3x3 = buildWodAttributes3x3(sheet, false, consumedFieldIds, lang);
  const abilities3Col = buildWodSkills3Col(sheet, 'storyteller-v20', ['talents', 'skills', 'knowledges'], consumedFieldIds, lang);

  const arcanoCard = sheet.cards.find((c) => c.id === 'card_arcano');
  const disciplines: PaperDotRow[] = [];
  if (arcanoCard) {
    for (const f of arcanoCard.fields) {
      const k = normKey(f.key);
      const isDisc = Boolean(findDisciplineByIdOrName(k, 'storyteller-v20')) || WOD_DISCIPLINES_CATALOG.some((d) => d.varName === k);
      if (f.kind === 'number' && (isDisc || k !== 'occult')) {
        consumedFieldIds.add(f.id);
        disciplines.push({
          id: f.id,
          key: k,
          label: localizeFieldLabel(f, lang),
          value: clampInt(f.value, 0, 5, 0),
          max: 5,
        });
      } else if (f.kind === 'roll' || k.endsWith('_pool')) {
        consumedFieldIds.add(f.id);
      }
    }
  }
  while (disciplines.length < 5) {
    disciplines.push({ id: `v20_disc_blank_${disciplines.length + 1}`, key: '', label: '', value: 0, max: 5 });
  }

  const backgrounds: PaperDotRow[] = [];
  for (const card of sheet.cards) {
    for (const f of card.fields) {
      if (consumedFieldIds.has(f.id) || f.kind !== 'number') continue;
      const adv = findAdvantageByIdOrName(f.key, 'storyteller-v20') ?? findAdvantageByIdOrName(f.label, 'storyteller-v20');
      if (adv?.group === 'background' || f.xpCategory === 'advantage') {
        consumedFieldIds.add(f.id);
        backgrounds.push({
          id: f.id,
          key: normKey(f.key),
          label: localizeFieldLabel(f, lang),
          value: clampInt(f.value, 0, 5, 0),
          max: 5,
        });
      }
    }
  }
  while (backgrounds.length < 5) {
    backgrounds.push({ id: `v20_bg_blank_${backgrounds.length + 1}`, key: '', label: '', value: 0, max: 5 });
  }

  const virtues = getSheetVirtues(sheet);
  const virtuesBlock = {
    testId: 'pure-html-v20-virtues',
    heading: t('cards.vital.virtuesHeading'),
    items: [
      { id: 'v_conscience', key: 'conscience', label: t('cards.vital.virtueConscience'), value: virtues.conscience, max: 5 as const },
      { id: 'v_self_control', key: 'self_control', label: t('cards.vital.virtueSelfControl'), value: virtues.selfControl, max: 5 as const },
      { id: 'v_courage', key: 'courage', label: t('cards.vital.virtueCourage'), value: virtues.courage, max: 5 as const },
    ],
  };

  const humFieldMatch = findField(sheet.cards, ['humanity', 'f_humanity'], 'card_combate');
  const wpFieldMatch = findField(sheet.cards, ['willpower', 'f_willpower'], 'card_combate');
  const healthFieldMatch = findField(sheet.cards, ['health', 'f_health'], 'card_combate');
  const hungerFieldMatch = findField(sheet.cards, ['hunger', 'f_hunger'], 'card_combate');
  const fortFieldMatch = findField(sheet.cards, ['fortitude_armor', 'f_fortitude_armor'], 'card_combate');
  const wpBoostMatch = findField(sheet.cards, ['wp_boost', 'f_wp_boost'], 'card_combate');
  const soakMatch = findField(sheet.cards, ['soak_roll', 'f_soak'], 'card_combate');
  for (const m of [humFieldMatch, wpFieldMatch, healthFieldMatch, hungerFieldMatch, fortFieldMatch, wpBoostMatch, soakMatch]) {
    if (m) consumedFieldIds.add(m.field.id);
  }

  const wpVal = clampInt(wpFieldMatch?.field.value, 0, 10, 6);
  const wpMax = clampInt(wpFieldMatch?.field.max, 1, 10, 8);
  const wpBoxes: PaperTrackBox[] = Array.from({ length: 10 }, (_, idx) => ({
    kind: idx < wpVal ? 'filled' : 'empty',
    symbol: idx < wpVal ? '■' : '',
  }));

  const bp = getSheetBloodPool(sheet);
  const bpVisualMax = Math.min(20, bp.max);
  const bpBoxes: PaperTrackBox[] =
    bp.max > 20
      ? []
      : Array.from({ length: bpVisualMax }, (_, idx) => ({
          kind: idx < bp.current ? 'filled' : 'empty',
          symbol: '',
        }));

  const healthBreakdown = healthFieldMatch
    ? getV20HealthBreakdown(healthFieldMatch.field)
    : { max: 7, aggravated: 0, lethal: 0, bashing: 0, totalDamage: 0, healthy: 7 };

  const v20Levels: PaperV20HealthRow[] = V20_HEALTH_LEVELS.map((lvl, idx) => {
    let box: PaperTrackBox = { kind: 'empty', symbol: '' };
    if (idx < healthBreakdown.aggravated) box = { kind: 'aggravated', symbol: '*', title: t('cards.vital.aggravatedV20Dmg') };
    else if (idx < healthBreakdown.aggravated + healthBreakdown.lethal) box = { kind: 'lethal', symbol: 'X', title: t('cards.vital.lethalDmg') };
    else if (idx < healthBreakdown.aggravated + healthBreakdown.lethal + healthBreakdown.bashing) box = { kind: 'bashing', symbol: '/', title: t('cards.vital.bashingDmg') };
    return { label: lvl.labels[lang], penalty: lvl.penalty, box };
  });

  const staminaVal = evaluation.variables.stamina ?? 0;
  const fortVal = evaluation.variables.fortitude_armor ?? 0;
  const soakTotal = staminaVal + fortVal;

  const xpSummary = buildXpSummary(sheet);

  consumedCardIds.add('card_wod_dossier');
  const dossier = buildWodStructuredDossier(sheet, 'storyteller-v20', lang);

  const powersRituals: PaperFieldItem[] = [];
  const grimorioCard = sheet.cards.find((c) => c.id === 'card_grimorio');
  if (grimorioCard) {
    for (const f of grimorioCard.fields) {
      consumedFieldIds.add(f.id);
      powersRituals.push(buildPaperFieldItem(f, evaluation, lang));
    }
  }

  const combatEquipment: PaperFieldItem[] = [];
  if (fortFieldMatch) combatEquipment.push(buildPaperFieldItem(fortFieldMatch.field, evaluation, lang));
  if (soakMatch) combatEquipment.push(buildPaperFieldItem(soakMatch.field, evaluation, lang));
  const invCard = sheet.cards.find((c) => c.id === 'card_inventario');
  if (invCard) {
    for (const f of invCard.fields) {
      consumedFieldIds.add(f.id);
      combatEquipment.push(buildPaperFieldItem(f, evaluation, lang));
    }
  }

  const notesCard = sheet.cards.find((c) => c.id === 'card_notas');
  const notes: Array<{ id: string; label: string; value: string }> = [];
  if (notesCard) {
    for (const f of notesCard.fields) {
      if (f.kind === 'text' || f.kind === 'number') {
        consumedFieldIds.add(f.id);
        notes.push({ id: f.id, label: localizeFieldLabel(f, lang), value: String(f.value ?? '') });
      }
    }
  }

  const extraCards = collectExtraCards(sheet, evaluation, consumedCardIds, consumedFieldIds, lang, false);

  return {
    page1: {
      header3x3,
      attributes3x3,
      abilities3Col,
      advantages3Col: {
        disciplines,
        backgrounds,
        virtues: virtuesBlock,
      },
      bottom3Col: {
        humanity: {
          label: humFieldMatch ? localizeFieldLabel(humFieldMatch.field, lang) : labels.humanity,
          value: clampInt(humFieldMatch?.field.value, 0, 10, 7),
        },
        willpower: {
          label: wpFieldMatch ? localizeFieldLabel(wpFieldMatch.field, lang) : labels.willpower,
          value: wpVal,
          max: wpMax,
          boxes: wpBoxes,
        },
        bloodPool: {
          testId: 'pure-html-v20-blood-pool',
          label: t('cards.vital.bloodPoolLabel'),
          summary: `${bp.current} / ${bp.max}`,
          boxes: bpBoxes,
          isContinuous: bp.max > 20,
          pct: bp.max > 0 ? Math.max(0, Math.min(100, (bp.current / bp.max) * 100)) : 0,
          maxPerTurnLabel: labels.maxPerTurn,
          maxPerTurn: maxBloodPerTurn,
        },
        health: {
          testId: 'pure-html-v20-health',
          label: healthFieldMatch ? localizeFieldLabel(healthFieldMatch.field, lang) : labels.health,
          summary: t('print.pureHtmlHealthV20Summary', {
            healthy: healthBreakdown.healthy,
            max: healthBreakdown.max,
            agg: healthBreakdown.aggravated,
            lethal: healthBreakdown.lethal,
            bashing: healthBreakdown.bashing,
          }),
          levels: v20Levels,
          soakLabel: labels.soak,
          soakValue: `${soakTotal}d10`,
        },
        clanWeakness: { label: weaknessCell.label, value: weaknessCell.value },
        xpCompact: {
          totalEarned: xpSummary.totalEarned,
          spent: xpSummary.spent,
          available: xpSummary.available,
        },
      },
    },
    page2: {
      meritsFlaws: dossier.meritsFlaws,
      havens: dossier.havens,
      powersRituals,
      combatEquipment,
      xpSummary,
      notes,
      extraCards,
    },
  };
}

function buildDnd5eModel(
  sheet: CharacterSheetState,
  evaluation: SheetEvaluation,
  consumedCardIds: Set<string>,
  consumedFieldIds: Set<string>,
  lang: AppLanguage,
): PaperDnd5eModel {
  const labels = PAPER_LABELS[lang];
  const xpSummary = buildXpSummary(sheet);
  const idCard = sheet.cards.find((c) => c.id === 'card_identidade');
  const getIdStr = (keys: string[], fallback = ''): string => {
    const m = idCard ? findField([idCard], keys) : findField(sheet.cards, keys);
    if (m) consumedFieldIds.add(m.field.id);
    if (m?.field.kind === 'calculated') {
      return evaluation.computedByFieldId[m.field.id]?.formatted ?? fallback;
    }
    const val = m?.field.value;
    return val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : fallback;
  };

  const rawClassRace = getIdStr(['class_race', 'classe']);
  const levelStr = getIdStr(['level', 'nivel'], '1');
  const explicitRace = getIdStr(['race', 'species', 'ancestry', 'raca']);
  const classParts = rawClassRace.split('·').map((s) => s.trim()).filter(Boolean);
  const classText = classParts[0] ?? rawClassRace;
  const raceText = explicitRace || classParts[1] || labels.emptyNone;
  const alignmentText = getIdStr(['alignment', 'tendencia'], labels.emptyNone);
  const profBonus = getIdStr(['prof', 'proficiency_bonus'], '+2');
  const charName = resolvePaperCharacterName(sheet);
  getIdStr(['character_name', 'nome'], charName);

  const abilityModMap = new Map<string, number>();
  const abilities: PaperDndAbilityItem[] = DND_ABILITIES.map((ab) => {
    const scoreMatch = findField(sheet.cards, [ab.key], 'card_atributos');
    const modMatch = findField(sheet.cards, [ab.modKey], 'card_atributos');
    if (scoreMatch) consumedFieldIds.add(scoreMatch.field.id);
    if (modMatch) consumedFieldIds.add(modMatch.field.id);
    const score = clampInt(scoreMatch?.field.value, 1, 30, 10);
    const modVal = modMatch
      ? Math.round(evaluation.computedByFieldId[modMatch.field.id]?.value ?? Math.floor((score - 10) / 2))
      : Math.floor((score - 10) / 2);
    abilityModMap.set(ab.key, modVal);
    return {
      key: ab.key,
      label: scoreMatch ? localizeFieldLabel(scoreMatch.field, lang) : ab.labels[lang],
      shortLabel: ab.short[lang],
      score,
      modifier: formatMod(modVal),
      modifierValue: modVal,
    };
  });

  const skillsCard = sheet.cards.find((c) => c.id === 'card_skills');
  const profNumeric = Math.max(0, Math.round(evaluation.variables.prof ?? 2));
  const savingThrows = DND_ABILITIES.map((ab) => {
    const saveKeys = [`save_${ab.key}`, `roll_${ab.short.en.toLowerCase()}_save`, `${ab.key}_save`];
    const saveMatch = skillsCard ? findField([skillsCard], saveKeys) : undefined;
    if (saveMatch) consumedFieldIds.add(saveMatch.field.id);
    const baseMod = abilityModMap.get(ab.key) ?? 0;
    const proficient = Boolean(saveMatch);
    const total = proficient ? baseMod + profNumeric : baseMod;
    return {
      key: ab.key,
      label: ab.labels[lang],
      modifier: formatMod(total),
      proficient,
    };
  });

  const skills18: PaperDndSkillItem[] = DND_SKILLS_18.map((sk) => {
    const m = skillsCard ? findField([skillsCard], [sk.key]) : undefined;
    const rollM = skillsCard ? findField([skillsCard], [`roll_${sk.key}`]) : undefined;
    if (m) consumedFieldIds.add(m.field.id);
    if (rollM) consumedFieldIds.add(rollM.field.id);
    const abShort = DND_ABILITIES.find((a) => a.key === sk.ability)?.short[lang] ?? '';
    const baseMod = abilityModMap.get(sk.ability) ?? 0;
    const val = m && typeof m.field.value === 'number' ? Math.round(m.field.value) : baseMod;
    return {
      key: sk.key,
      label: m ? localizeFieldLabel(m.field, lang) : sk.labels[lang],
      abilityShort: abShort,
      modifier: formatMod(val),
      proficient: Boolean(m),
    };
  });

  if (skillsCard) {
    for (const f of skillsCard.fields) {
      if (!consumedFieldIds.has(f.id) && f.kind === 'roll' && f.id.startsWith('f_roll_')) {
        consumedFieldIds.add(f.id);
      }
    }
  }

  const percSkill = skills18.find((s) => s.key === 'perception');
  const percVal = percSkill ? Number(percSkill.modifier) : (abilityModMap.get('wisdom') ?? 0);
  const passivePerception = 10 + (Number.isFinite(percVal) ? percVal : 0);

  const acMatch = findField(sheet.cards, ['armor_class', 'ac'], 'card_combate');
  const hpMatch = findField(sheet.cards, ['hp', 'pv'], 'card_combate');
  const hdMatch = findField(sheet.cards, ['hit_dice'], 'card_combate');
  const initMatch = findField(sheet.cards, ['initiative'], 'card_combate');
  const inspMatch = findField(sheet.cards, ['inspiration'], 'card_combate');
  const speedMatch = findField(sheet.cards, ['speed', 'deslocamento'], 'card_combate');
  for (const m of [acMatch, hpMatch, hdMatch, initMatch, inspMatch, speedMatch]) {
    if (m) consumedFieldIds.add(m.field.id);
  }

  const combatCard = sheet.cards.find((c) => c.id === 'card_combate');
  const attacks: Array<{ id: string; name: string; expr: string }> = [];
  const classResources: PaperFieldItem[] = [];
  if (combatCard) {
    for (const f of combatCard.fields) {
      if (consumedFieldIds.has(f.id)) continue;
      consumedFieldIds.add(f.id);
      if (f.kind === 'roll') {
        attacks.push({
          id: f.id,
          name: localizeFieldRollLabel(f, lang),
          expr: resolveRollPreview(f.rollExpr ?? '', evaluation.variables),
        });
      } else {
        classResources.push(buildPaperFieldItem(f, evaluation, lang));
      }
    }
  }

  const equipment: PaperFieldItem[] = [];
  const invCard = sheet.cards.find((c) => c.id === 'card_inventario');
  if (invCard) {
    for (const f of invCard.fields) {
      consumedFieldIds.add(f.id);
      equipment.push(buildPaperFieldItem(f, evaluation, lang));
    }
  }

  const currencyCodesByLang: Record<AppLanguage, readonly string[]> = {
    'pt-BR': ['PC', 'PP', 'PE', 'PO', 'PL'],
    en: ['CP', 'SP', 'EP', 'GP', 'PP'],
    es: ['PC', 'PP', 'PE', 'PO', 'PPT'],
  };
  const fallbackKeys = ['cp', 'sp', 'ep', 'gp', 'pp'];
  const currency = currencyCodesByLang[lang].map((code, idx) => {
    const m = findField(sheet.cards, [code.toLowerCase(), fallbackKeys[idx]]);
    if (m) consumedFieldIds.add(m.field.id);
    return { code, value: m?.field.value !== undefined ? String(m.field.value) : '' };
  });

  const arcanoCard = sheet.cards.find((c) => c.id === 'card_arcano');
  const grimorioCard = sheet.cards.find((c) => c.id === 'card_grimorio');
  const spellFields = sheet.cards
    .flatMap((c) => c.fields)
    .filter((f) => /^(spell_dc|spell_atk|slots_|spells|concentration)/i.test(normKey(f.key)));
  const hasSpellcasting = Boolean(
    (arcanoCard && arcanoCard.fields.length > 0) ||
      (grimorioCard && grimorioCard.fields.some((f) => (f.kind === 'repeatable' ? (f.rows?.length ?? 0) > 0 : true))) ||
      spellFields.length > 0,
  );

  let page3: PaperDnd5eModel['page3'] = null;
  if (hasSpellcasting) {
    const dcMatch = findField(sheet.cards, ['spell_dc'], 'card_arcano');
    const atkMatch = findField(sheet.cards, ['spell_atk'], 'card_arcano');
    const concMatch = findField(sheet.cards, ['concentration'], 'card_grimorio');
    for (const m of [dcMatch, atkMatch, concMatch]) {
      if (m) consumedFieldIds.add(m.field.id);
    }

    const slots: PaperTrack[] = [];
    const spellRolls: Array<{ id: string; name: string; expr: string }> = [];
    if (arcanoCard) {
      for (const f of arcanoCard.fields) {
        if (consumedFieldIds.has(f.id)) continue;
        consumedFieldIds.add(f.id);
        if (f.kind === 'resource') {
          slots.push(buildGenericTrack(f, lang));
        } else if (f.kind === 'roll') {
          spellRolls.push({
            id: f.id,
            name: localizeFieldRollLabel(f, lang),
            expr: resolveRollPreview(f.rollExpr ?? '', evaluation.variables),
          });
        }
      }
    }

    const grimoire: PaperFieldItem[] = [];
    if (grimorioCard) {
      for (const f of grimorioCard.fields) {
        if (consumedFieldIds.has(f.id)) continue;
        consumedFieldIds.add(f.id);
        grimoire.push(buildPaperFieldItem(f, evaluation, lang));
      }
    }

    page3 = {
      spellDc: dcMatch ? (evaluation.computedByFieldId[dcMatch.field.id]?.formatted ?? '10') : '—',
      spellAtk: atkMatch ? (evaluation.computedByFieldId[atkMatch.field.id]?.formatted ?? '+0') : '—',
      concentration: Boolean(concMatch?.field.value),
      slots,
      spellRolls,
      grimoire,
    };
  }

  const notesCard = sheet.cards.find((c) => c.id === 'card_notas');
  const notes: Array<{ id: string; label: string; value: string }> = [];
  if (notesCard) {
    for (const f of notesCard.fields) {
      if (f.kind === 'text' || f.kind === 'number') {
        consumedFieldIds.add(f.id);
        notes.push({ id: f.id, label: localizeFieldLabel(f, lang), value: String(f.value ?? '') });
      }
    }
  }

  const extraCards = collectExtraCards(sheet, evaluation, consumedCardIds, consumedFieldIds, lang, false);

  return {
    page1: {
      identityBanner: {
        characterName: charName,
        classLevel: classText ? `${classText} · Lv ${levelStr}` : `Lv ${levelStr}`,
        race: raceText,
        alignment: alignmentText,
        xpTotal: xpSummary.totalEarned,
        proficiencyBonus: profBonus,
      },
      col1: {
        abilities,
        savingThrows,
        skills18,
        passivePerception,
        proficiencies: skills18.filter((s) => s.proficient).map((s) => s.label),
      },
      col2: {
        armorClass: acMatch ? (evaluation.computedByFieldId[acMatch.field.id]?.formatted ?? '10') : '10',
        hitPoints: {
          label: hpMatch ? localizeFieldLabel(hpMatch.field, lang) : labels.hitPoints,
          current: Number(hpMatch?.field.value ?? 0),
          max: Math.max(1, hpMatch?.field.max ?? 10),
          temp: '',
        },
        hitDice: {
          label: hdMatch ? localizeFieldLabel(hdMatch.field, lang) : labels.hitDice,
          current: Number(hdMatch?.field.value ?? 0),
          max: Math.max(1, hdMatch?.field.max ?? 1),
        },
        deathSaves: { successes: 3, failures: 3 },
        attacks,
      },
      col3: {
        inspiration: Boolean(inspMatch?.field.value),
        initiative: initMatch
          ? (evaluation.computedByFieldId[initMatch.field.id]?.formatted ?? formatMod(abilityModMap.get('dexterity') ?? 0))
          : formatMod(abilityModMap.get('dexterity') ?? 0),
        speed: speedMatch?.field.value ? String(speedMatch.field.value) : '9m / 30ft',
        classResources,
        features: [],
        currency,
        equipment,
      },
    },
    page2: {
      notes,
      xpSummary,
      extraCards,
    },
    page3,
  };
}

function buildGenericModel(
  sheet: CharacterSheetState,
  systemId: SystemId,
  evaluation: SheetEvaluation,
  lang: AppLanguage,
): { pages: PaperGenericPage[] } {
  const tabLabels = getLocalizedTabLabels(systemId, lang);
  const toPaperCard = (card: SheetCard): PaperExtraCard => ({
    id: card.id,
    tab: card.tab,
    code: localizeCardTag(card, lang),
    title: localizeCardTitle(card, lang),
    colSpan: (card.colSpan ?? 1) >= 2 ? 2 : 1,
    fields: card.fields.map((f) => buildPaperFieldItem(f, evaluation, lang)),
  });

  const tab1Cards = sheet.cards.filter((c) => c.tab === 'geral').map(toPaperCard);
  const tab2AndXpCards = sheet.cards.filter((c) => c.tab !== 'geral').map(toPaperCard);
  const xpSummary = buildXpSummary(sheet);
  const hasXpActivity = xpSummary.totalEarned > 0 || xpSummary.spent > 0 || xpSummary.recentEntries.length > 0;

  const pages: PaperGenericPage[] = [
    {
      pageNumber: 1,
      tabLabel: localizeTabTitle({ id: 'geral', title: tabLabels.tab1, systemId }, lang),
      cards: tab1Cards,
    },
  ];

  if (tab2AndXpCards.length > 0 || hasXpActivity) {
    pages.push({
      pageNumber: 2,
      tabLabel: localizeTabTitle({ id: 'magias', title: tabLabels.tab2, systemId }, lang),
      cards: tab2AndXpCards,
      xpSummary,
    });
  }

  return { pages };
}

export function buildPaperSheetModel(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): PaperSheetModel {
  const systemId = detectSystemId(sheet);
  const layout = detectPaperSheetLayout(sheet);
  const evaluation = evaluateSheet(sheet);
  const labels = PAPER_LABELS[lang];
  const systemName = localizeSystemName(systemId, sheet.systemName, lang);
  const systemCode = localizeSystemName(systemId, sheet.systemCode, lang);
  const characterName = resolvePaperCharacterName(sheet);
  const consumedCardIds = new Set<string>();
  const consumedFieldIds = new Set<string>();

  const editorialHeader =
    layout === 'generic'
      ? { title: systemName, subtitle: systemCode }
      : EDITORIAL_HEADERS[layout][lang];

  const rollLogs = sheet.rollLogs.slice(-8).map((log) => ({
    id: log.id,
    label: localizeFieldRollLabel({ label: log.label }, lang),
    timestamp: log.timestamp,
    total: log.total,
    breakdown: log.breakdown,
  }));

  if (layout === 'wod-v5') {
    const wodV5 = buildWodV5Model(sheet, evaluation, consumedCardIds, consumedFieldIds, lang);
    return {
      layout,
      systemId,
      systemName,
      systemCode,
      sheetTitle: editorialHeader.title,
      sheetSubtitle: editorialHeader.subtitle,
      characterName,
      lang,
      pageCount: 2,
      labels,
      rollLogs,
      wodV5,
    };
  }

  if (layout === 'wod-v20') {
    const wodV20 = buildWodV20Model(sheet, evaluation, consumedCardIds, consumedFieldIds, lang);
    return {
      layout,
      systemId,
      systemName,
      systemCode,
      sheetTitle: editorialHeader.title,
      sheetSubtitle: editorialHeader.subtitle,
      characterName,
      lang,
      pageCount: 2,
      labels,
      rollLogs,
      wodV20,
    };
  }

  if (layout === 'dnd5e') {
    const dnd5e = buildDnd5eModel(sheet, evaluation, consumedCardIds, consumedFieldIds, lang);
    return {
      layout,
      systemId,
      systemName,
      systemCode,
      sheetTitle: editorialHeader.title,
      sheetSubtitle: editorialHeader.subtitle,
      characterName,
      lang,
      pageCount: dnd5e.page3 ? 3 : 2,
      labels,
      rollLogs,
      dnd5e,
    };
  }

  const generic = buildGenericModel(sheet, systemId, evaluation, lang);
  return {
    layout,
    systemId,
    systemName,
    systemCode,
    sheetTitle: editorialHeader.title,
    sheetSubtitle: editorialHeader.subtitle,
    characterName,
    lang,
    pageCount: generic.pages.length,
    labels,
    rollLogs,
    generic,
  };
}
