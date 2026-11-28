import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CyberpunkCyberwarePanel } from './CyberpunkCyberwarePanel';
import { CyberpunkWeaponsPanel } from './CyberpunkWeaponsPanel';
import { createDefaultCyberpunkState, type CyberpunkState } from '../../core/cyberpunkRules';
import { getTranslations } from '../../core/i18n';
import { createFreshSheetForSystem, type CharacterSheetState } from '../../core/sheetModel';
import { useCyberpunkHandlers } from '../../hooks/useCyberpunkHandlers';

const i18n = getTranslations('pt-BR');

const Harness: React.FC<{ initialOverrides?: Partial<CyberpunkState> }> = ({ initialOverrides }) => {
  const [sheet, setSheet] = useState<CharacterSheetState>(() => {
    const base = createFreshSheetForSystem('cyberpunk');
    return {
      ...base,
      cyberpunkState: { ...createDefaultCyberpunkState(), ...base.cyberpunkState, ...initialOverrides },
    };
  });
  const handlers = useCyberpunkHandlers({ updateSheet: (updater) => setSheet((prev) => updater(prev)), t: i18n });
  const cpState = sheet.cyberpunkState ?? createDefaultCyberpunkState();
  return (
    <>
      <CyberpunkWeaponsPanel
        cyberpunkState={cpState}
        t={i18n}
        handleFireWeapon={handlers.handleFireWeapon}
        handleReloadWeapon={handlers.handleReloadWeapon}
        handleAddWeapon={handlers.handleAddWeapon}
        handleRemoveWeapon={handlers.handleRemoveWeapon}
      />
      <CyberpunkCyberwarePanel
        cyberpunkState={cpState}
        t={i18n}
        handleAddCyberware={handlers.handleAddCyberware}
        handleUpdateCyberware={handlers.handleUpdateCyberware}
        handleRemoveCyberware={handlers.handleRemoveCyberware}
      />
    </>
  );
};

describe('CyberpunkWeaponsPanel & CyberpunkCyberwarePanel UI (JSDOM)', () => {
  it('fires, reloads, enforces out-of-ammo aria-disabled, adds with IME guard, removes, and respects 20-weapon cap', () => {
    const weapon = { id: 'wpn_1', name: 'Malorian 3516', skillKey: 'handgun', damageFormula: '5d6', rof: 2, ammoCurrent: 1, ammoMax: 4 };
    render(<Harness initialOverrides={{ weapons: [weapon] }} />);

    expect(screen.getByTestId('cp-weapon-damage-wpn_1').textContent).toContain('5d6');
    expect(screen.getByTestId('cp-weapon-rof-wpn_1').textContent).toContain('ROF 2');
    expect(screen.getByTestId('cp-weapon-ammo-wpn_1').textContent).toBe('1 / 4');

    const fireBtn = screen.getByTestId('cp-weapon-fire-wpn_1');
    fireEvent.click(fireBtn);
    expect(screen.getByTestId('cp-weapon-ammo-wpn_1').textContent).toBe('0 / 4');
    expect(fireBtn.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('cp-weapon-empty-badge-wpn_1')).toBeTruthy();

    fireEvent.click(fireBtn);
    expect(screen.getByTestId('cp-weapon-ammo-wpn_1').textContent).toBe('0 / 4');

    const reloadBtn = screen.getByTestId('cp-weapon-reload-wpn_1');
    fireEvent.click(reloadBtn);
    expect(screen.getByTestId('cp-weapon-ammo-wpn_1').textContent).toBe('4 / 4');
    expect(reloadBtn.getAttribute('aria-disabled')).toBe('true');

    const nameInput = screen.getByTestId('cp-weapon-name-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Unity' } });
    fireEvent(nameInput, new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
    expect(screen.getAllByTestId(/^cp-weapon-row-/)).toHaveLength(1);

    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(screen.getAllByTestId(/^cp-weapon-row-/)).toHaveLength(2);
    expect(nameInput.value).toBe('');

    fireEvent.click(screen.getByTestId('cp-weapon-remove-wpn_1'));
    expect(screen.queryByTestId('cp-weapon-row-wpn_1')).toBeNull();

    for (const btn of screen.getAllByRole('button')) expect(btn.getAttribute('type')).toBe('button');
  });

  it('prevents clearing input when at 20-weapon cap', () => {
    const fullWeapons = Array.from({ length: 20 }, (_, i) => ({
      id: `w_${i}`, name: `Arm ${i}`, skillKey: 'handgun', damageFormula: '2d6', rof: 1, ammoCurrent: 8, ammoMax: 8,
    }));
    render(<Harness initialOverrides={{ weapons: fullWeapons }} />);
    const nameInput = screen.getByTestId('cp-weapon-name-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Overflow Gun' } });
    const addBtn = screen.getByTestId('cp-weapon-add-btn');
    expect(addBtn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(addBtn);
    expect(nameInput.value).toBe('Overflow Gun');
    expect(screen.getAllByTestId(/^cp-weapon-row-/)).toHaveLength(20);
  });

  it('tracks humanity, triggers cyberpsychosis alert at EMP <= 2, edits inline, and removes cyberware', () => {
    render(<Harness initialOverrides={{ humanity: { current: 60, max: 60, baseEmp: 6 }, cyberware: [] }} />);
    expect(screen.getByTestId('cp-humanity-value').textContent).toBe('60 / 60');
    expect(screen.getByTestId('cp-effective-emp-value').textContent).toBe('6');
    expect(screen.queryByTestId('cp-cyberpsychosis-badge')).toBeNull();

    fireEvent.change(screen.getByTestId('cp-cyberware-name-input'), { target: { value: 'Sandevistan' } });
    fireEvent.change(screen.getByTestId('cp-cyberware-slot-input'), { target: { value: 'neural' } });
    fireEvent.change(screen.getByTestId('cp-cyberware-hl-input'), { target: { value: '30' } });
    fireEvent.change(screen.getByTestId('cp-cyberware-notes-input'), { target: { value: 'Reflex boost' } });
    fireEvent.click(screen.getByTestId('cp-cyberware-add-btn'));

    expect(screen.getByTestId('cp-humanity-value').textContent).toBe('30 / 60');
    expect(screen.getByTestId('cp-effective-emp-value').textContent).toBe('3');
    expect(screen.queryByTestId('cp-cyberpsychosis-badge')).toBeNull();

    fireEvent.change(screen.getByTestId('cp-cyberware-name-input'), { target: { value: 'Mantis Blades' } });
    fireEvent.change(screen.getByTestId('cp-cyberware-hl-input'), { target: { value: '14' } });
    fireEvent.click(screen.getByTestId('cp-cyberware-add-btn'));

    expect(screen.getByTestId('cp-humanity-value').textContent).toBe('16 / 60');
    expect(screen.getByTestId('cp-effective-emp-value').textContent).toBe('1');
    const alert = screen.getByTestId('cp-cyberpsychosis-badge');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(within(alert).getByText(i18n.t('cyberpunk.cyberware.cyberpsychosisRisk'))).toBeTruthy();

    const rows = screen.getAllByTestId(/^cp-cyberware-row-/);
    const firstId = rows[0].getAttribute('data-testid')!.replace('cp-cyberware-row-', '');
    fireEvent.click(screen.getByTestId(`cp-cyberware-edit-${firstId}`));
    fireEvent.change(screen.getByTestId(`cp-cyberware-edit-name-${firstId}`), { target: { value: 'Sandevistan Mk.IV' } });
    fireEvent.change(screen.getByTestId(`cp-cyberware-edit-hl-${firstId}`), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId(`cp-cyberware-edit-notes-${firstId}`), { target: { value: '' } });
    fireEvent.click(screen.getByTestId(`cp-cyberware-save-${firstId}`));

    expect(screen.getByTestId(`cp-cyberware-row-${firstId}`).textContent).toContain('Sandevistan Mk.IV');
    expect(screen.getByTestId('cp-humanity-value').textContent).toBe('36 / 60');
    expect(screen.getByTestId('cp-effective-emp-value').textContent).toBe('3');
    expect(screen.queryByTestId('cp-cyberpsychosis-badge')).toBeNull();

    fireEvent.click(screen.getByTestId(`cp-cyberware-remove-${firstId}`));
    expect(screen.queryByTestId(`cp-cyberware-row-${firstId}`)).toBeNull();
    expect(screen.getByTestId('cp-humanity-value').textContent).toBe('46 / 60');
  });
});
