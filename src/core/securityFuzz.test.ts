import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createDnd5ePreset, createWorldOfDarknessSheet, createWorldOfDarknessV5Sheet,
  parseAndValidateImportPayload, validateSheetPayload, type CharacterSheetState,
} from './sheetModel';
import { generateSingleFilePureHtml, sanitizeUrl } from './pureHtmlExporter';

const FUZZ_OPTS = { numRuns: 200 } as const;
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'] as const;
const ADVERSARIAL_VECTORS = [
  '<script>', '</script>', '<script>alert(1)</script>', '<!--', '-->', 'onerror=',
  '<img src=x onerror=alert(1)>', 'onload=', '<svg/onload=alert(1)>', 'javascript:alert(1)',
  'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>',
  'data:image/svg+xml,<svg onload=alert(1)>', '\u2028', '\u2029', '" onerror="alert(1)',
] as const;

const adversarialTextArb = fc
  .tuple(fc.string({ maxLength: 32 }), fc.constantFrom(...ADVERSARIAL_VECTORS), fc.string({ maxLength: 24 }))
  .map(([a, vec, b]) => `${a}${vec}${b}`);
const adversarialUrlArb = fc.oneof(
  fc.tuple(
    fc.constantFrom('javascript:', 'JaVaScRiPt:', 'vbscript:', 'data:text/html,', 'data:image/svg+xml,', '\u0000javascript:', '\tjavascript:'),
    fc.string({ maxLength: 40 }),
  ).map(([scheme, tail]) => `${scheme}${tail}`),
  fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).map((slug) => `https://example.com/${slug}?q=1&b=2`),
  fc.constant('data:image/png;base64,iVBORw0KGgo='),
);
const assertNoProtoPollution = () => expect(({} as Record<string, unknown>).polluted).toBeUndefined();
const V5_BASE = createWorldOfDarknessV5Sheet();
const V20_BASE = createWorldOfDarknessSheet();
const DND_BASE = createDnd5ePreset();

function injectDangerousJson(
  target: 'root' | 'card' | 'field' | 'touchstone' | 'merit' | 'haven' | 'rollLog' | 'dnd5e' | 'xpMult' | 'bundle',
  key: string,
  noise: string,
): string {
  const pair = `${JSON.stringify(key)}:${JSON.stringify({ polluted: true, noise })}`;
  if (target === 'root') return `{${pair},"systemName":"WoD","systemCode":"V5","characterName":"T","cards":[]}`;
  const base = target === 'dnd5e' ? DND_BASE : V5_BASE;
  const json = JSON.stringify({
    ...base,
    touchstones: [{ id: 'ts_1', conviction: 'C', touchstone: 'T' }],
    meritsFlaws: [{ id: 'mf_1', kind: 'merit', name: 'M', rating: 2 }],
    havens: [{ id: 'hv_1', name: 'H', rating: 1, traits: ['Secure'] }],
    rollLogs: [{ id: 'rl_1', timestamp: '2026-01-01T00:00:00Z', label: 'L', total: 1, formula: '1d10', breakdown: '1' }],
    xp: { totalEarned: 5, spent: 0, ledger: [], customMultipliers: { attribute: 5 } },
  });
  if (target === 'bundle') return `{"sheets":[${json.replace('"cards":[{', `"cards":[{${pair},`)}]}`;
  const markers: Record<string, string> = {
    card: '"cards":[{', field: '"fields":[{', touchstone: '"touchstones":[{', merit: '"meritsFlaws":[{',
    haven: '"havens":[{', rollLog: '"rollLogs":[{', dnd5e: '"dnd5eState":{', xpMult: '"customMultipliers":{',
  };
  return json.replace(markers[target], `${markers[target]}${pair},`);
}

describe('security fuzzing — JSON importer & schema validator', () => {
  it('never throws or pollutes Object.prototype on arbitrary strings & fc.jsonValue()', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 350 }), fc.jsonValue({ maxDepth: 4 }), (raw, val) => {
        const resRaw = parseAndValidateImportPayload(raw);
        expect(typeof resRaw.valid).toBe('boolean');
        expect(Array.isArray(resRaw.sheets)).toBe(true);
        expect(Array.isArray(resRaw.errors)).toBe(true);
        const resVal = validateSheetPayload(val);
        expect(typeof resVal.valid).toBe('boolean');
        expect(Array.isArray(resVal.errors)).toBe(true);
        expect(typeof parseAndValidateImportPayload(JSON.stringify(val)).valid).toBe('boolean');
        expect(typeof parseAndValidateImportPayload(JSON.stringify({ sheets: [val] })).valid).toBe('boolean');
        assertNoProtoPollution();
      }),
      FUZZ_OPTS,
    );
  });

  it('handles corrupted dnd5eState envelopes and hostile objects cleanly without throwing', () => {
    const slotArb = fc.constantFrom(
      'dnd5eState', 'level', 'hitDice', 'hitDice.die', 'deathSaves', 'saveProficiencies',
      'skillProficiencies', 'skillProficiencies.acrobatics', 'spellcasting', 'spellcasting.ability',
      'spellcasting.slots', 'systemId', 'rulePreset', 'xpRulePreset',
    );
    const hostileArb = fc.oneof(fc.jsonValue({ maxDepth: 3 }), fc.constant({ toString: 1, valueOf: 1 }));
    fc.assert(
      fc.property(slotArb, hostileArb, (slot, corrupt) => {
        const clone = structuredClone(DND_BASE) as unknown as Record<string, unknown>;
        const ds = clone.dnd5eState as Record<string, unknown>;
        if (slot === 'dnd5eState' || slot === 'systemId' || slot === 'rulePreset' || slot === 'xpRulePreset') {
          clone[slot] = corrupt;
        } else if (slot.includes('.')) {
          const [parent, child] = slot.split('.');
          (ds[parent] as Record<string, unknown>)[child] = corrupt;
        } else {
          ds[slot] = corrupt;
        }
        const vRes = validateSheetPayload(clone);
        expect(typeof vRes.valid).toBe('boolean');
        expect(Array.isArray(vRes.errors)).toBe(true);
        expect(typeof parseAndValidateImportPayload(JSON.stringify(clone)).valid).toBe('boolean');
        assertNoProtoPollution();
      }),
      FUZZ_OPTS,
    );
  });

  it('regression: rejects { toString: 1, valueOf: 1 } enum values without TypeError', () => {
    const hostile = { toString: 1, valueOf: 1 };
    const res = validateSheetPayload({ ...structuredClone(DND_BASE), systemId: hostile });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('$.systemId'))).toBe(true);
    const badDie = structuredClone(DND_BASE) as unknown as { dnd5eState: { hitDice: { die: unknown } } };
    badDie.dnd5eState.hitDice.die = hostile;
    expect(validateSheetPayload(badDie).valid).toBe(false);
  });

  it('rejects __proto__, constructor, and prototype keys at every nested level', () => {
    const targetArb = fc.constantFrom(
      'root', 'card', 'field', 'touchstone', 'merit', 'haven', 'rollLog', 'dnd5e', 'xpMult', 'bundle',
    );
    fc.assert(
      fc.property(fc.constantFrom(...DANGEROUS_KEYS), targetArb, fc.string({ maxLength: 20 }), (key, target, noise) => {
        const raw = injectDangerousJson(target, key, noise);
        const res = parseAndValidateImportPayload(raw);
        expect(res.valid).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
        if (target !== 'bundle') expect(validateSheetPayload(JSON.parse(raw)).valid).toBe(false);
        assertNoProtoPollution();
      }),
      FUZZ_OPTS,
    );
  });
});

describe('security fuzzing — standalone HTML exporter, URL sanitizer & CSP', () => {
  it('sanitizeUrl blocks dangerous schemes and control characters', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ maxLength: 80 }), adversarialUrlArb), (raw) => {
        const out = sanitizeUrl(raw);
        if (out !== '') {
          expect(out).toMatch(/^(?:https?:\/\/|data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$)/i);
          expect(out).not.toMatch(/[\u0000-\u001f\u007f]/);
        }
      }),
      FUZZ_OPTS,
    );
  });

  it('enforces CSP, prevents script breakouts, and blocks dangerous href/src across WoD and D&D 5e', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'v5' | 'v20' | 'dnd5e'>('v5', 'v20', 'dnd5e'),
        adversarialTextArb, adversarialTextArb, adversarialTextArb, adversarialUrlArb,
        (kind, v1, v2, v3, url) => {
          const base = kind === 'v5' ? V5_BASE : kind === 'v20' ? V20_BASE : DND_BASE;
          const tainted: CharacterSheetState = {
            ...structuredClone(base), characterName: v1, systemName: v2, systemCode: v3,
            touchstones: [{ id: 'ts_f', conviction: v1, touchstone: v2, notes: v3 }],
            meritsFlaws: [{ id: 'mf_f', kind: 'flaw', name: v2, rating: 2, notes: v1 }],
            havens: [{ id: 'hv_f', name: v3, location: v1, rating: 3, traits: [v1, v2], notes: v2 }],
            rollLogs: [{ id: 'rl_f', timestamp: v1, label: v2, total: 5, formula: v3, breakdown: v1 }],
          };
          tainted.cards[0] = {
            ...tainted.cards[0], title: v1, code: v2,
            fields: [
              ...tainted.cards[0].fields.slice(0, 3).map((f) => ({ ...f, label: v2, value: f.kind === 'text' ? v1 : f.value })),
              { id: 'f_fuzz_url', key: 'avatar_url', label: v3, kind: 'text', value: url },
              ...tainted.cards[0].fields.slice(3),
            ],
          };
          tainted.cards.push({
            id: 'c_fuzz_extra', tab: 'xp', code: v2, title: v1, colSpan: 1,
            fields: [{ id: 'f_fuzz_extra', key: 'fuzz_extra', label: v3, kind: 'text', value: url }],
          });
          const html = generateSingleFilePureHtml(tainted, 'pt-BR', { documentTitle: v1 });
          const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
          expect(csp).not.toBeNull();
          expect(csp![1]).toContain("default-src 'none'");
          expect(csp![1]).not.toMatch(/script-src|unsafe-eval/i);
          expect(html.match(/<script\b/gi)).toHaveLength(1);
          expect(html.match(/<\/script\s*>/gi)).toHaveLength(1);
          const embedded = html.match(/<script type="application\/json" id="gridsheet-data">([\s\S]*?)<\/script>/);
          expect(embedded).not.toBeNull();
          expect(embedded![1]).not.toMatch(/<\/script|[<>]|\u2028|\u2029/i);
          expect(() => JSON.parse(embedded![1])).not.toThrow();
          for (const attr of html.matchAll(/(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
            const val = attr[1] ?? attr[2] ?? attr[3] ?? '';
            expect(val).not.toMatch(/^\s*(?:javascript:|vbscript:|data:text\/html|data:image\/svg\+xml)/i);
            expect(val).not.toMatch(/^\s*data:(?!image\/(?:png|jpeg|jpg|gif|webp);base64,)/i);
          }
          const bodyOnly = html.replace(/<style>[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
          expect(bodyOnly).not.toContain('<!--');
          for (const tag of bodyOnly.match(/<[a-zA-Z][^>]*>/g) ?? []) {
            expect(tag.replace(/"[^"]*"|'[^']*'/g, '')).not.toMatch(/\bon[a-z]+\s*=/i);
          }
        },
      ),
      FUZZ_OPTS,
    );
  });
});
