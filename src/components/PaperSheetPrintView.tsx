import { useMemo } from 'react';
import { type AppLanguage } from '../core/i18n';
import {
  buildPaperSheetModel,
  type PaperDotRow,
  type PaperDnd5eModel,
  type PaperExtraCard,
  type PaperFieldItem,
  type PaperSheetModel,
  type PaperTrack,
  type PaperTrackBox,
  type PaperWodV20Model,
  type PaperWodV5Model,
  type PaperXpSummary,
} from '../core/paperSheetModel';
import { type CharacterSheetState } from '../core/sheetModel';
import {
  DEFAULT_PAPER_PRINT_STYLE,
  isValidPaperPrintStyle,
  type PaperPrintStyle,
} from '../core/printSheet';

export interface PaperSheetPrintViewProps {
  sheet: CharacterSheetState;
  language: AppLanguage;
  printStyle?: PaperPrintStyle;
}

function isSafeHttpUrl(raw?: string): string {
  if (!raw) return '';
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function PaperDots({ value, max }: { value: number; max: 5 | 10 }) {
  const clamped = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <span className={`paper-dots${max === 10 ? ' is-ten' : ''}`} aria-label={`${clamped} / ${max}`}>
      {Array.from({ length: max }, (_, idx) => (
        <span
          key={idx}
          className={`paper-dot ${idx < clamped ? 'filled' : 'empty'}${max === 10 && idx === 5 ? ' is-gap' : ''}`}
        >
          {idx < clamped ? '●' : '○'}
        </span>
      ))}
    </span>
  );
}

function GroupedBoxes({ boxes }: { boxes: PaperTrackBox[] }) {
  const groups: PaperTrackBox[][] = [];
  for (let i = 0; i < boxes.length; i += 5) {
    groups.push(boxes.slice(i, i + 5));
  }
  return (
    <div className="paper-boxes-row">
      {groups.map((grp, gIdx) => (
        <span key={gIdx} className="paper-box-group">
          {grp.map((box, idx) => (
            <span key={idx} className={`paper-box paper-box--${box.kind}`} title={box.title}>
              {box.symbol}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function PaperTrackView({ track }: { track: PaperTrack }) {
  return (
    <div className="paper-track-block paper-block" data-testid={track.testId}>
      <div className="paper-track-head">
        <span>
          {track.label}
          {track.badge ? <span className="paper-badge"> {track.badge}</span> : null}
        </span>
        <span>{track.summary}</span>
      </div>
      {track.isContinuous ? (
        <div className="paper-cont-track">
          <div className="paper-cont-fill" style={{ width: `${(track.pct ?? 0).toFixed(1)}%` }} />
          <span className="tick t25" />
          <span className="tick t50" />
          <span className="tick t75" />
        </div>
      ) : (
        <GroupedBoxes boxes={track.boxes} />
      )}
      {track.legend ? <div className="paper-legend">{track.legend}</div> : null}
    </div>
  );
}

function PaperFieldView({ field }: { field: PaperFieldItem }) {
  if (field.kind === 'dots' && field.dots) {
    return (
      <div className="paper-dot-row">
        <span className="paper-dot-label">{field.label}</span>
        <PaperDots value={field.dots.value} max={field.dots.max} />
      </div>
    );
  }
  if (field.kind === 'resource' && field.track) {
    return <PaperTrackView track={field.track} />;
  }
  if (field.kind === 'repeatable' && field.table) {
    return (
      <div className="paper-block">
        <div className="paper-track-head">
          <span>{field.label}</span>
          {field.table.cargoBadge ? <span>{field.table.cargoBadge}</span> : null}
        </div>
        <table className="paper-table">
          <thead>
            <tr>
              <th>{field.table.col1Header}</th>
              <th>{field.table.col2Header}</th>
            </tr>
          </thead>
          <tbody>
            {field.table.rows.map((row, idx) => (
              <tr key={idx}>
                <td>{row.col1}</td>
                <td>{row.col2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const safeUrl = isSafeHttpUrl(field.rawUrl);
  return (
    <div className="paper-field-line">
      <span className="paper-dot-label">{field.label}</span>
      <span className="paper-field-val">
        {field.value}
        {safeUrl ? (
          <>
            {' '}
            <a className="paper-link" href={safeUrl} rel="noopener noreferrer">
              ↗
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}

function PaperExtraCardView({ card }: { card: PaperExtraCard }) {
  return (
    <section className={`paper-card ${card.colSpan === 2 ? 'span-2' : ''}`}>
      <header className="paper-card-head">
        {card.code ? <span className="paper-card-tag">{card.code}</span> : null}
        <h3 className="paper-card-title">{card.title}</h3>
      </header>
      <div>
        {card.fields.map((field) => (
          <PaperFieldView key={field.id} field={field} />
        ))}
      </div>
    </section>
  );
}

function PaperXpSection({
  xp,
  labels,
}: {
  xp: PaperXpSummary;
  labels: PaperSheetModel['labels'];
}) {
  return (
    <div className="paper-block">
      <div className="paper-sec-rule">{labels.xpSection}</div>
      <div className="paper-xp-row">
        <span>
          {labels.xpTotal}: {xp.totalEarned}
        </span>
        <span>
          {labels.xpSpent}: {xp.spent}
        </span>
        <span>
          {labels.xpAvailable}: {xp.available}
        </span>
      </div>
      {xp.recentEntries.length > 0 ? (
        <table className="paper-table">
          <tbody>
            {xp.recentEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.label}</td>
                <td>{entry.delta >= 0 ? `+${entry.delta}` : entry.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function WodOrnamentDivider() {
  return (
    <svg className="paper-wod-ornament" viewBox="0 0 220 12" aria-hidden="true">
      <line x1="0" y1="6" x2="88" y2="6" stroke="currentColor" strokeWidth="0.9" />
      <path d="M96 6 L110 1.5 L124 6 L110 10.5 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="110" cy="6" r="2" fill="currentColor" />
      <circle cx="91" cy="6" r="1.4" fill="currentColor" />
      <circle cx="129" cy="6" r="1.4" fill="currentColor" />
      <line x1="132" y1="6" x2="220" y2="6" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  );
}

function DndOrnamentDivider() {
  return (
    <svg className="paper-dnd-ornament" viewBox="0 0 220 10" aria-hidden="true">
      <line x1="0" y1="5" x2="96" y2="5" stroke="currentColor" strokeWidth="1" />
      <polygon points="110,1 116,5 110,9 104,5" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="124" y1="5" x2="220" y2="5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function DndAcShield({ value, label }: { value: string; label: string }) {
  return (
    <div className="paper-ac-wrap">
      <svg className="paper-ac-shield" viewBox="0 0 48 54" aria-hidden="true">
        <path
          d="M24 2 L44 9 V25 C44 38 35 47 24 52 C13 47 4 38 4 25 V9 Z"
          fill="#FFF"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M24 5.5 L40 11.2 V24.5 C40 35.5 32.5 43.2 24 47.6 C15.5 43.2 8 35.5 8 24.5 V11.2 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        />
      </svg>
      <span className="paper-ac-val">{value}</span>
      <span className="paper-ac-lbl">{label}</span>
    </div>
  );
}

function PaperDotList({
  items,
  showRuledSpecialty = false,
}: {
  items: PaperDotRow[];
  showRuledSpecialty?: boolean;
}) {
  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className="paper-dot-row">
          <span className="paper-dot-label-wrap">
            <span className="paper-dot-label">{item.label || '________________'}</span>
            {showRuledSpecialty ? (
              <span className="paper-specialty-line">{item.specialty ?? ''}</span>
            ) : item.specialty ? (
              <span className="paper-specialty">({item.specialty})</span>
            ) : null}
          </span>
          <PaperDots value={item.value} max={item.max} />
        </div>
      ))}
    </div>
  );
}

function PaperPageHeader({
  model,
  pageNumber,
}: {
  model: PaperSheetModel;
  pageNumber: number;
}) {
  return (
    <header className="paper-header">
      <div className="paper-header-main">
        <div className="paper-editorial-title">{model.sheetTitle}</div>
        <div className="paper-editorial-sub">{model.sheetSubtitle}</div>
      </div>
      <div className="paper-page-num">
        {model.labels.pageLabel} {pageNumber} / {model.pageCount}
      </div>
    </header>
  );
}

function WodV5Pages({ model, data }: { model: PaperSheetModel; data: PaperWodV5Model }) {
  const { page1, page2 } = data;
  const { labels } = model;
  return (
    <>
      <article className="paper-page paper-layout--wod-v5 paper-page-v5-front" data-paper-page="1">
        <PaperPageHeader model={model} pageNumber={1} />
        <WodOrnamentDivider />
        <div className="paper-id-grid-3x3">
          {page1.header3x3.map((cell) => (
            <div key={cell.key} className="paper-id-cell">
              <span className="paper-id-k">{cell.label}:</span>
              <span className="paper-id-v">{cell.value}</span>
            </div>
          ))}
        </div>

        <div className="paper-sec-rule">{labels.attributes}</div>
        <div className="wod-attr-grid-3x3 paper-divided-3">
          {page1.attributes3x3.map((grp) => (
            <div key={grp.id} className="paper-col-box paper-col-divided paper-block">
              <div className="paper-col-head">{grp.title}</div>
              <PaperDotList items={grp.items} />
            </div>
          ))}
        </div>

        <div className="paper-sec-rule">{labels.skills}</div>
        <div className="paper-cols-3 paper-divided-3">
          {page1.skills3Col.map((grp) => (
            <div key={grp.id} className="paper-col-box paper-col-divided paper-block">
              <div className="paper-col-head">{grp.title}</div>
              <PaperDotList items={grp.items} showRuledSpecialty />
            </div>
          ))}
        </div>

        <div className="paper-cols-3 paper-v5-strip" style={{ marginTop: '4px' }}>
          <div className="paper-col-box paper-block">
            <div className="paper-col-head">{labels.chronicleTenets}</div>
            {page1.middleStrip3Col.chronicleTenets.map((line, idx) => (
              <div key={idx} className="paper-ruled-line">
                {line}
              </div>
            ))}
          </div>
          <div className="paper-col-box paper-block">
            <div className="paper-col-head">{labels.convictionsSummary}</div>
            {page1.middleStrip3Col.convictionsSummary.map((ts) => (
              <div key={ts.id} className="paper-ruled-pair">
                <span>{ts.conviction}</span>
                <span className="paper-specialty">{ts.touchstone}</span>
              </div>
            ))}
          </div>
          <div className="paper-col-box paper-block">
            <div className="paper-col-head">
              <span>{page1.middleStrip3Col.bane.label}</span>
              <span className="paper-badge">{page1.middleStrip3Col.bane.severityBadge}</span>
            </div>
            <div className="paper-ruled-text">{page1.middleStrip3Col.bane.value}</div>
            <div className="paper-col-head" style={{ marginTop: '3px' }}>
              {page1.middleStrip3Col.compulsion.label}
            </div>
            <div className="paper-ruled-text">{page1.middleStrip3Col.compulsion.value}</div>
          </div>
        </div>

        <div className="paper-v5-bottom" style={{ marginTop: '4px' }}>
          <div>
            <div className="paper-sec-rule">{labels.disciplines}</div>
            <div className="paper-disc-grid">
              {page1.disciplines.map((disc) => (
                <div key={disc.id} className="paper-disc-box">
                  <div className="paper-col-head">
                    <span className="paper-disc-name">{disc.label || '________________'}</span>
                    <PaperDots value={disc.value} max={5} />
                  </div>
                  {disc.slots.map((slot) => (
                    <div key={slot.level} className="paper-disc-slot">
                      <span className="paper-disc-slot-name">
                        {slot.level}. {slot.name}
                      </span>
                      {slot.cost ? <span className="paper-disc-cost">{slot.cost}</span> : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <PaperTrackView track={page1.vitalColumn.health} />
            <PaperTrackView track={page1.vitalColumn.willpower} />
            <PaperTrackView track={page1.vitalColumn.humanity} />
            <div className="paper-track-block paper-block">
              <div className="paper-track-head">
                <span>{page1.vitalColumn.hunger.label}</span>
                <span>{page1.vitalColumn.hunger.value} / 5</span>
              </div>
              <GroupedBoxes boxes={page1.vitalColumn.hunger.boxes} />
            </div>
            <div className="paper-track-block paper-block" data-testid={page1.vitalColumn.bloodPotency.testId}>
              <div className="paper-track-head">
                <span>{page1.vitalColumn.bloodPotency.title}</span>
                <PaperDots value={page1.vitalColumn.bloodPotency.level} max={10} />
              </div>
              <div className="paper-bp-grid">
                {page1.vitalColumn.bloodPotency.stats.map((st, idx) => (
                  <div key={idx} className="paper-bp-cell">
                    <span className="paper-bp-k">{st.label}</span>
                    <span className="paper-bp-v">{st.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="paper-cols-2 paper-v5-res-hunt">
              <div className="paper-id-cell">
                <span className="paper-id-k">{page1.vitalColumn.resonance.label}:</span>
                <span className="paper-id-v">{page1.vitalColumn.resonance.value}</span>
              </div>
              <div className="paper-id-cell">
                <span className="paper-id-k">{page1.vitalColumn.hunting.label}:</span>
                <span className="paper-id-v">{page1.vitalColumn.hunting.value}</span>
              </div>
            </div>
          </div>
        </div>
        <WodOrnamentDivider />
      </article>

      <article className="paper-page paper-layout--wod-v5" data-paper-page="2">
        <PaperPageHeader model={model} pageNumber={2} />
        <WodOrnamentDivider />
        <div className="paper-card" data-testid={page2.meritsFlaws.testId}>
          <div className="paper-card-head">
            <span className="paper-card-title">{page2.meritsFlaws.heading}</span>
            <span className="paper-badge">{page2.meritsFlaws.summary}</span>
          </div>
          <div className="paper-cols-2">
            <div>
              <div className="paper-col-head">{labels.backgroundsMerits}</div>
              {page2.backgrounds.length > 0 ? <PaperDotList items={page2.backgrounds} /> : null}
              {page2.merits.map((mf) => (
                <div key={mf.id} className="paper-structured-item">
                  <div className="paper-dot-row">
                    <span>{mf.name}</span>
                    <PaperDots value={mf.rating} max={5} />
                  </div>
                  {mf.notes ? <div className="paper-legend">{mf.notes}</div> : null}
                </div>
              ))}
            </div>
            <div>
              <div className="paper-col-head">{labels.flaws}</div>
              {page2.flaws.map((mf) => (
                <div key={mf.id} className="paper-structured-item">
                  <div className="paper-dot-row">
                    <span>{mf.name}</span>
                    <PaperDots value={mf.rating} max={5} />
                  </div>
                  {mf.notes ? <div className="paper-legend">{mf.notes}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="paper-cols-2">
          <div>
            <div className="paper-card" data-testid={page2.havens.testId}>
              <div className="paper-card-head">
                <span className="paper-card-title">{page2.havens.heading}</span>
                <span className="paper-badge">{page2.havens.countLabel}</span>
              </div>
              {page2.havens.items.map((hv) => (
                <div key={hv.id} className="paper-structured-item">
                  <div className="paper-dot-row">
                    <span>
                      {hv.name}
                      {hv.location ? ` · ${hv.location}` : ''}
                    </span>
                    <PaperDots value={hv.rating} max={5} />
                  </div>
                  {hv.traits.length > 0 ? (
                    <div className="paper-legend">{hv.traits.map((tr) => tr.label).join(' · ')}</div>
                  ) : null}
                  {hv.notes ? <div className="paper-legend">{hv.notes}</div> : null}
                </div>
              ))}
            </div>

            {page2.equipment.length > 0 ? (
              <div className="paper-card">
                <div className="paper-card-head">
                  <span className="paper-card-title">{labels.equipment}</span>
                </div>
                {page2.equipment.map((eq) => (
                  <PaperFieldView key={eq.id} field={eq} />
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="paper-card" data-testid={page2.touchstones.testId}>
              <div className="paper-card-head">
                <span className="paper-card-title">{page2.touchstones.heading}</span>
                <span className="paper-badge">{page2.touchstones.counter}</span>
              </div>
              {page2.touchstones.items.map((ts) => (
                <div key={ts.id} className="paper-structured-item">
                  <div className="paper-dot-row">
                    <strong>{ts.conviction}</strong>
                    <span className="paper-badge">{ts.touchstone}</span>
                  </div>
                  {ts.notes ? <div className="paper-legend">{ts.notes}</div> : null}
                </div>
              ))}
            </div>

            <PaperXpSection xp={page2.xpSummary} labels={labels} />

            {page2.notes.length > 0 ? (
              <div className="paper-block">
                <div className="paper-sec-rule">{labels.notes}</div>
                {page2.notes.map((note) => (
                  <div key={note.id} className="paper-note-box">
                    <strong>{note.label}: </strong>
                    {note.value}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {page2.extraCards.length > 0 ? (
          <>
            <div className="paper-sec-rule">{labels.extraSections}</div>
            <div className="paper-generic-grid">
              {page2.extraCards.map((card) => (
                <PaperExtraCardView key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : null}
      </article>
    </>
  );
}

function WodV20Pages({ model, data }: { model: PaperSheetModel; data: PaperWodV20Model }) {
  const { page1, page2 } = data;
  const { labels } = model;
  return (
    <>
      <article className="paper-page paper-layout--wod-v20" data-paper-page="1">
        <PaperPageHeader model={model} pageNumber={1} />
        <WodOrnamentDivider />
        <div className="paper-id-grid-3x3">
          {page1.header3x3.map((cell) => (
            <div key={cell.key} className="paper-id-cell">
              <span className="paper-id-k">{cell.label}:</span>
              <span className="paper-id-v">{cell.value}</span>
            </div>
          ))}
        </div>

        <div className="paper-sec-rule">{labels.attributes}</div>
        <div className="wod-attr-grid-3x3 paper-divided-3">
          {page1.attributes3x3.map((grp) => (
            <div key={grp.id} className="paper-col-box paper-col-divided paper-block">
              <div className="paper-col-head">{grp.title}</div>
              <PaperDotList items={grp.items} />
            </div>
          ))}
        </div>

        <div className="paper-sec-rule">{labels.abilities}</div>
        <div className="paper-cols-3 paper-divided-3">
          {page1.abilities3Col.map((grp) => (
            <div key={grp.id} className="paper-col-box paper-col-divided paper-block">
              <div className="paper-col-head">{grp.title}</div>
              <PaperDotList items={grp.items} />
            </div>
          ))}
        </div>

        <div className="paper-sec-rule">{labels.advantages}</div>
        <div className="paper-cols-3 paper-divided-3">
          <div className="paper-col-box paper-col-divided paper-block">
            <div className="paper-col-head">{labels.disciplines}</div>
            <PaperDotList items={page1.advantages3Col.disciplines} />
          </div>
          <div className="paper-col-box paper-col-divided paper-block">
            <div className="paper-col-head">{labels.backgrounds}</div>
            <PaperDotList items={page1.advantages3Col.backgrounds} />
          </div>
          <div className="paper-col-box paper-block" data-testid={page1.advantages3Col.virtues.testId}>
            <div className="paper-col-head">{page1.advantages3Col.virtues.heading}</div>
            <PaperDotList items={page1.advantages3Col.virtues.items} />
          </div>
        </div>

        <div className="paper-cols-3 paper-v20-bottom" style={{ marginTop: '4px' }}>
          <div className="paper-block">
            <div className="paper-track-block">
              <div className="paper-track-head">
                <span>{page1.bottom3Col.humanity.label}</span>
                <PaperDots value={page1.bottom3Col.humanity.value} max={10} />
              </div>
            </div>
            <div className="paper-track-block">
              <div className="paper-track-head">
                <span>{page1.bottom3Col.willpower.label}</span>
                <span>
                  {page1.bottom3Col.willpower.value} / {page1.bottom3Col.willpower.max}
                </span>
              </div>
              <GroupedBoxes boxes={page1.bottom3Col.willpower.boxes} />
            </div>
            <PaperTrackView track={page1.bottom3Col.bloodPool} />
            <div className="paper-legend">
              {page1.bottom3Col.bloodPool.maxPerTurnLabel}: {page1.bottom3Col.bloodPool.maxPerTurn}
            </div>
          </div>

          <div className="paper-track-block paper-block" data-testid={page1.bottom3Col.health.testId}>
            <div className="paper-track-head">
              <span>{page1.bottom3Col.health.label}</span>
              <span>{page1.bottom3Col.health.summary}</span>
            </div>
            <table className="paper-health-table">
              <tbody>
                {page1.bottom3Col.health.levels.map((lvl, idx) => (
                  <tr key={idx}>
                    <td>{lvl.label}</td>
                    <td>{lvl.penalty}</td>
                    <td>
                      <span className={`paper-box paper-box--${lvl.box.kind}`}>{lvl.box.symbol}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="paper-track-head" style={{ marginTop: '3px' }}>
              <span>{page1.bottom3Col.health.soakLabel}</span>
              <span>{page1.bottom3Col.health.soakValue}</span>
            </div>
          </div>

          <div className="paper-block">
            <div className="paper-col-box" style={{ marginBottom: '4px' }}>
              <div className="paper-col-head">{page1.bottom3Col.clanWeakness.label}</div>
              <div className="paper-ruled-text">{page1.bottom3Col.clanWeakness.value}</div>
            </div>
            <div className="paper-xp-row">
              <span>
                {labels.xpTotal}: {page1.bottom3Col.xpCompact.totalEarned}
              </span>
              <span>
                {labels.xpAvailable}: {page1.bottom3Col.xpCompact.available}
              </span>
            </div>
          </div>
        </div>
        <WodOrnamentDivider />
      </article>

      <article className="paper-page paper-layout--wod-v20" data-paper-page="2">
        <PaperPageHeader model={model} pageNumber={2} />
        <WodOrnamentDivider />
        <div className="paper-cols-2">
          <div>
            <div className="paper-card" data-testid={page2.meritsFlaws.testId}>
              <div className="paper-card-head">
                <span className="paper-card-title">{page2.meritsFlaws.heading}</span>
                <span className="paper-badge">{page2.meritsFlaws.summary}</span>
              </div>
              {page2.meritsFlaws.items.map((mf) => (
                <div key={mf.id} className="paper-structured-item">
                  <div className="paper-dot-row">
                    <span>
                      <span className="paper-badge">{mf.badge}</span> {mf.name}
                    </span>
                    <PaperDots value={mf.rating} max={5} />
                  </div>
                </div>
              ))}
            </div>

            <div className="paper-card" data-testid={page2.havens.testId}>
              <div className="paper-card-head">
                <span className="paper-card-title">{page2.havens.heading}</span>
                <span className="paper-badge">{page2.havens.countLabel}</span>
              </div>
              {page2.havens.items.map((hv) => (
                <div key={hv.id} className="paper-structured-item">
                  <div className="paper-dot-row">
                    <span>{hv.name}</span>
                    <PaperDots value={hv.rating} max={5} />
                  </div>
                  {hv.traits.length > 0 ? (
                    <div className="paper-legend">{hv.traits.map((tr) => tr.label).join(' · ')}</div>
                  ) : null}
                </div>
              ))}
            </div>

            <PaperXpSection xp={page2.xpSummary} labels={labels} />
          </div>

          <div>
            <div className="paper-card">
              <div className="paper-card-head">
                <span className="paper-card-title">{labels.powersRituals}</span>
              </div>
              {page2.powersRituals.map((f) => (
                <PaperFieldView key={f.id} field={f} />
              ))}
            </div>

            <div className="paper-card">
              <div className="paper-card-head">
                <span className="paper-card-title">{labels.combatEquipment}</span>
              </div>
              {page2.combatEquipment.map((f) => (
                <PaperFieldView key={f.id} field={f} />
              ))}
            </div>

            {page2.notes.map((n) => (
              <div key={n.id} className="paper-note-box">
                <strong>{n.label}: </strong>
                {n.value}
              </div>
            ))}
          </div>
        </div>

        {page2.extraCards.length > 0 ? (
          <>
            <div className="paper-sec-rule">{labels.extraSections}</div>
            <div className="paper-generic-grid">
              {page2.extraCards.map((card) => (
                <PaperExtraCardView key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : null}
      </article>
    </>
  );
}

function Dnd5ePages({ model, data }: { model: PaperSheetModel; data: PaperDnd5eModel }) {
  const { page1, page2, page3 } = data;
  const { labels } = model;
  return (
    <>
      <article className="paper-page paper-layout--dnd5e" data-paper-page="1">
        <PaperPageHeader model={model} pageNumber={1} />
        <DndOrnamentDivider />
        <div className="paper-dnd-banner">
          <div>
            <div className="paper-id-k">{labels.classLevel}</div>
            <div className="paper-id-v">{page1.identityBanner.classLevel}</div>
          </div>
          <div>
            <div className="paper-id-k">{labels.race}</div>
            <div className="paper-id-v">{page1.identityBanner.race}</div>
          </div>
          <div>
            <div className="paper-id-k">{labels.alignment}</div>
            <div className="paper-id-v">{page1.identityBanner.alignment}</div>
          </div>
          <div>
            <div className="paper-id-k">{labels.xpSection}</div>
            <div className="paper-id-v">{page1.identityBanner.xpTotal}</div>
          </div>
          <div>
            <div className="paper-id-k">{labels.proficiencyBonus}</div>
            <div className="paper-id-v">{page1.identityBanner.proficiencyBonus}</div>
          </div>
        </div>

        <div className="paper-dnd-grid">
          <div>
            <div className="paper-sec-rule">{labels.attributes}</div>
            {page1.col1.abilities.map((ab) => (
              <div key={ab.key} className="paper-ability-medallion">
                <div>
                  <div className="paper-id-k">{ab.label}</div>
                  <div className="paper-ability-score">{ab.score}</div>
                </div>
                <div className="paper-ability-mod">{ab.modifier}</div>
              </div>
            ))}

            <div className="paper-sec-rule">{labels.savingThrows}</div>
            <div className="paper-col-box">
              {page1.col1.savingThrows.map((st) => (
                <div key={st.key} className="paper-dot-row">
                  <span>
                    {st.proficient ? '●' : '○'} {st.label}
                  </span>
                  <strong>{st.modifier}</strong>
                </div>
              ))}
            </div>

            <div className="paper-sec-rule">{labels.skills}</div>
            <div className="paper-col-box">
              {page1.col1.skills18.map((sk) => (
                <div key={sk.key} className="paper-dot-row">
                  <span>
                    {sk.proficiency === 'expertise' ? '◎' : sk.proficient ? '●' : '○'} {sk.label}{' '}
                    <span className="paper-specialty">({sk.abilityShort})</span>
                  </span>
                  <strong>{sk.modifier}</strong>
                </div>
              ))}
            </div>

            <div className="paper-xp-row" style={{ marginTop: '4px' }}>
              <span>{labels.passivePerception}</span>
              <span>{page1.col1.passivePerception}</span>
            </div>
          </div>

          <div>
            <div className="paper-sec-rule">{labels.armorClass}</div>
            <DndAcShield value={page1.col2.armorClass} label={labels.armorClass} />

            <div className="paper-card">
              <div className="paper-dot-row">
                <span>{page1.col2.hitPoints.label}</span>
                <strong>
                  {page1.col2.hitPoints.current} / {page1.col2.hitPoints.max}
                </strong>
              </div>
              <div className="paper-dot-row">
                <span>{labels.tempHp}</span>
                <span>{page1.col2.hitPoints.temp ? <strong>{page1.col2.hitPoints.temp}</strong> : '__________'}</span>
              </div>
              <div className="paper-dot-row">
                <span>{page1.col2.hitDice.label}</span>
                <strong>
                  {page1.col2.hitDice.current} / {page1.col2.hitDice.max}
                </strong>
              </div>
              <div className="paper-dot-row">
                <span>{labels.deathSuccesses}</span>
                <span>
                  {Array.from({ length: 3 }, (_, idx) => (
                    <span
                      key={idx}
                      className={`paper-death-circle${idx < page1.col2.deathSaves.successes ? ' is-filled' : ''}`}
                    />
                  ))}
                </span>
              </div>
              <div className="paper-dot-row">
                <span>{labels.deathFailures}</span>
                <span>
                  {Array.from({ length: 3 }, (_, idx) => (
                    <span
                      key={idx}
                      className={`paper-death-circle${idx < page1.col2.deathSaves.failures ? ' is-filled' : ''}`}
                    />
                  ))}
                </span>
              </div>
            </div>

            <div className="paper-sec-rule">{labels.attacks}</div>
            <div className="paper-card">
              {page1.col2.attacks.map((atk) => (
                <div key={atk.id} className="paper-dot-row">
                  <span>{atk.name}</span>
                  <strong>{atk.expr}</strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="paper-card">
              <div className="paper-dot-row">
                <span>{labels.inspiration}</span>
                <strong>{page1.col3.inspiration ? '✓' : '○'}</strong>
              </div>
              <div className="paper-dot-row">
                <span>{labels.initiative}</span>
                <strong>{page1.col3.initiative}</strong>
              </div>
              <div className="paper-dot-row">
                <span>{labels.speed}</span>
                <strong>{page1.col3.speed}</strong>
              </div>
              {page1.col3.classResources.map((res) => (
                <PaperFieldView key={res.id} field={res} />
              ))}
            </div>

            <div className="paper-sec-rule">{labels.currency}</div>
            <div className="paper-currency-grid" style={{ marginBottom: '5px' }}>
              {page1.col3.currency.map((c) => (
                <div key={c.code} className="paper-currency-cell">
                  <strong>{c.code}</strong>
                  <div>{c.value || '—'}</div>
                </div>
              ))}
            </div>

            <div className="paper-sec-rule">{labels.equipment}</div>
            <div className="paper-card">
              {page1.col3.equipment.map((eq) => (
                <PaperFieldView key={eq.id} field={eq} />
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="paper-page paper-layout--dnd5e" data-paper-page="2">
        <PaperPageHeader model={model} pageNumber={2} />
        <DndOrnamentDivider />
        <div className="paper-sec-rule">{labels.biographyNotes}</div>
        {page2.notes.map((n) => (
          <div key={n.id} className="paper-note-box">
            <strong>{n.label}: </strong>
            {n.value}
          </div>
        ))}
        <PaperXpSection xp={page2.xpSummary} labels={labels} />
        {page2.extraCards.length > 0 ? (
          <>
            <div className="paper-sec-rule">{labels.extraSections}</div>
            <div className="paper-generic-grid">
              {page2.extraCards.map((card) => (
                <PaperExtraCardView key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : null}
      </article>

      {page3 ? (
        <article className="paper-page paper-layout--dnd5e" data-paper-page="3">
          <PaperPageHeader model={model} pageNumber={3} />
          <DndOrnamentDivider />
          <div className="paper-sec-rule">{labels.spellcasting}</div>
          <div className="paper-xp-row">
            <span>
              {labels.spellSaveDc}: {page3.spellDc}
            </span>
            <span>
              {labels.spellAttack}: {page3.spellAtk}
            </span>
            <span>
              {labels.concentration}: {page3.concentration ? '✓' : '—'}
            </span>
          </div>
          <div className="paper-cols-2">
            <div>
              <div className="paper-sec-rule">{labels.spellSlots}</div>
              {page3.slots.map((slot, idx) => (
                <PaperTrackView key={idx} track={slot} />
              ))}
              {page3.spellRolls.map((r) => (
                <div key={r.id} className="paper-dot-row">
                  <span>{r.name}</span>
                  <strong>{r.expr}</strong>
                </div>
              ))}
            </div>
            <div>
              <div className="paper-sec-rule">{labels.grimoire}</div>
              {page3.grimoire.map((g) => (
                <PaperFieldView key={g.id} field={g} />
              ))}
            </div>
          </div>
        </article>
      ) : null}
    </>
  );
}

function GenericPages({ model }: { model: PaperSheetModel }) {
  const pages = model.generic?.pages ?? [];
  return (
    <>
      {pages.map((page) => (
        <article
          key={page.pageNumber}
          className="paper-page paper-layout--generic"
          data-paper-page={page.pageNumber}
        >
          <PaperPageHeader model={model} pageNumber={page.pageNumber} />
          <div className="paper-sec-rule">{page.tabLabel}</div>
          <div className="paper-generic-grid">
            {page.cards.map((card) => (
              <PaperExtraCardView key={card.id} card={card} />
            ))}
          </div>
          {page.xpSummary ? <PaperXpSection xp={page.xpSummary} labels={model.labels} /> : null}
        </article>
      ))}
    </>
  );
}

export function PaperSheetPrintView({ sheet, language, printStyle }: PaperSheetPrintViewProps) {
  const model = useMemo(() => buildPaperSheetModel(sheet, language), [sheet, language]);
  const activeStyle: PaperPrintStyle =
    printStyle && isValidPaperPrintStyle(printStyle) ? printStyle : DEFAULT_PAPER_PRINT_STYLE;
  return (
    <div
      className="paper-print-root"
      data-testid="paper-print-root"
      data-paper-layout={model.layout}
      data-print-style={activeStyle}
    >
      {model.layout === 'wod-v5' && model.wodV5 ? (
        <WodV5Pages model={model} data={model.wodV5} />
      ) : null}
      {model.layout === 'wod-v20' && model.wodV20 ? (
        <WodV20Pages model={model} data={model.wodV20} />
      ) : null}
      {model.layout === 'dnd5e' && model.dnd5e ? (
        <Dnd5ePages model={model} data={model.dnd5e} />
      ) : null}
      {model.layout === 'generic' ? <GenericPages model={model} /> : null}
    </div>
  );
}
