import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSheet, createPresetBySystemId } from './sheetModel.ts';
import { SheetsStore } from './sheetsStore.ts';
import {
  createSuspenseResource,
  hydrateWorkspaceFromStore,
  loadInitialWorkspaceBootstrap,
  withSafeXpState,
} from './workspaceHydration.ts';

test('withSafeXpState seeds default chronicle XP when missing and preserves valid XP state', () => {
  const sheet = createDefaultSheet();
  const withoutXp = { ...sheet, xp: undefined };
  const seeded = withSafeXpState(withoutXp);
  assert.ok(seeded.xp);
  assert.equal(seeded.xp.totalEarned, 14);
  assert.equal(seeded.xp.spent, 0);

  const customXp = {
    ...sheet,
    xp: {
      totalEarned: 30,
      spent: 12,
      ledger: [],
    },
  };
  const preserved = withSafeXpState(customXp);
  assert.equal(preserved.xp?.totalEarned, 30);
  assert.equal(preserved.xp?.spent, 12);
});

test('hydrateWorkspaceFromStore seeds empty store and hydrates persisted sheets when present', async () => {
  const store = new SheetsStore({ idbFactory: undefined, storage: null });
  const bootstrap = loadInitialWorkspaceBootstrap();

  const initialHydrated = await hydrateWorkspaceFromStore(store, bootstrap);
  assert.equal(initialHydrated.idbError, null);
  assert.equal(initialHydrated.persistedSheets.length, 1);
  assert.equal(initialHydrated.workspace.activeSystemId, 'wod');

  const dndSheet = {
    ...createPresetBySystemId('dnd5e'),
    id: 'sheet_dnd5e_hero',
    characterName: 'ELARA VANCE',
  };
  await store.saveSheet(dndSheet);
  await store.setActiveSheetId('sheet_dnd5e_hero');
  await store.setActiveSystemId('dnd5e');

  const secondHydrated = await hydrateWorkspaceFromStore(store, bootstrap);
  assert.equal(secondHydrated.idbError, null);
  assert.equal(secondHydrated.hadPersistedLocal, true);
  assert.equal(secondHydrated.workspace.activeSystemId, 'dnd5e');
  assert.equal(
    secondHydrated.workspace.sheetsBySystem.dnd5e?.characterName,
    'ELARA VANCE',
  );
  assert.equal(secondHydrated.persistedSheets.length, 2);
});

test('hydrateWorkspaceFromStore degrades gracefully with idbError when storage throws', async () => {
  const bootstrap = loadInitialWorkspaceBootstrap();
  const brokenStore = {
    async loadWorkspaceSnapshot() {
      throw new Error('IDB_LOCKED');
    },
    async listSheets() {
      return [];
    },
    async saveSheet() {
      throw new Error('IDB_LOCKED');
    },
    async setActiveSheetId() {},
    async setActiveSystemId() {},
  };

  const hydrated = await hydrateWorkspaceFromStore(brokenStore, bootstrap, {
    idbInitErrorMessage: 'Fallback error',
  });
  assert.equal(hydrated.idbError, 'IDB_LOCKED');
  assert.equal(hydrated.workspace.activeSystemId, bootstrap.workspace.activeSystemId);
  assert.deepEqual(hydrated.persistedSheets, []);
});

test('createSuspenseResource throws pending promise before resolution and returns value after', async () => {
  let resolveFn!: (val: string) => void;
  const deferred = new Promise<string>((resolve) => {
    resolveFn = resolve;
  });

  const resource = createSuspenseResource(deferred);

  let thrown: unknown = null;
  try {
    resource.read();
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown instanceof Promise, 'Pending Suspense resource must throw a Promise');

  resolveFn('HYDRATED_OK');
  await resource.promise;
  assert.equal(resource.read(), 'HYDRATED_OK');
});
