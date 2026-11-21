import type { AppLanguage } from './i18n.ts';
import type { CharacterSheetState, SheetCard, SheetField } from './sheetModel.ts';
import { type WodCatalogEdition, normalizeCatalogText } from './wodSkillsCatalog.ts';

export type { WodCatalogEdition };

export type WodAdvantageGroup = 'background' | 'merit';

export interface WodAdvantageCatalogEntry {
  readonly id: string;
  readonly varName: string;
  readonly editions: readonly WodCatalogEdition[];
  readonly group: WodAdvantageGroup;
  readonly maxDots: number;
  readonly aliases?: readonly string[];
  readonly name: Readonly<Record<AppLanguage, string>>;
  readonly summary: Readonly<Record<AppLanguage, string>>;
}

export const WOD_ADVANTAGE_GROUP_LABELS: Readonly<
  Record<WodAdvantageGroup, Readonly<Record<AppLanguage, string>>>
> = {
  background: {
    'pt-BR': 'Antecedentes',
    en: 'Backgrounds',
    es: 'Trasfondos',
  },
  merit: {
    'pt-BR': 'Méritos & Vantagens',
    en: 'Merits & Advantages',
    es: 'Méritos y Ventajas',
  },
};

export const WOD_ADVANTAGES_CATALOG: readonly WodAdvantageCatalogEntry[] = [
  // Shared V20 + V5 Backgrounds (9)
  {
    id: 'allies',
    varName: 'allies',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['aliados', 'aliado'],
    name: {
      'pt-BR': 'Aliados',
      en: 'Allies',
      es: 'Aliados',
    },
    summary: {
      'pt-BR': 'Mortais leais que auxiliam o personagem em favores, proteção e informação.',
      en: 'Loyal mortals who assist with favors, protection, and local intelligence.',
      es: 'Mortales leales que ayudan con favores, protección e información local.',
    },
  },
  {
    id: 'contacts',
    varName: 'contacts',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['contatos', 'contactos'],
    name: {
      'pt-BR': 'Contatos',
      en: 'Contacts',
      es: 'Contactos',
    },
    summary: {
      'pt-BR': 'Rede de informantes e fontes capazes de obter dados, pistas e acesso.',
      en: 'Network of informants and sources supplying rumors, intel, and access.',
      es: 'Red de informantes y fuentes capaces de aportar datos, pistas y acceso.',
    },
  },
  {
    id: 'fame',
    varName: 'fame',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['fama'],
    name: {
      'pt-BR': 'Fama',
      en: 'Fame',
      es: 'Fama',
    },
    summary: {
      'pt-BR': 'Reconhecimento público na sociedade mortal — útil para portas abertas, arriscado à Máscara.',
      en: 'Public renown among mortals — opens doors but complicates the Masquerade.',
      es: 'Reconocimiento público entre mortales; abre puertas pero expone la Mascarada.',
    },
  },
  {
    id: 'haven',
    varName: 'haven',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['refugio'],
    name: {
      'pt-BR': 'Refúgio',
      en: 'Haven',
      es: 'Refugio',
    },
    summary: {
      'pt-BR': 'Abrigo diurno seguro, com tamanho, discrição e defesas proporcionais aos pontos.',
      en: 'Secure daytime shelter whose scale, secrecy, and defenses grow with dots.',
      es: 'Refugio diurno seguro cuya amplitud, discreción y defensas crecen por nivel.',
    },
  },
  {
    id: 'herd',
    varName: 'herd',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['rebanho', 'rebano'],
    name: {
      'pt-BR': 'Rebanho',
      en: 'Herd',
      es: 'Rebaño',
    },
    summary: {
      'pt-BR': 'Recipientes dispostos e acessíveis para alimentação regular e segura.',
      en: 'Willing, accessible vessels enabling regular and discreet feeding.',
      es: 'Recipientes dispuestos y accesibles para alimentarse de forma segura.',
    },
  },
  {
    id: 'influence',
    varName: 'influence',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['influencia'],
    name: {
      'pt-BR': 'Influência',
      en: 'Influence',
      es: 'Influencia',
    },
    summary: {
      'pt-BR': 'Peso político, institucional ou burocrático sobre órgãos, polícia, mídia ou finanças.',
      en: 'Political and institutional sway across bureaucracy, police, media, or finance.',
      es: 'Peso político e institucional sobre policía, prensa, gobierno o finanzas.',
    },
  },
  {
    id: 'resources',
    varName: 'resources',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['recursos'],
    name: {
      'pt-BR': 'Recursos',
      en: 'Resources',
      es: 'Recursos',
    },
    summary: {
      'pt-BR': 'Riqueza líquida, renda mensal, propriedades e acesso a capital.',
      en: 'Liquid wealth, steady income, assets, and purchasing power.',
      es: 'Riqueza líquida, ingresos regulares, propiedades y capacidad financiera.',
    },
  },
  {
    id: 'retainers',
    varName: 'retainers',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['lacaios', 'lacaio', 'criados', 'servos'],
    name: {
      'pt-BR': 'Lacaios',
      en: 'Retainers',
      es: 'Criados',
    },
    summary: {
      'pt-BR': 'Carniçais ou subordinados devotados que cuidam do refúgio e executam tarefas.',
      en: 'Devoted ghouls or mortal attendants managing errands and daytime security.',
      es: 'Ghouls o asistentes devotos que protegen el refugio y cumplen encargos.',
    },
  },
  {
    id: 'status',
    varName: 'status',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['estatus'],
    name: {
      'pt-BR': 'Status',
      en: 'Status',
      es: 'Estatus',
    },
    summary: {
      'pt-BR': 'Prestígio e respeito formal dentro da Camarilla, Anarquistas ou corte vampírica.',
      en: 'Standing and formal respect within the Camarilla, Anarchs, or local court.',
      es: 'Prestigio y respeto formal dentro de la Camarilla, Anarquistas o corte local.',
    },
  },

  // V20-Only Backgrounds (4 -> 13 total in V20)
  {
    id: 'domain',
    varName: 'domain',
    editions: ['storyteller-v20'],
    group: 'background',
    maxDots: 5,
    aliases: ['dominio'],
    name: {
      'pt-BR': 'Domínio',
      en: 'Domain',
      es: 'Dominio',
    },
    summary: {
      'pt-BR': 'Território de caça reconhecido pela corte, definindo tamanho e riqueza de presas.',
      en: 'Recognized hunting territory defining turf size, safety, and vessel density.',
      es: 'Territorio de caza reconocido, determinando extensión y abundancia de presas.',
    },
  },
  {
    id: 'generation',
    varName: 'generation_bg',
    editions: ['storyteller-v20'],
    group: 'background',
    maxDots: 5,
    aliases: ['geracao', 'geracao_bg', 'generation_bg', 'generacion'],
    name: {
      'pt-BR': 'Geração (Antecedente)',
      en: 'Generation (Background)',
      es: 'Generación (Trasfondo)',
    },
    summary: {
      'pt-BR': 'Proximidade sanguínea de Caim (reduz geração base, eleva reserva e limite de sangue).',
      en: 'Closeness to Caine, lowering Generation and raising Blood Pool limits.',
      es: 'Cercanía a Caín, reduciendo generación y ampliando reserva de sangre.',
    },
  },
  {
    id: 'mentor',
    varName: 'mentor',
    editions: ['storyteller-v20'],
    group: 'background',
    maxDots: 5,
    aliases: ['mentores'],
    name: {
      'pt-BR': 'Mentor',
      en: 'Mentor',
      es: 'Mentor',
    },
    summary: {
      'pt-BR': 'Ancião ou patrono influente que orienta, protege e ocasionalmente cobra favores.',
      en: 'Influential elder or patron offering counsel, protection, and occasional errands.',
      es: 'Antiguo o mecenas influyente que aconseja, protege y solicita favores.',
    },
  },
  {
    id: 'alternate_identity',
    varName: 'alternate_identity',
    editions: ['storyteller-v20'],
    group: 'background',
    maxDots: 5,
    aliases: ['identidade alternativa', 'identidad alternativa', 'identidade_alternativa'],
    name: {
      'pt-BR': 'Identidade Alternativa',
      en: 'Alternate Identity',
      es: 'Identidad Alternativa',
    },
    summary: {
      'pt-BR': 'Documentos, histórico e fachada civil paralela para operar sob disfarce convincente.',
      en: 'Forged papers, history, and cover identity built to withstand scrutiny.',
      es: 'Documentos, historial y fachada paralela para operar bajo identidad falsa.',
    },
  },

  // V5-Only Backgrounds (2 -> 11 Backgrounds total in V5)
  {
    id: 'mask',
    varName: 'mask',
    editions: ['vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['mascara'],
    name: {
      'pt-BR': 'Máscara',
      en: 'Mask',
      es: 'Máscara',
    },
    summary: {
      'pt-BR': 'Identidade falsa convincente, registros limpos e blindagem contra vigilância moderna.',
      en: 'Convincing false identity with scrubbed records against modern surveillance.',
      es: 'Identidad falsa sólida con registros limpios frente a la vigilancia moderna.',
    },
  },
  {
    id: 'mawla',
    varName: 'mawla',
    editions: ['vampire-v5'],
    group: 'background',
    maxDots: 5,
    aliases: ['mawla'],
    name: {
      'pt-BR': 'Mawla',
      en: 'Mawla',
      es: 'Mawla',
    },
    summary: {
      'pt-BR': 'Vampiro experiente que atua como mentor, aliado sênior ou protetor político na corte.',
      en: 'Seasoned Kindred mentor or political patron guiding and shielding you.',
      es: 'Vástago veterano que actúa como mentor, aliado o protector en la corte.',
    },
  },

  // V5 Core Merits / Advantages (7 -> 18 entries total in V5)
  {
    id: 'linguistics',
    varName: 'linguistics',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['linguistica', 'idiomas'],
    name: {
      'pt-BR': 'Linguística',
      en: 'Linguistics',
      es: 'Lingüística',
    },
    summary: {
      'pt-BR': 'Domínio fluente de idiomas adicionais escritos e falados (1 língua por ponto).',
      en: 'Fluency in reading, writing, and speaking additional languages (1 per dot).',
      es: 'Dominio fluido de idiomas adicionales hablados y escritos (1 por nivel).',
    },
  },
  {
    id: 'looks',
    varName: 'looks',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['aparencia', 'aspecto', 'beautiful', 'stunning'],
    name: {
      'pt-BR': 'Aparência (Mérito)',
      en: 'Looks',
      es: 'Aspecto',
    },
    summary: {
      'pt-BR': 'Beleza ou presença marcante (+1/+2 dados em testes sociais apropriados).',
      en: 'Striking beauty or allure granting +1/+2 dice to relevant Social pools.',
      es: 'Belleza o atractivo destacado (+1/+2 dados en reservas sociales afines).',
    },
  },
  {
    id: 'bond_merit',
    varName: 'bond_merit',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['laco de sangue', 'blood bond merit', 'vinculo de sangre', 'unbondable'],
    name: {
      'pt-BR': 'Laço de Sangue (Mérito)',
      en: 'Blood Bond Merit',
      es: 'Vínculo de Sangre',
    },
    summary: {
      'pt-BR': 'Resistência incomum ou imunidade a Laços de Sangue e domínios de vitae.',
      en: 'Unusual resistance or immunity against Blood Bonds and vitae thralldom.',
      es: 'Resistencia inusual o inmunidad frente a Vínculos de Sangre vampíricos.',
    },
  },
  {
    id: 'feeding_merit',
    varName: 'feeding_merit',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['alimentacao', 'alimentacion', 'iron gullet', 'bloodhound'],
    name: {
      'pt-BR': 'Alimentação (Mérito)',
      en: 'Feeding Merit',
      es: 'Alimentación',
    },
    summary: {
      'pt-BR': 'Adaptações de caça e sustento (Estômago de Ferro, Farejador de Sangue, etc.).',
      en: 'Specialized feeding traits such as Iron Gullet or Bloodhound.',
      es: 'Rasgos especializados de caza y sustento (Estómago de Hierro, Sabueso).',
    },
  },
  {
    id: 'mythic_merit',
    varName: 'mythic_merit',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['mitico', 'mythic', 'eat food', 'blush of health'],
    name: {
      'pt-BR': 'Mítico (Mérito)',
      en: 'Mythic Merit',
      es: 'Mítico',
    },
    summary: {
      'pt-BR': 'Particularidades sobrenaturais da condição vampírica ou tolerância atípica.',
      en: 'Supernatural oddities of the vampiric condition (e.g., Eat Food, Check Pulse).',
      es: 'Peculiaridades sobrenaturales vampíricas o rasgos folclóricos.',
    },
  },
  {
    id: 'loresheet',
    varName: 'loresheet',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['hoja de trasfondo', 'lore sheet', 'folha de lore'],
    name: {
      'pt-BR': 'Loresheet',
      en: 'Loresheet',
      es: 'Hoja de Trasfondo (Loresheet)',
    },
    summary: {
      'pt-BR': 'Vínculos exclusivos com eventos, linhagens ou facções históricas do cenário.',
      en: 'Exclusive ties to canonical lore, bloodlines, and historical factions.',
      es: 'Vínculos exclusivos con eventos, linajes o facciones históricas del entorno.',
    },
  },
  {
    id: 'thin_blood_merit',
    varName: 'thin_blood_merit',
    editions: ['vampire-v5'],
    group: 'merit',
    maxDots: 5,
    aliases: ['sangue-fraco', 'sangue fraco', 'thin blood merit', 'sangre debil', 'day drinker'],
    name: {
      'pt-BR': 'Sangue-Fraco (Mérito)',
      en: 'Thin-Blood Merit',
      es: 'Sangre Débil (Mérito)',
    },
    summary: {
      'pt-BR': 'Dons crepusculares exclusivos de Sangue-Fraco (Andarilho Diurno, Alquimista, etc.).',
      en: 'Duskborn merits exclusive to Thin-Bloods (Day Drinker, Lifelike, Alchemist).',
      es: 'Méritos crepusculares exclusivos de Sangre Débil (Caminante Diurno, etc.).',
    },
  },
];

function normalizeAdvantageKey(input: string): string {
  return normalizeCatalogText(input).replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeAdvantageToken(input: string): string {
  return normalizeAdvantageKey(input).replace(/\s+/g, '_');
}

export function getAdvantagesForEdition(
  edition: WodCatalogEdition,
  group?: WodAdvantageGroup,
): readonly WodAdvantageCatalogEntry[] {
  return WOD_ADVANTAGES_CATALOG.filter(
    (entry) =>
      entry.editions.includes(edition) && (group === undefined || entry.group === group),
  );
}

export function findAdvantageByIdOrName(
  input: string | null | undefined,
  edition?: WodCatalogEdition,
): WodAdvantageCatalogEntry | null {
  if (typeof input !== 'string') return null;
  const norm = normalizeAdvantageKey(input);
  if (!norm) return null;

  const pool = edition ? getAdvantagesForEdition(edition) : WOD_ADVANTAGES_CATALOG;

  for (const entry of pool) {
    const candidates = [
      entry.id,
      entry.varName,
      entry.name['pt-BR'],
      entry.name.en,
      entry.name.es,
      ...(entry.aliases ?? []),
    ];
    if (candidates.some((cand) => normalizeAdvantageKey(cand) === norm)) {
      return entry;
    }
  }
  return null;
}

export function isAdvantageCardCandidate(
  card: Pick<SheetCard, 'id' | 'code' | 'title'>,
): boolean {
  if (card.id === 'card_backgrounds') return true;
  if (card.id === 'card_arcano' || card.id === 'card_grimorio') return false;
  const sig = `${card.code} ${card.title}`.toUpperCase();
  if (/ANTECEDENT|BACKGROUND|VANTAG|ADVANTAGE|TRASFONDO|VENTAJA|LORESHEET/.test(sig)) {
    return true;
  }
  if (/MERIT|MÉRITO/.test(sig) && !/DISCIPLIN|PODER|POWER|ARCANO|GRIMOR/.test(sig)) {
    return true;
  }
  return false;
}

function getAdvantageMatchTokens(adv: WodAdvantageCatalogEntry): Set<string> {
  const tokens = new Set<string>();
  const rawList = [
    adv.varName,
    ...(adv.id !== 'generation' ? [adv.id] : []),
    ...(adv.aliases ?? []),
    ...Object.values(adv.name),
  ];
  for (const raw of rawList) {
    const tok = normalizeAdvantageToken(raw);
    if (tok) tokens.add(tok);
  }
  return tokens;
}

export function isCatalogAdvantagePresent(
  sheet: Pick<CharacterSheetState, 'cards'>,
  advantageId: string,
  edition?: WodCatalogEdition,
): boolean {
  const adv = findAdvantageByIdOrName(advantageId, edition);
  if (!adv) return false;

  const tokens = getAdvantageMatchTokens(adv);
  const expectedAdvId = `f_adv_${adv.varName}`;
  const expectedLegacyBgId = `f_bg_${adv.varName}`;

  for (const card of sheet.cards) {
    const isAdvCard = isAdvantageCardCandidate(card);
    for (const field of card.fields) {
      if (field.id === 'f_generation') continue;
      if (field.id === expectedAdvId || field.id === expectedLegacyBgId) return true;

      const keyToken = normalizeAdvantageToken(field.key);
      if (keyToken === 'generation' && field.xpCategory !== 'advantage' && !isAdvCard) {
        continue;
      }
      if (keyToken && tokens.has(keyToken)) return true;

      if (
        field.xpCategory === 'advantage' ||
        isAdvCard ||
        field.id.startsWith('f_adv_') ||
        field.id.startsWith('f_bg_')
      ) {
        const labelToken = normalizeAdvantageToken(field.label);
        if (labelToken && tokens.has(labelToken)) return true;
      }
    }
  }
  return false;
}

export function isCatalogAdvantagePresentInCardFields(
  advantage: WodAdvantageCatalogEntry,
  cardFields: ReadonlyArray<Pick<SheetField, 'id' | 'key' | 'label' | 'xpCategory'>>,
  variableKeys: Iterable<string> = [],
): boolean {
  const tokens = getAdvantageMatchTokens(advantage);
  const expectedAdvId = `f_adv_${advantage.varName}`;
  const expectedLegacyBgId = `f_bg_${advantage.varName}`;

  for (const field of cardFields) {
    if (field.id === 'f_generation') continue;
    if (field.id === expectedAdvId || field.id === expectedLegacyBgId) return true;
    const keyTok = normalizeAdvantageToken(field.key);
    const labelTok = normalizeAdvantageToken(field.label);
    if (keyTok && tokens.has(keyTok)) return true;
    if (labelTok && tokens.has(labelTok)) return true;
  }

  for (const vKey of variableKeys) {
    const tok = normalizeAdvantageToken(vKey);
    if (!tok || tok === 'generation') continue;
    if (tokens.has(tok)) return true;
  }

  return false;
}

export function buildCatalogAdvantageField(
  advantage: WodAdvantageCatalogEntry,
  lang: AppLanguage,
  initialValue = 1,
): SheetField {
  const maxDots = Math.max(1, Math.min(10, Math.round(advantage.maxDots || 5)));
  const safeInitial = Number.isFinite(initialValue)
    ? Math.max(0, Math.min(maxDots, Math.round(initialValue)))
    : 1;
  const localizedName = (advantage.name[lang] ?? advantage.name.en).toUpperCase();

  return {
    id: `f_adv_${advantage.varName}`,
    key: advantage.varName,
    label: localizedName,
    kind: 'number',
    value: safeInitial,
    max: maxDots,
    xpCategory: 'advantage',
  };
}
