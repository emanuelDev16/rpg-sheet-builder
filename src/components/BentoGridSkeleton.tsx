import React from 'react';
import { AppLanguage, getTranslations } from '../core/i18n';

interface BentoGridSkeletonProps {
  language: AppLanguage;
}

const SKELETON_SHIMMER =
  'motion-safe:animate-pulse bg-[var(--bg-strip)] border border-[var(--border-subtle)] rounded-[var(--radius-pill)]';
const SKELETON_HEADER_BAR =
  'motion-safe:animate-pulse bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-pill)]';

export const BentoGridSkeleton: React.FC<BentoGridSkeletonProps> = ({ language }) => {
  const t = getTranslations(language);
  const loadingMessage = t.t('app.loadingWorkspace');

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingMessage}
      data-testid="bento-grid-skeleton"
      className="print-shell h-[100dvh] lg:h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden"
    >
      <span className="sr-only">{loadingMessage}</span>

      {/* TopBar skeleton matching TopBar height and 3-zone structure */}
      <header className="min-h-[54px] shrink-0 bg-[var(--bg-card)] border-b-[length:var(--border-width)] border-[var(--border-color)] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`${SKELETON_SHIMMER} h-8 w-20 shrink-0`} />
          <div className={`${SKELETON_SHIMMER} h-5 w-44 sm:w-56`} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`${SKELETON_SHIMMER} hidden sm:block h-8 w-36`} />
          <div className={`${SKELETON_SHIMMER} h-8 w-20`} />
          <div className={`${SKELETON_SHIMMER} hidden md:block h-8 w-24`} />
          <div className={`${SKELETON_SHIMMER} h-8 w-28`} />
        </div>
      </header>

      {/* Main BentoGrid + Right Sidebar skeleton */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="cyber-grid-canvas flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
          <div className="max-w-[1140px] mx-auto">
            {/* TabNav skeleton */}
            <div className="tabnav-root flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-5 max-w-full">
              <div className="flex items-center gap-2 sm:gap-2.5 max-w-full overflow-hidden">
                <div className="h-[36px] w-28 sm:w-44 shrink-0 bg-[var(--accent-black)]/15 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] motion-safe:animate-pulse" />
                <div className="h-[36px] w-28 sm:w-40 shrink-0 bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] motion-safe:animate-pulse" />
                <div className="h-[36px] w-20 sm:w-32 shrink-0 bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] motion-safe:animate-pulse" />
              </div>
              <div className={`${SKELETON_SHIMMER} h-5 w-44 sm:w-48 max-w-full`} />
            </div>

            {/* SearchBar skeleton */}
            <div className="mb-4 h-[40px] w-full bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] shadow-[var(--shadow-btn)] px-3 flex items-center justify-between gap-3">
              <div className={`${SKELETON_SHIMMER} h-3.5 w-48 sm:w-64`} />
              <div className={`${SKELETON_SHIMMER} h-3.5 w-16`} />
            </div>

            {/* BentoGrid 2-column card structure */}
            <div className="bento-print-grid grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Top full-span Identity BentoCard */}
              <section className="bento-card lg:col-span-2 bento-span-2" aria-hidden="true">
                <div className="bento-card-header">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`${SKELETON_HEADER_BAR} h-3.5 w-20`} />
                    <div className={`${SKELETON_HEADER_BAR} h-5 w-44`} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
                    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine-soft)]" />
                  </div>
                </div>
                <div className="bento-card-body p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 py-1">
                      <div className={`${SKELETON_SHIMMER} h-3.5 w-24`} />
                      <div className={`${SKELETON_SHIMMER} h-8 w-44 sm:w-52`} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Left column: Attributes BentoCard */}
              <section className="bento-card lg:col-span-1" aria-hidden="true">
                <div className="bento-card-header">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`${SKELETON_HEADER_BAR} h-3.5 w-20`} />
                    <div className={`${SKELETON_HEADER_BAR} h-5 w-40`} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
                    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine-soft)]" />
                  </div>
                </div>
                <div className="bento-card-body p-4 flex flex-col gap-3">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 py-0.5">
                      <div className={`${SKELETON_SHIMMER} h-3.5 w-28`} />
                      <div className={`${SKELETON_SHIMMER} h-8 w-20`} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Right column: Vital Status & Segmented Resource BentoCard */}
              <section className="bento-card lg:col-span-1" aria-hidden="true">
                <div className="bento-card-header">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`${SKELETON_HEADER_BAR} h-3.5 w-24`} />
                    <div className={`${SKELETON_HEADER_BAR} h-5 w-44`} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
                    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine-soft)]" />
                  </div>
                </div>
                <div className="bento-card-body p-4 flex flex-col gap-3">
                  {[7, 8].map((segCount, meterIdx) => (
                    <div
                      key={meterIdx}
                      className="p-2.5 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className={`${SKELETON_SHIMMER} h-3.5 w-24`} />
                        <div className={`${SKELETON_SHIMMER} h-5 w-20`} />
                      </div>
                      <div className="seg-meter-track flex items-center gap-[3px]">
                        {Array.from({ length: segCount }).map((_, segIdx) => (
                          <span
                            key={segIdx}
                            className="seg-block motion-safe:animate-pulse"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="h-[38px] w-full bg-[var(--accent-black)]/15 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] motion-safe:animate-pulse" />
                </div>
              </section>

              {/* Bottom Left: Skill Pools BentoCard */}
              <section className="bento-card lg:col-span-1" aria-hidden="true">
                <div className="bento-card-header">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`${SKELETON_HEADER_BAR} h-3.5 w-20`} />
                    <div className={`${SKELETON_HEADER_BAR} h-5 w-36`} />
                  </div>
                </div>
                <div className="bento-card-body p-4 flex flex-col gap-2.5">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="h-[36px] w-full bg-[var(--bg-card-alt)] border border-[var(--border-subtle)] rounded-[var(--radius-pill)] motion-safe:animate-pulse"
                    />
                  ))}
                </div>
              </section>

              {/* Bottom Right: Gear / Repeatable Table BentoCard */}
              <section className="bento-card lg:col-span-1" aria-hidden="true">
                <div className="bento-card-header">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`${SKELETON_HEADER_BAR} h-3.5 w-24`} />
                    <div className={`${SKELETON_HEADER_BAR} h-5 w-40`} />
                  </div>
                </div>
                <div className="bento-card-body p-4 flex flex-col gap-2">
                  <div className="border-[length:var(--border-width)] border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden">
                    <div className="h-8 bg-[var(--bg-strip)] border-b border-[var(--border-subtle)] px-3 flex items-center justify-between">
                      <div className={`${SKELETON_HEADER_BAR} h-3 w-20`} />
                      <div className={`${SKELETON_HEADER_BAR} h-3 w-16`} />
                    </div>
                    {[0, 1, 2].map((rowIdx) => (
                      <div
                        key={rowIdx}
                        className="h-10 px-3 border-b last:border-b-0 border-[var(--border-subtle)] flex items-center justify-between gap-3"
                      >
                        <div className={`${SKELETON_SHIMMER} h-3.5 w-36`} />
                        <div className={`${SKELETON_SHIMMER} h-3.5 w-12`} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>

        {/* Desktop Sidebar skeleton */}
        <aside
          aria-hidden="true"
          className="hidden lg:flex w-[340px] shrink-0 bg-[var(--bg-card)] border-l-[length:var(--border-width)] border-[var(--border-color)] flex-col min-h-0"
        >
          <div className="px-3 py-2.5 bg-[var(--bg-strip)] border-b-[length:var(--border-width)] border-[var(--border-color)] flex items-center gap-2">
            <div className={`${SKELETON_HEADER_BAR} h-7 w-28`} />
            <div className={`${SKELETON_HEADER_BAR} h-7 w-24`} />
          </div>
          <div className="p-3 border-b border-[var(--border-subtle)] flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className={`${SKELETON_SHIMMER} h-9 flex-1`} />
              <div className={`${SKELETON_SHIMMER} h-9 w-20`} />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className={`${SKELETON_SHIMMER} h-7`} />
              ))}
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="p-3 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className={`${SKELETON_SHIMMER} h-3.5 w-28`} />
                  <div className={`${SKELETON_SHIMMER} h-3 w-10`} />
                </div>
                <div className={`${SKELETON_SHIMMER} h-7 w-20`} />
                <div className={`${SKELETON_SHIMMER} h-3 w-full`} />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* StatusBar skeleton */}
      <footer
        aria-hidden="true"
        className="h-[34px] shrink-0 bg-[var(--bg-card)] border-t-[length:var(--border-width)] border-[var(--border-color)] px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 overflow-hidden"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`${SKELETON_SHIMMER} h-3 w-32 sm:w-40`} />
        </div>
        <div className={`${SKELETON_SHIMMER} hidden sm:block h-5 w-32 shrink-0`} />
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className={`${SKELETON_SHIMMER} h-3 w-10 sm:w-12`} />
          <div className={`${SKELETON_SHIMMER} h-3 w-12 sm:w-14`} />
          <div className={`${SKELETON_SHIMMER} h-4 w-16 sm:w-20`} />
        </div>
      </footer>
    </div>
  );
};
