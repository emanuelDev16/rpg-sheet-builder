import React from 'react';
import { THEME_OPTIONS, ThemeMode } from '../utils/theme';

interface ThemeSelectorProps {
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  theme,
  onChangeTheme,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Selecionar tema visual"
      data-testid="theme-selector"
      className={`inline-flex items-stretch border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden bg-[var(--bg-card)] shrink-0 ${className}`.trim()}
    >
      {THEME_OPTIONS.map((opt, idx) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            data-testid={`theme-option-${opt.id}`}
            onClick={() => onChangeTheme(opt.id)}
            className={`theme-selector-btn font-mono-tech min-h-[36px] px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-75 ${
              idx > 0 ? 'border-l-[length:var(--border-width)] border-[var(--border-color)]' : ''
            } ${
              isActive
                ? 'is-theme-active bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
