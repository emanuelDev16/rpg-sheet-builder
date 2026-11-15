import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileUp,
  Search,
  Trash2,
} from 'lucide-react';
import { AppTranslations, getTranslations } from '../core/i18n';
import { SYSTEM_OPTIONS, type SystemId } from '../core/sheetModel';
import {
  type BookMetadata,
  ensurePdfRulesStoreReady,
  indexPdfBook,
  listIndexedBooks,
  type LocalRuleSearchHit,
  removeIndexedBook,
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

const DEFAULT_SIDEBAR_T = getTranslations('pt-BR').sidebar;

function validateLocalRulesQuery(rawQuery: string): {
  ok: boolean;
  query: string;
  error?: string;
} {
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) {
    return {
      ok: false,
      query: trimmed,
      error: 'Digite pelo menos 2 caracteres para pesquisar uma regra.',
    };
  }
  if (trimmed.length > 300) {
    return {
      ok: false,
      query: trimmed,
      error: 'A consulta deve ter no máximo 300 caracteres.',
    };
  }
  return { ok: true, query: trimmed };
}

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
    () => (systemId && String(systemId).trim() ? String(systemId).trim() : inferSystemIdFromName(systemName)),
    [systemId, systemName],
  );

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Local PDF search state (100% offline via pdfRulesStore / MiniSearch)
  const [pdfManagerOpen, setPdfManagerOpen] = useState(false);
  const [uploadSystemId, setUploadSystemId] = useState<string>(effectiveSystemId);
  const [indexedBooks, setIndexedBooks] = useState<BookMetadata[]>([]);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgressState | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [localHits, setLocalHits] = useState<LocalRuleSearchHit[]>([]);
  const [localMeta, setLocalMeta] = useState<LocalSearchMeta | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    setUploadSystemId(effectiveSystemId);
  }, [effectiveSystemId]);

  const refreshBooks = useCallback(async () => {
    await ensurePdfRulesStoreReady();
    const books = await listIndexedBooks();
    setIndexedBooks(books);
  }, []);

  useEffect(() => {
    void refreshBooks().catch(() => {
      // Non-fatal if storage is blocked
    });

    return () => {
      activeWorkerRef.current?.terminate();
      activeWorkerRef.current = null;
    };
  }, [refreshBooks]);

  const booksForActiveSystem = useMemo(
    () => indexedBooks.filter((b) => b.systemId === effectiveSystemId),
    [indexedBooks, effectiveSystemId],
  );

  const suggestions = useMemo(() => {
    const upper = systemName.toUpperCase();
    if (upper.includes('DARKNESS') || upper.includes('VAMPIRE') || upper.includes('STORYTELLER')) {
      return ['Frenzy check', 'Superficial & Aggravated damage', 'Botch rules', 'Hunger & Rouse check'];
    }
    if (upper.includes('CYBERPUNK') || upper.includes('RUNNER')) {
      return ['Netrunning actions', 'Armor SP', 'Critical injuries', 'Fumble'];
    }
    return ['Grapple rules', 'Advantage', 'Concentration', 'Opportunity attack'];
  }, [systemName]);

  const executeSearch = async (rawQuery: string) => {
    const check = validateLocalRulesQuery(rawQuery);
    if (!check.ok) {
      setError(check.error ?? 'Consulta inválida.');
      return;
    }

    setQuery(check.query);
    setError(null);

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const hits = await searchLocalRules(check.query, effectiveSystemId, 5);
    const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsedMs = Math.max(0.1, finishedAt - startedAt);

    setLocalHits(hits);
    setLocalMeta({
      query: check.query,
      elapsedMs,
      count: hits.length,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(query);
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
    setPdfManagerOpen(true);

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
            if (query.trim().length >= 2) {
              const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const hits = await searchLocalRules(query.trim(), effectiveSystemId, 5);
              const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
              setLocalHits(hits);
              setLocalMeta({
                query: query.trim(),
                elapsedMs: Math.max(0.1, t1 - t0),
                count: hits.length,
              });
            }
          } catch (persistErr) {
            setPdfError(
              persistErr instanceof Error
                ? `Falha ao persistir índice local: ${persistErr.message}`
                : 'Falha ao salvar índice local no IndexedDB.',
            );
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
      // Transfer ArrayBuffer ownership off-thread so the main thread keeps zero binary copy
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

  const handleRemoveBook = async (bookId: string) => {
    try {
      await removeIndexedBook(bookId);
      await refreshBooks();
      if (localMeta) {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const hits = await searchLocalRules(localMeta.query, effectiveSystemId, 5);
        const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setLocalHits(hits);
        setLocalMeta({
          query: localMeta.query,
          elapsedMs: Math.max(0.1, t1 - t0),
          count: hits.length,
        });
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Formulário de pesquisa + barra de PDFs locais */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-b-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-card-alt)] flex flex-col gap-2 shrink-0"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono-tech text-[10px] font-semibold text-[var(--ink-muted)] truncate">
            {t.rulesContext} {systemName}
          </div>
          <button
            type="button"
            data-testid="toggle-pdf-manager"
            aria-expanded={pdfManagerOpen}
            onClick={() => setPdfManagerOpen((prev) => !prev)}
            className={`cyber-btn-outline px-2 py-0.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 shrink-0 cursor-pointer ${
              pdfManagerOpen
                ? 'bg-[var(--accent-cream-badge)] border-[var(--accent-wine)] text-[var(--accent-wine)]'
                : ''
            }`}
          >
            <BookOpen className="w-3 h-3 text-[var(--accent-wine)]" aria-hidden="true" />
            <span>PDFS ({booksForActiveSystem.length})</span>
            {pdfManagerOpen ? (
              <ChevronUp className="w-3 h-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            aria-label={t.rulesSearchAria}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.rulesPlaceholder}
            className="cyber-input mobile-touch-input flex-1 min-w-0 px-2 py-1.5 text-[16px] lg:text-xs font-semibold"
          />
          <button
            type="submit"
            className="cyber-roll-btn mobile-touch-input px-2.5 py-1.5 text-[11px] font-bold uppercase shrink-0 cursor-pointer"
          >
            {t.rulesSearchBtn}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void executeSearch(item)}
              className="cyber-btn-outline px-2 py-1 text-[10px] font-bold cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      </form>

      {/* Área de gerenciamento de PDFs locais (Light Cyber Brutalism) */}
      {pdfManagerOpen && (
        <section
          aria-label="Gerenciamento de PDFs de regras locais"
          data-testid="pdf-manager-panel"
          className="p-3 border-b-[1.5px] border-[var(--border-ink)] bg-[var(--bg-header-strip)] flex flex-col gap-2.5 shrink-0 pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]">
              // BIBLIOTECA PDF LOCAL (INDEXEDDB)
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            aria-label="Selecionar arquivo PDF de regras"
            data-testid="pdf-file-input"
            onChange={handleFileSelected}
            className="sr-only"
          />

          <div className="flex flex-col sm:flex-row lg:flex-col gap-1.5">
            <select
              aria-label="Sistema do PDF"
              value={uploadSystemId}
              onChange={(e) => setUploadSystemId(e.target.value)}
              className="cyber-input mobile-touch-input px-2 py-1 text-[16px] lg:text-[11px] font-bold uppercase"
            >
              {SYSTEM_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={Boolean(indexingProgress)}
              data-testid="pdf-upload-button"
              onClick={() => fileInputRef.current?.click()}
              className="cyber-roll-btn mobile-touch-input px-2.5 py-1.5 text-[11px] font-bold uppercase inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{indexingProgress ? 'INDEXANDO PDF...' : 'INDEXAR PDF LOCAL'}</span>
            </button>
          </div>

          {indexingProgress && (
            <div
              role="progressbar"
              aria-label={`Indexando ${indexingProgress.bookTitle}`}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, indexingProgress.totalPages)}
              aria-valuenow={indexingProgress.page}
              className="p-2 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2 font-mono-tech text-[10px] font-bold">
                <span className="truncate text-[var(--accent-wine)]">{indexingProgress.bookTitle}</span>
                <span className="shrink-0 tabular-nums text-[var(--ink-primary)]">
                  {indexingProgress.totalPages > 0
                    ? `${indexingProgress.page}/${indexingProgress.totalPages} (${progressPercent}%)`
                    : 'LENDO PDF...'}
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--accent-wine-soft)] border border-[var(--border-ink)] rounded-[2px] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-wine)] transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {pdfError && (
            <div
              role="alert"
              className="p-2 border-[1.5px] border-[var(--accent-danger)] rounded-[4px] bg-[var(--accent-danger-soft)] font-mono-tech text-[10px] font-semibold text-[var(--accent-danger)] break-words"
            >
              {pdfError}
            </div>
          )}

          {indexedBooks.length === 0 ? (
            <p className="font-mono-tech text-[10px] text-[var(--ink-muted)] leading-relaxed">
              Nenhum PDF indexado. O texto é extraído off-thread e o binário é descartado após a indexação.
            </p>
          ) : (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {indexedBooks.map((book) => {
                const isActiveSys = book.systemId === effectiveSystemId;
                return (
                  <div
                    key={book.bookId}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-[4px] border border-[var(--border-ink)] ${
                      isActiveSys ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-card-alt)] opacity-75'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono-tech text-[10px] font-bold text-[var(--ink-primary)] truncate">
                        {book.bookTitle}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 font-mono-tech text-[9px] text-[var(--ink-muted)]">
                        <span className="px-1 py-0.2 bg-[var(--accent-cream-badge)] border border-[var(--border-ink)]/50 rounded-[2px] font-bold uppercase text-[var(--accent-wine)]">
                          {book.systemId}
                        </span>
                        <span className="tabular-nums">{book.pageCount} PÁGS</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveBook(book.bookId)}
                      aria-label={`Remover livro ${book.bookTitle}`}
                      title={`Remover ${book.bookTitle}`}
                      className="mobile-touch-stepper p-1 rounded-[4px] text-[var(--ink-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger-soft)] transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Área de resultados (com safe-area inset bottom) */}
      <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pl-[max(12px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))] flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-3">
        {/* Resultados Locais (Instantâneos < 20ms) */}
        {localMeta && (
          <section aria-label="Trechos locais encontrados" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                // PDF LOCAL · {localMeta.count} {localMeta.count === 1 ? 'TRECHO' : 'TRECHOS'}
              </span>
              <span className="font-mono-tech text-[9px] font-semibold text-[var(--ink-muted)] tabular-nums shrink-0">
                {localMeta.elapsedMs.toFixed(1)} MS
              </span>
            </div>

            {localHits.length === 0 ? (
              <div className="p-2.5 border-[1.5px] border-dashed border-[var(--border-ink)]/50 rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
                <p className="font-mono-tech text-[10px] text-[var(--ink-secondary)] leading-relaxed">
                  {booksForActiveSystem.length > 0
                    ? `Nenhum trecho encontrado nos ${booksForActiveSystem.length} PDF(s) locais de ${effectiveSystemId.toUpperCase()} para "${localMeta.query}".`
                    : `Nenhum PDF local indexado para ${effectiveSystemId.toUpperCase()}.`}
                </p>
                {booksForActiveSystem.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setPdfManagerOpen(true)}
                    className="cyber-btn-outline self-start px-2 py-1 text-[10px] font-bold uppercase inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileUp className="w-3 h-3 text-[var(--accent-wine)]" aria-hidden="true" />
                    <span>INDEXAR PDF LOCAL</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {localHits.map((hit) => (
                  <article
                    key={hit.id}
                    data-testid="local-rule-hit"
                    className="p-2.5 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] shadow-[2px_2px_0_#0B0B0B] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono-tech text-[9px] font-bold uppercase px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--border-ink)] rounded-[3px] truncate">
                        {hit.bookTitle}
                      </span>
                      <span className="font-mono-tech text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[3px] tabular-nums shrink-0">
                        P. {hit.page}
                      </span>
                    </div>
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

        {error && (
          <div
            role="alert"
            className="p-3 border-[1.5px] border-[var(--accent-danger)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] flex flex-col gap-1.5 min-w-0 overflow-hidden"
          >
            <div className="font-mono-tech text-[11px] font-bold text-[var(--accent-danger)] uppercase">
              CONSULTA INVÁLIDA
            </div>
            <p className="text-xs text-[var(--ink-primary)] leading-relaxed break-words">{error}</p>
          </div>
        )}

        {!error && !localMeta && (
          <div className="p-4 border-[1.5px] border-dashed border-[var(--border-ink)]/40 rounded-[var(--radius-control)] flex flex-col items-center text-center gap-2">
            <Search className="w-5 h-5 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              CONSULTA RÁPIDA DE REGRAS
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              {booksForActiveSystem.length > 0
                ? `${booksForActiveSystem.length} PDF(s) indexados localmente para busca instantânea offline.`
                : 'Indexe PDFs locais do sistema para consulta instantânea offline de regras.'}
            </p>
            <button
              type="button"
              onClick={() => setPdfManagerOpen(true)}
              className="cyber-btn-outline mt-1 px-2.5 py-1 text-[10px] font-bold uppercase inline-flex items-center gap-1 cursor-pointer"
            >
              <FileUp className="w-3 h-3 text-[var(--accent-wine)]" aria-hidden="true" />
              <span>INDEXAR PDF LOCAL</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
