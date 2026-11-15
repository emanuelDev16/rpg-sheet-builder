import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_DEBOUNCE_MS,
  createDebouncedSheetSaver,
  LEGACY_BACKUP_V1_KEY,
  LEGACY_WOD_STORAGE_KEY,
  MIGRATION_V1_DONE_KEY,
  SHEETS_META_STORE_NAME,
  SheetsStore,
  WORKSPACE_STORAGE_KEY,
} from './sheetsStore';
import {
  type CharacterSheetState,
  createNewSheetForSystem,
  createPresetBySystemId,
  type WorkspaceState,
} from './sheetModel';

class MockStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }
}

function createIsolatedStore(options?: {
  storage?: MockStorage;
  dbName?: string;
  idbFactory?: IDBFactory;
}) {
  const storage = options?.storage ?? new MockStorage();
  const idbFactory = options?.idbFactory ?? new IDBFactory();
  const dbName = options?.dbName ?? `test-sheets-db-${Math.random().toString(36).slice(2, 8)}`;
  const store = new SheetsStore({
    idbFactory,
    storage,
    dbName,
  });
  return { store, storage, idbFactory, dbName };
}

async function readMetadataRaw(
  idbFactory: IDBFactory,
  dbName: string,
  key: string,
): Promise<{ key: string; value: unknown } | undefined> {
  return new Promise((resolve, reject) => {
    const req = idbFactory.open(dbName, 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(SHEETS_META_STORE_NAME, 'readonly');
      const getReq = tx.objectStore(SHEETS_META_STORE_NAME).get(key);
      getReq.onsuccess = () => {
        resolve(getReq.result as { key: string; value: unknown } | undefined);
        db.close();
      };
      getReq.onerror = () => {
        reject(getReq.error);
        db.close();
      };
    };
    req.onerror = () => reject(req.error);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SheetsStore IndexedDB persistence', () => {
  it('performs full async CRUD for sheets, activeSheetId, and customTemplates', async () => {
    const { store } = createIsolatedStore();
    await store.initSheetsStore();

    const wodSheet: CharacterSheetState = {
      ...createPresetBySystemId('wod'),
      id: 'sheet_wod_julian',
      characterName: 'JULIAN CROSS',
      updatedAt: '2026-11-10T10:00:00.000Z',
    };
    const dndSheet: CharacterSheetState = {
      ...createNewSheetForSystem('dnd5e', { characterName: 'Lyra Vance' }),
      id: 'sheet_dnd_lyra',
      updatedAt: '2026-11-11T12:00:00.000Z',
    };

    await store.saveSheet(wodSheet);
    await store.saveSheet(dndSheet);
    await store.setActiveSheetId('sheet_dnd_lyra');

    const loadedDnd = await store.getSheet('sheet_dnd_lyra');
    expect(loadedDnd?.characterName).toBe('LYRA VANCE');
    expect(await store.getActiveSheetId()).toBe('sheet_dnd_lyra');

    const allSheets = await store.listSheets();
    expect(allSheets.map((s) => s.id)).toEqual(['sheet_dnd_lyra', 'sheet_wod_julian']);

    const onlyWod = await store.listSheets('wod');
    expect(onlyWod).toHaveLength(1);
    expect(onlyWod[0].id).toBe('sheet_wod_julian');

    // Custom templates CRUD
    const savedTpl = await store.saveCustomTemplate({
      name: 'Ventrue Base',
      sheet: wodSheet,
    });
    const templates = await store.listCustomTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe(savedTpl.id);
    expect(templates[0].name).toBe('Ventrue Base');

    await store.deleteCustomTemplate(savedTpl.id);
    expect(await store.listCustomTemplates()).toHaveLength(0);

    // Deleting the active sheet clears activeSheetId
    await store.deleteSheet('sheet_dnd_lyra');
    expect(await store.getSheet('sheet_dnd_lyra')).toBeNull();
    expect(await store.getActiveSheetId()).toBeNull();
    expect((await store.listSheets()).map((s) => s.id)).toEqual(['sheet_wod_julian']);

    store.close();
  });

  it('automatically migrates legacy localStorage workspace and v1 sheet to IndexedDB and cleans migrated keys', async () => {
    const storage = new MockStorage();
    const wodSheet: CharacterSheetState = {
      ...createNewSheetForSystem('wod', { characterName: 'Kaelen' }),
      id: 'sheet_wod',
    };
    const dndSheet: CharacterSheetState = {
      ...createPresetBySystemId('dnd5e'),
      id: 'sheet_dnd5e',
    };
    const legacyWorkspace: WorkspaceState = {
      activeSystemId: 'wod',
      sheetsBySystem: {
        wod: wodSheet,
        dnd5e: dndSheet,
      },
    };
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(legacyWorkspace));
    storage.setItem('grid_sheet_language_v1', 'pt-BR');

    const { store, idbFactory, dbName } = createIsolatedStore({ storage });
    const result = await store.initSheetsStore();

    expect(result.alreadyMigrated).toBe(false);
    expect(result.migratedCount).toBe(2);
    expect(result.rejectedEntries).toHaveLength(0);
    expect(storage.has(WORKSPACE_STORAGE_KEY)).toBe(false);
    expect(storage.getItem('grid_sheet_language_v1')).toBe('pt-BR');

    const sheets = await store.listSheets();
    expect(sheets).toHaveLength(2);
    expect(await store.getActiveSheetId()).toBe('sheet_wod');

    store.close();

    const migrationFlag = await readMetadataRaw(idbFactory, dbName, MIGRATION_V1_DONE_KEY);
    expect(migrationFlag?.value).toBe(true);
    const backupMeta = await readMetadataRaw(idbFactory, dbName, LEGACY_BACKUP_V1_KEY);
    expect(backupMeta).toBeTruthy();

    // Re-running initSheetsStore on the same DB is idempotent
    const secondStore = new SheetsStore({ idbFactory, storage, dbName });
    const secondInit = await secondStore.initSheetsStore();
    expect(secondInit.alreadyMigrated).toBe(true);
    expect(secondInit.migratedCount).toBe(0);
    secondStore.close();
  });

  it('protects against corrupted or schema-invalid localStorage payloads during migration', async () => {
    const storage = new MockStorage();
    // Valid v1 sheet alongside corrupted workspace payload
    const validLegacyWod = createPresetBySystemId('wod');
    storage.setItem(LEGACY_WOD_STORAGE_KEY, JSON.stringify(validLegacyWod));
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      '{"activeSystemId":"wod","sheetsBySystem":{"wod":{"systemName":"X","systemCode":"/X","characterName":"Y","cards":[],"__proto__":{"polluted":true}}}}',
    );

    const { store } = createIsolatedStore({ storage });
    const result = await store.initSheetsStore();

    // Valid sheet migrated, corrupted workspace rejected and kept unremoved so no silent destruction occurs
    expect(result.migratedCount).toBe(1);
    expect(result.rejectedEntries.length).toBeGreaterThanOrEqual(1);
    expect(storage.has(LEGACY_WOD_STORAGE_KEY)).toBe(false);
    expect(storage.has(WORKSPACE_STORAGE_KEY)).toBe(true);

    const stored = await store.listSheets();
    expect(stored).toHaveLength(1);
    expect(stored[0].characterName).toBe(validLegacyWod.characterName);

    // Completely unparseable JSON must not throw
    const badStorage = new MockStorage();
    badStorage.setItem(LEGACY_WOD_STORAGE_KEY, '{corrupted_json_without_closing');
    const { store: badStore } = createIsolatedStore({ storage: badStorage });
    const badResult = await badStore.initSheetsStore();
    expect(badResult.migratedCount).toBe(0);
    expect(badResult.rejectedEntries).toHaveLength(1);
    expect(badStorage.has(LEGACY_WOD_STORAGE_KEY)).toBe(true);

    store.close();
    badStore.close();
  });

  it('preserves legacy localStorage data if IndexedDB transaction fails during migration', async () => {
    const storage = new MockStorage();
    storage.setItem(LEGACY_WOD_STORAGE_KEY, JSON.stringify(createPresetBySystemId('wod')));

    const failingFactory = {
      open(): IDBOpenDBRequest {
        const req = {
          result: undefined,
          error: new DOMException('Simulated IDB open failure'),
          onsuccess: null as ((ev: Event) => void) | null,
          onerror: null as ((ev: Event) => void) | null,
          onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
        } as unknown as IDBOpenDBRequest;
        queueMicrotask(() => {
          req.onerror?.(new Event('error'));
        });
        return req;
      },
    } as unknown as IDBFactory;

    const store = new SheetsStore({
      idbFactory: failingFactory,
      storage,
      dbName: 'failing-migration-db',
    });

    await expect(store.initSheetsStore()).rejects.toThrow();
    expect(storage.has(LEGACY_WOD_STORAGE_KEY)).toBe(true);
  });

  it('debounces rapid edits within 400ms into a single write and flushes immediately on demand', async () => {
    const { store } = createIsolatedStore();
    await store.initSheetsStore();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    const saveSpy = vi.spyOn(store, 'saveSheet');
    const statuses: string[] = [];
    const saver = createDebouncedSheetSaver({
      store,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      onStatusChange: (snap) => {
        statuses.push(snap.status);
      },
    });

    const baseSheet: CharacterSheetState = {
      ...createPresetBySystemId('wod'),
      id: 'sheet_wod',
      characterName: 'FIRST',
    };

    // Rapid edits at t=0, t=150, t=300 must coalesce
    saver.scheduleSave({ ...baseSheet, characterName: 'FIRST' });
    await vi.advanceTimersByTimeAsync(150);
    saver.scheduleSave({ ...baseSheet, characterName: 'SECOND' });
    await vi.advanceTimersByTimeAsync(150);
    saver.scheduleSave({ ...baseSheet, characterName: 'THIRD' });

    expect(saveSpy).toHaveBeenCalledTimes(0);
    expect(saver.getSnapshot().status).toBe('saving');

    await vi.advanceTimersByTimeAsync(399);
    expect(saveSpy).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ characterName: 'THIRD' }));

    // Wait for the triggered async IndexedDB transaction to commit
    await saver.flush();
    expect(saver.getSnapshot().status).toBe('saved');

    const persisted = await store.getSheet('sheet_wod');
    expect(persisted?.characterName).toBe('THIRD');

    // Immediate flush bypasses remaining debounce delay
    saver.scheduleSave({ ...baseSheet, characterName: 'FLUSHED_NOW' });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    await saver.flush();
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect((await store.getSheet('sheet_wod'))?.characterName).toBe('FLUSHED_NOW');

    // dispose cancels pending timer cleanly
    saver.scheduleSave({ ...baseSheet, characterName: 'DISPOSED_EDIT' });
    saver.dispose();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 50);
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(statuses).toContain('saving');
    expect(statuses).toContain('saved');

    store.close();
  });
});
