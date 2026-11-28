import React, { useId, useState } from 'react';
import { Crosshair, RotateCcw, Trash2 } from 'lucide-react';
import type { CyberpunkState } from '../../core/cyberpunkRules';
import type { AppTranslations } from '../../core/i18n';
import type { UseCyberpunkHandlersResult } from '../../hooks/useCyberpunkHandlers';

export interface CyberpunkWeaponsPanelProps
  extends Pick<UseCyberpunkHandlersResult, 'handleFireWeapon' | 'handleReloadWeapon' | 'handleAddWeapon' | 'handleRemoveWeapon'> {
  cyberpunkState: CyberpunkState;
  t: Pick<AppTranslations, 't'>;
}

const isImeComposing = (e: React.KeyboardEvent): boolean => e.nativeEvent.isComposing || e.keyCode === 229;
const parseIntOr = (v: string, fallback: number): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const CyberpunkWeaponsPanel: React.FC<CyberpunkWeaponsPanelProps> = ({
  cyberpunkState, t, handleFireWeapon, handleReloadWeapon, handleAddWeapon, handleRemoveWeapon,
}) => {
  const uid = useId();
  const [name, setName] = useState('');
  const [damageFormula, setDamageFormula] = useState('2d6');
  const [rof, setRof] = useState('1');
  const [ammoMax, setAmmoMax] = useState('8');

  const canAdd = name.trim().length > 0 && cyberpunkState.weapons.length < 20;
  const submitAdd = () => {
    if (!canAdd) return;
    const clampedRof = Math.min(4, Math.max(1, parseIntOr(rof, 1)));
    const clampedAmmo = Math.min(999, Math.max(0, parseIntOr(ammoMax, 8)));
    handleAddWeapon({
      name: name.trim(),
      skillKey: 'handgun',
      damageFormula: damageFormula.trim() || '2d6',
      rof: clampedRof,
      ammoCurrent: clampedAmmo,
      ammoMax: clampedAmmo,
    });
    setName('');
    setDamageFormula('2d6');
    setRof('1');
    setAmmoMax('8');
  };
  const onEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e) || e.key !== 'Enter') return;
    e.preventDefault();
    submitAdd();
  };

  return (
    <div className="cp-panel flex flex-col gap-3" data-testid="cyberpunk-weapons-panel">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--ink-primary)] inline-flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
          {t.t('cyberpunk.weapons.heading')}
        </span>
      </div>

      {cyberpunkState.weapons.length === 0 ? (
        <p data-testid="cp-weapons-empty" className="font-mono-tech text-[11px] text-[var(--ink-muted)]">{t.t('cyberpunk.weapons.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cyberpunkState.weapons.map((w) => {
            const outOfAmmo = w.ammoCurrent <= 0;
            const isFull = w.ammoCurrent >= w.ammoMax;
            const fireLabel = `${t.t('cyberpunk.weapons.fireBtn')} (-1)`;
            return (
              <li key={w.id} data-testid={`cp-weapon-row-${w.id}`} className="cp-card p-2.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono-tech text-xs font-extrabold text-[var(--ink-primary)] truncate">{w.name}</div>
                    {w.notes && <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] truncate">{w.notes}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span data-testid={`cp-weapon-damage-${w.id}`} className="cp-badge px-2 py-0.5 text-[10px] font-mono-tech font-extrabold uppercase">
                      {t.t('cyberpunk.weapons.damageLabel')}: {w.damageFormula}
                    </span>
                    <span data-testid={`cp-weapon-rof-${w.id}`} className="cp-badge cp-badge--accent px-2 py-0.5 text-[10px] font-mono-tech font-extrabold uppercase tabular-nums">
                      {t.t('cyberpunk.weapons.rofLabel')} {w.rof}
                    </span>
                    <span
                      data-testid={`cp-weapon-ammo-${w.id}`}
                      aria-label={t.t('cyberpunk.weapons.ammoCounter', { current: w.ammoCurrent, max: w.ammoMax })}
                      className={`cp-badge px-2 py-0.5 text-[10px] font-mono-tech font-extrabold tabular-nums ${outOfAmmo ? 'cp-badge--danger' : ''}`}
                    >
                      {w.ammoCurrent} / {w.ammoMax}
                    </span>
                    {outOfAmmo && (
                      <span data-testid={`cp-weapon-empty-badge-${w.id}`} className="cp-badge cp-badge--danger px-2 py-0.5 text-[10px] font-mono-tech font-extrabold uppercase">
                        {t.t('cyberpunk.weapons.outOfAmmo')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-testid={`cp-weapon-fire-${w.id}`}
                    aria-disabled={outOfAmmo ? 'true' : undefined}
                    aria-label={`${fireLabel} — ${t.t('cyberpunk.weapons.fireAria', { weapon: w.name, rof: w.rof })}`}
                    onClick={() => { if (!outOfAmmo) handleFireWeapon(w.id, 1); }}
                    className="cp-action-btn cyber-btn-outline min-h-[36px] flex-1 px-2.5 text-[10px] font-extrabold uppercase cursor-pointer"
                  >
                    {fireLabel}
                  </button>
                  <button
                    type="button"
                    data-testid={`cp-weapon-reload-${w.id}`}
                    aria-disabled={isFull ? 'true' : undefined}
                    aria-label={t.t('cyberpunk.weapons.reloadAria', { weapon: w.name, max: w.ammoMax })}
                    onClick={() => { if (!isFull) handleReloadWeapon(w.id); }}
                    className="cp-action-btn cyber-btn-outline min-h-[36px] px-2.5 text-[10px] font-extrabold uppercase inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>{t.t('cyberpunk.weapons.reloadBtn')}</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`cp-weapon-remove-${w.id}`}
                    aria-label={t.t('cards.removeRowAria', { row: w.name })}
                    onClick={() => handleRemoveWeapon(w.id)}
                    className="cp-action-btn cyber-btn-outline min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="cp-card p-2.5 flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end">
          <div className="sm:col-span-5 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-wpn-name`} className="sr-only">{t.t('cyberpunk.weapons.namePlaceholder')}</label>
            <input id={`${uid}-wpn-name`} type="text" data-testid="cp-weapon-name-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnterSubmit} placeholder={t.t('cyberpunk.weapons.namePlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] w-full px-2 font-mono-tech text-xs" />
          </div>
          <div className="sm:col-span-3 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-wpn-dmg`} className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.weapons.damageLabel')}</label>
            <input id={`${uid}-wpn-dmg`} type="text" data-testid="cp-weapon-damage-input" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} onKeyDown={onEnterSubmit} className="cyber-input mobile-touch-input min-h-[36px] w-full px-2 text-center font-mono-tech text-xs font-bold" />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-wpn-rof`} className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.weapons.rofLabel')}</label>
            <input id={`${uid}-wpn-rof`} type="number" min={1} max={4} data-testid="cp-weapon-rof-input" value={rof} onChange={(e) => setRof(e.target.value)} onKeyDown={onEnterSubmit} className="cyber-input mobile-touch-input min-h-[36px] w-full px-1.5 text-center font-mono-tech text-xs font-bold tabular-nums" />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-0.5">
            <label htmlFor={`${uid}-wpn-ammo`} className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t('cyberpunk.weapons.ammoLabel')}</label>
            <input id={`${uid}-wpn-ammo`} type="number" min={0} max={999} data-testid="cp-weapon-ammo-input" value={ammoMax} onChange={(e) => setAmmoMax(e.target.value)} onKeyDown={onEnterSubmit} className="cyber-input mobile-touch-input min-h-[36px] w-full px-1.5 text-center font-mono-tech text-xs font-bold tabular-nums" />
          </div>
        </div>
        <button type="button" data-testid="cp-weapon-add-btn" aria-disabled={!canAdd ? 'true' : undefined} onClick={submitAdd} className="cp-action-btn cyber-btn-outline min-h-[36px] w-full px-2.5 text-[10px] font-extrabold uppercase cursor-pointer">
          {t.t('cyberpunk.weapons.addBtn')}
        </button>
      </div>
    </div>
  );
};
