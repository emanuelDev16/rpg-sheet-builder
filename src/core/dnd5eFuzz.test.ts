import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyDndDamage, applyDndHeal, applyLongRest, createDefaultDnd5eState,
  formatSignedMod, getAbilityModifier, getProficiencyBonus, rollD20Check,
  rollDeathSave, setTempHp, spendHitDieShortRest,
  type Dnd5eHitDieType, type Dnd5eRollMode,
} from './dnd5eRules';

const FUZZ_OPTS = { numRuns: 200 } as const;
const rngUnitArb = fc.double({ min: 0, max: 0.999999, noNaN: true, noDefaultInfinity: true });
const rngSeqArb = fc.array(rngUnitArb, { minLength: 1, maxLength: 8 });
const hitDieArb = fc.constantFrom<Dnd5eHitDieType>('d6', 'd8', 'd10', 'd12');
const rollModeArb = fc.constantFrom<Dnd5eRollMode>('normal', 'advantage', 'disadvantage');

function makeSeqRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const raw = values.length > 0 ? values[idx % values.length] : 0.5;
    idx += 1;
    return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0.5;
  };
}

describe('dnd5eRules fuzzing — modifiers & proficiency', () => {
  it('computes exact ability modifiers and always formats signed mods with + or -', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 100 }), (score) => {
        expect(getAbilityModifier(score)).toBe(Math.floor((score - 10) / 2));
        const formatted = formatSignedMod(score);
        expect(formatted[0] === '+' || formatted[0] === '-').toBe(true);
        expect(formatSignedMod(getAbilityModifier(score))).toMatch(/^[+-]\d+$/);
      }),
      FUZZ_OPTS,
    );
  });

  it('keeps proficiency bonus in [2, 6] and monotonically non-decreasing across [-100, 200]', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 200 }), fc.integer({ min: -100, max: 200 }), (a, b) => {
        const [levelA, levelB] = a <= b ? [a, b] : [b, a];
        const pbA = getProficiencyBonus(levelA);
        const pbB = getProficiencyBonus(levelB);
        expect(pbA).toBeGreaterThanOrEqual(2);
        expect(pbA).toBeLessThanOrEqual(6);
        expect(pbB).toBeGreaterThanOrEqual(2);
        expect(pbB).toBeLessThanOrEqual(6);
        expect(pbA).toBeLessThanOrEqual(pbB);
      }),
      FUZZ_OPTS,
    );
  });
});

describe('dnd5eRules fuzzing — rollD20Check', () => {
  it('enforces advantage/disadvantage ordering, total, and nat20/nat1 flags', () => {
    fc.assert(
      fc.property(rollModeArb, fc.integer({ min: -30, max: 50 }), rngSeqArb, (mode, bonus, seq) => {
        const res = rollD20Check({ mode, bonus, rng: makeSeqRng(seq) });
        expect(res.kept).toBeGreaterThanOrEqual(1);
        expect(res.kept).toBeLessThanOrEqual(20);
        expect(res.total).toBe(res.kept + bonus);
        expect(res.isNat20).toBe(res.kept === 20);
        expect(res.isNat1).toBe(res.kept === 1);
        if (mode === 'normal') {
          expect(res.dice).toHaveLength(1);
          expect(res.discarded).toBeNull();
        } else {
          expect(res.dice).toHaveLength(2);
          expect(res.discarded).not.toBeNull();
          if (mode === 'advantage') expect(res.kept).toBeGreaterThanOrEqual(res.discarded!);
          if (mode === 'disadvantage') expect(res.kept).toBeLessThanOrEqual(res.discarded!);
        }
      }),
      FUZZ_OPTS,
    );
  });
});

describe('dnd5eRules fuzzing — combat HP, tempHp & healing', () => {
  it('enforces setTempHp, temp-first damage absorption, and heal/death-save invariants', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), fc.integer({ min: -20, max: 600 }),
        fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 600 }),
        fc.boolean(), fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }),
        (maxHp, currentHp, tempHp, amount, forceOverride, successes, failures) => {
          const nextTemp = setTempHp(tempHp, amount, { forceOverride });
          expect(nextTemp).toBeGreaterThanOrEqual(0);
          expect(nextTemp).toBe(forceOverride ? amount : Math.max(tempHp, amount));

          const dmgRes = applyDndDamage({ currentHp, maxHp, tempHp }, amount);
          expect(dmgRes.currentHp).toBeGreaterThanOrEqual(0);
          expect(dmgRes.currentHp).toBeLessThanOrEqual(maxHp);
          expect(dmgRes.tempHp).toBeGreaterThanOrEqual(0);
          expect(dmgRes.absorbedByTemp).toBe(Math.min(tempHp, amount));
          expect(dmgRes.tempHp).toBe(tempHp - dmgRes.absorbedByTemp);
          if (dmgRes.appliedToHp > 0) expect(dmgRes.tempHp).toBe(0);

          const healRes = applyDndHeal({ currentHp, maxHp, tempHp, deathSaves: { successes, failures } }, amount);
          expect(healRes.currentHp).toBeGreaterThanOrEqual(0);
          expect(healRes.currentHp).toBeLessThanOrEqual(maxHp);
          expect(healRes.tempHp).toBe(tempHp);
          if (currentHp <= 0 && healRes.currentHp > 0) {
            expect(healRes.deathSaves).toEqual({ successes: 0, failures: 0 });
          }
        },
      ),
      FUZZ_OPTS,
    );
  });
});

describe('dnd5eRules fuzzing — death saves & rests', () => {
  it('keeps death saves in [0, 3] and hitDice in [0, max] across short rests', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }), fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }), fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 20 }), hitDieArb, fc.integer({ min: 1, max: 30 }), rngUnitArb,
        (maxHp, rawCurHp, tempHp, successes, failures, hdMax, rawHdCur, die, conScore, rngVal) => {
          const currentHp = Math.min(maxHp, rawCurHp);
          const hdCur = Math.min(hdMax, rawHdCur);
          const rng = () => rngVal;

          const dsRes = rollDeathSave({ currentHp, maxHp, deathSaves: { successes, failures } }, rng);
          expect(dsRes.deathSaves.successes).toBeGreaterThanOrEqual(0);
          expect(dsRes.deathSaves.successes).toBeLessThanOrEqual(3);
          expect(dsRes.deathSaves.failures).toBeGreaterThanOrEqual(0);
          expect(dsRes.deathSaves.failures).toBeLessThanOrEqual(3);

          const restRes = spendHitDieShortRest(
            { currentHp, maxHp, tempHp, deathSaves: { successes, failures }, hitDice: { die, current: hdCur, max: hdMax }, conScore },
            rng,
          );
          expect(restRes.hitDice.current).toBeGreaterThanOrEqual(0);
          expect(restRes.hitDice.current).toBeLessThanOrEqual(restRes.hitDice.max);
          expect(restRes.currentHp).toBeGreaterThanOrEqual(0);
          expect(restRes.currentHp).toBeLessThanOrEqual(maxHp);
          expect(restRes.spent).toBe(hdCur > 0);
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('restores full HP, clears tempHp/deathSaves/slots, and bounds hitDice on long rest', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 20 }),
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 9, maxLength: 9 }),
        (maxHp, level, tempHp, successes, failures, rawHdCur, slotMaxes) => {
          const slots = slotMaxes.map((max, i) => ({ level: i + 1, max, used: max }));
          const dnd5eState = createDefaultDnd5eState({
            level, tempHp, deathSaves: { successes, failures },
            hitDice: { die: 'd10', max: level, current: Math.min(level, rawHdCur) },
            spellcasting: { ability: 'int', slots },
          });
          const res = applyLongRest({ maxHp, dnd5eState });
          expect(res.currentHp).toBe(maxHp);
          expect(res.dnd5eState.tempHp).toBe(0);
          expect(res.dnd5eState.deathSaves).toEqual({ successes: 0, failures: 0 });
          expect(res.dnd5eState.hitDice.current).toBeGreaterThanOrEqual(0);
          expect(res.dnd5eState.hitDice.current).toBeLessThanOrEqual(res.dnd5eState.hitDice.max);
          expect(res.dnd5eState.spellcasting.slots.every((s) => s.used === 0)).toBe(true);
        },
      ),
      FUZZ_OPTS,
    );
  });
});
