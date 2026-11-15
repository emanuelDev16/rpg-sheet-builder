import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { SheetCard, TabId } from '../core/sheetModel';
import { AppTranslations, getTranslations } from '../core/i18n';

interface CustomCardBuilderProps {
  activeTab: Exclude<TabId, 'xp'>;
  isEmptySheet: boolean;
  t?: AppTranslations['customBuilder'];
  onCreateCard: (card: SheetCard) => void;
}

const DEFAULT_BUILDER_T = getTranslations('pt-BR').customBuilder;

export const CustomCardBuilder: React.FC<CustomCardBuilderProps> = ({
  activeTab,
  isEmptySheet,
  t = DEFAULT_BUILDER_T,
  onCreateCard,
}) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [colSpan, setColSpan] = useState<1 | 2>(1);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim().toUpperCase() || t.defaultBlockTitle;
    const derivedCode =
      code.trim().toUpperCase() ||
      `//${cleanTitle.replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 16) || t.defaultBlockCode}`;

    const normalizedCode = derivedCode.startsWith('//') ? derivedCode : `//${derivedCode}`;
    const uid = `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    onCreateCard({
      id: uid,
      tab: activeTab,
      code: normalizedCode,
      title: cleanTitle,
      colSpan,
      fields: [],
    });

    setTitle('');
    setCode('');
  };

  return (
    <section
      aria-label={t.ariaSection}
      className="no-print print:hidden bento-card lg:col-span-2 border-dashed"
    >
      <header className="bento-card-header">
        <div className="bento-card-header-title flex items-center gap-2.5 min-w-0 flex-1">
          <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
            {t.techHeaderTag}
          </span>
          <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words min-w-0">
            {isEmptySheet ? t.createFromZero : t.addNewBlock}
          </h2>
        </div>
        <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase shrink-0">
          {activeTab === 'geral' ? '01' : '02'}
        </span>
      </header>

      <form onSubmit={handleCreate} className="bento-card-body p-4 flex flex-col gap-3">
        {isEmptySheet && (
          <p className="font-mono-tech text-xs text-[var(--ink-secondary)] leading-relaxed">
            {t.emptyHint}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <div className="md:col-span-5 flex flex-col gap-1">
            <label
              htmlFor="new-card-title"
              className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase"
            >
              {t.blockTitle}
            </label>
            <input
              id="new-card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.blockTitlePlaceholder}
              className="cyber-input mobile-touch-input px-2.5 py-1.5 text-xs font-bold uppercase w-full"
            />
          </div>

          <div className="md:col-span-3 flex flex-col gap-1">
            <label
              htmlFor="new-card-code"
              className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase"
            >
              {t.techTag}
            </label>
            <input
              id="new-card-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t.techTagPlaceholder}
              className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs font-mono-tech w-full"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase">
              {t.width}
            </span>
            <div className="flex border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden">
              <button
                type="button"
                onClick={() => setColSpan(1)}
                className={`mobile-touch-input min-h-[36px] flex-1 font-mono-tech text-[10px] font-bold py-1.5 cursor-pointer ${
                  colSpan === 1
                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                }`}
              >
                1 COL
              </button>
              <button
                type="button"
                onClick={() => setColSpan(2)}
                className={`mobile-touch-input min-h-[36px] flex-1 font-mono-tech text-[10px] font-bold py-1.5 border-l-[length:var(--border-width)] border-[var(--border-color)] cursor-pointer ${
                  colSpan === 2
                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                }`}
              >
                2 COL
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="cyber-roll-btn mobile-touch-input min-h-[36px] w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.createBtn}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
