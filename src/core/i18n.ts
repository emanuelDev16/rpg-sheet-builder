import type { SystemId } from './sheetModel.ts';

export type AppLanguage = 'pt-BR' | 'en' | 'es';

export const LANGUAGE_STORAGE_KEY = 'grid_sheet_language_v1';

export interface LanguageOption {
  id: AppLanguage;
  shortLabel: string;
  label: string;
  htmlLang: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'pt-BR', shortLabel: 'PT-BR', label: 'Português (BR)', htmlLang: 'pt-BR' },
  { id: 'en', shortLabel: 'EN', label: 'English', htmlLang: 'en' },
  { id: 'es', shortLabel: 'ES', label: 'Español', htmlLang: 'es' },
];

export function isValidLanguage(value: unknown): value is AppLanguage {
  return value === 'pt-BR' || value === 'en' || value === 'es';
}

export function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined' || !window.localStorage) return 'pt-BR';
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isValidLanguage(raw) ? raw : 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

export function getLocalizedTabLabels(
  systemId: SystemId,
  lang: AppLanguage,
): { tab1: string; tab2: string; tab3: string } {
  if (lang === 'en') {
    if (systemId === 'wod') {
      return {
        tab1: '/01 ATTRIBUTES & COMBAT',
        tab2: '/02 DISCIPLINES & NOTES',
        tab3: '/03 XP & UPGRADES',
      };
    }
    if (systemId === 'dnd5e') {
      return {
        tab1: '/01 ABILITIES & COMBAT',
        tab2: '/02 SPELLS & NOTES',
        tab3: '/03 XP & UPGRADES',
      };
    }
    if (systemId === 'cyberpunk') {
      return {
        tab1: '/01 STATS & COMBAT',
        tab2: '/02 NETRUNNING & NOTES',
        tab3: '/03 XP & UPGRADES',
      };
    }
    if (systemId === 'blank') {
      return {
        tab1: '/01 MAIN SHEET',
        tab2: '/02 EXTRAS & NOTES',
        tab3: '/03 XP & UPGRADES',
      };
    }
    return {
      tab1: '/01 GENERAL & COMBAT',
      tab2: '/02 SPELLS & NOTES',
      tab3: '/03 XP & UPGRADES',
    };
  }

  if (lang === 'es') {
    if (systemId === 'wod') {
      return {
        tab1: '/01 ATRIBUTOS Y COMBATE',
        tab2: '/02 DISCIPLINAS Y NOTAS',
        tab3: '/03 XP Y MEJORAS',
      };
    }
    if (systemId === 'dnd5e') {
      return {
        tab1: '/01 CARACTERÍSTICAS Y COMBATE',
        tab2: '/02 CONJUROS Y NOTAS',
        tab3: '/03 XP Y MEJORAS',
      };
    }
    if (systemId === 'cyberpunk') {
      return {
        tab1: '/01 ESTADÍSTICAS Y COMBATE',
        tab2: '/02 NETRUNNING Y NOTAS',
        tab3: '/03 XP Y MEJORAS',
      };
    }
    if (systemId === 'blank') {
      return {
        tab1: '/01 HOJA PRINCIPAL',
        tab2: '/02 EXTRAS Y NOTAS',
        tab3: '/03 XP Y MEJORAS',
      };
    }
    return {
      tab1: '/01 GENERAL Y COMBATE',
      tab2: '/02 MAGIA Y NOTAS',
      tab3: '/03 XP Y MEJORAS',
    };
  }

  // PT-BR
  if (systemId === 'wod') {
    return {
      tab1: '/01 ATTRIBUTES & COMBAT',
      tab2: '/02 DISCIPLINES & NOTES',
      tab3: '/03 XP & UPGRADES',
    };
  }
  if (systemId === 'dnd5e') {
    return {
      tab1: '/01 ABILITIES & COMBAT',
      tab2: '/02 SPELLS & NOTES',
      tab3: '/03 XP & UPGRADES',
    };
  }
  if (systemId === 'cyberpunk') {
    return {
      tab1: '/01 STATS & COMBAT',
      tab2: '/02 NETRUNNING & NOTES',
      tab3: '/03 XP & UPGRADES',
    };
  }
  if (systemId === 'blank') {
    return {
      tab1: '/01 FICHA PRINCIPAL',
      tab2: '/02 EXTRAS & NOTAS',
      tab3: '/03 XP & UPGRADES',
    };
  }
  return {
    tab1: '/01 GERAL & COMBATE',
    tab2: '/02 MAGIAS & NOTAS',
    tab3: '/03 XP & UPGRADES',
  };
}

export interface AppTranslations {
  topBar: {
    ariaHeader: string;
    systemLabel: string;
    systemAria: string;
    languageLabel: string;
    languageAria: string;
    newSheet: string;
    open: string;
    save: string;
    pdfAria: string;
    playMode: string;
    editMode: string;
    modeSelectorAria: string;
  };
  tabNav: {
    ariaLabel: string;
    characterAria: string;
    editableSchema: string;
  };
  searchBar: {
    placeholder: string;
    ariaInput: string;
    clearAria: string;
    clearText: string;
    matchCount: (fields: number, cards: number) => string;
    emptyTitle: (query: string) => string;
    emptyHint: string;
  };
  cards: {
    filteredPill: (shown: number, total: number) => string;
    emptyBlockEdit: string;
    emptyBlockPlay: string;
    addFieldHeading: string;
    newFieldPlaceholder: string;
    addButton: string;
    addRow: string;
    emptyTable: string;
    cargoBadge: string;
    active: string;
    inactive: string;
    superficialDmg: string;
    aggravatedDmg: string;
    healthyRemaining: string;
    aggEqRule: (max: number) => string;
    supEqTag: (supEq: number) => string;
  };
  sidebar: {
    ariaAside: string;
    rollLogsTab: string;
    rulesTab: string;
    clearLogsAria: string;
    quickExprAria: string;
    rollBtn: string;
    emptyLogs: string;
    rulesContext: string;
    rulesPlaceholder: string;
    rulesSearchBtn: string;
    rulesSearchAria: string;
  };
  statusBar: {
    ariaFooter: string;
    ready: string;
    formulaErrors: (count: number, first?: string) => string;
    cargo: string;
    logs: string;
    accessGranted: string;
    schemaUnlocked: string;
    roomSyncedFlash: string;
  };
  modal: {
    openTitle: string;
    saveTitle: string;
    closeAria: string;
    presetsTitle: string;
    importTitle: string;
    importDesc: string;
    importBtn: string;
    printPdfTitle: string;
    printPdfDesc: string;
    saveLocalTitle: string;
    saveLocalDesc: string;
    downloadJsonTitle: string;
    downloadJsonDesc: string;
    downloadHtmlTitle: string;
    downloadHtmlDesc: string;
    downloadApkTitle: string;
    downloadApkDesc: string;
    copyQss: string;
    copiedQss: string;
  };
  customBuilder: {
    createFromZero: string;
    addNewBlock: string;
    emptyHint: string;
    blockTitle: string;
    blockTitlePlaceholder: string;
    techTag: string;
    width: string;
    createBtn: string;
  };
  xp: {
    monitorTitle: string;
    availableXp: string;
    totalEarned: string;
    totalSpent: string;
    allocation: string;
    spentLabel: string;
    quickAdjust: string;
    notePlaceholder: string;
    addXpBtn: string;
    ledgerTitle: string;
    undoLastUpgrade: string;
    emptyLedger: string;
    possibleTitle: string;
    availableCount: (n: number) => string;
    costRulesLabel: string;
    budgetLabel: (xp: number) => string;
    filterAll: string;
    upgradeBtn: (cost: number) => string;
  };
}

const PT_BR: AppTranslations = {
  topBar: {
    ariaHeader: 'Barra superior técnica',
    systemLabel: 'SISTEMA:',
    systemAria: 'Trocar sistema de RPG',
    languageLabel: 'IDIOMA:',
    languageAria: 'Selecionar idioma da interface',
    newSheet: 'NOVA FICHA',
    open: 'ABRIR',
    save: 'SALVAR',
    pdfAria: 'Imprimir ficha ativa em PDF',
    playMode: 'MODO JOGO',
    editMode: 'MODO EDIÇÃO',
    modeSelectorAria: 'Seletor de modo da ficha',
  },
  tabNav: {
    ariaLabel: 'Navegação de seções da ficha',
    characterAria: 'Título do personagem',
    editableSchema: 'SCHEMA EDITÁVEL',
  },
  searchBar: {
    placeholder: 'Filtrar atributos, habilidades, perícias ou rolagens...',
    ariaInput: 'Filtrar atributos ou habilidades da ficha',
    clearAria: 'Limpar filtro de busca',
    clearText: 'LIMPAR',
    matchCount: (fields, cards) => `${fields} ${fields === 1 ? 'CAMPO' : 'CAMPOS'} · ${cards} ${cards === 1 ? 'BLOCO' : 'BLOCOS'}`,
    emptyTitle: (q) => `Nenhum atributo ou habilidade encontrado para "${q}".`,
    emptyHint: 'Tente outro nome de atributo, perícia, rolagem ou item, ou limpe o filtro.',
  },
  cards: {
    filteredPill: (shown, total) => `${shown}/${total} FILTRADO`,
    emptyBlockEdit: 'Bloco vazio. Adicione o primeiro campo abaixo para montar sua ficha.',
    emptyBlockPlay: 'Bloco vazio. Ative o MODO EDIÇÃO para adicionar campos.',
    addFieldHeading: '+ NOVO CAMPO',
    newFieldPlaceholder: 'Nome do campo (ex: Força, Percepção)',
    addButton: 'ADD',
    addRow: 'ADICIONAR LINHA',
    emptyTable: 'Nenhum registro na lista.',
    cargoBadge: '//CARGA:',
    active: 'ATIVO',
    inactive: 'INATIVO',
    superficialDmg: 'DANO SUPERFICIAL',
    aggravatedDmg: 'DANO AGRAVADO',
    healthyRemaining: 'SAUDÁVEL',
    aggEqRule: (max) => `1 AGRAV = ${max} SUP`,
    supEqTag: (supEq) => `${supEq} SUP EQ`,
  },
  sidebar: {
    ariaAside: 'Painel lateral de rolagens e consulta de regras',
    rollLogsTab: '// LOG_ROLAGENS',
    rulesTab: '// REGRAS',
    clearLogsAria: 'Limpar log de rolagens',
    quickExprAria: 'Expressão rápida de dados',
    rollBtn: 'ROLAR ↗',
    emptyLogs: 'Nenhuma rolagem registrada. Clique em um botão de rolagem ou use a barra acima.',
    rulesContext: 'CONTEXTO ·',
    rulesPlaceholder: 'ex: Frenzy, Hunger, Botch',
    rulesSearchBtn: 'BUSCAR ↗',
    rulesSearchAria: 'Pesquisar regra de RPG',
  },
  statusBar: {
    ariaFooter: 'Barra de status da ficha',
    ready: '// STATUS: PRONTO · SEM ERROS DE FÓRMULA',
    formulaErrors: (count, first) => `// STATUS: ${count} ERRO(S) DE FÓRMULA · ${first ?? ''}`,
    cargo: '//CARGA:',
    logs: 'LOGS:',
    accessGranted: '> ACCESS GRANTED_',
    schemaUnlocked: '> SCHEMA_UNLOCKED_',
    roomSyncedFlash: '// ROOM DB: SINCRONIZADO AGORA',
  },
  modal: {
    openTitle: 'CARREGAR FICHA OU MODELO',
    saveTitle: 'SALVAR & EXPORTAR PROTÓTIPO',
    closeAria: 'Fechar janela',
    presetsTitle: 'MODELOS DE SISTEMA (PRESETS)',
    importTitle: 'IMPORTAR FICHA (.JSON)',
    importDesc: 'Carrega uma ficha exportada anteriormente preservando campos e fórmulas.',
    importBtn: 'SELECIONAR ARQUIVO JSON',
    printPdfTitle: 'IMPRIMIR / SALVAR PDF (FICHA ATIVA)',
    printPdfDesc: 'Gera PDF estilizado em Light Cyber-Brutalism mantendo o Bento Grid atual',
    saveLocalTitle: 'SALVAR NO NAVEGADOR (LOCALSTORAGE)',
    saveLocalDesc: 'Persiste a ficha e alterações de esquema imediatamente neste dispositivo',
    downloadJsonTitle: 'BAIXAR FICHA (.JSON)',
    downloadJsonDesc: 'Exporta dados, fórmulas e histórico de rolagens',
    downloadHtmlTitle: 'EXPORTAR PROTÓTIPO HTML PURO (.HTML)',
    downloadHtmlDesc: 'Gera arquivo único com HTML5 + CSS Vanilla sem dependências externas',
    downloadApkTitle: 'BAIXAR APP ANDROID (.APK NATIVO)',
    downloadApkDesc: 'App Kotlin + Jetpack Compose com banco local Room sincronizado',
    copyQss: 'COPIAR TOKENS QSS (PYSIDE6)',
    copiedQss: 'TOKENS COPIADOS!',
  },
  customBuilder: {
    createFromZero: 'CRIAR FICHA DO ZERO',
    addNewBlock: 'ADICIONAR NOVO BLOCO',
    emptyHint: 'Nenhum campo pré-definido foi carregado. Crie seu primeiro bloco (ex: Atributos, Recursos, Perícias, Equipamentos) e depois adicione cada campo individualmente dentro dele.',
    blockTitle: 'TÍTULO DO BLOCO',
    blockTitlePlaceholder: 'Ex: ATRIBUTOS, STATUS VITAL, MOCHILA...',
    techTag: 'TAG TÉCNICA',
    width: 'LARGURA',
    createBtn: 'CRIAR BLOCO',
  },
  xp: {
    monitorTitle: 'MONITOR DE EXPERIÊNCIA',
    availableXp: 'XP DISPONÍVEL',
    totalEarned: 'XP TOTAL GANHO',
    totalSpent: 'XP GASTO',
    allocation: 'ALOCAÇÃO DE XP',
    spentLabel: 'GASTO',
    quickAdjust: 'AJUSTE RÁPIDO DE XP',
    notePlaceholder: 'Nota da sessão (ex: Capítulo 04)',
    addXpBtn: 'ADICIONAR XP ↗',
    ledgerTitle: 'HISTÓRICO DE XP',
    undoLastUpgrade: 'DESFAZER ÚLTIMO UPGRADE',
    emptyLedger: 'Nenhum registro de XP ainda. Adicione XP ganho acima para começar.',
    possibleTitle: 'UPGRADES POSSÍVEIS',
    availableCount: (n) => `${n} DISPONÍVEIS`,
    costRulesLabel: 'REGRAS DE CUSTO:',
    budgetLabel: (xp) => `ORÇAMENTO: ${xp} XP`,
    filterAll: 'TODOS',
    upgradeBtn: (cost) => `UPGRADE · ${cost} XP ↗`,
  },
};

const EN: AppTranslations = {
  topBar: {
    ariaHeader: 'Top technical bar',
    systemLabel: 'SYSTEM:',
    systemAria: 'Switch RPG system',
    languageLabel: 'LANG:',
    languageAria: 'Select interface language',
    newSheet: 'NEW SHEET',
    open: 'OPEN',
    save: 'SAVE',
    pdfAria: 'Print active sheet to PDF',
    playMode: 'PLAY MODE',
    editMode: 'EDIT MODE',
    modeSelectorAria: 'Sheet mode selector',
  },
  tabNav: {
    ariaLabel: 'Sheet section navigation',
    characterAria: 'Character title',
    editableSchema: 'EDITABLE SCHEMA',
  },
  searchBar: {
    placeholder: 'Filter attributes, abilities, skills, or rolls...',
    ariaInput: 'Filter attributes or skills on the sheet',
    clearAria: 'Clear search filter',
    clearText: 'CLEAR',
    matchCount: (fields, cards) => `${fields} ${fields === 1 ? 'FIELD' : 'FIELDS'} · ${cards} ${cards === 1 ? 'CARD' : 'CARDS'}`,
    emptyTitle: (q) => `No attributes or abilities matched "${q}".`,
    emptyHint: 'Try another attribute, skill, roll, or inventory term, or clear the search.',
  },
  cards: {
    filteredPill: (shown, total) => `${shown}/${total} FILTERED`,
    emptyBlockEdit: 'Empty card. Add your first field below to build your sheet.',
    emptyBlockPlay: 'Empty card. Switch to EDIT MODE to add fields.',
    addFieldHeading: '+ NEW FIELD',
    newFieldPlaceholder: 'Field name (e.g. Strength, Stealth)',
    addButton: 'ADD',
    addRow: 'ADD ROW',
    emptyTable: 'No entries in this list.',
    cargoBadge: '//CARGO:',
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    superficialDmg: 'SUPERFICIAL DMG',
    aggravatedDmg: 'AGGRAVATED DMG',
    healthyRemaining: 'HEALTHY',
    aggEqRule: (max) => `1 AGG = ${max} SUP`,
    supEqTag: (supEq) => `${supEq} SUP EQ`,
  },
  sidebar: {
    ariaAside: 'Roll log and rules lookup sidebar',
    rollLogsTab: '// ROLL_LOG',
    rulesTab: '// RULES',
    clearLogsAria: 'Clear roll log',
    quickExprAria: 'Quick dice expression',
    rollBtn: 'ROLL ↗',
    emptyLogs: 'No rolls recorded yet. Click any roll button or use the quick input above.',
    rulesContext: 'CONTEXT ·',
    rulesPlaceholder: 'e.g. Frenzy, Hunger, Botch',
    rulesSearchBtn: 'SEARCH ↗',
    rulesSearchAria: 'Search RPG rule',
  },
  statusBar: {
    ariaFooter: 'Sheet status bar',
    ready: '// STATUS: READY · NO FORMULA ERRORS',
    formulaErrors: (count, first) => `// STATUS: ${count} FORMULA ERROR(S) · ${first ?? ''}`,
    cargo: '//CARGO:',
    logs: 'LOGS:',
    accessGranted: '> ACCESS GRANTED_',
    schemaUnlocked: '> SCHEMA_UNLOCKED_',
    roomSyncedFlash: '// ROOM DB: SYNCED NOW',
  },
  modal: {
    openTitle: 'LOAD SHEET OR PRESET',
    saveTitle: 'SAVE & EXPORT SHEET',
    closeAria: 'Close modal',
    presetsTitle: 'SYSTEM TEMPLATES (PRESETS)',
    importTitle: 'IMPORT SHEET (.JSON)',
    importDesc: 'Loads a previously exported sheet preserving fields and formulas.',
    importBtn: 'SELECT JSON FILE',
    printPdfTitle: 'PRINT / SAVE PDF (ACTIVE VIEW)',
    printPdfDesc: 'Generates styled Light Cyber-Brutalism PDF preserving the Bento Grid layout',
    saveLocalTitle: 'SAVE IN BROWSER (LOCALSTORAGE)',
    saveLocalDesc: 'Persists the sheet and schema changes immediately on this device',
    downloadJsonTitle: 'DOWNLOAD SHEET (.JSON)',
    downloadJsonDesc: 'Exports data, formulas, and roll history',
    downloadHtmlTitle: 'EXPORT STANDALONE HTML (.HTML)',
    downloadHtmlDesc: 'Generates a single HTML5 + Vanilla CSS file with zero external dependencies',
    downloadApkTitle: 'DOWNLOAD ANDROID APP (NATIVE .APK)',
    downloadApkDesc: 'Kotlin + Jetpack Compose app with synced local Room database',
    copyQss: 'COPY QSS TOKENS (PYSIDE6)',
    copiedQss: 'TOKENS COPIED!',
  },
  customBuilder: {
    createFromZero: 'BUILD SHEET FROM SCRATCH',
    addNewBlock: 'ADD NEW CARD',
    emptyHint: 'No preset fields were loaded. Create your first card (e.g. Attributes, Resources, Skills, Gear) and then add each field inside it.',
    blockTitle: 'CARD TITLE',
    blockTitlePlaceholder: 'e.g. ATTRIBUTES, VITAL STATUS, GEAR...',
    techTag: 'TECH TAG',
    width: 'WIDTH',
    createBtn: 'CREATE CARD',
  },
  xp: {
    monitorTitle: 'EXPERIENCE MONITOR',
    availableXp: 'AVAILABLE XP',
    totalEarned: 'TOTAL EARNED',
    totalSpent: 'TOTAL SPENT',
    allocation: 'XP ALLOCATION',
    spentLabel: 'SPENT',
    quickAdjust: 'QUICK XP ADJUSTMENT',
    notePlaceholder: 'Session note (e.g. Chapter 04)',
    addXpBtn: 'ADD XP ↗',
    ledgerTitle: 'XP LEDGER',
    undoLastUpgrade: 'UNDO LAST UPGRADE',
    emptyLedger: 'No XP entries yet. Award XP above to get started.',
    possibleTitle: 'POSSIBLE UPGRADES',
    availableCount: (n) => `${n} AVAILABLE`,
    costRulesLabel: 'COST RULES:',
    budgetLabel: (xp) => `BUDGET: ${xp} XP`,
    filterAll: 'ALL',
    upgradeBtn: (cost) => `UPGRADE · ${cost} XP ↗`,
  },
};

const ES: AppTranslations = {
  topBar: {
    ariaHeader: 'Barra superior técnica',
    systemLabel: 'SISTEMA:',
    systemAria: 'Cambiar sistema de RPG',
    languageLabel: 'IDIOMA:',
    languageAria: 'Seleccionar idioma de la interfaz',
    newSheet: 'NUEVA HOJA',
    open: 'ABRIR',
    save: 'GUARDAR',
    pdfAria: 'Imprimir hoja activa en PDF',
    playMode: 'MODO JUEGO',
    editMode: 'MODO EDICIÓN',
    modeSelectorAria: 'Selector de modo de la hoja',
  },
  tabNav: {
    ariaLabel: 'Navegación de secciones de la hoja',
    characterAria: 'Título del personaje',
    editableSchema: 'ESQUEMA EDITABLE',
  },
  searchBar: {
    placeholder: 'Filtrar atributos, habilidades, pericias o tiradas...',
    ariaInput: 'Filtrar atributos o habilidades de la hoja',
    clearAria: 'Limpiar filtro de búsqueda',
    clearText: 'LIMPIAR',
    matchCount: (fields, cards) => `${fields} ${fields === 1 ? 'CAMPO' : 'CAMPOS'} · ${cards} ${cards === 1 ? 'BLOQUE' : 'BLOQUES'}`,
    emptyTitle: (q) => `No se encontraron atributos ni habilidades para "${q}".`,
    emptyHint: 'Prueba otro nombre de atributo, habilidad, tirada u objeto, o limpia el filtro.',
  },
  cards: {
    filteredPill: (shown, total) => `${shown}/${total} FILTRADO`,
    emptyBlockEdit: 'Bloque vacío. Añade el primer campo abajo para armar tu hoja.',
    emptyBlockPlay: 'Bloque vacío. Activa el MODO EDICIÓN para añadir campos.',
    addFieldHeading: '+ NUEVO CAMPO',
    newFieldPlaceholder: 'Nombre del campo (ej: Fuerza, Sigilo)',
    addButton: 'AÑADIR',
    addRow: 'AÑADIR FILA',
    emptyTable: 'Sin registros en la lista.',
    cargoBadge: '//CARGA:',
    active: 'ACTIVO',
    inactive: 'INACTIVO',
    superficialDmg: 'DAÑO SUPERFICIAL',
    aggravatedDmg: 'DAÑO AGRAVADO',
    healthyRemaining: 'SALUDABLE',
    aggEqRule: (max) => `1 AGRAV = ${max} SUP`,
    supEqTag: (supEq) => `${supEq} SUP EQ`,
  },
  sidebar: {
    ariaAside: 'Panel lateral de tiradas y consulta de reglas',
    rollLogsTab: '// REGISTRO_TIRADAS',
    rulesTab: '// REGLAS',
    clearLogsAria: 'Limpiar registro de tiradas',
    quickExprAria: 'Expresión rápida de dados',
    rollBtn: 'TIRAR ↗',
    emptyLogs: 'Aún no hay tiradas registradas. Pulsa cualquier botón de tirada o usa la barra superior.',
    rulesContext: 'CONTEXTO ·',
    rulesPlaceholder: 'ej: Frenzy, Hunger, Botch',
    rulesSearchBtn: 'BUSCAR ↗',
    rulesSearchAria: 'Buscar regla de RPG',
  },
  statusBar: {
    ariaFooter: 'Barra de estado de la hoja',
    ready: '// ESTADO: LISTO · SIN ERRORES DE FÓRMULA',
    formulaErrors: (count, first) => `// ESTADO: ${count} ERROR(ES) DE FÓRMULA · ${first ?? ''}`,
    cargo: '//CARGA:',
    logs: 'TIRADAS:',
    accessGranted: '> ACCESS GRANTED_',
    schemaUnlocked: '> SCHEMA_UNLOCKED_',
    roomSyncedFlash: '// ROOM DB: SINCRONIZADO AHORA',
  },
  modal: {
    openTitle: 'CARGAR HOJA O PLANTILLA',
    saveTitle: 'GUARDAR Y EXPORTAR HOJA',
    closeAria: 'Cerrar ventana',
    presetsTitle: 'PLANTILLAS DE SISTEMA (PRESETS)',
    importTitle: 'IMPORTAR HOJA (.JSON)',
    importDesc: 'Carga una hoja exportada previamente conservando campos y fórmulas.',
    importBtn: 'SELECCIONAR ARCHIVO JSON',
    printPdfTitle: 'IMPRIMIR / GUARDAR PDF (HOJA ACTIVA)',
    printPdfDesc: 'Genera PDF estilizado en Light Cyber-Brutalism manteniendo el Bento Grid actual',
    saveLocalTitle: 'GUARDAR EN EL NAVEGADOR (LOCALSTORAGE)',
    saveLocalDesc: 'Guarda la hoja y los cambios de esquema inmediatamente en este dispositivo',
    downloadJsonTitle: 'DESCARGAR HOJA (.JSON)',
    downloadJsonDesc: 'Exporta datos, fórmulas e historial de tiradas',
    downloadHtmlTitle: 'EXPORTAR HTML INDEPENDIENTE (.HTML)',
    downloadHtmlDesc: 'Genera un archivo único HTML5 + CSS Vanilla sin dependencias externas',
    downloadApkTitle: 'DESCARGAR APP ANDROID (.APK NATIVO)',
    downloadApkDesc: 'App Kotlin + Jetpack Compose con base de datos local Room sincronizada',
    copyQss: 'COPIAR TOKENS QSS (PYSIDE6)',
    copiedQss: '¡TOKENS COPIADOS!',
  },
  customBuilder: {
    createFromZero: 'CREAR HOJA DESDE CERO',
    addNewBlock: 'AÑADIR NUEVO BLOQUE',
    emptyHint: 'No se cargaron campos predefinidos. Crea tu primer bloque (ej: Atributos, Recursos, Habilidades, Equipo) y luego añade cada campo dentro de él.',
    blockTitle: 'TÍTULO DEL BLOQUE',
    blockTitlePlaceholder: 'Ej: ATRIBUTOS, ESTADO VITAL, EQUIPO...',
    techTag: 'ETIQUETA TÉCNICA',
    width: 'ANCHO',
    createBtn: 'CREAR BLOQUE',
  },
  xp: {
    monitorTitle: 'MONITOR DE EXPERIENCIA',
    availableXp: 'XP DISPONIBLE',
    totalEarned: 'XP TOTAL GANADA',
    totalSpent: 'XP GASTADA',
    allocation: 'ASIGNACIÓN DE XP',
    spentLabel: 'GASTADA',
    quickAdjust: 'AJUSTE RÁPIDO DE XP',
    notePlaceholder: 'Nota de sesión (ej: Capítulo 04)',
    addXpBtn: 'AÑADIR XP ↗',
    ledgerTitle: 'HISTORIAL DE XP',
    undoLastUpgrade: 'DESHACER ÚLTIMA MEJORA',
    emptyLedger: 'Aún no hay registros de XP. Añade XP ganada arriba para comenzar.',
    possibleTitle: 'MEJORAS POSIBLES',
    availableCount: (n) => `${n} DISPONIBLES`,
    costRulesLabel: 'REGLAS DE COSTO:',
    budgetLabel: (xp) => `PRESUPUESTO: ${xp} XP`,
    filterAll: 'TODOS',
    upgradeBtn: (cost) => `MEJORA · ${cost} XP ↗`,
  },
};

export function getTranslations(lang: AppLanguage): AppTranslations {
  switch (lang) {
    case 'en':
      return EN;
    case 'es':
      return ES;
    case 'pt-BR':
    default:
      return PT_BR;
  }
}
