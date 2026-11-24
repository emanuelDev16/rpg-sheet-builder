import { describe, expect, it } from 'vitest';
import {
  evaluateFormula,
  MAX_DICE_COUNT,
  MAX_FORMULA_LENGTH,
  MAX_RECURSION_DEPTH,
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
  createWorldOfDarknessV5Sheet,
  evaluateSheet,
  findDangerousKeyPath,
  MAX_IMPORT_PAYLOAD_BYTES,
  parseAndValidateImportPayload,
  toCanonicalSheet,
  validateSheetPayload,
} from './sheetModel';
import {
  validateCanonicalSheetPayload,
  validateWorkspaceMirrorInput,
} from './roomSync';
import {
  applySecurityHeaders,
  hasDangerousObjectKeys,
  rejectPrototypePollutionBody,
  requireSyncAuth,
  resolveAllowedCorsOrigins,
  resolveBindHost,
  SYNC_TOKEN,
  verifySyncBearerToken,
} from '../../server';
import {
  computeOcrRenderScale,
  extractPdfPagesWithFailFast,
  ScannedPdfNoOcrError,
} from './pdfRulesStore';
import {
  type OcrWorkerLike,
  type PdfIndexWorkerResponse,
  runOcrIndexingPipeline,
} from '../workers/pdfIndexer.worker';

describe('Workstream 2 — Web Security Hardening Suite', () => {
  describe('1. XSS, URL Sanitization, Embedded JSON & CSP (pureHtmlExporter)', () => {
    it('blocks dangerous protocols and control-char URL smuggling while preserving safe URLs', () => {
      const blockedUrls = [
        'javascript:alert(5)',
        '   JaVaScRiPt:alert(6)',
        '\u0000javascript:alert(6)',
        'java\tscript:alert(6)',
        'java\nscript:alert(6)',
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(7)</script>',
        'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoOCk+PC9zdmc+',
        'data:image/svg+xml,<svg onload=alert(1)>',
        'file:///etc/passwd',
      ];
      for (const url of blockedUrls) {
        expect(sanitizeUrl(url)).toBe('');
      }

      expect(sanitizeUrl('https://example.com/avatar.png?x=1&y=2')).toBe(
        'https://example.com/avatar.png?x=1&y=2',
      );
      expect(sanitizeUrl('http://localhost:3000/sheet')).toBe('http://localhost:3000/sheet');
      expect(sanitizeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
        'data:image/png;base64,iVBORw0KGgo=',
      );
      expect(sanitizeUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(
        'data:image/jpeg;base64,/9j/4AAQ',
      );
      expect(sanitizeUrl('data:image/webp;base64,UklGRh4=')).toBe(
        'data:image/webp;base64,UklGRh4=',
      );
      expect(sanitizeUrl('data:image/gif;base64,R0lGODlh')).toBe(
        'data:image/gif;base64,R0lGODlh',
      );
    });

    it('neutralizes script breakouts, HTML comments, and line separators in embedded JSON', () => {
      const serialized = serializeSafeEmbeddedJson({
        xss: '</script><script>alert(1)</script>',
        comment: '<!-- hidden -->',
        sep: 'a\u2028b\u2029c',
      });
      expect(serialized).not.toContain('</script>');
      expect(serialized).not.toContain('<!--');
      expect(serialized).not.toContain('-->');
      expect(serialized).not.toContain('\u2028');
      expect(serialized).not.toContain('\u2029');
      expect(serialized).toContain('\\u003c/script\\u003e');
      expect(serialized).toContain('\\u003c!-- hidden --\\u003e');
      expect(serialized).toContain('\\u2028');
      expect(serialized).toContain('\\u2029');
    });

    it('escapes all interpolated fields in standalone V5 HTML and enforces strict CSP', () => {
      const payloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(2)>',
        '<svg/onload=alert(3)>',
        '"</script><script>alert(4)</script>',
      ];
      const base = createWorldOfDarknessV5Sheet();
      const tainted: CharacterSheetState = {
        ...base,
        characterName: payloads[0],
        systemName: payloads[1],
        systemCode: payloads[2],
        cards: base.cards.map((card, cIdx) => ({
          ...card,
          title: `${card.title} ${payloads[cIdx % payloads.length]}`,
          code: `//${payloads[(cIdx + 1) % payloads.length]}`,
          fields: card.fields.map((f) => {
            if (f.key === 'clan_bane') return { ...f, value: payloads[0] };
            if (f.key === 'clan_compulsion') return { ...f, value: payloads[1] };
            if (f.key === 'predator_type') return { ...f, value: payloads[2] };
            if (f.key === 'concept') return { ...f, value: payloads[3] };
            if (f.key === 'sire') return { ...f, value: payloads[0] };
            if (f.key === 'chronicle') return { ...f, value: payloads[1] };
            if (f.key === 'notas_campanha') return { ...f, value: '   JaVaScRiPt:alert(6)' };
            return f;
          }),
        })),
        touchstones: [
          {
            id: 'ts_sec_1',
            conviction: payloads[0],
            touchstone: payloads[1],
            notes: payloads[3],
          },
        ],
        meritsFlaws: [
          {
            id: 'mf_sec_1',
            kind: 'flaw',
            name: payloads[2],
            rating: 2,
            notes: payloads[0],
          },
        ],
        havens: [
          {
            id: 'hv_sec_1',
            name: payloads[3],
            location: payloads[1],
            rating: 3,
            traits: [payloads[0], payloads[2]],
            notes: payloads[1],
          },
        ],
        rollLogs: [
          {
            id: 'log_sec_1',
            timestamp: payloads[0],
            label: payloads[1],
            total: 3,
            formula: payloads[2],
            breakdown: payloads[3],
          },
        ],
        xp: {
          totalEarned: 10,
          spent: 5,
          ledger: [
            {
              id: 'xp_sec_1',
              timestamp: '2026-11-24T00:00:00Z',
              kind: 'upgrade',
              delta: -5,
              xpSpent: 5,
              label: payloads[3],
            },
          ],
        },
      };

      // Inject additional URL attack fields & safe URL
      tainted.cards[0].fields.push(
        { id: 'f_avatar_bad_js', key: 'avatar_bad_js', label: payloads[0], kind: 'text', value: 'javascript:alert(5)' },
        { id: 'f_avatar_bad_svg', key: 'avatar_bad_svg', label: 'SVG', kind: 'text', value: 'data:image/svg+xml;base64,PHN2Zy8+' },
        { id: 'f_avatar_bad_html', key: 'avatar_bad_html', label: 'HTML', kind: 'text', value: 'data:text/html,<script>alert(7)</script>' },
        { id: 'f_avatar_ok', key: 'avatar_ok', label: 'SAFE_URL', kind: 'text', value: 'https://example.com/sheet?a=1&b=2' },
      );

      const html = generateSingleFilePureHtml(tainted, 'pt-BR');

      // Positive assertions
      const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
      expect(cspMatch).not.toBeNull();
      const csp = cspMatch![1];
      expect(csp).toContain("default-src 'none'");
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).not.toContain('script-src');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
      expect(html).toContain('&lt;svg/onload=alert(3)&gt;');
      expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(4)\\u003c/script\\u003e');
      expect(html).toContain('href="https://example.com/sheet?a=1&amp;b=2"');
      expect(escapeHtml(`'&"<>/`)).toBe('&#39;&amp;&quot;&lt;&gt;/');

      // Negative assertions (no raw executable XSS or protocol links)
      expect(html).not.toContain('<script>alert(');
      expect(html).not.toContain('<img src=x onerror=alert(2)>');
      expect(html).not.toContain('<svg/onload=alert(3)>');
      expect(html).not.toContain('href="javascript:');
      expect(html).not.toContain('href="JaVaScRiPt:');
      expect(html).not.toContain('href="vbscript:');
      expect(html).not.toContain('href="data:text/html');
      expect(html).not.toContain('href="data:image/svg+xml');

      // Embedded JSON script block must not close prematurely
      const embeddedScriptMatch = html.match(
        /<script type="application\/json" id="gridsheet-data">([\s\S]*?)<\/script>/,
      );
      expect(embeddedScriptMatch).not.toBeNull();
      expect(() => JSON.parse(embeddedScriptMatch![1])).not.toThrow();
    });
  });

  describe('2. Anti-DoS & Formula Sandbox (formula.ts)', () => {
    it('blocks direct and indirect circular references cleanly', () => {
      const direct = evaluateFormula('a + 1', {}, false, {
        formulaMap: { a: 'a + 1' },
        visited: new Set(['a']),
      });
      expect(direct.ok).toBe(false);
      expect(direct.error).toMatch(/circular/i);

      const indirectSheet: CharacterSheetState = {
        id: 'sheet_cycle_3',
        systemId: 'blank',
        systemName: 'CUSTOM',
        systemCode: '/TEST',
        characterName: 'Cycle3',
        revision: 1,
        updatedAt: '2026-11-24T00:00:00Z',
        deviceId: 'dev_sec',
        rollLogs: [],
        cards: [
          {
            id: 'c_cycle',
            tab: 'geral',
            code: '//CYCLE',
            title: 'CYCLE',
            colSpan: 1,
            fields: [
              { id: 'f_a', key: 'a', label: 'A', kind: 'calculated', formula: 'b + 1' },
              { id: 'f_b', key: 'b', label: 'B', kind: 'calculated', formula: 'c + 1' },
              { id: 'f_c', key: 'c', label: 'C', kind: 'calculated', formula: 'a + 1' },
            ],
          },
        ],
      };
      const evalRes = evaluateSheet(indirectSheet);
      for (const fid of ['f_a', 'f_b', 'f_c']) {
        expect(evalRes.computedByFieldId[fid]?.ok).toBe(false);
        expect(evalRes.computedByFieldId[fid]?.error).toMatch(/circular/i);
      }
    });

    it('enforces MAX_RECURSION_DEPTH across nested parens, unary chains, and formula chains', () => {
      const deepParens = '('.repeat(MAX_RECURSION_DEPTH + 4) + '1' + ')'.repeat(MAX_RECURSION_DEPTH + 4);
      expect(evaluateFormula(deepParens, {}).ok).toBe(false);

      const deepUnary = '-'.repeat(MAX_RECURSION_DEPTH + 4) + '1';
      const unaryRes = evaluateFormula(deepUnary, {});
      expect(unaryRes.ok).toBe(false);
      expect(unaryRes.error).toMatch(/recurs/i);

      const deepChain: Record<string, string> = {};
      for (let i = 0; i <= MAX_RECURSION_DEPTH + 2; i += 1) {
        deepChain[`v${i}`] = i === MAX_RECURSION_DEPTH + 2 ? '1' : `v${i + 1} + 1`;
      }
      const chainRes = evaluateFormula('v1', {}, false, {
        formulaMap: deepChain,
        visited: new Set(['v0']),
      });
      expect(chainRes.ok).toBe(false);
      expect(chainRes.error).toMatch(/recurs/i);
    });

    it('blocks dice explosions, oversized formulas (50KB), and arithmetic overflows under 100ms', () => {
      const start = performance.now();

      const cases = [
        '500000d20',
        '999999d10',
        '10000d100000',
        '1d100000',
        '100d10 + 100d10',
        'pool(500000, 6)',
        '1d6+'.repeat(12500) + '1d6',
      ];
      for (const expr of cases) {
        const res = rollDiceExpression(expr, {});
        expect(res.ok).toBe(false);
        expect(res.rolls.length).toBeLessThanOrEqual(MAX_DICE_COUNT);
      }

      const longFormula = '1+'.repeat(25000) + '1';
      expect(longFormula.length).toBeGreaterThan(MAX_FORMULA_LENGTH);
      const longEval = evaluateFormula(longFormula, {});
      expect(longEval.ok).toBe(false);

      const overflowRes = evaluateFormula('1e308 * 1e308', {});
      expect(overflowRes.ok).toBe(false);
      expect(MAX_DICE_COUNT).toBeLessThanOrEqual(100);

      const elapsedMs = performance.now() - start;
      expect(elapsedMs).toBeLessThan(100);
    });
  });

  describe('3. Anti-Prototype Pollution & Schema Abuse (sheetModel.ts)', () => {
    it('rejects __proto__, constructor, and prototype keys at every nested level without polluting Object.prototype', () => {
      const base = createWorldOfDarknessV5Sheet();
      const baseJson = JSON.stringify(base);

      const attacks: string[] = [
        `{"__proto__":{"polluted":true},"systemName":"A","systemCode":"B","characterName":"C","cards":[]}`,
        `{"constructor":{"prototype":{"polluted":true}},"systemName":"A","systemCode":"B","characterName":"C","cards":[]}`,
        baseJson.replace('"cards":[', '"cards":[{"__proto__":{"polluted":true},"id":"c_bad","tab":"geral","code":"//X","title":"X","colSpan":1,"fields":[]},'),
        baseJson.replace('"fields":[', '"fields":[{"__proto__":{"polluted":true},"id":"f_bad","key":"bad","label":"BAD","kind":"text"},'),
        baseJson.replace('"touchstones":[', '"touchstones":[{"constructor":{"prototype":{"polluted":true}},"id":"t_bad","conviction":"x","touchstone":"y"},'),
        baseJson.replace('"meritsFlaws":[', '"meritsFlaws":[{"prototype":{"polluted":true},"id":"m_bad","kind":"merit","name":"x","rating":1},'),
        baseJson.replace('"havens":[', '"havens":[{"__proto__":{"polluted":true},"id":"h_bad","name":"x","rating":1,"traits":[]},'),
        `{"sheets":[${baseJson.replace('"cards":[', '"cards":[{"__proto__":{"polluted":true},"id":"c_b","tab":"geral","code":"//B","title":"B","colSpan":1,"fields":[]},')}]}`,
      ];

      for (const raw of attacks) {
        const res = parseAndValidateImportPayload(raw);
        expect(res.valid).toBe(false);
        expect(res.errors.join(' ')).toMatch(/proibida|Prototype Pollution|__proto__|constructor|prototype/i);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      }
    });

    it('enforces additionalProperties: false, numeric bounds, and payload byte limits', () => {
      const base = createWorldOfDarknessV5Sheet();

      const extraRoot = { ...base, unexpectedProp: 'evil' };
      expect(validateSheetPayload(extraRoot).valid).toBe(false);

      const badBounds = {
        ...base,
        stains: 99,
        bloodPool: 999,
        meritsFlaws: [{ id: 'mf_bad', kind: 'merit' as const, name: 'Test', rating: -5 }],
        cards: base.cards.map((c) =>
          c.id === 'card_identidade'
            ? {
                ...c,
                fields: c.fields.map((f) =>
                  f.id === 'f_blood_potency' ? { ...f, kind: 'number' as const, value: 999 } : f,
                ),
              }
            : c,
        ),
      };
      const boundsRes = validateSheetPayload(badBounds);
      expect(boundsRes.valid).toBe(false);
      expect(boundsRes.errors.join(' ')).toContain('$.stains');
      expect(boundsRes.errors.join(' ')).toContain('$.bloodPool');
      expect(boundsRes.errors.join(' ')).toContain('$.meritsFlaws[0].rating');
      expect(boundsRes.errors.join(' ')).toContain('blood_potency');

      const oversized = ' '.repeat(MAX_IMPORT_PAYLOAD_BYTES + 16);
      const oversizeRes = parseAndValidateImportPayload(oversized);
      expect(oversizeRes.valid).toBe(false);
      expect(oversizeRes.errors[0]).toMatch(/2 MB/i);
    });
  });

  describe('4. Sync Server Hardening & Auth Helpers (server.ts & roomSync.ts)', () => {
    it('validates Bearer tokens with timingSafeEqual without RangeError or token leaks', () => {
      expect(verifySyncBearerToken(undefined, SYNC_TOKEN)).toBe(false);
      expect(verifySyncBearerToken('Basic abc', SYNC_TOKEN)).toBe(false);
      expect(verifySyncBearerToken('Bearer short', SYNC_TOKEN)).toBe(false);
      expect(verifySyncBearerToken(`Bearer ${'x'.repeat(SYNC_TOKEN.length + 7)}`, SYNC_TOKEN)).toBe(false);

      const wrongSameLen = (SYNC_TOKEN[0] === 'a' ? 'b' : 'a') + SYNC_TOKEN.slice(1);
      expect(verifySyncBearerToken(`Bearer ${wrongSameLen}`, SYNC_TOKEN)).toBe(false);
      expect(verifySyncBearerToken(`Bearer ${SYNC_TOKEN}`, SYNC_TOKEN)).toBe(true);

      const runAuthCheck = (authHeader?: string) => {
        let status = 200;
        let body: unknown = null;
        let nextCalled = false;
        requireSyncAuth(
          { header: () => authHeader } as unknown as Parameters<typeof requireSyncAuth>[0],
          {
            status(code: number) {
              status = code;
              return this;
            },
            json(payload: unknown) {
              body = payload;
              return this;
            },
          } as unknown as Parameters<typeof requireSyncAuth>[1],
          () => {
            nextCalled = true;
          },
        );
        return { status, body, nextCalled };
      };

      const missingRes = runAuthCheck(undefined);
      expect(missingRes.status).toBe(401);
      expect(missingRes.nextCalled).toBe(false);
      expect(JSON.stringify(missingRes.body)).not.toContain(SYNC_TOKEN);

      const diffLenRes = runAuthCheck('Bearer wrong-length');
      expect(diffLenRes.status).toBe(401);
      expect(diffLenRes.nextCalled).toBe(false);

      const wrongSameLenRes = runAuthCheck(`Bearer ${wrongSameLen}`);
      expect(wrongSameLenRes.status).toBe(401);
      expect(wrongSameLenRes.nextCalled).toBe(false);
      expect(JSON.stringify(wrongSameLenRes.body)).not.toContain(SYNC_TOKEN);

      const validRes = runAuthCheck(`Bearer ${SYNC_TOKEN}`);
      expect(validRes.status).toBe(200);
      expect(validRes.nextCalled).toBe(true);
    });

    it('enforces bind host, CORS allowlist, security headers, and Prototype Pollution rejection on sync bodies', () => {
      expect(resolveBindHost({})).toBe('127.0.0.1');
      expect(resolveBindHost({ ALLOW_LAN_SYNC: 'false' })).toBe('127.0.0.1');
      expect(resolveBindHost({ ALLOW_LAN_SYNC: 'true' })).toBe('0.0.0.0');
      expect(resolveAllowedCorsOrigins('*, http://localhost:5173, https://sync.local')).toEqual([
        'http://localhost:5173',
        'https://sync.local',
      ]);

      const headers: Record<string, string> = {};
      let headerNext = false;
      applySecurityHeaders(
        { path: '/api/sync/sheet_1' } as unknown as Parameters<typeof applySecurityHeaders>[0],
        {
          setHeader(k: string, v: string) {
            headers[k] = v;
          },
        } as unknown as Parameters<typeof applySecurityHeaders>[1],
        () => {
          headerNext = true;
        },
      );
      expect(headerNext).toBe(true);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Cache-Control']).toBe('no-store');

      const pollutedBody = JSON.parse('{"__proto__":{"polluted":true},"sheet":{}}') as unknown;
      expect(hasDangerousObjectKeys(pollutedBody)).toBe(true);
      expect(findDangerousKeyPath(pollutedBody)).toBe('$.__proto__');

      let ppStatus = 200;
      let ppBody: Record<string, unknown> | undefined;
      let ppNext = false;
      rejectPrototypePollutionBody(
        { body: pollutedBody } as unknown as Parameters<typeof rejectPrototypePollutionBody>[0],
        {
          status(code: number) {
            ppStatus = code;
            return this;
          },
          json(payload: Record<string, unknown>) {
            ppBody = payload;
            return this;
          },
        } as unknown as Parameters<typeof rejectPrototypePollutionBody>[1],
        () => {
          ppNext = true;
        },
      );
      expect(ppStatus).toBe(400);
      expect(ppNext).toBe(false);
      expect(ppBody).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });

      const canonical = toCanonicalSheet(createWorldOfDarknessV5Sheet());
      const pollutedCanonical = JSON.parse(
        JSON.stringify(canonical).replace('"tabs":[', '"tabs":[{"__proto__":{"polluted":true},"id":"t","title":"T","cards":[]},'),
      ) as unknown;
      expect(validateCanonicalSheetPayload(pollutedCanonical).ok).toBe(false);
      expect(validateWorkspaceMirrorInput(pollutedBody).ok).toBe(false);
    });
  });

  describe('5. PDF/OCR Worker Resilience & Anti-OOM (pdfIndexer.worker.ts)', () => {
    it('caps rasterization width at 1600px, reuses one Tesseract worker, always terminates it, and fails fast on scanned PDFs', async () => {
      expect(computeOcrRenderScale(3200, 1600)).toBeLessThanOrEqual(0.5);
      expect(computeOcrRenderScale(800, 1600)).toBeLessThanOrEqual(2.5);

      let createdCount = 0;
      let terminateCount = 0;
      let recognizedPages = 0;
      const emitted: PdfIndexWorkerResponse[] = [];

      const mockPdfDoc = {
        numPages: 3,
        async getPage(pageNum: number) {
          return {
            pageNumber: pageNum,
            cleanup() {},
          };
        },
        async cleanup() {},
      };

      const fakeWorker: OcrWorkerLike = {
        async recognize() {
          recognizedPages += 1;
          return { data: { text: `Page ${recognizedPages}` } };
        },
        async terminate() {
          terminateCount += 1;
        },
      };

      await runOcrIndexingPipeline(
        {
          buffer: new ArrayBuffer(16),
          bookTitle: 'Core Rules',
          systemId: 'wod',
          lang: 'eng',
          jobId: 'job_ok',
          bookId: 'book_ok',
        },
        {
          createOcrWorker: async () => {
            createdCount += 1;
            return fakeWorker;
          },
          postMessage: (msg) => emitted.push(msg),
          renderPageToImage: async () => new Uint8Array([1, 2, 3]) as unknown as Blob,
          loadPdfDocument: () => ({
            promise: Promise.resolve(mockPdfDoc as unknown as never),
            destroy: async () => {},
          }),
        },
      );

      expect(createdCount).toBe(1);
      expect(recognizedPages).toBe(3);
      expect(terminateCount).toBe(1);
      expect(emitted.some((m) => m.type === 'complete')).toBe(true);

      // Abort path still calls worker.terminate() in finally
      let aborted = false;
      let abortTerminateCount = 0;
      const abortEmitted: PdfIndexWorkerResponse[] = [];
      await runOcrIndexingPipeline(
        {
          buffer: new ArrayBuffer(16),
          bookTitle: 'Abort Book',
          systemId: 'wod',
          lang: 'eng',
          jobId: 'job_abort',
          bookId: 'book_abort',
        },
        {
          createOcrWorker: async () => ({
            async recognize() {
              aborted = true;
              return { data: { text: 'Page 1' } };
            },
            async terminate() {
              abortTerminateCount += 1;
            },
          }),
          shouldAbort: () => aborted,
          postMessage: (msg) => abortEmitted.push(msg),
          renderPageToImage: async () => new Uint8Array([1]) as unknown as Blob,
          loadPdfDocument: () => ({
            promise: Promise.resolve(mockPdfDoc as unknown as never),
            destroy: async () => {},
          }),
        },
      );

      expect(abortTerminateCount).toBe(1);
      expect(abortEmitted.some((m) => m.type === 'aborted')).toBe(true);

      // Fail-fast heuristic triggers on first 10 blank pages without reading pages 11..50
      let pagesRead = 0;
      await expect(
        extractPdfPagesWithFailFast({
          totalPages: 50,
          readPageText: () => {
            pagesRead += 1;
            return '';
          },
        }),
      ).rejects.toBeInstanceOf(ScannedPdfNoOcrError);
      expect(pagesRead).toBe(10);
    });
  });
});
