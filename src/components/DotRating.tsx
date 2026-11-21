import React, { useEffect, useRef, useState } from 'react';
import { AppTranslations, getTranslations } from '../core/i18n';
import {
  DotRatingScale,
  resolveDotClickValue,
  resolveDotKeyboardValue,
} from '../utils/dotRating';

export interface DotRatingProps {
  label: string;
  value: number;
  min?: number;
  max?: DotRatingScale;
  onChange: (nextValue: number) => void;
  disabled?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  t?: AppTranslations['cards'];
  showQuickEdit?: boolean;
  testId?: string;
}

const DEFAULT_CARDS_T = getTranslations('pt-BR').cards;

export const DotRating: React.FC<DotRatingProps> = ({
  label,
  value,
  min = 0,
  max = 5,
  onChange,
  disabled = false,
  compact = false,
  ariaLabel,
  t = DEFAULT_CARDS_T,
  showQuickEdit = true,
  testId,
}) => {
  const safeMin = Math.max(0, Math.min(max, Math.round(min)));
  const clampedValue = Math.max(
    safeMin,
    Math.min(max, Number.isFinite(value) ? Math.round(value) : safeMin),
  );

  const [isQuickEditing, setIsQuickEditing] = useState(false);
  const [draft, setDraft] = useState(String(clampedValue));
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const quickEditBtnRef = useRef<HTMLButtonElement | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isQuickEditing) {
      setDraft(String(clampedValue));
    }
  }, [clampedValue, isQuickEditing]);

  useEffect(() => {
    if (isQuickEditing) {
      quickInputRef.current?.focus();
      quickInputRef.current?.select();
    }
  }, [isQuickEditing]);

  const activeFocusDot = clampedValue > 0 ? clampedValue : 1;
  const dots = Array.from({ length: max }, (_, idx) => idx + 1);
  const groupAriaLabel =
    ariaLabel ??
    t.t('fields.dotRating.groupAria', {
      label,
      value: clampedValue,
      max,
    });

  const handleGroupKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const next = resolveDotKeyboardValue(clampedValue, e.key, safeMin, max);
    if (next === null) return;
    e.preventDefault();
    if (next !== clampedValue) {
      onChange(next);
    }
    const targetDot = next > 0 ? next : 1;
    dotRefs.current[targetDot - 1]?.focus();
  };

  const commitQuickEdit = () => {
    setIsQuickEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === '-') {
      setDraft(String(clampedValue));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(String(clampedValue));
      return;
    }
    const clamped = Math.max(safeMin, Math.min(max, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped !== clampedValue) {
      onChange(clamped);
    }
  };

  return (
    <div
      data-testid={testId}
      className={`dot-rating ${compact ? 'is-compact' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      <div
        role="group"
        aria-label={groupAriaLabel}
        onKeyDown={handleGroupKeyDown}
        className={`dot-rating-group ${max === 10 ? 'dot-rating-group--ten' : 'dot-rating-group--five'} ${compact ? 'is-compact' : ''}`}
      >
        {dots.map((dot) => {
          const filled = dot <= clampedValue;
          const willDecrease = dot === clampedValue && clampedValue > safeMin;
          const nextValueIfClicked = resolveDotClickValue(clampedValue, dot, safeMin, max);
          const dotAria = willDecrease
            ? t.t('fields.dotRating.decreaseDotAria', {
                label,
                dot,
                max,
                next: nextValueIfClicked,
              })
            : t.t('fields.dotRating.setDotAria', {
                label,
                dot,
                max,
              });

          return (
            <button
              key={dot}
              ref={(el) => {
                dotRefs.current[dot - 1] = el;
              }}
              type="button"
              tabIndex={disabled ? -1 : dot === activeFocusDot ? 0 : -1}
              disabled={disabled}
              aria-pressed={filled}
              aria-label={dotAria}
              data-testid={testId ? `${testId}-dot-${dot}` : undefined}
              onClick={() => {
                if (disabled) return;
                if (nextValueIfClicked !== clampedValue) {
                  onChange(nextValueIfClicked);
                }
              }}
              className={`dot-rating-btn ${max === 10 && dot === 5 ? 'dot-rating-btn--group-break' : ''}`}
            >
              <span className="dot-rating-pip" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {showQuickEdit &&
        (isQuickEditing ? (
          <input
            ref={quickInputRef}
            type="number"
            min={safeMin}
            max={max}
            disabled={disabled}
            aria-label={t.t('fields.dotRating.quickInputAria', {
              label,
              min: safeMin,
              max,
            })}
            data-testid={testId ? `${testId}-quick-input` : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitQuickEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitQuickEdit();
                window.setTimeout(() => quickEditBtnRef.current?.focus(), 0);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(String(clampedValue));
                setIsQuickEditing(false);
                window.setTimeout(() => quickEditBtnRef.current?.focus(), 0);
              }
            }}
            className="cyber-input mobile-touch-input dot-rating-quick-input"
          />
        ) : (
          <button
            ref={quickEditBtnRef}
            type="button"
            disabled={disabled}
            aria-label={t.t('fields.dotRating.quickEditAria', {
              label,
              value: clampedValue,
              max,
            })}
            data-testid={testId ? `${testId}-value-btn` : undefined}
            onClick={() => {
              if (disabled) return;
              setDraft(String(clampedValue));
              setIsQuickEditing(true);
            }}
            className="dot-rating-value-btn"
          >
            {clampedValue}
          </button>
        ))}
    </div>
  );
};
