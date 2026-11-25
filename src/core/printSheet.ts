import { type CharacterSheetState, detectSystemId, type SystemId, type TabId } from './sheetModel.ts';
import { type AppLanguage, createTranslator, getLocalizedTabLabels } from './i18n.ts';
import { resolvePrintTitleCharacterName } from './paperSheetModel.ts';
import { generateSingleFilePureHtml } from './pureHtmlExporter.ts';

export function getTabLabelsForSystem(
  systemId: SystemId,
  lang: AppLanguage = 'pt-BR',
): { tab1: string; tab2: string; tab3: string } {
  return getLocalizedTabLabels(systemId, lang);
}

export function getActiveTabSectionLabel(
  systemId: SystemId,
  activeTab: TabId,
  lang: AppLanguage = 'pt-BR',
): string {
  const { tab1, tab2, tab3 } = getTabLabelsForSystem(systemId, lang);
  if (activeTab === 'xp') {
    return tab3;
  }
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

export function buildPrintDocumentTitle(
  sheet: CharacterSheetState,
  activeTab: TabId,
  lang: AppLanguage = 'pt-BR',
): string {
  const systemId = detectSystemId(sheet);
  const sectionLabel = getActiveTabSectionLabel(systemId, activeTab, lang);
  const charName = resolvePrintTitleCharacterName(sheet);
  const charSegment = sanitizeFilenameSegment(charName, 'CHARACTER');
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
  focus?: () => void;
  addEventListener?: (event: 'afterprint', listener: () => void) => void;
  removeEventListener?: (event: 'afterprint', listener: () => void) => void;
  setTimeout?: (handler: () => void, timeout?: number) => unknown;
  document?: { fonts?: { ready?: Promise<unknown> } };
}

export interface PrintDocumentLike {
  title: string;
  createElement?: (tagName: string) => unknown;
  body?: { appendChild: (node: unknown) => unknown; removeChild?: (node: unknown) => unknown };
}

interface PrintIframeLike {
  style: { cssText: string };
  setAttribute?: (name: string, value: string) => void;
  tabIndex: number;
  srcdoc: string;
  onload: (() => void) | null;
  onerror?: (() => void) | null;
  contentWindow: PrintWindowLike | null;
  remove?: () => void;
}

export function printActiveSheetView(
  sheet: CharacterSheetState,
  activeTab: TabId,
  options: {
    doc?: PrintDocumentLike;
    win?: PrintWindowLike;
    onBeforePrint?: () => void;
    onAfterPrint?: () => void;
    lang?: AppLanguage;
  } = {},
): PrintExecutionResult {
  const lang = options.lang ?? 'pt-BR';
  const t = createTranslator(lang);
  const doc = options.doc ?? (typeof document !== 'undefined' ? (document as unknown as PrintDocumentLike) : undefined);
  const win = options.win ?? (typeof window !== 'undefined' ? (window as unknown as PrintWindowLike) : undefined);
  const nextTitle = buildPrintDocumentTitle(sheet, activeTab, lang);

  const canUseIsolatedIframe = Boolean(
    doc && typeof doc.createElement === 'function' && doc.body && typeof doc.body.appendChild === 'function',
  );

  if (!canUseIsolatedIframe && (!win || typeof win.print !== 'function')) {
    return {
      ok: false,
      documentTitle: nextTitle,
      error: t('print.unavailable'),
    };
  }

  const previousTitle = doc ? doc.title : '';
  if (doc) {
    doc.title = nextTitle;
  }

  if (canUseIsolatedIframe && doc?.createElement && doc.body) {
    const iframe = doc.createElement('iframe') as PrintIframeLike;
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';
    iframe.setAttribute?.('aria-hidden', 'true');
    iframe.setAttribute?.('data-testid', 'paper-print-iframe');
    iframe.tabIndex = -1;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (doc) {
        doc.title = previousTitle;
      }
      const iframeWin = iframe.contentWindow;
      if (iframeWin && typeof iframeWin.removeEventListener === 'function') {
        iframeWin.removeEventListener('afterprint', cleanup);
      }
      if (typeof iframe.remove === 'function') {
        iframe.remove();
      } else {
        doc.body?.removeChild?.(iframe);
      }
      options.onAfterPrint?.();
    };

    const triggerIframePrint = () => {
      const iframeWin = iframe.contentWindow;
      if (!iframeWin || typeof iframeWin.print !== 'function') {
        cleanup();
        return;
      }
      if (typeof iframeWin.addEventListener === 'function') {
        iframeWin.addEventListener('afterprint', cleanup);
      }
      const invokePrint = () => {
        try {
          iframeWin.focus?.();
          iframeWin.print();
        } finally {
          const timerFn = iframeWin.setTimeout ?? win?.setTimeout;
          if (typeof timerFn === 'function') {
            timerFn(cleanup, 1500);
          } else {
            cleanup();
          }
        }
      };

      const fontsReady = iframeWin.document?.fonts?.ready;
      if (fontsReady && typeof fontsReady.then === 'function') {
        fontsReady.then(invokePrint, invokePrint);
      } else {
        invokePrint();
      }
    };

    iframe.onload = triggerIframePrint;
    iframe.onerror = cleanup;
    options.onBeforePrint?.();
    try {
      iframe.srcdoc = generateSingleFilePureHtml(sheet, lang, { documentTitle: nextTitle });
      doc.body.appendChild(iframe);
      return { ok: true, documentTitle: nextTitle };
    } catch (err) {
      cleanup();
      return {
        ok: false,
        documentTitle: nextTitle,
        error: err instanceof Error ? err.message : t('print.initFailed'),
      };
    }
  }

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    if (doc) {
      doc.title = previousTitle;
    }
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('afterprint', restoreTitle);
    }
    options.onAfterPrint?.();
  };

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('afterprint', restoreTitle);
  }

  options.onBeforePrint?.();
  try {
    win!.print();
    if (typeof win?.setTimeout === 'function') {
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
      error: err instanceof Error ? err.message : t('print.initFailed'),
    };
  }
}
