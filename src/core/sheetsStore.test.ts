import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_DEBOUNCE_MS,
  createDebouncedSheetSaver,
  LEGACY_BACKUP_V1_KEY,
  LEGACY_WOD_STORAGE_KEY,
  MAX_WORKSPACE_SNAPSHOTS,
  MIGRATION_V1_DONE_KEY,
  SHEETS_DB_VERSION,
  SHEETS_META_STORE_NAME,
  SheetsStore,
  WORKSPACE_STORAGE_KEY,
} from './sheetsStore';
import {
  type CharacterSheetState,
  createNewSheetForSystem,
  createPresetBySystemId,
  parseAndValidateImportPayload,
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
    const req = idbFactory.open(dbName, SHEETS_DB_VERSION);
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

describe('Workspace safety snapshots', () => {
  it('creates a deep-cloned pre-import-overwrite snapshot and restores previous sheets intact', async () => {
    const { store } = createIsolatedStore();
    await store.initSheetsStore();

    const originalWod: CharacterSheetState = {
      ...createNewSheetForSystem('wod', { characterName: 'Original Julian' }),
      id: 'sheet_wod',
    };
    const originalDnd: CharacterSheetState = {
      ...createNewSheetForSystem('dnd5e', { characterName: 'Original Lyra' }),
      id: 'sheet_dnd5e',
    };

    await store.saveSheet(originalWod);
    await store.saveSheet(originalDnd);

    // Create pre-import-overwrite snapshot
    const snapMeta = await store.createWorkspaceSnapshot(
      [originalWod, originalDnd],
      'pre-import-overwrite',
    );
    expect(snapMeta.reason).toBe('pre-import-overwrite');
    expect(snapMeta.sheetCount).toBe(2);

    // Mutate live object and overwrite IndexedDB with new sheet
    originalWod.characterName = 'MUTATED IN MEMORY';
    const overwrittenWod: CharacterSheetState = {
      ...createNewSheetForSystem('wod', { characterName: 'Imported Overwrite' }),
      id: 'sheet_wod',
    };
    await store.saveSheet(overwrittenWod);
    expect((await store.getSheet('sheet_wod'))?.characterName).toBe('IMPORTED OVERWRITE');

    // Restore snapshot and verify intact state
    const restored = await store.restoreWorkspaceSnapshot(snapMeta.snapshotId);
    expect(restored).toHaveLength(2);
    expect((await store.getSheet('sheet_wod'))?.characterName).toBe('ORIGINAL JULIAN');
    expect((await store.getSheet('sheet_dnd5e'))?.characterName).toBe('ORIGINAL LYRA');

    store.close();
  });

  it('rotates snapshots FIFO keeping at most 5 most recent and discarding the 6th oldest', async () => {
    const { store } = createIsolatedStore();
    await store.initSheetsStore();

    const createdIds: string[] = [];
    for (let i = 1; i <= MAX_WORKSPACE_SNAPSHOTS + 1; i += 1) {
      const sheet: CharacterSheetState = {
        ...createNewSheetForSystem('wod', { characterName: `Char ${i}` }),
        id: `sheet_${i}`,
      };
      const meta = await store.createWorkspaceSnapshot([sheet], 'manual');
      createdIds.push(meta.snapshotId);
    }

    const listed = await store.listWorkspaceSnapshots();
    expect(listed).toHaveLength(MAX_WORKSPACE_SNAPSHOTS);
    // Ordered newest to oldest; oldest (createdIds[0]) must be evicted
    expect(listed.map((s) => s.snapshotId)).toEqual(
      createdIds.slice(1).reverse(),
    );
    expect(listed.some((s) => s.snapshotId === createdIds[0])).toBe(false);

    // Attempting to restore evicted snapshot rejects cleanly
    await expect(store.restoreWorkspaceSnapshot(createdIds[0])).rejects.toThrow();

    store.close();
  });

  it('does not create a snapshot when import payload fails parseAndValidateImportPayload', async () => {
    const { store } = createIsolatedStore();
    await store.initSheetsStore();

    const existing: CharacterSheetState = {
      ...createNewSheetForSystem('wod', { characterName: 'Safe Sheet' }),
      id: 'sheet_wod',
    };
    await store.saveSheet(existing);

    const invalidInputs = [
      '{not_valid_json',
      JSON.stringify({ systemName: 'X' }),
      JSON.stringify([]),
      '[{"systemName":"X","systemCode":"/X","characterName":"Y","cards":[],"__proto__":{"polluted":true}}]',
    ];

    for (const raw of invalidInputs) {
      const parsed = parseAndValidateImportPayload(raw);
      expect(parsed.valid).toBe(false);
      expect(parsed.sheets).toHaveLength(0);
      if (parsed.valid) {
        await store.createWorkspaceSnapshot([existing], 'pre-import-overwrite');
      }
    }

    expect(await store.listWorkspaceSnapshots()).toHaveLength(0);

    // Valid batch payload passes validation
    const validBatch = parseAndValidateImportPayload(JSON.stringify([existing]));
    expect(validBatch.valid).toBe(true);
    expect(validBatch.sheets).toHaveLength(1);

    store.close();
  });

  it('safely upgrades an existing v1 IndexedDB database to v2 without losing sheets or customTemplates', async () => {
    const idbFactory = new IDBFactory();
    const dbName = 'upgrade-v1-to-v2-db';
    const existingSheet: CharacterSheetState = {
      ...createPresetBySystemId('wod'),
      id: 'sheet_wod_v1',
      characterName: 'V1 SURVIVOR',
    };

    // Seed a v1 database manually
    await new Promise<void>((resolve, reject) => {
      const req = idbFactory.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const sheetsStore = db.createObjectStore('sheets', { keyPath: 'id' });
        sheetsStore.createIndex('id', 'id', { unique: true });
        sheetsStore.createIndex('systemId', 'systemId', { unique: false });
        sheetsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        const tplStore = db.createObjectStore('customTemplates', { keyPath: 'id' });
        tplStore.createIndex('systemId', 'systemId', { unique: false });
        tplStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        db.createObjectStore('metadata', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['sheets', 'metadata'], 'readwrite');
        tx.objectStore('sheets').put(existingSheet);
        tx.objectStore('metadata').put({ key: MIGRATION_V1_DONE_KEY, value: true });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = new SheetsStore({ idbFactory, dbName });
    await store.initSheetsStore();

    const loaded = await store.getSheet('sheet_wod_v1');
    expect(loaded?.characterName).toBe('V1 SURVIVOR');

    const snap = await store.createWorkspaceSnapshot([loaded!], 'manual');
    expect((await store.listWorkspaceSnapshots())[0].snapshotId).toBe(snap.snapshotId);

    store.close();
  });
});
