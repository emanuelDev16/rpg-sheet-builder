import type { AppLanguage } from './i18n';
import type { RulePreset, SheetCard, SheetField, SystemId } from './sheetModel';
import type { VariableMap } from './formula';

export type WodCatalogEdition = 'storyteller-v20' | 'vampire-v5';

export type V20SkillCategory = 'talents' | 'skills' | 'knowledges';
export type V5SkillCategory = 'physical' | 'social' | 'mental';
export type WodSkillCategory = V20SkillCategory | V5SkillCategory;

export interface WodCatalogSkill {
  id: string;
  varName: string;
  edition: WodCatalogEdition;
  category: WodSkillCategory;
  defaultAttribute: 'strength' | 'dexterity' | 'stamina' | 'charisma' | 'manipulation' | 'wits';
  aliases?: string[];
  labels: Record<AppLanguage, string>;
}

export interface WodSkillCategoryGroup {
  category: WodSkillCategory;
  labels: Record<AppLanguage, string>;
  skills: WodCatalogSkill[];
}

export const WOD_CATEGORY_LABELS: Record<WodSkillCategory, Record<AppLanguage, string>> = {
  talents: { 'pt-BR': 'Talentos', en: 'Talents', es: 'Talentos' },
  skills: { 'pt-BR': 'Perícias', en: 'Skills', es: 'Técnicas' },
  knowledges: { 'pt-BR': 'Conhecimentos', en: 'Knowledges', es: 'Conocimientos' },
  physical: { 'pt-BR': 'Físicas', en: 'Physical', es: 'Físicas' },
  social: { 'pt-BR': 'Sociais', en: 'Social', es: 'Sociales' },
  mental: { 'pt-BR': 'Mentais', en: 'Mental', es: 'Mentales' },
};

export const V20_SKILLS_CATALOG: readonly WodCatalogSkill[] = [
  // Talentos (10)
  {
    id: 'v20_alertness',
    varName: 'alertness',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'wits',
    aliases: ['prontidao', 'alerta'],
    labels: { 'pt-BR': 'Prontidão', en: 'Alertness', es: 'Alerta' },
  },
  {
    id: 'v20_athletics',
    varName: 'athletics',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'dexterity',
    aliases: ['esportes', 'atletismo'],
    labels: { 'pt-BR': 'Esportes', en: 'Athletics', es: 'Atletismo' },
  },
  {
    id: 'v20_awareness',
    varName: 'awareness',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'wits',
    aliases: ['consciencia'],
    labels: { 'pt-BR': 'Consciência', en: 'Awareness', es: 'Consciencia' },
  },
  {
    id: 'v20_brawl',
    varName: 'brawl',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'strength',
    aliases: ['briga', 'pelea'],
    labels: { 'pt-BR': 'Briga', en: 'Brawl', es: 'Pelea' },
  },
  {
    id: 'v20_empathy',
    varName: 'empathy',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'charisma',
    aliases: ['empatia'],
    labels: { 'pt-BR': 'Empatia', en: 'Empathy', es: 'Empatía' },
  },
  {
    id: 'v20_expression',
    varName: 'expression',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'charisma',
    aliases: ['expressao', 'expresion'],
    labels: { 'pt-BR': 'Expressão', en: 'Expression', es: 'Expresión' },
  },
  {
    id: 'v20_intimidation',
    varName: 'intimidation',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'charisma',
    aliases: ['intimidacao', 'intimidacion'],
    labels: { 'pt-BR': 'Intimidação', en: 'Intimidation', es: 'Intimidación' },
  },
  {
    id: 'v20_leadership',
    varName: 'leadership',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'charisma',
    aliases: ['lideranca', 'liderazgo'],
    labels: { 'pt-BR': 'Liderança', en: 'Leadership', es: 'Liderazgo' },
  },
  {
    id: 'v20_streetwise',
    varName: 'streetwise',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'wits',
    aliases: ['manha', 'callejeo'],
    labels: { 'pt-BR': 'Manha', en: 'Streetwise', es: 'Callejeo' },
  },
  {
    id: 'v20_subterfuge',
    varName: 'subterfuge',
    edition: 'storyteller-v20',
    category: 'talents',
    defaultAttribute: 'manipulation',
    aliases: ['labia', 'subterfugio'],
    labels: { 'pt-BR': 'Lábia', en: 'Subterfuge', es: 'Subterfugio' },
  },

  // Perícias (10)
  {
    id: 'v20_animal_ken',
    varName: 'animal_ken',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'charisma',
    aliases: ['empatia_com_animais', 'trato_con_animales'],
    labels: { 'pt-BR': 'Empatia com Animais', en: 'Animal Ken', es: 'Trato con Animales' },
  },
  {
    id: 'v20_crafts',
    varName: 'crafts',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'dexterity',
    aliases: ['craft', 'oficios', 'artesania'],
    labels: { 'pt-BR': 'Ofícios', en: 'Crafts', es: 'Artesanía' },
  },
  {
    id: 'v20_drive',
    varName: 'drive',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'dexterity',
    aliases: ['conducao', 'conducir'],
    labels: { 'pt-BR': 'Condução', en: 'Drive', es: 'Conducir' },
  },
  {
    id: 'v20_etiquette',
    varName: 'etiquette',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'charisma',
    aliases: ['etiqueta'],
    labels: { 'pt-BR': 'Etiqueta', en: 'Etiquette', es: 'Etiqueta' },
  },
  {
    id: 'v20_firearms',
    varName: 'firearms',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'dexterity',
    aliases: ['armas_de_fogo', 'armas_de_fuego'],
    labels: { 'pt-BR': 'Armas de Fogo', en: 'Firearms', es: 'Armas de Fuego' },
  },
  {
    id: 'v20_larceny',
    varName: 'larceny',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'dexterity',
    aliases: ['furto', 'latrocinio'],
    labels: { 'pt-BR': 'Furto', en: 'Larceny', es: 'Latrocinio' },
  },
  {
    id: 'v20_melee',
    varName: 'melee',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'dexterity',
    aliases: ['armas_brancas', 'armas_cuerpo_a_cuerpo'],
    labels: { 'pt-BR': 'Armas Brancas', en: 'Melee', es: 'Armas Cuerpo a Cuerpo' },
  },
  {
    id: 'v20_performance',
    varName: 'performance',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'charisma',
    aliases: ['interpretacion'],
    labels: { 'pt-BR': 'Performance', en: 'Performance', es: 'Interpretación' },
  },
  {
    id: 'v20_stealth',
    varName: 'stealth',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'dexterity',
    aliases: ['furtividade', 'sigilo'],
    labels: { 'pt-BR': 'Furtividade', en: 'Stealth', es: 'Sigilo' },
  },
  {
    id: 'v20_survival',
    varName: 'survival',
    edition: 'storyteller-v20',
    category: 'skills',
    defaultAttribute: 'stamina',
    aliases: ['sobrevivencia', 'supervivencia'],
    labels: { 'pt-BR': 'Sobrevivência', en: 'Survival', es: 'Supervivencia' },
  },

  // Conhecimentos (10)
  {
    id: 'v20_academics',
    varName: 'academics',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['academicos', 'academicismo'],
    labels: { 'pt-BR': 'Acadêmicos', en: 'Academics', es: 'Academicismo' },
  },
  {
    id: 'v20_computer',
    varName: 'computer',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['computador', 'informatica'],
    labels: { 'pt-BR': 'Computador', en: 'Computer', es: 'Informática' },
  },
  {
    id: 'v20_finance',
    varName: 'finance',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['financas', 'finanzas'],
    labels: { 'pt-BR': 'Finanças', en: 'Finance', es: 'Finanzas' },
  },
  {
    id: 'v20_investigation',
    varName: 'investigation',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['investigacao', 'investigacion'],
    labels: { 'pt-BR': 'Investigação', en: 'Investigation', es: 'Investigación' },
  },
  {
    id: 'v20_law',
    varName: 'law',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['direito', 'leyes'],
    labels: { 'pt-BR': 'Direito', en: 'Law', es: 'Leyes' },
  },
  {
    id: 'v20_medicine',
    varName: 'medicine',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['medicina'],
    labels: { 'pt-BR': 'Medicina', en: 'Medicine', es: 'Medicina' },
  },
  {
    id: 'v20_occult',
    varName: 'occult',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['ocultismo'],
    labels: { 'pt-BR': 'Ocultismo', en: 'Occult', es: 'Ocultismo' },
  },
  {
    id: 'v20_politics',
    varName: 'politics',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'charisma',
    aliases: ['politica'],
    labels: { 'pt-BR': 'Política', en: 'Politics', es: 'Política' },
  },
  {
    id: 'v20_science',
    varName: 'science',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['ciencia'],
    labels: { 'pt-BR': 'Ciência', en: 'Science', es: 'Ciencia' },
  },
  {
    id: 'v20_technology',
    varName: 'technology',
    edition: 'storyteller-v20',
    category: 'knowledges',
    defaultAttribute: 'wits',
    aliases: ['tecnologia'],
    labels: { 'pt-BR': 'Tecnologia', en: 'Technology', es: 'Tecnología' },
  },
];

export const V5_SKILLS_CATALOG: readonly WodCatalogSkill[] = [
  // Físicas (9)
  {
    id: 'v5_athletics',
    varName: 'athletics',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'dexterity',
    aliases: ['atletismo', 'esportes'],
    labels: { 'pt-BR': 'Atletismo', en: 'Athletics', es: 'Atletismo' },
  },
  {
    id: 'v5_brawl',
    varName: 'brawl',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'strength',
    aliases: ['briga', 'pelea'],
    labels: { 'pt-BR': 'Briga', en: 'Brawl', es: 'Pelea' },
  },
  {
    id: 'v5_crafts',
    varName: 'crafts',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'dexterity',
    aliases: ['craft', 'oficios', 'artesania'],
    labels: { 'pt-BR': 'Ofícios', en: 'Craft', es: 'Artesanía' },
  },
  {
    id: 'v5_drive',
    varName: 'drive',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'dexterity',
    aliases: ['conducao', 'conducir'],
    labels: { 'pt-BR': 'Condução', en: 'Drive', es: 'Conducir' },
  },
  {
    id: 'v5_firearms',
    varName: 'firearms',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'dexterity',
    aliases: ['armas_de_fogo', 'armas_de_fuego'],
    labels: { 'pt-BR': 'Armas de Fogo', en: 'Firearms', es: 'Armas de Fuego' },
  },
  {
    id: 'v5_larceny',
    varName: 'larceny',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'dexterity',
    aliases: ['furto', 'latrocinio'],
    labels: { 'pt-BR': 'Furto', en: 'Larceny', es: 'Latrocinio' },
  },
  {
    id: 'v5_melee',
    varName: 'melee',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'strength',
    aliases: ['armas_brancas', 'armas_cuerpo_a_cuerpo'],
    labels: { 'pt-BR': 'Armas Brancas', en: 'Melee', es: 'Armas Cuerpo a Cuerpo' },
  },
  {
    id: 'v5_stealth',
    varName: 'stealth',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'dexterity',
    aliases: ['furtividade', 'sigilo'],
    labels: { 'pt-BR': 'Furtividade', en: 'Stealth', es: 'Sigilo' },
  },
  {
    id: 'v5_survival',
    varName: 'survival',
    edition: 'vampire-v5',
    category: 'physical',
    defaultAttribute: 'stamina',
    aliases: ['sobrevivencia', 'supervivencia'],
    labels: { 'pt-BR': 'Sobrevivência', en: 'Survival', es: 'Supervivencia' },
  },

  // Sociais (9)
  {
    id: 'v5_animal_ken',
    varName: 'animal_ken',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'charisma',
    aliases: ['empatia_com_animais', 'trato_con_animales'],
    labels: { 'pt-BR': 'Empatia com Animais', en: 'Animal Ken', es: 'Trato con Animales' },
  },
  {
    id: 'v5_etiquette',
    varName: 'etiquette',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'charisma',
    aliases: ['etiqueta'],
    labels: { 'pt-BR': 'Etiqueta', en: 'Etiquette', es: 'Etiqueta' },
  },
  {
    id: 'v5_insight',
    varName: 'insight',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'wits',
    aliases: ['sagacidade', 'perspicacia', 'empathy', 'empatia'],
    labels: { 'pt-BR': 'Sagacidade', en: 'Insight', es: 'Perspicacia' },
  },
  {
    id: 'v5_intimidation',
    varName: 'intimidation',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'charisma',
    aliases: ['intimidacao', 'intimidacion'],
    labels: { 'pt-BR': 'Intimidação', en: 'Intimidation', es: 'Intimidación' },
  },
  {
    id: 'v5_leadership',
    varName: 'leadership',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'charisma',
    aliases: ['lideranca', 'liderazgo'],
    labels: { 'pt-BR': 'Liderança', en: 'Leadership', es: 'Liderazgo' },
  },
  {
    id: 'v5_performance',
    varName: 'performance',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'charisma',
    aliases: ['interpretacion'],
    labels: { 'pt-BR': 'Performance', en: 'Performance', es: 'Interpretación' },
  },
  {
    id: 'v5_persuasion',
    varName: 'persuasion',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'charisma',
    aliases: ['persuasao'],
    labels: { 'pt-BR': 'Persuasão', en: 'Persuasion', es: 'Persuasión' },
  },
  {
    id: 'v5_streetwise',
    varName: 'streetwise',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'wits',
    aliases: ['manha', 'callejeo'],
    labels: { 'pt-BR': 'Manha', en: 'Streetwise', es: 'Callejeo' },
  },
  {
    id: 'v5_subterfuge',
    varName: 'subterfuge',
    edition: 'vampire-v5',
    category: 'social',
    defaultAttribute: 'manipulation',
    aliases: ['labia', 'subterfugio'],
    labels: { 'pt-BR': 'Lábia', en: 'Subterfuge', es: 'Subterfugio' },
  },

  // Mentais (9)
  {
    id: 'v5_academics',
    varName: 'academics',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['academicos', 'academicismo'],
    labels: { 'pt-BR': 'Acadêmicos', en: 'Academics', es: 'Academicismo' },
  },
  {
    id: 'v5_awareness',
    varName: 'awareness',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['prontidao', 'alertness', 'consciencia'],
    labels: { 'pt-BR': 'Prontidão', en: 'Awareness', es: 'Consciencia' },
  },
  {
    id: 'v5_finance',
    varName: 'finance',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['financas', 'finanzas'],
    labels: { 'pt-BR': 'Finanças', en: 'Finance', es: 'Finanzas' },
  },
  {
    id: 'v5_investigation',
    varName: 'investigation',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['investigacao', 'investigacion'],
    labels: { 'pt-BR': 'Investigação', en: 'Investigation', es: 'Investigación' },
  },
  {
    id: 'v5_medicine',
    varName: 'medicine',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['medicina'],
    labels: { 'pt-BR': 'Medicina', en: 'Medicine', es: 'Medicina' },
  },
  {
    id: 'v5_occult',
    varName: 'occult',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['ocultismo'],
    labels: { 'pt-BR': 'Ocultismo', en: 'Occult', es: 'Ocultismo' },
  },
  {
    id: 'v5_politics',
    varName: 'politics',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'charisma',
    aliases: ['politica'],
    labels: { 'pt-BR': 'Política', en: 'Politics', es: 'Política' },
  },
  {
    id: 'v5_science',
    varName: 'science',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['ciencia'],
    labels: { 'pt-BR': 'Ciência', en: 'Science', es: 'Ciencia' },
  },
  {
    id: 'v5_technology',
    varName: 'technology',
    edition: 'vampire-v5',
    category: 'mental',
    defaultAttribute: 'wits',
    aliases: ['tecnologia', 'computer'],
    labels: { 'pt-BR': 'Tecnologia', en: 'Technology', es: 'Tecnología' },
  },
];

export function normalizeCatalogText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function isOfficialVampireSheet(
  systemId?: SystemId,
  rulePreset?: RulePreset,
): rulePreset is WodCatalogEdition {
  return (
    systemId === 'wod' &&
    (rulePreset === 'storyteller-v20' || rulePreset === 'vampire-v5')
  );
}

export function isSkillsCardCandidate(card: Pick<SheetCard, 'id' | 'code' | 'title'>): boolean {
  if (card.id === 'card_skills') return true;
  const sig = `${card.code} ${card.title}`.toUpperCase();
  return /SKILL|PERICIA|PERÍCIA|HABILIDAD|TALENT|KNOWLEDGE|POOLS/.test(sig);
}

export function getWodSkillsCatalog(edition: WodCatalogEdition): readonly WodCatalogSkill[] {
  return edition === 'vampire-v5' ? V5_SKILLS_CATALOG : V20_SKILLS_CATALOG;
}

export function getGroupedWodSkillsCatalog(
  edition: WodCatalogEdition,
  query = '',
): WodSkillCategoryGroup[] {
  const categoryOrder: WodSkillCategory[] =
    edition === 'vampire-v5'
      ? ['physical', 'social', 'mental']
      : ['talents', 'skills', 'knowledges'];
  const skills = getWodSkillsCatalog(edition);
  const normQuery = normalizeCatalogText(query);

  const filtered = normQuery
    ? skills.filter((skill) => {
        const haystack = [
          skill.varName,
          skill.labels['pt-BR'],
          skill.labels.en,
          skill.labels.es,
          ...(skill.aliases ?? []),
        ]
          .map(normalizeCatalogText)
          .join(' ');
        return haystack.includes(normQuery);
      })
    : skills;

  return categoryOrder
    .map((category) => ({
      category,
      labels: WOD_CATEGORY_LABELS[category],
      skills: filtered.filter((skill) => skill.category === category),
    }))
    .filter((group) => group.skills.length > 0);
}

export function isCatalogSkillPresent(
  skill: WodCatalogSkill,
  existingKeys: Iterable<string>,
): boolean {
  const normalizedExisting = new Set<string>();
  for (const key of existingKeys) {
    const clean = normalizeCatalogText(key).replace(/[^a-z0-9]+/g, '_');
    if (clean) normalizedExisting.add(clean);
  }
  const candidates = [
    skill.varName,
    ...(skill.aliases ?? []),
    ...Object.values(skill.labels).map((label) =>
      normalizeCatalogText(label).replace(/[^a-z0-9]+/g, '_'),
    ),
  ];
  return candidates.some((candidate) => normalizedExisting.has(candidate));
}

export function buildCatalogSkillFields(
  skill: WodCatalogSkill,
  edition: WodCatalogEdition,
  lang: AppLanguage,
  availableVars: VariableMap = {},
): SheetField[] {
  const defaultDifficulty = edition === 'vampire-v5' ? 2 : 6;
  const localizedName = (skill.labels[lang] ?? skill.labels['pt-BR']).toUpperCase();
  const hasDefaultAttr = Object.prototype.hasOwnProperty.call(
    availableVars,
    skill.defaultAttribute,
  );
  const poolFormula = hasDefaultAttr
    ? `pool(${skill.defaultAttribute} + ${skill.varName}, ${defaultDifficulty})`
    : `pool(${skill.varName}, ${defaultDifficulty})`;
  const rollPrefix = lang === 'en' ? 'ROLL' : lang === 'es' ? 'TIRAR' : 'ROLAR';

  return [
    {
      id: `f_${skill.varName}`,
      key: skill.varName,
      label: localizedName,
      kind: 'number',
      value: 1,
      xpCategory: 'skill',
    },
    {
      id: `f_roll_${skill.varName}`,
      key: `roll_${skill.varName}`,
      label: localizedName,
      kind: 'roll',
      rollLabel: `${rollPrefix} ${localizedName}`,
      rollExpr: poolFormula,
      rollDifficulty: defaultDifficulty,
      ...(edition === 'vampire-v5' ? { rollDifficultyV5: 2 } : {}),
      rollSpecialty: false,
      rollMod: 0,
      xpCategory: 'skill',
    },
  ];
}
