import React, { useId } from 'react';
import { Dices } from 'lucide-react';
import {
  cycleSkillProficiency,
  DND5E_ABILITIES,
  DND5E_SKILLS,
  type Dnd5eAbilityKey,
  type Dnd5eSkillKey,
  type Dnd5eSkillProficiency,
  type Dnd5eState,
  formatSignedMod,
  getAbilityModifier,
  getPassivePerception,
  getProficiencyBonus,
  getSaveBonus,
  getSkillBonus,
} from '../../core/dnd5eRules';
import { type AppTranslations } from '../../core/i18n';

interface Dnd5eAbilitiesSkillsProps {
  view: 'abilities' | 'skills';
  dnd5eState: Dnd5eState;
  abilityScores: Record<Dnd5eAbilityKey, number>;
  t: AppTranslations['cards'];
  onChangeAbilityScore: (ability: Dnd5eAbilityKey, score: number) => void;
  onToggleSaveProf: (ability: Dnd5eAbilityKey) => void;
  onCycleSkillProf: (skill: Dnd5eSkillKey, next: Dnd5eSkillProficiency) => void;
  onRollCheck: (label: string, bonus: number) => void;
}

const PROF_GLYPH: Record<Dnd5eSkillProficiency, string> = { none: '○', proficient: '●', expertise: '◎' };

export const Dnd5eAbilitiesSkills: React.FC<Dnd5eAbilitiesSkillsProps> = ({
  view,
  dnd5eState,
  abilityScores,
  t,
  onChangeAbilityScore,
  onToggleSaveProf,
  onCycleSkillProf,
  onRollCheck,
}) => {
  const uid = useId();
  const pb = getProficiencyBonus(dnd5eState.level);
  const passivePerc = getPassivePerception(abilityScores.wis, dnd5eState.level, dnd5eState.skillProficiencies.perception);

  if (view === 'abilities') {
    return (
      <div className="dnd5e-panel flex flex-col gap-3" data-testid="dnd5e-abilities-panel">
        <div className="dnd5e-summary-strip flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-control)] bg-[var(--bg-strip)]">
          <div className="flex items-center gap-1.5 font-mono-tech text-[11px] font-bold">
            <span className="text-[var(--ink-muted)]">{t.t('dnd5e.profBonusLabel')}</span>
            <span data-testid="dnd5e-prof-bonus" className="text-[var(--ink-primary)] tabular-nums">{formatSignedMod(pb)}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono-tech text-[11px] font-bold">
            <span className="text-[var(--ink-muted)]">{t.t('dnd5e.passivePerceptionLabel')}</span>
            <span data-testid="dnd5e-passive-perception" className="text-[var(--ink-primary)] tabular-nums">{passivePerc}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DND5E_ABILITIES.map((ab) => {
            const score = abilityScores[ab.key];
            const mod = getAbilityModifier(score);
            const modStr = formatSignedMod(mod);
            const abLabel = t.t(`dnd5e.ability.${ab.key}`);
            const inputId = `${uid}-ab-${ab.key}`;
            return (
              <div key={ab.key} className="dnd5e-ability-box p-2 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-1.5">
                <label htmlFor={inputId} className="font-mono-tech text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-secondary)]">
                  {abLabel}
                </label>
                <div className="flex items-center justify-between gap-1.5">
                  <input
                    id={inputId}
                    type="number"
                    min={1}
                    max={30}
                    data-testid={`dnd5e-score-${ab.key}`}
                    value={score}
                    onChange={(e) => {
                      const v = Number.parseInt(e.target.value, 10);
                      onChangeAbilityScore(ab.key, Number.isFinite(v) ? Math.max(1, Math.min(30, v)) : 10);
                    }}
                    className="cyber-input mobile-touch-input w-14 min-h-[36px] px-1.5 text-center font-mono-tech font-bold tabular-nums"
                  />
                  <button
                    type="button"
                    data-testid={`dnd5e-roll-ab-${ab.key}`}
                    aria-label={t.t('dnd5e.rollAbilityAria', { ability: abLabel, mod: modStr })}
                    onClick={() => onRollCheck(abLabel, mod)}
                    className="cyber-roll-btn min-h-[36px] flex-1 px-2 py-1 font-mono-tech text-sm font-black tabular-nums inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>{modStr}</span>
                    <Dices className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="font-mono-tech text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
            {t.t('dnd5e.savingThrowsHeading')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {DND5E_ABILITIES.map((ab) => {
              const prof = Boolean(dnd5eState.saveProficiencies[ab.key]);
              const bonus = getSaveBonus(abilityScores[ab.key], dnd5eState.level, prof);
              const bonusStr = formatSignedMod(bonus);
              const shortLabel = t.t(`dnd5e.abilityShort.${ab.key}`);
              return (
                <div key={ab.key} className="dnd5e-save-row flex items-center gap-1 p-1 border border-[var(--border-subtle)] rounded-[var(--radius-control)] bg-[var(--bg-card-alt)]">
                  <button
                    type="button"
                    aria-pressed={prof}
                    data-testid={`dnd5e-save-prof-${ab.key}`}
                    aria-label={t.t('dnd5e.toggleSaveProfAria', { ability: t.t(`dnd5e.ability.${ab.key}`) })}
                    onClick={() => onToggleSaveProf(ab.key)}
                    className={`dnd5e-prof-btn min-h-[36px] min-w-[32px] px-1.5 text-xs font-bold rounded-[var(--radius-pill)] cursor-pointer ${
                      prof ? 'is-active bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card)] text-[var(--ink-muted)]'
                    }`}
                  >
                    {prof ? '●' : '○'}
                  </button>
                  <button
                    type="button"
                    data-testid={`dnd5e-roll-save-${ab.key}`}
                    aria-label={t.t('dnd5e.rollSaveAria', { ability: t.t(`dnd5e.ability.${ab.key}`), mod: bonusStr })}
                    onClick={() => onRollCheck(`${shortLabel} SAVE`, bonus)}
                    className="flex-1 min-h-[36px] px-1.5 flex items-center justify-between gap-1 font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] rounded-[var(--radius-pill)] cursor-pointer"
                  >
                    <span>{shortLabel}</span>
                    <span className="tabular-nums">{bonusStr}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dnd5e-panel flex flex-col gap-1.5" data-testid="dnd5e-skills-panel">
      <div className="font-mono-tech text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
        {t.t('dnd5e.skillsHeading')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {DND5E_SKILLS.map((sk) => {
          const prof = dnd5eState.skillProficiencies[sk.key] ?? 'none';
          const bonus = getSkillBonus(abilityScores[sk.ability], dnd5eState.level, prof);
          const bonusStr = formatSignedMod(bonus);
          const skillName = t.t(`dnd5e.skill.${sk.key}`);
          const abShort = t.t(`dnd5e.abilityShort.${sk.ability}`);
          const stateText = t.t(prof === 'expertise' ? 'dnd5e.profExpertise' : prof === 'proficient' ? 'dnd5e.profProficient' : 'dnd5e.profNone');
          return (
            <div key={sk.key} className="dnd5e-skill-row flex items-center gap-1 p-0.5 border border-[var(--border-subtle)] rounded-[var(--radius-control)] bg-[var(--bg-card-alt)]">
              <button
                type="button"
                data-testid={`dnd5e-skill-prof-${sk.key}`}
                aria-label={t.t('dnd5e.cycleSkillProfAria', { skill: skillName, state: stateText })}
                title={stateText}
                onClick={() => onCycleSkillProf(sk.key, cycleSkillProficiency(prof))}
                className={`dnd5e-prof-btn min-h-[36px] min-w-[32px] px-1 text-xs font-bold rounded-[var(--radius-pill)] cursor-pointer ${
                  prof !== 'none' ? 'is-active bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card)] text-[var(--ink-muted)]'
                }`}
              >
                {PROF_GLYPH[prof]}
              </button>
              <button
                type="button"
                data-testid={`dnd5e-roll-skill-${sk.key}`}
                aria-label={t.t('dnd5e.rollSkillAria', { skill: skillName, mod: bonusStr })}
                onClick={() => onRollCheck(skillName, bonus)}
                className="flex-1 min-h-[36px] px-1.5 flex items-center justify-between gap-1 text-left font-mono-tech text-[11px] font-semibold text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] rounded-[var(--radius-pill)] cursor-pointer min-w-0"
              >
                <span className="truncate">{skillName} <span className="text-[9px] text-[var(--ink-muted)]">({abShort})</span></span>
                <span className="font-bold tabular-nums shrink-0">{bonusStr}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
