import React from 'react';
import { Search, X } from 'lucide-react';
import { AppTranslations } from '../core/i18n';

interface SheetSearchBarProps {
  query: string;
  onChangeQuery: (next: string) => void;
  matchedFieldCount: number;
  matchedCardCount: number;
  t: AppTranslations['searchBar'];
}

export const SheetSearchBar: React.FC<SheetSearchBarProps> = ({
  query,
  onChangeQuery,
  matchedFieldCount,
  matchedCardCount,
  t,
}) => {
  const hasQuery = query.trim().length > 0;

  return (
    <div
      role="search"
      aria-label={t.ariaInput}
      className="no-print print:hidden mb-4 flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] shadow-[var(--shadow-btn)]"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Search className="w-4 h-4 text-[var(--accent-wine)] shrink-0" aria-hidden="true" />
        <input
          type="search"
          data-testid="sheet-search-input"
          aria-label={t.ariaInput}
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && hasQuery) {
              e.preventDefault();
              onChangeQuery('');
            }
          }}
          placeholder={t.placeholder}
          className="mobile-touch-input w-full bg-transparent font-mono-tech text-xs font-semibold text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
      </div>

      {hasQuery && (
        <div className="flex items-center gap-2 shrink-0">
          <span
            data-testid="sheet-search-count"
            className="font-mono-tech text-[10px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] tabular-nums uppercase"
          >
            {t.matchCount(matchedFieldCount, matchedCardCount)}
          </span>
          <button
            type="button"
            data-testid="sheet-search-clear"
            onClick={() => onChangeQuery('')}
            aria-label={t.clearAria}
            className="cyber-btn-outline px-2 py-0.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            <span>{t.clearText}</span>
          </button>
        </div>
      )}
    </div>
  );
};
