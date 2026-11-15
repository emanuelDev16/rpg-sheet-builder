import {
  type CharacterSheetState,
  createDefaultSheet,
  createPresetBySystemId,
  detectSystemId,
  migrateLegacyWodSheet,
  migrateWorkspaceSheets,
  type SystemId,
  type WorkspaceState,
} from './sheetModel.ts';
import {
  computeWorkspaceDigest,
  ROOM_SYNC_META_KEY,
  type RoomSyncLocalMeta,
} from './roomSync.ts';
import {
  type CustomSheetTemplate,
  resolveSheetRecordId,
  type SheetsStore,
} from './sheetsStore.ts';
import { normalizeXpState } from './xpSystem.ts';

export interface InitialWorkspaceBootstrap {
  workspace: WorkspaceState;
  hadLocalWorkspace: boolean;
  updatedAtMillis: number;
  lastMirroredDigest: string;
  baseRevisions: Partial<Record<SystemId, number>>;
  dirtySystems: Partial<Record<SystemId, boolean>>;
}

export interface HydratedWorkspacePayload {
  workspace: WorkspaceState;
  persistedSheets: CharacterSheetState[];
  customTemplates: CustomSheetTemplate[];
  hadPersistedLocal: boolean;
  bootstrap: InitialWorkspaceBootstrap;
  idbError: string | null;
}

export interface SuspenseResource<T> {
  promise: Promise<T>;
  read: () => T;
}

export function withSafeXpState(parsed: CharacterSheetState): CharacterSheetState {
  const sysId = detectSystemId(parsed);
  const migrated = migrateLegacyWodSheet({ ...parsed, systemId: sysId });
  if (migrated.xp) {
    return { ...migrated, systemId: sysId, xp: normalizeXpState(migrated.xp) };
  }
  return {
    ...migrated,
    systemId: sysId,
    xp: {
      totalEarned: 14,
      spent: 0,
      ledger: [
        {
          id: 'xp_seed_legacy',
          timestamp: '22:00',
          kind: 'award',
          delta: 14,
          label: 'CHRONICLE SESSION AWARD',
        },
      ],
    },
  };
}

export function readRoomSyncLocalMeta(): RoomSyncLocalMeta | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ROOM_SYNC_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSyncLocalMeta>;
    if (typeof parsed.updatedAtMillis === 'number' && Number.isFinite(parsed.updatedAtMillis)) {
      return {
        updatedAtMillis: parsed.updatedAtMillis,
        lastMirroredDigest:
          typeof parsed.lastMirroredDigest === 'string' ? parsed.lastMirroredDigest : '',
        baseRevisions: parsed.baseRevisions,
        dirtySystems: parsed.dirtySystems,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function writeRoomSyncLocalMeta(meta: RoomSyncLocalMeta): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ROOM_SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
}

export function loadInitialWorkspaceBootstrap(): InitialWorkspaceBootstrap {
  const existingMeta = readRoomSyncLocalMeta();
  const now = Date.now();

  try {
    const bridgeRaw =
      typeof window !== 'undefined' ? window.AndroidRoomBridge?.loadWorkspace?.() : null;
    if (bridgeRaw) {
      const parsed = JSON.parse(bridgeRaw) as WorkspaceState;
      if (parsed && parsed.activeSystemId && parsed.sheetsBySystem) {
        const migratedBridge = migrateWorkspaceSheets(parsed);
        return {
          workspace: migratedBridge,
          hadLocalWorkspace: true,
          updatedAtMillis: now,
          lastMirroredDigest: computeWorkspaceDigest(migratedBridge),
          baseRevisions: existingMeta?.baseRevisions ?? {},
          dirtySystems: existingMeta?.dirtySystems ?? {},
        };
      }
    }
  } catch {
    // Fallback to default seed sheet while IndexedDB loads asynchronously
  }

  const defaultSheet = createDefaultSheet();
  return {
    workspace: {
      activeSystemId: 'wod',
      sheetsBySystem: { wod: defaultSheet },
    },
    hadLocalWorkspace: false,
    updatedAtMillis: existingMeta?.updatedAtMillis ?? now,
    lastMirroredDigest: existingMeta?.lastMirroredDigest ?? '',
    baseRevisions: existingMeta?.baseRevisions ?? {},
    dirtySystems: existingMeta?.dirtySystems ?? {},
  };
}

export async function hydrateWorkspaceFromStore(
  store: Pick<
    SheetsStore,
    | 'loadWorkspaceSnapshot'
    | 'listSheets'
    | 'saveSheet'
    | 'setActiveSheetId'
    | 'setActiveSystemId'
  >,
  bootstrap: InitialWorkspaceBootstrap,
  options: { idbInitErrorMessage?: string } = {},
): Promise<HydratedWorkspacePayload> {
  try {
    const snapshot = await store.loadWorkspaceSnapshot(bootstrap.workspace);
    const migratedOrPersisted =
      snapshot.hadPersistedSheets || snapshot.migration.migratedCount > 0;
    const hadPersistedLocal = bootstrap.hadLocalWorkspace || migratedOrPersisted;

    let resolvedWorkspace = bootstrap.workspace;

    if (snapshot.hadPersistedSheets) {
      const activeSys = snapshot.workspace.activeSystemId;
      const activeSheet = snapshot.workspace.sheetsBySystem[activeSys];
      resolvedWorkspace = activeSheet
        ? {
            ...snapshot.workspace,
            sheetsBySystem: {
              ...snapshot.workspace.sheetsBySystem,
              [activeSys]: withSafeXpState(activeSheet),
            },
          }
        : snapshot.workspace;
    } else {
      const currentSys = bootstrap.workspace.activeSystemId;
      const currentSheet =
        bootstrap.workspace.sheetsBySystem[currentSys] ?? createPresetBySystemId(currentSys);
      const savedSeed = await store.saveSheet(currentSheet);
      const recordId = resolveSheetRecordId(savedSeed);
      await Promise.all([
        store.setActiveSheetId(recordId),
        store.setActiveSystemId(currentSys),
      ]);
      resolvedWorkspace = {
        ...bootstrap.workspace,
        sheetsBySystem: {
          ...bootstrap.workspace.sheetsBySystem,
          [currentSys]: withSafeXpState(savedSeed),
        },
      };
    }

    const persistedSheets = await store.listSheets();

    return {
      workspace: resolvedWorkspace,
      persistedSheets,
      customTemplates: snapshot.customTemplates,
      hadPersistedLocal,
      bootstrap,
      idbError: null,
    };
  } catch (err) {
    const idbError =
      err instanceof Error ? err.message : options.idbInitErrorMessage ?? 'IndexedDB init failed.';
    return {
      workspace: bootstrap.workspace,
      persistedSheets: [],
      customTemplates: [],
      hadPersistedLocal: bootstrap.hadLocalWorkspace,
      bootstrap,
      idbError,
    };
  }
}

export function createSuspenseResource<T>(promise: Promise<T>): SuspenseResource<T> {
  let status: 'pending' | 'success' | 'error' = 'pending';
  let result: T;
  let failure: unknown;

  const tracked = promise.then(
    (value) => {
      status = 'success';
      result = value;
      return value;
    },
    (err) => {
      status = 'error';
      failure = err;
      throw err;
    },
  );

  return {
    promise: tracked,
    read(): T {
      if (status === 'pending') {
        throw tracked;
      }
      if (status === 'error') {
        throw failure;
      }
      return result;
    },
  };
}
