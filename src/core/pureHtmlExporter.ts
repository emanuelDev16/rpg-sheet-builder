import { type CharacterSheetState, detectSystemId, evaluateSheet, resolveRollPreview } from './sheetModel.ts';
import { type AppLanguage, getLocalizedTabLabels, getTranslations, LANGUAGE_OPTIONS } from './i18n.ts';

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
  --ink-muted: #6E6258;
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateSingleFilePureHtml(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): string {
  const i18n = getTranslations(lang);
  const t = i18n.t;
  const htmlLang = LANGUAGE_OPTIONS.find((opt) => opt.id === lang)?.htmlLang ?? 'pt-BR';
  const tabLabels = getLocalizedTabLabels(detectSystemId(sheet), lang);
  const evaluation = evaluateSheet(sheet);
  const cardsHtml = sheet.cards
    .map((card) => {
      const spanClass = card.colSpan === 2 ? 'bento-card span-2' : 'bento-card';
      const fieldsHtml = card.fields
        .map((field) => {
          if (field.kind === 'number' || field.kind === 'text') {
            return `
          <div class="field-row">
            <label class="field-label">${escapeHtml(field.label)}</label>
            <input class="cyber-input" type="${field.kind === 'number' ? 'number' : 'text'}" value="${escapeHtml(String(field.value ?? ''))}" />
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
            const val = Number(field.value ?? 0);
            const max = field.max ?? 12;
            const blocks = Array.from({ length: max }, (_, idx) => {
              const filled = idx < val ? 'seg-block filled' : 'seg-block';
              return `<span class="${filled}"></span>`;
            }).join('');
            return `
          <div class="resource-box">
            <div class="resource-head">
              <span class="field-label">${escapeHtml(field.label)}</span>
              <div class="resource-controls">
                <button class="mini-btn" type="button">-</button>
                <span class="resource-count">${val} / ${max}</span>
                <button class="mini-btn" type="button">+</button>
              </div>
            </div>
            <div class="seg-track">${blocks}</div>
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
              <span class="mono-meta">${escapeHtml(t('cards.cargoBadge'))} ${evaluation.totalCargoWeight} KG</span>
            </div>
            <table class="cyber-table">
              <thead>
                <tr>
                  <th>${escapeHtml(field.columns?.[0] ?? t('cards.defaultItemCol'))}</th>
                  <th>${escapeHtml(field.columns?.[1] ?? t('cards.defaultValueCol'))}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <button class="add-row-btn" type="button">${escapeHtml(t('print.pureHtmlAddRow'))}</button>
          </div>`;
          }
          return '';
        })
        .join('\n');

      return `
        <section class="${spanClass}" data-tab="${card.tab}">
          <header class="card-header">
            <span class="card-code">${escapeHtml(card.code)}</span>
            <h2 class="card-title">${escapeHtml(card.title)}</h2>
          </header>
          <div class="card-body">
            ${fieldsHtml}
          </div>
        </section>`;
    })
    .join('\n');

  const logsHtml = sheet.rollLogs
    .map(
      (log) => `
      <div class="log-entry">
        <div class="log-top">
          <span class="log-label">${escapeHtml(log.label)}</span>
          <span class="log-time">${escapeHtml(log.timestamp)}</span>
        </div>
        <div class="log-total">${log.total}</div>
        <div class="log-formula">${escapeHtml(log.breakdown)}</div>
      </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(sheet.systemName)} — ${escapeHtml(t('print.pureHtmlTitleSuffix'))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@500;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
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
    .field-label { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--ink-secondary); }
    .cyber-input {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      padding: 6px 10px;
      border: var(--border-width) solid var(--border-ink);
      border-radius: var(--radius-control);
      background: var(--bg-card-alt);
      width: 140px;
    }
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
    .resource-head { display: flex; justify-content: space-between; align-items: center; }
    .resource-controls { display: flex; align-items: center; gap: 6px; }
    .resource-count { font-family: var(--font-mono); font-size: 12px; font-weight: 700; }
    .mini-btn { width: 24px; height: 24px; border: 1.5px solid var(--border-ink); background: var(--bg-card); font-family: var(--font-mono); font-weight: 700; border-radius: 4px; cursor: pointer; }
    .seg-track { display: flex; gap: 3px; height: 14px; }
    .seg-block { flex: 1; background: var(--accent-wine-soft); border: 1px solid rgba(91,15,24,0.28); border-radius: 2px; }
    .seg-block.filled { background: var(--accent-wine); border-color: var(--accent-wine); }
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
      <div class="tab-bar">
        <button class="tab-btn active" type="button">${escapeHtml(tabLabels.tab1)}</button>
        <button class="tab-btn" type="button">${escapeHtml(tabLabels.tab2)}</button>
      </div>
      <div class="bento-grid">
        ${cardsHtml}
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
    <span>${escapeHtml(i18n.statusBar.cargo)} ${evaluation.totalCargoWeight} KG</span>
  </footer>
</body>
</html>`;
}
