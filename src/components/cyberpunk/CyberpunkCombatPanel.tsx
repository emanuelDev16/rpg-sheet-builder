import React, { useId, useState } from 'react';
import { Dices, Shield, Trash2, Wrench } from 'lucide-react';
import { getCyberpunkWoundState, type CyberpunkArmorLocation, type CyberpunkState } from '../../core/cyberpunkRules';
import type { AppTranslations } from '../../core/i18n';
import type { CyberpunkExplodingRollRecord, UseCyberpunkHandlersResult } from '../../hooks/useCyberpunkHandlers';

export interface CyberpunkCombatPanelProps
  extends Pick<UseCyberpunkHandlersResult, 'handleApplyArmorDamage' | 'handleRepairArmorSp' | 'handleAddCriticalInjury' | 'handleToggleCriticalInjury' | 'handleRemoveCriticalInjury' | 'handleExplodingD10Roll'> {
  cyberpunkState: CyberpunkState;
  currentHp: number;
  maxHp: number;
  t: Pick<AppTranslations, 't'>;
}

const isImeComposing = (e: React.KeyboardEvent): boolean => e.nativeEvent.isComposing || e.keyCode === 229;
const parseIntOrZero = (v: string): number => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : 0);

export const CyberpunkCombatPanel: React.FC<CyberpunkCombatPanelProps> = ({
  cyberpunkState, currentHp, maxHp, t,
  handleApplyArmorDamage, handleRepairArmorSp, handleAddCriticalInjury,
  handleToggleCriticalInjury, handleRemoveCriticalInjury, handleExplodingD10Roll,
}) => {
  const uid = useId();
  const [location, setLocation] = useState<CyberpunkArmorLocation>('body');
  const [damageInput, setDamageInput] = useState('5');
  const [headshot, setHeadshot] = useState(false);
  const [injuryName, setInjuryName] = useState('');
  const [injuryEffect, setInjuryEffect] = useState('');
  const [statInput, setStatInput] = useState('0');
  const [skillInput, setSkillInput] = useState('0');
  const [modInput, setModInput] = useState('0');
  const [dvInput, setDvInput] = useState('');
  const [lastRoll, setLastRoll] = useState<CyberpunkExplodingRollRecord | null>(null);

  const selectedPiece = cyberpunkState.armor[location];
  const isArmorFull = selectedPiece.sp >= selectedPiece.maxSp;
  const wound = getCyberpunkWoundState(currentHp, maxHp);
  const canAddInjury = injuryName.trim().length > 0;
  const woundBadgeClass = wound.isMortallyWounded
    ? 'bg-[var(--accent-danger)] text-[var(--accent-danger-contrast)] border-[var(--accent-danger)]'
    : wound.isSeriouslyWounded
      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
      : 'bg-[var(--bg-strip)] text-[var(--ink-secondary)] border-[var(--border-subtle)]';
  const woundLabel = t.t(wound.isMortallyWounded ? 'cyberpunk.combat.woundMortal' : wound.isSeriouslyWounded ? 'cyberpunk.combat.woundSerious' : 'cyberpunk.combat.woundHealthy');

  const submitDamage = () => handleApplyArmorDamage(location, Math.max(0, parseIntOrZero(damageInput)), { headshotMultiplier: location === 'head' && headshot });
  const submitInjury = () => {
    if (!canAddInjury) return;
    handleAddCriticalInjury({ name: injuryName.trim(), effect: injuryEffect.trim() });
    setInjuryName('');
    setInjuryEffect('');
  };
  const submitRoll = () => {
    const parsedDv = dvInput.trim() ? Number.parseInt(dvInput.trim(), 10) : NaN;
    const record = handleExplodingD10Roll(t.t('cyberpunk.combat.explodingD10Heading'), {
      stat: parseIntOrZero(statInput),
      skill: parseIntOrZero(skillInput),
      modifier: parseIntOrZero(modInput),
      woundPenalty: wound.woundPenalty,
      ...(Number.isFinite(parsedDv) ? { dv: parsedDv } : {}),
    });
    if (record) setLastRoll(record);
  };
  const onEnterSubmit = (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e) || e.key !== 'Enter') return;
    e.preventDefault();
    fn();
  };

  return (
    <div className="flex flex-col gap-3" data-testid="cyberpunk-combat-panel">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--ink-primary)] inline-flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" aria-hidden="true" />
          {t.t('cyberpunk.combat.heading')}
        </span>
        <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t.t('cyberpunk.combat.armorHeading')}</span>
      </div>

      <div className="p-2.5 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-1.5">
          {(['head', 'body'] as const).map((loc) => {
            const piece = cyberpunkState.armor[loc];
            const active = location === loc;
            return (
              <button key={loc} type="button" aria-pressed={active} data-testid={`cp-armor-loc-${loc}`} onClick={() => { setLocation(loc); if (loc === 'body') setHeadshot(false); }}
                className={`min-h-[36px] p-2 border rounded-[var(--radius-card)] flex items-center justify-between gap-2 cursor-pointer ${active ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]' : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-subtle)]'}`}>
                <span className="font-mono-tech text-[10px] font-extrabold uppercase">{t.t(loc === 'head' ? 'cyberpunk.combat.armorHead' : 'cyberpunk.combat.armorBody')}</span>
                <span data-testid={`cp-armor-sp-${loc}`} className="font-mono-tech text-sm font-black tabular-nums">{piece.sp} / {piece.maxSp}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={`${uid}-dmg`} className="sr-only">{t.t('cyberpunk.combat.damageInputLabel')}</label>
          <input id={`${uid}-dmg`} type="number" min={0} data-testid="cp-damage-input" value={damageInput} onChange={(e) => setDamageInput(e.target.value)} onKeyDown={onEnterSubmit(submitDamage)} className="cyber-input mobile-touch-input w-20 min-h-[36px] px-2 text-center font-mono-tech font-bold tabular-nums" />
          <button type="button" aria-pressed={headshot} data-testid="cp-headshot-toggle" onClick={() => { const next = !headshot; setHeadshot(next); if (next) setLocation('head'); }}
            className={`min-h-[36px] px-2 text-[10px] font-mono-tech font-extrabold uppercase border rounded-[var(--radius-pill)] cursor-pointer ${headshot ? 'bg-[var(--accent-danger)] text-[var(--accent-danger-contrast)] border-[var(--accent-danger)]' : 'bg-[var(--bg-card)] text-[var(--ink-secondary)] border-[var(--border-color)]'}`}>
            {t.t('cyberpunk.combat.headshotToggle')}
          </button>
          <button type="button" data-testid="cp-apply-damage-btn" onClick={submitDamage} className="cyber-btn-outline min-h-[36px] flex-1 px-2 text-[10px] font-extrabold uppercase text-[var(--accent-danger)] border-[var(--accent-danger)] cursor-pointer">{t.t('cyberpunk.combat.applyDamageBtn')}</button>
          <button type="button" data-testid="cp-repair-sp-btn" aria-disabled={isArmorFull || undefined} onClick={() => { if (!isArmorFull) handleRepairArmorSp(location); }}
            className="cyber-btn-outline min-h-[36px] px-2.5 text-[10px] font-extrabold uppercase inline-flex items-center gap-1 cursor-pointer aria-[disabled=true]:opacity-45">
            <Wrench className="w-3 h-3" aria-hidden="true" />
            <span>{t.t('cyberpunk.combat.repairSpBtn')}</span>
          </button>
        </div>
      </div>

      <div className="p-2.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-secondary)]">{t.t('cyberpunk.combat.critInjuriesHeading')}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-testid="cp-wound-badge" className={`px-2 py-0.5 text-[10px] font-mono-tech font-extrabold uppercase border rounded-[var(--radius-pill)] ${woundBadgeClass}`}>{woundLabel}</span>
            {wound.woundPenalty > 0 && (
              <span data-testid="cp-wound-penalty" className="px-2 py-0.5 text-[10px] font-mono-tech font-extrabold uppercase border border-[var(--border-color)] rounded-[var(--radius-pill)] bg-[var(--bg-card)] text-[var(--ink-primary)]">
                {t.t('cyberpunk.combat.woundPenaltyBadge', { penalty: wound.woundPenalty })}
              </span>
            )}
          </div>
        </div>
        {cyberpunkState.criticalInjuries.length === 0 ? (
          <p className="font-mono-tech text-[11px] text-[var(--ink-muted)]">{t.t('cyberpunk.combat.critInjuriesEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {cyberpunkState.criticalInjuries.map((inj) => (
              <li key={inj.id} className="p-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card)] flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono-tech text-xs font-bold text-[var(--ink-primary)] truncate">{inj.name}</div>
                  {inj.effect && <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] truncate">{inj.effect}</div>}
                </div>
                <button type="button" aria-pressed={inj.treated} data-testid={`cp-injury-toggle-${inj.id}`} onClick={() => handleToggleCriticalInjury(inj.id)}
                  className={`min-h-[36px] px-2 text-[10px] font-mono-tech font-extrabold uppercase border rounded-[var(--radius-pill)] cursor-pointer ${inj.treated ? 'bg-[var(--bg-strip)] text-[var(--ink-secondary)] border-[var(--border-subtle)]' : 'bg-[var(--accent-danger)] text-[var(--accent-danger-contrast)] border-[var(--accent-danger)]'}`}>
                  {t.t(inj.treated ? 'cyberpunk.combat.critInjuryTreated' : 'cyberpunk.combat.critInjuryActive')}
                </button>
                <button type="button" data-testid={`cp-injury-remove-${inj.id}`} aria-label={t.t('cards.removeRowAria', { row: inj.name })} onClick={() => handleRemoveCriticalInjury(inj.id)} className="cyber-btn-outline min-h-[36px] min-w-[36px] inline-flex items-center justify-center cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={`${uid}-inj-name`} className="sr-only">{t.t('cyberpunk.combat.critInjuryNamePlaceholder')}</label>
          <input id={`${uid}-inj-name`} type="text" value={injuryName} onChange={(e) => setInjuryName(e.target.value)} onKeyDown={onEnterSubmit(submitInjury)} placeholder={t.t('cyberpunk.combat.critInjuryNamePlaceholder')} data-testid="cp-injury-name-input" className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-[130px] px-2 font-mono-tech text-xs" />
          <label htmlFor={`${uid}-inj-eff`} className="sr-only">{t.t('cyberpunk.combat.critInjuryEffectPlaceholder')}</label>
          <input id={`${uid}-inj-eff`} type="text" value={injuryEffect} onChange={(e) => setInjuryEffect(e.target.value)} onKeyDown={onEnterSubmit(submitInjury)} placeholder={t.t('cyberpunk.combat.critInjuryEffectPlaceholder')} data-testid="cp-injury-effect-input" className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-[130px] px-2 font-mono-tech text-xs" />
          <button type="button" data-testid="cp-add-injury-btn" aria-disabled={!canAddInjury || undefined} onClick={submitInjury} className="cyber-btn-outline min-h-[36px] px-2.5 text-[10px] font-extrabold uppercase cursor-pointer aria-[disabled=true]:opacity-45">{t.t('cyberpunk.combat.addCritInjuryBtn')}</button>
        </div>
      </div>

      <div className="p-2.5 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-secondary)]">{t.t('cyberpunk.combat.explodingD10Heading')}</span>
          {lastRoll && (
            <span data-testid="cp-last-roll" className="font-mono-tech text-xs font-black text-[var(--ink-primary)] tabular-nums">
              {lastRoll.total}
              {lastRoll.explosionKind === 'crit' && ` · ${t.t('cyberpunk.combat.critBadge')}`}
              {lastRoll.explosionKind === 'fumble' && ` · ${t.t('cyberpunk.combat.fumbleBadge')}`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            [`${uid}-stat`, 'xp.cat.attribute', statInput, setStatInput, 'cp-roll-stat'],
            [`${uid}-skill`, 'xp.cat.skill', skillInput, setSkillInput, 'cp-roll-skill'],
            [`${uid}-mod`, 'cards.pool.mod', modInput, setModInput, 'cp-roll-mod'],
            [`${uid}-dv`, 'cyberpunk.combat.dvLabel', dvInput, setDvInput, 'cp-roll-dv'],
          ] as const).map(([id, key, val, setter, testId]) => (
            <div key={id} className="flex flex-col gap-0.5">
              <label htmlFor={id} className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] truncate">{t.t(key)}</label>
              <input id={id} type="number" data-testid={testId} value={val} onChange={(e) => setter(e.target.value)} onKeyDown={onEnterSubmit(submitRoll)} className="cyber-input mobile-touch-input min-h-[36px] w-full px-1.5 text-center font-mono-tech font-bold tabular-nums" />
            </div>
          ))}
        </div>
        <button type="button" data-testid="cp-roll-d10-btn" onClick={submitRoll} className="cyber-roll-btn min-h-[36px] w-full px-3 py-1.5 text-xs font-extrabold uppercase inline-flex items-center justify-center gap-1.5 cursor-pointer">
          <Dices className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.t('cyberpunk.combat.rollExplodingBtn')}</span>
        </button>
      </div>
    </div>
  );
};
