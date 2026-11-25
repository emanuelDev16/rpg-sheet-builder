import { type AppLanguage, getTranslations, LANGUAGE_OPTIONS } from './i18n.ts';
import {
  buildPaperSheetModel,
  type PaperDotRow,
  type PaperDnd5eModel,
  type PaperExtraCard,
  type PaperFieldItem,
  type PaperSheetModel,
  type PaperTrack,
  type PaperWodV20Model,
  type PaperWodV5Model,
  type PaperXpSummary,
} from './paperSheetModel.ts';
import { type CharacterSheetState } from './sheetModel.ts';

export const QSS_VARIABLES_GUIDE = `/* ==========================================================================
   TOKENS DE ESTILO — BURGUNDY WINE + SOFT CREAM + DEEP BLACK (PYSIDE6 / QSS)
   Substitua os tokens abaixo nos seletores QWidget / QFrame / QPushButton.
   ========================================================================== */
:root {
  /* Superfícies (Soft Cream) */
  --bg-canvas: #F8F1E7;
  --bg-card: #FFFDF9;
  --bg-card-alt: #F3E9DB;
  --bg-header-strip: #EFE3D2;

  /* Bordas & Estrutura Bento (Deep Black) */
  --border-ink: #0B0B0B;
  --border-subtle: #DFD2C0;
  --border-width: 1.5px;
  --border-width-strong: 2px;
  --radius-card: 10px;
  --radius-control: 6px;

  /* Tipografia & Tinta */
  --ink-primary: #0B0B0B;
  --ink-secondary: #3D332D;
  --ink-muted: #574D45;
  --ink-inverse: #F8F1E7;
  --font-display: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  --font-mono: 'JetBrains Mono', 'Consolas', monospace;
  --font-ui: 'DM Sans', 'Segoe UI', sans-serif;

  /* Destaques (Burgundy Wine & Deep Black) */
  --accent-black: #0B0B0B;
  --accent-wine: #5B0F18;
  --accent-wine-soft: #E9D7D6;
  --accent-cream-badge: #EFE3D2;
  --accent-danger: #B91C1C;
}`;

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DATA_IMAGE_BASE64_REGEX = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i;

export function sanitizeUrl(raw: string): string {
  if (typeof raw !== 'string') return '';
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (DATA_IMAGE_BASE64_REGEX.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Reject malformed or dangerous URLs (javascript:, vbscript:, data:text/html, data:image/svg+xml, etc.)
  }
  return '';
}

export function serializeSafeEmbeddedJson(data: unknown): string {
  const raw = JSON.stringify(data) ?? 'null';
  return raw
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const EXPORT_CSP_CONTENT =
  "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:;";

const WOD_ORNAMENT_SVG = `<svg class="paper-wod-ornament" viewBox="0 0 180 12" aria-hidden="true"><line x1="0" y1="6" x2="72" y2="6" stroke="currentColor" stroke-width="1"/><polygon points="90,1 96,6 90,11 84,6" fill="currentColor"/><circle cx="77" cy="6" r="1.6" fill="currentColor"/><circle cx="103" cy="6" r="1.6" fill="currentColor"/><line x1="108" y1="6" x2="180" y2="6" stroke="currentColor" stroke-width="1"/></svg>`;

const DND_SHIELD_SVG = `<svg class="paper-ac-shield" viewBox="0 0 48 54" aria-hidden="true"><path d="M24 2 L44 9 V25 C44 38 35 47 24 52 C13 47 4 38 4 25 V9 Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

function renderDotsHtml(value: number, max: 5 | 10): string {
  const clamped = Math.max(0, Math.min(max, Math.round(value)));
  const pips = Array.from({ length: max }, (_, idx) => {
    const filled = idx < clamped;
    return `<span class="paper-dot ${filled ? 'filled' : 'empty'}">${filled ? '●' : '○'}</span>`;
  }).join('');
  return `<span class="paper-dots" aria-label="${escapeHtml(`${clamped} / ${max}`)}">${pips}</span>`;
}

function renderDotListHtml(items: PaperDotRow[]): string {
  return items
    .map(
      (item) => `<div class="paper-dot-row">
        <span class="paper-dot-label-wrap">
          <span class="paper-dot-label">${escapeHtml(item.label)}</span>
          ${item.specialty ? `<span class="paper-specialty">(${escapeHtml(item.specialty)})</span>` : ''}
        </span>
        ${renderDotsHtml(item.value, item.max)}
      </div>`,
    )
    .join('');
}

function renderTrackHtml(track: PaperTrack): string {
  const testIdAttr = track.testId ? ` data-testid="${escapeHtml(track.testId)}"` : '';
  const badgeHtml = track.badge ? ` <span class="paper-badge">${escapeHtml(track.badge)}</span>` : '';
  const bodyHtml = track.isContinuous
    ? `<div class="paper-cont-track"><div class="paper-cont-fill" style="width:${(track.pct ?? 0).toFixed(1)}%"></div><span class="tick t25"></span><span class="tick t50"></span><span class="tick t75"></span></div>`
    : `<div class="paper-boxes-row">${track.boxes
        .map(
          (b) =>
            `<span class="paper-box paper-box--${escapeHtml(b.kind)}"${
              b.title ? ` title="${escapeHtml(b.title)}"` : ''
            }>${escapeHtml(b.symbol)}</span>`,
        )
        .join('')}</div>`;
  const legendHtml = track.legend ? `<div class="paper-legend">${escapeHtml(track.legend)}</div>` : '';
  return `<div class="paper-track-block paper-block"${testIdAttr}>
    <div class="paper-track-head"><span>${escapeHtml(track.label)}${badgeHtml}</span><span>${escapeHtml(track.summary)}</span></div>
    ${bodyHtml}
    ${legendHtml}
  </div>`;
}

function renderFieldItemHtml(field: PaperFieldItem): string {
  if (field.kind === 'dots' && field.dots) {
    return `<div class="paper-dot-row"><span class="paper-dot-label">${escapeHtml(field.label)}</span>${renderDotsHtml(field.dots.value, field.dots.max)}</div>`;
  }
  if (field.kind === 'resource' && field.track) {
    return renderTrackHtml(field.track);
  }
  if (field.kind === 'repeatable' && field.table) {
    const rows = field.table.rows
      .map((r) => `<tr><td>${escapeHtml(r.col1)}</td><td>${escapeHtml(r.col2)}</td></tr>`)
      .join('');
    return `<div class="paper-block">
      <div class="paper-track-head"><span>${escapeHtml(field.label)}</span>${
        field.table.cargoBadge ? `<span>${escapeHtml(field.table.cargoBadge)}</span>` : ''
      }</div>
      <table class="paper-table">
        <thead><tr><th>${escapeHtml(field.table.col1Header)}</th><th>${escapeHtml(field.table.col2Header)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }
  const safeUrl = field.rawUrl ? sanitizeUrl(field.rawUrl) : '';
  const linkHtml = safeUrl
    ? ` <a class="paper-link" href="${escapeHtml(safeUrl)}" rel="noopener noreferrer">↗</a>`
    : '';
  return `<div class="paper-dot-row"><span class="paper-dot-label">${escapeHtml(field.label)}</span><span>${escapeHtml(field.value)}${linkHtml}</span></div>`;
}

function renderExtraCardHtml(card: PaperExtraCard): string {
  return `<section class="paper-card${card.colSpan === 2 ? ' span-2' : ''}" data-tab="${escapeHtml(card.tab)}" data-card-id="${escapeHtml(card.id)}">
    <header class="paper-card-head">
      <span class="paper-card-tag">${escapeHtml(card.code)}</span>
      <h3 class="paper-card-title">${escapeHtml(card.title)}</h3>
    </header>
    <div>${card.fields.map(renderFieldItemHtml).join('')}</div>
  </section>`;
}

function renderXpSectionHtml(xp: PaperXpSummary, labels: PaperSheetModel['labels']): string {
  const rows = xp.recentEntries
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.label)}</td><td>${escapeHtml(e.delta >= 0 ? `+${e.delta}` : String(e.delta))}</td></tr>`,
    )
    .join('');
  return `<div class="paper-block">
    <div class="paper-sec-rule">${escapeHtml(labels.xpSection)}</div>
    <div class="paper-xp-row">
      <span>${escapeHtml(labels.xpTotal)}: ${escapeHtml(String(xp.totalEarned))}</span>
      <span>${escapeHtml(labels.xpSpent)}: ${escapeHtml(String(xp.spent))}</span>
      <span>${escapeHtml(labels.xpAvailable)}: ${escapeHtml(String(xp.available))}</span>
    </div>
    ${rows ? `<table class="paper-table"><tbody>${rows}</tbody></table>` : ''}
  </div>`;
}

function renderRollLogsHtml(model: PaperSheetModel): string {
  if (model.rollLogs.length === 0) return '';
  const rows = model.rollLogs
    .map(
      (log) =>
        `<tr><td>${escapeHtml(log.label)}</td><td>${escapeHtml(log.timestamp)}</td><td><strong>${escapeHtml(String(log.total))}</strong></td><td>${escapeHtml(log.breakdown)}</td></tr>`,
    )
    .join('');
  return `<div class="paper-block">
    <div class="paper-sec-rule">${escapeHtml(model.labels.rollLogs)}</div>
    <table class="paper-table"><tbody>${rows}</tbody></table>
  </div>`;
}

function renderPageHeaderHtml(model: PaperSheetModel, pageNumber: number): string {
  return `<header class="paper-header">
    <div>
      <div class="paper-subtitle">${escapeHtml(model.systemName)}</div>
      <div class="paper-title">${escapeHtml(model.characterName)}</div>
    </div>
    <div class="paper-page-num">${escapeHtml(model.labels.pageLabel)} ${escapeHtml(String(pageNumber))} / ${escapeHtml(String(model.pageCount))}</div>
  </header>`;
}

function renderWodV5PagesHtml(model: PaperSheetModel, data: PaperWodV5Model): string {
  const { page1, page2 } = data;
  const { labels } = model;
  const idCells = page1.header3x3
    .map(
      (c) =>
        `<div class="paper-id-cell"><span class="paper-id-k">${escapeHtml(c.label)}</span><span class="paper-id-v">${escapeHtml(c.value || labels.emptyNone)}</span></div>`,
    )
    .join('');
  const attrs = page1.attributes3x3
    .map(
      (g) =>
        `<div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(g.title)}</div>${renderDotListHtml(g.items)}</div>`,
    )
    .join('');
  const skills = page1.skills3Col
    .map(
      (g) =>
        `<div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(g.title)}</div>${renderDotListHtml(g.items)}</div>`,
    )
    .join('');
  const convSummary = page1.middleStrip3Col.convictionsSummary.length
    ? page1.middleStrip3Col.convictionsSummary
        .map(
          (ts) =>
            `<div class="paper-dot-row"><span>${escapeHtml(ts.conviction)}</span><span class="paper-specialty">${escapeHtml(ts.touchstone)}</span></div>`,
        )
        .join('')
    : `<span>${escapeHtml(labels.emptyNone)}</span>`;
  const discs = page1.disciplines
    .map(
      (d) => `<div class="paper-disc-box">
        <div class="paper-col-head"><span>${escapeHtml(d.label)}</span>${renderDotsHtml(d.value, 5)}</div>
        ${d.slots
          .map(
            (s) =>
              `<div class="paper-disc-slot"><span>${escapeHtml(String(s.level))}. ${escapeHtml(s.name || '—')}</span>${
                s.cost ? `<span class="paper-disc-cost">${escapeHtml(s.cost)}</span>` : ''
              }</div>`,
          )
          .join('')}
      </div>`,
    )
    .join('');
  const hungerBoxes = page1.vitalColumn.hunger.boxes
    .map((b) => `<span class="paper-box paper-box--${escapeHtml(b.kind)}">${escapeHtml(b.symbol)}</span>`)
    .join('');
  const bpStats = page1.vitalColumn.bloodPotency.stats
    .map(
      (s) =>
        `<div class="paper-bp-cell"><span class="paper-bp-k">${escapeHtml(s.label)}</span><span class="paper-bp-v">${escapeHtml(s.value)}</span></div>`,
    )
    .join('');

  const p2Merits = page2.meritsFlaws.items
    .map(
      (mf) => `<div class="paper-structured-item">
        <div class="paper-dot-row"><span><span class="paper-badge">${escapeHtml(mf.badge)}</span> ${escapeHtml(mf.name)}</span>${renderDotsHtml(mf.rating, 5)}</div>
        ${mf.notes ? `<div class="paper-legend">${escapeHtml(mf.notes)}</div>` : ''}
      </div>`,
    )
    .join('');
  const p2Havens = page2.havens.items
    .map(
      (hv) => `<div class="paper-structured-item">
        <div class="paper-dot-row"><span>${escapeHtml(hv.name)}${hv.location ? ` · ${escapeHtml(hv.location)}` : ''}</span>${renderDotsHtml(hv.rating, 5)}</div>
        ${hv.traits.length ? `<div class="paper-legend">${hv.traits.map((tr) => escapeHtml(tr.label)).join(' · ')}</div>` : ''}
        ${hv.notes ? `<div class="paper-legend">${escapeHtml(hv.notes)}</div>` : ''}
      </div>`,
    )
    .join('');
  const p2Touch = page2.touchstones.items
    .map(
      (ts) => `<div class="paper-structured-item">
        <div class="paper-dot-row"><strong>${escapeHtml(ts.conviction)}</strong><span class="paper-badge">${escapeHtml(ts.touchstone)}</span></div>
        ${ts.notes ? `<div class="paper-legend">${escapeHtml(ts.notes)}</div>` : ''}
      </div>`,
    )
    .join('');

  return `
  <article class="paper-page paper-layout--wod-v5" data-paper-page="1">
    ${renderPageHeaderHtml(model, 1)}
    ${WOD_ORNAMENT_SVG}
    <div class="paper-id-grid-3x3">${idCells}</div>
    <div class="paper-sec-rule">${escapeHtml(labels.attributes)}</div>
    <div class="wod-attr-grid-3x3">${attrs}</div>
    <div class="paper-sec-rule">${escapeHtml(labels.skills)}</div>
    <div class="paper-cols-3">${skills}</div>
    <div class="paper-cols-3" style="margin-top:5px">
      <div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(labels.convictionsSummary)}</div>${convSummary}</div>
      <div class="paper-col-box paper-block"><div class="paper-col-head"><span>${escapeHtml(page1.middleStrip3Col.bane.label)}</span><span class="paper-badge">${escapeHtml(page1.middleStrip3Col.bane.severityBadge)}</span></div><div>${escapeHtml(page1.middleStrip3Col.bane.value || labels.emptyNone)}</div></div>
      <div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(page1.middleStrip3Col.compulsion.label)}</div><div>${escapeHtml(page1.middleStrip3Col.compulsion.value || labels.emptyNone)}</div></div>
    </div>
    <div class="paper-v5-bottom" style="margin-top:5px">
      <div>
        <div class="paper-sec-rule">${escapeHtml(labels.disciplines)}</div>
        <div class="paper-disc-grid">${discs}</div>
      </div>
      <div>
        <div class="paper-sec-rule">${escapeHtml(labels.health)}</div>
        ${renderTrackHtml(page1.vitalColumn.health)}
        ${renderTrackHtml(page1.vitalColumn.willpower)}
        ${renderTrackHtml(page1.vitalColumn.humanity)}
        <div class="paper-track-block paper-block">
          <div class="paper-track-head"><span>${escapeHtml(page1.vitalColumn.hunger.label)}</span><span>${escapeHtml(String(page1.vitalColumn.hunger.value))} / 5</span></div>
          <div class="paper-boxes-row">${hungerBoxes}</div>
        </div>
        <div class="paper-track-block paper-block" data-testid="${escapeHtml(page1.vitalColumn.bloodPotency.testId)}">
          <div class="paper-track-head"><span>${escapeHtml(page1.vitalColumn.bloodPotency.title)}</span>${renderDotsHtml(page1.vitalColumn.bloodPotency.level, 10)}</div>
          <div class="paper-bp-grid">${bpStats}</div>
        </div>
      </div>
    </div>
  </article>
  <article class="paper-page paper-layout--wod-v5" data-paper-page="2">
    ${renderPageHeaderHtml(model, 2)}
    <div class="paper-cols-2">
      <div>
        ${
          page2.backgrounds.length
            ? `<div class="paper-card"><div class="paper-card-head"><span class="paper-card-title">${escapeHtml(labels.backgrounds)}</span></div>${renderDotListHtml(page2.backgrounds)}</div>`
            : ''
        }
        <div class="paper-card" data-testid="${escapeHtml(page2.meritsFlaws.testId)}">
          <div class="paper-card-head"><span class="paper-card-title">${escapeHtml(page2.meritsFlaws.heading)}</span><span class="paper-badge">${escapeHtml(page2.meritsFlaws.summary)}</span></div>
          ${p2Merits}
        </div>
        <div class="paper-card" data-testid="${escapeHtml(page2.havens.testId)}">
          <div class="paper-card-head"><span class="paper-card-title">${escapeHtml(page2.havens.heading)}</span><span class="paper-badge">${escapeHtml(page2.havens.countLabel)}</span></div>
          ${p2Havens}
        </div>
      </div>
      <div>
        <div class="paper-card" data-testid="${escapeHtml(page2.touchstones.testId)}">
          <div class="paper-card-head"><span class="paper-card-title">${escapeHtml(page2.touchstones.heading)}</span><span class="paper-badge">${escapeHtml(page2.touchstones.counter)}</span></div>
          ${p2Touch}
        </div>
        ${renderXpSectionHtml(page2.xpSummary, labels)}
        ${
          page2.notes.length
            ? `<div class="paper-block"><div class="paper-sec-rule">${escapeHtml(labels.notes)}</div>${page2.notes
                .map(
                  (n) =>
                    `<div class="paper-note-box"><strong>${escapeHtml(n.label)}: </strong>${escapeHtml(n.value)}</div>`,
                )
                .join('')}</div>`
            : ''
        }
      </div>
    </div>
    ${
      page2.extraCards.length
        ? `<div class="paper-sec-rule">${escapeHtml(labels.extraSections)}</div><div class="paper-generic-grid">${page2.extraCards.map(renderExtraCardHtml).join('')}</div>`
        : ''
    }
    ${renderRollLogsHtml(model)}
  </article>`;
}

function renderWodV20PagesHtml(model: PaperSheetModel, data: PaperWodV20Model): string {
  const { page1, page2 } = data;
  const { labels } = model;
  const idCells = page1.header3x3
    .map(
      (c) =>
        `<div class="paper-id-cell"><span class="paper-id-k">${escapeHtml(c.label)}</span><span class="paper-id-v">${escapeHtml(c.value || labels.emptyNone)}</span></div>`,
    )
    .join('');
  const attrs = page1.attributes3x3
    .map(
      (g) =>
        `<div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(g.title)}</div>${renderDotListHtml(g.items)}</div>`,
    )
    .join('');
  const abilities = page1.abilities3Col
    .map(
      (g) =>
        `<div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(g.title)}</div>${renderDotListHtml(g.items)}</div>`,
    )
    .join('');
  const wpBoxes = page1.bottom3Col.willpower.boxes
    .map((b) => `<span class="paper-box paper-box--${escapeHtml(b.kind)}">${escapeHtml(b.symbol)}</span>`)
    .join('');
  const healthRows = page1.bottom3Col.health.levels
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.label)}</td><td>${escapeHtml(l.penalty)}</td><td><span class="paper-box paper-box--${escapeHtml(l.box.kind)}">${escapeHtml(l.box.symbol)}</span></td></tr>`,
    )
    .join('');
  const p2Merits = page2.meritsFlaws.items
    .map(
      (mf) => `<div class="paper-structured-item"><div class="paper-dot-row"><span><span class="paper-badge">${escapeHtml(mf.badge)}</span> ${escapeHtml(mf.name)}</span>${renderDotsHtml(mf.rating, 5)}</div></div>`,
    )
    .join('');
  const p2Havens = page2.havens.items
    .map(
      (hv) => `<div class="paper-structured-item"><div class="paper-dot-row"><span>${escapeHtml(hv.name)}</span>${renderDotsHtml(hv.rating, 5)}</div>${
        hv.traits.length ? `<div class="paper-legend">${hv.traits.map((tr) => escapeHtml(tr.label)).join(' · ')}</div>` : ''
      }</div>`,
    )
    .join('');

  return `
  <article class="paper-page paper-layout--wod-v20" data-paper-page="1">
    ${renderPageHeaderHtml(model, 1)}
    ${WOD_ORNAMENT_SVG}
    <div class="paper-id-grid-3x3">${idCells}</div>
    <div class="paper-sec-rule">${escapeHtml(labels.attributes)}</div>
    <div class="wod-attr-grid-3x3">${attrs}</div>
    <div class="paper-sec-rule">${escapeHtml(labels.abilities)}</div>
    <div class="paper-cols-3">${abilities}</div>
    <div class="paper-sec-rule">${escapeHtml(labels.advantages)}</div>
    <div class="paper-cols-3">
      <div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(labels.disciplines)}</div>${renderDotListHtml(page1.advantages3Col.disciplines)}</div>
      <div class="paper-col-box paper-block"><div class="paper-col-head">${escapeHtml(labels.backgrounds)}</div>${renderDotListHtml(page1.advantages3Col.backgrounds)}</div>
      <div class="paper-col-box paper-block" data-testid="${escapeHtml(page1.advantages3Col.virtues.testId)}"><div class="paper-col-head">${escapeHtml(page1.advantages3Col.virtues.heading)}</div>${renderDotListHtml(page1.advantages3Col.virtues.items)}</div>
    </div>
    <div class="paper-cols-3" style="margin-top:5px">
      <div class="paper-block">
        <div class="paper-track-block"><div class="paper-track-head"><span>${escapeHtml(page1.bottom3Col.humanity.label)}</span>${renderDotsHtml(page1.bottom3Col.humanity.value, 10)}</div></div>
        <div class="paper-track-block"><div class="paper-track-head"><span>${escapeHtml(page1.bottom3Col.willpower.label)}</span><span>${escapeHtml(String(page1.bottom3Col.willpower.value))} / ${escapeHtml(String(page1.bottom3Col.willpower.max))}</span></div><div class="paper-boxes-row">${wpBoxes}</div></div>
        ${renderTrackHtml(page1.bottom3Col.bloodPool)}
      </div>
      <div class="paper-track-block paper-block" data-testid="${escapeHtml(page1.bottom3Col.health.testId)}">
        <div class="paper-track-head"><span>${escapeHtml(page1.bottom3Col.health.label)}</span><span>${escapeHtml(page1.bottom3Col.health.summary)}</span></div>
        <table class="paper-health-table"><tbody>${healthRows}</tbody></table>
        <div class="paper-track-head" style="margin-top:3px"><span>${escapeHtml(page1.bottom3Col.health.soakLabel)}</span><span>${escapeHtml(page1.bottom3Col.health.soakValue)}</span></div>
      </div>
      <div class="paper-block">
        <div class="paper-col-box" style="margin-bottom:4px"><div class="paper-col-head">${escapeHtml(page1.bottom3Col.clanWeakness.label)}</div><div>${escapeHtml(page1.bottom3Col.clanWeakness.value || labels.emptyNone)}</div></div>
        <div class="paper-xp-row"><span>${escapeHtml(labels.xpTotal)}: ${escapeHtml(String(page1.bottom3Col.xpCompact.totalEarned))}</span><span>${escapeHtml(labels.xpAvailable)}: ${escapeHtml(String(page1.bottom3Col.xpCompact.available))}</span></div>
      </div>
    </div>
  </article>
  <article class="paper-page paper-layout--wod-v20" data-paper-page="2">
    ${renderPageHeaderHtml(model, 2)}
    <div class="paper-cols-2">
      <div>
        <div class="paper-card" data-testid="${escapeHtml(page2.meritsFlaws.testId)}">
          <div class="paper-card-head"><span class="paper-card-title">${escapeHtml(page2.meritsFlaws.heading)}</span><span class="paper-badge">${escapeHtml(page2.meritsFlaws.summary)}</span></div>
          ${p2Merits}
        </div>
        <div class="paper-card" data-testid="${escapeHtml(page2.havens.testId)}">
          <div class="paper-card-head"><span class="paper-card-title">${escapeHtml(page2.havens.heading)}</span><span class="paper-badge">${escapeHtml(page2.havens.countLabel)}</span></div>
          ${p2Havens}
        </div>
        ${renderXpSectionHtml(page2.xpSummary, labels)}
      </div>
      <div>
        <div class="paper-card"><div class="paper-card-head"><span class="paper-card-title">${escapeHtml(labels.powersRituals)}</span></div>${page2.powersRituals.map(renderFieldItemHtml).join('')}</div>
        <div class="paper-card"><div class="paper-card-head"><span class="paper-card-title">${escapeHtml(labels.combatEquipment)}</span></div>${page2.combatEquipment.map(renderFieldItemHtml).join('')}</div>
        ${page2.notes.map((n) => `<div class="paper-note-box"><strong>${escapeHtml(n.label)}: </strong>${escapeHtml(n.value)}</div>`).join('')}
      </div>
    </div>
    ${
      page2.extraCards.length
        ? `<div class="paper-sec-rule">${escapeHtml(labels.extraSections)}</div><div class="paper-generic-grid">${page2.extraCards.map(renderExtraCardHtml).join('')}</div>`
        : ''
    }
    ${renderRollLogsHtml(model)}
  </article>`;
}

function renderDnd5ePagesHtml(model: PaperSheetModel, data: PaperDnd5eModel): string {
  const { page1, page2, page3 } = data;
  const { labels } = model;
  const abilities = page1.col1.abilities
    .map(
      (ab) =>
        `<div class="paper-ability-medallion"><div><div class="paper-id-k">${escapeHtml(ab.label)}</div><div class="paper-ability-score">${escapeHtml(String(ab.score))}</div></div><div class="paper-ability-mod">${escapeHtml(ab.modifier)}</div></div>`,
    )
    .join('');
  const saves = page1.col1.savingThrows
    .map(
      (s) =>
        `<div class="paper-dot-row"><span>${s.proficient ? '●' : '○'} ${escapeHtml(s.label)}</span><strong>${escapeHtml(s.modifier)}</strong></div>`,
    )
    .join('');
  const skills = page1.col1.skills18
    .map(
      (sk) =>
        `<div class="paper-dot-row"><span>${sk.proficient ? '●' : '○'} ${escapeHtml(sk.label)} <span class="paper-specialty">(${escapeHtml(sk.abilityShort)})</span></span><strong>${escapeHtml(sk.modifier)}</strong></div>`,
    )
    .join('');
  const deathS = Array.from({ length: page1.col2.deathSaves.successes }, () => '<span class="paper-death-circle"></span>').join('');
  const deathF = Array.from({ length: page1.col2.deathSaves.failures }, () => '<span class="paper-death-circle"></span>').join('');
  const attacks = page1.col2.attacks
    .map((a) => `<div class="paper-dot-row"><span>${escapeHtml(a.name)}</span><strong>${escapeHtml(a.expr)}</strong></div>`)
    .join('');
  const currency = page1.col3.currency
    .map((c) => `<div class="paper-currency-cell"><strong>${escapeHtml(c.code)}</strong><div>${escapeHtml(c.value || '—')}</div></div>`)
    .join('');

  const page3Html = page3
    ? `<article class="paper-page paper-layout--dnd5e" data-paper-page="3">
        ${renderPageHeaderHtml(model, 3)}
        <div class="paper-sec-rule">${escapeHtml(labels.spellcasting)}</div>
        <div class="paper-xp-row">
          <span>${escapeHtml(labels.spellSaveDc)}: ${escapeHtml(page3.spellDc)}</span>
          <span>${escapeHtml(labels.spellAttack)}: ${escapeHtml(page3.spellAtk)}</span>
          <span>${escapeHtml(labels.concentration)}: ${page3.concentration ? '✓' : '—'}</span>
        </div>
        <div class="paper-cols-2">
          <div>
            <div class="paper-sec-rule">${escapeHtml(labels.spellSlots)}</div>
            ${page3.slots.map(renderTrackHtml).join('')}
            ${page3.spellRolls.map((r) => `<div class="paper-dot-row"><span>${escapeHtml(r.name)}</span><strong>${escapeHtml(r.expr)}</strong></div>`).join('')}
          </div>
          <div>
            <div class="paper-sec-rule">${escapeHtml(labels.grimoire)}</div>
            ${page3.grimoire.map(renderFieldItemHtml).join('')}
          </div>
        </div>
        ${renderRollLogsHtml(model)}
      </article>`
    : '';

  return `
  <article class="paper-page paper-layout--dnd5e" data-paper-page="1">
    ${renderPageHeaderHtml(model, 1)}
    <div class="paper-dnd-banner">
      <div><div class="paper-id-k">${escapeHtml(labels.classLevel)}</div><div class="paper-id-v">${escapeHtml(page1.identityBanner.classLevel)}</div></div>
      <div><div class="paper-id-k">${escapeHtml(labels.race)}</div><div class="paper-id-v">${escapeHtml(page1.identityBanner.race)}</div></div>
      <div><div class="paper-id-k">${escapeHtml(labels.alignment)}</div><div class="paper-id-v">${escapeHtml(page1.identityBanner.alignment)}</div></div>
      <div><div class="paper-id-k">${escapeHtml(labels.xpSection)}</div><div class="paper-id-v">${escapeHtml(String(page1.identityBanner.xpTotal))}</div></div>
      <div><div class="paper-id-k">${escapeHtml(labels.proficiencyBonus)}</div><div class="paper-id-v">${escapeHtml(page1.identityBanner.proficiencyBonus)}</div></div>
    </div>
    <div class="paper-dnd-grid">
      <div>
        <div class="paper-sec-rule">${escapeHtml(labels.attributes)}</div>
        ${abilities}
        <div class="paper-sec-rule">${escapeHtml(labels.savingThrows)}</div>
        <div class="paper-col-box">${saves}</div>
        <div class="paper-sec-rule">${escapeHtml(labels.skills)}</div>
        <div class="paper-col-box">${skills}</div>
        <div class="paper-xp-row" style="margin-top:4px"><span>${escapeHtml(labels.passivePerception)}</span><span>${escapeHtml(String(page1.col1.passivePerception))}</span></div>
      </div>
      <div>
        <div class="paper-sec-rule">${escapeHtml(labels.armorClass)}</div>
        <div class="paper-ac-wrap">${DND_SHIELD_SVG}<span class="paper-ac-val">${escapeHtml(page1.col2.armorClass)}</span><span class="paper-ac-lbl">${escapeHtml(labels.armorClass)}</span></div>
        <div class="paper-card">
          <div class="paper-dot-row"><span>${escapeHtml(page1.col2.hitPoints.label)}</span><strong>${escapeHtml(String(page1.col2.hitPoints.current))} / ${escapeHtml(String(page1.col2.hitPoints.max))}</strong></div>
          <div class="paper-dot-row"><span>${escapeHtml(page1.col2.hitDice.label)}</span><strong>${escapeHtml(String(page1.col2.hitDice.current))} / ${escapeHtml(String(page1.col2.hitDice.max))}</strong></div>
          <div class="paper-dot-row"><span>${escapeHtml(labels.deathSuccesses)}</span><span>${deathS}</span></div>
          <div class="paper-dot-row"><span>${escapeHtml(labels.deathFailures)}</span><span>${deathF}</span></div>
        </div>
        <div class="paper-sec-rule">${escapeHtml(labels.attacks)}</div>
        <div class="paper-card">${attacks}</div>
      </div>
      <div>
        <div class="paper-card">
          <div class="paper-dot-row"><span>${escapeHtml(labels.inspiration)}</span><strong>${page1.col3.inspiration ? '✓' : '○'}</strong></div>
          <div class="paper-dot-row"><span>${escapeHtml(labels.initiative)}</span><strong>${escapeHtml(page1.col3.initiative)}</strong></div>
          <div class="paper-dot-row"><span>${escapeHtml(labels.speed)}</span><strong>${escapeHtml(page1.col3.speed)}</strong></div>
          ${page1.col3.classResources.map(renderFieldItemHtml).join('')}
        </div>
        <div class="paper-sec-rule">${escapeHtml(labels.currency)}</div>
        <div class="paper-currency-grid" style="margin-bottom:5px">${currency}</div>
        <div class="paper-sec-rule">${escapeHtml(labels.equipment)}</div>
        <div class="paper-card">${page1.col3.equipment.map(renderFieldItemHtml).join('')}</div>
      </div>
    </div>
  </article>
  <article class="paper-page paper-layout--dnd5e" data-paper-page="2">
    ${renderPageHeaderHtml(model, 2)}
    <div class="paper-sec-rule">${escapeHtml(labels.biographyNotes)}</div>
    ${page2.notes.map((n) => `<div class="paper-note-box"><strong>${escapeHtml(n.label)}: </strong>${escapeHtml(n.value)}</div>`).join('')}
    ${renderXpSectionHtml(page2.xpSummary, labels)}
    ${
      page2.extraCards.length
        ? `<div class="paper-sec-rule">${escapeHtml(labels.extraSections)}</div><div class="paper-generic-grid">${page2.extraCards.map(renderExtraCardHtml).join('')}</div>`
        : ''
    }
    ${!page3 ? renderRollLogsHtml(model) : ''}
  </article>
  ${page3Html}`;
}

function renderGenericPagesHtml(model: PaperSheetModel): string {
  const pages = model.generic?.pages ?? [];
  return pages
    .map((p, idx) => {
      const isLast = idx === pages.length - 1;
      return `<article class="paper-page paper-layout--generic" data-paper-page="${escapeHtml(String(p.pageNumber))}">
        ${renderPageHeaderHtml(model, p.pageNumber)}
        <div class="paper-sec-rule">${escapeHtml(p.tabLabel)}</div>
        <div class="paper-generic-grid">${p.cards.map(renderExtraCardHtml).join('')}</div>
        ${p.xpSummary ? renderXpSectionHtml(p.xpSummary, model.labels) : ''}
        ${isLast ? renderRollLogsHtml(model) : ''}
      </article>`;
    })
    .join('');
}

const STANDALONE_PAPER_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
    color: #0B0B0B;
    background: #EAE4DA;
    padding: 18px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .paper-print-root {
    width: 100%;
    max-width: 210mm;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .paper-page {
    position: relative;
    width: 100%;
    min-height: 277mm;
    background: #FFFFFF;
    color: #0B0B0B;
    padding: 5mm 6mm;
    font-size: 8.6pt;
    line-height: 1.25;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
  }
  .paper-layout--wod-v5,
  .paper-layout--wod-v20 {
    border: 2px solid #5B0F18;
    outline: 1px solid #0B0B0B;
    outline-offset: -4px;
  }
  .paper-layout--dnd5e,
  .paper-layout--generic {
    border: 1.5px solid #0B0B0B;
  }
  .paper-block, .paper-card, .paper-structured-item, .paper-disc-box, .paper-ability-medallion, .paper-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .paper-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; padding-bottom: 4px; margin-bottom: 6px; border-bottom: 1.5px solid #0B0B0B; }
  .paper-layout--wod-v5 .paper-header, .paper-layout--wod-v20 .paper-header { border-bottom-color: #5B0F18; }
  .paper-title { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-size: 15pt; font-weight: 800; text-transform: uppercase; line-height: 1.05; }
  .paper-subtitle { font-family: 'JetBrains Mono', monospace; font-size: 7.4pt; font-weight: 700; color: #5B0F18; text-transform: uppercase; }
  .paper-layout--dnd5e .paper-subtitle, .paper-layout--generic .paper-subtitle { color: #0B0B0B; }
  .paper-page-num { font-family: 'JetBrains Mono', monospace; font-size: 7.2pt; font-weight: 700; white-space: nowrap; }
  .paper-wod-ornament { display: block; width: 140px; height: 10px; margin: 2px auto 4px; color: #5B0F18; }
  .paper-sec-rule { display: flex; align-items: center; gap: 6px; margin: 6px 0 4px; font-family: 'Barlow Condensed', sans-serif; font-size: 9.8pt; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #5B0F18; }
  .paper-sec-rule::before, .paper-sec-rule::after { content: ''; flex: 1; height: 1px; background: #5B0F18; }
  .paper-layout--dnd5e .paper-sec-rule, .paper-layout--generic .paper-sec-rule { color: #0B0B0B; }
  .paper-layout--dnd5e .paper-sec-rule::before, .paper-layout--dnd5e .paper-sec-rule::after,
  .paper-layout--generic .paper-sec-rule::before, .paper-layout--generic .paper-sec-rule::after { background: #0B0B0B; }
  .paper-id-grid-3x3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px 10px; margin-bottom: 5px; }
  .paper-id-cell { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; border-bottom: 1px solid #999; padding: 1.5px 2px; min-width: 0; }
  .paper-id-k { font-family: 'JetBrains Mono', monospace; font-size: 6.7pt; font-weight: 700; color: #3D332D; text-transform: uppercase; white-space: nowrap; }
  .paper-id-v { font-size: 8pt; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wod-attr-grid-3x3, .paper-cols-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 10px; }
  .paper-cols-2, .paper-generic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; align-items: start; }
  .paper-v5-bottom { display: grid; grid-template-columns: 1.15fr 0.95fr; gap: 8px 12px; align-items: start; }
  .paper-col-box { border: 1px solid #D4CCC4; padding: 4px 6px; background: #FFFFFF; }
  .paper-col-head { font-family: 'JetBrains Mono', monospace; font-size: 7.2pt; font-weight: 800; color: #5B0F18; text-transform: uppercase; border-bottom: 1px solid #5B0F18; margin-bottom: 3px; padding-bottom: 1px; display: flex; justify-content: space-between; align-items: center; }
  .paper-dot-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 1px 0; font-size: 7.8pt; }
  .paper-dot-label-wrap { display: flex; align-items: baseline; gap: 4px; min-width: 0; flex: 1; }
  .paper-dot-label { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .paper-specialty { font-family: 'JetBrains Mono', monospace; font-size: 6.5pt; color: #5B0F18; font-style: italic; }
  .paper-dots { display: inline-flex; align-items: center; gap: 1.5px; flex-shrink: 0; font-size: 8.5pt; line-height: 1; }
  .paper-dot.filled { color: #5B0F18; }
  .paper-dot.empty { color: #888888; }
  .paper-layout--dnd5e .paper-dot.filled, .paper-layout--generic .paper-dot.filled { color: #0B0B0B; }
  .paper-track-block { border: 1px solid #0B0B0B; padding: 3.5px 5px; margin-bottom: 4px; background: #FFFFFF; }
  .paper-track-head { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 7pt; font-weight: 700; margin-bottom: 2.5px; }
  .paper-badge { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 6.4pt; font-weight: 800; padding: 0.5px 4px; border: 1px solid #5B0F18; color: #5B0F18; background: #F6EEEE; text-transform: uppercase; }
  .paper-boxes-row { display: flex; flex-wrap: wrap; gap: 2.5px; }
  .paper-box { width: 13px; height: 13px; border: 1.25px solid #0B0B0B; display: inline-flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; font-weight: 800; background: #FFFFFF; color: #0B0B0B; }
  .paper-box--filled, .paper-box--aggravated { background: #0B0B0B; color: #FFFFFF; }
  .paper-box--lethal { background: #5B0F18; color: #FFFFFF; border-color: #5B0F18; }
  .paper-box--superficial, .paper-box--bashing, .paper-box--stain { background: #F0E8E8; color: #5B0F18; border-style: dashed; }
  .paper-box--filled-stain { background: #3D332D; color: #FFFFFF; }
  .paper-cont-track { position: relative; height: 9px; border: 1.25px solid #0B0B0B; background: #F5F5F5; overflow: hidden; }
  .paper-cont-fill { height: 100%; background: #5B0F18; }
  .paper-cont-track .tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(11,11,11,0.45); pointer-events: none; }
  .paper-cont-track .t25 { left: 25%; }
  .paper-cont-track .t50 { left: 50%; }
  .paper-cont-track .t75 { left: 75%; }
  .paper-legend { font-family: 'JetBrains Mono', monospace; font-size: 6.2pt; color: #444; margin-top: 2px; }
  .paper-disc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
  .paper-disc-box { border: 1px solid #0B0B0B; padding: 3.5px 5px; }
  .paper-disc-slot { display: flex; justify-content: space-between; gap: 4px; font-size: 7pt; border-bottom: 1px dotted #CCC; padding: 1px 0; }
  .paper-disc-cost { font-family: 'JetBrains Mono', monospace; font-size: 6.4pt; color: #5B0F18; font-weight: 700; }
  .paper-bp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; margin-top: 3px; }
  .paper-bp-cell { border: 1px solid #CCC; padding: 2px 3.5px; }
  .paper-bp-k { display: block; font-family: 'JetBrains Mono', monospace; font-size: 6pt; color: #444; }
  .paper-bp-v { font-family: 'JetBrains Mono', monospace; font-size: 7.2pt; font-weight: 800; }
  .paper-health-table, .paper-table { width: 100%; border-collapse: collapse; font-size: 7pt; }
  .paper-health-table td, .paper-table th, .paper-table td { border-bottom: 1px solid #CCC; padding: 2px 3px; text-align: left; }
  .paper-table th { border-bottom: 1.2px solid #0B0B0B; font-size: 6.6pt; }
  .paper-dnd-banner { display: grid; grid-template-columns: 1.8fr repeat(4, minmax(0, 1fr)); gap: 6px; border: 1.5px solid #0B0B0B; padding: 4px 6px; margin-bottom: 6px; background: #F8F8F8; }
  .paper-dnd-grid { display: grid; grid-template-columns: 1.08fr 1fr 1fr; gap: 8px; align-items: start; }
  .paper-ability-medallion { border: 1.25px solid #0B0B0B; padding: 3px 5px; margin-bottom: 3.5px; display: flex; align-items: center; justify-content: space-between; }
  .paper-ability-mod { font-family: 'Barlow Condensed', sans-serif; font-size: 13pt; font-weight: 800; }
  .paper-ability-score { font-family: 'JetBrains Mono', monospace; font-size: 7pt; border: 1px solid #0B0B0B; padding: 0 4px; }
  .paper-ac-wrap { position: relative; width: 54px; height: 60px; margin: 0 auto 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .paper-ac-shield { position: absolute; inset: 0; width: 100%; height: 100%; color: #0B0B0B; }
  .paper-ac-val { position: relative; font-family: 'Barlow Condensed', sans-serif; font-size: 15pt; font-weight: 800; }
  .paper-ac-lbl { position: relative; font-family: 'JetBrains Mono', monospace; font-size: 6pt; font-weight: 800; }
  .paper-death-circle { display: inline-block; width: 9px; height: 9px; border: 1.2px solid #0B0B0B; border-radius: 50%; margin-left: 2px; }
  .paper-currency-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
  .paper-currency-cell { border: 1px solid #0B0B0B; padding: 2px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 6.8pt; }
  .paper-card { border: 1.25px solid #0B0B0B; padding: 5px 6px; margin-bottom: 5px; background: #FFFFFF; }
  .paper-card.span-2 { grid-column: span 2; }
  .paper-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; border-bottom: 1px solid #0B0B0B; padding-bottom: 2px; margin-bottom: 4px; }
  .paper-card-tag { font-family: 'JetBrains Mono', monospace; font-size: 6.8pt; font-weight: 700; color: #5B0F18; }
  .paper-layout--generic .paper-card-tag, .paper-layout--dnd5e .paper-card-tag { color: #0B0B0B; }
  .paper-card-title { font-family: 'Barlow Condensed', sans-serif; font-size: 10pt; font-weight: 800; text-transform: uppercase; }
  .paper-structured-item { border: 1px solid #BBB; padding: 3px 5px; margin-bottom: 3px; }
  .paper-note-box { border: 1px solid #999; padding: 4px 6px; font-size: 7.8pt; white-space: pre-wrap; margin-bottom: 4px; }
  .paper-xp-row { display: flex; gap: 10px; font-family: 'JetBrains Mono', monospace; font-size: 7.4pt; font-weight: 700; padding: 3px 5px; border: 1px solid #0B0B0B; background: #F6F6F6; margin-bottom: 4px; }
  .paper-link { font-family: 'JetBrains Mono', monospace; font-size: 7.4pt; font-weight: 700; color: #5B0F18; text-decoration: none; }

  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #FFFFFF !important; padding: 0 !important; display: block !important; }
    .paper-print-root { max-width: none !important; display: block !important; }
    .paper-page { min-height: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
    .paper-page:last-child { break-after: auto; page-break-after: auto; }
  }
`;

export function generateSingleFilePureHtml(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): string {
  const i18n = getTranslations(lang);
  const t = i18n.t;
  const htmlLang = LANGUAGE_OPTIONS.find((opt) => opt.id === lang)?.htmlLang ?? 'pt-BR';
  const model = buildPaperSheetModel(sheet, lang);

  let pagesHtml = '';
  if (model.layout === 'wod-v5' && model.wodV5) {
    pagesHtml = renderWodV5PagesHtml(model, model.wodV5);
  } else if (model.layout === 'wod-v20' && model.wodV20) {
    pagesHtml = renderWodV20PagesHtml(model, model.wodV20);
  } else if (model.layout === 'dnd5e' && model.dnd5e) {
    pagesHtml = renderDnd5ePagesHtml(model, model.dnd5e);
  } else {
    pagesHtml = renderGenericPagesHtml(model);
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP_CONTENT}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(model.systemName)} — ${escapeHtml(t('print.pureHtmlTitleSuffix'))}</title>
  <style>
${QSS_VARIABLES_GUIDE}
${STANDALONE_PAPER_CSS}
  </style>
</head>
<body>
  <main class="paper-print-root" data-testid="paper-print-root" data-paper-layout="${escapeHtml(model.layout)}">
    ${pagesHtml}
  </main>
  <script type="application/json" id="gridsheet-data">${serializeSafeEmbeddedJson(sheet)}</script>
</body>
</html>`;
}
