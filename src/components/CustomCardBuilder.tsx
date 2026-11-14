import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { SheetCard, TabId } from '../core/sheetModel';

interface CustomCardBuilderProps {
  activeTab: Exclude<TabId, 'xp'>;
  isEmptySheet: boolean;
  onCreateCard: (card: SheetCard) => void;
}

export const CustomCardBuilder: React.FC<CustomCardBuilderProps> = ({
  activeTab,
  isEmptySheet,
  onCreateCard,
}) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [colSpan, setColSpan] = useState<1 | 2>(1);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim().toUpperCase() || 'NOVO BLOCO';
    const derivedCode =
      code.trim().toUpperCase() ||
      `//${cleanTitle.replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 16) || 'BLOCO'}`;

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
      aria-label="Criador de blocos da ficha"
      className="bento-card lg:col-span-2 border-dashed"
    >
      <header className="bento-card-header">
        <div className="flex items-center gap-2.5">
          <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider">
            //CONSTRUTOR_CUSTOM
          </span>
          <h2 className="font-display text-xl font-extrabold tracking-wide uppercase text-[var(--ink-primary)]">
            {isEmptySheet ? 'CRIAR FICHA DO ZERO' : 'ADICIONAR NOVO BLOCO'}
          </h2>
        </div>
        <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[4px] uppercase">
          {activeTab === 'geral' ? 'ABA 01' : 'ABA 02'}
        </span>
      </header>

      <form onSubmit={handleCreate} className="p-4 flex flex-col gap-3">
        {isEmptySheet && (
          <p className="font-mono-tech text-xs text-[var(--ink-secondary)] leading-relaxed">
            Nenhum campo pré-definido foi carregado. Crie seu primeiro bloco (ex: Atributos,
            Recursos, Perícias, Equipamentos) e depois adicione cada campo individualmente dentro dele.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <div className="md:col-span-5 flex flex-col gap-1">
            <label
              htmlFor="new-card-title"
              className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase"
            >
              TÍTULO DO BLOCO
            </label>
            <input
              id="new-card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: ATRIBUTOS, STATUS VITAL, MOCHILA..."
              className="cyber-input px-2.5 py-1.5 text-xs font-bold uppercase"
            />
          </div>

          <div className="md:col-span-3 flex flex-col gap-1">
            <label
              htmlFor="new-card-code"
              className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase"
            >
              TAG TÉCNICA
            </label>
            <input
              id="new-card-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: //ATRIBUTOS"
              className="cyber-input px-2.5 py-1.5 text-xs font-mono-tech"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase">
              LARGURA
            </span>
            <div className="flex border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] overflow-hidden">
              <button
                type="button"
                onClick={() => setColSpan(1)}
                className={`flex-1 font-mono-tech text-[10px] font-bold py-1.5 cursor-pointer ${
                  colSpan === 1
                    ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                    : 'bg-[var(--bg-card)] text-[var(--ink-primary)]'
                }`}
              >
                1 COL
              </button>
              <button
                type="button"
                onClick={() => setColSpan(2)}
                className={`flex-1 font-mono-tech text-[10px] font-bold py-1.5 border-l border-[var(--border-ink)] cursor-pointer ${
                  colSpan === 2
                    ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                    : 'bg-[var(--bg-card)] text-[var(--ink-primary)]'
                }`}
              >
                2 COL
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="cyber-roll-btn w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>CRIAR BLOCO</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
