import React, { useMemo, useState } from 'react';
import { ExternalLink, RotateCcw, Search } from 'lucide-react';
import { RulesSearchResponse, validateRulesQuery } from '../core/rulesSearch';
import { AppTranslations, getTranslations } from '../core/i18n';

interface RulesSearchPanelProps {
  systemName: string;
  t?: AppTranslations['sidebar'];
}

function formatAnswerBlocks(rawText: string): string[] {
  return rawText
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .split(/\n{2,}|\n(?=[-•*] )/)
    .map((block) => block.trim())
    .filter(Boolean);
}

const DEFAULT_SIDEBAR_T = getTranslations('pt-BR').sidebar;

export const RulesSearchPanel: React.FC<RulesSearchPanelProps> = ({
  systemName,
  t = DEFAULT_SIDEBAR_T,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<RulesSearchResponse | null>(null);
  const [history, setHistory] = useState<RulesSearchResponse[]>([]);

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
    const check = validateRulesQuery(rawQuery);
    if (!check.ok) {
      setError(check.error ?? 'Consulta inválida.');
      return;
    }

    setQuery(check.query);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rules-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: check.query,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(query);
  };

  const answerBlocks = useMemo(
    () => (activeResult?.answer ? formatAnswerBlocks(activeResult.answer) : []),
    [activeResult],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Formulário de pesquisa */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-b-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-card-alt)] flex flex-col gap-2 shrink-0"
      >
        <div className="font-mono-tech text-[10px] font-semibold text-[var(--ink-muted)] truncate">
          {t.rulesContext} {systemName}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            aria-label={t.rulesSearchAria}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.rulesPlaceholder}
            className="cyber-input mobile-touch-input flex-1 min-w-0 px-2 py-1.5 text-xs font-semibold"
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

      {/* Área de resultados */}
      <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-3">
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
                onClick={() => void executeSearch(query)}
                className="cyber-btn-outline self-start px-2.5 py-1 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>TENTAR NOVAMENTE</span>
              </button>
            )}
          </div>
        )}

        {!loading && !error && !activeResult && (
          <div className="p-4 border-[1.5px] border-dashed border-[var(--border-ink)]/40 rounded-[var(--radius-control)] flex flex-col items-center text-center gap-2">
            <Search className="w-5 h-5 text-[var(--accent-wine)]" aria-hidden="true" />
            <p className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] uppercase">
              CONSULTA RÁPIDA DE REGRAS
            </p>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Pesquise regras, dificuldades ou mecânicas diretamente via Google Search sem sair da ficha.
            </p>
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
