import type { AppLanguage } from './i18n.ts';
import type { CharacterSheetState, SheetCard, SheetField } from './sheetModel.ts';
import { type WodCatalogEdition, normalizeCatalogText } from './wodSkillsCatalog.ts';

export type { WodCatalogEdition };

export type WodAdvantageGroup = 'background' | 'merit' | 'flaw';

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

export type WodHavenTraitKind = 'merit' | 'flaw';

export interface WodHavenTraitCatalogEntry {
  readonly id: string;
  readonly editions: readonly WodCatalogEdition[];
  readonly kind: WodHavenTraitKind;
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
  flaw: {
    'pt-BR': 'Defeitos',
    en: 'Flaws',
    es: 'Defectos',
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

export const WOD_FLAWS_CATALOG: readonly WodAdvantageCatalogEntry[] = [
  // Shared V20 + V5 Flaws (2)
  {
    id: 'prey_exclusion',
    varName: 'prey_exclusion',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['exclusao de presa', 'exclusión de presa', 'prey exclusion'],
    name: {
      'pt-BR': 'Exclusão de Presa',
      en: 'Prey Exclusion',
      es: 'Exclusión de Presa',
    },
    summary: {
      'pt-BR': 'Recusa visceral ou moral em se alimentar de determinado tipo de recipiente mortal.',
      en: 'Strict inability or refusal to feed from a specific category of mortal vessels.',
      es: 'Incapacidad o rechazo estricto a alimentarse de un tipo concreto de recipientes.',
    },
  },
  {
    id: 'dark_secret',
    varName: 'dark_secret',
    editions: ['storyteller-v20', 'vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['segredo sombrio', 'secreto oscuro', 'dark secret'],
    name: {
      'pt-BR': 'Segredo Sombrio',
      en: 'Dark Secret',
      es: 'Secreto Oscuro',
    },
    summary: {
      'pt-BR': 'Crime, violação ou vínculo comprometedor que arruinaria sua posição se exposto.',
      en: 'Compromising crime or secret that would shatter your standing if uncovered.',
      es: 'Crimen o secreto comprometedor que destruiría tu reputación si se descubre.',
    },
  },

  // V5-Only Flaws (10 -> 12 Flaws total in V5)
  {
    id: 'methuselahs_thirst',
    varName: 'methuselahs_thirst',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['sede de matusalem', 'sed de matusalen', "methuselah's thirst"],
    name: {
      'pt-BR': 'Sede de Matusalém',
      en: "Methuselah's Thirst",
      es: 'Sed de Matusalén',
    },
    summary: {
      'pt-BR': 'Sua Fome nunca cai abaixo de 1 sem vitae sobrenatural de outros Membros.',
      en: 'Your Hunger cannot drop below 1 unless quenched by supernatural Kindred vitae.',
      es: 'Tu Ansia no baja de 1 sin beber vitae sobrenatural de otros Vástagos.',
    },
  },
  {
    id: 'folkloric_bane',
    varName: 'folkloric_bane',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['perdicao folclorica', 'perdición folclórica', 'folkloric bane'],
    name: {
      'pt-BR': 'Perdição Folclórica',
      en: 'Folkloric Bane',
      es: 'Perdición Folclórica',
    },
    summary: {
      'pt-BR': 'Símbolos ou elementos míticos clássicos causam dano agravado real ao vampiro.',
      en: 'Traditional folklore weaknesses (silver, garlic, etc.) inflict real Aggravated damage.',
      es: 'Debilidades folclóricas clásicas (plata, ajo, etc.) infligen daño agravado real.',
    },
  },
  {
    id: 'folkloric_block',
    varName: 'folkloric_block',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['bloqueio folclorico', 'bloqueo folclórico', 'folkloric block'],
    name: {
      'pt-BR': 'Bloqueio Folclórico',
      en: 'Folkloric Block',
      es: 'Bloqueo Folclórico',
    },
    summary: {
      'pt-BR': 'Barreiras lendárias (soleiras sem convite, água corrente, símbolos) impedem sua passagem.',
      en: 'Mythic barriers such as uninvited thresholds or running water repel or block you.',
      es: 'Barreras míticas como umbrales sin invitación o agua corriente bloquean tu paso.',
    },
  },
  {
    id: 'stigmata',
    varName: 'stigmata',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['estigmas'],
    name: {
      'pt-BR': 'Estigmas',
      en: 'Stigmata',
      es: 'Estigmas',
    },
    summary: {
      'pt-BR': 'Chagas sangrentas se abrem em Fome elevada (4+), manchando roupas e traindo a Máscara.',
      en: 'Bleeding wounds open at Hunger 4+, soaking clothes and risking Masquerade breaches.',
      es: 'Llagas sangrantes se abren con Ansia 4+, manchando ropas y exponiendo la Mascarada.',
    },
  },
  {
    id: 'known_blankbody',
    varName: 'known_blankbody',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['cadaver conhecido', 'cadáver conocido', 'known blankbody'],
    name: {
      'pt-BR': 'Cadáver Conhecido',
      en: 'Known Blankbody',
      es: 'Cadáver Conocido',
    },
    summary: {
      'pt-BR': 'Agências de caçadores e Segunda Inquisição possuem seus registros biométricos e perfil.',
      en: 'Second Inquisition intelligence holds active biometrics and dossiers identifying you.',
      es: 'La Segunda Inquisición posee tus datos biométricos y un expediente activo.',
    },
  },
  {
    id: 'adversary',
    varName: 'adversary',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['adversario', 'adversário'],
    name: {
      'pt-BR': 'Adversário',
      en: 'Adversary',
      es: 'Adversario',
    },
    summary: {
      'pt-BR': 'Um Membro ou facção rival trabalha ativamente para sabotar e destruir você.',
      en: 'A rival Kindred or faction actively schemes to undermine and destroy you.',
      es: 'Un Vástago o facción rival conspira activamente para arruinarte.',
    },
  },
  {
    id: 'despised',
    varName: 'despised',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['desprezado', 'despreciado'],
    name: {
      'pt-BR': 'Desprezado',
      en: 'Despised',
      es: 'Despreciado',
    },
    summary: {
      'pt-BR': 'Um grupo mortal ou seita inteira guarda rancor profundo e nega ajuda a você.',
      en: 'A specific mortal group or Kindred sect openly despises and shuns you.',
      es: 'Un grupo mortal o secta te desprecia abiertamente y rechaza ayudarte.',
    },
  },
  {
    id: 'suspect',
    varName: 'suspect',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['suspeito', 'sospechoso'],
    name: {
      'pt-BR': 'Suspeito',
      en: 'Suspect',
      es: 'Sospechoso',
    },
    summary: {
      'pt-BR': 'Vigiado de perto pelo Xerife ou baronato após incidentes passados sem provas finais.',
      en: 'Watched closely by the Sheriff or court after unresolved incidents (-2 Social with sect).',
      es: 'Vigilado por el Sheriff o la corte tras incidentes previos sin resolver.',
    },
  },
  {
    id: 'haunted',
    varName: 'haunted',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['assombrado', 'embrujado'],
    name: {
      'pt-BR': 'Assombrado',
      en: 'Haunted',
      es: 'Embrujado',
    },
    summary: {
      'pt-BR': 'Um espectro hostil persegue sua presença, causando ruídos, frio e interferência.',
      en: 'A hostile wraith follows your steps, manifesting cold spots and sabotage.',
      es: 'Un espectro hostil te persigue provocando frío, susurros y sabotajes.',
    },
  },
  {
    id: 'compromised_haven',
    varName: 'compromised_haven',
    editions: ['vampire-v5'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['refugio comprometido', 'refúgio comprometido', 'compromised haven'],
    name: {
      'pt-BR': 'Refúgio Comprometido',
      en: 'Compromised Haven',
      es: 'Refugio Comprometido',
    },
    summary: {
      'pt-BR': 'Seu abrigo já foi localizado ou vigiado por rivais, caçadores ou autoridades.',
      en: 'Your shelter has been spotted or logged by rivals, hunters, or mortal surveillance.',
      es: 'Tu refugio ha sido localizado o vigilado por rivales, cazadores o autoridades.',
    },
  },

  // V20-Only Flaws (8 -> 10 Flaws total in V20)
  {
    id: 'enemy',
    varName: 'enemy',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['inimigo', 'enemigo'],
    name: {
      'pt-BR': 'Inimigo',
      en: 'Enemy',
      es: 'Enemigo',
    },
    summary: {
      'pt-BR': 'Oponente declarado com poder proporcional aos pontos investidos neste defeito.',
      en: 'Declared foe whose influence and lethality scale with the flaw rating.',
      es: 'Oponente declarado cuyo poder e influencia escalan con la puntuación.',
    },
  },
  {
    id: 'hunted',
    varName: 'hunted',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['cacado', 'caçado', 'cazado'],
    name: {
      'pt-BR': 'Caçado',
      en: 'Hunted',
      es: 'Cazado',
    },
    summary: {
      'pt-BR': 'Caçador de vampiros ou Inquisidor incansável segue seu rastro noite após noite.',
      en: 'Relentless vampire hunter or Inquisitor stalks your trail night after night.',
      es: 'Un cazador de vampiros o inquisidor implacable sigue tu rastro cada noche.',
    },
  },
  {
    id: 'nightmares',
    varName: 'nightmares',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['pesadelos', 'pesadillas'],
    name: {
      'pt-BR': 'Pesadelos',
      en: 'Nightmares',
      es: 'Pesadillas',
    },
    summary: {
      'pt-BR': 'Terrores diurnos perturbam o sono vampírico e impõem penalidades na noite seguinte.',
      en: 'Horrific daytime visions disturb your slumber and impose penalties upon waking.',
      es: 'Visiones diurnas perturbadoras afectan tu descanso y penalizan tus reservas.',
    },
  },
  {
    id: 'short_fuse',
    varName: 'short_fuse',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['pavio curto', 'mecha corta', 'short fuse'],
    name: {
      'pt-BR': 'Pavio Curto',
      en: 'Short Fuse',
      es: 'Mecha Corta',
    },
    summary: {
      'pt-BR': 'Dificuldade elevada (+2) em todos os testes para resistir ao Frenesi da Besta.',
      en: 'Increased difficulty (+2 TN) on all Self-Control rolls to resist Frenzy.',
      es: 'Dificultad aumentada (+2) en todas las tiradas para resistir el Frenesí.',
    },
  },
  {
    id: 'bad_sight',
    varName: 'bad_sight',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['visao ruim', 'visão ruim', 'mala vista', 'bad sight'],
    name: {
      'pt-BR': 'Visão Ruim',
      en: 'Bad Sight',
      es: 'Mala Vista',
    },
    summary: {
      'pt-BR': 'Deficiência visual severa (+2 de dificuldade em testes baseados em visão sem correção).',
      en: 'Impaired vision imposing +2 difficulty on sight-based checks without glasses.',
      es: 'Deficiencia visual que impone +2 de dificultad sin lentes correctivos.',
    },
  },
  {
    id: 'repulsive',
    varName: 'repulsive',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['repulsivo'],
    name: {
      'pt-BR': 'Repulsivo',
      en: 'Repulsive',
      es: 'Repulsivo',
    },
    summary: {
      'pt-BR': 'Deformidade marcante que impõe penalidades em Aparência e interações sociais.',
      en: 'Disturbing deformity hindering Appearance and first-impression Social pools.',
      es: 'Deformidad marcada que penaliza Apariencia e interacciones sociales.',
    },
  },
  {
    id: 'cursed',
    varName: 'cursed',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['amaldicoado', 'amaldiçoado', 'maldito'],
    name: {
      'pt-BR': 'Amaldiçoado',
      en: 'Cursed',
      es: 'Maldito',
    },
    summary: {
      'pt-BR': 'Maledicência sobrenatural distorce seus esforços em situações críticas da crônica.',
      en: 'Supernatural hex twists fate against you during pivotal chronicle moments.',
      es: 'Una maldición sobrenatural tuerce el destino en tu contra en momentos clave.',
    },
  },
  {
    id: 'notoriety',
    varName: 'notoriety',
    editions: ['storyteller-v20'],
    group: 'flaw',
    maxDots: 5,
    aliases: ['notoriedade', 'notoriedad'],
    name: {
      'pt-BR': 'Notoriedade',
      en: 'Notoriety',
      es: 'Notoriedad',
    },
    summary: {
      'pt-BR': 'Fama infame entre os Membros por falha grave, traição ou vergonha do Senhor.',
      en: 'Infamous reputation among Kindred due to past disgrace or your Sire’s crimes.',
      es: 'Reputación infame entre los Vástagos por una falta grave o deshonra de tu Sire.',
    },
  },
];

export const WOD_HAVEN_TRAITS_CATALOG: readonly WodHavenTraitCatalogEntry[] = [
  {
    id: 'hidden_armory',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 2,
    aliases: ['arsenal oculto', 'hidden armory'],
    name: {
      'pt-BR': 'Arsenal Oculto',
      en: 'Hidden Armory',
      es: 'Arsenal Oculto',
    },
    summary: {
      'pt-BR': 'Compartimento camuflado com armas de fogo, munição e lâminas táticas.',
      en: 'Concealed cache stocked with firearms, ammunition, and melee weaponry.',
      es: 'Compartimento oculto equipado con armas de fuego, munición y filos.',
    },
  },
  {
    id: 'cell',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 2,
    aliases: ['cela', 'celda', 'cell'],
    name: {
      'pt-BR': 'Cela',
      en: 'Cell',
      es: 'Celda',
    },
    summary: {
      'pt-BR': 'Recinto reforçado para manter prisioneiros mortais ou Membros contidos.',
      en: 'Reinforced containment chamber able to hold mortal or Kindred captives.',
      es: 'Cámara reforzada capaz de retener prisioneros mortales o Vástagos.',
    },
  },
  {
    id: 'watchmen',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 4,
    aliases: ['vigilantes', 'watchmen'],
    name: {
      'pt-BR': 'Vigilantes',
      en: 'Watchmen',
      es: 'Vigilantes',
    },
    summary: {
      'pt-BR': 'Guardas ou sentinelas leais patrulham o perímetro durante o dia e a noite.',
      en: 'Loyal guards or sentries patrolling the haven perimeter day and night.',
      es: 'Guardias o centinelas leales patrullan el perímetro día y noche.',
    },
  },
  {
    id: 'laboratory',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 3,
    aliases: ['laboratorio', 'laboratório', 'laboratory'],
    name: {
      'pt-BR': 'Laboratório',
      en: 'Laboratory',
      es: 'Laboratorio',
    },
    summary: {
      'pt-BR': 'Bancada equipada para Alquimia de Sangue-Fraco, química forense ou ocultismo.',
      en: 'Equipped lab supporting Thin-Blood Alchemy, forensics, or occult research.',
      es: 'Laboratorio equipado para Alquimia de Sangre Débil, ciencia u ocultismo.',
    },
  },
  {
    id: 'library',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 3,
    aliases: ['biblioteca', 'library'],
    name: {
      'pt-BR': 'Biblioteca',
      en: 'Library',
      es: 'Biblioteca',
    },
    summary: {
      'pt-BR': 'Acervo raro de tomos ocultos, arquivos históricos ou bases de dados.',
      en: 'Curated collection of rare occult tomes, archives, or private intelligence.',
      es: 'Colección selecta de tomos ocultos, archivos históricos o bases de datos.',
    },
  },
  {
    id: 'location',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 1,
    aliases: ['localizacao privilegiada', 'localização privilegiada', 'ubicacion privilegiada', 'location'],
    name: {
      'pt-BR': 'Localização Privilegiada',
      en: 'Location',
      es: 'Ubicación Privilegiada',
    },
    summary: {
      'pt-BR': 'Situado em área estratégica da cidade, próximo ao território de caça ou Elysium.',
      en: 'Situated in a prime district near feeding grounds, transit, or Elysium.',
      es: 'Situado en una zona estratégica cercana a cotos de caza o el Elíseo.',
    },
  },
  {
    id: 'luxury',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 3,
    aliases: ['luxo', 'lujo', 'luxury'],
    name: {
      'pt-BR': 'Luxo',
      en: 'Luxury',
      es: 'Lujo',
    },
    summary: {
      'pt-BR': 'Acabamento sofisticado, arte e conforto que elevam status social perante visitas.',
      en: 'Opulent furnishings and prestige elevating Social impressions inside.',
      es: 'Mobiliario opulento y prestigio que mejoran la impresión social.',
    },
  },
  {
    id: 'postern',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 2,
    aliases: ['saida secreta', 'saída secreta', 'salida secreta', 'postern'],
    name: {
      'pt-BR': 'Saída Secreta',
      en: 'Postern',
      es: 'Salida Secreta',
    },
    summary: {
      'pt-BR': 'Rota de fuga discreta por túneis, telhados ou garagem oculta em emergências.',
      en: 'Discreet escape route through tunnels, rooftops, or hidden back exits.',
      es: 'Ruta de escape discreta por túneles, tejados o salidas ocultas.',
    },
  },
  {
    id: 'security_system',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 3,
    aliases: ['sistema de seguranca', 'sistema de segurança', 'sistema de seguridad', 'security system'],
    name: {
      'pt-BR': 'Sistema de Segurança',
      en: 'Security System',
      es: 'Sistema de Seguridad',
    },
    summary: {
      'pt-BR': 'Câmeras, fechaduras biométricas, trancas reforçadas e alarmes contra invasão.',
      en: 'Reinforced locks, cameras, motion sensors, and intrusion alarms.',
      es: 'Cámaras, cerraduras reforzadas, sensores y alarmas anti-intrusión.',
    },
  },
  {
    id: 'surgery',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 2,
    aliases: ['sala cirurgica', 'sala cirúrgica', 'sala quirurgica', 'surgery'],
    name: {
      'pt-BR': 'Sala Cirúrgica',
      en: 'Surgery',
      es: 'Sala Quirúrgica',
    },
    summary: {
      'pt-BR': 'Estação médica estéril para tratar ferimentos de carniçais e aliados mortais.',
      en: 'Sterile medical suite equipped to treat ghouls and mortal retainers.',
      es: 'Suite médica estéril equipada para atender ghouls y criados mortales.',
    },
  },
  {
    id: 'warding',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'merit',
    maxDots: 3,
    aliases: ['protecao mistica', 'proteção mística', 'proteccion mistica', 'warding'],
    name: {
      'pt-BR': 'Proteção Mística',
      en: 'Warding',
      es: 'Protección Mística',
    },
    summary: {
      'pt-BR': 'Selos arcanos, sal ou rituais de Feitiçaria de Sangue contra intrusos sobrenaturais.',
      en: 'Occult wards, runes, or Blood Sorcery seals deterring supernatural intruders.',
      es: 'Sellos arcanos o rituales de Hechicería de Sangre contra intrusos sobrenaturales.',
    },
  },
  {
    id: 'creepy',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'flaw',
    maxDots: 1,
    aliases: ['sinistro', 'siniestro', 'creepy'],
    name: {
      'pt-BR': 'Sinistro',
      en: 'Creepy',
      es: 'Siniestro',
    },
    summary: {
      'pt-BR': 'Atmosfera macabra afasta mortais desavisados e impõe tensão em visitantes.',
      en: 'Unsettling atmosphere repels mortal guests and penalizes social comfort.',
      es: 'Atmósfera macabra que incomoda a visitantes y dificulta interacciones sociales.',
    },
  },
  {
    id: 'haunted',
    editions: ['storyteller-v20', 'vampire-v5'],
    kind: 'flaw',
    maxDots: 1,
    aliases: ['assombrado', 'embrujado', 'haunted'],
    name: {
      'pt-BR': 'Assombrado',
      en: 'Haunted',
      es: 'Embrujado',
    },
    summary: {
      'pt-BR': 'Manifestação sobrenatural assombra os cômodos e ameaça quem repousa no refúgio.',
      en: 'Restless spectral presence haunts the rooms and disturbs daytime shelter.',
      es: 'Presencia espectral inquieta que acecha las estancias del refugio.',
    },
  },
];

function normalizeAdvantageKey(input: string): string {
  return normalizeCatalogText(input).replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeAdvantageToken(input: string): string {
  return normalizeAdvantageKey(input).replace(/\s+/g, '_');
}

function matchCatalogEntryByIdOrName<
  T extends {
    readonly id: string;
    readonly varName?: string;
    readonly aliases?: readonly string[];
    readonly name: Readonly<Record<AppLanguage, string>>;
  },
>(pool: readonly T[], input: string | null | undefined): T | null {
  if (typeof input !== 'string') return null;
  const norm = normalizeAdvantageKey(input);
  if (!norm) return null;

  for (const entry of pool) {
    const candidates = [
      entry.id,
      ...(entry.varName ? [entry.varName] : []),
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

export function getAdvantagesForEdition(
  edition: WodCatalogEdition,
  group?: WodAdvantageGroup,
): readonly WodAdvantageCatalogEntry[] {
  if (group === 'flaw') {
    return getFlawsForEdition(edition);
  }
  return WOD_ADVANTAGES_CATALOG.filter(
    (entry) =>
      entry.editions.includes(edition) && (group === undefined || entry.group === group),
  );
}

export function getFlawsForEdition(
  edition: WodCatalogEdition,
): readonly WodAdvantageCatalogEntry[] {
  return WOD_FLAWS_CATALOG.filter((entry) => entry.editions.includes(edition));
}

export function getHavenTraitsForEdition(
  edition: WodCatalogEdition,
  kind?: WodHavenTraitKind,
): readonly WodHavenTraitCatalogEntry[] {
  return WOD_HAVEN_TRAITS_CATALOG.filter(
    (entry) => entry.editions.includes(edition) && (kind === undefined || entry.kind === kind),
  );
}

export function findAdvantageByIdOrName(
  input: string | null | undefined,
  edition?: WodCatalogEdition,
): WodAdvantageCatalogEntry | null {
  const pool = edition ? getAdvantagesForEdition(edition) : WOD_ADVANTAGES_CATALOG;
  return matchCatalogEntryByIdOrName(pool, input);
}

export function findFlawByIdOrName(
  input: string | null | undefined,
  edition?: WodCatalogEdition,
): WodAdvantageCatalogEntry | null {
  const pool = edition ? getFlawsForEdition(edition) : WOD_FLAWS_CATALOG;
  return matchCatalogEntryByIdOrName(pool, input);
}

export function findHavenTraitByIdOrName(
  input: string | null | undefined,
  edition?: WodCatalogEdition,
): WodHavenTraitCatalogEntry | null {
  const pool = edition ? getHavenTraitsForEdition(edition) : WOD_HAVEN_TRAITS_CATALOG;
  return matchCatalogEntryByIdOrName(pool, input);
}

export function isAdvantageCardCandidate(
  card: Pick<SheetCard, 'id' | 'code' | 'title'>,
): boolean {
  if (card.id === 'card_backgrounds') return true;
  if (card.id === 'card_arcano' || card.id === 'card_grimorio' || card.id === 'card_wod_dossier') {
    return false;
  }
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
