import React, { useId, useState } from 'react';
import { AlertTriangle, Cpu, Pencil, Trash2 } from 'lucide-react';
import { recomputeCyberpunkHumanity, type CyberpunkCyberwareEntry, type CyberpunkState } from '../../core/cyberpunkRules';
import type { AppTranslations } from '../../core/i18n';
import type { UseCyberpunkHandlersResult } from '../../hooks/useCyberpunkHandlers';

export interface CyberpunkCyberwarePanelProps
  extends Pick<UseCyberpunkHandlersResult, 'handleAddCyberware' | 'handleUpdateCyberware' | 'handleRemoveCyberware'> {
  cyberpunkState: CyberpunkState;
  t: Pick<AppTranslations, 't'>;
}

interface CyberwareDraft { name: string; slot: string; humanityLoss: string; notes: string; }

const isImeComposing = (e: React.KeyboardEvent): boolean => e.nativeEvent.isComposing || e.keyCode === 229;
const clampHl = (v: string, fallback = 0): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(30, Math.max(0, n)) : fallback;
};

export const CyberpunkCyberwarePanel: React.FC<CyberpunkCyberwarePanelProps> = ({
  cyberpunkState, t, handleAddCyberware, handleUpdateCyberware, handleRemoveCyberware,
}) => {
  const uid = useId();
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('');
  const [hl, setHl] = useState('7');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CyberwareDraft>({ name: '', slot: '', humanityLoss: '0', notes: '' });

  const summary = recomputeCyberpunkHumanity(cyberpunkState.humanity, cyberpunkState.cyberware);
  const humanityPct = summary.humanity.max > 0 ? Math.min(100, Math.max(0, Math.round((summary.humanity.current / summary.humanity.max) * 100))) : 0;
  const canAdd = name.trim().length > 0 && cyberpunkState.cyberware.length < 40;
  const canSaveEdit = draft.name.trim().length > 0;

  const submitAdd = () => {
    if (!canAdd) return;
    handleAddCyberware({ name: name.trim(), slot: slot.trim() || 'neural', humanityLoss: clampHl(hl), ...(notes.trim() ? { notes: notes.trim() } : {}) });
    setName('');
    setSlot('');
    setHl('7');
    setNotes('');
  };
  const startEdit = (item: CyberpunkCyberwareEntry) => {
    setEditingId(item.id);
    setDraft({ name: item.name, slot: item.slot, humanityLoss: String(item.humanityLoss), notes: item.notes ?? '' });
  };
  const saveEdit = (id: string) => {
    if (!canSaveEdit) return;
    handleUpdateCyberware(id, { name: draft.name.trim(), slot: draft.slot.trim() || 'neural', humanityLoss: clampHl(draft.humanityLoss), notes: draft.notes.trim() || undefined });
    setEditingId(null);
  };
  const onEnterSubmit = (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e) || e.key !== 'Enter') return;
    e.preventDefault();
    fn();
  };

  return (
    <div className="cp-panel flex flex-col gap-3" data-testid="cyberpunk-cyberware-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--ink-primary)] inline-flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
          {t.t('cyberpunk.cyberware.heading')}
        </span>
        <span data-testid="cp-humanity-total-loss" className="cp-badge px-2 py-0.5 text-[10px] font-mono-tech font-extrabold uppercase tabular-nums">
          {t.t('cyberpunk.cyberware.totalLossSummary', { loss: summary.totalHumanityLoss })}
        </span>
      </div>

      <div className="cp-card p-2.5 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="cp-stat-tile p-2 flex flex-col gap-0.5">
            <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.cyberware.humanityLabel')}</span>
            <span data-testid="cp-humanity-value" className="font-mono-tech text-sm font-black text-[var(--ink-primary)] tabular-nums">{summary.humanity.current} / {summary.humanity.max}</span>
          </div>
          <div className={`cp-stat-tile p-2 flex flex-col gap-0.5 ${summary.cyberpsychosisRisk ? 'cp-stat-tile--danger' : ''}`}>
            <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.cyberware.effectiveEmpLabel')}</span>
            <span data-testid="cp-effective-emp-value" className="font-mono-tech text-sm font-black tabular-nums">{summary.effectiveEmp}</span>
          </div>
          <div className="cp-stat-tile p-2 flex flex-col gap-0.5">
            <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.cyberware.baseEmpLabel')}</span>
            <span data-testid="cp-base-emp-value" className="font-mono-tech text-sm font-black text-[var(--ink-primary)] tabular-nums">{summary.humanity.baseEmp}</span>
          </div>
        </div>
        <div className="cp-humanity-bar h-2 w-full overflow-hidden" role="progressbar" aria-label={t.t('cyberpunk.cyberware.humanityLabel')} aria-valuenow={summary.humanity.current} aria-valuemin={0} aria-valuemax={summary.humanity.max}>
          <div className={`cp-humanity-bar-fill h-full ${summary.cyberpsychosisRisk ? 'is-danger' : ''}`} style={{ width: `${humanityPct}%` }} />
        </div>
        {summary.cyberpsychosisRisk && (
          <div role="alert" data-testid="cp-cyberpsychosis-badge" className="cp-risk-alert p-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-mono-tech text-[10px] font-extrabold uppercase">{t.t('cyberpunk.cyberware.cyberpsychosisRisk')}</div>
              <div className="font-mono-tech text-[10px]">{t.t('cyberpunk.cyberware.cyberpsychosisWarning')}</div>
            </div>
          </div>
        )}
      </div>

      {cyberpunkState.cyberware.length === 0 ? (
        <p data-testid="cp-cyberware-empty" className="font-mono-tech text-[11px] text-[var(--ink-muted)]">{t.t('cyberpunk.cyberware.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {cyberpunkState.cyberware.map((item) => (
            <li key={item.id} data-testid={`cp-cyberware-row-${item.id}`} className="cp-card p-2 flex flex-col gap-2">
              {editingId === item.id ? (
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                    <div className="sm:col-span-5">
                      <label htmlFor={`${uid}-edit-name`} className="sr-only">{t.t('cyberpunk.cyberware.namePlaceholder')}</label>
                      <input id={`${uid}-edit-name`} type="text" data-testid={`cp-cyberware-edit-name-${item.id}`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={onEnterSubmit(() => saveEdit(item.id))} className="cyber-input mobile-touch-input min-h-[36px] w-full px-2 font-mono-tech text-xs" />
                    </div>
                    <div className="sm:col-span-4">
                      <label htmlFor={`${uid}-edit-slot`} className="sr-only">{t.t('cyberpunk.cyberware.slotLabel')}</label>
                      <input id={`${uid}-edit-slot`} type="text" data-testid={`cp-cyberware-edit-slot-${item.id}`} value={draft.slot} onChange={(e) => setDraft({ ...draft, slot: e.target.value })} onKeyDown={onEnterSubmit(() => saveEdit(item.id))} className="cyber-input mobile-touch-input min-h-[36px] w-full px-2 font-mono-tech text-xs" />
                    </div>
                    <div className="sm:col-span-3">
                      <label htmlFor={`${uid}-edit-hl`} className="sr-only">{t.t('cyberpunk.cyberware.humanityLossLabel')}</label>
                      <input id={`${uid}-edit-hl`} type="number" min={0} max={30} data-testid={`cp-cyberware-edit-hl-${item.id}`} value={draft.humanityLoss} onChange={(e) => setDraft({ ...draft, humanityLoss: e.target.value })} onKeyDown={onEnterSubmit(() => saveEdit(item.id))} className="cyber-input mobile-touch-input min-h-[36px] w-full px-1.5 text-center font-mono-tech text-xs font-bold tabular-nums" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label htmlFor={`${uid}-edit-notes`} className="sr-only">{t.t('customBuilder.starterField.text')}</label>
                    <input id={`${uid}-edit-notes`} type="text" data-testid={`cp-cyberware-edit-notes-${item.id}`} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onKeyDown={onEnterSubmit(() => saveEdit(item.id))} placeholder={t.t('customBuilder.starterField.text')} className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-[120px] px-2 font-mono-tech text-xs" />
                    <button type="button" data-testid={`cp-cyberware-save-${item.id}`} aria-disabled={!canSaveEdit ? 'true' : undefined} onClick={() => saveEdit(item.id)} className="cp-action-btn cyber-btn-outline min-h-[36px] px-2.5 text-[10px] font-extrabold uppercase cursor-pointer">
                      {t.t('modal.saveTemplateBtn')}
                    </button>
                    <button type="button" data-testid={`cp-cyberware-cancel-${item.id}`} onClick={() => setEditingId(null)} className="cp-action-btn cyber-btn-outline min-h-[36px] px-2.5 text-[10px] font-extrabold uppercase cursor-pointer">
                      {t.t('xp.cancelBtn')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)] truncate">{item.name}</span>
                      <span className="cp-badge px-1.5 py-0.5 text-[9px] font-mono-tech font-bold uppercase">{item.slot}</span>
                      <span className="cp-badge cp-badge--accent px-1.5 py-0.5 text-[9px] font-mono-tech font-extrabold tabular-nums">-{item.humanityLoss} {t.t('cyberpunk.cyberware.humanityLossLabel')}</span>
                    </div>
                    {item.notes && <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] truncate mt-0.5">{item.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" data-testid={`cp-cyberware-edit-${item.id}`} aria-label={`${t.t('cards.edit.editField')}: ${item.name}`} onClick={() => startEdit(item)} className="cp-action-btn cyber-btn-outline min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" data-testid={`cp-cyberware-remove-${item.id}`} aria-label={t.t('cyberpunk.cyberware.removeAria', { name: item.name })} onClick={() => handleRemoveCyberware(item.id)} className="cp-action-btn cyber-btn-outline min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="cp-card p-2.5 flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end">
          <div className="sm:col-span-5 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-cw-name`} className="sr-only">{t.t('cyberpunk.cyberware.namePlaceholder')}</label>
            <input id={`${uid}-cw-name`} type="text" data-testid="cp-cyberware-name-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnterSubmit(submitAdd)} placeholder={t.t('cyberpunk.cyberware.namePlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] w-full px-2 font-mono-tech text-xs" />
          </div>
          <div className="sm:col-span-4 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-cw-slot`} className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.cyberware.slotLabel')}</label>
            <input id={`${uid}-cw-slot`} type="text" data-testid="cp-cyberware-slot-input" value={slot} onChange={(e) => setSlot(e.target.value)} onKeyDown={onEnterSubmit(submitAdd)} placeholder={t.t('cyberpunk.cyberware.slotPlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] w-full px-2 font-mono-tech text-xs" />
          </div>
          <div className="sm:col-span-3 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-cw-hl`} className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.cyberware.humanityLossLabel')}</label>
            <input id={`${uid}-cw-hl`} type="number" min={0} max={30} data-testid="cp-cyberware-hl-input" value={hl} onChange={(e) => setHl(e.target.value)} onKeyDown={onEnterSubmit(submitAdd)} className="cyber-input mobile-touch-input min-h-[36px] w-full px-1.5 text-center font-mono-tech text-xs font-bold tabular-nums" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={`${uid}-cw-notes`} className="sr-only">{t.t('customBuilder.starterField.text')}</label>
          <input id={`${uid}-cw-notes`} type="text" data-testid="cp-cyberware-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={onEnterSubmit(submitAdd)} placeholder={t.t('customBuilder.starterField.text')} className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-[140px] px-2 font-mono-tech text-xs" />
          <button type="button" data-testid="cp-cyberware-add-btn" aria-disabled={!canAdd ? 'true' : undefined} onClick={submitAdd} className="cp-action-btn cyber-btn-outline min-h-[36px] px-3 text-[10px] font-extrabold uppercase cursor-pointer">
            {t.t('cyberpunk.cyberware.addBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
