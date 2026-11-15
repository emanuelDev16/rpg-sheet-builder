import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileUp,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { validateRulesQuery } from '../core/rulesSearch';
import {
  type AppLanguage,
  type AppTranslations,
  getLocalizedSystemOptions,
  getTranslations,
} from '../core/i18n';
import type { SystemId } from '../core/sheetModel';
import {
  type BookMetadata,
  ensurePdfRulesStoreReady,
  indexPdfBook,
  listIndexedBooks,
  type LocalRuleSearchHit,
  type OcrLanguage,
  removeIndexedBook,
  SCANNED_PDF_NO_OCR_CODE,
  ScannedPdfNoOcrError,
  searchLocalRules,
} from '../core/pdfRulesStore';
import type {
  OcrProgressStage,
  PdfIndexWorkerRequest,
  PdfIndexWorkerResponse,
} from '../workers/pdfIndexer.worker';

interface RulesSearchPanelProps {
  systemId?: SystemId | string;
  systemName: string;
  language?: AppLanguage;
  t?: AppTranslations['sidebar'];
}

interface IndexingProgressState {
  bookTitle: string;
  page: number;
  totalPages: number;
  mode: 'text' | 'ocr';
  stage?: OcrProgressStage;
  currentPdfPage?: number;
}

interface LocalSearchMeta {
  query: string;
  elapsedMs: number;
  count: number;
}

type SearchScopeMode = 'system' | 'all';

const DEFAULT_SIDEBAR_T = getTranslations('pt-BR').sidebar;
const SEARCH_DEBOUNCE_MS = 150;

function inferSystemIdFromName(systemName: string): SystemId {
  const upper = systemName.toUpperCase();
  if (upper.includes('DARKNESS') || upper.includes('VAMPIRE') || upper.includes('STORYTELLER')) {
    return 'wod';
  }
  if (upper.includes('D&D') || upper.includes('5E')) {
    return 'dnd5e';
  }
  if (upper.includes('CYBERPUNK') || upper.includes('RUNNER')) {
    return 'cyberpunk';
  }
  if (upper.includes('CUSTOM') || upper.includes('ZERO') || upper.includes('BLANK')) {
    return 'blank';
  }
  return 'default';
}

export const RulesSearchPanel: React.FC<RulesSearchPanelProps> = ({
  systemId,
  systemName,
  language = 'pt-BR',
  t = DEFAULT_SIDEBAR_T,
}) => {
  const localizedSystems = useMemo(() => getLocalizedSystemOptions(language), [language]);
  const effectiveSystemId = useMemo(
    () =>
      systemId && String(systemId).trim()
        ? String(systemId).trim()
        : inferSystemIdFromName(systemName),
    [systemId, systemName],
  );

  const [query, setQuery] = useState('');
  const [scopeMode, setScopeMode] = useState<SearchScopeMode>('system');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');

  const [booksOpen, setBooksOpen] = useState(false);
  const [uploadSystemId, setUploadSystemId] = useState<string>(effectiveSystemId);
  const [indexedBooks, setIndexedBooks] = useState<BookMetadata[]>([]);
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgressState | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [scannedPdfAlert, setScannedPdfAlert] = useState<{
    bookId: string;
    bookTitle: string;
    systemId: string;
    sampledPages: number;
    totalPages: number;
    message: string;
  } | null>(null);
  const [ocrLang, setOcrLang] = useState<OcrLanguage>('por');
  const [ocrStartPage, setOcrStartPage] = useState<string>('');
  const [ocrEndPage, setOcrEndPage] = useState<string>('');

  const [localHits, setLocalHits] = useState<LocalRuleSearchHit[]>([]);
  const [localMeta, setLocalMeta] = useState<LocalSearchMeta | null>(null);
  const [queryValidationError, setQueryValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeWorkerRef = useRef<Worker | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const retainedScannedFileRef = useRef<File | null>(null);
  const searchSeqRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    setUploadSystemId(effectiveSystemId);
    setSelectedBookId('all');
  }, [effectiveSystemId]);

  const refreshBooks = useCallback(async (): Promise<BookMetadata[]> => {
    await ensurePdfRulesStoreReady();
    const books = await listIndexedBooks();
    setIndexedBooks(books);
    return books;
  }, []);

  useEffect(() => {
    void refreshBooks().catch(() => {
      // Non-fatal if browser storage is restricted
    });

    return () => {
      activeWorkerRef.current?.terminate();
      activeWorkerRef.current = null;
    };
  }, [refreshBooks]);

  const booksForActiveSystem = useMemo(
    () => indexedBooks.filter((book) => book.systemId === effectiveSystemId),
    [indexedBooks, effectiveSystemId],
  );

  const booksInScope = useMemo(
    () => (scopeMode === 'system' ? booksForActiveSystem : indexedBooks),
    [scopeMode, booksForActiveSystem, indexedBooks],
  );

  useEffect(() => {
    if (
      selectedBookId !== 'all' &&
      !booksInScope.some((book) => book.bookId === selectedBookId)
    ) {
      setSelectedBookId('all');
    }
  }, [booksInScope, selectedBookId]);

  // If active system has 0 books but another system has indexed books, automatically expose 'all'
  useEffect(() => {
    if (indexedBooks.length > 0 && booksForActiveSystem.length === 0) {
      setScopeMode('all');
    }
  }, [indexedBooks.length, booksForActiveSystem.length]);

  const suggestions = useMemo(() => {
    const upper = systemName.toUpperCase();
    if (upper.includes('DARKNESS') || upper.includes('VAMPIRE') || upper.includes('STORYTELLER')) {
      return ['Frenzy', 'Superficial', 'Hunger', 'Rouse'];
    }
    if (upper.includes('CYBERPUNK') || upper.includes('RUNNER')) {
      return ['Netrunning', 'Armor SP', 'Critical', 'Fumble'];
    }
    return ['Grapple', 'Advantage', 'Concentration', 'Opportunity'];
  }, [systemName]);

  const executeLocalSearch = useCallback(
    async (
      rawQuery: string,
      options?: {
        explicitSubmit?: boolean;
        overrideScope?: SearchScopeMode;
        overrideBookId?: string;
      },
    ) => {
      const check = validateRulesQuery(rawQuery, language);
      if (!check.ok) {
        if (options?.explicitSubmit) {
          setQueryValidationError(check.error ?? t.t('sidebar.errQueryInvalid'));
        } else {
          setQueryValidationError(null);
        }
        setLocalHits([]);
        setLocalMeta(null);
        return;
      }

      setQueryValidationError(null);
      const activeScope = options?.overrideScope ?? scopeMode;
      const activeBookFilter = options?.overrideBookId ?? selectedBookId;
      const systemFilter = activeScope === 'system' ? effectiveSystemId : 'all';
      const fetchLimit = activeBookFilter !== 'all' ? 20 : 8;

      const seq = ++searchSeqRef.current;
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const rawHits = await searchLocalRules(check.query, systemFilter, fetchLimit);
      const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

      if (seq !== searchSeqRef.current) return;

      const filteredHits =
        activeBookFilter !== 'all'
          ? rawHits.filter((hit) => hit.bookId === activeBookFilter).slice(0, 8)
          : rawHits.slice(0, 8);

      setLocalHits(filteredHits);
      setLocalMeta({
        query: check.query,
        elapsedMs: Math.max(0.1, finishedAt - startedAt),
        count: filteredHits.length,
      });
    },
    [effectiveSystemId, scopeMode, selectedBookId, language, t],
  );

  // Live debounced (~150ms) local search while typing or changing scope/book filters
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || indexedBooks.length === 0) {
      searchSeqRef.current += 1;
      setQueryValidationError(null);
      setLocalHits([]);
      setLocalMeta(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void executeLocalSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, indexedBooks.length, executeLocalSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeLocalSearch(query, { explicitSubmit: true });
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const terminateActiveWorker = useCallback(() => {
    activeJobIdRef.current = null;
    if (activeWorkerRef.current) {
      activeWorkerRef.current.terminate();
      activeWorkerRef.current = null;
    }
  }, []);

  const attachWorkerListeners = useCallback(
    (
      worker: Worker,
      context: {
        jobId: string;
        bookId: string;
        bookTitle: string;
        systemId: string;
        mode: 'text' | 'ocr';
      },
    ) => {
      worker.onmessage = async (event: MessageEvent<PdfIndexWorkerResponse>) => {
        const msg = event.data;
        if (!msg || msg.jobId !== context.jobId) return;

        if (msg.type === 'progress') {
          setIndexingProgress({
            bookTitle: context.bookTitle,
            page: msg.page,
            totalPages: msg.totalPages,
            mode: 'text',
          });
          return;
        }

        if (msg.type === 'OCR_PROGRESS') {
          setIndexingProgress({
            bookTitle: context.bookTitle,
            page: msg.page,
            totalPages: msg.totalPages,
            mode: 'ocr',
            stage: msg.stage,
            currentPdfPage: msg.currentPdfPage,
          });
          return;
        }

        if (msg.type === 'aborted') {
          setIndexingProgress(null);
          if (activeWorkerRef.current === worker) {
            terminateActiveWorker();
          }
          return;
        }

        if (msg.type === 'ERROR_NO_TEXT_LAYER' && msg.code === SCANNED_PDF_NO_OCR_CODE) {
          setPdfError(null);
          setScannedPdfAlert({
            bookId: context.bookId,
            bookTitle: context.bookTitle,
            systemId: context.systemId,
            sampledPages: msg.sampledPages,
            totalPages: msg.totalPages,
            message: msg.message,
          });
          setOcrStartPage('');
          setOcrEndPage('');
          setIndexingProgress(null);
          if (activeWorkerRef.current === worker) {
            terminateActiveWorker();
          }
          return;
        }

        if (msg.type === 'error') {
          setPdfError(msg.error);
          setIndexingProgress(null);
          if (activeWorkerRef.current === worker) {
            terminateActiveWorker();
          }
          return;
        }

        if (msg.type === 'complete') {
          try {
            await indexPdfBook({
              bookId: msg.bookId,
              bookTitle: msg.bookTitle,
              systemId: msg.systemId,
              pages: msg.pages,
              totalPages: msg.totalPages,
              skipTextLayerCheck: Boolean(msg.isOcr),
            });
            retainedScannedFileRef.current = null;
            setScannedPdfAlert(null);
            await refreshBooks();
            setBooksOpen(true);

            const currentQuery = queryRef.current.trim();
            if (currentQuery.length >= 2) {
              await executeLocalSearch(currentQuery);
            }
          } catch (persistErr) {
            if (persistErr instanceof ScannedPdfNoOcrError) {
              setPdfError(null);
              setScannedPdfAlert({
                bookId: context.bookId,
                bookTitle: context.bookTitle,
                systemId: context.systemId,
                sampledPages: persistErr.sampledPages,
                totalPages: persistErr.totalPages,
                message: persistErr.message,
              });
            } else {
              setPdfError(
                persistErr instanceof Error
                  ? t.t('sidebar.errPersistLocal', { message: persistErr.message })
                  : t.t('sidebar.errPersistIdb'),
              );
            }
          } finally {
            setIndexingProgress(null);
            if (activeWorkerRef.current === worker) {
              terminateActiveWorker();
            }
          }
        }
      };

      worker.onerror = (errEvent) => {
        setPdfError(errEvent.message || t.t('sidebar.errWorkerUnexpected'));
        setIndexingProgress(null);
        if (activeWorkerRef.current === worker) {
          terminateActiveWorker();
        }
      };
    },
    [executeLocalSearch, refreshBooks, terminateActiveWorker, t],
  );

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setPdfError(t.t('sidebar.errInvalidPdf'));
      return;
    }

    setPdfError(null);
    setScannedPdfAlert(null);
    retainedScannedFileRef.current = file;

    const bookTitle = file.name.replace(/\.pdf$/i, '').trim() || t.t('sidebar.defaultBookTitle');
    const bookId = `pdf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const jobId = `job_${Date.now().toString(36)}`;
    const targetSystemId = uploadSystemId || effectiveSystemId;

    setIndexingProgress({
      bookTitle,
      page: 0,
      totalPages: 0,
      mode: 'text',
    });

    try {
      const buffer = await file.arrayBuffer();

      terminateActiveWorker();
      const worker = new Worker(
        new URL('../workers/pdfIndexer.worker.ts', import.meta.url),
        { type: 'module' },
      );
      activeWorkerRef.current = worker;
      activeJobIdRef.current = jobId;

      attachWorkerListeners(worker, {
        jobId,
        bookId,
        bookTitle,
        systemId: targetSystemId,
        mode: 'text',
      });

      const request: PdfIndexWorkerRequest = {
        type: 'extract',
        jobId,
        bookId,
        bookTitle,
        systemId: targetSystemId,
        buffer,
      };
      worker.postMessage(request, [buffer]);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? t.t('sidebar.errReadPdf', { message: err.message })
          : t.t('sidebar.errReadPdfGeneric'),
      );
      setIndexingProgress(null);
    }
  };

  const handleStartOcrFallback = async () => {
    const file = retainedScannedFileRef.current;
    if (!file || !scannedPdfAlert) {
      setPdfError(t.t('sidebar.errPdfNotInMemory'));
      return;
    }

    const parsedStart = ocrStartPage.trim() ? Number.parseInt(ocrStartPage.trim(), 10) : undefined;
    const parsedEnd = ocrEndPage.trim() ? Number.parseInt(ocrEndPage.trim(), 10) : undefined;
    const startPage =
      typeof parsedStart === 'number' && Number.isFinite(parsedStart) && parsedStart >= 1
        ? parsedStart
        : undefined;
    const endPage =
      typeof parsedEnd === 'number' && Number.isFinite(parsedEnd) && parsedEnd >= 1
        ? parsedEnd
        : undefined;

    if (startPage !== undefined && endPage !== undefined && startPage > endPage) {
      setPdfError(t.t('sidebar.errOcrPageOrder'));
      return;
    }

    setPdfError(null);
    const { bookId, bookTitle, systemId: targetSystemId, totalPages } = scannedPdfAlert;
    const jobId = `ocr_${Date.now().toString(36)}`;

    const effectiveStart = startPage ?? 1;
    const effectiveEnd = endPage ? Math.min(totalPages, endPage) : totalPages;
    const expectedRangeTotal = Math.max(1, effectiveEnd - effectiveStart + 1);

    setScannedPdfAlert(null);
    setIndexingProgress({
      bookTitle,
      page: 0,
      totalPages: expectedRangeTotal,
      mode: 'ocr',
      stage: 'loading-engine',
    });

    try {
      const buffer = await file.arrayBuffer();

      terminateActiveWorker();
      const worker = new Worker(
        new URL('../workers/pdfIndexer.worker.ts', import.meta.url),
        { type: 'module' },
      );
      activeWorkerRef.current = worker;
      activeJobIdRef.current = jobId;

      attachWorkerListeners(worker, {
        jobId,
        bookId,
        bookTitle,
        systemId: targetSystemId,
        mode: 'ocr',
      });

      const request: PdfIndexWorkerRequest = {
        type: 'START_OCR_INDEXING',
        payload: {
          buffer,
          bookTitle,
          systemId: targetSystemId,
          lang: ocrLang,
          startPage,
          endPage,
          jobId,
          bookId,
        },
      };
      worker.postMessage(request, [buffer]);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? t.t('sidebar.errOcrStart', { message: err.message })
          : t.t('sidebar.errOcrStartGeneric'),
      );
      setIndexingProgress(null);
    }
  };

  const handleAbortOcr = () => {
    const worker = activeWorkerRef.current;
    const jobId = activeJobIdRef.current;
    if (worker) {
      const abortReq: PdfIndexWorkerRequest = {
        type: 'ABORT_INDEXING',
        jobId: jobId ?? undefined,
      };
      worker.postMessage(abortReq);
      // Safety termination in case Tesseract is mid-WASM call
      window.setTimeout(() => {
        if (activeWorkerRef.current === worker) {
          terminateActiveWorker();
        }
      }, 250);
    }
    setIndexingProgress(null);
  };

  const handleConfirmRemoveBook = async (bookId: string) => {
    try {
      await removeIndexedBook(bookId);
      setPendingDeleteBookId(null);
      const updated = await refreshBooks();
      if (updated.length === 0) {
        setLocalHits([]);
        setLocalMeta(null);
      } else if (queryRef.current.trim().length >= 2) {
        await executeLocalSearch(queryRef.current);
      }
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : t.t('sidebar.errRemoveBook'),
      );
    }
  };

  const progressPercent = useMemo(() => {
    if (!indexingProgress || indexingProgress.totalPages <= 0) return 0;
    return Math.min(
      100,
      Math.round((indexingProgress.page / indexingProgress.totalPages) * 100),
    );
  }, [indexingProgress]);

  const totalIndexedPages = useMemo(
    () => booksInScope.reduce((acc, book) => acc + book.pageCount, 0),
    [booksInScope],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        aria-label={t.t('sidebar.selectPdfAria')}
        data-testid="pdf-file-input"
        onChange={handleFileSelected}
        className="sr-only"
      />

      {/* Barra compacta superior do Gerenciador de Biblioteca Local */}
      <div className="px-3 py-2 border-b-[1.5px] border-[var(--border-ink)] bg-[var(--bg-header-strip)] flex flex-col gap-1.5 shrink-0 pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]">
        <div className="font-mono-tech text-[10px] font-semibold text-[var(--ink-muted)] truncate">
          {t.rulesContext} {systemName}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={Boolean(indexingProgress)}
            data-testid="pdf-upload-button"
            onClick={triggerFilePicker}
            className="cyber-roll-btn min-h-[36px] flex-1 px-2.5 py-1.5 text-[10px] font-bold uppercase inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <FileUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {indexingProgress ? t.t('sidebar.indexingBtn') : t.t('sidebar.indexPdfBtn')}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-pdf-manager"
            aria-expanded={booksOpen}
            onClick={() => setBooksOpen((prev) => !prev)}
            className={`cyber-btn-outline min-h-[36px] px-2.5 py-1.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 shrink-0 cursor-pointer ${
              booksOpen ? 'cyber-active-tint' : ''
            }`}
          >
            <BookOpen
              className={`w-3.5 h-3.5 shrink-0 ${booksOpen ? 'cyber-active-title' : 'text-[var(--accent-wine)]'}`}
              aria-hidden="true"
            />
            <span className="tabular-nums">
              {t.t('sidebar.booksToggleBtn', { count: indexedBooks.length })}
            </span>
            {booksOpen ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Lista colapsável // LIVROS_INDEXADOS */}
      {booksOpen && (
        <section
          aria-label={t.t('sidebar.booksManagerAria')}
          data-testid="pdf-manager-panel"
          className="p-3 border-b-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card-alt)] flex flex-col gap-2 shrink-0 pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)] truncate">
              {t.t('sidebar.booksManagerHeading', { count: indexedBooks.length })}
            </span>
            <select
              aria-label={t.t('sidebar.uploadSystemAria')}
              value={uploadSystemId}
              onChange={(e) => setUploadSystemId(e.target.value)}
              className="cyber-input min-h-[36px] px-2 py-1 text-[16px] lg:text-[10px] font-bold uppercase max-w-[140px]"
            >
              {localizedSystems.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {indexedBooks.length === 0 ? (
            <p className="font-mono-tech text-[10px] text-[var(--ink-muted)] leading-relaxed">
              {t.t('sidebar.noBooksHint')}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
              {indexedBooks.map((book) => {
                const isActiveSys = book.systemId === effectiveSystemId;
                const isConfirming = pendingDeleteBookId === book.bookId;

                return (
                  <div
                    key={book.bookId}
                    data-testid="indexed-book-item"
                    className={`flex flex-col gap-1.5 p-2 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-[var(--border-color)] ${
                      isActiveSys ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-strip)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] truncate">
                          {book.bookTitle}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 font-mono-tech text-[9px] text-[var(--ink-muted)]">
                          <span className="px-1.5 py-0.5 bg-[var(--accent-cream-badge)] border border-[var(--border-color)] rounded-[var(--radius-pill)] font-bold uppercase text-[var(--accent-wine)]">
                            {book.systemId}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {book.pageCount}{' '}
                            {book.pageCount === 1
                              ? t.t('sidebar.pageSingular')
                              : t.t('sidebar.pagePlural')}
                          </span>
                        </div>
                      </div>

                      {!isConfirming && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteBookId(book.bookId)}
                          aria-label={t.t('sidebar.removeBookAria', { title: book.bookTitle })}
                          data-testid={`remove-book-${book.bookId}`}
                          className="cyber-btn-outline min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase text-[var(--accent-danger)] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>{t.t('sidebar.removeBookBtn')}</span>
                        </button>
                      )}
                    </div>

                    {isConfirming && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[var(--border-subtle)]">
                        <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-danger)] uppercase">
                          {t.t('sidebar.confirmRemoveBook')}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleConfirmRemoveBook(book.bookId)}
                            data-testid={`confirm-remove-book-${book.bookId}`}
                            className="min-h-[36px] px-2.5 py-1 rounded-[var(--radius-pill)] border-[length:var(--border-width)] border-[var(--border-color)] bg-[var(--accent-danger)] text-[var(--accent-danger-contrast)] font-mono-tech text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {t.t('sidebar.confirmBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteBookId(null)}
                            className="cyber-btn-outline min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {t.t('sidebar.cancelBtn')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Progresso sólido de indexação + Alertas de PDF sem OCR */}
      {(indexingProgress || scannedPdfAlert || pdfError) && (
        <div className="px-3 pt-2.5 flex flex-col gap-2 shrink-0 pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]">
          {indexingProgress && (
            <div
              role="progressbar"
              data-testid="pdf-indexing-progress"
              aria-label={t.t('sidebar.indexingAria', { title: indexingProgress.bookTitle })}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, indexingProgress.totalPages)}
              aria-valuenow={indexingProgress.page}
              className="p-2.5 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card)] shadow-[var(--shadow-btn)] flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2 font-mono-tech text-[10px] font-bold">
                <span className="truncate text-[var(--accent-wine)]">
                  {indexingProgress.bookTitle}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--ink-primary)] uppercase">
                  {indexingProgress.mode === 'ocr'
                    ? indexingProgress.totalPages > 0
                      ? t.t('sidebar.ocrProgressPage', {
                          page: indexingProgress.page,
                          total: indexingProgress.totalPages,
                        })
                      : t.t('sidebar.ocrProgressWait')
                    : indexingProgress.totalPages > 0
                      ? t.t('sidebar.indexingProgressPage', {
                          page: indexingProgress.page,
                          total: indexingProgress.totalPages,
                        })
                      : t.t('sidebar.indexingProgressWait')}
                </span>
              </div>
              <div className="w-full h-2.5 bg-[var(--bg-strip)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{ width: `${progressPercent}%`, backgroundColor: 'var(--accent-primary)' }}
                />
              </div>
              {indexingProgress.mode === 'ocr' && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono-tech text-[10px] text-[var(--ink-secondary)] leading-tight">
                    {indexingProgress.stage === 'loading-engine'
                      ? t.t('sidebar.ocrLoadingEngine')
                      : t.t('sidebar.ocrProcessingHint')}
                  </span>
                  <button
                    type="button"
                    data-testid="cancel-ocr-button"
                    onClick={handleAbortOcr}
                    className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--accent-danger)] border-[var(--border-color)] shrink-0 cursor-pointer"
                  >
                    {t.t('sidebar.cancelOcrBtn')}
                  </button>
                </div>
              )}
            </div>
          )}

          {scannedPdfAlert && (
            <div
              role="alert"
              data-testid="scanned-pdf-alert"
              className="p-3 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--accent-danger-soft)] shadow-[var(--shadow-card)] flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[var(--accent-danger)] font-mono-tech text-xs font-black uppercase tracking-tight">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t.t('sidebar.scannedPdfTitle')}</span>
                </div>
                <button
                  type="button"
                  aria-label={t.t('sidebar.closeScannedAlertAria')}
                  onClick={() => {
                    retainedScannedFileRef.current = null;
                    setScannedPdfAlert(null);
                  }}
                  className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs leading-snug font-semibold text-[var(--ink-primary)] break-words">
                {t.t('sidebar.scannedPdfDesc', {
                  title: scannedPdfAlert.bookTitle,
                  sampled: scannedPdfAlert.sampledPages,
                  total: scannedPdfAlert.totalPages,
                })}
              </p>

              <div className="p-2 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card)] flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="ocr-lang-select"
                    className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                  >
                    {t.t('sidebar.ocrLangLabel')}
                  </label>
                  <select
                    id="ocr-lang-select"
                    data-testid="ocr-lang-select"
                    value={ocrLang}
                    onChange={(e) => setOcrLang(e.target.value as OcrLanguage)}
                    className="cyber-input min-h-[36px] px-2 py-1 text-[16px] lg:text-[11px] font-bold"
                  >
                    <option value="por">{t.t('sidebar.ocrLangPor')}</option>
                    <option value="eng">{t.t('sidebar.ocrLangEng')}</option>
                    <option value="por+eng">{t.t('sidebar.ocrLangBoth')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="ocr-start-page"
                      className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t.t('sidebar.ocrStartPageLabel')}
                    </label>
                    <input
                      id="ocr-start-page"
                      data-testid="ocr-start-page-input"
                      type="number"
                      min={1}
                      max={scannedPdfAlert.totalPages}
                      placeholder="1"
                      value={ocrStartPage}
                      onChange={(e) => setOcrStartPage(e.target.value)}
                      className="cyber-input min-h-[36px] px-2 py-1 text-[16px] lg:text-xs font-semibold tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="ocr-end-page"
                      className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t.t('sidebar.ocrEndPageLabel')}
                    </label>
                    <input
                      id="ocr-end-page"
                      data-testid="ocr-end-page-input"
                      type="number"
                      min={1}
                      max={scannedPdfAlert.totalPages}
                      placeholder={String(scannedPdfAlert.totalPages)}
                      value={ocrEndPage}
                      onChange={(e) => setOcrEndPage(e.target.value)}
                      className="cyber-input min-h-[36px] px-2 py-1 text-[16px] lg:text-xs font-semibold tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="start-ocr-fallback-button"
                  onClick={() => void handleStartOcrFallback()}
                  className="cyber-roll-btn min-h-[36px] w-full px-3 py-1.5 text-[10px] font-bold uppercase inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {t.t('sidebar.startOcrBtn')}
                </button>
              </div>
            </div>
          )}

          {pdfError && (
            <div
              role="alert"
              data-testid="pdf-error-alert"
              className="p-2.5 border-[length:var(--border-width)] border-[var(--accent-danger)] rounded-[var(--radius-card)] bg-[var(--accent-danger-soft)] flex items-start justify-between gap-2"
            >
              <span className="font-mono-tech text-[11px] font-semibold text-[var(--accent-danger)] break-words">
                {pdfError}
              </span>
              <button
                type="button"
                aria-label={t.t('sidebar.closePdfErrorAria')}
                onClick={() => setPdfError(null)}
                className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Campo de Busca Instantânea Local */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-b-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-card-alt)] flex flex-col gap-2 shrink-0 pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]"
      >
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              aria-label={t.rulesSearchAria}
              data-testid="rules-local-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.t('sidebar.rulesSearchPlaceholder')}
              className="cyber-input min-h-[36px] w-full min-w-0 px-2.5 py-1.5 pr-8 text-[16px] lg:text-xs font-semibold"
            />
            {query.length > 0 && (
              <button
                type="button"
                aria-label={t.t('sidebar.clearRulesSearchAria')}
                onClick={() => setQuery('')}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[32px] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="cyber-roll-btn min-h-[36px] px-2.5 py-1.5 text-[11px] font-bold uppercase shrink-0 cursor-pointer"
          >
            {t.rulesSearchBtn}
          </button>
        </div>

        {indexedBooks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-testid="rules-scope-system"
                onClick={() => setScopeMode('system')}
                className={`font-mono-tech min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] cursor-pointer transition-colors ${
                  scopeMode === 'system'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {effectiveSystemId.toUpperCase()} ({booksForActiveSystem.length})
              </button>
              <button
                type="button"
                data-testid="rules-scope-all"
                onClick={() => setScopeMode('all')}
                className={`font-mono-tech min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] cursor-pointer transition-colors ${
                  scopeMode === 'all'
                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {t.t('sidebar.scopeAllBtn', { count: indexedBooks.length })}
              </button>

              {booksInScope.length > 1 && (
                <select
                  aria-label={t.t('sidebar.filterByBookAria')}
                  data-testid="rules-book-filter"
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="cyber-input min-h-[36px] flex-1 min-w-[110px] px-2 py-1 text-[16px] lg:text-[10px] font-bold"
                >
                  <option value="all">{t.t('sidebar.allBooksOption')}</option>
                  {booksInScope.map((book) => (
                    <option key={book.bookId} value={book.bookId}>
                      {book.bookTitle}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    void executeLocalSearch(item, { explicitSubmit: true });
                  }}
                  className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Área rolável de resultados locais & Empty States */}
      <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))] flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-3">
        {queryValidationError && (
          <div
            role="alert"
            className="p-2.5 border-[1.5px] border-[var(--accent-danger)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] font-mono-tech text-[11px] font-semibold text-[var(--accent-danger)]"
          >
            {queryValidationError}
          </div>
        )}

        {indexedBooks.length === 0 ? (
          <div
            data-testid="pdf-empty-state"
            className="p-4 border-[length:var(--border-width)] border-dashed border-[var(--border-color)]/60 rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col items-center text-center gap-2.5"
          >
            <BookOpen className="w-6 h-6 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              {t.t('sidebar.emptyPdfTitle')}
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              {t.t('sidebar.emptyPdfDesc')}
            </p>
            <button
              type="button"
              disabled={Boolean(indexingProgress)}
              data-testid="pdf-empty-cta"
              onClick={triggerFilePicker}
              className="cyber-roll-btn min-h-[36px] mt-1 px-3 py-2 text-[11px] font-bold uppercase inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.t('sidebar.emptyPdfCta')}</span>
            </button>
          </div>
        ) : !localMeta ? (
          <div
            data-testid="pdf-ready-state"
            className="p-4 border-[length:var(--border-width)] border-dashed border-[var(--border-color)]/45 rounded-[var(--radius-card)] flex flex-col items-center text-center gap-2"
          >
            <Search className="w-5 h-5 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              {t.t('sidebar.readyPdfTitle')}
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed tabular-nums">
              {t.t('sidebar.readyPdfDesc', {
                count: booksInScope.length,
                bookWord:
                  booksInScope.length === 1
                    ? t.t('sidebar.readyPdfBookSingular')
                    : t.t('sidebar.readyPdfBookPlural'),
                pages: totalIndexedPages,
              })}
            </p>
          </div>
        ) : (
          <section aria-label={t.t('sidebar.resultsAria')} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                {t.t('sidebar.resultsHeader', {
                  count: localMeta.count,
                  word:
                    localMeta.count === 1
                      ? t.t('sidebar.resultsExcerptSingular')
                      : t.t('sidebar.resultsExcerptPlural'),
                })}
              </span>
              <span className="font-mono-tech text-[9px] font-semibold text-[var(--ink-muted)] tabular-nums shrink-0">
                {localMeta.elapsedMs.toFixed(1)} MS
              </span>
            </div>

            {localHits.length === 0 ? (
              <div className="p-3 border-[length:var(--border-width)] border-dashed border-[var(--border-color)]/50 rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
                <p className="font-mono-tech text-[11px] text-[var(--ink-secondary)] leading-relaxed">
                  {t.t('sidebar.noHitsMessage', { query: localMeta.query })}
                </p>
                {(scopeMode === 'system' && indexedBooks.length > booksForActiveSystem.length) ||
                selectedBookId !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode('all');
                      setSelectedBookId('all');
                      void executeLocalSearch(localMeta.query, {
                        overrideScope: 'all',
                        overrideBookId: 'all',
                      });
                    }}
                    className="cyber-btn-outline min-h-[36px] self-start px-2.5 py-1.5 text-[10px] font-bold uppercase cursor-pointer"
                  >
                    {t.t('sidebar.searchAllBooksBtn', { count: indexedBooks.length })}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {localHits.map((hit) => (
                  <article
                    key={hit.id}
                    data-testid="local-rule-hit"
                    className="p-2.5 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card)] shadow-[var(--shadow-btn)] flex flex-col gap-1.5"
                  >
                    <header className="flex items-center justify-between gap-1.5 pb-1 border-b border-[var(--border-subtle)]">
                      <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                        {hit.bookTitle}
                      </span>
                      <span className="font-mono-tech text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] rounded-[var(--radius-pill)] tabular-nums shrink-0">
                        {t.t('sidebar.pageBadge', { page: hit.page })}
                      </span>
                    </header>
                    <p className="text-xs text-[var(--ink-primary)] leading-relaxed break-words">
                      {hit.highlightParts.map((part, idx) =>
                        part.matched ? (
                          <mark
                            key={idx}
                            className="bg-[var(--accent-primary)] text-[var(--accent-contrast)] px-0.5 rounded-[var(--radius-pill)] font-semibold"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          <React.Fragment key={idx}>{part.text}</React.Fragment>
                        ),
                      )}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
