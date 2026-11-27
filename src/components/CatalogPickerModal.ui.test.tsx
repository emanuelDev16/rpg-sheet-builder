import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogPickerModal } from './CatalogPickerModal';
import {
  matchesCatalogFilters,
  matchesCatalogQuery,
  type SystemCatalog,
  type SystemCatalogItem,
} from '../core/systems/catalogTypes';

function makeItem(id: string, sectionId: string, overrides: Partial<SystemCatalogItem> = {}): SystemCatalogItem {
  return {
    id,
    sectionId,
    name: { 'pt-BR': `Item ${id}`, en: `Item ${id}`, es: `Elemento ${id}` },
    summary: { 'pt-BR': `Resumo ${id}`, en: `Summary ${id}`, es: `Resumen ${id}` },
    ...overrides,
  };
}

const SAMPLE_CATALOG: SystemCatalog = {
  systemId: 'test-sys',
  attribution: 'SRD 5.1 CC-BY-4.0',
  sections: [
    {
      id: 'spells',
      label: { 'pt-BR': 'Magias', en: 'Spells', es: 'Conjuros' },
      filterGroups: [
        {
          id: 'circle',
          label: { 'pt-BR': 'Círculo', en: 'Circle', es: 'Círculo' },
          options: [
            { value: '1', label: { 'pt-BR': '1º', en: '1st', es: '1º' } },
            { value: '3', label: { 'pt-BR': '3º', en: '3rd', es: '3º' } },
          ],
        },
        {
          id: 'concentration',
          label: { 'pt-BR': 'Concentração', en: 'Concentration', es: 'Concentración' },
          options: [{ value: 'true', label: { 'pt-BR': 'Sim', en: 'Yes', es: 'Sí' } }],
        },
      ],
      items: [
        makeItem('fireball', 'spells', {
          name: { 'pt-BR': 'Bola de Fogo', en: 'Fireball', es: 'Bola de Fuego' },
          summary: { 'pt-BR': 'Explosão ígnea', en: 'Fiery blast', es: 'Explosión ígnea' },
          costLabel: { 'pt-BR': '3º Círculo', en: '3rd Level', es: 'Nivel 3' },
          badges: ['EVOCAÇÃO'],
          meta: { circle: '3', concentration: false },
        }),
        makeItem('bless', 'spells', {
          name: { 'pt-BR': 'Bênção', en: 'Bless', es: 'Bendición' },
          summary: { 'pt-BR': 'Bônus de ataque', en: 'Attack bonus', es: 'Bono de ataque' },
          costLabel: { 'pt-BR': '1º Círculo', en: '1st Level', es: 'Nivel 1' },
          meta: { circle: '1', concentration: true },
        }),
      ],
    },
    {
      id: 'cyberware',
      label: { 'pt-BR': 'Ciberware', en: 'Cyberware', es: 'Ciberware' },
      items: [
        makeItem('sandevistan', 'cyberware', {
          name: { 'pt-BR': 'Ação Rápida', en: 'Reflex Boost', es: 'Acción Rápida' },
          summary: { 'pt-BR': 'Reflexo neural', en: 'Neural reflex', es: 'Reflejo neural' },
        }),
      ],
    },
  ],
};

describe('CatalogPickerModal UI (JSDOM)', () => {
  it('supports lazy loading resolution and error state', async () => {
    let resolveFn!: (val: SystemCatalog) => void;
    const loader = vi.fn(() => new Promise<SystemCatalog>((resolve) => { resolveFn = resolve; }));

    const { rerender } = render(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        loadCatalog={loader}
        existingItemKeys={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Carregando catálogo...');
    resolveFn(SAMPLE_CATALOG);
    await waitFor(() => expect(screen.getByTestId('catalog-item-fireball')).toBeTruthy());

    const failingLoader = vi.fn(() => Promise.reject(new Error('network')));
    rerender(
      <CatalogPickerModal
        isOpen
        lang="en"
        loadCatalog={failingLoader}
        existingItemKeys={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Failed to load catalog.'));
    expect(screen.queryByTestId('catalog-item-fireball')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('catalog-picker-search')).toBeNull();
  });

  it('switches sections, applies dynamic filters, and searches accent-insensitively in pt-BR, en, and es', () => {
    const { rerender } = render(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        catalog={SAMPLE_CATALOG}
        existingItemKeys={new Set()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const spellsTab = screen.getByTestId('catalog-section-tab-spells');
    const cyberTab = screen.getByTestId('catalog-section-tab-cyberware');
    expect(spellsTab.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByTestId('catalog-filter-circle-1'));
    expect(screen.queryByTestId('catalog-item-fireball')).toBeNull();
    expect(screen.getByTestId('catalog-item-bless')).toBeTruthy();

    fireEvent.click(screen.getByTestId('catalog-filter-circle-1'));
    expect(screen.getByTestId('catalog-item-fireball')).toBeTruthy();

    const search = screen.getByTestId('catalog-picker-search');
    fireEvent.change(search, { target: { value: 'bencao' } });
    expect(screen.getByTestId('catalog-item-bless')).toBeTruthy();
    expect(screen.queryByTestId('catalog-item-fireball')).toBeNull();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(cyberTab);
    expect(cyberTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('catalog-item-sandevistan')).toBeTruthy();

    for (const [lang, query] of [
      ['pt-BR', 'acao rapida'],
      ['en', 'reflex boost'],
      ['es', 'accion rapida'],
    ] as const) {
      rerender(
        <CatalogPickerModal
          isOpen
          lang={lang}
          catalog={SAMPLE_CATALOG}
          initialSectionId="cyberware"
          existingItemKeys={new Set()}
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByTestId('catalog-picker-search'), { target: { value: query } });
      expect(screen.getByTestId('catalog-item-sandevistan')).toBeTruthy();
    }
  });

  it('marks existing items with JÁ NA FICHA, blocks duplicates by default, and supports allowDuplicates', () => {
    const onSelect = vi.fn();
    const onAddCustom = vi.fn();
    const { rerender } = render(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        catalog={SAMPLE_CATALOG}
        existingItemKeys={new Set(['fireball'])}
        onSelect={onSelect}
        onAddCustom={onAddCustom}
        onClose={vi.fn()}
      />,
    );

    const fireballRow = screen.getByTestId('catalog-item-fireball');
    expect(within(fireballRow).getByText('JÁ NA FICHA')).toBeTruthy();
    const fireballBtn = screen.getByTestId('catalog-select-fireball');
    expect(fireballBtn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(fireballBtn);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('catalog-select-bless'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe('bless');

    fireEvent.click(screen.getByTestId('catalog-add-custom-btn'));
    expect(onAddCustom).toHaveBeenCalledWith('spells');

    rerender(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        catalog={SAMPLE_CATALOG}
        existingItemKeys={new Set(['fireball'])}
        allowDuplicates
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    const allowedBtn = screen.getByTestId('catalog-select-fireball');
    expect(allowedBtn.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(allowedBtn);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('paginates > 60 items incrementally and enforces dialog accessibility + IME Escape guard', () => {
    const largeCatalog: SystemCatalog = {
      systemId: 'large',
      sections: [
        {
          id: 'all',
          label: { 'pt-BR': 'Todos', en: 'All', es: 'Todos' },
          items: Array.from({ length: 75 }, (_, i) => makeItem(`it-${i + 1}`, 'all')),
        },
      ],
    };
    const onClose = vi.fn();
    render(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        catalog={largeCatalog}
        existingItemKeys={new Set()}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getAllByRole('listitem')).toHaveLength(60);

    fireEvent.click(screen.getByTestId('catalog-show-more-btn'));
    expect(screen.getAllByRole('listitem')).toHaveLength(75);

    const search = screen.getByLabelText('Buscar no catálogo');
    expect(search.getAttribute('autocorrect')).toBe('off');
    expect(search.getAttribute('autocapitalize')).toBe('none');
    expect(search.getAttribute('spellcheck')).toBe('false');

    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('type')).toBe('button');
    }

    fireEvent.keyDown(window, { key: 'Escape', keyCode: 229 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders item.badges, WCAG aria-label, normalizes existingItemKeys, and preserves query/tab across existingItemKeys updates', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        catalog={SAMPLE_CATALOG}
        existingItemKeys={new Set(['Bênção'])}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    expect(within(screen.getByTestId('catalog-item-fireball')).getByText('EVOCAÇÃO')).toBeTruthy();
    expect(screen.getByTestId('catalog-select-fireball').getAttribute('aria-label')).toBe('ADICIONAR Bola de Fogo');
    expect(within(screen.getByTestId('catalog-item-bless')).getByText('JÁ NA FICHA')).toBeTruthy();
    expect(screen.getByTestId('catalog-select-bless').getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByTestId('catalog-section-tab-cyberware'));
    fireEvent.change(screen.getByTestId('catalog-picker-search'), { target: { value: 'acao' } });

    rerender(
      <CatalogPickerModal
        isOpen
        lang="pt-BR"
        catalog={SAMPLE_CATALOG}
        existingItemKeys={new Set(['Bênção', 'sandevistan'])}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('catalog-section-tab-cyberware').getAttribute('aria-selected')).toBe('true');
    expect((screen.getByTestId('catalog-picker-search') as HTMLInputElement).value).toBe('acao');
    expect(within(screen.getByTestId('catalog-item-sandevistan')).getByText('JÁ NA FICHA')).toBeTruthy();
  });

  it('guards matchesCatalogFilters and matchesCatalogQuery against prototype keys and hostile objects', () => {
    const hostileObj = Object.create(null) as unknown as string;
    const item = makeItem('cantrip', 'spells', {
      level: 0,
      tags: ['truque', hostileObj],
      meta: {
        classes: ['Mago', hostileObj as unknown as string],
        concentration: true,
        hostile: { toString: null } as unknown as string,
      },
    });

    expect(matchesCatalogQuery(item, 'truque')).toBe(true);
    expect(matchesCatalogFilters(item, { toString: 'function', constructor: 'Object' })).toBe(false);
    expect(matchesCatalogFilters(item, { hostile: 'anything' })).toBe(false);
    expect(matchesCatalogFilters(item, { level: '0', classes: 'mago', concentration: 'true' })).toBe(true);
    expect(matchesCatalogFilters(item, { tagMatch: 'TRUQUE' })).toBe(true);
  });
});
