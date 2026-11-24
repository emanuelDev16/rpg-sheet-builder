import { getV5BloodPotencyStats } from './formula.ts';
import {
  type AppLanguage,
  getLocalizedTabLabels,
  getTranslations,
  LANGUAGE_OPTIONS,
  type TranslateFn,
} from './i18n.ts';
import {
  type CharacterSheetState,
  detectSystemId,
  evaluateSheet,
  getSheetBloodPool,
  getSheetHumanityStains,
  getSheetVirtues,
  getV20HealthBreakdown,
  getV5HealthBreakdown,
  getV5WillpowerState,
  resolveRollPreview,
  resolveRulePreset,
  type SheetCard,
  type SheetField,
} from './sheetModel.ts';
import {
  findHavenTraitByIdOrName,
  type WodCatalogEdition,
} from './wodAdvantagesCatalog.ts';
import { isOfficialVampireSheet } from './wodSkillsCatalog.ts';
import { resolveWodDotRatingConfig } from '../utils/dotRating.ts';

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
}

/* Exemplo equivalente em QSS (PySide6):
QMainWindow, QWidget#CanvasRoot { background-color: #F8F1E7; color: #0B0B0B; }
QFrame.BentoCard {
  background-color: #FFFDF9;
  border: 2px solid #0B0B0B;
  border-radius: 10px;
}
QPushButton.RollButton {
  background-color: #0B0B0B;
  color: #F8F1E7;
  border: 2px solid #0B0B0B;
  border-radius: 6px;
  font-family: "JetBrains Mono";
  font-weight: 700;
  padding: 8px 12px;
}
QPushButton.ModeEditActive {
  background-color: #5B0F18;
  color: #F8F1E7;
  border: 2px solid #0B0B0B;
}
*/`;

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

function renderDotRatingHtml(value: number, max: 5 | 10): string {
  const clamped = Math.max(0, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
  const pips = Array.from({ length: max }, (_, idx) => {
    const filled = idx < clamped;
    return `<span class="dot-pip${filled ? ' filled' : ''}" aria-hidden="true">${filled ? '●' : '○'}</span>`;
  }).join('');
  return `<span class="dot-rating-inline" aria-label="${escapeHtml(`${clamped} / ${max}`)}"><span class="dot-pips${max === 10 ? ' is-ten' : ''}">${pips}</span><span class="dot-num">${escapeHtml(String(clamped))}</span></span>`;
}

function renderV20HealthHtml(field: SheetField, t: TranslateFn): string {
  const { max, aggravated, lethal, bashing, healthy } = getV20HealthBreakdown(field);
  const cells = Array.from({ length: max }, (_, idx) => {
    if (idx < aggravated) {
      return `<span class="vital-box vital-box--agg" title="${escapeHtml(t('cards.vital.aggravatedV20Dmg'))}">*</span>`;
    }
    if (idx < aggravated + lethal) {
      return `<span class="vital-box vital-box--lethal" title="${escapeHtml(t('cards.vital.lethalDmg'))}">X</span>`;
    }
    if (idx < aggravated + lethal + bashing) {
      return `<span class="vital-box vital-box--bashing" title="${escapeHtml(t('cards.vital.bashingDmg'))}">/</span>`;
    }
    return `<span class="vital-box vital-box--empty"></span>`;
  }).join('');

  const summary = t('print.pureHtmlHealthV20Summary', {
    healthy,
    max,
    agg: aggravated,
    lethal,
    bashing,
  });

  return `
    <div class="resource-box wod-vital-track" data-testid="pure-html-v20-health">
      <div class="resource-head">
        <span class="field-label">${escapeHtml(field.label)}</span>
        <span class="resource-count">${escapeHtml(summary)}</span>
      </div>
      <div class="vital-boxes">${cells}</div>
    </div>`;
}

function renderV5HealthHtml(field: SheetField, t: TranslateFn): string {
  const { max, aggravated, superficial, healthy, totalDamage } = getV5HealthBreakdown(field);
  const impaired = totalDamage >= max;
  const cells = Array.from({ length: max }, (_, idx) => {
    if (idx < aggravated) {
      return `<span class="vital-box vital-box--agg" title="${escapeHtml(t('cards.aggravatedDmg'))}">X</span>`;
    }
    if (idx < aggravated + superficial) {
      return `<span class="vital-box vital-box--sup" title="${escapeHtml(t('cards.superficialDmg'))}">/</span>`;
    }
    return `<span class="vital-box vital-box--empty"></span>`;
  }).join('');

  const summary = t('print.pureHtmlHealthV5Summary', {
    healthy,
    max,
    agg: aggravated,
    sup: superficial,
  });

  return `
    <div class="resource-box wod-vital-track" data-testid="pure-html-v5-health">
      <div class="resource-head">
        <span class="field-label">${escapeHtml(field.label)}${impaired ? ` <span class="status-pill">${escapeHtml(t('cards.vital.impairedBadge'))}</span>` : ''}</span>
        <span class="resource-count">${escapeHtml(summary)}</span>
      </div>
      <div class="vital-boxes">${cells}</div>
    </div>`;
}

function renderV5WillpowerHtml(
  field: SheetField,
  sheet: CharacterSheetState,
  t: TranslateFn,
): string {
  const wp = getV5WillpowerState(sheet);
  const cells = Array.from({ length: wp.max }, (_, idx) => {
    if (idx < wp.aggravated) {
      return `<span class="vital-box vital-box--agg" title="${escapeHtml(t('cards.vital.wpAggravatedDmg'))}">X</span>`;
    }
    if (idx < wp.aggravated + wp.superficial) {
      return `<span class="vital-box vital-box--sup" title="${escapeHtml(t('cards.vital.wpSuperficialDmg'))}">/</span>`;
    }
    return `<span class="vital-box vital-box--empty" title="${escapeHtml(t('cards.vital.wpAvailableLabel'))}"></span>`;
  }).join('');

  const summary = t('print.pureHtmlWpValue', {
    available: wp.available,
    max: wp.max,
    sup: wp.superficial,
    agg: wp.aggravated,
  });

  return `
    <div class="resource-box wod-vital-track" data-testid="pure-html-v5-willpower">
      <div class="resource-head">
        <span class="field-label">${escapeHtml(field.label)}${wp.isImpaired ? ` <span class="status-pill">${escapeHtml(t('cards.vital.wpImpairedBadge'))}</span>` : ''}</span>
        <span class="resource-count">${escapeHtml(summary)}</span>
      </div>
      <div class="vital-boxes">${cells}</div>
    </div>`;
}

function renderV5HumanityHtml(
  field: SheetField,
  sheet: CharacterSheetState,
  t: TranslateFn,
): string {
  const { humanity, stains } = getSheetHumanityStains(sheet);
  const boxes = Array.from({ length: 10 }, (_, idx) => {
    const isHumanity = idx < humanity;
    const isStain = idx >= 10 - stains;
    if (isStain && isHumanity) {
      return '<span class="humanity-box humanity-box--filled humanity-box--stain">●/</span>';
    }
    if (isStain) {
      return '<span class="humanity-box humanity-box--stain">/</span>';
    }
    if (isHumanity) {
      return '<span class="humanity-box humanity-box--filled">●</span>';
    }
    return '<span class="humanity-box"></span>';
  }).join('');

  const summary = t('print.pureHtmlHumanityValue', { humanity, stains });

  return `
    <div class="resource-box wod-vital-track" data-testid="pure-html-v5-humanity">
      <div class="resource-head">
        <span class="field-label">${escapeHtml(field.label)}</span>
        <span class="resource-count">${escapeHtml(summary)}</span>
      </div>
      <div class="humanity-track">${boxes}</div>
      <div class="mono-meta">${escapeHtml(t('print.pureHtmlStainsLegend'))}</div>
    </div>`;
}

function renderV5BloodPotencySummaryHtml(level: number, t: TranslateFn): string {
  const stats = getV5BloodPotencyStats(level);
  const rerollStr =
    stats.rouseRerollMaxLevel > 0
      ? t('cards.vital.bpRouseRerollValue', { level: stats.rouseRerollMaxLevel })
      : t('cards.vital.bpRouseRerollNone');

  return `
    <div class="v5-bp-summary" data-testid="pure-html-v5-bp">
      <div class="bp-summary-title">${escapeHtml(t('cards.vital.bpPanelTitle', { level: stats.level }))}</div>
      <div class="bp-summary-grid">
        <div class="bp-stat-cell"><span class="bp-k">${escapeHtml(t('cards.vital.bpSurge'))}</span><span class="bp-v">+${escapeHtml(String(stats.bloodSurgeDice))}d10</span></div>
        <div class="bp-stat-cell"><span class="bp-k">${escapeHtml(t('cards.vital.bpMend'))}</span><span class="bp-v">${escapeHtml(String(stats.mendSuperficialPerRouse))} SUP</span></div>
        <div class="bp-stat-cell"><span class="bp-k">${escapeHtml(t('cards.vital.bpPowerBonus'))}</span><span class="bp-v">+${escapeHtml(String(stats.powerBonusDice))}d10</span></div>
        <div class="bp-stat-cell"><span class="bp-k">${escapeHtml(t('cards.vital.bpRouseReroll'))}</span><span class="bp-v">${escapeHtml(rerollStr)}</span></div>
        <div class="bp-stat-cell"><span class="bp-k">${escapeHtml(t('cards.vital.bpBaneSeverity'))}</span><span class="bp-v">${escapeHtml(String(stats.baneSeverity))}</span></div>
        <div class="bp-stat-cell"><span class="bp-k">${escapeHtml(t('cards.vital.bpFeedingLabel'))}</span><span class="bp-v">${escapeHtml(t(`cards.vital.bpFeeding.${stats.feedingPenaltyKey}`))}</span></div>
      </div>
    </div>`;
}

function renderV20BloodPoolAndVirtuesHtml(sheet: CharacterSheetState, t: TranslateFn): string {
  const bp = getSheetBloodPool(sheet);
  const virtues = getSheetVirtues(sheet);
  const maxVisual = Math.min(20, bp.max);
  const blocks =
    bp.max > 20
      ? (() => {
          const pct = bp.max > 0 ? Math.max(0, Math.min(100, (bp.current / bp.max) * 100)) : 0;
          return `<div class="cont-track"><div class="cont-fill" style="width:${pct.toFixed(1)}%"></div><span class="tick t25"></span><span class="tick t50"></span><span class="tick t75"></span></div>`;
        })()
      : `<div class="seg-track">${Array.from({ length: maxVisual }, (_, idx) => `<span class="${idx < bp.current ? 'seg-block filled' : 'seg-block'}"></span>`).join('')}</div>`;

  return `
    <div class="resource-box" data-testid="pure-html-v20-blood-pool">
      <div class="resource-head">
        <span class="field-label">${escapeHtml(t('cards.vital.bloodPoolLabel'))}</span>
        <span class="resource-count">${escapeHtml(`${bp.current} / ${bp.max}`)}</span>
      </div>
      ${blocks}
    </div>
    <div class="v20-virtues-box" data-testid="pure-html-v20-virtues">
      <div class="bp-summary-title">${escapeHtml(t('cards.vital.virtuesHeading'))}</div>
      <div class="virtues-list">
        <div class="field-row"><span class="field-label">${escapeHtml(t('cards.vital.virtueConscience'))}</span>${renderDotRatingHtml(virtues.conscience, 5)}</div>
        <div class="field-row"><span class="field-label">${escapeHtml(t('cards.vital.virtueSelfControl'))}</span>${renderDotRatingHtml(virtues.selfControl, 5)}</div>
        <div class="field-row"><span class="field-label">${escapeHtml(t('cards.vital.virtueCourage'))}</span>${renderDotRatingHtml(virtues.courage, 5)}</div>
      </div>
    </div>`;
}

function renderStructuredDossierHtml(
  sheet: CharacterSheetState,
  edition: WodCatalogEdition,
  lang: AppLanguage,
  t: TranslateFn,
): string {
  const isV5 = edition === 'vampire-v5';
  const touchstones = Array.isArray(sheet.touchstones) ? sheet.touchstones : [];
  const meritsFlaws = Array.isArray(sheet.meritsFlaws) ? sheet.meritsFlaws : [];
  const havens = Array.isArray(sheet.havens) ? sheet.havens : [];

  const sections: string[] = [];

  if (isV5 && touchstones.length > 0) {
    const itemsHtml = touchstones
      .map(
        (ts) => `
      <div class="structured-item">
        <div class="structured-item-head">
          <span class="structured-title">${escapeHtml(ts.conviction)}</span>
          <span class="structured-pill">${escapeHtml(ts.touchstone)}</span>
        </div>
        ${ts.notes?.trim() ? `<div class="structured-notes">${escapeHtml(ts.notes.trim())}</div>` : ''}
      </div>`,
      )
      .join('');
    sections.push(`
      <div class="structured-section" data-testid="pure-html-touchstones">
        <div class="structured-head">
          <span class="structured-heading">${escapeHtml(t('cards.structured.touchstonesHeading'))}</span>
          <span class="structured-pill">${escapeHtml(t('cards.structured.touchstonesCounter', { count: touchstones.length }))}</span>
        </div>
        ${itemsHtml}
      </div>`);
  }

  if (meritsFlaws.length > 0) {
    let meritsTotal = 0;
    let flawsTotal = 0;
    for (const mf of meritsFlaws) {
      const rating = Math.max(1, Math.min(5, Math.round(mf.rating)));
      if (mf.kind === 'flaw') flawsTotal += rating;
      else meritsTotal += rating;
    }
    const itemsHtml = meritsFlaws
      .map((mf) => {
        const isFlaw = mf.kind === 'flaw';
        return `
      <div class="structured-item">
        <div class="structured-item-head">
          <span class="structured-title">
            <span class="mf-badge ${isFlaw ? 'is-flaw' : 'is-merit'}">${escapeHtml(isFlaw ? t('cards.structured.badgeFlaw') : t('cards.structured.badgeMerit'))}</span>
            ${escapeHtml(mf.name)}
          </span>
          ${renderDotRatingHtml(mf.rating, 5)}
        </div>
        ${mf.notes?.trim() ? `<div class="structured-notes">${escapeHtml(mf.notes.trim())}</div>` : ''}
      </div>`;
      })
      .join('');
    sections.push(`
      <div class="structured-section" data-testid="pure-html-merits-flaws">
        <div class="structured-head">
          <span class="structured-heading">${escapeHtml(t('cards.structured.meritsFlawsHeading'))}</span>
          <span class="structured-pill">${escapeHtml(t('cards.structured.meritsFlawsSummary', { merits: meritsTotal, flaws: flawsTotal }))}</span>
        </div>
        ${itemsHtml}
      </div>`);
  }

  if (havens.length > 0) {
    const itemsHtml = havens
      .map((haven) => {
        const traitsHtml = (haven.traits ?? [])
          .map((traitId) => {
            const match = findHavenTraitByIdOrName(traitId, edition);
            const label = match ? match.name[lang] : traitId;
            const isFlaw = match?.kind === 'flaw';
            return `<span class="trait-chip${isFlaw ? ' is-flaw' : ''}">${escapeHtml(label)}</span>`;
          })
          .join('');
        return `
      <div class="structured-item">
        <div class="structured-item-head">
          <span class="structured-title">${escapeHtml(haven.name)}${haven.location?.trim() ? ` · <span class="mono-meta">${escapeHtml(haven.location.trim())}</span>` : ''}</span>
          ${renderDotRatingHtml(haven.rating, 5)}
        </div>
        ${traitsHtml ? `<div class="trait-chips">${traitsHtml}</div>` : ''}
        ${haven.notes?.trim() ? `<div class="structured-notes">${escapeHtml(haven.notes.trim())}</div>` : ''}
      </div>`;
      })
      .join('');
    sections.push(`
      <div class="structured-section" data-testid="pure-html-havens">
        <div class="structured-head">
          <span class="structured-heading">${escapeHtml(t('cards.structured.havensHeading'))}</span>
          <span class="structured-pill">${escapeHtml(t('cards.structured.havensCount', { count: havens.length }))}</span>
        </div>
        ${itemsHtml}
      </div>`);
  }

  if (sections.length === 0) {
    return `<p class="mono-meta">${escapeHtml(t('cards.structured.meritsFlawsEmpty'))}</p>`;
  }
  return `<div class="structured-dossier">${sections.join('\n')}</div>`;
}

export function generateSingleFilePureHtml(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): string {
  const i18n = getTranslations(lang);
  const t = i18n.t;
  const htmlLang = LANGUAGE_OPTIONS.find((opt) => opt.id === lang)?.htmlLang ?? 'pt-BR';
  const systemId = detectSystemId(sheet);
  const rulePreset = resolveRulePreset(sheet);
  const officialEdition = isOfficialVampireSheet(systemId, rulePreset) ? rulePreset : null;
  const isV5 = officialEdition === 'vampire-v5';
  const isV20 = officialEdition === 'storyteller-v20';
  const tabLabels = getLocalizedTabLabels(systemId, lang);
  const evaluation = evaluateSheet(sheet);

  const bloodPotencyLevel =
    typeof evaluation.variables.blood_potency === 'number' &&
    Number.isFinite(evaluation.variables.blood_potency)
      ? Math.max(0, Math.min(10, Math.round(evaluation.variables.blood_potency)))
      : 1;
  const v5BpStats = isV5 ? getV5BloodPotencyStats(bloodPotencyLevel) : null;

  const renderFieldHtml = (field: SheetField, card: SheetCard): string => {
    const fk = (field.key ?? '').trim().toLowerCase();

    if (field.kind === 'number' || field.kind === 'text') {
      const rawStr = String(field.value ?? '');
      const dotCfg = officialEdition
        ? resolveWodDotRatingConfig(field, card, rulePreset, systemId)
        : null;

      if (field.kind === 'number' && dotCfg?.enabled) {
        const hintHtml = field.hint?.trim()
          ? `<span class="field-hint">${escapeHtml(field.hint.trim())}</span>`
          : '';
        return `
          <div class="field-row">
            <div class="field-label-stack">
              <span class="field-label">${escapeHtml(field.label)}</span>
              ${hintHtml}
            </div>
            ${renderDotRatingHtml(Number(field.value ?? 0), dotCfg.max)}
          </div>`;
      }

      const looksLikeUrl = /^(?:https?:\/\/|data:|javascript:|vbscript:)/i.test(rawStr.trim());
      const safeUrl = looksLikeUrl ? sanitizeUrl(rawStr) : '';
      const linkHtml =
        field.kind === 'text' && safeUrl
          ? `<a class="field-link" href="${escapeHtml(safeUrl)}" rel="noopener noreferrer">↗</a>`
          : '';
      const baneSeverityHtml =
        isV5 && v5BpStats && fk === 'clan_bane'
          ? `<span class="status-pill">${escapeHtml(t('cards.vital.baneSeverityBadge', { severity: v5BpStats.baneSeverity }))}</span>`
          : '';
      return `
          <div class="field-row">
            <label class="field-label">${escapeHtml(field.label)}${baneSeverityHtml ? ` ${baneSeverityHtml}` : ''}</label>
            <div class="field-input-wrap">
              <input class="cyber-input" type="${field.kind === 'number' ? 'number' : 'text'}" value="${escapeHtml(rawStr)}" />
              ${linkHtml}
            </div>
          </div>`;
    }

    if (field.kind === 'calculated') {
      const info = evaluation.computedByFieldId[field.id];
      return `
          <div class="field-row">
            <span class="field-label">${escapeHtml(field.label)}</span>
            <div class="calc-box" title="${escapeHtml(field.formula ?? '')}">
              <span>${escapeHtml(info?.formatted ?? '0')}</span>
              <span class="calc-formula">${escapeHtml(field.formula ?? '')}</span>
            </div>
          </div>`;
    }

    if (field.kind === 'resource') {
      if (officialEdition && field.damageTrack) {
        return isV5 ? renderV5HealthHtml(field, t) : renderV20HealthHtml(field, t);
      }
      if (isV5 && (field.id === 'f_willpower' || fk === 'willpower')) {
        return renderV5WillpowerHtml(field, sheet, t);
      }
      if (isV5 && (field.id === 'f_humanity' || fk === 'humanity')) {
        return renderV5HumanityHtml(field, sheet, t);
      }
      if (isV20 && (field.id === 'f_humanity' || fk === 'humanity')) {
        return `
          <div class="field-row">
            <span class="field-label">${escapeHtml(field.label)}</span>
            ${renderDotRatingHtml(Number(field.value ?? 7), 10)}
          </div>`;
      }

      const val = Math.max(0, Number(field.value ?? 0));
      const max = Math.max(1, field.max ?? 12);
      const trackHtml =
        max > 20
          ? (() => {
              const pct = Math.max(0, Math.min(100, (val / max) * 100));
              return `<div class="cont-track"><div class="cont-fill" style="width:${pct.toFixed(1)}%"></div><span class="tick t25"></span><span class="tick t50"></span><span class="tick t75"></span></div>`;
            })()
          : (() => {
              const blocks = Array.from({ length: max }, (_, idx) => {
                const filled = idx < val ? 'seg-block filled' : 'seg-block';
                return `<span class="${filled}"></span>`;
              }).join('');
              return `<div class="seg-track">${blocks}</div>`;
            })();
      return `
          <div class="resource-box">
            <div class="resource-head">
              <span class="field-label">${escapeHtml(field.label)}</span>
              <div class="resource-controls">
                <button class="mini-btn" type="button">-</button>
                <span class="resource-count">${escapeHtml(`${val} / ${max}`)}</span>
                <button class="mini-btn" type="button">+</button>
              </div>
            </div>
            ${trackHtml}
          </div>`;
    }

    if (field.kind === 'boolean') {
      return `
          <label class="bool-row">
            <input class="bool-native" type="checkbox" ${field.value ? 'checked' : ''} />
            <span class="bool-box">✓</span>
            <span class="bool-text">${escapeHtml(field.label)}</span>
          </label>`;
    }

    if (field.kind === 'roll') {
      const preview = resolveRollPreview(field.rollExpr ?? '', evaluation.variables);
      return `
          <button class="roll-btn" type="button">
            <span>${escapeHtml(field.rollLabel ?? field.label)} · ${escapeHtml(preview)}</span>
            <span>↗</span>
          </button>`;
    }

    if (field.kind === 'repeatable') {
      const rowsHtml = (field.rows ?? [])
        .map(
          (r) => `
              <tr>
                <td>${escapeHtml(r.col1)}</td>
                <td class="num-cell">${escapeHtml(String(r.col2))}</td>
                <td class="act-cell"><button class="del-btn" type="button">×</button></td>
              </tr>`,
        )
        .join('');
      return `
          <div class="repeat-block">
            <div class="repeat-head">
              <span class="field-label">${escapeHtml(field.label)}</span>
              <span class="mono-meta">${escapeHtml(t('cards.cargoBadge'))} ${escapeHtml(String(evaluation.totalCargoWeight))} KG</span>
            </div>
            <table class="cyber-table">
              <thead>
                <tr>
                  <th>${escapeHtml(field.columns?.[0] ?? t('cards.defaultItemCol'))}</th>
                  <th>${escapeHtml(field.columns?.[1] ?? t('cards.defaultValueCol'))}</th>
                  <th class="act-cell"></th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <button class="add-row-btn" type="button">${escapeHtml(t('print.pureHtmlAddRow'))}</button>
          </div>`;
    }

    return '';
  };

  let renderedDossierCard = false;

  const cardsHtml = sheet.cards
    .map((card) => {
      const isWodDossierCard = card.id === 'card_wod_dossier' && Boolean(officialEdition);
      const isFullSpan = isWodDossierCard || (card.colSpan ?? 1) >= 2;
      const spanClass = isFullSpan ? 'bento-card span-2' : 'bento-card';

      let bodyHtml = '';
      if (isWodDossierCard && officialEdition) {
        renderedDossierCard = true;
        bodyHtml = renderStructuredDossierHtml(sheet, officialEdition, lang, t);
      } else if (
        officialEdition &&
        card.id === 'card_atributos' &&
        card.fields.some((f) => f.attributeGroup !== undefined)
      ) {
        const groups: Array<{ id: 'physical' | 'social' | 'mental'; title: string }> = [
          { id: 'physical', title: t('cards.attributes.physical') },
          { id: 'social', title: t('cards.attributes.social') },
          { id: 'mental', title: t('cards.attributes.mental') },
        ];
        const colsHtml = groups
          .map((grp) => {
            const grpFields = card.fields
              .filter((f) => f.attributeGroup === grp.id)
              .map((f) => renderFieldHtml(f, card))
              .join('\n');
            return `<div class="wod-attr-col"><div class="wod-attr-col-head">${escapeHtml(grp.title)}</div>${grpFields}</div>`;
          })
          .join('');
        const trailingHtml = card.fields
          .filter((f) => !f.attributeGroup)
          .map((f) => renderFieldHtml(f, card))
          .join('\n');
        bodyHtml = `<div class="wod-attr-grid-3x3">${colsHtml}</div>${trailingHtml}`;
      } else {
        bodyHtml = card.fields.map((field) => renderFieldHtml(field, card)).join('\n');
        if (isV5 && card.id === 'card_identidade' && v5BpStats) {
          bodyHtml += `\n${renderV5BloodPotencySummaryHtml(bloodPotencyLevel, t)}`;
        }
        if (isV20 && card.id === 'card_combate') {
          bodyHtml += `\n${renderV20BloodPoolAndVirtuesHtml(sheet, t)}`;
        }
      }

      return `
        <section class="${spanClass}" data-tab="${escapeHtml(card.tab)}" data-card-id="${escapeHtml(card.id)}">
          <header class="card-header">
            <span class="card-code">${escapeHtml(card.code)}</span>
            <h2 class="card-title">${escapeHtml(card.title)}</h2>
          </header>
          <div class="card-body">
            ${bodyHtml}
          </div>
        </section>`;
    })
    .join('\n');

  const hasStructuredItems =
    (isV5 && (sheet.touchstones?.length ?? 0) > 0) ||
    (sheet.meritsFlaws?.length ?? 0) > 0 ||
    (sheet.havens?.length ?? 0) > 0;

  const fallbackDossierHtml =
    officialEdition && !renderedDossierCard && hasStructuredItems
      ? `
        <section class="bento-card span-2" data-tab="magias" data-card-id="card_wod_dossier">
          <header class="card-header">
            <span class="card-code">//CHRONICLE_TRAITS</span>
            <h2 class="card-title">${escapeHtml(isV5 ? t('print.pureHtmlDossierTitle') : t('print.pureHtmlDossierTitleV20'))}</h2>
          </header>
          <div class="card-body">
            ${renderStructuredDossierHtml(sheet, officialEdition, lang, t)}
          </div>
        </section>`
      : '';

  const logsHtml = sheet.rollLogs
    .map(
      (log) => `
      <div class="log-entry">
        <div class="log-top">
          <span class="log-label">${escapeHtml(log.label)}</span>
          <span class="log-time">${escapeHtml(log.timestamp)}</span>
        </div>
        <div class="log-total">${escapeHtml(String(log.total))}</div>
        <div class="log-formula">${escapeHtml(log.breakdown)}</div>
      </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP_CONTENT}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(sheet.systemName)} — ${escapeHtml(t('print.pureHtmlTitleSuffix'))}</title>
  <style>
${QSS_VARIABLES_GUIDE}

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-ui);
      color: var(--ink-primary);
      background-color: var(--bg-canvas);
      background-image:
        radial-gradient(circle at 0 0, #9CA3AF 1.25px, transparent 1.25px),
        linear-gradient(to right, rgba(24, 24, 27, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(24, 24, 27, 0.05) 1px, transparent 1px);
      background-size: 32px 32px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 20px;
      background: var(--bg-card);
      border-bottom: var(--border-width-strong) solid var(--border-ink);
    }
    .sys-id {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .toolbar-actions { display: flex; align-items: center; gap: 8px; }
    .btn-outline {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 7px 12px;
      background: var(--bg-card);
      color: var(--ink-primary);
      border: var(--border-width) solid var(--border-ink);
      border-radius: var(--radius-control);
      cursor: pointer;
    }
    .mode-switch {
      display: inline-flex;
      border: var(--border-width-strong) solid var(--border-ink);
      border-radius: var(--radius-control);
      overflow: hidden;
    }
    .mode-btn {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 7px 12px;
      border: none;
      cursor: pointer;
    }
    .mode-btn.play { background: var(--accent-black); color: var(--ink-inverse); }
    .mode-btn.edit { background: var(--accent-wine); color: var(--ink-inverse); }
    .workspace {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 260px;
      min-height: 0;
    }
    .main-area { padding: 20px; overflow: auto; }
    .sheet-banner {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding: 10px 14px;
      margin-bottom: 14px;
      background: var(--bg-card);
      border: var(--border-width-strong) solid var(--border-ink);
      border-radius: var(--radius-card);
    }
    .sheet-banner-name { font-family: var(--font-display); font-size: 24px; font-weight: 800; text-transform: uppercase; }
    .sheet-banner-sys { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-wine); }
    .tab-bar { display: flex; gap: 10px; margin-bottom: 18px; }
    .tab-btn {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      padding: 9px 16px;
      background: var(--bg-card-alt);
      border: var(--border-width) solid var(--border-ink);
      border-radius: var(--radius-control);
      cursor: pointer;
    }
    .tab-btn.active { background: var(--accent-black); color: var(--ink-inverse); }
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .bento-card {
      background: var(--bg-card);
      border: var(--border-width-strong) solid var(--border-ink);
      border-radius: var(--radius-card);
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .bento-card.span-2 { grid-column: span 2; }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--bg-header-strip);
      border-bottom: var(--border-width) solid var(--border-ink);
    }
    .card-code { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-wine); }
    .card-title { font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase; }
    .card-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .field-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .field-label-stack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .field-label { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--ink-secondary); }
    .field-hint { font-family: var(--font-mono); font-size: 10px; font-weight: 600; color: var(--accent-wine); }
    .field-input-wrap { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .field-link { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-wine); text-decoration: none; }
    .cyber-input {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      padding: 6px 10px;
      border: var(--border-width) solid var(--border-ink);
      border-radius: var(--radius-control);
      background: var(--bg-card-alt);
      width: 170px;
      max-width: 100%;
    }
    .dot-rating-inline { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .dot-pips { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; line-height: 1; }
    .dot-pips.is-ten { letter-spacing: -0.04em; }
    .dot-pip.filled { color: var(--accent-wine); }
    .dot-pip:not(.filled) { color: var(--ink-muted); }
    .dot-num { font-family: var(--font-mono); font-size: 11px; font-weight: 800; border: 1px solid var(--border-ink); border-radius: 4px; padding: 1px 5px; background: var(--bg-card-alt); }
    .wod-attr-grid-3x3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .wod-attr-col { border: 1px solid var(--border-subtle); border-radius: var(--radius-control); padding: 8px; background: var(--bg-card-alt); display: flex; flex-direction: column; gap: 6px; }
    .wod-attr-col-head { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--accent-wine); border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px; }
    .status-pill { display: inline-block; font-family: var(--font-mono); font-size: 9px; font-weight: 800; padding: 1px 6px; border: 1px solid var(--accent-wine); background: var(--accent-cream-badge); color: var(--accent-wine); border-radius: 999px; }
    .calc-box {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      padding: 5px 10px;
      background: var(--accent-cream-badge);
      color: var(--accent-wine);
      border: 1.5px dashed var(--accent-wine);
      border-radius: var(--radius-control);
    }
    .calc-formula { font-size: 10px; opacity: 0.7; }
    .resource-box { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1.5px solid var(--border-subtle); border-radius: var(--radius-control); background: var(--bg-card-alt); }
    .resource-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .resource-controls { display: flex; align-items: center; gap: 6px; }
    .resource-count { font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
    .mini-btn { width: 24px; height: 24px; border: 1.5px solid var(--border-ink); background: var(--bg-card); font-family: var(--font-mono); font-weight: 700; border-radius: 4px; cursor: pointer; }
    .seg-track { display: flex; gap: 3px; height: 14px; }
    .seg-block { flex: 1; background: var(--accent-wine-soft); border: 1px solid rgba(91,15,24,0.28); border-radius: 2px; }
    .seg-block.filled { background: var(--accent-wine); border-color: var(--accent-wine); }
    .vital-boxes, .humanity-track { display: flex; flex-wrap: wrap; gap: 4px; }
    .vital-box, .humanity-box {
      width: 22px;
      height: 22px;
      border: 1.5px solid var(--border-ink);
      border-radius: 3px;
      background: var(--bg-card);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .vital-box--agg, .humanity-box--filled { background: var(--accent-black); color: var(--ink-inverse); }
    .vital-box--lethal { background: var(--accent-wine); color: var(--ink-inverse); }
    .vital-box--bashing, .vital-box--sup, .humanity-box--stain { background: var(--accent-cream-badge); color: var(--accent-wine); border-style: dashed; }
    .v5-bp-summary, .v20-virtues-box { border: 1.5px solid var(--border-ink); border-radius: var(--radius-control); padding: 8px 10px; background: var(--bg-card-alt); display: flex; flex-direction: column; gap: 6px; }
    .bp-summary-title { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--accent-wine); text-transform: uppercase; }
    .bp-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .bp-stat-cell { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 6px; display: flex; flex-direction: column; gap: 2px; }
    .bp-k { font-family: var(--font-mono); font-size: 9px; font-weight: 700; color: var(--ink-muted); }
    .bp-v { font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--ink-primary); }
    .virtues-list { display: flex; flex-direction: column; gap: 4px; }
    .structured-dossier { display: flex; flex-direction: column; gap: 12px; }
    .structured-section { border: 1.5px solid var(--border-subtle); border-radius: var(--radius-control); padding: 10px; background: var(--bg-card-alt); display: flex; flex-direction: column; gap: 8px; }
    .structured-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .structured-heading { font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--accent-wine); }
    .structured-pill { font-family: var(--font-mono); font-size: 10px; font-weight: 700; border: 1px solid var(--accent-wine); background: var(--accent-cream-badge); color: var(--accent-wine); padding: 2px 7px; border-radius: 999px; }
    .structured-item { background: var(--bg-card); border: 1px solid var(--border-ink); border-radius: var(--radius-control); padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; break-inside: avoid; page-break-inside: avoid; }
    .structured-item-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .structured-title { font-family: var(--font-mono); font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .structured-notes { font-size: 11px; color: var(--ink-secondary); }
    .mf-badge { font-family: var(--font-mono); font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-ink); }
    .mf-badge.is-merit { background: var(--accent-cream-badge); color: var(--accent-wine); }
    .mf-badge.is-flaw { background: #FEE2E2; color: #8C1313; border-color: #8C1313; }
    .trait-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .trait-chip { font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 2px 6px; border: 1px solid var(--border-ink); border-radius: 999px; background: var(--bg-card-alt); }
    .trait-chip.is-flaw { border-style: dashed; color: #8C1313; border-color: #8C1313; }
    .cont-track { position: relative; height: 14px; background: var(--accent-wine-soft); border: 1.5px solid var(--border-ink); border-radius: 3px; overflow: hidden; }
    .cont-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent-wine); }
    .cont-track .tick { position: absolute; top: 0; bottom: 0; width: 1.5px; background: rgba(11,11,11,0.45); pointer-events: none; }
    .cont-track .t25 { left: 25%; }
    .cont-track .t50 { left: 50%; }
    .cont-track .t75 { left: 75%; }
    .bool-row { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .bool-native { display: none; }
    .bool-box { width: 22px; height: 22px; border: 2px solid var(--border-ink); border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; background: var(--accent-wine); color: var(--ink-inverse); }
    .bool-text { font-family: var(--font-mono); font-size: 12px; font-weight: 700; }
    .roll-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 9px 12px;
      background: var(--accent-black);
      color: var(--ink-inverse);
      border: 2px solid var(--accent-black);
      border-radius: var(--radius-control);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .cyber-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 12px; margin: 6px 0; }
    .cyber-table th, .cyber-table td { border-bottom: 1px solid var(--border-subtle); padding: 6px 4px; text-align: left; }
    .cyber-table th { font-size: 10px; color: var(--ink-muted); border-bottom: 1.5px solid var(--border-ink); }
    .add-row-btn { font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 6px 10px; border: 1.5px dashed var(--border-ink); background: transparent; border-radius: var(--radius-control); cursor: pointer; }
    .mono-meta { font-family: var(--font-mono); font-size: 10px; color: var(--ink-muted); }
    .sidebar {
      width: 260px;
      background: var(--bg-card);
      border-left: var(--border-width-strong) solid var(--border-ink);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sidebar-title { font-family: var(--font-mono); font-size: 12px; font-weight: 700; border-bottom: 1.5px solid var(--border-ink); padding-bottom: 8px; }
    .log-entry { border: 1.5px solid var(--border-ink); border-radius: var(--radius-control); padding: 10px; background: var(--bg-card-alt); }
    .log-top { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: var(--ink-muted); }
    .log-total { font-family: var(--font-display); font-size: 32px; font-weight: 800; line-height: 1.1; margin: 4px 0; }
    .log-formula { font-family: var(--font-mono); font-size: 11px; color: var(--ink-secondary); }
    .statusbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card);
      border-top: var(--border-width-strong) solid var(--border-ink);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      padding: 0 16px;
      height: 32px;
    }
    .status-access {
      background: var(--accent-wine);
      color: var(--ink-inverse);
      padding: 4px 18px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    @media (max-width: 760px) {
      .workspace { grid-template-columns: 1fr; }
      .sidebar { width: 100%; border-left: none; border-top: var(--border-width-strong) solid var(--border-ink); }
      .bento-grid, .wod-attr-grid-3x3, .bp-summary-grid { grid-template-columns: 1fr; }
      .bento-card.span-2 { grid-column: span 1; }
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      :root {
        --bg-canvas: #FFFFFF;
        --bg-card: #FFFFFF;
        --bg-card-alt: #F5F5F5;
        --bg-header-strip: #EFEFEF;
        --ink-primary: #0B0B0B;
        --ink-secondary: #1F1F1F;
        --ink-muted: #333333;
        --ink-inverse: #FFFFFF;
        --border-ink: #0B0B0B;
        --border-subtle: #0B0B0B;
        --accent-black: #0B0B0B;
        --accent-wine: #0B0B0B;
        --accent-wine-soft: #E5E5E5;
        --accent-cream-badge: #F0F0F0;
      }
      body { background: #FFFFFF !important; background-image: none !important; color: #0B0B0B !important; }
      .workspace { display: block !important; }
      .main-area { padding: 0 !important; overflow: visible !important; }
      .topbar, .tab-bar, .sidebar, .statusbar, .mini-btn, .add-row-btn, .del-btn, .act-cell, .roll-btn, .no-print {
        display: none !important;
      }
      .bento-card { box-shadow: none !important; break-inside: avoid !important; page-break-inside: avoid !important; }
      .structured-item { break-inside: avoid !important; page-break-inside: avoid !important; }
      .dot-pip.filled { color: #0B0B0B !important; }
      .vital-box--agg, .humanity-box--filled { background: #0B0B0B !important; color: #FFFFFF !important; }
      .vital-box--lethal { background: #333333 !important; color: #FFFFFF !important; }
      .vital-box--bashing, .vital-box--sup, .humanity-box--stain { background: #EFEFEF !important; color: #0B0B0B !important; border-style: dashed !important; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="sys-id">${escapeHtml(sheet.systemCode)}</div>
    <div class="toolbar-actions">
      <button class="btn-outline" type="button">${escapeHtml(i18n.topBar.newSheet)}</button>
      <button class="btn-outline" type="button">${escapeHtml(i18n.topBar.open)}</button>
      <button class="btn-outline" type="button">${escapeHtml(i18n.topBar.save)}</button>
      <div class="mode-switch">
        <button class="mode-btn play" type="button">${escapeHtml(i18n.topBar.playMode)}</button>
        <button class="mode-btn edit" type="button">${escapeHtml(i18n.topBar.editMode)}</button>
      </div>
    </div>
  </header>
  <div class="workspace">
    <main class="main-area">
      <div class="sheet-banner">
        <span class="sheet-banner-name">${escapeHtml(sheet.characterName)}</span>
        <span class="sheet-banner-sys">${escapeHtml(sheet.systemName)}</span>
      </div>
      <div class="tab-bar">
        <button class="tab-btn active" type="button">${escapeHtml(tabLabels.tab1)}</button>
        <button class="tab-btn" type="button">${escapeHtml(tabLabels.tab2)}</button>
      </div>
      <div class="bento-grid">
        ${cardsHtml}
        ${fallbackDossierHtml}
      </div>
    </main>
    <aside class="sidebar">
      <div class="sidebar-title">${escapeHtml(i18n.sidebar.rollLogsTab)}</div>
      ${logsHtml}
    </aside>
  </div>
  <footer class="statusbar">
    <span>${escapeHtml(i18n.statusBar.ready)}</span>
    <span class="status-access">${escapeHtml(i18n.statusBar.accessGranted)}</span>
    <span>${escapeHtml(i18n.statusBar.cargo)} ${escapeHtml(String(evaluation.totalCargoWeight))} KG</span>
  </footer>
  <script type="application/json" id="gridsheet-data">${serializeSafeEmbeddedJson(sheet)}</script>
</body>
</html>`;
}
