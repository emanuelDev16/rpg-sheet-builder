import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileUp,
  KeyRound,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import {
  buildLocalRagPrompt,
  formatRulesSearchError,
  type LocalRuleContextExcerpt,
  type RulesSearchResponse,
  validateRulesQuery,
} from '../core/rulesSearch';
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

interface SynthesizedRagAnswer {
  query: string;
  answer: string;
  excerptsUsed: number;
  sourceLabel: string;
}

const LOCAL_GEMINI_KEY_STORAGE = 'grid_sheet_gemini_api_key_v1';
const DEFAULT_SIDEBAR_T = getTranslations('pt-BR').sidebar;

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

function readStoredGeminiKey(): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  try {
    return window.localStorage.getItem(LOCAL_GEMINI_KEY_STORAGE)?.trim() ?? '';
  } catch {
    return '';
  }
}

function writeStoredGeminiKey(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (key.trim()) {
      window.localStorage.setItem(LOCAL_GEMINI_KEY_STORAGE, key.trim());
    } else {
      window.localStorage.removeItem(LOCAL_GEMINI_KEY_STORAGE);
    }
  } catch {
    // Ignore storage quota / privacy errors
  }
}

function formatAnswerBlocks(rawText: string): string[] {
  return rawText
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .split(/\n{2,}|\n(?=[-•*] )/)
    .map((block) => block.trim())
    .filter(Boolean);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<RulesSearchResponse | null>(null);
  const [history, setHistory] = useState<RulesSearchResponse[]>([]);

  // Local PDF RAG state
  const [pdfManagerOpen, setPdfManagerOpen] = useState(false);
  const [uploadSystemId, setUploadSystemId] = useState<string>(effectiveSystemId);
  const [indexedBooks, setIndexedBooks] = useState<BookMetadata[]>([]);
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

  // Hybrid Gemini synthesis state
  const [serverGeminiConfigured, setServerGeminiConfigured] = useState(false);
  const [localGeminiKey, setLocalGeminiKey] = useState<string>(() => readStoredGeminiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keyDraft, setKeyDraft] = useState<string>(() => readStoredGeminiKey());
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [synthesizedAnswer, setSynthesizedAnswer] = useState<SynthesizedRagAnswer | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeWorkerRef = useRef<Worker | null>(null);

  const envGeminiKey =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_GEMINI_API_KEY === 'string'
      ? import.meta.env.VITE_GEMINI_API_KEY.trim()
      : '';
  const effectiveClientGeminiKey = localGeminiKey || envGeminiKey;
  const hasGeminiKey = serverGeminiConfigured || effectiveClientGeminiKey.length > 0;

  useEffect(() => {
    setUploadSystemId(effectiveSystemId);
  }, [effectiveSystemId]);

  const refreshBooks = useCallback(async () => {
    await ensurePdfRulesStoreReady();
    const books = await listIndexedBooks();
    setIndexedBooks(books);
  }, []);

  useEffect(() => {
    let active = true;

    void refreshBooks().catch(() => {
      // Non-fatal if storage is blocked
    });

    fetch('/api/rules-search/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { geminiConfigured?: boolean } | null) => {
        if (active && data && typeof data.geminiConfigured === 'boolean') {
          setServerGeminiConfigured(data.geminiConfigured);
        }
      })
      .catch(() => {
        // Static build / offline mode
      });

    return () => {
      active = false;
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

  const runGoogleSearch = async (cleanQuery: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rules-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cleanQuery,
          systemName,
        }),
      });

      const data = (await res.json()) as RulesSearchResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || `Erro HTTP ${res.status} ao consultar regras.`);
        return;
      }

      setActiveResult(data);
      setHistory((prev) => {
        const filtered = prev.filter(
          (item) => item.query.toLowerCase() !== data.query.toLowerCase(),
        );
        return [data, ...filtered].slice(0, 6);
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erro de conexão: ${err.message}`
          : 'Não foi possível conectar ao serviço de busca.',
      );
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = async (rawQuery: string) => {
    const check = validateRulesQuery(rawQuery);
    if (!check.ok) {
      setError(check.error ?? 'Consulta inválida.');
      return;
    }

    setQuery(check.query);
    setError(null);
    setSynthesisError(null);
    setSynthesizedAnswer(null);

    // 1. Instant local lexical search (< 20 ms) when hydrated
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

    // 2. If there are no local books indexed for this system, preserve instant Google Search flow
    if (booksForActiveSystem.length === 0 && hits.length === 0) {
      await runGoogleSearch(check.query);
    } else {
      setActiveResult(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(query);
  };

  const handleSynthesizeLocal = async () => {
    if (!localMeta || localHits.length === 0 || !hasGeminiKey) return;

    // Strictly cap context to top 3-5 retrieved excerpts
    const topExcerpts: LocalRuleContextExcerpt[] = localHits.slice(0, 5).map((hit) => ({
      bookTitle: hit.bookTitle,
      page: hit.page,
      excerpt: hit.excerpt,
    }));

    setSynthesizing(true);
    setSynthesisError(null);

    try {
      if (effectiveClientGeminiKey) {
        const ai = new GoogleGenAI({ apiKey: effectiveClientGeminiKey });
        const prompt = buildLocalRagPrompt(localMeta.query, topExcerpts, systemName);
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a concise tabletop RPG rules synthesizer inside GridSheet. Answer strictly using the provided local PDF excerpts, cite book titles and page numbers, keep answers under ~130 words, and avoid filler greetings.',
          },
        });
        const text = (response.text ?? '').trim();
        if (!text) {
          setSynthesisError('O Gemini não retornou texto para os trechos enviados.');
          return;
        }
        setSynthesizedAnswer({
          query: localMeta.query,
          answer: text,
          excerptsUsed: topExcerpts.length,
          sourceLabel: 'GEMINI (CHAVE LOCAL)',
        });
        return;
      }

      const res = await fetch('/api/rules-synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: localMeta.query,
          systemName,
          excerpts: topExcerpts,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        answer?: string;
        excerptsUsed?: number;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.answer) {
        setSynthesisError(data.error || `Erro HTTP ${res.status} ao sintetizar com Gemini.`);
        return;
      }

      setSynthesizedAnswer({
        query: localMeta.query,
        answer: data.answer,
        excerptsUsed: data.excerptsUsed ?? topExcerpts.length,
        sourceLabel: 'GEMINI (SERVER RAG)',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao sintetizar regra.';
      setSynthesisError(formatRulesSearchError(msg).message);
    } finally {
      setSynthesizing(false);
    }
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
        setSynthesizedAnswer(null);
      }
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Não foi possível remover o livro indexado.',
      );
    }
  };

  const handleSaveLocalKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = keyDraft.trim();
    writeStoredGeminiKey(cleaned);
    setLocalGeminiKey(cleaned);
    setShowKeyConfig(false);
  };

  const answerBlocks = useMemo(
    () => (activeResult?.answer ? formatAnswerBlocks(activeResult.answer) : []),
    [activeResult],
  );

  const synthesisBlocks = useMemo(
    () => (synthesizedAnswer?.answer ? formatAnswerBlocks(synthesizedAnswer.answer) : []),
    [synthesizedAnswer],
  );

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
            disabled={loading}
            className="cyber-roll-btn mobile-touch-input px-2.5 py-1.5 text-[11px] font-bold uppercase shrink-0 cursor-pointer disabled:opacity-60"
          >
            {loading ? '...' : t.rulesSearchBtn}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              disabled={loading}
              onClick={() => void executeSearch(item)}
              className="cyber-btn-outline px-2 py-1 text-[10px] font-bold cursor-pointer disabled:opacity-60"
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
            <button
              type="button"
              onClick={() => setShowKeyConfig((prev) => !prev)}
              className="font-mono-tech text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[3px] border border-[var(--border-ink)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1 cursor-pointer"
              title="Configurar chave Gemini API opcional para síntese RAG"
            >
              <KeyRound className="w-2.5 h-2.5 text-[var(--accent-wine)]" aria-hidden="true" />
              <span>{hasGeminiKey ? 'GEMINI: ON' : 'API KEY'}</span>
            </button>
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

          {scannedPdfAlert && (
            <div
              role="alert"
              data-testid="scanned-pdf-alert"
              className="p-3 border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] shadow-[3px_3px_0_var(--border-ink)] flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[var(--accent-danger)] font-mono-tech text-[14px] font-black uppercase tracking-tight">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>PDF ESCANEADO (SEM OCR)</span>
                </div>
                <button
                  type="button"
                  aria-label="Fechar alerta de PDF sem OCR"
                  onClick={() => setScannedPdfAlert(null)}
                  className="p-0.5 border border-[var(--border-ink)] rounded-[3px] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <p className="text-[14px] leading-snug font-semibold text-[var(--ink-primary)]">
                O arquivo{' '}
                <span className="font-mono-tech font-bold text-[var(--accent-wine)]">
                  {scannedPdfAlert.bookTitle}
                </span>{' '}
                contém apenas imagens escaneadas sem camada de texto nas primeiras{' '}
                {scannedPdfAlert.sampledPages} páginas (de {scannedPdfAlert.totalPages}).
              </p>
              <p className="text-[14px] leading-snug text-[var(--ink-secondary)]">
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
              className="p-2 border-[1.5px] border-[var(--accent-danger)] rounded-[4px] bg-[var(--accent-danger-soft)] font-mono-tech text-[10px] font-semibold text-[var(--accent-danger)] break-words"
            >
              {pdfError}
            </div>
          )}

          {showKeyConfig && (
            <form
              onSubmit={handleSaveLocalKey}
              className="p-2 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] flex flex-col gap-1.5"
            >
              <label
                htmlFor="local-gemini-key-input"
                className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]"
              >
                CHAVE GEMINI API (OPCIONAL · CLIENTE)
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="local-gemini-key-input"
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="AIza..."
                  className="cyber-input mobile-touch-input flex-1 min-w-0 px-2 py-1 text-[16px] lg:text-[11px]"
                />
                <button
                  type="submit"
                  className="cyber-btn-outline mobile-touch-input px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                >
                  OK
                </button>
              </div>
              {serverGeminiConfigured && (
                <p className="font-mono-tech text-[9px] text-[var(--accent-wine)] font-semibold">
                  Servidor já possui GEMINI_API_KEY ativa.
                </p>
              )}
            </form>
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
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void runGoogleSearch(localMeta.query)}
                  className="cyber-btn-outline self-start px-2 py-1 text-[10px] font-bold uppercase cursor-pointer disabled:opacity-60"
                >
                  CONSULTAR GOOGLE SEARCH ↗
                </button>
              </div>
            ) : (
              <>
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

                {/* Síntese RAG Híbrida opcional (envia apenas top 3-5 trechos) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {hasGeminiKey && (
                    <button
                      type="button"
                      disabled={synthesizing}
                      data-testid="synthesize-local-rag-btn"
                      onClick={() => void handleSynthesizeLocal()}
                      className="cyber-roll-btn mobile-touch-input flex-1 px-2.5 py-1.5 text-[10px] font-bold uppercase inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      <span>
                        {synthesizing
                          ? 'SINTETIZANDO...'
                          : `SINTETIZAR C/ GEMINI (TOP ${Math.min(5, localHits.length)})`}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void runGoogleSearch(localMeta.query)}
                    className="cyber-btn-outline mobile-touch-input px-2 py-1.5 text-[10px] font-bold uppercase cursor-pointer disabled:opacity-60"
                  >
                    GOOGLE ↗
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {synthesisError && (
          <div
            role="alert"
            className="p-2.5 border-[1.5px] border-[var(--accent-danger)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] font-mono-tech text-[10px] text-[var(--accent-danger)] break-words"
          >
            {synthesisError}
          </div>
        )}

        {synthesizedAnswer && (
          <article
            data-testid="rag-synthesis-card"
            className="p-3 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] shadow-[2px_2px_0_#5B0F18] flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border-subtle)]">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                // SÍNTESE · {synthesizedAnswer.excerptsUsed} TRECHOS
              </span>
              <span className="font-mono-tech text-[9px] font-bold text-[var(--ink-muted)] shrink-0">
                {synthesizedAnswer.sourceLabel}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-[var(--ink-primary)] leading-relaxed">
              {synthesisBlocks.map((block, idx) => (
                <p key={idx} className="whitespace-pre-line">
                  {block}
                </p>
              ))}
            </div>
          </article>
        )}

        {loading && (
          <div
            role="status"
            aria-label="Buscando regras no Google Search"
            className="p-3 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] flex flex-col gap-2"
          >
            <div className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)]">
              CONSULTANDO GOOGLE SEARCH...
            </div>
            <div className="h-3 w-full bg-[var(--border-subtle)] rounded-[2px]" />
            <div className="h-3 w-4/5 bg-[var(--border-subtle)] rounded-[2px]" />
            <div className="h-3 w-3/5 bg-[var(--border-subtle)] rounded-[2px]" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="p-3 border-[1.5px] border-[var(--accent-danger)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] flex flex-col gap-2 min-w-0 overflow-hidden"
          >
            <div className="font-mono-tech text-[11px] font-bold text-[var(--accent-danger)] uppercase">
              FALHA NA CONSULTA
            </div>
            <p className="text-xs text-[var(--ink-primary)] leading-relaxed break-words">{error}</p>
            {query.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => void runGoogleSearch(query.trim())}
                className="cyber-btn-outline self-start px-2.5 py-1 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>TENTAR NOVAMENTE</span>
              </button>
            )}
          </div>
        )}

        {!loading && !error && !activeResult && !localMeta && (
          <div className="p-4 border-[1.5px] border-dashed border-[var(--border-ink)]/40 rounded-[var(--radius-control)] flex flex-col items-center text-center gap-2">
            <Search className="w-5 h-5 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              CONSULTA RÁPIDA DE REGRAS
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              {booksForActiveSystem.length > 0
                ? `${booksForActiveSystem.length} PDF(s) indexados localmente para busca instantânea offline ou via Google Search.`
                : 'Pesquise regras via Google Search ou indexe PDFs locais do sistema para consulta instantânea offline.'}
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

        {!loading && activeResult && (
          <article className="p-3 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card)] shadow-[2px_2px_0_#5B0F18] flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border-subtle)]">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)] truncate">
                // {activeResult.query}
              </span>
              <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] shrink-0">
                GOOGLE SEARCH
              </span>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-[var(--ink-primary)] leading-relaxed">
              {answerBlocks.map((block, idx) => (
                <p key={idx} className="whitespace-pre-line">
                  {block}
                </p>
              ))}
            </div>

            {activeResult.sources.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-1.5">
                <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase">
                  FONTES ({activeResult.sources.length})
                </span>
                <div className="flex flex-col gap-1">
                  {activeResult.sources.slice(0, 4).map((src) => (
                    <a
                      key={src.uri}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[var(--bg-card-alt)] border border-[var(--border-ink)] rounded-[4px] hover:bg-[var(--bg-hover)] transition-colors text-[11px] font-mono-tech font-semibold text-[var(--ink-primary)]"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 text-[var(--accent-wine)]" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}

        {history.length > 1 && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase">
              HISTÓRICO DE BUSCA
            </span>
            <div className="flex flex-col gap-1">
              {history.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => {
                    setQuery(item.query);
                    setActiveResult(item);
                    setError(null);
                  }}
                  className={`text-left px-2.5 py-1.5 rounded-[4px] border font-mono-tech text-[11px] font-semibold truncate cursor-pointer transition-colors ${
                    activeResult?.query === item.query
                      ? 'bg-[var(--accent-cream-badge)] border-[var(--accent-wine)] text-[var(--accent-wine)]'
                      : 'bg-[var(--bg-card-alt)] border-[var(--border-subtle)] text-[var(--ink-secondary)] hover:border-[var(--border-ink)]'
                  }`}
                >
                  {item.query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
