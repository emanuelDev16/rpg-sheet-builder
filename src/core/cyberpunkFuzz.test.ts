import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyArmorDamage,
  fireWeapon,
  getCyberpunkWoundState,
  recomputeCyberpunkHumanity,
  reloadWeapon,
  repairArmorSp,
  rollExplodingD10Check,
} from './cyberpunkRules';
import { getFuzzOptions } from './fuzzConfig';

const FUZZ_OPTS = getFuzzOptions(20261128, 200);
const rngUnitArb = fc.double({ min: 0, max: 0.999999, noNaN: true, noDefaultInfinity: true });
const rngSeqArb = fc.array(rngUnitArb, { minLength: 1, maxLength: 4 });

function makeSeqRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const raw = values.length > 0 ? values[idx % values.length] : 0.5;
    idx += 1;
    return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0.5;
  };
}

describe('cyberpunkRules fuzzing — exploding 1d10 & wounds', () => {
  it('guarantees finite totals and coherent explosionKind/explosionDie for arbitrary inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -20, max: 30 }), fc.integer({ min: -20, max: 30 }), fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: 0, max: 20 }), fc.option(fc.integer({ min: 0, max: 60 }), { nil: undefined }), rngSeqArb,
        (stat, skill, modifier, woundPenalty, dv, seq) => {
          const res = rollExplodingD10Check({ stat, skill, modifier, woundPenalty, dv, rng: makeSeqRng(seq) });
          expect(Number.isFinite(res.total)).toBe(true);
          expect(res.baseDie).toBeGreaterThanOrEqual(1);
          expect(res.baseDie).toBeLessThanOrEqual(10);
          if (res.baseDie === 10) {
            expect(res.explosionKind).toBe('crit');
            expect(res.explosionDie).toBeGreaterThanOrEqual(1);
            expect(res.explosionDie).toBeLessThanOrEqual(10);
            expect(res.total).toBe(10 + res.explosionDie! + stat + skill + modifier - woundPenalty);
          } else if (res.baseDie === 1) {
            expect(res.explosionKind).toBe('fumble');
            expect(res.explosionDie).toBeGreaterThanOrEqual(1);
            expect(res.explosionDie).toBeLessThanOrEqual(10);
            expect(res.total).toBe(1 - res.explosionDie! + stat + skill + modifier - woundPenalty);
          } else {
            expect(res.explosionKind).toBe('none');
            expect(res.explosionDie).toBeNull();
            expect(res.total).toBe(res.baseDie + stat + skill + modifier - woundPenalty);
          }
          if (dv !== undefined) expect(res.passed).toBe(res.total >= dv);
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('keeps wound penalties in {0, 2, 4} with mutually exclusive flags', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 200 }), fc.integer({ min: 1, max: 200 }), (curHp, maxHp) => {
        const state = getCyberpunkWoundState(curHp, maxHp);
        expect([0, 2, 4]).toContain(state.woundPenalty);
        expect(state.isSeriouslyWounded && state.isMortallyWounded).toBe(false);
        expect(state.isMortallyWounded).toBe(curHp <= 0);
      }),
      FUZZ_OPTS,
    );
  });
});

describe('cyberpunkRules fuzzing — armor, humanity & weapons', () => {
  it('never drops SP below 0, only ablates on damage > sp, and bounds repair to [0, maxSp]', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'head' | 'body'>('head', 'body'), fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 100 }), fc.boolean(), fc.integer({ min: 0, max: 40 }),
        (loc, maxSp, rawSp, damage, headshotMultiplier, repairAmt) => {
          const sp = Math.min(maxSp, rawSp);
          const armor = { head: { sp, maxSp }, body: { sp, maxSp } };
          const res = applyArmorDamage(armor, loc, damage, { headshotMultiplier });
          expect(res.nextSp).toBeGreaterThanOrEqual(0);
          expect(res.nextSp).toBeLessThanOrEqual(sp);
          if (damage > sp) {
            expect(res.penetrated).toBe(true);
            expect(res.nextSp).toBe(Math.max(0, sp - 1));
            expect(res.hpDamage).toBe((damage - sp) * (loc === 'head' && headshotMultiplier ? 2 : 1));
          } else {
            expect(res.penetrated).toBe(false);
            expect(res.nextSp).toBe(sp);
            expect(res.hpDamage).toBe(0);
          }
          const repaired = repairArmorSp(res.armor, loc, repairAmt);
          expect(repaired[loc].sp).toBeGreaterThanOrEqual(0);
          expect(repaired[loc].sp).toBeLessThanOrEqual(maxSp);
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('bounds effectiveEmp to [0, 10], humanity to [0, max], and cyberpsychosisRisk to effectiveEmp <= 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 20 }),
        fc.array(fc.integer({ min: 0, max: 30 }), { maxLength: 40 }),
        (baseEmp, losses) => {
          const res = recomputeCyberpunkHumanity({ baseEmp }, losses.map((humanityLoss) => ({ humanityLoss })));
          expect(res.effectiveEmp).toBeGreaterThanOrEqual(0);
          expect(res.effectiveEmp).toBeLessThanOrEqual(10);
          expect(res.humanity.current).toBeGreaterThanOrEqual(0);
          expect(res.humanity.current).toBeLessThanOrEqual(res.humanity.max);
          expect(res.humanity.max).toBeLessThanOrEqual(100);
          expect(res.cyberpsychosisRisk).toBe(res.effectiveEmp <= 2);
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('keeps ammoCurrent in [0, ammoMax] across fireWeapon and reloadWeapon', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: -5, max: 10 }),
        (rof, rawMax, rawCur, shots) => {
          const weapon = { id: 'w', name: 'Gun', skillKey: 'handgun', damageFormula: '2d6', rof, ammoCurrent: rawCur, ammoMax: rawMax };
          const fired = fireWeapon(weapon, shots);
          expect(fired.weapon.ammoCurrent).toBeGreaterThanOrEqual(0);
          expect(fired.weapon.ammoCurrent).toBeLessThanOrEqual(rawMax);
          expect(fired.shotsFired).toBeGreaterThanOrEqual(0);
          expect(fired.shotsFired).toBeLessThanOrEqual(rof);
          if (shots <= 0) {
            expect(fired.fired).toBe(false);
            expect(fired.shotsFired).toBe(0);
          }
          const reloaded = reloadWeapon(fired.weapon);
          expect(reloaded.ammoCurrent).toBe(rawMax);
        },
      ),
      FUZZ_OPTS,
    );
  });
});
