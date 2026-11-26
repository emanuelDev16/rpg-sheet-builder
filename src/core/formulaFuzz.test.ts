import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  evaluateFormula,
  MAX_DICE_COUNT,
  MAX_RECURSION_DEPTH,
  rollDiceExpression,
} from './formula';

const FUZZ_OPTS = { numRuns: 200 } as const;

function makeSeqRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const raw = values.length > 0 ? values[idx % values.length] : 0.5;
    idx += 1;
    return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0.5;
  };
}

const rngArrayArb = fc.array(
  fc.double({ min: 0, max: 0.999999, noNaN: true, noDefaultInfinity: true }),
  { minLength: 1, maxLength: 30 },
);

describe('formula fuzzing — adversarial & random inputs', () => {
  const vars = { str: 3, dex: 4, mod: -2, hunger: 1 };

  it('never throws or returns non-finite values for arbitrary fc.string()', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 320 }), (expr) => {
        const res = evaluateFormula(expr, vars);
        expect(typeof res.ok).toBe('boolean');
        if (res.ok) expect(Number.isFinite(res.value)).toBe(true);
        else expect((res.error ?? '').length).toBeGreaterThan(0);

        const roll = rollDiceExpression(expr, vars, () => 0.5);
        expect(typeof roll.ok).toBe('boolean');
        if (roll.ok) expect(Number.isFinite(roll.total)).toBe(true);
        else expect((roll.error ?? '').length).toBeGreaterThan(0);
      }),
      FUZZ_OPTS,
    );
  });

  it('handles composite adversarial expressions, deep parens and special chars safely', () => {
    const tokenArb = fc.constantFrom(
      '1', '0', '99', 'str', 'dex', '2d6', 'd20', 'pool(3,6)',
      '+', '-', '*', '/', '(', ')', ',', ';', '$', '`', '{', '}', '\0', '@',
      'floor(', 'ceil(', 'round(', 'abs(', 'min(', 'max(',
      'eval(', 'constructor', '__proto__', 'Function(',
    );
    const compositeArb = fc
      .tuple(
        fc.integer({ min: 0, max: 45 }),
        fc.array(tokenArb, { minLength: 1, maxLength: 35 }),
        fc.integer({ min: 0, max: 45 }),
      )
      .map(([openP, parts, closeP]) => `${'('.repeat(openP)}${parts.join(' ')}${')'.repeat(closeP)}`);

    fc.assert(
      fc.property(compositeArb, (expr) => {
        const res = evaluateFormula(expr, vars);
        expect(Number.isFinite(res.value)).toBe(true);
        if (!res.ok) expect((res.error ?? '').length).toBeGreaterThan(0);

        const roll = rollDiceExpression(expr, vars, () => 0.42);
        expect(Number.isFinite(roll.total)).toBe(true);
        if (!roll.ok) expect((roll.error ?? '').length).toBeGreaterThan(0);
      }),
      FUZZ_OPTS,
    );
  });
});

describe('formula fuzzing — anti-DoS & cycle detection', () => {
  it('rejects dice counts exceeding MAX_DICE_COUNT without hanging', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_DICE_COUNT + 1, max: 1_000_000 }),
        fc.integer({ min: 2, max: 1000 }),
        (count, sides) => {
          const direct = rollDiceExpression(`${count}d${sides}`, {}, () => 0.5);
          expect(direct.ok).toBe(false);
          expect(direct.rolls).toEqual([]);
          expect((direct.error ?? '').length).toBeGreaterThan(0);

          const pool = rollDiceExpression(`pool(${count}, 6)`, {}, () => 0.5);
          expect(pool.ok).toBe(false);
          expect(pool.rolls).toEqual([]);
          expect((pool.error ?? '').length).toBeGreaterThan(0);
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('rejects formulaMap chains exceeding MAX_RECURSION_DEPTH', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_RECURSION_DEPTH + 1, max: MAX_RECURSION_DEPTH + 15 }),
        (chainLen) => {
          const formulaMap: Record<string, string> = {};
          for (let i = 0; i < chainLen; i += 1) {
            formulaMap[`f${i}`] = i === chainLen - 1 ? '1' : `f${i + 1} + 1`;
          }
          const res = evaluateFormula('f0', {}, true, { formulaMap });
          expect(res.ok).toBe(false);
          expect(res.error).toMatch(/recurs|profundidade/i);
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('rejects randomly generated circular formulaMap graphs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (nodeCount, rawBackTarget) => {
          const backTarget = rawBackTarget % nodeCount;
          const formulaMap: Record<string, string> = {};
          for (let i = 0; i < nodeCount; i += 1) {
            formulaMap[`f${i}`] = `f${i === nodeCount - 1 ? backTarget : i + 1}`;
          }
          const res = evaluateFormula('f0', {}, true, { formulaMap });
          expect(res.ok).toBe(false);
          expect(res.error).toMatch(/circular/i);
        },
      ),
      FUZZ_OPTS,
    );
  });
});

describe('formula fuzzing — V20 & V5 d10 pool invariants', () => {
  it('enforces d10 bounds and non-NaN totals on valid V20 pools', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 2, max: 10 }),
        fc.boolean(),
        fc.boolean(),
        rngArrayArb,
        (pool, difficulty, specialty, willpowerAutoSuccess, seq) => {
          const res = rollDiceExpression(`pool(${pool}, ${difficulty})`, {}, makeSeqRng(seq), {
            rulePreset: 'storyteller-v20',
            difficulty,
            specialty,
            willpowerAutoSuccess,
          });
          expect(res.ok).toBe(true);
          expect(Number.isFinite(res.total)).toBe(true);
          expect(res.rolls).toHaveLength(pool);
          for (const die of res.rolls) {
            expect(Number.isInteger(die)).toBe(true);
            expect(die).toBeGreaterThanOrEqual(1);
            expect(die).toBeLessThanOrEqual(10);
          }
        },
      ),
      FUZZ_OPTS,
    );
  });

  it('enforces normalDice + hungerDice === pool and d10 bounds on valid V5 pools', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        rngArrayArb,
        (pool, difficulty, hungerDice, seq) => {
          const res = rollDiceExpression(`pool(${pool}, ${difficulty})`, {}, makeSeqRng(seq), {
            rulePreset: 'vampire-v5',
            difficulty,
            hungerDice,
          });
          expect(res.ok).toBe(true);
          expect(Number.isFinite(res.total)).toBe(true);
          expect(res.rolls).toHaveLength(pool);
          expect((res.normalDice?.length ?? 0) + (res.hungerRolls?.length ?? 0)).toBe(pool);
          expect(res.hungerDice).toBe(res.hungerRolls?.length ?? 0);
          for (const die of res.rolls) {
            expect(Number.isInteger(die)).toBe(true);
            expect(die).toBeGreaterThanOrEqual(1);
            expect(die).toBeLessThanOrEqual(10);
          }
        },
      ),
      FUZZ_OPTS,
    );
  });
});
