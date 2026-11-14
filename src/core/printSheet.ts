import { CharacterSheetState, detectSystemId, SystemId, TabId } from './sheetModel';

export function getTabLabelsForSystem(systemId: SystemId): { tab1: string; tab2: string } {
  if (systemId === 'wod') {
    return {
      tab1: '/01 ATTRIBUTES & COMBAT',
      tab2: '/02 DISCIPLINES & NOTES',
    };
  }
  if (systemId === 'dnd5e') {
    return {
      tab1: '/01 ABILITIES & COMBAT',
      tab2: '/02 SPELLS & NOTES',
    };
  }
  if (systemId === 'cyberpunk') {
    return {
      tab1: '/01 STATS & COMBAT',
      tab2: '/02 NETRUNNING & NOTES',
    };
  }
  if (systemId === 'blank') {
    return {
      tab1: '/01 FICHA PRINCIPAL',
      tab2: '/02 EXTRAS & NOTAS',
    };
  }
  return {
    tab1: '/01 GERAL & COMBATE',
    tab2: '/02 MAGIAS & NOTAS',
  };
}

export function getActiveTabSectionLabel(systemId: SystemId, activeTab: TabId): string {
  if (activeTab === 'xp') {
    return '/03 XP & UPGRADES';
  }
  const { tab1, tab2 } = getTabLabelsForSystem(systemId);
  return activeTab === 'geral' ? tab1 : tab2;
}

function sanitizeFilenameSegment(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

export function buildPrintDocumentTitle(sheet: CharacterSheetState, activeTab: TabId): string {
  const systemId = detectSystemId(sheet);
  const sectionLabel = getActiveTabSectionLabel(systemId, activeTab);
  const charSegment = sanitizeFilenameSegment(sheet.characterName, 'CHARACTER');
  const sectionSegment = sanitizeFilenameSegment(sectionLabel, 'SHEET');
  return `GRID_SHEET-${charSegment}-${sectionSegment}`;
}

export interface PrintExecutionResult {
  ok: boolean;
  documentTitle: string;
  error?: string;
}

export interface PrintWindowLike {
  print: () => void;
  addEventListener?: (event: 'afterprint', listener: () => void) => void;
  removeEventListener?: (event: 'afterprint', listener: () => void) => void;
  setTimeout?: (handler: () => void, timeout?: number) => unknown;
}

export function printActiveSheetView(
  sheet: CharacterSheetState,
  activeTab: TabId,
  options: {
    doc?: Pick<Document, 'title'>;
    win?: PrintWindowLike;
    onBeforePrint?: () => void;
    onAfterPrint?: () => void;
  } = {},
): PrintExecutionResult {
  const doc = options.doc ?? (typeof document !== 'undefined' ? document : undefined);
  const win = options.win ?? (typeof window !== 'undefined' ? window : undefined);
  const nextTitle = buildPrintDocumentTitle(sheet, activeTab);

  if (!win || typeof win.print !== 'function') {
    return {
      ok: false,
      documentTitle: nextTitle,
      error: 'Impressão PDF indisponível neste ambiente.',
    };
  }

  const previousTitle = doc ? doc.title : '';
  if (doc) {
    doc.title = nextTitle;
  }

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    if (doc) {
      doc.title = previousTitle;
    }
    if (typeof win.removeEventListener === 'function') {
      win.removeEventListener('afterprint', restoreTitle);
    }
    options.onAfterPrint?.();
  };

  if (typeof win.addEventListener === 'function') {
    win.addEventListener('afterprint', restoreTitle);
  }

  options.onBeforePrint?.();
  try {
    win.print();
    if (typeof win.setTimeout === 'function') {
      win.setTimeout(restoreTitle, 1500);
    } else {
      restoreTitle();
    }
    return { ok: true, documentTitle: nextTitle };
  } catch (err) {
    restoreTitle();
    return {
      ok: false,
      documentTitle: nextTitle,
      error: err instanceof Error ? err.message : 'Falha ao iniciar impressão PDF.',
    };
  }
}
