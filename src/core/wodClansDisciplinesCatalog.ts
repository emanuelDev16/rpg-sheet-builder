import type { AppLanguage } from './i18n.ts';
import type { RepeatableRow, SheetCard, SheetField } from './sheetModel.ts';
import { type WodCatalogEdition, normalizeCatalogText } from './wodSkillsCatalog.ts';

export type { WodCatalogEdition };

export type DisciplineAffinity =
  | 'discipline_clan'
  | 'discipline_out_of_clan'
  | 'discipline_caitiff';

export type WodPowerCostType = 'free' | 'rouse' | 'blood_point';

export interface WodV20ClanCatalogEntry {
  readonly id: string;
  readonly edition: 'storyteller-v20';
  readonly name: Readonly<Record<AppLanguage, string>>;
  readonly aliases?: readonly string[];
  readonly clanDisciplines: readonly string[];
  readonly weakness: Readonly<Record<AppLanguage, string>>;
  readonly isCaitiff: boolean;
}

export interface WodV5ClanCatalogEntry {
  readonly id: string;
  readonly edition: 'vampire-v5';
  readonly name: Readonly<Record<AppLanguage, string>>;
  readonly aliases?: readonly string[];
  readonly clanDisciplines: readonly string[];
  readonly bane: Readonly<Record<AppLanguage, string>>;
  readonly compulsion: Readonly<Record<AppLanguage, string>>;
  readonly isCaitiff: boolean;
  readonly isThinBlood: boolean;
}

export type WodClanCatalogEntry = WodV20ClanCatalogEntry | WodV5ClanCatalogEntry;

export interface WodDisciplinePower {
  readonly id: string;
  readonly disciplineId: string;
  readonly edition: WodCatalogEdition;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly name: Readonly<Record<AppLanguage, string>>;
  readonly costType: WodPowerCostType;
  readonly costAmount: number;
  readonly poolHint?: string;
}

export interface WodDisciplineCatalogEntry {
  readonly id: string;
  readonly varName: string;
  readonly editions: readonly WodCatalogEdition[];
  readonly aliases?: readonly string[];
  readonly name: Readonly<Record<AppLanguage, string>>;
  readonly powers: readonly WodDisciplinePower[];
}

export interface ParsedPowerCost {
  costType: WodPowerCostType;
  costAmount: number;
}

export const V20_CLANS_CATALOG: readonly WodV20ClanCatalogEntry[] = [
  {
    id: 'assamite',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Assamita', en: 'Assamite', es: 'Assamita' },
    aliases: ['assamitas'],
    clanDisciplines: ['celerity', 'obfuscate', 'quietus'],
    weakness: {
      'pt-BR': 'Vício em Vitae: ao provar sangue vampírico, testa Autocontrole (Dif 4 + pontos ingeridos) ou entra em compulsão por diablerie.',
      en: 'Addiction to Vitae: tasting Kindred blood triggers a Self-Control test (Diff 4 + Blood Points taken) or forces compulsion to drink more.',
      es: 'Adicción a la Vitae: al probar sangre vampírica, tira Autocontrol (Dif 4 + puntos ingeridos) o cae en compulsión por más sangre.',
    },
    isCaitiff: false,
  },
  {
    id: 'brujah',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Brujah', en: 'Brujah', es: 'Brujah' },
    clanDisciplines: ['celerity', 'potence', 'presence'],
    weakness: {
      'pt-BR': 'Sangue Quente: dificuldade +2 para resistir ou controlar o Frenesi de fúria.',
      en: 'Hot-Blooded: +2 difficulty on rolls to resist or control frenzy.',
      es: 'Sangre Caliente: dificultad +2 en las tiradas para resistir o controlar el frenesí.',
    },
    isCaitiff: false,
  },
  {
    id: 'followers_of_set',
    edition: 'storyteller-v20',
    name: {
      'pt-BR': 'Seguidores de Set',
      en: 'Followers of Set',
      es: 'Seguidores de Set',
    },
    aliases: ['setites', 'setitas', 'setite'],
    clanDisciplines: ['obfuscate', 'presence', 'serpentis'],
    weakness: {
      'pt-BR': 'Sensibilidade à Luz: sofre +2 níveis de dano por luz solar e -1 dado em luz forte.',
      en: 'Light Sensitivity: +2 health levels of damage from sunlight and -1 die penalty in bright light.',
      es: 'Sensibilidad a la Luz: +2 niveles de daño por luz solar y -1 dado bajo luz intensa.',
    },
    isCaitiff: false,
  },
  {
    id: 'gangrel',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Gangrel', en: 'Gangrel', es: 'Gangrel' },
    clanDisciplines: ['animalism', 'fortitude', 'protean'],
    weakness: {
      'pt-BR': 'Marca da Besta: a cada Frenesi adquire um traço animal físico ou comportamental.',
      en: 'Mark of the Beast: each frenzy leaves a permanent or lingering animalistic feature.',
      es: 'Marca de la Bestia: cada frenesí deja un rasgo animal físico o de comportamiento.',
    },
    isCaitiff: false,
  },
  {
    id: 'giovanni',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Giovanni', en: 'Giovanni', es: 'Giovanni' },
    clanDisciplines: ['dominate', 'necromancy', 'potence'],
    weakness: {
      'pt-BR': 'Beijo Doloroso: a mordida causa o dobro de dano ao recipiente e não gera êxtase.',
      en: 'Painful Kiss: the Kiss inflicts twice as much damage and brings agony instead of bliss.',
      es: 'Beso Doloroso: la mordida inflige el doble de daño y causa agonía en lugar de éxtasis.',
    },
    isCaitiff: false,
  },
  {
    id: 'lasombra',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Lasombra', en: 'Lasombra', es: 'Lasombra' },
    clanDisciplines: ['dominate', 'obtenebration', 'potence'],
    weakness: {
      'pt-BR': 'Sem Reflexo: não projeta imagem em espelhos, superfícies refletoras ou gravações ópticas.',
      en: 'No Reflection: casts no reflection in mirrors, water, polished surfaces, or cameras.',
      es: 'Sin Reflejo: no proyecta reflejo en espejos, superficies pulidas ni cámaras.',
    },
    isCaitiff: false,
  },
  {
    id: 'malkavian',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Malkavian', en: 'Malkavian', es: 'Malkavian' },
    aliases: ['malkaviano', 'malkavians'],
    clanDisciplines: ['auspex', 'dementation', 'obfuscate'],
    weakness: {
      'pt-BR': 'Perturbação Incurável: inicia a não-vida com ao menos uma Perturbação mental permanente.',
      en: 'Incurable Derangement: begins unlife with at least one permanent mental derangement.',
      es: 'Trastorno Incurable: comienza la no-vida con al menos un trastorno mental permanente.',
    },
    isCaitiff: false,
  },
  {
    id: 'nosferatu',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Nosferatu', en: 'Nosferatu', es: 'Nosferatu' },
    clanDisciplines: ['animalism', 'obfuscate', 'potence'],
    weakness: {
      'pt-BR': 'Aparência Monstruosa: Aparência fixa em 0; falha automaticamente em testes sociais baseados em Aparência.',
      en: 'Monstrous Visage: Appearance rating is permanently 0; fails Appearance-based social rolls.',
      es: 'Aspecto Monstruoso: Apariencia fijada en 0; falla automáticamente las tiradas basadas en Apariencia.',
    },
    isCaitiff: false,
  },
  {
    id: 'ravnos',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Ravnos', en: 'Ravnos', es: 'Ravnos' },
    clanDisciplines: ['animalism', 'chimerstry', 'fortitude'],
    weakness: {
      'pt-BR': 'Vício Específico: deve testar Autocontrole (Dif 6) para resistir ao seu vício compulsivo predileto.',
      en: 'Specific Vice: must roll Self-Control (Diff 6) to resist indulging a chosen signature vice.',
      es: 'Vicio Específico: debe tirar Autocontrol (Dif 6) para resistirse a su vicio predilecto.',
    },
    isCaitiff: false,
  },
  {
    id: 'toreador',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Toreador', en: 'Toreador', es: 'Toreador' },
    clanDisciplines: ['auspex', 'celerity', 'presence'],
    weakness: {
      'pt-BR': 'Fascinação pela Beleza: fica arrebatado diante de grande beleza e precisa testar Autocontrole (Dif 6) para agir.',
      en: 'Rapt by Beauty: becomes entranced by exquisite beauty until succeeding on Self-Control (Diff 6).',
      es: 'Fascinación por la Belleza: queda cautivado por la belleza excepcional salvo que supere Autocontrol (Dif 6).',
    },
    isCaitiff: false,
  },
  {
    id: 'tremere',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Tremere', en: 'Tremere', es: 'Tremere' },
    clanDisciplines: ['auspex', 'dominate', 'thaumaturgy'],
    weakness: {
      'pt-BR': 'Laço da Pirâmide: suscetibilidade a Laço de Sangue acelerado (dois goles para vinculação aos anciões do clã).',
      en: 'Blood Bond Susceptibility: requires only two drinks of elders’ vitae to form a full Blood Bond.',
      es: 'Vínculo de la Pirámide: solo bastan dos tragos de vitae de antiguos del clan para quedar vinculado.',
    },
    isCaitiff: false,
  },
  {
    id: 'tzimisce',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Tzimisce', en: 'Tzimisce', es: 'Tzimisce' },
    clanDisciplines: ['animalism', 'auspex', 'vicissitude'],
    weakness: {
      'pt-BR': 'Terra Natal: deve dormir cercado por ao menos dois punhados de solo de sua terra natal ou perde metade dos dados.',
      en: 'Native Soil: must rest surrounded by two handfuls of native soil or halve all dice pools.',
      es: 'Tierra Natal: debe descansar junto a dos puñados de tierra natal o ver reducidas sus reservas a la mitad.',
    },
    isCaitiff: false,
  },
  {
    id: 'ventrue',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Ventrue', en: 'Ventrue', es: 'Ventrue' },
    clanDisciplines: ['dominate', 'fortitude', 'presence'],
    weakness: {
      'pt-BR': 'Paladar Refinado: alimenta-se exclusivamente de um tipo específico de recipiente mortal; outro sangue é vomitado.',
      en: 'Refined Palate: can only gain sustenance from a specific type of mortal vessel.',
      es: 'Paladar Refinado: solo puede nutrirse de un tipo específico de recipiente mortal.',
    },
    isCaitiff: false,
  },
  {
    id: 'caitiff',
    edition: 'storyteller-v20',
    name: { 'pt-BR': 'Caitiff', en: 'Caitiff', es: 'Caitiff' },
    aliases: ['sem cla', 'clanless', 'sin clan'],
    clanDisciplines: [],
    weakness: {
      'pt-BR': 'Sem Clã (Sem Fraqueza de Linhagem): todas as Disciplinas custam Nível Atual × 6 XP após a criação.',
      en: 'Clanless: no lineage weakness, but all Disciplines cost Current Rating × 6 XP after creation.',
      es: 'Sin Clan: carece de debilidad de linaje, pero todas las Disciplinas cuestan Nivel Actual × 6 XP.',
    },
    isCaitiff: true,
  },
];

export const V5_CLANS_CATALOG: readonly WodV5ClanCatalogEntry[] = [
  {
    id: 'banu_haqim',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Banu Haqim', en: 'Banu Haqim', es: 'Banu Haqim' },
    aliases: ['banu haqim'],
    clanDisciplines: ['blood_sorcery', 'celerity', 'obfuscate'],
    bane: {
      'pt-BR': 'Sede de Sangue: ao sorver sangue de outro vampiro, faz teste de Frenesi de Fome (Dif 2 + Severidade da Perdição).',
      en: 'Blood Addiction: tasting another vampire’s vitae triggers a Hunger frenzy test (Diff 2 + Bane Severity).',
      es: 'Adicción a la Sangre: probar vitae de otro vampiro provoca tirada de frenesí de Ansia (Dif 2 + Severidad).',
    },
    compulsion: {
      'pt-BR': 'Julgamento: deve punir alguém considerado culpado de uma transgressão moral antes de aliviar a penalidade.',
      en: 'Judgment: compelled to punish someone perceived as guilty of a transgression (-2 dice until resolved).',
      es: 'Juicio: debe castigar a alguien culpable de una transgresión (-2 dados hasta resolverlo).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'brujah',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Brujah', en: 'Brujah', es: 'Brujah' },
    clanDisciplines: ['celerity', 'potence', 'presence'],
    bane: {
      'pt-BR': 'Temperamento Violento: subtrai a Severidade da Perdição dos dados para resistir ao Frenesi de fúria.',
      en: 'Violent Temper: subtract Bane Severity in dice from rolls to resist fury frenzy.',
      es: 'Temperamento Violento: resta la Severidad de la Perdición a las tiradas para resistir el frenesí de furia.',
    },
    compulsion: {
      'pt-BR': 'Rebelião: deve desafiar uma autoridade ou ordem vigente na cena para encerrar a Compulsão.',
      en: 'Rebellion: compelled to take a stand against authority or expectations (-2 dice until fulfilled).',
      es: 'Rebelión: debe desafiar una autoridad o norma vigente (-2 dados hasta cumplirlo).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'gangrel',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Gangrel', en: 'Gangrel', es: 'Gangrel' },
    clanDisciplines: ['animalism', 'fortitude', 'protean'],
    bane: {
      'pt-BR': 'Traços Bestiais: em Frenesi ou Bestial Failure, adquire características animais equivalentes à Severidade da Perdição.',
      en: 'Bestial Features: frenzy or Bestial Failure manifests animal traits equal to Bane Severity (-1 Social/feature).',
      es: 'Rasgos Bestiales: tras un frenesí o fallo bestial manifiesta rasgos animales según la Severidad de Perdición.',
    },
    compulsion: {
      'pt-BR': 'Impulso Feral: age por instinto animal sem fala articulada até o fim da cena.',
      en: 'Feral Impulses: reverts to beastly instincts and non-verbal behavior (-3 dice outside physical survival).',
      es: 'Impulsos Ferales: actúa por instinto animal sin habla compleja durante la escena.',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'hecata',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Hecata', en: 'Hecata', es: 'Hecata' },
    clanDisciplines: ['auspex', 'fortitude', 'oblivion'],
    bane: {
      'pt-BR': 'Beijo Doloroso: o Beijo causa agonia e dano igual à Severidade da Perdição em vez de prazer.',
      en: 'Painful Kiss: feeding causes excruciating pain and harm instead of euphoria, resisting vessels.',
      es: 'Beso Doloroso: al alimentarse inflige agonía y daño en lugar de placer al recipiente.',
    },
    compulsion: {
      'pt-BR': 'Morbidez: obcecado em investigar a morte ou a causa da decadência na cena.',
      en: 'Morbidity: fixated on death, corpses, or impending doom (-2 dice on unrelated actions).',
      es: 'Morbosidad: obsesionado con la muerte y la decadencia (-2 dados en acciones ajenas).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'lasombra',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Lasombra', en: 'Lasombra', es: 'Lasombra' },
    clanDisciplines: ['dominate', 'oblivion', 'potence'],
    bane: {
      'pt-BR': 'Reflexo Distorcido: reflexos e dispositivos digitais falham ou distorcem sua imagem; penalidade com tecnologia.',
      en: 'Distorted Reflection: reflections flicker and touchscreens/microphones fail (penalty equal to Bane Severity).',
      es: 'Reflejo Distorsionado: los reflejos se deforman y la tecnología táctil o digital falla al usarla.',
    },
    compulsion: {
      'pt-BR': 'Implacabilidade: deve superar o próximo obstáculo por qualquer meio impiedoso sem recuar.',
      en: 'Ruthlessness: cannot rest until overcoming the current setback by ruthless means (-2 dice otherwise).',
      es: 'Despiadado: debe superar el obstáculo por medios implacables (-2 dados si evita el conflicto).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'malkavian',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Malkavian', en: 'Malkavian', es: 'Malkavian' },
    aliases: ['malkaviano'],
    clanDisciplines: ['auspex', 'dominate', 'obfuscate'],
    bane: {
      'pt-BR': 'Maldição Fraturada: em Bestial Failure ou Compulsão, sofre penalidade igual à Severidade da Perdição por visões.',
      en: 'Fractured Perspective: suffers Bane Severity penalty to one attribute category during episodes or Bestial Failures.',
      es: 'Perspectiva Fracturada: sufre penalización igual a la Severidad de Perdición por visiones en fallos bestiales.',
    },
    compulsion: {
      'pt-BR': 'Delírio: visões perturbadoras distorcem a percepção (-2 dados fora de testes relacionados à revelação).',
      en: 'Delusion: overwhelming hallucinations distort reality (-2 dice until acting on the vision).',
      es: 'Delirio: alucinaciones intensas distorsionan la percepción (-2 dados hasta actuar según la visión).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'ministry',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Ministério', en: 'The Ministry', es: 'El Ministerio' },
    aliases: ['ministry', 'the ministry', 'ministerio', 'el ministerio'],
    clanDisciplines: ['obfuscate', 'presence', 'protean'],
    bane: {
      'pt-BR': 'Aversão à Luz: sofre penalidade igual à Severidade da Perdição sob iluminação direta ou solar.',
      en: 'Abhorrence of Light: suffers dice penalty equal to Bane Severity in bright or direct light.',
      es: 'Aversión a la Luz: sufre penalización igual a la Severidad de Perdición bajo luz intensa.',
    },
    compulsion: {
      'pt-BR': 'Transgressão: compelido a tentar outro personagem a quebrar uma Convicção ou tabu pessoal.',
      en: 'Transgression: compelled to entice someone into breaking a Chronicle Tenet or personal Conviction.',
      es: 'Transgresión: impelido a tentar a otro personaje a romper una Convicción personal.',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'nosferatu',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Nosferatu', en: 'Nosferatu', es: 'Nosferatu' },
    clanDisciplines: ['animalism', 'obfuscate', 'potence'],
    bane: {
      'pt-BR': 'Repulsivo: Defeito Repulsivo (-2 Sociais) e subtrai Severidade da Perdição ao tentar se disfarçar como humano.',
      en: 'Repulsive: gains the Repulsive Flaw (-2 Social) and subtracts Bane Severity from disguise attempts.',
      es: 'Repulsivo: rasgo Repulsivo (-2 Social) y resta Severidad de Perdición al intentar disfrazarse.',
    },
    compulsion: {
      'pt-BR': 'Criptofilia: obcecado por descobrir segredos ocultos antes de se engajar em ações alheias.',
      en: 'Cryptophilia: consumed by uncovering hidden secrets (-2 dice on actions not pursuing secrets).',
      es: 'Criptofilia: obsesionado con desenterrar secretos ocultos (-2 dados en acciones ajenas).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'ravnos',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Ravnos', en: 'Ravnos', es: 'Ravnos' },
    clanDisciplines: ['animalism', 'obfuscate', 'presence'],
    bane: {
      'pt-BR': 'Perdição do Nômade: dormir no mesmo local por mais de uma semana causa dano agravado.',
      en: 'Doomed Wanderer: resting in the same location repeatedly inflicts Aggravated Health damage equal to Bane Severity.',
      es: 'Perdición del Nómada: dormir en el mismo refugio repetidamente inflige daño agravado.',
    },
    compulsion: {
      'pt-BR': 'Tentando o Destino: deve correr um risco audacioso e desnecessário na primeira oportunidade.',
      en: 'Tempting Fate: driven to take daring risks when faced with danger (-2 dice on cautious plans).',
      es: 'Tentando al Destino: impulsado a asumir un riesgo audaz en lugar de actuar con cautela.',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'salubri',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Salubri', en: 'Salubri', es: 'Salubri' },
    clanDisciplines: ['auspex', 'dominate', 'fortitude'],
    bane: {
      'pt-BR': 'Terceiro Olho & Vitae Irresistível: ativa poderes com suor sanguíneo no terceiro olho e seu sangue atrai outros Membros.',
      en: 'Hunted & Third Eye: Discipline use weeps vitae from the third eye and their blood tempts Kindred.',
      es: 'Tercer Ojo y Sangre Codiciada: al usar Disciplinas llora sangre por el tercer ojo y su vitae tienta a otros.',
    },
    compulsion: {
      'pt-BR': 'Empatia Aflita: compelido a aliviar o sofrimento ou ferimento de outro ser presente na cena.',
      en: 'Affective Empathy: compelled to ease another person’s suffering before focusing on anything else.',
      es: 'Empatía Afligida: impelido a aliviar el sufrimiento de otro ser presente en la escena.',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'toreador',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Toreador', en: 'Toreador', es: 'Toreador' },
    clanDisciplines: ['auspex', 'celerity', 'presence'],
    bane: {
      'pt-BR': 'Estética Arrebatadora: perde dados igual à Severidade da Perdição em ambientes sem beleza ou degradantes.',
      en: 'Aesthetic Fixation: suffers Bane Severity penalty to Disciplines in surroundings lacking beauty.',
      es: 'Fijación Estética: sufre penalización igual a la Severidad de Perdición en entornos feos o decadentes.',
    },
    compulsion: {
      'pt-BR': 'Obsessão: fica hipnotizado por uma obra, pessoa ou sensação até a cena mudar ou ser interrompido.',
      en: 'Obsession: fixated on something beautiful (-2 dice on actions not centered on the object of desire).',
      es: 'Obsesión: hipnotizado por algo hermoso (-2 dados en acciones ajenas al objeto de admiración).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'tremere',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Tremere', en: 'Tremere', es: 'Tremere' },
    clanDisciplines: ['auspex', 'blood_sorcery', 'dominate'],
    bane: {
      'pt-BR': 'Sangue Deficiente: não consegue criar Laços de Sangue com mortais facilmente nem vincular outros vampiros.',
      en: 'Deficient Blood: cannot Blood Bond other Kindred and requires extra drinks to bond mortals.',
      es: 'Sangre Deficiente: incapaz de crear Vínculos de Sangre con otros vampiros; requiere más tragos con mortales.',
    },
    compulsion: {
      'pt-BR': 'Perfeccionismo: -2 dados até repetir ou corrigir um teste com perfeição metódica.',
      en: 'Perfectionism: -2 dice penalty until succeeding flawlessly or re-doing a flawed task.',
      es: 'Perfeccionismo: -2 dados hasta repetir o ejecutar una tarea con precisión impecable.',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'tzimisce',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Tzimisce', en: 'Tzimisce', es: 'Tzimisce' },
    clanDisciplines: ['animalism', 'dominate', 'protean'],
    bane: {
      'pt-BR': 'Aterrado: deve dormir cercado por sua possessão territorial ou carga simbólica escolhida, ou sofre dano de Vontade.',
      en: 'Grounded: must sleep surrounded by their chosen domain or charge, or suffer Aggravated Willpower damage.',
      es: 'Arraigado: debe descansar rodeado de su dominio o carga elegida, o sufrir daño agravado a Voluntad.',
    },
    compulsion: {
      'pt-BR': 'Cobiça: compelido a reivindicar posse sobre algo valioso ou intrusivo em seu domínio.',
      en: 'Covetousness: driven to possess an item, person, or territory (-2 dice otherwise).',
      es: 'Codicia: impulsado a reclamar posesión sobre un objeto, persona o territorio.',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'ventrue',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Ventrue', en: 'Ventrue', es: 'Ventrue' },
    clanDisciplines: ['dominate', 'fortitude', 'presence'],
    bane: {
      'pt-BR': 'Paladar Restrito: só se alimenta de um tipo específico de presa; outros vasos exigem gasto de Vontade igual à Severidade.',
      en: 'Rarefied Tastes: can feed only on a narrow mortal preference unless spending Willpower equal to Bane Severity.',
      es: 'Paladar Exquisito: solo se nutre de un tipo específico de presa salvo que gaste Voluntad.',
    },
    compulsion: {
      'pt-BR': 'Arrogância: deve fazer alguém se submeter ou obedecer a uma ordem direta na cena.',
      en: 'Arrogance: must compel another person to obey a command (-2 dice on non-leadership actions).',
      es: 'Arrogancia: debe lograr que alguien obedezca una orden directa (-2 dados en otras acciones).',
    },
    isCaitiff: false,
    isThinBlood: false,
  },
  {
    id: 'caitiff',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Caitiff', en: 'Caitiff', es: 'Caitiff' },
    aliases: ['sem cla', 'clanless', 'sin clan'],
    clanDisciplines: [],
    bane: {
      'pt-BR': 'Suspeito & Sem Linhagem: Defeito Suspeito (-2 Sociais com vampiros); todas as Disciplinas custam Novo Nível × 6 XP.',
      en: 'Suspect Flaw: mistrusted by Kindred society; all Disciplines cost New Level × 6 XP.',
      es: 'Estigma Caitiff: sufre desconfianza en la sociedad vampírica; toda Disciplina cuesta Nuevo Nivel × 6 XP.',
    },
    compulsion: {
      'pt-BR': 'Sobrevivência Pragmática: adapta-se ao estigma sem compulsão fixa de clã.',
      en: 'Pragmatic Survival: suffers standard Beast compulsions without a fixed clan compulsion.',
      es: 'Supervivencia Pragmática: carece de compulsión fija de clan; responde al impulso de la Bestia.',
    },
    isCaitiff: true,
    isThinBlood: false,
  },
  {
    id: 'thin_blood',
    edition: 'vampire-v5',
    name: { 'pt-BR': 'Sangue-Fraco', en: 'Thin-Blood', es: 'Sangre Débil' },
    aliases: ['thin blood', 'thin-blood', 'sangue fraco', 'sangre debil', 'duskborn'],
    clanDisciplines: ['thin_blood_alchemy'],
    bane: {
      'pt-BR': 'Sangue Ralo: Potência do Sangue fixa em 0; Disciplinas tradicionais só via Ressonância ou Alquimia do Sangue-Fraco.',
      en: 'Weak Blood: Blood Potency remains 0; gains temporary Disciplines via Resonance or Thin-Blood Alchemy.',
      es: 'Sangre Débil: Potencia de Sangre fijada en 0; solo accede a Alquimia de Sangre Débil o Resonancia.',
    },
    compulsion: {
      'pt-BR': 'Instabilidade Crepuscular: busca validação mortal ou sobrevivência à margem da Máscara.',
      en: 'Twilight Instability: no fixed clan compulsion; navigates the margin between mortal and Kindred.',
      es: 'Inestabilidad Crepuscular: sin compulsión fija de clan; busca sobrevivir entre mortales y Vástagos.',
    },
    isCaitiff: false,
    isThinBlood: true,
  },
];

export const WOD_DISCIPLINES_CATALOG: readonly WodDisciplineCatalogEntry[] = [
  {
    id: 'animalism',
    varName: 'animalism',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['animalismo'],
    name: { 'pt-BR': 'Animalismo', en: 'Animalism', es: 'Animalismo' },
    powers: [
      {
        id: 'v20_animalism_feral_whispers',
        disciplineId: 'animalism',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Sussurros Feras', en: 'Feral Whispers', es: 'Susurros Salvajes' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + animal_ken',
      },
      {
        id: 'v20_animalism_beckoning',
        disciplineId: 'animalism',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'O Chamado', en: 'The Beckoning', es: 'La Llamada' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'charisma + survival',
      },
      {
        id: 'v20_animalism_quell_the_beast',
        disciplineId: 'animalism',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Acalmar a Besta', en: 'Quell the Beast', es: 'Calmar a la Bestia' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'manipulation + intimidation',
      },
      {
        id: 'v20_animalism_subsume_the_spirit',
        disciplineId: 'animalism',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Subjugar o Espírito', en: 'Subsume the Spirit', es: 'Subsumir el Espíritu' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + animal_ken',
      },
      {
        id: 'v20_animalism_drawing_out_the_beast',
        disciplineId: 'animalism',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Libertar a Besta', en: 'Drawing Out the Beast', es: 'Liberar a la Bestia' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'manipulation + empathy',
      },
      {
        id: 'v5_animalism_bond_famulus',
        disciplineId: 'animalism',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Vincular Fâmulo', en: 'Bond Famulus', es: 'Vincular Familiar' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'charisma + animal_ken',
      },
      {
        id: 'v5_animalism_sense_the_beast',
        disciplineId: 'animalism',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Sentir a Besta', en: 'Sense the Beast', es: 'Sentir a la Bestia' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'resolve + animalism',
      },
      {
        id: 'v5_animalism_feral_whispers',
        disciplineId: 'animalism',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Sussurros Selvagens', en: 'Feral Whispers', es: 'Susurros Salvajes' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'manipulation + animalism',
      },
      {
        id: 'v5_animalism_quell_the_beast',
        disciplineId: 'animalism',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Acalmar a Besta', en: 'Quell the Beast', es: 'Aplacar a la Bestia' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'charisma + animalism',
      },
      {
        id: 'v5_animalism_subsume_the_spirit',
        disciplineId: 'animalism',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Subsumir o Espírito', en: 'Subsume the Spirit', es: 'Subsumir el Espíritu' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'manipulation + animalism',
      },
      {
        id: 'v5_animalism_animal_dominion',
        disciplineId: 'animalism',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Domínio Animal', en: 'Animal Dominion', es: 'Dominio Animal' },
        costType: 'rouse',
        costAmount: 2,
        poolHint: 'charisma + animalism',
      },
    ],
  },
  {
    id: 'auspex',
    varName: 'auspex',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['auspicios'],
    name: { 'pt-BR': 'Auspícios', en: 'Auspex', es: 'Auspex' },
    powers: [
      {
        id: 'v20_auspex_heightened_senses',
        disciplineId: 'auspex',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Sentidos Aguçados', en: 'Heightened Senses', es: 'Sentidos Aguzados' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_auspex_aura_perception',
        disciplineId: 'auspex',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Percepção da Aura', en: 'Aura Perception', es: 'Percepción del Aura' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'perception + empathy',
      },
      {
        id: 'v20_auspex_spirits_touch',
        disciplineId: 'auspex',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'O Toque do Espírito', en: "The Spirit's Touch", es: 'El Toque del Espíritu' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'perception + empathy',
      },
      {
        id: 'v20_auspex_telepathy',
        disciplineId: 'auspex',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Telepatia', en: 'Telepathy', es: 'Telepatía' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'intelligence + subterfuge',
      },
      {
        id: 'v20_auspex_psychic_projection',
        disciplineId: 'auspex',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Projeção Psíquica', en: 'Psychic Projection', es: 'Proyección Psíquica' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'perception + occult',
      },
      {
        id: 'v5_auspex_heightened_senses',
        disciplineId: 'auspex',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Sentidos Aguçados', en: 'Heightened Senses', es: 'Sentidos Aguzados' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'wits + resolve',
      },
      {
        id: 'v5_auspex_premonition',
        disciplineId: 'auspex',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Premonição', en: 'Premonition', es: 'Premonición' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'resolve + auspex',
      },
      {
        id: 'v5_auspex_scry_the_soul',
        disciplineId: 'auspex',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Ler a Alma', en: 'Scry the Soul', es: 'Escrutar el Alma' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'intelligence + auspex',
      },
      {
        id: 'v5_auspex_spirits_touch',
        disciplineId: 'auspex',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Toque do Espírito', en: "Spirit's Touch", es: 'Toque del Espíritu' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'intelligence + auspex',
      },
      {
        id: 'v5_auspex_telepathy',
        disciplineId: 'auspex',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Telepatia', en: 'Telepathy', es: 'Telepatía' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'resolve + auspex',
      },
    ],
  },
  {
    id: 'celerity',
    varName: 'celerity',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['rapidez', 'celeridad'],
    name: { 'pt-BR': 'Rapidez', en: 'Celerity', es: 'Celeridad' },
    powers: [
      {
        id: 'v20_celerity_surge',
        disciplineId: 'celerity',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Ação Extra (Rapidez)', en: 'Extra Actions', es: 'Acciones Extra' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_celerity_reflex_boost',
        disciplineId: 'celerity',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Rajada de Velocidade', en: 'Burst of Speed', es: 'Estallido de Velocidad' },
        costType: 'blood_point',
        costAmount: 2,
      },
      {
        id: 'v5_celerity_cats_grace',
        disciplineId: 'celerity',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Graça Felina', en: "Cat's Grace", es: 'Gracia Felina' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_celerity_fleetness',
        disciplineId: 'celerity',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Agilidade', en: 'Fleetness', es: 'Presteza' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_celerity_blink',
        disciplineId: 'celerity',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Piscar', en: 'Blink', es: 'Parpadeo' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'dexterity + athletics',
      },
      {
        id: 'v5_celerity_unerring_aim',
        disciplineId: 'celerity',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Mira Infalível', en: 'Unerring Aim', es: 'Puntería Infalible' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_celerity_split_second',
        disciplineId: 'celerity',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Fração de Segundo', en: 'Split Second', es: 'Fracción de Segundo' },
        costType: 'rouse',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'dominate',
    varName: 'dominate',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['dominacao', 'dominacion'],
    name: { 'pt-BR': 'Dominação', en: 'Dominate', es: 'Dominación' },
    powers: [
      {
        id: 'v20_dominate_command',
        disciplineId: 'dominate',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Comando', en: 'Command', es: 'Mandato' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + intimidation',
      },
      {
        id: 'v20_dominate_mesmerize',
        disciplineId: 'dominate',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Hipnotizar', en: 'Mesmerize', es: 'Hipnotizar' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + leadership',
      },
      {
        id: 'v20_dominate_forgetful_mind',
        disciplineId: 'dominate',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Mente Esquecida', en: 'The Forgetful Mind', es: 'La Mente Olvidadiza' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + subterfuge',
      },
      {
        id: 'v20_dominate_conditioning',
        disciplineId: 'dominate',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Condicionamento', en: 'Conditioning', es: 'Condicionamiento' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'charisma + leadership',
      },
      {
        id: 'v20_dominate_possession',
        disciplineId: 'dominate',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Possessão', en: 'Possession', es: 'Posesión' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'charisma + intimidation',
      },
      {
        id: 'v5_dominate_cloud_memory',
        disciplineId: 'dominate',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Turvar Memória', en: 'Cloud Memory', es: 'Nublar Memoria' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'charisma + dominate',
      },
      {
        id: 'v5_dominate_compel',
        disciplineId: 'dominate',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Compelir', en: 'Compel', es: 'Compeler' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'charisma + dominate',
      },
      {
        id: 'v5_dominate_mesmerize',
        disciplineId: 'dominate',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Hipnotizar', en: 'Mesmerize', es: 'Hipnotizar' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'manipulation + dominate',
      },
      {
        id: 'v5_dominate_the_forgetful_mind',
        disciplineId: 'dominate',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Mente Esquecida', en: 'The Forgetful Mind', es: 'Mente Olvidadiza' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'manipulation + dominate',
      },
      {
        id: 'v5_dominate_rationalize',
        disciplineId: 'dominate',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Racionalizar', en: 'Rationalize', es: 'Racionalizar' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_dominate_mass_manipulation',
        disciplineId: 'dominate',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Manipulação em Massa', en: 'Mass Manipulation', es: 'Manipulación en Masa' },
        costType: 'rouse',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'fortitude',
    varName: 'fortitude',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['fortaleza'],
    name: { 'pt-BR': 'Fortitude', en: 'Fortitude', es: 'Fortaleza' },
    powers: [
      {
        id: 'v20_fortitude_soak_passive',
        disciplineId: 'fortitude',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Resistência Sobrenatural', en: 'Supernatural Resilience', es: 'Resistencia Sobrenatural' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'stamina + fortitude',
      },
      {
        id: 'v20_fortitude_armored_vitality',
        disciplineId: 'fortitude',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Armadura de Vitae', en: 'Blood Endurance', es: 'Resistencia de Vitae' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v5_fortitude_resilience',
        disciplineId: 'fortitude',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Resiliência', en: 'Resilience', es: 'Resiliencia' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_fortitude_toughness',
        disciplineId: 'fortitude',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Tenacidade', en: 'Toughness', es: 'Dureza' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_fortitude_defy_bane',
        disciplineId: 'fortitude',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Desafiar Perdição', en: 'Defy Bane', es: 'Desafiar Perdición' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'wits + survival',
      },
      {
        id: 'v5_fortitude_shatter',
        disciplineId: 'fortitude',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Estilhaçar', en: 'Shatter', es: 'Hacer Añicos' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_fortitude_prowess_from_pain',
        disciplineId: 'fortitude',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Proeza na Dor', en: 'Prowess from Pain', es: 'Proeza en el Dolor' },
        costType: 'rouse',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'obfuscate',
    varName: 'obfuscate',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['ofuscacao', 'ofuscacion'],
    name: { 'pt-BR': 'Ofuscação', en: 'Obfuscate', es: 'Ofuscación' },
    powers: [
      {
        id: 'v20_obfuscate_cloak_of_shadows',
        disciplineId: 'obfuscate',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Manto das Sombras', en: 'Cloak of Shadows', es: 'Capa de las Sombras' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_obfuscate_unseen_presence',
        disciplineId: 'obfuscate',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Presença Invisível', en: 'Unseen Presence', es: 'Presencia Invisible' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'wits + stealth',
      },
      {
        id: 'v20_obfuscate_mask_thousand_faces',
        disciplineId: 'obfuscate',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Máscara das Mil Faces', en: 'Mask of a Thousand Faces', es: 'Máscara de las Mil Caras' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + performance',
      },
      {
        id: 'v20_obfuscate_vanish',
        disciplineId: 'obfuscate',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Desaparecer da Mente', en: "Vanish from the Mind's Eye", es: 'Desvanecerse de la Mente' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'charisma + stealth',
      },
      {
        id: 'v20_obfuscate_cloak_the_gathering',
        disciplineId: 'obfuscate',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Ocultar o Grupo', en: 'Cloak the Gathering', es: 'Ocultar la Reunión' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v5_obfuscate_cloak_of_shadows',
        disciplineId: 'obfuscate',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Manto das Sombras', en: 'Cloak of Shadows', es: 'Capa de las Sombras' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_obfuscate_unseen_passage',
        disciplineId: 'obfuscate',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Passagem Invisível', en: 'Unseen Passage', es: 'Paso Invisible' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_obfuscate_ghost_in_the_machine',
        disciplineId: 'obfuscate',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Fantasma na Máquina', en: 'Ghost in the Machine', es: 'Fantasma en la Máquina' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_obfuscate_vanish',
        disciplineId: 'obfuscate',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Desvanecer', en: 'Vanish', es: 'Desvanecerse' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'wits + obfuscate',
      },
      {
        id: 'v5_obfuscate_cloak_the_gathering',
        disciplineId: 'obfuscate',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Ocultar o Grupo', en: 'Cloak the Gathering', es: 'Ocultar al Grupo' },
        costType: 'rouse',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'potence',
    varName: 'potence',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['potencia'],
    name: { 'pt-BR': 'Potência', en: 'Potence', es: 'Potencia' },
    powers: [
      {
        id: 'v20_potence_passive_might',
        disciplineId: 'potence',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Força Sobrenatural', en: 'Prodigious Strength', es: 'Fuerza Sobrenatural' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_potence_auto_successes',
        disciplineId: 'potence',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Golpe Devastador', en: 'Blood-Powered Might', es: 'Impacto Devastador' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v5_potence_lethal_body',
        disciplineId: 'potence',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Corpo Letal', en: 'Lethal Body', es: 'Cuerpo Letal' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_potence_prowess',
        disciplineId: 'potence',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Proeza', en: 'Prowess', es: 'Proeza' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_potence_brutal_feed',
        disciplineId: 'potence',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Alimentação Brutal', en: 'Brutal Feed', es: 'Alimentación Brutal' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_potence_draught_of_might',
        disciplineId: 'potence',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Gole de Poder', en: 'Draught of Might', es: 'Trago de Poder' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_potence_earthshock',
        disciplineId: 'potence',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Choque Sísmico', en: 'Earthshock', es: 'Terremoto' },
        costType: 'rouse',
        costAmount: 2,
      },
    ],
  },
  {
    id: 'presence',
    varName: 'presence',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['presenca', 'presencia'],
    name: { 'pt-BR': 'Presença', en: 'Presence', es: 'Presencia' },
    powers: [
      {
        id: 'v20_presence_awe',
        disciplineId: 'presence',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Fascínio', en: 'Awe', es: 'Fascinación' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'charisma + performance',
      },
      {
        id: 'v20_presence_dread_gaze',
        disciplineId: 'presence',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Olhar Aterrorizante', en: 'Dread Gaze', es: 'Mirada Aterradora' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'charisma + intimidation',
      },
      {
        id: 'v20_presence_entrancement',
        disciplineId: 'presence',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Transe', en: 'Entrancement', es: 'Encantamiento' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'appearance + empathy',
      },
      {
        id: 'v20_presence_summon',
        disciplineId: 'presence',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Convocação', en: 'Summon', es: 'Convocatoria' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'charisma + subterfuge',
      },
      {
        id: 'v20_presence_majesty',
        disciplineId: 'presence',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Majestade', en: 'Majesty', es: 'Majestad' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_presence_awe',
        disciplineId: 'presence',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Fascínio', en: 'Awe', es: 'Fascinación' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + presence',
      },
      {
        id: 'v5_presence_daunt',
        disciplineId: 'presence',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Intimidar', en: 'Daunt', es: 'Amedrentar' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_presence_lingering_kiss',
        disciplineId: 'presence',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Beijo Persistente', en: 'Lingering Kiss', es: 'Beso Persistente' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_presence_dread_gaze',
        disciplineId: 'presence',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Olhar Aterrorizante', en: 'Dread Gaze', es: 'Mirada Aterradora' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'charisma + presence',
      },
      {
        id: 'v5_presence_irresistible_voice',
        disciplineId: 'presence',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Voz Irresistível', en: 'Irresistible Voice', es: 'Voz Irresistible' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_presence_majesty',
        disciplineId: 'presence',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Majestade', en: 'Majesty', es: 'Majestad' },
        costType: 'rouse',
        costAmount: 2,
        poolHint: 'charisma + presence',
      },
    ],
  },
  {
    id: 'protean',
    varName: 'protean',
    editions: ['storyteller-v20', 'vampire-v5'],
    aliases: ['metamorfose'],
    name: { 'pt-BR': 'Metamorfose', en: 'Protean', es: 'Protean' },
    powers: [
      {
        id: 'v20_protean_eyes_of_the_beast',
        disciplineId: 'protean',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Olhos da Besta', en: 'Eyes of the Beast', es: 'Ojos de la Bestia' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_protean_feral_claws',
        disciplineId: 'protean',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Garras da Besta', en: 'Feral Claws', es: 'Garras de la Bestia' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_protean_earth_meld',
        disciplineId: 'protean',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Fusão com a Terra', en: 'Earth Meld', es: 'Fusión con la Tierra' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_protean_shape_of_the_beast',
        disciplineId: 'protean',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Forma da Besta', en: 'Shape of the Beast', es: 'Forma de la Bestia' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_protean_mist_form',
        disciplineId: 'protean',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Forma de Névoa', en: 'Mist Form', es: 'Forma de Niebla' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v5_protean_eyes_of_the_beast',
        disciplineId: 'protean',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Olhos da Besta', en: 'Eyes of the Beast', es: 'Ojos de la Bestia' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_protean_feral_weapons',
        disciplineId: 'protean',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Armas Ferais', en: 'Feral Weapons', es: 'Armas Ferales' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_protean_earth_meld',
        disciplineId: 'protean',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Fusão com a Terra', en: 'Earth Meld', es: 'Fusión con la Tierra' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_protean_metamorphosis',
        disciplineId: 'protean',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Metamorfose', en: 'Metamorphosis', es: 'Metamorfosis' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_protean_mist_form',
        disciplineId: 'protean',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Forma de Névoa', en: 'Mist Form', es: 'Forma de Niebla' },
        costType: 'rouse',
        costAmount: 2,
      },
    ],
  },
  // V5-specific disciplines
  {
    id: 'blood_sorcery',
    varName: 'blood_sorcery',
    editions: ['vampire-v5'],
    aliases: ['feiticaria de sangue', 'hechiceria de sangre', 'blood sorcery'],
    name: {
      'pt-BR': 'Feitiçaria de Sangue',
      en: 'Blood Sorcery',
      es: 'Hechicería de Sangre',
    },
    powers: [
      {
        id: 'v5_blood_sorcery_corrosive_vitae',
        disciplineId: 'blood_sorcery',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Vitae Corrosiva', en: 'Corrosive Vitae', es: 'Vitae Corrosiva' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_blood_sorcery_taste_for_blood',
        disciplineId: 'blood_sorcery',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Gosto pelo Sangue', en: 'A Taste for Blood', es: 'Gusto por la Sangre' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'resolve + blood_sorcery',
      },
      {
        id: 'v5_blood_sorcery_extinguish_vitae',
        disciplineId: 'blood_sorcery',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Extinguir Vitae', en: 'Extinguish Vitae', es: 'Extinguir Vitae' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'intelligence + blood_sorcery',
      },
      {
        id: 'v5_blood_sorcery_blood_of_potency',
        disciplineId: 'blood_sorcery',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Sangue de Potência', en: 'Blood of Potency', es: 'Sangre de Potencia' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'resolve + blood_sorcery',
      },
      {
        id: 'v5_blood_sorcery_theft_of_vitae',
        disciplineId: 'blood_sorcery',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Roubo de Vitae', en: 'Theft of Vitae', es: 'Robo de Vitae' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'wits + blood_sorcery',
      },
      {
        id: 'v5_blood_sorcery_baals_caress',
        disciplineId: 'blood_sorcery',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Carícia de Baal', en: "Baal's Caress", es: 'Caricia de Baal' },
        costType: 'rouse',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'oblivion',
    varName: 'oblivion',
    editions: ['vampire-v5'],
    aliases: ['obliteracao', 'olvido'],
    name: { 'pt-BR': 'Obliteração', en: 'Oblivion', es: 'Olvido' },
    powers: [
      {
        id: 'v5_oblivion_shadow_cloak',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Manto de Sombras', en: 'Shadow Cloak', es: 'Manto de Sombras' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v5_oblivion_ashes_to_ashes',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Cinzas às Cinzas', en: 'Ashes to Ashes', es: 'Cenizas a las Cenizas' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_oblivion_shadow_cast',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Projetar Sombra', en: 'Shadow Cast', es: 'Proyectar Sombra' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_oblivion_arms_of_ahriman',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Braços de Ahriman', en: 'Arms of Ahriman', es: 'Brazos de Ahriman' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'wits + oblivion',
      },
      {
        id: 'v5_oblivion_shadow_perspective',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Perspectiva Sombria', en: 'Shadow Perspective', es: 'Perspectiva Sombría' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_oblivion_stygian_shroud',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Sudário Estígio', en: 'Stygian Shroud', es: 'Sudario Estigio' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_oblivion_tenebrous_avatar',
        disciplineId: 'oblivion',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Avatar Tenebroso', en: 'Tenebrous Avatar', es: 'Avatar Tenebroso' },
        costType: 'rouse',
        costAmount: 2,
      },
    ],
  },
  {
    id: 'thin_blood_alchemy',
    varName: 'thin_blood_alchemy',
    editions: ['vampire-v5'],
    aliases: ['alquimia sangue fraco', 'alquimia de sangue-fraco', 'alquimia de sangre debil'],
    name: {
      'pt-BR': 'Alquimia do Sangue-Fraco',
      en: 'Thin-Blood Alchemy',
      es: 'Alquimia de Sangre Débil',
    },
    powers: [
      {
        id: 'v5_tba_haze',
        disciplineId: 'thin_blood_alchemy',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Bruma', en: 'Haze', es: 'Bruma' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_tba_far_reach',
        disciplineId: 'thin_blood_alchemy',
        edition: 'vampire-v5',
        level: 1,
        name: { 'pt-BR': 'Alcance Distante', en: 'Far Reach', es: 'Alcance Lejano' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'resolve + thin_blood_alchemy',
      },
      {
        id: 'v5_tba_envelop',
        disciplineId: 'thin_blood_alchemy',
        edition: 'vampire-v5',
        level: 2,
        name: { 'pt-BR': 'Envolver', en: 'Envelop', es: 'Envolver' },
        costType: 'rouse',
        costAmount: 1,
        poolHint: 'wits + thin_blood_alchemy',
      },
      {
        id: 'v5_tba_profane_hieros_gamos',
        disciplineId: 'thin_blood_alchemy',
        edition: 'vampire-v5',
        level: 3,
        name: { 'pt-BR': 'Hieros Gamos Profano', en: 'Profane Hieros Gamos', es: 'Hieros Gamos Profano' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_tba_airborne_momentum',
        disciplineId: 'thin_blood_alchemy',
        edition: 'vampire-v5',
        level: 4,
        name: { 'pt-BR': 'Impulso Aéreo', en: 'Airborne Momentum', es: 'Impulso Aéreo' },
        costType: 'rouse',
        costAmount: 1,
      },
      {
        id: 'v5_tba_awaken_the_sleeper',
        disciplineId: 'thin_blood_alchemy',
        edition: 'vampire-v5',
        level: 5,
        name: { 'pt-BR': 'Despertar o Adormecido', en: 'Awaken the Sleeper', es: 'Despertar al Durmiente' },
        costType: 'rouse',
        costAmount: 2,
      },
    ],
  },
  // V20-specific disciplines
  {
    id: 'chimerstry',
    varName: 'chimerstry',
    editions: ['storyteller-v20'],
    aliases: ['quimera', 'quimerismo'],
    name: { 'pt-BR': 'Quimerismo', en: 'Chimerstry', es: 'Quimerismo' },
    powers: [
      {
        id: 'v20_chimerstry_ignis_fatuus',
        disciplineId: 'chimerstry',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Fogo-Fátuo', en: 'Ignis Fatuus', es: 'Fuego Fatuo' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_chimerstry_fata_morgana',
        disciplineId: 'chimerstry',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Fata Morgana', en: 'Fata Morgana', es: 'Fata Morgana' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_chimerstry_apparition',
        disciplineId: 'chimerstry',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Aparição', en: 'Apparition', es: 'Aparición' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_chimerstry_horrid_reality',
        disciplineId: 'chimerstry',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Realidade Horrenda', en: 'Horrid Reality', es: 'Realidad Horrenda' },
        costType: 'blood_point',
        costAmount: 2,
        poolHint: 'manipulation + subterfuge',
      },
    ],
  },
  {
    id: 'dementation',
    varName: 'dementation',
    editions: ['storyteller-v20'],
    aliases: ['demencia'],
    name: { 'pt-BR': 'Demência', en: 'Dementation', es: 'Dementación' },
    powers: [
      {
        id: 'v20_dementation_passion',
        disciplineId: 'dementation',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Paixão', en: 'Passion', es: 'Pasión' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'charisma + empathy',
      },
      {
        id: 'v20_dementation_haunting',
        disciplineId: 'dementation',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'A Alma Assombrada', en: 'The Haunting', es: 'El Acecho del Alma' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'manipulation + subterfuge',
      },
      {
        id: 'v20_dementation_eyes_of_chaos',
        disciplineId: 'dementation',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Olhos do Caos', en: 'Eyes of Chaos', es: 'Ojos del Caos' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'perception + occult',
      },
      {
        id: 'v20_dementation_total_insanity',
        disciplineId: 'dementation',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Insanidade Total', en: 'Total Insanity', es: 'Locura Total' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'manipulation + intimidation',
      },
    ],
  },
  {
    id: 'necromancy',
    varName: 'necromancy',
    editions: ['storyteller-v20'],
    aliases: ['necromancia'],
    name: { 'pt-BR': 'Necromancia', en: 'Necromancy', es: 'Nigromancia' },
    powers: [
      {
        id: 'v20_necromancy_insight',
        disciplineId: 'necromancy',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Visão da Mortalha', en: 'Insight', es: 'Perspicacia Mortuoria' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'perception + occult',
      },
      {
        id: 'v20_necromancy_summon_soul',
        disciplineId: 'necromancy',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Convocar Alma', en: 'Summon Soul', es: 'Convocar Alma' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'perception + occult',
      },
      {
        id: 'v20_necromancy_compel_soul',
        disciplineId: 'necromancy',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Compelir Alma', en: 'Compel Soul', es: 'Compeler Alma' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'manipulation + occult',
      },
      {
        id: 'v20_necromancy_haunting',
        disciplineId: 'necromancy',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Assombração', en: 'Haunting', es: 'Posesión Espectral' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_necromancy_torment',
        disciplineId: 'necromancy',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Tormento', en: 'Torment', es: 'Tormento' },
        costType: 'blood_point',
        costAmount: 2,
      },
    ],
  },
  {
    id: 'obtenebration',
    varName: 'obtenebration',
    editions: ['storyteller-v20'],
    aliases: ['tenebrosidade', 'obtenebracion'],
    name: { 'pt-BR': 'Tenebrosidade', en: 'Obtenebration', es: 'Obtenebración' },
    powers: [
      {
        id: 'v20_obtenebration_shadow_play',
        disciplineId: 'obtenebration',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Jogo de Sombras', en: 'Shadow Play', es: 'Juego de Sombras' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_obtenebration_shroud_of_night',
        disciplineId: 'obtenebration',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Mortalha da Noite', en: 'Shroud of Night', es: 'Manto de la Noche' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'manipulation + occult',
      },
      {
        id: 'v20_obtenebration_arms_of_the_abyss',
        disciplineId: 'obtenebration',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Braços do Abismo', en: 'Arms of the Abyss', es: 'Brazos del Abismo' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'manipulation + occult',
      },
      {
        id: 'v20_obtenebration_black_metamorphosis',
        disciplineId: 'obtenebration',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Metamorfose Sombria', en: 'Black Metamorphosis', es: 'Metamorfosis Negra' },
        costType: 'blood_point',
        costAmount: 2,
        poolHint: 'manipulation + courage',
      },
      {
        id: 'v20_obtenebration_tenebrous_form',
        disciplineId: 'obtenebration',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Forma Tenebrosa', en: 'Tenebrous Form', es: 'Forma Tenebrosa' },
        costType: 'blood_point',
        costAmount: 3,
      },
    ],
  },
  {
    id: 'quietus',
    varName: 'quietus',
    editions: ['storyteller-v20'],
    aliases: ['quietude'],
    name: { 'pt-BR': 'Quietus', en: 'Quietus', es: 'Extinción' },
    powers: [
      {
        id: 'v20_quietus_silence_of_death',
        disciplineId: 'quietus',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Silêncio da Morte', en: 'Silence of Death', es: 'Silencio de la Muerte' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_quietus_scorpions_touch',
        disciplineId: 'quietus',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Toque do Escorpião', en: "Scorpion's Touch", es: 'Toque del Escorpión' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_quietus_dagons_call',
        disciplineId: 'quietus',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Chamado de Dagon', en: "Dagon's Call", es: 'Llamada de Dagón' },
        costType: 'free',
        costAmount: 0,
        poolHint: 'stamina + quietus',
      },
      {
        id: 'v20_quietus_baals_caress',
        disciplineId: 'quietus',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Carícia de Baal', en: "Baal's Caress", es: 'Caricia de Baal' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_quietus_taste_of_death',
        disciplineId: 'quietus',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Gosto da Morte', en: 'Taste of Death', es: 'Sabor de la Muerte' },
        costType: 'blood_point',
        costAmount: 2,
      },
    ],
  },
  {
    id: 'serpentis',
    varName: 'serpentis',
    editions: ['storyteller-v20'],
    aliases: ['serpentis'],
    name: { 'pt-BR': 'Serpentis', en: 'Serpentis', es: 'Serpentis' },
    powers: [
      {
        id: 'v20_serpentis_eyes_of_the_serpent',
        disciplineId: 'serpentis',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Olhos da Serpente', en: 'Eyes of the Serpent', es: 'Ojos de la Serpiente' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_serpentis_tongue_of_the_asp',
        disciplineId: 'serpentis',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Língua da Áspide', en: 'The Tongue of the Asp', es: 'Lengua del Áspid' },
        costType: 'free',
        costAmount: 0,
      },
      {
        id: 'v20_serpentis_skin_of_the_adder',
        disciplineId: 'serpentis',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Pele da Víbora', en: 'Skin of the Adder', es: 'Piel de la Víbora' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_serpentis_form_of_the_cobra',
        disciplineId: 'serpentis',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Forma da Naja', en: 'Form of the Cobra', es: 'Forma de la Cobra' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_serpentis_heart_of_darkness',
        disciplineId: 'serpentis',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Coração das Trevas', en: 'Heart of Darkness', es: 'Corazón de las Tinieblas' },
        costType: 'blood_point',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'thaumaturgy',
    varName: 'thaumaturgy',
    editions: ['storyteller-v20'],
    aliases: ['taumaturgia'],
    name: { 'pt-BR': 'Taumaturgia', en: 'Thaumaturgy', es: 'Taumaturgia' },
    powers: [
      {
        id: 'v20_thaumaturgy_a_taste_for_blood',
        disciplineId: 'thaumaturgy',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Gosto pelo Sangue', en: 'A Taste for Blood', es: 'Sabor de la Sangre' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_thaumaturgy_blood_rage',
        disciplineId: 'thaumaturgy',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Fúria do Sangue', en: 'Blood Rage', es: 'Furia de la Sangre' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_thaumaturgy_blood_of_potency',
        disciplineId: 'thaumaturgy',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Sangue de Potência', en: 'Blood of Potency', es: 'Sangre de Potencia' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_thaumaturgy_theft_of_vitae',
        disciplineId: 'thaumaturgy',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Roubo de Vitae', en: 'Theft of Vitae', es: 'Robo de Vitae' },
        costType: 'blood_point',
        costAmount: 1,
      },
      {
        id: 'v20_thaumaturgy_cauldron_of_blood',
        disciplineId: 'thaumaturgy',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Caldeirão de Sangue', en: 'Cauldron of Blood', es: 'Caldero de Sangre' },
        costType: 'blood_point',
        costAmount: 1,
      },
    ],
  },
  {
    id: 'vicissitude',
    varName: 'vicissitude',
    editions: ['storyteller-v20'],
    aliases: ['vicissitude', 'vicisitud'],
    name: { 'pt-BR': 'Vicissitude', en: 'Vicissitude', es: 'Vicisitud' },
    powers: [
      {
        id: 'v20_vicissitude_malleable_visage',
        disciplineId: 'vicissitude',
        edition: 'storyteller-v20',
        level: 1,
        name: { 'pt-BR': 'Aspecto Maleável', en: 'Malleable Visage', es: 'Aspecto Maleable' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'intelligence + medicine',
      },
      {
        id: 'v20_vicissitude_fleshcraft',
        disciplineId: 'vicissitude',
        edition: 'storyteller-v20',
        level: 2,
        name: { 'pt-BR': 'Moldar Carne', en: 'Fleshcraft', es: 'Moldear Carne' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'dexterity + medicine',
      },
      {
        id: 'v20_vicissitude_bonecraft',
        disciplineId: 'vicissitude',
        edition: 'storyteller-v20',
        level: 3,
        name: { 'pt-BR': 'Moldar Ossos', en: 'Bonecraft', es: 'Moldear Hueso' },
        costType: 'blood_point',
        costAmount: 1,
        poolHint: 'strength + medicine',
      },
      {
        id: 'v20_vicissitude_horrid_form',
        disciplineId: 'vicissitude',
        edition: 'storyteller-v20',
        level: 4,
        name: { 'pt-BR': 'Forma Horrenda', en: 'Horrid Form', es: 'Forma Horrenda' },
        costType: 'blood_point',
        costAmount: 2,
      },
      {
        id: 'v20_vicissitude_bloodform',
        disciplineId: 'vicissitude',
        edition: 'storyteller-v20',
        level: 5,
        name: { 'pt-BR': 'Forma Sanguínea', en: 'Bloodform', es: 'Forma Sanguínea' },
        costType: 'blood_point',
        costAmount: 1,
      },
    ],
  },
];

function normalizeKey(input: string): string {
  return normalizeCatalogText(input).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getClansForEdition(edition: WodCatalogEdition): readonly WodClanCatalogEntry[] {
  return edition === 'vampire-v5' ? V5_CLANS_CATALOG : V20_CLANS_CATALOG;
}

export function findClanByIdOrName(
  clanInput: string | null | undefined,
  edition?: WodCatalogEdition,
): WodClanCatalogEntry | null {
  if (typeof clanInput !== 'string') return null;
  const norm = normalizeKey(clanInput);
  if (!norm) return null;

  const pool: readonly WodClanCatalogEntry[] = edition
    ? getClansForEdition(edition)
    : [...V5_CLANS_CATALOG, ...V20_CLANS_CATALOG];

  for (const clan of pool) {
    const candidates = [
      clan.id,
      clan.name['pt-BR'],
      clan.name.en,
      clan.name.es,
      ...(clan.aliases ?? []),
    ];
    if (candidates.some((c) => normalizeKey(c) === norm)) {
      return clan;
    }
  }
  return null;
}

export function getDisciplinesForEdition(
  edition: WodCatalogEdition,
): readonly WodDisciplineCatalogEntry[] {
  return WOD_DISCIPLINES_CATALOG.filter((disc) => disc.editions.includes(edition)).map((disc) => ({
    ...disc,
    powers: disc.powers.filter((p) => p.edition === edition),
  }));
}

export function findDisciplineByIdOrName(
  disciplineInput: string | null | undefined,
  edition?: WodCatalogEdition,
): WodDisciplineCatalogEntry | null {
  if (typeof disciplineInput !== 'string') return null;
  const norm = normalizeKey(disciplineInput);
  if (!norm) return null;

  const pool: readonly WodDisciplineCatalogEntry[] = edition
    ? getDisciplinesForEdition(edition)
    : WOD_DISCIPLINES_CATALOG;

  for (const disc of pool) {
    const candidates = [
      disc.id,
      disc.varName,
      disc.name['pt-BR'],
      disc.name.en,
      disc.name.es,
      ...(disc.aliases ?? []),
    ];
    if (candidates.some((c) => normalizeKey(c) === norm)) {
      return disc;
    }
  }
  return null;
}

export function resolveDisciplineAffinity(
  clanInput: string | null | undefined,
  disciplineIdOrName: string | null | undefined,
  edition: WodCatalogEdition,
): DisciplineAffinity {
  const clan = findClanByIdOrName(clanInput, edition);
  if (!clan) return 'discipline_out_of_clan';
  if (clan.isCaitiff) return 'discipline_caitiff';

  const disc = findDisciplineByIdOrName(disciplineIdOrName, edition);
  const canonicalId = disc
    ? disc.id
    : normalizeKey(String(disciplineIdOrName ?? '')).replace(/\s+/g, '_');

  if (!canonicalId) return 'discipline_out_of_clan';
  return clan.clanDisciplines.includes(canonicalId)
    ? 'discipline_clan'
    : 'discipline_out_of_clan';
}

export function isDisciplinesCardCandidate(
  card: Pick<SheetCard, 'id' | 'code' | 'title'>,
): boolean {
  if (card.id === 'card_arcano' || card.id === 'card_grimorio') return true;
  const sig = `${card.code} ${card.title}`.toUpperCase();
  return /DISCIPLIN|ARCANO|PODER|POWER|GRIMOR|MERIT/.test(sig);
}

export function isCatalogDisciplinePresent(
  discipline: WodDisciplineCatalogEntry,
  existingKeysAndLabels: Iterable<string>,
): boolean {
  const normalizedExisting = new Set<string>();
  for (const entry of existingKeysAndLabels) {
    const clean = normalizeKey(entry).replace(/\s+/g, '_');
    if (clean) normalizedExisting.add(clean);
  }
  const candidates = [
    discipline.id,
    discipline.varName,
    ...(discipline.aliases ?? []),
    ...Object.values(discipline.name),
  ].map((item) => normalizeKey(item).replace(/\s+/g, '_'));
  return candidates.some((cand) => normalizedExisting.has(cand));
}

export function isCatalogPowerPresent(
  power: WodDisciplinePower,
  existingRows: ReadonlyArray<Pick<RepeatableRow, 'id' | 'col1'>>,
): boolean {
  const powerNames = Object.values(power.name).map((n) => normalizeKey(n));
  return existingRows.some((row) => {
    if (row.id === `pwr_${power.id}`) return true;
    const rowNorm = normalizeKey(row.col1);
    if (!rowNorm) return false;
    return powerNames.some((nameNorm) => nameNorm.length > 0 && rowNorm.includes(nameNorm));
  });
}

export function formatPowerCostLabel(
  costType: WodPowerCostType,
  costAmount: number,
  lang: AppLanguage,
): string {
  const amount = Math.max(0, Math.round(costAmount));
  if (costType === 'free' || amount === 0) {
    return lang === 'pt-BR' ? 'LIVRE' : lang === 'es' ? 'GRATIS' : 'FREE';
  }
  if (costType === 'rouse') {
    return `${amount} ROUSE`;
  }
  return lang === 'pt-BR'
    ? `${amount} SANGUE`
    : lang === 'es'
      ? `${amount} SANGRE`
      : `${amount} BLOOD`;
}

export function parsePowerActivationCost(
  col2: string | number | undefined,
  edition: WodCatalogEdition,
): ParsedPowerCost {
  if (col2 === undefined || col2 === null) {
    return { costType: 'free', costAmount: 0 };
  }
  const raw = normalizeCatalogText(String(col2));
  if (!raw) {
    return { costType: 'free', costAmount: 0 };
  }

  if (edition === 'vampire-v5') {
    const numberedRouse = raw.match(
      /(\d+)\s*(?:x\s*)?(?:rouse(?:\s*checks?)?|teste\s*de\s*fome|enardecimiento|rc)\b/i,
    );
    if (numberedRouse) {
      const amount = Math.max(1, Math.min(5, Number(numberedRouse[1])));
      return { costType: 'rouse', costAmount: amount };
    }
    if (/\b(?:rouse(?:\s*checks?)?|teste\s*de\s*fome|enardecimiento)\b/i.test(raw)) {
      return { costType: 'rouse', costAmount: 1 };
    }
    return { costType: 'free', costAmount: 0 };
  }

  // V20: ignore Willpower, Rouse, Free, Dots, etc.
  if (/\b(?:wp|willpower|rouse|free|livre|gratis)\b/i.test(raw)) {
    return { costType: 'free', costAmount: 0 };
  }

  const numberedBlood = raw.match(
    /(\d+)\s*(?:x\s*)?(?:blood(?:\s*point)?s?|bp|sangue|ps|sangre|vitae)\b/i,
  );
  if (numberedBlood) {
    const amount = Math.max(1, Math.min(10, Number(numberedBlood[1])));
    return { costType: 'blood_point', costAmount: amount };
  }
  if (/\b(?:blood(?:\s*point)?s?|sangue|sangre|vitae)\b/i.test(raw)) {
    return { costType: 'blood_point', costAmount: 1 };
  }

  return { costType: 'free', costAmount: 0 };
}

export function buildCatalogDisciplineField(
  discipline: WodDisciplineCatalogEntry,
  lang: AppLanguage,
): SheetField {
  return {
    id: `f_${discipline.varName}`,
    key: discipline.varName,
    label: (discipline.name[lang] ?? discipline.name.en).toUpperCase(),
    kind: 'number',
    value: 1,
  };
}

export function buildCatalogPowerRow(
  discipline: WodDisciplineCatalogEntry,
  power: WodDisciplinePower,
  lang: AppLanguage,
): RepeatableRow {
  const powerLabel = power.name[lang] ?? power.name.en;
  const discLabel = discipline.name[lang] ?? discipline.name.en;
  return {
    id: `pwr_${power.id}`,
    col1: `${powerLabel} (${discLabel} ${power.level})`,
    col2: formatPowerCostLabel(power.costType, power.costAmount, lang),
  };
}
