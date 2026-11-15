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
import { AppTranslations, getTranslations } from '../core/i18n';
import { SYSTEM_OPTIONS, type SystemId } from '../core/sheetModel';
import {
  type BookMetadata,
  ensurePdfRulesStoreReady,
  indexPdfBook,
  listIndexedBooks,
  type LocalRuleSearchHit,
  removeIndexedBook,
  SCANNED_PDF_NO_OCR_CODE,
  ScannedPdfNoOcrError,
  searchLocalRules,
} from '../core/pdfRulesStore';
import type {
  PdfIndexWorkerRequest,
  PdfIndexWorkerResponse,
} from '../workers/pdfIndexer.worker';

interface RulesSearchPanelProps {
  systemId?: SystemId | string;
  systemName: string;
  t?: AppTranslations['sidebar'];
}

interface IndexingProgressState {
  bookTitle: string;
  page: number;
  totalPages: number;
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
  t = DEFAULT_SIDEBAR_T,
}) => {
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
    bookTitle: string;
    sampledPages: number;
    totalPages: number;
    message: string;
  } | null>(null);

  const [localHits, setLocalHits] = useState<LocalRuleSearchHit[]>([]);
  const [localMeta, setLocalMeta] = useState<LocalSearchMeta | null>(null);
  const [queryValidationError, setQueryValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeWorkerRef = useRef<Worker | null>(null);
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
      const check = validateRulesQuery(rawQuery);
      if (!check.ok) {
        if (options?.explicitSubmit) {
          setQueryValidationError(check.error ?? 'Consulta inválida.');
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
    [effectiveSystemId, scopeMode, selectedBookId],
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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setPdfError('Selecione um arquivo PDF válido (.pdf).');
      return;
    }

    setPdfError(null);
    setScannedPdfAlert(null);

    const bookTitle = file.name.replace(/\.pdf$/i, '').trim() || 'Livro de Regras';
    const bookId = `pdf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const jobId = `job_${Date.now().toString(36)}`;
    const targetSystemId = uploadSystemId || effectiveSystemId;

    setIndexingProgress({
      bookTitle,
      page: 0,
      totalPages: 0,
    });

    try {
      const buffer = await file.arrayBuffer();

      activeWorkerRef.current?.terminate();
      const worker = new Worker(
        new URL('../workers/pdfIndexer.worker.ts', import.meta.url),
        { type: 'module' },
      );
      activeWorkerRef.current = worker;

      worker.onmessage = async (event: MessageEvent<PdfIndexWorkerResponse>) => {
        const msg = event.data;
        if (!msg || msg.jobId !== jobId) return;

        if (msg.type === 'progress') {
          setIndexingProgress({
            bookTitle,
            page: msg.page,
            totalPages: msg.totalPages,
          });
          return;
        }

        if (msg.type === 'ERROR_NO_TEXT_LAYER' && msg.code === SCANNED_PDF_NO_OCR_CODE) {
          setPdfError(null);
          setScannedPdfAlert({
            bookTitle,
            sampledPages: msg.sampledPages,
            totalPages: msg.totalPages,
            message: msg.message,
          });
          setIndexingProgress(null);
          worker.terminate();
          if (activeWorkerRef.current === worker) {
            activeWorkerRef.current = null;
          }
          return;
        }

        if (msg.type === 'error') {
          setPdfError(msg.error);
          setIndexingProgress(null);
          worker.terminate();
          if (activeWorkerRef.current === worker) {
            activeWorkerRef.current = null;
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
            });
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
                bookTitle,
                sampledPages: persistErr.sampledPages,
                totalPages: persistErr.totalPages,
                message: persistErr.message,
              });
            } else {
              setPdfError(
                persistErr instanceof Error
                  ? `Falha ao persistir índice local: ${persistErr.message}`
                  : 'Falha ao salvar índice local no IndexedDB.',
              );
            }
          } finally {
            setIndexingProgress(null);
            worker.terminate();
            if (activeWorkerRef.current === worker) {
              activeWorkerRef.current = null;
            }
          }
        }
      };

      worker.onerror = (errEvent) => {
        setPdfError(errEvent.message || 'Erro inesperado no Web Worker de indexação PDF.');
        setIndexingProgress(null);
        worker.terminate();
        if (activeWorkerRef.current === worker) {
          activeWorkerRef.current = null;
        }
      };

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
          ? `Não foi possível ler o PDF: ${err.message}`
          : 'Erro ao ler o arquivo PDF selecionado.',
      );
      setIndexingProgress(null);
    }
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
        err instanceof Error ? err.message : 'Não foi possível remover o livro indexado.',
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
        aria-label="Selecionar arquivo PDF de regras"
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
            <span>{indexingProgress ? 'INDEXANDO...' : '+ INDEXAR PDF'}</span>
          </button>

          <button
            type="button"
            data-testid="toggle-pdf-manager"
            aria-expanded={booksOpen}
            onClick={() => setBooksOpen((prev) => !prev)}
            className={`cyber-btn-outline min-h-[36px] px-2.5 py-1.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 shrink-0 cursor-pointer ${
              booksOpen
                ? 'bg-[var(--accent-cream-badge)] border-[var(--accent-wine)] text-[var(--accent-wine)]'
                : ''
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-wine)] shrink-0" aria-hidden="true" />
            <span className="tabular-nums">LIVROS ({indexedBooks.length})</span>
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
          aria-label="Livros de regras indexados localmente"
          data-testid="pdf-manager-panel"
          className="p-3 border-b-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card-alt)] flex flex-col gap-2 shrink-0 pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]">
              // LIVROS_INDEXADOS ({indexedBooks.length})
            </span>
            <select
              aria-label="Sistema vinculado ao próximo PDF"
              value={uploadSystemId}
              onChange={(e) => setUploadSystemId(e.target.value)}
              className="cyber-input min-h-[36px] px-2 py-1 text-[16px] lg:text-[10px] font-bold uppercase max-w-[140px]"
            >
              {SYSTEM_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {indexedBooks.length === 0 ? (
            <p className="font-mono-tech text-[10px] text-[var(--ink-muted)] leading-relaxed">
              Nenhum livro indexado ainda. Clique em + INDEXAR PDF para processar um manual no navegador (o arquivo binário é descartado após extração).
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
                    className={`flex flex-col gap-1.5 p-2 rounded-[4px] border-[1.5px] border-[var(--border-ink)] ${
                      isActiveSys ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-header-strip)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] truncate">
                          {book.bookTitle}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 font-mono-tech text-[9px] text-[var(--ink-muted)]">
                          <span className="px-1.5 py-0.5 bg-[var(--accent-cream-badge)] border border-[var(--border-ink)] rounded-[2px] font-bold uppercase text-[var(--accent-wine)]">
                            {book.systemId}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {book.pageCount} {book.pageCount === 1 ? 'PÁG' : 'PÁGS'}
                          </span>
                        </div>
                      </div>

                      {!isConfirming && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteBookId(book.bookId)}
                          aria-label={`Remover livro ${book.bookTitle}`}
                          data-testid={`remove-book-${book.bookId}`}
                          className="cyber-btn-outline min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase text-[var(--accent-danger)] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>REMOVER</span>
                        </button>
                      )}
                    </div>

                    {isConfirming && (
                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[var(--border-subtle)]">
                        <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-danger)] uppercase">
                          REMOVER ÍNDICE?
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleConfirmRemoveBook(book.bookId)}
                            data-testid={`confirm-remove-book-${book.bookId}`}
                            className="min-h-[36px] px-2.5 py-1 rounded-[4px] border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-danger)] text-[var(--ink-inverse)] font-mono-tech text-[10px] font-bold uppercase cursor-pointer"
                          >
                            CONFIRMAR
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteBookId(null)}
                            className="cyber-btn-outline min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            CANCELAR
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
              aria-label={`Indexando ${indexingProgress.bookTitle}`}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, indexingProgress.totalPages)}
              aria-valuenow={indexingProgress.page}
              className="p-2.5 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] shadow-[2px_2px_0_#0B0B0B] flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2 font-mono-tech text-[10px] font-bold">
                <span className="truncate text-[var(--accent-wine)]">
                  {indexingProgress.bookTitle}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--ink-primary)] uppercase">
                  {indexingProgress.totalPages > 0
                    ? `INDEXANDO PÁG. ${indexingProgress.page} / ${indexingProgress.totalPages}`
                    : 'INDEXANDO PÁG. 0 / ...'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-[var(--bg-header-strip)] border-[1.5px] border-[var(--border-ink)] rounded-[2px] overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{ width: `${progressPercent}%`, backgroundColor: '#5B0F18' }}
                />
              </div>
            </div>
          )}

          {scannedPdfAlert && (
            <div
              role="alert"
              data-testid="scanned-pdf-alert"
              className="p-3 border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] shadow-[3px_3px_0_#0B0B0B] flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[var(--accent-danger)] font-mono-tech text-xs font-black uppercase tracking-tight">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>PDF ESCANEADO (SEM OCR)</span>
                </div>
                <button
                  type="button"
                  aria-label="Fechar alerta de PDF sem OCR"
                  onClick={() => setScannedPdfAlert(null)}
                  className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs leading-snug font-semibold text-[var(--ink-primary)]">
                O arquivo{' '}
                <span className="font-mono-tech font-bold text-[var(--accent-wine)]">
                  {scannedPdfAlert.bookTitle}
                </span>{' '}
                contém apenas imagens sem camada de texto nas primeiras{' '}
                {scannedPdfAlert.sampledPages} páginas (de {scannedPdfAlert.totalPages}).
              </p>
              <p className="text-xs leading-snug text-[var(--ink-secondary)]">
                Aplique OCR no PDF usando ferramentas como{' '}
                <strong className="font-bold text-[var(--ink-primary)]">OCRmyPDF</strong>,{' '}
                <strong className="font-bold text-[var(--ink-primary)]">PDF24</strong> ou{' '}
                <strong className="font-bold text-[var(--ink-primary)]">Adobe Acrobat</strong>{' '}
                antes de importar novamente.
              </p>
            </div>
          )}

          {pdfError && (
            <div
              role="alert"
              data-testid="pdf-error-alert"
              className="p-2.5 border-[1.5px] border-[var(--accent-danger)] rounded-[4px] bg-[var(--accent-danger-soft)] flex items-start justify-between gap-2"
            >
              <span className="font-mono-tech text-[11px] font-semibold text-[var(--accent-danger)] break-words">
                {pdfError}
              </span>
              <button
                type="button"
                aria-label="Fechar erro de PDF"
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
              placeholder="Buscar termo nos PDFs locais..."
              className="cyber-input min-h-[36px] w-full min-w-0 px-2.5 py-1.5 pr-8 text-[16px] lg:text-xs font-semibold"
            />
            {query.length > 0 && (
              <button
                type="button"
                aria-label="Limpar busca de regras"
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
                className={`font-mono-tech min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase rounded-[4px] border border-[var(--border-ink)] cursor-pointer transition-colors ${
                  scopeMode === 'system'
                    ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                    : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {effectiveSystemId.toUpperCase()} ({booksForActiveSystem.length})
              </button>
              <button
                type="button"
                data-testid="rules-scope-all"
                onClick={() => setScopeMode('all')}
                className={`font-mono-tech min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase rounded-[4px] border border-[var(--border-ink)] cursor-pointer transition-colors ${
                  scopeMode === 'all'
                    ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                    : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                TODOS ({indexedBooks.length})
              </button>

              {booksInScope.length > 1 && (
                <select
                  aria-label="Filtrar resultados por livro"
                  data-testid="rules-book-filter"
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="cyber-input min-h-[36px] flex-1 min-w-[110px] px-2 py-1 text-[16px] lg:text-[10px] font-bold"
                >
                  <option value="all">TODOS OS LIVROS</option>
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
            className="p-4 border-[1.5px] border-dashed border-[var(--border-ink)]/60 rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] flex flex-col items-center text-center gap-2.5"
          >
            <BookOpen className="w-6 h-6 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              NENHUM PDF DE REGRAS INDEXADO
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Importe seus manuais em PDF para consultar regras instantaneamente offline no navegador (indexação local via IndexedDB).
            </p>
            <button
              type="button"
              disabled={Boolean(indexingProgress)}
              data-testid="pdf-empty-cta"
              onClick={triggerFilePicker}
              className="cyber-roll-btn min-h-[36px] mt-1 px-3 py-2 text-[11px] font-bold uppercase inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>+ IMPORTAR PDF DE REGRAS</span>
            </button>
          </div>
        ) : !localMeta ? (
          <div
            data-testid="pdf-ready-state"
            className="p-4 border-[1.5px] border-dashed border-[var(--border-ink)]/45 rounded-[var(--radius-control)] flex flex-col items-center text-center gap-2"
          >
            <Search className="w-5 h-5 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              ÍNDICE OFFLINE PRONTO
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed tabular-nums">
              {booksInScope.length}{' '}
              {booksInScope.length === 1 ? 'livro indexado' : 'livros indexados'} (
              {totalIndexedPages} páginas) no escopo atual. Digite ao menos 2 caracteres para filtrar instantaneamente.
            </p>
          </div>
        ) : (
          <section aria-label="Trechos locais encontrados" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                // RESULTADOS · {localMeta.count}{' '}
                {localMeta.count === 1 ? 'TRECHO' : 'TRECHOS'}
              </span>
              <span className="font-mono-tech text-[9px] font-semibold text-[var(--ink-muted)] tabular-nums shrink-0">
                {localMeta.elapsedMs.toFixed(1)} MS
              </span>
            </div>

            {localHits.length === 0 ? (
              <div className="p-3 border-[1.5px] border-dashed border-[var(--border-ink)]/50 rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
                <p className="font-mono-tech text-[11px] text-[var(--ink-secondary)] leading-relaxed">
                  Nenhum trecho encontrado para &ldquo;{localMeta.query}&rdquo; nos livros filtrados.
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
                    BUSCAR EM TODOS OS LIVROS ({indexedBooks.length})
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {localHits.map((hit) => (
                  <article
                    key={hit.id}
                    data-testid="local-rule-hit"
                    className="p-2.5 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] shadow-[2px_2px_0_#0B0B0B] flex flex-col gap-1.5"
                  >
                    <header className="flex items-center justify-between gap-1.5 pb-1 border-b border-[var(--border-subtle)]">
                      <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                        {hit.bookTitle}
                      </span>
                      <span className="font-mono-tech text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[3px] tabular-nums shrink-0">
                        PÁG. {hit.page}
                      </span>
                    </header>
                    <p className="text-xs text-[var(--ink-primary)] leading-relaxed break-words">
                      {hit.highlightParts.map((part, idx) =>
                        part.matched ? (
                          <mark
                            key={idx}
                            className="bg-[var(--accent-wine)] text-[var(--ink-inverse)] px-0.5 rounded-[2px] font-semibold"
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
