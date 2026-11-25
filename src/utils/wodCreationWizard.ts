import { getBloodPoolMaxByGeneration, type WodEdition } from '../core/sheetModel.ts';
import type {
  CharacterSheetState,
  HavenEntry,
  MeritFlawEntry,
  RepeatableRow,
  SheetCard,
  SheetField,
  TouchstoneEntry,
  VirtuesState,
} from '../core/sheetModel.ts';
import type { AppLanguage } from '../core/i18n.ts';
import {
  buildCatalogDisciplineField,
  buildCatalogPowerRow,
  findClanByIdOrName,
  findDisciplineByIdOrName,
  getClansForEdition,
  getDisciplinesForEdition,
  resolveDisciplineAffinity,
  type WodClanCatalogEntry,
  type WodDisciplineCatalogEntry,
} from '../core/wodClansDisciplinesCatalog.ts';
import {
  buildCatalogSkillFields,
  getWodSkillsCatalog,
  type V20SkillCategory,
  type WodCatalogSkill,
} from '../core/wodSkillsCatalog.ts';
import {
  buildCatalogAdvantageField,
  findAdvantageByIdOrName,
  findHavenTraitByIdOrName,
  getAdvantagesForEdition,
  getFlawsForEdition,
} from '../core/wodAdvantagesCatalog.ts';

export const WOD_WIZARD_CUSTOM_VALUE = '__custom__' as const;

export type WodWizardStep = 1 | 2 | 3 | 4;
export type WodAttributeGroup = 'physical' | 'social' | 'mental';
export type V20SkillGroup = V20SkillCategory;
export type V20PriorityTier = 'primary' | 'secondary' | 'tertiary';
export type V5SkillArrayId = 'jack-of-all-trades' | 'balanced' | 'specialist';

export interface WodPredatorTypeEntry {
  readonly id: string;
  readonly name: Readonly<Record<AppLanguage, string>>;
  readonly disciplineOptions: readonly string[];
  readonly specialtyHint: Readonly<Record<AppLanguage, string>>;
  readonly humanityMod: -1 | 0 | 1;
}

export const WOD_V5_PREDATOR_TYPES: readonly WodPredatorTypeEntry[] = [
  {
    id: 'alleycat',
    name: {
      'pt-BR': 'Predador de Beco (Alleycat)',
      en: 'Alleycat',
      es: 'Callejero (Alleycat)',
    },
    disciplineOptions: ['celerity', 'potence'],
    specialtyHint: {
      'pt-BR': 'Intimidação (Assalto) ou Briga (Agarrar)',
      en: 'Intimidation (Stickups) or Brawl (Grappling)',
      es: 'Intimidación (Atracos) o Pelea (Presas)',
    },
    humanityMod: -1,
  },
  {
    id: 'bagger',
    name: {
      'pt-BR': 'Ensacador (Bagger)',
      en: 'Bagger',
      es: 'Saqueador de Bolsas (Bagger)',
    },
    disciplineOptions: ['blood_sorcery', 'obfuscate'],
    specialtyHint: {
      'pt-BR': 'Furto (Arrombamento) ou Manha (Mercado Negro)',
      en: 'Larceny (Lockpicking) or Streetwise (Black Market)',
      es: 'Latrocinio (Ganzúas) o Callejear (Mercado Negro)',
    },
    humanityMod: 0,
  },
  {
    id: 'blood_leech',
    name: {
      'pt-BR': 'Sanguessuga (Blood Leech)',
      en: 'Blood Leech',
      es: 'Sanguijuela (Blood Leech)',
    },
    disciplineOptions: ['celerity', 'protean'],
    specialtyHint: {
      'pt-BR': 'Briga (Membros) ou Furtividade (Membros)',
      en: 'Brawl (Kindred) or Stealth (Kindred)',
      es: 'Pelea (Vástagos) o Sigilo (Vástagos)',
    },
    humanityMod: -1,
  },
  {
    id: 'cleaver',
    name: {
      'pt-BR': 'Cutelo (Cleaver)',
      en: 'Cleaver',
      es: 'Carnicero (Cleaver)',
    },
    disciplineOptions: ['animalism', 'dominate'],
    specialtyHint: {
      'pt-BR': 'Persuasão (Manipulação) ou Lábia (Encobrimento)',
      en: 'Persuasion (Gaslighting) or Subterfuge (Coverups)',
      es: 'Persuasión (Manipulación) o Subterfugio (Encubrimiento)',
    },
    humanityMod: 0,
  },
  {
    id: 'consensualist',
    name: {
      'pt-BR': 'Consensualista (Consensualist)',
      en: 'Consensualist',
      es: 'Consensualista (Consensualist)',
    },
    disciplineOptions: ['auspex', 'fortitude'],
    specialtyHint: {
      'pt-BR': 'Medicina (Flebotomia) ou Persuasão (Vítimas)',
      en: 'Medicine (Phlebotomy) or Persuasion (Vessels)',
      es: 'Medicina (Flebotomía) o Persuasión (Recipientes)',
    },
    humanityMod: 1,
  },
  {
    id: 'farmer',
    name: {
      'pt-BR': 'Fazendeiro (Farmer)',
      en: 'Farmer',
      es: 'Granjero (Farmer)',
    },
    disciplineOptions: ['animalism', 'protean'],
    specialtyHint: {
      'pt-BR': 'Empatia com Animais (Fazenda) ou Sobrevivência (Caça)',
      en: 'Animal Ken (Specific Animal) or Survival (Hunting)',
      es: 'Trato con Animales (Granja) o Supervivencia (Caza)',
    },
    humanityMod: 1,
  },
  {
    id: 'osiris',
    name: {
      'pt-BR': 'Osíris (Osiris)',
      en: 'Osiris',
      es: 'Osiris (Osiris)',
    },
    disciplineOptions: ['blood_sorcery', 'presence'],
    specialtyHint: {
      'pt-BR': 'Ocultismo (Tradição) ou Performance (Rebanho)',
      en: 'Occult (Specific Tradition) or Performance (Specific Field)',
      es: 'Ocultismo (Tradición) o Interpretación (Culto)',
    },
    humanityMod: 0,
  },
  {
    id: 'sandman',
    name: {
      'pt-BR': 'Sandman',
      en: 'Sandman',
      es: 'Sandman',
    },
    disciplineOptions: ['auspex', 'obfuscate'],
    specialtyHint: {
      'pt-BR': 'Medicina (Anestésicos) ou Furtividade (Arrombamento)',
      en: 'Medicine (Anesthetics) or Stealth (Break-in)',
      es: 'Medicina (Anestésicos) o Sigilo (Allanamiento)',
    },
    humanityMod: 0,
  },
  {
    id: 'scene_queen',
    name: {
      'pt-BR': 'Rainha da Cena (Scene Queen)',
      en: 'Scene Queen',
      es: 'Reina de la Escena (Scene Queen)',
    },
    disciplineOptions: ['dominate', 'potence'],
    specialtyHint: {
      'pt-BR': 'Etiqueta (Subcultura) ou Liderança (Cena)',
      en: 'Etiquette (Specific Scene) or Leadership (Specific Scene)',
      es: 'Etiqueta (Subcultura) o Liderazgo (Escena)',
    },
    humanityMod: 0,
  },
  {
    id: 'siren',
    name: {
      'pt-BR': 'Sereia (Siren)',
      en: 'Siren',
      es: 'Sirena (Siren)',
    },
    disciplineOptions: ['fortitude', 'presence'],
    specialtyHint: {
      'pt-BR': 'Persuasão (Sedução) ou Lábia (Sedução)',
      en: 'Persuasion (Seduction) or Subterfuge (Seduction)',
      es: 'Persuasión (Seducción) o Subterfugio (Seducción)',
    },
    humanityMod: 0,
  },
];

export interface WodWizardAttributeDef {
  readonly key: string;
  readonly group: WodAttributeGroup;
  readonly labels: Readonly<Record<AppLanguage, string>>;
}

export const WOD_ATTRIBUTE_GROUPS_BY_EDITION: Readonly<
  Record<WodEdition, Readonly<Record<WodAttributeGroup, readonly WodWizardAttributeDef[]>>>
> = {
  'vampire-v5': {
    physical: [
      { key: 'strength', group: 'physical', labels: { 'pt-BR': 'Força', en: 'Strength', es: 'Fuerza' } },
      { key: 'dexterity', group: 'physical', labels: { 'pt-BR': 'Destreza', en: 'Dexterity', es: 'Destreza' } },
      { key: 'stamina', group: 'physical', labels: { 'pt-BR': 'Vigor', en: 'Stamina', es: 'Resistencia' } },
    ],
    social: [
      { key: 'charisma', group: 'social', labels: { 'pt-BR': 'Carisma', en: 'Charisma', es: 'Carisma' } },
      { key: 'manipulation', group: 'social', labels: { 'pt-BR': 'Manipulação', en: 'Manipulation', es: 'Manipulación' } },
      { key: 'composure', group: 'social', labels: { 'pt-BR': 'Compostura', en: 'Composure', es: 'Compostura' } },
    ],
    mental: [
      { key: 'intelligence', group: 'mental', labels: { 'pt-BR': 'Inteligência', en: 'Intelligence', es: 'Inteligencia' } },
      { key: 'wits', group: 'mental', labels: { 'pt-BR': 'Raciocínio', en: 'Wits', es: 'Astucia' } },
      { key: 'resolve', group: 'mental', labels: { 'pt-BR': 'Determinação', en: 'Resolve', es: 'Resolución' } },
    ],
  },
  'storyteller-v20': {
    physical: [
      { key: 'strength', group: 'physical', labels: { 'pt-BR': 'Força', en: 'Strength', es: 'Fuerza' } },
      { key: 'dexterity', group: 'physical', labels: { 'pt-BR': 'Destreza', en: 'Dexterity', es: 'Destreza' } },
      { key: 'stamina', group: 'physical', labels: { 'pt-BR': 'Vigor', en: 'Stamina', es: 'Resistencia' } },
    ],
    social: [
      { key: 'charisma', group: 'social', labels: { 'pt-BR': 'Carisma', en: 'Charisma', es: 'Carisma' } },
      { key: 'manipulation', group: 'social', labels: { 'pt-BR': 'Manipulação', en: 'Manipulation', es: 'Manipulación' } },
      { key: 'appearance', group: 'social', labels: { 'pt-BR': 'Aparência', en: 'Appearance', es: 'Apariencia' } },
    ],
    mental: [
      { key: 'perception', group: 'mental', labels: { 'pt-BR': 'Percepção', en: 'Perception', es: 'Percepción' } },
      { key: 'intelligence', group: 'mental', labels: { 'pt-BR': 'Inteligência', en: 'Intelligence', es: 'Inteligencia' } },
      { key: 'wits', group: 'mental', labels: { 'pt-BR': 'Raciocínio', en: 'Wits', es: 'Astucia' } },
    ],
  },
};

export const V5_ATTRIBUTE_TARGET_COUNTS: Readonly<Record<4 | 3 | 2 | 1, number>> = {
  4: 1,
  3: 3,
  2: 4,
  1: 1,
};

export const V20_ATTRIBUTE_PRIORITY_BUDGETS: Readonly<Record<V20PriorityTier, number>> = {
  primary: 7,
  secondary: 5,
  tertiary: 3,
};

export interface V5SkillArraySpec {
  readonly id: V5SkillArrayId;
  readonly maxDot: 3 | 4;
  readonly targetCounts: Readonly<Record<4 | 3 | 2 | 1, number>>;
  readonly totalSkills: number;
  readonly totalPoints: number;
}

export const V5_SKILL_ARRAYS: Readonly<Record<V5SkillArrayId, V5SkillArraySpec>> = {
  'jack-of-all-trades': {
    id: 'jack-of-all-trades',
    maxDot: 3,
    targetCounts: { 4: 0, 3: 1, 2: 8, 1: 10 },
    totalSkills: 19,
    totalPoints: 29,
  },
  balanced: {
    id: 'balanced',
    maxDot: 3,
    targetCounts: { 4: 0, 3: 3, 2: 5, 1: 7 },
    totalSkills: 15,
    totalPoints: 26,
  },
  specialist: {
    id: 'specialist',
    maxDot: 4,
    targetCounts: { 4: 1, 3: 3, 2: 3, 1: 3 },
    totalSkills: 10,
    totalPoints: 22,
  },
};

export const V20_SKILL_PRIORITY_BUDGETS: Readonly<Record<V20PriorityTier, number>> = {
  primary: 13,
  secondary: 9,
  tertiary: 5,
};

export const V20_SKILL_CREATION_CAP = 3;
export const V5_FREE_SPECIALTY_SKILL_KEYS = new Set([
  'academics',
  'crafts',
  'performance',
  'science',
]);

export const WOD_DISCIPLINE_CREATION_BUDGET = 3;
export const V5_ADVANTAGES_BUDGET = 7;
export const V5_FLAWS_BUDGET = 2;
export const V5_TOUCHSTONES_MIN = 1;
export const V5_TOUCHSTONES_MAX = 3;
export const V20_BACKGROUNDS_BUDGET = 5;
export const V20_VIRTUES_EXTRA_BUDGET = 7;

export interface WizardHavenDraft {
  name: string;
  location: string;
  rating: number;
  traits: string[];
  notes: string;
}

export interface WodCreationWizardState {
  edition: WodEdition;
  strictRules: boolean;
  currentStep: WodWizardStep;
  // Step 1
  clanId: string;
  customClanName: string;
  name: string;
  concept: string;
  sire: string;
  chronicle: string;
  generation: number;
  predatorTypeId: string;
  customPredatorType: string;
  ambition: string;
  desire: string;
  nature: string;
  demeanor: string;
  // Step 2
  attributes: Record<string, number>;
  v20AttributePriorities: Record<WodAttributeGroup, V20PriorityTier>;
  // Step 3
  v5SkillArray: V5SkillArrayId;
  v20SkillPriorities: Record<V20SkillGroup, V20PriorityTier>;
  skills: Record<string, number>;
  skillSpecialties: Record<string, string>;
  // Step 4
  disciplines: Record<string, number>;
  selectedPowers: Record<string, string[]>;
  backgrounds: Record<string, number>;
  meritsFlaws: MeritFlawEntry[];
  haven: WizardHavenDraft;
  virtues: VirtuesState;
  touchstones: TouchstoneEntry[];
}

export function getEditionAttributeKeys(edition: WodEdition): string[] {
  const groups = WOD_ATTRIBUTE_GROUPS_BY_EDITION[edition];
  return [
    ...groups.physical.map((a) => a.key),
    ...groups.social.map((a) => a.key),
    ...groups.mental.map((a) => a.key),
  ];
}

function buildInitialAttributes(edition: WodEdition): Record<string, number> {
  const map: Record<string, number> = {};
  for (const key of getEditionAttributeKeys(edition)) {
    map[key] = 1;
  }
  return map;
}

export function clampGenerationForEdition(edition: WodEdition, generation: number): number {
  const rounded = Number.isFinite(generation) ? Math.round(generation) : 13;
  if (edition === 'storyteller-v20') {
    return Math.max(7, Math.min(15, rounded));
  }
  return Math.max(10, Math.min(16, rounded));
}

export function createInitialWodWizardState(
  edition: WodEdition = 'vampire-v5',
): WodCreationWizardState {
  return {
    edition,
    strictRules: true,
    currentStep: 1,
    clanId: '',
    customClanName: '',
    name: '',
    concept: '',
    sire: '',
    chronicle: '',
    generation: 13,
    predatorTypeId: '',
    customPredatorType: '',
    ambition: '',
    desire: '',
    nature: '',
    demeanor: '',
    attributes: buildInitialAttributes(edition),
    v20AttributePriorities: {
      physical: 'primary',
      social: 'secondary',
      mental: 'tertiary',
    },
    v5SkillArray: 'balanced',
    v20SkillPriorities: {
      talents: 'primary',
      skills: 'secondary',
      knowledges: 'tertiary',
    },
    skills: {},
    skillSpecialties: {},
    disciplines: {},
    selectedPowers: {},
    backgrounds: {},
    meritsFlaws: [],
    haven: {
      name: '',
      location: '',
      rating: 0,
      traits: [],
      notes: '',
    },
    virtues: {
      conscience: 1,
      selfControl: 1,
      courage: 1,
    },
    touchstones: [],
  };
}

export function findPredatorTypeById(id: string): WodPredatorTypeEntry | null {
  if (!id || id === WOD_WIZARD_CUSTOM_VALUE) return null;
  return WOD_V5_PREDATOR_TYPES.find((p) => p.id === id) ?? null;
}

export function getResolvedWizardClan(
  state: Pick<WodCreationWizardState, 'edition' | 'clanId' | 'customClanName'>,
): {
  clanEntry: WodClanCatalogEntry | null;
  isCustom: boolean;
  allowsFreeDisciplines: boolean;
  isThinBlood: boolean;
} {
  if (state.clanId === WOD_WIZARD_CUSTOM_VALUE) {
    return {
      clanEntry: null,
      isCustom: true,
      allowsFreeDisciplines: true,
      isThinBlood: false,
    };
  }
  const clanEntry = state.clanId ? findClanByIdOrName(state.clanId, state.edition) : null;
  const isThinBlood = Boolean(clanEntry && 'isThinBlood' in clanEntry && clanEntry.isThinBlood);
  const allowsFreeDisciplines = Boolean(clanEntry?.isCaitiff || isThinBlood);
  return {
    clanEntry,
    isCustom: false,
    allowsFreeDisciplines,
    isThinBlood,
  };
}

export function resolveWizardClanName(
  state: Pick<WodCreationWizardState, 'edition' | 'clanId' | 'customClanName'>,
  lang: AppLanguage,
): string {
  if (state.clanId === WOD_WIZARD_CUSTOM_VALUE) {
    return state.customClanName.trim();
  }
  const match = state.clanId ? findClanByIdOrName(state.clanId, state.edition) : null;
  return match ? match.name[lang] : '';
}

export function resolveWizardPredatorName(
  state: Pick<WodCreationWizardState, 'predatorTypeId' | 'customPredatorType'>,
  lang: AppLanguage,
): string {
  if (state.predatorTypeId === WOD_WIZARD_CUSTOM_VALUE) {
    return state.customPredatorType.trim();
  }
  const match = findPredatorTypeById(state.predatorTypeId);
  return match ? match.name[lang] : '';
}

export function getV5InitialBloodPotency(
  state: Pick<WodCreationWizardState, 'edition' | 'clanId' | 'customClanName'>,
): number {
  if (state.edition !== 'vampire-v5') return 1;
  const { isThinBlood } = getResolvedWizardClan(state);
  return isThinBlood ? 0 : 1;
}

export function getV5InitialHumanity(
  state: Pick<WodCreationWizardState, 'predatorTypeId'>,
): number {
  const pred = findPredatorTypeById(state.predatorTypeId);
  const mod = pred?.humanityMod ?? 0;
  return Math.max(1, Math.min(10, 7 + mod));
}

export function getSuggestedFreeSpecialtySkills(
  state: Pick<WodCreationWizardState, 'edition' | 'skills'>,
): string[] {
  if (state.edition !== 'vampire-v5') return [];
  return Array.from(V5_FREE_SPECIALTY_SKILL_KEYS).filter(
    (varName) => (state.skills[varName] ?? 0) > 0,
  );
}

export function setWizardEdition(
  state: WodCreationWizardState,
  nextEdition: WodEdition,
): WodCreationWizardState {
  if (state.edition === nextEdition) return state;

  const nextKeys = getEditionAttributeKeys(nextEdition);
  const nextAttrs: Record<string, number> = {};
  for (const key of nextKeys) {
    const prevVal = state.attributes[key];
    const maxAllowed = nextEdition === 'vampire-v5' && state.strictRules ? 4 : 5;
    nextAttrs[key] =
      typeof prevVal === 'number' && Number.isFinite(prevVal)
        ? Math.max(1, Math.min(maxAllowed, Math.round(prevVal)))
        : 1;
  }

  let nextClanId = state.clanId;
  if (nextClanId && nextClanId !== WOD_WIZARD_CUSTOM_VALUE) {
    const compatible = getClansForEdition(nextEdition).some((c) => c.id === nextClanId);
    if (!compatible) nextClanId = '';
  }

  let nextGen = clampGenerationForEdition(nextEdition, state.generation);
  if (nextEdition === 'vampire-v5' && nextClanId === 'thin_blood' && nextGen < 14) {
    nextGen = 14;
  } else if (nextEdition === 'storyteller-v20' && nextGen > 15) {
    nextGen = 13;
  }

  return {
    ...state,
    edition: nextEdition,
    clanId: nextClanId,
    generation: nextGen,
    attributes: nextAttrs,
    skills: {},
    skillSpecialties: {},
    disciplines: {},
    selectedPowers: {},
    backgrounds: {},
    meritsFlaws: [],
    haven: {
      ...state.haven,
      traits: [],
    },
    ...(nextEdition === 'storyteller-v20'
      ? { virtues: { conscience: 1, selfControl: 1, courage: 1 } }
      : {}),
  };
}

export function setWizardClan(
  state: WodCreationWizardState,
  nextClanId: string,
): WodCreationWizardState {
  let nextGeneration = state.generation;
  if (state.edition === 'vampire-v5') {
    if (nextClanId === 'thin_blood' && state.generation === 13) {
      nextGeneration = 14;
    } else if (state.clanId === 'thin_blood' && nextClanId !== 'thin_blood' && state.generation === 14) {
      nextGeneration = 13;
    }
  }
  return {
    ...state,
    clanId: nextClanId,
    customClanName: nextClanId === WOD_WIZARD_CUSTOM_VALUE ? state.customClanName : '',
    generation: clampGenerationForEdition(state.edition, nextGeneration),
  };
}

export function assignV20AttributePriority(
  state: WodCreationWizardState,
  group: WodAttributeGroup,
  tier: V20PriorityTier,
): WodCreationWizardState {
  const currentTier = state.v20AttributePriorities[group];
  if (currentTier === tier) return state;

  const swapTarget = (Object.keys(state.v20AttributePriorities) as WodAttributeGroup[]).find(
    (g) => g !== group && state.v20AttributePriorities[g] === tier,
  );
  if (!swapTarget) return state;

  return {
    ...state,
    v20AttributePriorities: {
      ...state.v20AttributePriorities,
      [group]: tier,
      [swapTarget]: currentTier,
    },
  };
}

export function assignV20SkillPriority(
  state: WodCreationWizardState,
  group: V20SkillGroup,
  tier: V20PriorityTier,
): WodCreationWizardState {
  const currentTier = state.v20SkillPriorities[group];
  if (currentTier === tier) return state;

  const swapTarget = (Object.keys(state.v20SkillPriorities) as V20SkillGroup[]).find(
    (g) => g !== group && state.v20SkillPriorities[g] === tier,
  );
  if (!swapTarget) return state;

  return {
    ...state,
    v20SkillPriorities: {
      ...state.v20SkillPriorities,
      [group]: tier,
      [swapTarget]: currentTier,
    },
  };
}

export function setWizardAttribute(
  state: WodCreationWizardState,
  key: string,
  value: number,
): WodCreationWizardState {
  const validKeys = new Set(getEditionAttributeKeys(state.edition));
  if (!validKeys.has(key)) return state;
  const maxDot = state.edition === 'vampire-v5' && state.strictRules ? 4 : 5;
  const clamped = Number.isFinite(value)
    ? Math.max(1, Math.min(maxDot, Math.round(value)))
    : 1;
  return {
    ...state,
    attributes: {
      ...state.attributes,
      [key]: clamped,
    },
  };
}

export function setWizardSkill(
  state: WodCreationWizardState,
  varName: string,
  value: number,
): WodCreationWizardState {
  const catalogSkill = getWodSkillsCatalog(state.edition).find((s) => s.varName === varName);
  if (!catalogSkill) return state;

  const maxDot = !state.strictRules
    ? 5
    : state.edition === 'storyteller-v20'
      ? V20_SKILL_CREATION_CAP
      : V5_SKILL_ARRAYS[state.v5SkillArray].maxDot;
  const clamped = Number.isFinite(value)
    ? Math.max(0, Math.min(maxDot, Math.round(value)))
    : 0;

  const nextSkills = { ...state.skills };
  if (clamped <= 0) {
    delete nextSkills[varName];
  } else {
    nextSkills[varName] = clamped;
  }

  return {
    ...state,
    skills: nextSkills,
  };
}

export function setWizardSkillSpecialty(
  state: WodCreationWizardState,
  varName: string,
  specialty: string,
): WodCreationWizardState {
  const next = { ...state.skillSpecialties };
  if (specialty.length === 0) {
    delete next[varName];
  } else {
    next[varName] = specialty.slice(0, 120);
  }
  return {
    ...state,
    skillSpecialties: next,
  };
}

export function setWizardDiscipline(
  state: WodCreationWizardState,
  disciplineId: string,
  value: number,
): WodCreationWizardState {
  const disc = getDisciplinesForEdition(state.edition).find((d) => d.id === disciplineId);
  if (!disc) return state;

  const { clanEntry, allowsFreeDisciplines } = getResolvedWizardClan(state);
  const isStandardV5Clan =
    state.edition === 'vampire-v5' && state.strictRules && !allowsFreeDisciplines;
  const maxDot = !state.strictRules ? 5 : isStandardV5Clan ? 2 : 3;

  const clamped = Number.isFinite(value)
    ? Math.max(0, Math.min(maxDot, Math.round(value)))
    : 0;

  const nextDisciplines = { ...state.disciplines };
  if (clamped <= 0) {
    delete nextDisciplines[disciplineId];
  } else {
    nextDisciplines[disciplineId] = clamped;
  }

  // Prune selected powers whose level exceeds the new rating or exceed count
  const prevPowers = state.selectedPowers[disciplineId] ?? [];
  const validPowerIds = new Set(
    disc.powers.filter((p) => p.level <= clamped).map((p) => p.id),
  );
  let filteredPowers = prevPowers.filter((pid) => validPowerIds.has(pid));
  if (state.strictRules && filteredPowers.length > clamped) {
    filteredPowers = filteredPowers.slice(0, clamped);
  }

  const nextSelectedPowers = { ...state.selectedPowers };
  if (filteredPowers.length === 0) {
    delete nextSelectedPowers[disciplineId];
  } else {
    nextSelectedPowers[disciplineId] = filteredPowers;
  }

  // Avoid unused import warning while verifying clan context
  void clanEntry;

  return {
    ...state,
    disciplines: nextDisciplines,
    selectedPowers: nextSelectedPowers,
  };
}

export function toggleWizardDisciplinePower(
  state: WodCreationWizardState,
  disciplineId: string,
  powerId: string,
): WodCreationWizardState {
  const disc = getDisciplinesForEdition(state.edition).find((d) => d.id === disciplineId);
  if (!disc) return state;
  const dots = state.disciplines[disciplineId] ?? 0;
  if (dots <= 0) return state;

  const power = disc.powers.find((p) => p.id === powerId);
  if (!power || power.level > dots) return state;

  const current = state.selectedPowers[disciplineId] ?? [];
  if (current.includes(powerId)) {
    const nextList = current.filter((id) => id !== powerId);
    const nextMap = { ...state.selectedPowers };
    if (nextList.length === 0) delete nextMap[disciplineId];
    else nextMap[disciplineId] = nextList;
    return { ...state, selectedPowers: nextMap };
  }

  if (state.strictRules && current.length >= dots) {
    return state;
  }

  return {
    ...state,
    selectedPowers: {
      ...state.selectedPowers,
      [disciplineId]: [...current, powerId],
    },
  };
}

export function setWizardBackground(
  state: WodCreationWizardState,
  advantageId: string,
  value: number,
): WodCreationWizardState {
  // Haven rating lives exclusively on state.haven.rating to prevent duplicate Haven fields.
  if (advantageId === 'haven') return state;
  const adv = getAdvantagesForEdition(state.edition, 'background').find(
    (item) => item.id === advantageId,
  );
  if (!adv) return state;

  const maxDots = Math.max(1, Math.min(5, adv.maxDots));
  const clamped = Number.isFinite(value)
    ? Math.max(0, Math.min(maxDots, Math.round(value)))
    : 0;

  const next = { ...state.backgrounds };
  if (clamped <= 0) {
    delete next[advantageId];
  } else {
    next[advantageId] = clamped;
  }
  return {
    ...state,
    backgrounds: next,
  };
}

export function toggleWizardHavenTrait(
  state: WodCreationWizardState,
  traitId: string,
): WodCreationWizardState {
  const exists = state.haven.traits.includes(traitId);
  const nextTraits = exists
    ? state.haven.traits.filter((id) => id !== traitId)
    : [...state.haven.traits, traitId];
  return {
    ...state,
    haven: {
      ...state.haven,
      traits: nextTraits,
    },
  };
}

export interface Step2AttributeSummary {
  edition: WodEdition;
  v5Counts: Record<1 | 2 | 3 | 4 | 5, number>;
  v5RemainingSlots: Record<4 | 3 | 2 | 1, number>;
  v5OverCapCount: number;
  v5PointsSpent: number;
  v5PointsTarget: number;
  v20Groups: Array<{
    group: WodAttributeGroup;
    tier: V20PriorityTier;
    budget: number;
    spent: number;
    remaining: number;
  }>;
}

export function getStep2AttributeSummary(
  state: Pick<WodCreationWizardState, 'edition' | 'attributes' | 'v20AttributePriorities'>,
): Step2AttributeSummary {
  const groups = WOD_ATTRIBUTE_GROUPS_BY_EDITION[state.edition];
  const v5Counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let v5PointsSpent = 0;

  for (const key of getEditionAttributeKeys(state.edition)) {
    const raw = state.attributes[key];
    const val = Math.max(1, Math.min(5, Number.isFinite(raw) ? Math.round(raw) : 1)) as
      | 1
      | 2
      | 3
      | 4
      | 5;
    v5Counts[val] += 1;
    v5PointsSpent += val - 1;
  }

  const v5RemainingSlots: Record<4 | 3 | 2 | 1, number> = {
    4: V5_ATTRIBUTE_TARGET_COUNTS[4] - v5Counts[4],
    3: V5_ATTRIBUTE_TARGET_COUNTS[3] - v5Counts[3],
    2: V5_ATTRIBUTE_TARGET_COUNTS[2] - v5Counts[2],
    1: V5_ATTRIBUTE_TARGET_COUNTS[1] - v5Counts[1],
  };

  const v20Groups = (['physical', 'social', 'mental'] as const).map((group) => {
    const tier = state.v20AttributePriorities[group];
    const budget = V20_ATTRIBUTE_PRIORITY_BUDGETS[tier];
    const spent = groups[group].reduce((sum, attr) => {
      const val = Math.max(1, Math.min(5, Math.round(state.attributes[attr.key] ?? 1)));
      return sum + (val - 1);
    }, 0);
    return {
      group,
      tier,
      budget,
      spent,
      remaining: budget - spent,
    };
  });

  return {
    edition: state.edition,
    v5Counts,
    v5RemainingSlots,
    v5OverCapCount: v5Counts[5],
    v5PointsSpent,
    v5PointsTarget: 13,
    v20Groups,
  };
}

export interface Step3SkillSummary {
  edition: WodEdition;
  v5ArraySpec: V5SkillArraySpec;
  v5Counts: Record<1 | 2 | 3 | 4 | 5, number>;
  v5RemainingSlots: Record<4 | 3 | 2 | 1, number>;
  v5OverCapCount: number;
  v5SkillsWithDots: number;
  v20Groups: Array<{
    group: V20SkillGroup;
    tier: V20PriorityTier;
    budget: number;
    spent: number;
    remaining: number;
    overCapKeys: string[];
  }>;
  freeSpecialtySkills: string[];
}

export function getStep3SkillSummary(
  state: Pick<WodCreationWizardState, 'edition' | 'v5SkillArray' | 'v20SkillPriorities' | 'skills'>,
): Step3SkillSummary {
  const catalog = getWodSkillsCatalog(state.edition);
  const spec = V5_SKILL_ARRAYS[state.v5SkillArray];
  const v5Counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let v5SkillsWithDots = 0;

  for (const skill of catalog) {
    const val = Math.max(0, Math.min(5, Math.round(state.skills[skill.varName] ?? 0)));
    if (val > 0) {
      v5Counts[val as 1 | 2 | 3 | 4 | 5] += 1;
      v5SkillsWithDots += 1;
    }
  }

  const v5RemainingSlots: Record<4 | 3 | 2 | 1, number> = {
    4: spec.targetCounts[4] - v5Counts[4],
    3: spec.targetCounts[3] - v5Counts[3],
    2: spec.targetCounts[2] - v5Counts[2],
    1: spec.targetCounts[1] - v5Counts[1],
  };

  const v5OverCapCount =
    v5Counts[5] + (spec.maxDot < 4 ? v5Counts[4] : 0);

  const v20Groups = (['talents', 'skills', 'knowledges'] as const).map((group) => {
    const tier = state.v20SkillPriorities[group];
    const budget = V20_SKILL_PRIORITY_BUDGETS[tier];
    const groupSkills = catalog.filter((s) => s.category === group);
    let spent = 0;
    const overCapKeys: string[] = [];
    for (const s of groupSkills) {
      const val = Math.max(0, Math.min(5, Math.round(state.skills[s.varName] ?? 0)));
      spent += val;
      if (val > V20_SKILL_CREATION_CAP) {
        overCapKeys.push(s.varName);
      }
    }
    return {
      group,
      tier,
      budget,
      spent,
      remaining: budget - spent,
      overCapKeys,
    };
  });

  return {
    edition: state.edition,
    v5ArraySpec: spec,
    v5Counts,
    v5RemainingSlots,
    v5OverCapCount,
    v5SkillsWithDots,
    v20Groups,
    freeSpecialtySkills: getSuggestedFreeSpecialtySkills(state),
  };
}

export interface Step4DossierSummary {
  edition: WodEdition;
  disciplinesTotal: number;
  disciplinesTarget: number;
  allowsFreeDisciplines: boolean;
  outOfClanDots: number;
  hasValidV5Split: boolean;
  powerGaps: Array<{ disciplineId: string; selected: number; required: number }>;
  backgroundsTotal: number;
  v5MeritsTotal: number;
  v5HavenRating: number;
  v5AdvantagesTotal: number;
  v5AdvantagesTarget: number;
  v5FlawsListTotal: number;
  v5HavenFlawsTotal: number;
  v5FlawsTotal: number;
  v5FlawsTarget: number;
  v5TouchstonesValidCount: number;
  v5BloodPotency: number;
  v5Humanity: number;
  v20BackgroundsTarget: number;
  v20VirtuesExtraSpent: number;
  v20VirtuesExtraTarget: number;
  v20DerivedHumanity: number;
  v20DerivedWillpower: number;
  v20BloodPoolMax: number;
}

export function getStep4DossierSummary(state: WodCreationWizardState): Step4DossierSummary {
  const { clanEntry, allowsFreeDisciplines } = getResolvedWizardClan(state);
  const clanName = clanEntry ? clanEntry.id : state.customClanName.trim();
  const editionDisciplines = getDisciplinesForEdition(state.edition);

  let disciplinesTotal = 0;
  let outOfClanDots = 0;
  const clanValues: number[] = [];
  const powerGaps: Array<{ disciplineId: string; selected: number; required: number }> = [];

  for (const disc of editionDisciplines) {
    const dots = Math.max(0, Math.min(5, Math.round(state.disciplines[disc.id] ?? 0)));
    if (dots <= 0) continue;
    disciplinesTotal += dots;

    const affinity = allowsFreeDisciplines
      ? 'discipline_clan'
      : resolveDisciplineAffinity(clanName, disc.id, state.edition);
    if (affinity === 'discipline_out_of_clan') {
      outOfClanDots += dots;
    } else {
      clanValues.push(dots);
    }

    if (state.edition === 'vampire-v5') {
      const validIds = new Set(disc.powers.filter((p) => p.level <= dots).map((p) => p.id));
      const selected = (state.selectedPowers[disc.id] ?? []).filter((pid) => validIds.has(pid));
      if (selected.length !== dots) {
        powerGaps.push({
          disciplineId: disc.id,
          selected: selected.length,
          required: dots,
        });
      }
    }
  }

  const sortedClanValues = [...clanValues].sort((a, b) => b - a);
  const hasValidV5Split = allowsFreeDisciplines
    ? disciplinesTotal === WOD_DISCIPLINE_CREATION_BUDGET
    : outOfClanDots === 0 &&
      sortedClanValues.length === 2 &&
      sortedClanValues[0] === 2 &&
      sortedClanValues[1] === 1;

  const backgroundsTotal = Object.entries(state.backgrounds).reduce((sum, [advId, dots]) => {
    if (advId === 'haven') return sum;
    return sum + Math.max(0, Math.min(5, Math.round(dots)));
  }, 0);

  let v5MeritsTotal = 0;
  let v5FlawsListTotal = 0;
  for (const entry of state.meritsFlaws) {
    const rating = Math.max(1, Math.min(5, Math.round(entry.rating)));
    if (entry.kind === 'merit') v5MeritsTotal += rating;
    else v5FlawsListTotal += rating;
  }

  const v5HavenRating = Math.max(0, Math.min(5, Math.round(state.haven.rating)));
  let v5HavenFlawsTotal = 0;
  for (const traitId of state.haven.traits) {
    const trait = findHavenTraitByIdOrName(traitId, state.edition);
    if (trait?.kind === 'flaw') {
      v5HavenFlawsTotal += 1;
    }
  }

  const v5AdvantagesTotal = backgroundsTotal + v5MeritsTotal + v5HavenRating;
  const v5FlawsTotal = v5FlawsListTotal + v5HavenFlawsTotal;

  const v5TouchstonesValidCount = state.touchstones.filter(
    (item) => item.conviction.trim().length > 0 && item.touchstone.trim().length > 0,
  ).length;

  const conscience = Math.max(1, Math.min(5, Math.round(state.virtues.conscience)));
  const selfControl = Math.max(1, Math.min(5, Math.round(state.virtues.selfControl)));
  const courage = Math.max(1, Math.min(5, Math.round(state.virtues.courage)));
  const v20VirtuesExtraSpent = (conscience - 1) + (selfControl - 1) + (courage - 1);

  return {
    edition: state.edition,
    disciplinesTotal,
    disciplinesTarget: WOD_DISCIPLINE_CREATION_BUDGET,
    allowsFreeDisciplines,
    outOfClanDots,
    hasValidV5Split,
    powerGaps,
    backgroundsTotal,
    v5MeritsTotal,
    v5HavenRating,
    v5AdvantagesTotal,
    v5AdvantagesTarget: V5_ADVANTAGES_BUDGET,
    v5FlawsListTotal,
    v5HavenFlawsTotal,
    v5FlawsTotal,
    v5FlawsTarget: V5_FLAWS_BUDGET,
    v5TouchstonesValidCount,
    v5BloodPotency: getV5InitialBloodPotency(state),
    v5Humanity: getV5InitialHumanity(state),
    v20BackgroundsTarget: V20_BACKGROUNDS_BUDGET,
    v20VirtuesExtraSpent,
    v20VirtuesExtraTarget: V20_VIRTUES_EXTRA_BUDGET,
    v20DerivedHumanity: Math.min(10, conscience + selfControl),
    v20DerivedWillpower: courage,
    v20BloodPoolMax: getBloodPoolMaxByGeneration(state.generation),
  };
}

export type WodWizardIssueCode =
  | 'name_required'
  | 'clan_required'
  | 'v5_attributes_mismatch'
  | 'v20_attributes_mismatch'
  | 'v5_skills_mismatch'
  | 'v20_skills_mismatch'
  | 'v20_skills_over_cap'
  | 'disciplines_total_mismatch'
  | 'v5_disciplines_clan_split'
  | 'v20_disciplines_out_of_clan'
  | 'v5_powers_mismatch'
  | 'v5_advantages_mismatch'
  | 'v5_flaws_mismatch'
  | 'v5_touchstones_mismatch'
  | 'v20_backgrounds_mismatch'
  | 'v20_virtues_mismatch';

export interface WodWizardValidationIssue {
  code: WodWizardIssueCode;
  params?: Record<string, string | number>;
}

export interface WodWizardStepValidation {
  step: WodWizardStep;
  valid: boolean;
  issues: WodWizardValidationIssue[];
}

export function validateWizardStep(
  state: WodCreationWizardState,
  step: WodWizardStep,
): WodWizardStepValidation {
  const issues: WodWizardValidationIssue[] = [];

  if (step === 1) {
    if (state.name.trim().length === 0) {
      issues.push({ code: 'name_required' });
    }
    const hasClan =
      state.clanId === WOD_WIZARD_CUSTOM_VALUE
        ? state.customClanName.trim().length > 0
        : Boolean(findClanByIdOrName(state.clanId, state.edition));
    if (!hasClan) {
      issues.push({ code: 'clan_required' });
    }
    return { step, valid: issues.length === 0, issues };
  }

  if (step === 2) {
    const summary = getStep2AttributeSummary(state);
    if (state.edition === 'vampire-v5') {
      const exactMatch =
        summary.v5OverCapCount === 0 &&
        summary.v5RemainingSlots[4] === 0 &&
        summary.v5RemainingSlots[3] === 0 &&
        summary.v5RemainingSlots[2] === 0 &&
        summary.v5RemainingSlots[1] === 0;
      if (!exactMatch) {
        issues.push({
          code: 'v5_attributes_mismatch',
          params: {
            spent: summary.v5PointsSpent,
            target: summary.v5PointsTarget,
          },
        });
      }
    } else {
      const anyMismatch = summary.v20Groups.some((g) => g.remaining !== 0);
      if (anyMismatch) {
        issues.push({ code: 'v20_attributes_mismatch' });
      }
    }
    return { step, valid: issues.length === 0, issues };
  }

  if (step === 3) {
    const summary = getStep3SkillSummary(state);
    if (state.edition === 'vampire-v5') {
      const exactMatch =
        summary.v5OverCapCount === 0 &&
        summary.v5RemainingSlots[4] === 0 &&
        summary.v5RemainingSlots[3] === 0 &&
        summary.v5RemainingSlots[2] === 0 &&
        summary.v5RemainingSlots[1] === 0;
      if (!exactMatch) {
        issues.push({
          code: 'v5_skills_mismatch',
          params: {
            current: summary.v5SkillsWithDots,
            target: summary.v5ArraySpec.totalSkills,
          },
        });
      }
    } else {
      const hasOverCap = summary.v20Groups.some((g) => g.overCapKeys.length > 0);
      if (hasOverCap) {
        issues.push({ code: 'v20_skills_over_cap', params: { cap: V20_SKILL_CREATION_CAP } });
      }
      const anyMismatch = summary.v20Groups.some((g) => g.remaining !== 0);
      if (anyMismatch) {
        issues.push({ code: 'v20_skills_mismatch' });
      }
    }
    return { step, valid: issues.length === 0, issues };
  }

  // Step 4
  const summary = getStep4DossierSummary(state);
  if (summary.disciplinesTotal !== summary.disciplinesTarget) {
    issues.push({
      code: 'disciplines_total_mismatch',
      params: { current: summary.disciplinesTotal, target: summary.disciplinesTarget },
    });
  } else if (state.edition === 'vampire-v5' && !summary.hasValidV5Split) {
    issues.push({ code: 'v5_disciplines_clan_split' });
  } else if (
    state.edition === 'storyteller-v20' &&
    !summary.allowsFreeDisciplines &&
    summary.outOfClanDots > 0
  ) {
    issues.push({ code: 'v20_disciplines_out_of_clan' });
  }

  if (state.edition === 'vampire-v5') {
    if (summary.powerGaps.length > 0) {
      issues.push({ code: 'v5_powers_mismatch' });
    }
    if (summary.v5AdvantagesTotal !== summary.v5AdvantagesTarget) {
      issues.push({
        code: 'v5_advantages_mismatch',
        params: { current: summary.v5AdvantagesTotal, target: summary.v5AdvantagesTarget },
      });
    }
    if (summary.v5FlawsTotal !== summary.v5FlawsTarget) {
      issues.push({
        code: 'v5_flaws_mismatch',
        params: { current: summary.v5FlawsTotal, target: summary.v5FlawsTarget },
      });
    }
    if (
      summary.v5TouchstonesValidCount < V5_TOUCHSTONES_MIN ||
      summary.v5TouchstonesValidCount > V5_TOUCHSTONES_MAX
    ) {
      issues.push({
        code: 'v5_touchstones_mismatch',
        params: {
          current: summary.v5TouchstonesValidCount,
          min: V5_TOUCHSTONES_MIN,
          max: V5_TOUCHSTONES_MAX,
        },
      });
    }
  } else {
    if (summary.backgroundsTotal !== summary.v20BackgroundsTarget) {
      issues.push({
        code: 'v20_backgrounds_mismatch',
        params: { current: summary.backgroundsTotal, target: summary.v20BackgroundsTarget },
      });
    }
    if (summary.v20VirtuesExtraSpent !== summary.v20VirtuesExtraTarget) {
      issues.push({
        code: 'v20_virtues_mismatch',
        params: { current: summary.v20VirtuesExtraSpent, target: summary.v20VirtuesExtraTarget },
      });
    }
  }

  return { step, valid: issues.length === 0, issues };
}

export function canAdvanceFromStep(
  state: WodCreationWizardState,
  step: WodWizardStep,
): boolean {
  if (!state.strictRules) return true;
  return validateWizardStep(state, step).valid;
}

export function canCompleteWizard(state: WodCreationWizardState): boolean {
  if (!state.strictRules) return true;
  return ([1, 2, 3, 4] as const).every((step) => validateWizardStep(state, step).valid);
}

function sanitizeSafeId(raw: string, fallbackPrefix: string, idx: number): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const base = cleaned || `${fallbackPrefix}_${idx + 1}`;
  return base.slice(0, 64);
}

// Re-export lazily imported factory from sheetModel via dynamic dependency-free path
import { createFreshSheetForSystem } from '../core/sheetModel.ts';

function defaultCharacterTitleForLanguage(lang: AppLanguage): string {
  if (lang === 'en') return 'NEW CHARACTER';
  if (lang === 'es') return 'NUEVO PERSONAJE';
  return 'NOVO PERSONAGEM';
}

function defaultHavenNameForLanguage(lang: AppLanguage): string {
  if (lang === 'en') return 'Primary Haven';
  if (lang === 'es') return 'Refugio Principal';
  return 'Refúgio Principal';
}

function defaultBackgroundCardTitle(lang: AppLanguage): { code: string; title: string } {
  if (lang === 'en') {
    return { code: '//BACKGROUNDS', title: 'BACKGROUNDS & ADVANTAGES' };
  }
  if (lang === 'es') {
    return { code: '//TRASFONDOS', title: 'TRASFONDOS Y VENTAJAS' };
  }
  return { code: '//ANTECEDENTES', title: 'ANTECEDENTES & VANTAGENS' };
}

/**
 * Deterministically materializes a schema-v2-valid CharacterSheetState from the 4-step WoD wizard state.
 */
export function buildSheetFromWodWizard(
  state: WodCreationWizardState,
  lang: AppLanguage = 'pt-BR',
): CharacterSheetState {
  const edition = state.edition;
  const isV5 = edition === 'vampire-v5';
  const resolvedClanName = resolveWizardClanName(state, lang);
  const trimmedName = state.name.trim();
  const effectiveName = trimmedName || defaultCharacterTitleForLanguage(lang);
  const clampedGeneration = clampGenerationForEdition(edition, state.generation);
  const { clanEntry } = getResolvedWizardClan(state);

  const baseSheet = createFreshSheetForSystem('wod', {
    characterName: effectiveName,
    edition,
    rulePreset: edition,
    ...(resolvedClanName ? { clan: resolvedClanName, secondaryTrait: resolvedClanName } : {}),
    language: lang,
    localeOptions: {
      newCharacterName: defaultCharacterTitleForLanguage(lang),
    },
  });

  const attrKeys = getEditionAttributeKeys(edition);
  const attrVars: Record<string, number> = {};
  for (const key of attrKeys) {
    const raw = state.attributes[key];
    attrVars[key] = Math.max(1, Math.min(5, Number.isFinite(raw) ? Math.round(raw) : 1));
  }

  const virtues: VirtuesState = {
    conscience: Math.max(1, Math.min(5, Math.round(state.virtues.conscience))),
    selfControl: Math.max(1, Math.min(5, Math.round(state.virtues.selfControl))),
    courage: Math.max(1, Math.min(5, Math.round(state.virtues.courage))),
  };

  const resolvedPredatorName = resolveWizardPredatorName(state, lang);
  const v5BloodPotency = getV5InitialBloodPotency(state);
  const v5Humanity = getV5InitialHumanity(state);
  const v5HealthMax = Math.max(4, attrVars.stamina + 3);
  const v5WillpowerMax = Math.max(2, attrVars.composure + attrVars.resolve);
  const v20Humanity = Math.min(10, virtues.conscience + virtues.selfControl);
  const v20WillpowerMax = Math.max(1, Math.min(10, virtues.courage));
  const v20BloodPoolMax = getBloodPoolMaxByGeneration(clampedGeneration);

  // Build Skills card fields (only skills > 0, in catalog order)
  const catalogSkills: readonly WodCatalogSkill[] = getWodSkillsCatalog(edition);
  const skillFields: SheetField[] = [];
  for (const skill of catalogSkills) {
    const dots = Math.max(0, Math.min(5, Math.round(state.skills[skill.varName] ?? 0)));
    if (dots <= 0) continue;

    const specText = (state.skillSpecialties[skill.varName] ?? '').trim().slice(0, 240);
    const pair = buildCatalogSkillFields(skill, edition, lang, attrVars);
    for (const field of pair) {
      if (field.kind === 'number') {
        skillFields.push({
          ...field,
          value: dots,
          max: 5,
          ...(specText ? { rollSpecialty: true, hint: specText } : {}),
        });
      } else {
        skillFields.push({
          ...field,
          ...(specText ? { rollSpecialty: true, hint: specText } : {}),
        });
      }
    }
  }

  // Build Disciplines & Powers
  const catalogDisciplines: readonly WodDisciplineCatalogEntry[] = getDisciplinesForEdition(edition);
  const disciplineFields: SheetField[] = [];
  const powerRows: RepeatableRow[] = [];
  const seenPowerRowIds = new Set<string>();

  for (const disc of catalogDisciplines) {
    const dots = Math.max(0, Math.min(5, Math.round(state.disciplines[disc.id] ?? 0)));
    if (dots <= 0) continue;

    const affinity = resolveDisciplineAffinity(resolvedClanName, disc.id, edition);
    const builtDiscField = buildCatalogDisciplineField(disc, lang);
    disciplineFields.push({
      ...builtDiscField,
      value: dots,
      max: 5,
      xpCategory: affinity,
    });

    const chosenPowerIds = state.selectedPowers[disc.id] ?? [];
    for (const powerId of chosenPowerIds) {
      const power = disc.powers.find((p) => p.id === powerId && p.level <= dots);
      if (!power) continue;
      const row = buildCatalogPowerRow(disc, power, lang);
      if (seenPowerRowIds.has(row.id)) continue;
      seenPowerRowIds.add(row.id);
      powerRows.push({
        id: row.id,
        col1: row.col1.slice(0, 200),
        col2: row.col2,
      });
    }
  }

  // Build non-Haven Backgrounds (never duplicate Haven inside card_backgrounds)
  const catalogBackgrounds = getAdvantagesForEdition(edition, 'background');
  const backgroundFields: SheetField[] = [];
  for (const adv of catalogBackgrounds) {
    if (adv.id === 'haven') continue;
    const dots = Math.max(0, Math.min(adv.maxDots, Math.round(state.backgrounds[adv.id] ?? 0)));
    if (dots <= 0) continue;
    backgroundFields.push(buildCatalogAdvantageField(adv, lang, dots));
  }

  const nextCards: SheetCard[] = baseSheet.cards.map((card) => {
    if (card.id === 'card_identidade') {
      const identityPatch: Record<string, string> = {
        character_name: effectiveName,
        clan: resolvedClanName,
        concept: state.concept.trim().slice(0, 200),
        sire: state.sire.trim().slice(0, 120),
        chronicle: state.chronicle.trim().slice(0, 120),
        ...(isV5
          ? {
              predator_type: resolvedPredatorName.slice(0, 120),
              ambition: state.ambition.trim().slice(0, 200),
              desire: state.desire.trim().slice(0, 200),
              ...(clanEntry?.edition === 'vampire-v5'
                ? {
                    clan_bane: clanEntry.bane[lang].slice(0, 500),
                    clan_compulsion: clanEntry.compulsion[lang].slice(0, 500),
                  }
                : {}),
            }
          : {
              nature: state.nature.trim().slice(0, 120),
              demeanor: state.demeanor.trim().slice(0, 120),
              ...(clanEntry?.edition === 'storyteller-v20'
                ? {
                    clan_weakness: clanEntry.weakness[lang].slice(0, 500),
                  }
                : {}),
            }),
      };

      const mappedFields = card.fields.map((f) => {
        const fk = (f.key ?? '').trim().toLowerCase();
        if (f.id === 'f_generation' || fk === 'generation') {
          return { ...f, value: clampedGeneration };
        }
        if (isV5 && (f.id === 'f_blood_potency' || fk === 'blood_potency')) {
          return {
            id: 'f_blood_potency',
            key: 'blood_potency',
            label: 'BLOOD_POTENCY',
            kind: 'number' as const,
            value: v5BloodPotency,
            max: 10,
          };
        }
        if (Object.prototype.hasOwnProperty.call(identityPatch, fk)) {
          return { ...f, value: identityPatch[fk] };
        }
        return f;
      });

      return { ...card, fields: mappedFields };
    }

    if (card.id === 'card_atributos') {
      return {
        ...card,
        fields: card.fields.map((f) => {
          const fk = (f.key ?? '').trim().toLowerCase();
          if (f.kind === 'number' && Object.prototype.hasOwnProperty.call(attrVars, fk)) {
            return { ...f, value: attrVars[fk] };
          }
          return f;
        }),
      };
    }

    if (card.id === 'card_combate') {
      return {
        ...card,
        fields: card.fields.map((f) => {
          const fk = (f.key ?? '').trim().toLowerCase();
          if (f.id === 'f_health' || fk === 'health') {
            return isV5
              ? {
                  ...f,
                  max: v5HealthMax,
                  maxFormula: 'stamina + 3',
                  value: v5HealthMax,
                  superficialDamage: 0,
                  aggravatedDamage: 0,
                }
              : {
                  ...f,
                  max: 7,
                  value: 7,
                  bashingDamage: 0,
                  lethalDamage: 0,
                  superficialDamage: 0,
                  aggravatedDamage: 0,
                };
          }
          if (f.id === 'f_willpower' || fk === 'willpower') {
            return isV5
              ? {
                  ...f,
                  max: v5WillpowerMax,
                  maxFormula: 'composure + resolve',
                  value: v5WillpowerMax,
                  superficialDamage: 0,
                  aggravatedDamage: 0,
                }
              : {
                  ...f,
                  max: v20WillpowerMax,
                  value: v20WillpowerMax,
                };
          }
          if (f.id === 'f_humanity' || fk === 'humanity') {
            return isV5
              ? { ...f, value: v5Humanity, max: 10, stains: 0 }
              : { ...f, value: v20Humanity, max: 10 };
          }
          if (f.id === 'f_hunger' || fk === 'hunger') {
            return { ...f, value: 1, max: 5 };
          }
          return f;
        }),
      };
    }

    if (card.id === 'card_skills') {
      return {
        ...card,
        fields: skillFields,
      };
    }

    if (card.id === 'card_arcano') {
      return {
        ...card,
        fields: disciplineFields,
      };
    }

    if (card.id === 'card_grimorio') {
      return {
        ...card,
        fields: card.fields.map((f) =>
          f.id === 'f_lista_magias'
            ? { ...f, rows: powerRows }
            : f.id === 'f_frenzy_check'
              ? { ...f, value: false }
              : f,
        ),
      };
    }

    return card;
  });

  if (backgroundFields.length > 0) {
    const bgTitle = defaultBackgroundCardTitle(lang);
    const existingBgIdx = nextCards.findIndex((c) => c.id === 'card_backgrounds');
    const bgCard: SheetCard = {
      id: 'card_backgrounds',
      tab: 'geral',
      code: bgTitle.code,
      title: bgTitle.title,
      colSpan: 1,
      fields: backgroundFields,
    };
    if (existingBgIdx >= 0) {
      nextCards[existingBgIdx] = bgCard;
    } else {
      const combatIdx = nextCards.findIndex((c) => c.id === 'card_combate');
      const insertAt = combatIdx >= 0 ? combatIdx + 1 : nextCards.length;
      nextCards.splice(insertAt, 0, bgCard);
    }
  }

  // Sanitize meritsFlaws
  const meritsFlaws: MeritFlawEntry[] = state.meritsFlaws
    .filter((entry) => entry.name.trim().length > 0)
    .slice(0, 100)
    .map((entry, idx) => {
      const notes = entry.notes?.trim().slice(0, 500);
      const catalogId = entry.catalogId?.trim().slice(0, 64);
      return {
        id: sanitizeSafeId(entry.id, 'mf', idx),
        kind: entry.kind === 'flaw' ? 'flaw' : 'merit',
        name: entry.name.trim().slice(0, 120),
        rating: Math.max(1, Math.min(5, Math.round(entry.rating))),
        ...(notes ? { notes } : {}),
        ...(catalogId ? { catalogId } : {}),
      };
    });

  // Sanitize Haven (goes ONLY into sheet.havens, never duplicated in card_backgrounds)
  const havenNameTrim = state.haven.name.trim();
  const havenLocTrim = state.haven.location.trim();
  const havenNotesTrim = state.haven.notes.trim();
  const havenRating = Math.max(0, Math.min(5, Math.round(state.haven.rating)));
  const havenTraits = Array.from(
    new Set(
      state.haven.traits
        .map((t) => t.trim().slice(0, 80))
        .filter((t) => t.length > 0),
    ),
  ).slice(0, 30);
  const hasHavenData =
    havenRating > 0 ||
    havenNameTrim.length > 0 ||
    havenLocTrim.length > 0 ||
    havenTraits.length > 0 ||
    havenNotesTrim.length > 0;

  const havens: HavenEntry[] = hasHavenData
    ? [
        {
          id: 'hv_wizard_1',
          name: (havenNameTrim || defaultHavenNameForLanguage(lang)).slice(0, 120),
          ...(havenLocTrim ? { location: havenLocTrim.slice(0, 200) } : {}),
          rating: havenRating,
          traits: havenTraits,
          ...(havenNotesTrim ? { notes: havenNotesTrim.slice(0, 500) } : {}),
        },
      ]
    : [];

  // Sanitize V5 Touchstones
  const touchstones: TouchstoneEntry[] | undefined = isV5
    ? state.touchstones
        .filter((t) => t.conviction.trim().length > 0 && t.touchstone.trim().length > 0)
        .slice(0, 20)
        .map((t, idx) => {
          const notes = t.notes?.trim().slice(0, 500);
          return {
            id: sanitizeSafeId(t.id, 'ts', idx),
            conviction: t.conviction.trim().slice(0, 240),
            touchstone: t.touchstone.trim().slice(0, 160),
            ...(notes ? { notes } : {}),
          };
        })
    : undefined;

  const displayCharHeader = resolvedClanName
    ? `${effectiveName.toUpperCase()} (${resolvedClanName.toUpperCase()})`
    : effectiveName.toUpperCase();

  return {
    ...baseSheet,
    characterName: displayCharHeader.slice(0, 120),
    cards: nextCards,
    meritsFlaws,
    havens,
    ...(isV5
      ? {
          stains: 0,
          touchstones,
        }
      : {
          bloodPool: v20BloodPoolMax,
          virtues,
        }),
  };
}

export function createWizardAdvantagePreview(
  edition: WodEdition,
): {
  backgrounds: ReturnType<typeof getAdvantagesForEdition>;
  merits: ReturnType<typeof getAdvantagesForEdition>;
  flaws: ReturnType<typeof getFlawsForEdition>;
} {
  return {
    backgrounds: getAdvantagesForEdition(edition, 'background').filter((a) => a.id !== 'haven'),
    merits: getAdvantagesForEdition(edition, 'merit'),
    flaws: getFlawsForEdition(edition),
  };
}

export function getAdvantageEntryById(
  id: string,
  edition: WodEdition,
) {
  return findAdvantageByIdOrName(id, edition);
}

export function getDisciplineEntryById(
  id: string,
  edition: WodEdition,
) {
  return findDisciplineByIdOrName(id, edition);
}
