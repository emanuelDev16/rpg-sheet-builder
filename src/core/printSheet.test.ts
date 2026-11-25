import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrintDocumentTitle,
  getActiveTabSectionLabel,
  getTabLabelsForSystem,
  printActiveSheetView,
} from './printSheet';
import {
  adjustSheetHumanityStains,
  adjustV5WillpowerDamage,
  createCyberpunkPreset,
  createDnd5ePreset,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
} from './sheetModel.ts';
import { generateSingleFilePureHtml } from './pureHtmlExporter.ts';

test('getTabLabelsForSystem and getActiveTabSectionLabel match system and active tab', () => {
  assert.deepEqual(getTabLabelsForSystem('wod'), {
    tab1: '/01 ATRIBUTOS & COMBATE',
    tab2: '/02 DISCIPLINAS & NOTAS',
    tab3: '/03 XP & MELHORIAS',
  });
  assert.equal(getActiveTabSectionLabel('dnd5e', 'magias'), '/02 MAGIAS & NOTAS');
  assert.equal(getActiveTabSectionLabel('dnd5e', 'magias', 'en'), '/02 SPELLS & NOTES');
  assert.equal(getActiveTabSectionLabel('blank', 'geral'), '/01 FICHA PRINCIPAL');
  assert.equal(getActiveTabSectionLabel('wod', 'xp'), '/03 XP & MELHORIAS');
});

test('buildPrintDocumentTitle produces a clean OS-safe PDF filename title', () => {
  const wod = createWorldOfDarknessSheet();
  const title = buildPrintDocumentTitle(wod, 'geral');
  assert.equal(title, 'GRID_SHEET-JULIAN_CROSS_NEONATE_VENTRUE-01_ATRIBUTOS_COMBATE');

  const titleEn = buildPrintDocumentTitle(wod, 'geral', 'en');
  assert.equal(titleEn, 'GRID_SHEET-JULIAN_CROSS_NEONATE_VENTRUE-01_ATTRIBUTES_COMBAT');

  const dnd = createDnd5ePreset();
  const xpTitle = buildPrintDocumentTitle(dnd, 'xp');
  assert.equal(xpTitle, 'GRID_SHEET-LYRA_VANCE_ELDRITCH_KNIGHT_LV_5-03_XP_MELHORIAS');
});

test('printActiveSheetView sets PDF title, invokes print, and restores previous title on afterprint', () => {
  const wod = createWorldOfDarknessSheet();
  const mockDoc = { title: 'GRID//SHEET' };
  const listeners: Record<string, Array<() => void>> = {};
  let printed = false;
  let titleDuringPrint = '';

  const mockWin = {
    print: () => {
      printed = true;
      titleDuringPrint = mockDoc.title;
    },
    addEventListener: (event: string, cb: () => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: () => void) => {
      listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
    },
    setTimeout: (() => 0) as unknown as typeof window.setTimeout,
  };

  const result = printActiveSheetView(wod, 'magias', { doc: mockDoc, win: mockWin });
  assert.equal(result.ok, true);
  assert.equal(printed, true);
  assert.equal(titleDuringPrint, 'GRID_SHEET-JULIAN_CROSS_NEONATE_VENTRUE-02_DISCIPLINAS_NOTAS');
  assert.equal(mockDoc.title, titleDuringPrint);

  // Simulate browser afterprint event
  for (const cb of listeners['afterprint'] || []) cb();
  assert.equal(mockDoc.title, 'GRID//SHEET');

  const enResult = printActiveSheetView(wod, 'magias', { doc: mockDoc, win: mockWin, lang: 'en' });
  assert.equal(enResult.ok, true);
  assert.equal(enResult.documentTitle, 'GRID_SHEET-JULIAN_CROSS_NEONATE_VENTRUE-02_DISCIPLINES_NOTES');
});

test('generateSingleFilePureHtml renders full V5 parity: DotRating, stains, Willpower V5 IMPAIRED, Blood Potency, touchstones, meritsFlaws, havens, and print CSS', () => {
  let v5 = createWorldOfDarknessV5Sheet();
  v5 = adjustSheetHumanityStains(v5, 2).sheet;
  // Set Blood Potency to 3 and add a skill specialty hint
  v5 = {
    ...v5,
    cards: v5.cards.map((card) => {
      if (card.id === 'card_identidade') {
        return {
          ...card,
          fields: card.fields.map((f) =>
            f.id === 'f_blood_potency'
              ? { id: 'f_blood_potency', key: 'blood_potency', label: 'BLOOD_POTENCY', kind: 'number' as const, value: 3, max: 10 }
              : f,
          ),
        };
      }
      if (card.id === 'card_skills') {
        return {
          ...card,
          fields: card.fields.map((f) =>
            f.key === 'subterfuge' ? { ...f, hint: 'Seduction', rollSpecialty: true } : f,
          ),
        };
      }
      return card;
    }),
  };
  // Composure 3 + Resolve 2 = max 5 Willpower -> fill 1 aggravated + 4 superficial => IMPAIRED (-2)
  v5 = adjustV5WillpowerDamage(v5, 'aggravated', 1);
  v5 = adjustV5WillpowerDamage(v5, 'superficial', 4);

  const html = generateSingleFilePureHtml(v5, 'pt-BR');

  assert.match(html, /●/);
  assert.match(html, /○/);
  assert.match(html, /data-testid="pure-html-v5-bp"/);
  assert.match(html, /POTÊNCIA DE SANGUE · NV 3/);
  assert.match(html, /SEVERIDADE 3/);
  assert.match(html, /data-testid="pure-html-v5-humanity"/);
  assert.match(html, /7 \/ 10 · 2 MANCHAS/);
  assert.match(html, /data-testid="pure-html-v5-willpower"/);
  assert.match(html, /IMPAIRED \(-2\)/);
  assert.match(html, /Seduction/);
  assert.match(html, /data-testid="pure-html-touchstones"/);
  assert.match(html, /Mateo Voss/);
  assert.match(html, /data-testid="pure-html-merits-flaws"/);
  assert.match(html, /\+2 QUALIDADES · -1 DEFEITOS/);
  assert.match(html, /data-testid="pure-html-havens"/);
  assert.match(html, /Harbor Sub-Vault/);
  assert.match(html, /Saída Secreta/);
  assert.match(html, /@media print/);
  assert.match(html, /break-inside:\s*avoid/);
});

test('generateSingleFilePureHtml renders V20 3x3 attributes, Blood Pool, Virtues, meritsFlaws, havens, and keeps non-WoD presets clean', () => {
  const v20 = createWorldOfDarknessSheet();
  const v20Html = generateSingleFilePureHtml(v20, 'en');

  assert.match(v20Html, /wod-attr-grid-3x3/);
  assert.match(v20Html, /data-testid="pure-html-v20-health"/);
  assert.match(v20Html, /data-testid="pure-html-v20-blood-pool"/);
  assert.match(v20Html, /data-testid="pure-html-v20-virtues"/);
  assert.match(v20Html, /data-testid="pure-html-merits-flaws"/);
  assert.match(v20Html, /data-testid="pure-html-havens"/);
  assert.doesNotMatch(v20Html, /data-testid="pure-html-touchstones"/);
  assert.doesNotMatch(v20Html, /data-testid="pure-html-v5-bp"/);

  const dndHtml = generateSingleFilePureHtml(createDnd5ePreset(), 'en');
  assert.doesNotMatch(dndHtml, /data-testid="pure-html-v5-bp"/);
  assert.doesNotMatch(dndHtml, /data-testid="pure-html-touchstones"/);
  assert.doesNotMatch(dndHtml, /data-testid="pure-html-v20-blood-pool"/);
});

test('generateSingleFilePureHtml escapes XSS payloads across touchstones, meritsFlaws, havens, and WoD identity fields while preserving CSP', () => {
  const imgXss = '<img src=x onerror=alert(1)>';
  const scriptXss = '</script><script>alert(1)</script>';
  const base = createWorldOfDarknessV5Sheet();

  const tainted = {
    ...base,
    cards: base.cards.map((card) =>
      card.id === 'card_identidade'
        ? {
            ...card,
            fields: card.fields.map((f) => {
              if (f.key === 'clan_bane') return { ...f, value: imgXss };
              if (f.key === 'clan_compulsion') return { ...f, value: scriptXss };
              if (f.key === 'predator_type') return { ...f, value: imgXss };
              if (f.key === 'concept') return { ...f, value: scriptXss };
              if (f.key === 'sire') return { ...f, value: imgXss };
              if (f.key === 'chronicle') return { ...f, value: scriptXss };
              return f;
            }),
          }
        : card,
    ),
    touchstones: [
      {
        id: 'ts_xss',
        conviction: imgXss,
        touchstone: scriptXss,
        notes: `${imgXss} ${scriptXss}`,
      },
    ],
    meritsFlaws: [
      {
        id: 'mf_xss',
        kind: 'flaw' as const,
        name: imgXss,
        rating: 2,
        notes: scriptXss,
      },
    ],
    havens: [
      {
        id: 'hv_xss',
        name: scriptXss,
        location: imgXss,
        rating: 3,
        traits: [imgXss, scriptXss],
        notes: imgXss,
      },
    ],
  };

  const html = generateSingleFilePureHtml(tainted, 'en');

  assert.equal(
    html.includes(
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src https: data:; font-src https: data:;" />',
    ),
    true,
  );
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
  assert.equal(html.includes('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(html.includes('\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e'), true);
});

test('generateSingleFilePureHtml renders multi-page A4 paper sheets across all tabs for V5, V20, D&D 5e, and Cyberpunk', () => {
  const v5Base = createWorldOfDarknessV5Sheet();
  const v5Custom = {
    ...v5Base,
    cards: [
      ...v5Base.cards,
      {
        id: 'card_custom_all_tabs',
        tab: 'xp' as const,
        code: '//CUSTOM_XP',
        title: 'Aliados Extras',
        colSpan: 1 as const,
        fields: [{ id: 'f_aliado_ext', key: 'aliado_ext', label: 'Contato Porto', kind: 'text' as const, value: 'Cap. Helena' }],
      },
    ],
  };
  const v5Html = generateSingleFilePureHtml(v5Custom, 'pt-BR');
  assert.match(v5Html, /data-paper-layout="wod-v5"/);
  assert.match(v5Html, /data-paper-page="1"/);
  assert.match(v5Html, /data-paper-page="2"/);
  assert.match(v5Html, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*8mm;/);
  assert.match(v5Html, /break-after:\s*page/);
  assert.match(v5Html, /Elysium meeting confirmed/);
  assert.match(v5Html, /Aliados Extras/);
  assert.match(v5Html, /Cap\. Helena/);

  const v20Html = generateSingleFilePureHtml(createWorldOfDarknessSheet(), 'en');
  assert.match(v20Html, /data-paper-layout="wod-v20"/);
  assert.match(v20Html, /data-paper-page="1"/);
  assert.match(v20Html, /data-paper-page="2"/);
  assert.match(v20Html, /Talents/);
  assert.match(v20Html, /Knowledges/);
  assert.match(v20Html, /-5/);

  const dnd = createDnd5ePreset();
  const dndHtml = generateSingleFilePureHtml(dnd, 'en');
  assert.match(dndHtml, /data-paper-layout="dnd5e"/);
  assert.match(dndHtml, /data-paper-page="1"/);
  assert.match(dndHtml, /data-paper-page="2"/);
  assert.match(dndHtml, /data-paper-page="3"/);
  assert.match(dndHtml, /SPELL SAVE DC/);

  const dndMartialHtml = generateSingleFilePureHtml(
    { ...dnd, cards: dnd.cards.filter((c) => c.id !== 'card_arcano' && c.id !== 'card_grimorio') },
    'en',
  );
  assert.match(dndMartialHtml, /data-paper-page="2"/);
  assert.doesNotMatch(dndMartialHtml, /data-paper-page="3"/);

  const cyberHtml = generateSingleFilePureHtml(createCyberpunkPreset(), 'pt-BR');
  assert.match(cyberHtml, /data-paper-layout="generic"/);
  assert.match(cyberHtml, /data-paper-page="1"/);
  assert.match(cyberHtml, /data-paper-page="2"/);
});
