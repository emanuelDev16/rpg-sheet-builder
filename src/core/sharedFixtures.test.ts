import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateFormula,
  MAX_DICE_COUNT,
  MAX_RECURSION_DEPTH,
  rerollV5PoolDice,
  rollDiceExpression,
} from './formula';
import {
  escapeHtml,
  generateSingleFilePureHtml,
  sanitizeUrl,
  serializeSafeEmbeddedJson,
} from './pureHtmlExporter';
import {
  type CharacterSheetState,
  evaluateSheet,
  parseAndValidateImportPayload,
  validateSheetPayload,
} from './sheetModel';

const FIXTURES_DIR = path.resolve(process.cwd(), 'shared/presets/fixtures');

function readFixture<T>(name: string): T {
  const fullPath = path.join(FIXTURES_DIR, name);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
}

describe('Shared fixtures & engine hardening', () => {
  it('validates v20-botch.json deterministically with and without Willpower', () => {
    const fixture = readFixture<{
      expression: string;
      vars: Record<string, number>;
      difficulty: number;
      rng: number[];
      expectedRolls: number[];
      expectedWithoutWillpower: { total: number; isFumble: boolean; outcome: string };
      expectedWithWillpower: { total: number; isFumble: boolean; outcome: string };
    }>('v20-botch.json');

    let idx1 = 0;
    const botchRoll = rollDiceExpression(
      fixture.expression,
      fixture.vars,
      () => fixture.rng[idx1++],
      { rulePreset: 'storyteller-v20', difficulty: fixture.difficulty, willpowerAutoSuccess: false },
    );
    expect(botchRoll.ok).toBe(true);
    expect(botchRoll.rolls).toEqual(fixture.expectedRolls);
    expect(botchRoll.total).toBe(fixture.expectedWithoutWillpower.total);
    expect(botchRoll.isFumble).toBe(fixture.expectedWithoutWillpower.isFumble);
    expect(botchRoll.outcome).toBe(fixture.expectedWithoutWillpower.outcome);

    let idx2 = 0;
    const savedRoll = rollDiceExpression(
      fixture.expression,
      fixture.vars,
      () => fixture.rng[idx2++],
      { rulePreset: 'storyteller-v20', difficulty: fixture.difficulty, willpowerAutoSuccess: true },
    );
    expect(savedRoll.ok).toBe(true);
    expect(savedRoll.rolls).toEqual(fixture.expectedRolls);
    expect(savedRoll.total).toBe(fixture.expectedWithWillpower.total);
    expect(savedRoll.isFumble).toBe(fixture.expectedWithWillpower.isFumble);
    expect(savedRoll.outcome).toBe(fixture.expectedWithWillpower.outcome);
  });

  it('validates v5-messy-critical.json and blocks Hunger die rerolls under Willpower Surge', () => {
    const fixture = readFixture<{
      expression: string;
      vars: Record<string, number>;
      difficulty: number;
      hunger: number;
      rng: number[];
      expectedInitial: {
        difficulty: number;
        normalDice: number[];
        hungerDice: number[];
        total: number;
        isCritical: boolean;
        isMessyCritical: boolean;
        isBestialFailure: boolean;
      };
      willpowerRerollAttemptIndices: number[];
      rerollRng: number[];
      expectedAfterWillpowerReroll: {
        normalDice: number[];
        hungerDice: number[];
        total: number;
        isCritical: boolean;
        isMessyCritical: boolean;
        isBestialFailure: boolean;
      };
    }>('v5-messy-critical.json');

    let idx = 0;
    const initial = rollDiceExpression(
      fixture.expression,
      fixture.vars,
      () => fixture.rng[idx++],
      { rulePreset: 'vampire-v5', difficulty: fixture.difficulty, hungerDice: fixture.hunger },
    );
    expect(initial.ok).toBe(true);
    expect(initial.difficulty).toBe(fixture.expectedInitial.difficulty);
    expect(initial.normalDice).toEqual(fixture.expectedInitial.normalDice);
    expect(initial.hungerRolls).toEqual(fixture.expectedInitial.hungerDice);
    expect(initial.total).toBe(fixture.expectedInitial.total);
    expect(initial.isCritical).toBe(fixture.expectedInitial.isCritical);
    expect(initial.messyCritical).toBe(fixture.expectedInitial.isMessyCritical);
    expect(initial.bestialFailure).toBe(fixture.expectedInitial.isBestialFailure);

    let rIdx = 0;
    const surged = rerollV5PoolDice(
      initial.rolls,
      fixture.hunger,
      fixture.willpowerRerollAttemptIndices,
      () => fixture.rerollRng[rIdx++],
      { difficulty: fixture.difficulty },
    );
    expect(surged.ok).toBe(true);
    expect(surged.rerolledIndices).toEqual([1]); // Index 2 (Hunger die) blocked
    expect(surged.normalDice).toEqual(fixture.expectedAfterWillpowerReroll.normalDice);
    expect(surged.hungerRolls).toEqual(fixture.expectedAfterWillpowerReroll.hungerDice);
    expect(surged.total).toBe(fixture.expectedAfterWillpowerReroll.total);
    expect(surged.isCritical).toBe(fixture.expectedAfterWillpowerReroll.isCritical);
    expect(surged.messyCritical).toBe(fixture.expectedAfterWillpowerReroll.isMessyCritical);
    expect(surged.bestialFailure).toBe(fixture.expectedAfterWillpowerReroll.isBestialFailure);
  });

  it('upcasts envelope-v1-upcast.json cleanly to schema v2 with hunger and metadata', () => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'envelope-v1-upcast.json'), 'utf8');
    const parsed = parseAndValidateImportPayload(raw);
    expect(parsed.valid).toBe(true);
    expect(parsed.sheets).toHaveLength(1);

    const upgraded = parsed.sheets[0];
    expect(upgraded.id).toBeTruthy();
    expect(upgraded.revision).toBeGreaterThanOrEqual(1);
    expect(upgraded.updatedAt).toBeTruthy();
    expect(upgraded.deviceId).toBeTruthy();

    const combate = upgraded.cards.find((c) => c.id === 'card_combate');
    expect(combate?.title).toBe('HEALTH · WILLPOWER · HUNGER');
    expect(combate?.fields.some((f) => f.id === 'f_hunger')).toBe(true);
    expect(combate?.fields.some((f) => f.id === 'f_blood_pool')).toBe(false);
    expect(validateSheetPayload(upgraded).valid).toBe(true);
  });

  it('rejects __proto__ pollution and sanitizes/escapes XSS in malformed-xss.json HTML export', () => {
    const fixture = readFixture<{
      pollutedRawJson: string;
      xssSheet: CharacterSheetState;
    }>('malformed-xss.json');

    const pollutedParsed = parseAndValidateImportPayload(fixture.pollutedRawJson);
    expect(pollutedParsed.valid).toBe(false);
    expect(pollutedParsed.errors.join(' ')).toMatch(/__proto__|proibida/i);

    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(sanitizeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(sanitizeUrl('https://example.com/sheet?a=1&b=2')).toBe('https://example.com/sheet?a=1&b=2');
    expect(escapeHtml(`a'b<c>d"e&f`)).toBe('a&#39;b&lt;c&gt;d&quot;e&amp;f');
    expect(serializeSafeEmbeddedJson({ x: '</script>' })).toContain('\\u003c/script\\u003e');

    const html = generateSingleFilePureHtml(fixture.xssSheet, 'pt-BR');
    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:;" />`,
    );
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('<script>alert(');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com/sheet?a=1&amp;b=2"');
    expect(html).toContain('cont-track');
    expect(html).toContain('tick t25');
    expect(html).toContain('id="gridsheet-data"');
  });

  it('blocks circular references, excessive recursion depth, and excessive dice counts', () => {
    const circSheet: CharacterSheetState = {
      id: 'sheet_circ',
      systemId: 'blank',
      systemName: 'CUSTOM',
      systemCode: '/TEST',
      characterName: 'Loop',
      revision: 1,
      updatedAt: '2026-11-19T00:00:00Z',
      deviceId: 'dev1',
      rollLogs: [],
      cards: [
        {
          id: 'c1',
          tab: 'geral',
          code: '//TEST',
          title: 'CALC',
          colSpan: 1,
          fields: [
            { id: 'f_a', key: 'a', label: 'A', kind: 'calculated', formula: 'b + 1' },
            { id: 'f_b', key: 'b', label: 'B', kind: 'calculated', formula: 'a + 1' },
          ],
        },
      ],
    };

    const evalRes = evaluateSheet(circSheet);
    expect(evalRes.computedByFieldId['f_a']?.ok).toBe(false);
    expect(evalRes.computedByFieldId['f_a']?.error).toMatch(/circular/i);
    expect(evalRes.computedByFieldId['f_b']?.ok).toBe(false);
    expect(evalRes.computedByFieldId['f_b']?.error).toMatch(/circular/i);

    const deepExpr = '('.repeat(MAX_RECURSION_DEPTH + 3) + '1' + ')'.repeat(MAX_RECURSION_DEPTH + 3);
    const deepRes = evaluateFormula(deepExpr, {});
    expect(deepRes.ok).toBe(false);

    const abusiveDice = rollDiceExpression('500000d20', {});
    expect(abusiveDice.ok).toBe(false);
    expect(abusiveDice.error).toContain(String(MAX_DICE_COUNT));

    const abusivePool = rollDiceExpression('pool(500000, 6)', {});
    expect(abusivePool.ok).toBe(false);
  });
});
