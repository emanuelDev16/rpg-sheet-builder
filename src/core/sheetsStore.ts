import {
  type CharacterSheetState,
  createDefaultSheet,
  detectSystemId,
  migrateLegacyWodSheet,
  type SystemId,
  touchSheetMetadata,
  validateSheetPayload,
  type WorkspaceState,
} from './sheetModel.ts';

export const SHEETS_DB_NAME = 'gridsheet-workspace-db';
export const SHEETS_DB_VERSION = 1;

export const SHEETS_STORE_NAME = 'sheets';
export const CUSTOM_TEMPLATES_STORE_NAME = 'customTemplates';
export const SHEETS_META_STORE_NAME = 'metadata';

export const LEGACY_WOD_STORAGE_KEY = 'grid_sheet_wod_v1';
export const WORKSPACE_STORAGE_KEY = 'grid_sheet_workspace_v2';
export const LEGACY_CUSTOM_TEMPLATES_KEY = 'grid_sheet_custom_templates_v1';

export const MIGRATION_V1_DONE_KEY = 'migration_v1_done';
export const LEGACY_BACKUP_V1_KEY = 'legacy_backup_v1';
export const ACTIVE_SHEET_ID_KEY = 'activeSheetId';
export const ACTIVE_SYSTEM_ID_KEY = 'activeSystemId';

export const AUTOSAVE_DEBOUNCE_MS = 400;

export type PersistenceStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface PersistenceSnapshot {
  status: PersistenceStatus;
  lastSavedAtMillis: number | null;
  errorMessage: string | null;
  pendingCount: number;
}

export interface CustomSheetTemplate {
  id: string;
  name: string;
  systemId: SystemId;
  updatedAt: string;
  sheet: CharacterSheetState;
}

export interface RejectedLegacyEntry {
  storageKey: string;
  reason: string;
  errors?: string[];
}

export interface InitSheetsStoreResult {
  migratedCount: number;
  migratedSheetIds: string[];
  migratedKeys: string[];
  alreadyMigrated: boolean;
  rejectedEntries: RejectedLegacyEntry[];
}

export interface LoadedWorkspaceSnapshot {
  workspace: WorkspaceState;
  activeSheetId: string;
  customTemplates: CustomSheetTemplate[];
  hadPersistedSheets: boolean;
  migration: InitSheetsStoreResult;
}

export interface SheetsStoreOptions {
  idbFactory?: IDBFactory;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  dbName?: string;
}

interface MetadataRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt?: string;
}

function getDefaultStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return null;
}

function promisifyIdbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function awaitIdbTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function resolveSheetRecordId(sheet: Pick<CharacterSheetState, 'id' | 'systemId' | 'systemName' | 'systemCode' | 'cards' | 'characterName' | 'revision' | 'updatedAt' | 'deviceId' | 'rollLogs'>): string {
  const existingId = typeof sheet.id === 'string' ? sheet.id.trim() : '';
  if (existingId && /^[a-zA-Z0-9_-]{1,64}$/.test(existingId)) {
    return existingId;
  }
  const sysId = detectSystemId(sheet as CharacterSheetState);
  return `sheet_${sysId}`;
}

export function normalizeSheetForStorage(
  rawSheet: CharacterSheetState,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): CharacterSheetState {
  const sysId = detectSystemId(rawSheet);
  const migrated = migrateLegacyWodSheet(
    {
      ...rawSheet,
      systemId: sysId,
      id: resolveSheetRecordId({ ...rawSheet, systemId: sysId }),
    },
    { storage },
  );
  return {
    ...migrated,
    id: resolveSheetRecordId({ ...migrated, systemId: sysId }),
    systemId: sysId,
  };
}

function extractSafeLegacyTemplates(
  rawJson: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): { templates: CustomSheetTemplate[]; rejected: RejectedLegacyEntry[] } {
  const templates: CustomSheetTemplate[] = [];
  const rejected: RejectedLegacyEntry[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    rejected.push({
      storageKey: LEGACY_CUSTOM_TEMPLATES_KEY,
      reason: 'JSON inválido em templates customizados legados.',
    });
    return { templates, rejected };
  }

  if (!Array.isArray(parsed)) {
    rejected.push({
      storageKey: LEGACY_CUSTOM_TEMPLATES_KEY,
      reason: 'Estrutura de templates customizados não é um array.',
    });
    return { templates, rejected };
  }

  parsed.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      rejected.push({
        storageKey: `${LEGACY_CUSTOM_TEMPLATES_KEY}[${idx}]`,
        reason: 'Item de template inválido.',
      });
      return;
    }
    const obj = item as Record<string, unknown>;
    const candidateSheet = obj.sheet ?? obj;
    const validation = validateSheetPayload(candidateSheet);
    if (!validation.valid) {
      rejected.push({
        storageKey: `${LEGACY_CUSTOM_TEMPLATES_KEY}[${idx}]`,
        reason: 'Template customizado reprovado na validação do schema.',
        errors: validation.errors,
      });
      return;
    }
    const normalizedSheet = normalizeSheetForStorage(
      candidateSheet as CharacterSheetState,
      storage,
    );
    const id =
      typeof obj.id === 'string' && obj.id.trim().length > 0
        ? obj.id.trim().slice(0, 64)
        : `tpl_${normalizedSheet.systemId ?? 'custom'}_${idx + 1}`;
    const name =
      typeof obj.name === 'string' && obj.name.trim().length > 0
        ? obj.name.trim().slice(0, 120)
        : normalizedSheet.characterName;
    templates.push({
      id,
      name,
      systemId: detectSystemId(normalizedSheet),
      updatedAt: normalizedSheet.updatedAt,
      sheet: normalizedSheet,
    });
  });

  return { templates, rejected };
}

function createInMemorySheetsDb() {
  const sheets = new Map<string, CharacterSheetState>();
  const customTemplates = new Map<string, CustomSheetTemplate>();
  const metadata = new Map<string, MetadataRecord>();
  return { sheets, customTemplates, metadata };
}

export class SheetsStore {
  private readonly idbFactory: IDBFactory | undefined;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  private readonly dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private openedDb: IDBDatabase | null = null;
  private initPromise: Promise<InitSheetsStoreResult> | null = null;
  private readonly memory = createInMemorySheetsDb();

  constructor(options: SheetsStoreOptions = {}) {
    this.idbFactory =
      options.idbFactory ??
      (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis
        ? globalThis.indexedDB
        : undefined);
    this.storage = options.storage !== undefined ? options.storage : getDefaultStorage();
    this.dbName = options.dbName ?? SHEETS_DB_NAME;
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.idbFactory) {
      return Promise.reject(new Error('IndexedDB unavailable'));
    }
    if (this.openedDb) {
      return Promise.resolve(this.openedDb);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    const factory = this.idbFactory;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = factory.open(this.dbName, SHEETS_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SHEETS_STORE_NAME)) {
          const sheetsStore = db.createObjectStore(SHEETS_STORE_NAME, { keyPath: 'id' });
          sheetsStore.createIndex('id', 'id', { unique: true });
          sheetsStore.createIndex('systemId', 'systemId', { unique: false });
          sheetsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(CUSTOM_TEMPLATES_STORE_NAME)) {
          const templatesStore = db.createObjectStore(CUSTOM_TEMPLATES_STORE_NAME, {
            keyPath: 'id',
          });
          templatesStore.createIndex('systemId', 'systemId', { unique: false });
          templatesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(SHEETS_META_STORE_NAME)) {
          db.createObjectStore(SHEETS_META_STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        this.openedDb = db;
        db.onversionchange = () => {
          db.close();
          if (this.openedDb === db) this.openedDb = null;
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        this.dbPromise = null;
        this.openedDb = null;
        reject(request.error ?? new Error('Failed to open GridSheet IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  private async getDbOrNull(): Promise<IDBDatabase | null> {
    if (!this.idbFactory) return null;
    try {
      return await this.openDb();
    } catch {
      return null;
    }
  }

  async initSheetsStore(): Promise<InitSheetsStoreResult> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.runInitAndMigration();
    try {
      return await this.initPromise;
    } catch (err) {
      this.initPromise = null;
      throw err;
    }
  }

  private async runInitAndMigration(): Promise<InitSheetsStoreResult> {
    const storage = this.storage;
    const db = this.idbFactory ? await this.openDb() : null;

    let alreadyMigrated = false;
    if (db) {
      const checkTx = db.transaction(SHEETS_META_STORE_NAME, 'readonly');
      const checkDone = awaitIdbTransaction(checkTx);
      const flag = await promisifyIdbRequest<MetadataRecord<boolean> | undefined>(
        checkTx.objectStore(SHEETS_META_STORE_NAME).get(MIGRATION_V1_DONE_KEY),
      );
      await checkDone;
      alreadyMigrated = Boolean(flag?.value);
    } else {
      alreadyMigrated = Boolean(this.memory.metadata.get(MIGRATION_V1_DONE_KEY)?.value);
    }

    if (alreadyMigrated || !storage) {
      return {
        migratedCount: 0,
        migratedSheetIds: [],
        migratedKeys: [],
        alreadyMigrated,
        rejectedEntries: [],
      };
    }

    const rawWorkspace = storage.getItem(WORKSPACE_STORAGE_KEY);
    const rawLegacy = storage.getItem(LEGACY_WOD_STORAGE_KEY);
    const rawTemplates = storage.getItem(LEGACY_CUSTOM_TEMPLATES_KEY);

    if (!rawWorkspace && !rawLegacy && !rawTemplates) {
      await this.writeMetadataRecord({
        key: MIGRATION_V1_DONE_KEY,
        value: true,
        updatedAt: new Date().toISOString(),
      });
      return {
        migratedCount: 0,
        migratedSheetIds: [],
        migratedKeys: [],
        alreadyMigrated: false,
        rejectedEntries: [],
      };
    }

    const sheetsToPersist = new Map<string, CharacterSheetState>();
    const templatesToPersist = new Map<string, CustomSheetTemplate>();
    const migratedKeys: string[] = [];
    const rejectedEntries: RejectedLegacyEntry[] = [];
    const backupSnapshot: Record<string, string> = {};
    let candidateActiveSystemId: SystemId | null = null;
    let candidateActiveSheetId: string | null = null;

    if (rawWorkspace) {
      try {
        const parsedWs = JSON.parse(rawWorkspace) as Partial<WorkspaceState> | null;
        if (
          parsedWs &&
          typeof parsedWs === 'object' &&
          !Array.isArray(parsedWs) &&
          parsedWs.sheetsBySystem &&
          typeof parsedWs.sheetsBySystem === 'object' &&
          !Array.isArray(parsedWs.sheetsBySystem)
        ) {
          let validInWorkspace = 0;
          let invalidInWorkspace = 0;

          if (
            typeof parsedWs.activeSystemId === 'string' &&
            ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'].includes(parsedWs.activeSystemId)
          ) {
            candidateActiveSystemId = parsedWs.activeSystemId as SystemId;
          }

          for (const [sysKey, rawEntry] of Object.entries(parsedWs.sheetsBySystem)) {
            if (!rawEntry) continue;
            const validation = validateSheetPayload(rawEntry);
            if (!validation.valid) {
              invalidInWorkspace += 1;
              rejectedEntries.push({
                storageKey: `${WORKSPACE_STORAGE_KEY}.${sysKey}`,
                reason: 'Ficha no workspace legado reprovada por validateSheetPayload.',
                errors: validation.errors,
              });
              continue;
            }
            const normalized = normalizeSheetForStorage(
              {
                ...(rawEntry as CharacterSheetState),
                systemId:
                  (rawEntry as CharacterSheetState).systemId ??
                  (['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'].includes(sysKey)
                    ? (sysKey as SystemId)
                    : undefined),
              },
              storage,
            );
            const recordId = normalized.id ?? `sheet_${detectSystemId(normalized)}`;
            sheetsToPersist.set(recordId, { ...normalized, id: recordId });
            validInWorkspace += 1;

            if (candidateActiveSystemId && sysKey === candidateActiveSystemId) {
              candidateActiveSheetId = recordId;
            }
          }

          if (validInWorkspace > 0 && invalidInWorkspace === 0) {
            migratedKeys.push(WORKSPACE_STORAGE_KEY);
          }
          if (validInWorkspace > 0) {
            backupSnapshot[WORKSPACE_STORAGE_KEY] = rawWorkspace;
          }
        } else {
          rejectedEntries.push({
            storageKey: WORKSPACE_STORAGE_KEY,
            reason: 'Formato de workspace legado inválido.',
          });
        }
      } catch {
        rejectedEntries.push({
          storageKey: WORKSPACE_STORAGE_KEY,
          reason: 'JSON corrompido na chave legada grid_sheet_workspace_v2.',
        });
      }
    }

    if (rawLegacy) {
      try {
        const parsedLegacy = JSON.parse(rawLegacy) as unknown;
        const validation = validateSheetPayload(parsedLegacy);
        if (!validation.valid) {
          rejectedEntries.push({
            storageKey: LEGACY_WOD_STORAGE_KEY,
            reason: 'Ficha legada reprovada por validateSheetPayload.',
            errors: validation.errors,
          });
        } else {
          const normalized = normalizeSheetForStorage(
            parsedLegacy as CharacterSheetState,
            storage,
          );
          const recordId = normalized.id ?? `sheet_${detectSystemId(normalized)}`;
          if (!sheetsToPersist.has(recordId)) {
            sheetsToPersist.set(recordId, { ...normalized, id: recordId });
          }
          if (!candidateActiveSheetId) {
            candidateActiveSheetId = recordId;
            candidateActiveSystemId = detectSystemId(normalized);
          }
          migratedKeys.push(LEGACY_WOD_STORAGE_KEY);
          backupSnapshot[LEGACY_WOD_STORAGE_KEY] = rawLegacy;
        }
      } catch {
        rejectedEntries.push({
          storageKey: LEGACY_WOD_STORAGE_KEY,
          reason: 'JSON corrompido na chave legada grid_sheet_wod_v1.',
        });
      }
    }

    if (rawTemplates) {
      const extracted = extractSafeLegacyTemplates(rawTemplates, storage);
      for (const tpl of extracted.templates) {
        templatesToPersist.set(tpl.id, tpl);
      }
      rejectedEntries.push(...extracted.rejected);
      if (extracted.templates.length > 0 && extracted.rejected.length === 0) {
        migratedKeys.push(LEGACY_CUSTOM_TEMPLATES_KEY);
      }
      if (extracted.templates.length > 0) {
        backupSnapshot[LEGACY_CUSTOM_TEMPLATES_KEY] = rawTemplates;
      }
    }

    const nowIso = new Date().toISOString();
    const migratedSheetIds = Array.from(sheetsToPersist.keys());
    const hasCleanMigration = rejectedEntries.length === 0;

    if (db) {
      const storeNames = [SHEETS_STORE_NAME, CUSTOM_TEMPLATES_STORE_NAME, SHEETS_META_STORE_NAME];
      const tx = db.transaction(storeNames, 'readwrite');
      const txDone = awaitIdbTransaction(tx);
      const sheetsStore = tx.objectStore(SHEETS_STORE_NAME);
      const templatesStore = tx.objectStore(CUSTOM_TEMPLATES_STORE_NAME);
      const metaStore = tx.objectStore(SHEETS_META_STORE_NAME);

      for (const sheet of sheetsToPersist.values()) {
        sheetsStore.put(sheet);
      }
      for (const tpl of templatesToPersist.values()) {
        templatesStore.put(tpl);
      }
      if (candidateActiveSheetId) {
        metaStore.put({
          key: ACTIVE_SHEET_ID_KEY,
          value: candidateActiveSheetId,
          updatedAt: nowIso,
        });
      }
      if (candidateActiveSystemId) {
        metaStore.put({
          key: ACTIVE_SYSTEM_ID_KEY,
          value: candidateActiveSystemId,
          updatedAt: nowIso,
        });
      }
      if (Object.keys(backupSnapshot).length > 0) {
        metaStore.put({
          key: LEGACY_BACKUP_V1_KEY,
          value: {
            backedUpAt: nowIso,
            keys: Object.keys(backupSnapshot),
            raw: backupSnapshot,
          },
          updatedAt: nowIso,
        });
      }
      metaStore.put({
        key: MIGRATION_V1_DONE_KEY,
        value: hasCleanMigration || migratedSheetIds.length > 0 || templatesToPersist.size > 0,
        updatedAt: nowIso,
      });

      await txDone;
    } else {
      for (const [id, sheet] of sheetsToPersist.entries()) {
        this.memory.sheets.set(id, sheet);
      }
      for (const [id, tpl] of templatesToPersist.entries()) {
        this.memory.customTemplates.set(id, tpl);
      }
      if (candidateActiveSheetId) {
        this.memory.metadata.set(ACTIVE_SHEET_ID_KEY, {
          key: ACTIVE_SHEET_ID_KEY,
          value: candidateActiveSheetId,
          updatedAt: nowIso,
        });
      }
      if (candidateActiveSystemId) {
        this.memory.metadata.set(ACTIVE_SYSTEM_ID_KEY, {
          key: ACTIVE_SYSTEM_ID_KEY,
          value: candidateActiveSystemId,
          updatedAt: nowIso,
        });
      }
      this.memory.metadata.set(MIGRATION_V1_DONE_KEY, {
        key: MIGRATION_V1_DONE_KEY,
        value: hasCleanMigration || migratedSheetIds.length > 0 || templatesToPersist.size > 0,
        updatedAt: nowIso,
      });
    }

    // Clear ONLY keys whose contents were confirmed persisted inside the transaction
    for (const key of migratedKeys) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage removal errors
      }
    }

    return {
      migratedCount: migratedSheetIds.length,
      migratedSheetIds,
      migratedKeys,
      alreadyMigrated: false,
      rejectedEntries,
    };
  }

  private async writeMetadataRecord(record: MetadataRecord): Promise<void> {
    const db = await this.getDbOrNull();
    if (!db) {
      this.memory.metadata.set(record.key, record);
      return;
    }
    const tx = db.transaction(SHEETS_META_STORE_NAME, 'readwrite');
    const txDone = awaitIdbTransaction(tx);
    tx.objectStore(SHEETS_META_STORE_NAME).put(record);
    await txDone;
  }

  private async readMetadataRecord<T = unknown>(key: string): Promise<MetadataRecord<T> | null> {
    const db = await this.getDbOrNull();
    if (!db) {
      return (this.memory.metadata.get(key) as MetadataRecord<T> | undefined) ?? null;
    }
    const tx = db.transaction(SHEETS_META_STORE_NAME, 'readonly');
    const txDone = awaitIdbTransaction(tx);
    const rec = await promisifyIdbRequest<MetadataRecord<T> | undefined>(
      tx.objectStore(SHEETS_META_STORE_NAME).get(key),
    );
    await txDone;
    return rec ?? null;
  }

  async listSheets(systemId?: SystemId): Promise<CharacterSheetState[]> {
    const db = await this.getDbOrNull();
    let records: CharacterSheetState[];
    if (!db) {
      records = Array.from(this.memory.sheets.values());
      if (systemId) {
        records = records.filter((item) => detectSystemId(item) === systemId);
      }
    } else {
      const tx = db.transaction(SHEETS_STORE_NAME, 'readonly');
      const txDone = awaitIdbTransaction(tx);
      const store = tx.objectStore(SHEETS_STORE_NAME);
      const request = systemId
        ? store.index('systemId').getAll(systemId)
        : store.getAll();
      records = await promisifyIdbRequest<CharacterSheetState[]>(request);
      await txDone;
    }
    return [...(Array.isArray(records) ? records : [])].sort((a, b) =>
      String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')),
    );
  }

  async getSheet(sheetId: string): Promise<CharacterSheetState | null> {
    const cleanId = sheetId.trim();
    if (!cleanId) return null;
    const db = await this.getDbOrNull();
    if (!db) {
      return this.memory.sheets.get(cleanId) ?? null;
    }
    const tx = db.transaction(SHEETS_STORE_NAME, 'readonly');
    const txDone = awaitIdbTransaction(tx);
    const record = await promisifyIdbRequest<CharacterSheetState | undefined>(
      tx.objectStore(SHEETS_STORE_NAME).get(cleanId),
    );
    await txDone;
    return record ?? null;
  }

  async saveSheet(sheet: CharacterSheetState): Promise<CharacterSheetState> {
    const normalized = normalizeSheetForStorage(sheet, this.storage);
    const db = await this.getDbOrNull();
    if (!db) {
      this.memory.sheets.set(normalized.id!, normalized);
      return normalized;
    }
    const tx = db.transaction(SHEETS_STORE_NAME, 'readwrite');
    const txDone = awaitIdbTransaction(tx);
    tx.objectStore(SHEETS_STORE_NAME).put(normalized);
    await txDone;
    return normalized;
  }

  async deleteSheet(sheetId: string): Promise<void> {
    const cleanId = sheetId.trim();
    if (!cleanId) return;
    const db = await this.getDbOrNull();
    if (!db) {
      this.memory.sheets.delete(cleanId);
      const activeMeta = this.memory.metadata.get(ACTIVE_SHEET_ID_KEY);
      if (activeMeta?.value === cleanId) {
        this.memory.metadata.delete(ACTIVE_SHEET_ID_KEY);
      }
      return;
    }
    const tx = db.transaction([SHEETS_STORE_NAME, SHEETS_META_STORE_NAME], 'readwrite');
    const txDone = awaitIdbTransaction(tx);
    tx.objectStore(SHEETS_STORE_NAME).delete(cleanId);
    const activeMeta = await promisifyIdbRequest<MetadataRecord<string | null> | undefined>(
      tx.objectStore(SHEETS_META_STORE_NAME).get(ACTIVE_SHEET_ID_KEY),
    );
    if (activeMeta?.value === cleanId) {
      tx.objectStore(SHEETS_META_STORE_NAME).put({
        key: ACTIVE_SHEET_ID_KEY,
        value: null,
        updatedAt: new Date().toISOString(),
      });
    }
    await txDone;
  }

  async getActiveSheetId(): Promise<string | null> {
    const record = await this.readMetadataRecord<string | null>(ACTIVE_SHEET_ID_KEY);
    return typeof record?.value === 'string' && record.value.trim().length > 0
      ? record.value.trim()
      : null;
  }

  async setActiveSheetId(sheetId: string | null): Promise<void> {
    await this.writeMetadataRecord({
      key: ACTIVE_SHEET_ID_KEY,
      value: sheetId && sheetId.trim().length > 0 ? sheetId.trim() : null,
      updatedAt: new Date().toISOString(),
    });
  }

  async getActiveSystemId(): Promise<SystemId | null> {
    const record = await this.readMetadataRecord<string>(ACTIVE_SYSTEM_ID_KEY);
    const val = record?.value;
    if (val && ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'].includes(val)) {
      return val as SystemId;
    }
    return null;
  }

  async setActiveSystemId(systemId: SystemId): Promise<void> {
    await this.writeMetadataRecord({
      key: ACTIVE_SYSTEM_ID_KEY,
      value: systemId,
      updatedAt: new Date().toISOString(),
    });
  }

  async listCustomTemplates(systemId?: SystemId): Promise<CustomSheetTemplate[]> {
    const db = await this.getDbOrNull();
    let templates: CustomSheetTemplate[];
    if (!db) {
      templates = Array.from(this.memory.customTemplates.values());
      if (systemId) {
        templates = templates.filter((item) => item.systemId === systemId);
      }
    } else {
      const tx = db.transaction(CUSTOM_TEMPLATES_STORE_NAME, 'readonly');
      const txDone = awaitIdbTransaction(tx);
      const store = tx.objectStore(CUSTOM_TEMPLATES_STORE_NAME);
      const req = systemId ? store.index('systemId').getAll(systemId) : store.getAll();
      templates = await promisifyIdbRequest<CustomSheetTemplate[]>(req);
      await txDone;
    }
    return [...(Array.isArray(templates) ? templates : [])].sort((a, b) =>
      String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')),
    );
  }

  async saveCustomTemplate(input: {
    id?: string;
    name: string;
    sheet: CharacterSheetState;
  }): Promise<CustomSheetTemplate> {
    const normalizedSheet = normalizeSheetForStorage(input.sheet, this.storage);
    const systemId = detectSystemId(normalizedSheet);
    const cleanName = input.name.trim() || normalizedSheet.characterName || 'TEMPLATE CUSTOMIZADO';
    const id =
      input.id?.trim() ||
      `tpl_${systemId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const record: CustomSheetTemplate = {
      id,
      name: cleanName.slice(0, 120),
      systemId,
      updatedAt: new Date().toISOString(),
      sheet: {
        ...normalizedSheet,
        characterName: cleanName.toUpperCase(),
      },
    };
    const db = await this.getDbOrNull();
    if (!db) {
      this.memory.customTemplates.set(record.id, record);
      return record;
    }
    const tx = db.transaction(CUSTOM_TEMPLATES_STORE_NAME, 'readwrite');
    const txDone = awaitIdbTransaction(tx);
    tx.objectStore(CUSTOM_TEMPLATES_STORE_NAME).put(record);
    await txDone;
    return record;
  }

  async deleteCustomTemplate(templateId: string): Promise<void> {
    const cleanId = templateId.trim();
    if (!cleanId) return;
    const db = await this.getDbOrNull();
    if (!db) {
      this.memory.customTemplates.delete(cleanId);
      return;
    }
    const tx = db.transaction(CUSTOM_TEMPLATES_STORE_NAME, 'readwrite');
    const txDone = awaitIdbTransaction(tx);
    tx.objectStore(CUSTOM_TEMPLATES_STORE_NAME).delete(cleanId);
    await txDone;
  }

  async loadWorkspaceSnapshot(fallbackWorkspace?: WorkspaceState): Promise<LoadedWorkspaceSnapshot> {
    const migration = await this.initSheetsStore();
    const [sheets, storedActiveSheetId, storedActiveSystemId, customTemplates] = await Promise.all([
      this.listSheets(),
      this.getActiveSheetId(),
      this.getActiveSystemId(),
      this.listCustomTemplates(),
    ]);

    const sheetsBySystem: Partial<Record<SystemId, CharacterSheetState>> = {};
    for (const sheet of sheets) {
      const sysId = detectSystemId(sheet);
      if (!sheetsBySystem[sysId]) {
        sheetsBySystem[sysId] = sheet;
      }
    }

    const hadPersistedSheets = sheets.length > 0;
    let activeSystemId: SystemId = storedActiveSystemId ?? fallbackWorkspace?.activeSystemId ?? 'wod';
    const activeFromId = storedActiveSheetId
      ? sheets.find((item) => item.id === storedActiveSheetId)
      : undefined;
    if (activeFromId) {
      activeSystemId = detectSystemId(activeFromId);
      sheetsBySystem[activeSystemId] = activeFromId;
    } else if (!sheetsBySystem[activeSystemId] && sheets[0]) {
      activeSystemId = detectSystemId(sheets[0]);
    }

    if (!sheetsBySystem[activeSystemId]) {
      const seed =
        fallbackWorkspace?.sheetsBySystem[activeSystemId] ?? createDefaultSheet();
      sheetsBySystem[activeSystemId] = normalizeSheetForStorage(seed, this.storage);
    }

    const resolvedActiveSheet = sheetsBySystem[activeSystemId]!;
    const activeSheetId = resolveSheetRecordId(resolvedActiveSheet);

    return {
      workspace: {
        activeSystemId,
        sheetsBySystem: {
          ...(fallbackWorkspace?.sheetsBySystem ?? {}),
          ...sheetsBySystem,
        },
      },
      activeSheetId,
      customTemplates,
      hadPersistedSheets,
      migration,
    };
  }

  close(): void {
    if (this.openedDb) {
      this.openedDb.close();
      this.openedDb = null;
    }
    this.dbPromise = null;
  }
}

export interface DebouncedSheetSaverOptions {
  store: Pick<SheetsStore, 'saveSheet' | 'setActiveSheetId' | 'setActiveSystemId'>;
  debounceMs?: number;
  onStatusChange?: (snapshot: PersistenceSnapshot) => void;
}

export interface PendingSheetSaveInput {
  sheet: CharacterSheetState;
  activeSheetId?: string | null;
  activeSystemId?: SystemId;
}

export class DebouncedSheetSaver {
  private readonly store: DebouncedSheetSaverOptions['store'];
  private readonly debounceMs: number;
  private readonly pendingBySheetId = new Map<string, PendingSheetSaveInput>();
  private readonly timersBySheetId = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly generationBySheetId = new Map<string, number>();
  private readonly listeners = new Set<(snapshot: PersistenceSnapshot) => void>();
  private writeChain: Promise<void> = Promise.resolve();
  private disposed = false;
  private snapshot: PersistenceSnapshot = {
    status: 'idle',
    lastSavedAtMillis: null,
    errorMessage: null,
    pendingCount: 0,
  };

  constructor(options: DebouncedSheetSaverOptions) {
    this.store = options.store;
    this.debounceMs = Math.max(0, options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS);
    if (options.onStatusChange) {
      this.listeners.add(options.onStatusChange);
    }
  }

  getSnapshot(): PersistenceSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: PersistenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitSnapshot(next: Partial<PersistenceSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...next,
      pendingCount: this.pendingBySheetId.size,
    };
    if (this.disposed) return;
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  scheduleSave(
    sheet: CharacterSheetState,
    options?: { activeSheetId?: string | null; activeSystemId?: SystemId },
  ): string {
    const sheetId = resolveSheetRecordId(sheet);
    const normalizedInput: PendingSheetSaveInput = {
      sheet: { ...sheet, id: sheetId },
      activeSheetId: options?.activeSheetId !== undefined ? options.activeSheetId : sheetId,
      activeSystemId: options?.activeSystemId ?? detectSystemId(sheet),
    };

    const existingTimer = this.timersBySheetId.get(sheetId);
    if (existingTimer !== undefined) {
      globalThis.clearTimeout(existingTimer);
    }

    const nextGen = (this.generationBySheetId.get(sheetId) ?? 0) + 1;
    this.generationBySheetId.set(sheetId, nextGen);
    this.pendingBySheetId.set(sheetId, normalizedInput);
    this.emitSnapshot({ status: 'saving', errorMessage: null });

    const timer = globalThis.setTimeout(() => {
      this.timersBySheetId.delete(sheetId);
      void this.flush(sheetId);
    }, this.debounceMs);
    this.timersBySheetId.set(sheetId, timer);

    return sheetId;
  }

  cancelPending(sheetId?: string): void {
    if (sheetId) {
      const cleanId = sheetId.trim();
      const timer = this.timersBySheetId.get(cleanId);
      if (timer !== undefined) {
        globalThis.clearTimeout(timer);
        this.timersBySheetId.delete(cleanId);
      }
      this.pendingBySheetId.delete(cleanId);
      this.generationBySheetId.set(cleanId, (this.generationBySheetId.get(cleanId) ?? 0) + 1);
    } else {
      for (const timer of this.timersBySheetId.values()) {
        globalThis.clearTimeout(timer);
      }
      this.timersBySheetId.clear();
      this.pendingBySheetId.clear();
    }

    if (this.pendingBySheetId.size === 0 && this.snapshot.status === 'saving') {
      this.emitSnapshot({
        status: this.snapshot.lastSavedAtMillis ? 'saved' : 'idle',
      });
    } else {
      this.emitSnapshot({});
    }
  }

  async flush(sheetId?: string): Promise<void> {
    const targetIds = sheetId
      ? this.pendingBySheetId.has(sheetId.trim())
        ? [sheetId.trim()]
        : []
      : Array.from(this.pendingBySheetId.keys());

    if (targetIds.length === 0) {
      await this.writeChain;
      return;
    }

    const batch: Array<{ sheetId: string; payload: PendingSheetSaveInput; generation: number }> = [];
    for (const id of targetIds) {
      const timer = this.timersBySheetId.get(id);
      if (timer !== undefined) {
        globalThis.clearTimeout(timer);
        this.timersBySheetId.delete(id);
      }
      const payload = this.pendingBySheetId.get(id);
      if (!payload) continue;
      this.pendingBySheetId.delete(id);
      batch.push({
        sheetId: id,
        payload,
        generation: this.generationBySheetId.get(id) ?? 0,
      });
    }

    if (batch.length === 0) return;

    this.emitSnapshot({ status: 'saving', errorMessage: null });

    const job = this.writeChain.then(async () => {
      try {
        for (const item of batch) {
          await this.store.saveSheet(item.payload.sheet);
          if (item.payload.activeSheetId !== undefined) {
            await this.store.setActiveSheetId(item.payload.activeSheetId);
          }
          if (item.payload.activeSystemId !== undefined) {
            await this.store.setActiveSystemId(item.payload.activeSystemId);
          }
        }
        if (this.pendingBySheetId.size === 0) {
          this.emitSnapshot({
            status: 'saved',
            lastSavedAtMillis: Date.now(),
            errorMessage: null,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Falha ao persistir ficha no IndexedDB.';
        this.emitSnapshot({
          status: 'error',
          errorMessage: message,
        });
        throw err;
      }
    });

    this.writeChain = job.catch(() => undefined);
    await job;
  }

  async saveNow(
    sheet: CharacterSheetState,
    options?: { activeSheetId?: string | null; activeSystemId?: SystemId },
  ): Promise<void> {
    const sheetId = resolveSheetRecordId(sheet);
    this.cancelPending(sheetId);
    this.pendingBySheetId.set(sheetId, {
      sheet: { ...sheet, id: sheetId },
      activeSheetId: options?.activeSheetId !== undefined ? options.activeSheetId : sheetId,
      activeSystemId: options?.activeSystemId ?? detectSystemId(sheet),
    });
    await this.flush(sheetId);
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timersBySheetId.values()) {
      globalThis.clearTimeout(timer);
    }
    this.timersBySheetId.clear();
    this.pendingBySheetId.clear();
    this.listeners.clear();
  }
}

export function createDebouncedSheetSaver(options: DebouncedSheetSaverOptions): DebouncedSheetSaver {
  return new DebouncedSheetSaver(options);
}

let defaultStoreInstance: SheetsStore | null = null;

export function getDefaultSheetsStore(): SheetsStore {
  if (!defaultStoreInstance) {
    defaultStoreInstance = new SheetsStore();
  }
  return defaultStoreInstance;
}

export function initSheetsStore(): Promise<InitSheetsStoreResult> {
  return getDefaultSheetsStore().initSheetsStore();
}

export function listSheets(systemId?: SystemId): Promise<CharacterSheetState[]> {
  return getDefaultSheetsStore().listSheets(systemId);
}

export function getSheet(sheetId: string): Promise<CharacterSheetState | null> {
  return getDefaultSheetsStore().getSheet(sheetId);
}

export function saveSheet(sheet: CharacterSheetState): Promise<CharacterSheetState> {
  return getDefaultSheetsStore().saveSheet(sheet);
}

export function deleteSheet(sheetId: string): Promise<void> {
  return getDefaultSheetsStore().deleteSheet(sheetId);
}

export function getActiveSheetId(): Promise<string | null> {
  return getDefaultSheetsStore().getActiveSheetId();
}

export function setActiveSheetId(sheetId: string | null): Promise<void> {
  return getDefaultSheetsStore().setActiveSheetId(sheetId);
}

export function listCustomTemplates(systemId?: SystemId): Promise<CustomSheetTemplate[]> {
  return getDefaultSheetsStore().listCustomTemplates(systemId);
}

export function saveCustomTemplate(input: {
  id?: string;
  name: string;
  sheet: CharacterSheetState;
}): Promise<CustomSheetTemplate> {
  return getDefaultSheetsStore().saveCustomTemplate(input);
}

export function deleteCustomTemplate(templateId: string): Promise<void> {
  return getDefaultSheetsStore().deleteCustomTemplate(templateId);
}
