import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dnd5eProgressionWorkspace } from './Dnd5eProgressionWorkspace';
import {
  createDefaultDnd5eProgression,
  type Dnd5eProgressionState,
} from '../../core/dnd5eProgression';
import { createDefaultDnd5eState } from '../../core/dnd5eRules';
import { getTranslations } from '../../core/i18n';
import { type CharacterSheetState, createFreshSheetForSystem } from '../../core/sheetModel';

const t = getTranslations('pt-BR').t;

function buildDnd5eSheet(
  level = 1,
  progOverrides: Partial<Dnd5eProgressionState> = {},
): CharacterSheetState {
  const base = createFreshSheetForSystem('dnd5e');
  const dnd5eBase = base.dnd5eState ?? createDefaultDnd5eState({ level });
  return {
    ...base,
    dnd5eState: {
      ...dnd5eBase,
      level,
      hitDice: { ...dnd5eBase.hitDice, max: level, current: level },
      progression: createDefaultDnd5eProgression(progOverrides),
    },
  };
}

const Harness: React.FC<{ initialSheet: CharacterSheetState }> = ({ initialSheet }) => {
  const [sheet, setSheet] = useState(initialSheet);
  return (
    <Dnd5eProgressionWorkspace
      sheet={sheet}
      t={t}
      onUpdateSheet={(updater) => setSheet((prev) => updater(prev))}
      onAppendRollLog={() => {}}
    />
  );
};

describe('Dnd5eProgressionWorkspace UI (JSDOM)', () => {
  it('toggles XP <-> Por Sessão / Marco without losing xpTotal', () => {
    render(<Harness initialSheet={buildDnd5eSheet(1, { mode: 'xp', xpTotal: 0 })} />);

    fireEvent.click(screen.getByTestId('dnd5e-quick-xp-100'));
    expect(screen.getByTestId('dnd5e-prog-xp-total').textContent).toBe('100');

    fireEvent.click(screen.getByTestId('dnd5e-mode-milestone'));
    expect(screen.getByTestId('dnd5e-mode-milestone').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dnd5e-mode-xp').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('dnd5e-milestone-panel')).toBeTruthy();

    fireEvent.click(screen.getByTestId('dnd5e-mode-xp'));
    expect(screen.getByTestId('dnd5e-mode-xp').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('dnd5e-milestone-panel')).toBeNull();
    expect(screen.getByTestId('dnd5e-prog-xp-total').textContent).toBe('100');
  });

  it('switches Meta de Sessões <-> Marco Livre and preserves adjusted sessionsPerLevel', () => {
    render(
      <Harness
        initialSheet={buildDnd5eSheet(2, { mode: 'milestone', milestoneStyle: 'sessions', sessionsPerLevel: 3 })}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByTestId('dnd5e-sessions-target-value').textContent).toBe('3');

    fireEvent.click(screen.getByTestId('dnd5e-sessions-target-inc'));
    fireEvent.click(screen.getByTestId('dnd5e-sessions-target-inc'));
    fireEvent.click(screen.getByTestId('dnd5e-sessions-target-dec'));
    expect(screen.getByTestId('dnd5e-sessions-target-value').textContent).toBe('4');

    fireEvent.click(screen.getByTestId('dnd5e-milestone-style-free'));
    expect(screen.getByTestId('dnd5e-milestone-style-free').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dnd5e-milestone-style-sessions').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByTestId('dnd5e-sessions-target-value')).toBeNull();

    fireEvent.click(screen.getByTestId('dnd5e-milestone-style-sessions'));
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByTestId('dnd5e-sessions-target-value').textContent).toBe('4');
  });

  it('logs session and free milestone with distinct badges and atomically undoes only the milestone', () => {
    render(<Harness initialSheet={buildDnd5eSheet(3, { mode: 'milestone', milestoneStyle: 'free' })} />);

    const noteInput = screen.getByLabelText(t('dnd5e.prog.milestoneNoteLabel'));
    fireEvent.change(noteInput, { target: { value: 'Sessão 1 — Taverna' } });
    fireEvent.click(screen.getByTestId('dnd5e-log-session-btn'));

    fireEvent.change(noteInput, { target: { value: 'Derrotou o Dragão' } });
    fireEvent.click(screen.getByTestId('dnd5e-log-milestone-btn'));

    const itemsBefore = screen.getAllByRole('listitem');
    expect(itemsBefore).toHaveLength(2);
    expect(within(itemsBefore[0]).getByText(t('dnd5e.prog.entryMilestoneBadge'))).toBeTruthy();
    expect(itemsBefore[0].textContent).toContain('Derrotou o Dragão');
    expect(itemsBefore[0].textContent).not.toMatch(/NV\s+\d+\s*→/);
    expect(within(itemsBefore[1]).getByText(t('dnd5e.prog.entrySessionBadge', { count: 1 }))).toBeTruthy();
    expect(itemsBefore[1].textContent).toContain('Sessão 1 — Taverna');

    fireEvent.click(screen.getByTestId('dnd5e-prog-undo-btn'));
    const itemsAfter = screen.getAllByRole('listitem');
    expect(itemsAfter).toHaveLength(1);
    expect(itemsAfter[0].textContent).toContain('Sessão 1 — Taverna');
    expect(screen.queryByText('Derrotou o Dragão')).toBeNull();
  });

  it('shows maxLevelReached without subtitle on goal card and disables level-up at level 20', () => {
    render(
      <Harness
        initialSheet={buildDnd5eSheet(20, {
          mode: 'milestone',
          milestoneStyle: 'sessions',
          sessionsPerLevel: 3,
          sessionsCount: 3,
        })}
      />,
    );

    const goalCard = screen.getByText(t('dnd5e.prog.milestoneGoal')).parentElement!;
    expect(within(goalCard).getByText(t('dnd5e.prog.maxLevelReached'))).toBeTruthy();
    expect(goalCard.children).toHaveLength(2);
    expect(within(goalCard).queryByText(t('dnd5e.prog.readyToLevelShort'))).toBeNull();
    expect(screen.getByTestId('dnd5e-levelup-confirm-btn').getAttribute('aria-disabled')).toBe('true');
  });

  it('enforces type="button" on all buttons and valid aria-pressed toggles across modes', () => {
    render(<Harness initialSheet={buildDnd5eSheet(1, { mode: 'xp' })} />);

    const assertAllButtonsTyped = () => {
      for (const btn of screen.getAllByRole('button')) {
        expect(btn.getAttribute('type')).toBe('button');
      }
    };

    assertAllButtonsTyped();
    expect(screen.getByTestId('dnd5e-mode-xp').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dnd5e-mode-milestone').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByTestId('dnd5e-mode-milestone'));
    assertAllButtonsTyped();
    expect(screen.getByTestId('dnd5e-mode-milestone').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dnd5e-milestone-style-sessions').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dnd5e-milestone-style-free').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByTestId('dnd5e-milestone-style-free'));
    assertAllButtonsTyped();
    expect(screen.getByTestId('dnd5e-milestone-style-free').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dnd5e-milestone-style-sessions').getAttribute('aria-pressed')).toBe('false');
  });
});
