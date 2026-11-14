import { CharacterSheetState, SystemId, WorkspaceState } from './sheetModel';

export const ROOM_SYNC_META_KEY = 'grid_sheet_room_sync_meta_v1';

export type MirrorSource = 'web' | 'android';

export interface RoomSheetEntityMirror {
  systemId: string;
  systemName: string;
  characterName: string;
  sheetJson: string;
  updatedAtMillis: number;
  syncState: 'SYNCED' | 'MIRRORED' | 'PENDING_SYNC';
}

export interface RoomWorkspaceMetadataMirror {
  id: 1;
  activeSystemId: string;
  updatedAtMillis: number;
}

export interface WorkspaceMirrorPayload {
  workspace: WorkspaceState;
  updatedAtMillis: number;
  digest: string;
  source: MirrorSource;
  entities: RoomSheetEntityMirror[];
  metadata: RoomWorkspaceMetadataMirror;
}

export interface AndroidRoomBridge {
  syncWorkspace?: (workspaceJson: string, updatedAtMillis: number) => void;
  loadWorkspace?: () => string | null;
}

declare global {
  interface Window {
    AndroidRoomBridge?: AndroidRoomBridge;
  }
}

export interface RoomSyncLocalMeta {
  updatedAtMillis: number;
  lastMirroredDigest: string;
}

const VALID_SYSTEM_IDS: readonly SystemId[] = ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'];

export function isValidSystemId(value: unknown): value is SystemId {
  return typeof value === 'string' && VALID_SYSTEM_IDS.includes(value as SystemId);
}

export function toAndroidRoomSystemId(systemId: SystemId): string {
  return systemId.toUpperCase();
}

export function computeWorkspaceDigest(workspace: WorkspaceState): string {
  const sortedEntries = Object.keys(workspace.sheetsBySystem)
    .sort()
    .map((key) => {
      const sysId = key as SystemId;
      return [sysId, workspace.sheetsBySystem[sysId]];
    });

  const canonical = JSON.stringify({
    activeSystemId: workspace.activeSystemId,
    sheets: sortedEntries,
  });

  // Deterministic 32-bit FNV-1a hex digest + length suffix
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}_${canonical.length}`;
}

export function buildRoomMirrorProjection(
  workspace: WorkspaceState,
  updatedAtMillis: number,
  syncState: 'SYNCED' | 'MIRRORED' | 'PENDING_SYNC' = 'MIRRORED',
): { entities: RoomSheetEntityMirror[]; metadata: RoomWorkspaceMetadataMirror } {
  const entities: RoomSheetEntityMirror[] = [];

  for (const key of Object.keys(workspace.sheetsBySystem).sort()) {
    const sysId = key as SystemId;
    const sheet = workspace.sheetsBySystem[sysId];
    if (!sheet) continue;
    const normalizedSheet: CharacterSheetState = { ...sheet, systemId: sysId };
    entities.push({
      systemId: toAndroidRoomSystemId(sysId),
      systemName: normalizedSheet.systemName,
      characterName: normalizedSheet.characterName,
      sheetJson: JSON.stringify(normalizedSheet),
      updatedAtMillis,
      syncState,
    });
  }

  return {
    entities,
    metadata: {
      id: 1,
      activeSystemId: toAndroidRoomSystemId(workspace.activeSystemId),
      updatedAtMillis,
    },
  };
}

export function createWorkspaceMirrorPayload(
  workspace: WorkspaceState,
  updatedAtMillis: number,
  source: MirrorSource = 'web',
): WorkspaceMirrorPayload {
  const digest = computeWorkspaceDigest(workspace);
  const { entities, metadata } = buildRoomMirrorProjection(
    workspace,
    updatedAtMillis,
    source === 'web' ? 'MIRRORED' : 'SYNCED',
  );
  return {
    workspace,
    updatedAtMillis,
    digest,
    source,
    entities,
    metadata,
  };
}

export function validateWorkspaceMirrorInput(input: unknown):
  | {
      ok: true;
      workspace: WorkspaceState;
      updatedAtMillis: number;
      source: MirrorSource;
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Payload de sincronização inválido.' };
  }
  const raw = input as Record<string, unknown>;
  const wsRaw = raw.workspace as Record<string, unknown> | undefined;
  if (!wsRaw || typeof wsRaw !== 'object') {
    return { ok: false, error: 'Campo workspace ausente no payload.' };
  }
  if (!isValidSystemId(wsRaw.activeSystemId)) {
    return { ok: false, error: 'activeSystemId inválido.' };
  }
  if (!wsRaw.sheetsBySystem || typeof wsRaw.sheetsBySystem !== 'object') {
    return { ok: false, error: 'sheetsBySystem ausente.' };
  }

  const sanitizedSheets: Partial<Record<SystemId, CharacterSheetState>> = {};
  for (const [k, sheetVal] of Object.entries(wsRaw.sheetsBySystem as Record<string, unknown>)) {
    if (!isValidSystemId(k) || !sheetVal || typeof sheetVal !== 'object') continue;
    const candidate = sheetVal as CharacterSheetState;
    if (!Array.isArray(candidate.cards) || typeof candidate.systemName !== 'string') continue;
    sanitizedSheets[k] = {
      ...candidate,
      systemId: k,
      rollLogs: Array.isArray(candidate.rollLogs) ? candidate.rollLogs : [],
    };
  }

  if (Object.keys(sanitizedSheets).length === 0) {
    return { ok: false, error: 'Nenhuma ficha válida encontrada para sincronização Room.' };
  }

  const updatedAtMillis =
    typeof raw.updatedAtMillis === 'number' && Number.isFinite(raw.updatedAtMillis) && raw.updatedAtMillis > 0
      ? Math.floor(raw.updatedAtMillis)
      : Date.now();

  const source: MirrorSource = raw.source === 'android' ? 'android' : 'web';

  return {
    ok: true,
    workspace: {
      activeSystemId: wsRaw.activeSystemId,
      sheetsBySystem: sanitizedSheets,
    },
    updatedAtMillis,
    source,
  };
}

export function reconcileWorkspaceWithMirror(
  localWorkspace: WorkspaceState,
  localUpdatedAtMillis: number,
  remoteMirror: WorkspaceMirrorPayload | null,
  options: { hadLocalWorkspace?: boolean } = {},
): {
  workspace: WorkspaceState;
  updatedAtMillis: number;
  adoptedRemote: boolean;
} {
  if (!remoteMirror) {
    return {
      workspace: localWorkspace,
      updatedAtMillis: localUpdatedAtMillis,
      adoptedRemote: false,
    };
  }

  // Only pull remote mirror if it originated from Android (or timestamp is strictly newer on an already-saved workspace)
  const shouldAdoptRemote =
    remoteMirror.source === 'android' &&
    (!options.hadLocalWorkspace || remoteMirror.updatedAtMillis > localUpdatedAtMillis);

  if (shouldAdoptRemote) {
    return {
      workspace: remoteMirror.workspace,
      updatedAtMillis: remoteMirror.updatedAtMillis,
      adoptedRemote: true,
    };
  }

  return {
    workspace: localWorkspace,
    updatedAtMillis: localUpdatedAtMillis,
    adoptedRemote: false,
  };
}

export interface MirrorSyncOutcome {
  ok: boolean;
  digest: string;
  updatedAtMillis: number;
  usedBridge: boolean;
  usedHttp: boolean;
  error?: string;
}

export async function mirrorWorkspaceToRoom(
  workspace: WorkspaceState,
  options: {
    updatedAtMillis?: number;
    fetchImpl?: typeof fetch;
    keepalive?: boolean;
    bridge?: AndroidRoomBridge | null;
    endpoint?: string;
  } = {},
): Promise<MirrorSyncOutcome> {
  const updatedAtMillis = options.updatedAtMillis ?? Date.now();
  const digest = computeWorkspaceDigest(workspace);
  const endpoint = options.endpoint ?? '/api/workspace-sync';
  const bridge =
    options.bridge !== undefined
      ? options.bridge
      : typeof window !== 'undefined'
        ? window.AndroidRoomBridge ?? null
        : null;

  let usedBridge = false;
  if (bridge && typeof bridge.syncWorkspace === 'function') {
    try {
      bridge.syncWorkspace(JSON.stringify(workspace), updatedAtMillis);
      usedBridge = true;
    } catch {
      // Continue with HTTP mirror if bridge invocation fails
    }
  }

  const fetchFn = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn) {
    return {
      ok: usedBridge,
      digest,
      updatedAtMillis,
      usedBridge,
      usedHttp: false,
      error: usedBridge ? undefined : 'Fetch indisponível neste ambiente.',
    };
  }

  try {
    const response = await fetchFn(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      keepalive: Boolean(options.keepalive),
      body: JSON.stringify({
        workspace,
        updatedAtMillis,
        digest,
        source: 'web',
      }),
    });

    if (!response.ok) {
      return {
        ok: usedBridge,
        digest,
        updatedAtMillis,
        usedBridge,
        usedHttp: false,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      digest,
      updatedAtMillis,
      usedBridge,
      usedHttp: true,
    };
  } catch (err) {
    return {
      ok: usedBridge,
      digest,
      updatedAtMillis,
      usedBridge,
      usedHttp: false,
      error: err instanceof Error ? err.message : 'Falha de rede no espelhamento Room.',
    };
  }
}

export async function fetchRoomMirrorSnapshot(
  fetchImpl?: typeof fetch,
  endpoint = '/api/workspace-sync',
): Promise<WorkspaceMirrorPayload | null> {
  const fetchFn = fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn) return null;

  try {
    const res = await fetchFn(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; mirror?: WorkspaceMirrorPayload | null };
    if (!data?.ok || !data.mirror) return null;
    const validated = validateWorkspaceMirrorInput(data.mirror);
    if (!validated.ok) return null;
    return createWorkspaceMirrorPayload(
      validated.workspace,
      validated.updatedAtMillis,
      validated.source,
    );
  } catch {
    return null;
  }
}

export const ROOM_EDIT_DEBOUNCE_MS = 1200;
export const ROOM_PERIODIC_SYNC_INTERVAL_MS = 30_000;
export const ROOM_RETRY_INTERVAL_MS = 5_000;

export type RoomSyncPhase = 'synced' | 'scheduled' | 'syncing' | 'error';

export interface RoomSyncIndicatorState {
  phase: RoomSyncPhase;
  nextSyncAtMillis: number | null;
  lastSyncedAtMillis: number | null;
  lastError?: string;
}

export interface FormattedRoomSyncIndicator {
  label: string;
  ariaLabel: string;
  tooltip: string;
  remainingSeconds: number;
  isPending: boolean;
  isSyncing: boolean;
  isError: boolean;
}

export function computeRemainingSyncSeconds(
  nextSyncAtMillis: number | null,
  nowMillis: number,
): number {
  if (nextSyncAtMillis === null || !Number.isFinite(nextSyncAtMillis)) {
    return 0;
  }
  return Math.max(0, Math.ceil((nextSyncAtMillis - nowMillis) / 1000));
}

function formatSyncTimeHHMMSS(timestampMillis: number | null): string | null {
  if (timestampMillis === null || !Number.isFinite(timestampMillis)) return null;
  const d = new Date(timestampMillis);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatRoomSyncIndicator(
  state: RoomSyncIndicatorState,
  nowMillis: number,
): FormattedRoomSyncIndicator {
  const remainingSeconds = computeRemainingSyncSeconds(state.nextSyncAtMillis, nowMillis);
  const lastSyncStr = formatSyncTimeHHMMSS(state.lastSyncedAtMillis);
  const lastSyncSuffix = lastSyncStr ? ` · Última sync: ${lastSyncStr}` : '';

  if (state.phase === 'syncing') {
    return {
      label: 'ROOM SYNC: ...',
      ariaLabel: 'Sincronizando ficha com o Room Database local',
      tooltip: `Gravando alterações no Room Database local...${lastSyncSuffix}`,
      remainingSeconds: 0,
      isPending: false,
      isSyncing: true,
      isError: false,
    };
  }

  if (state.phase === 'error') {
    const countdown = remainingSeconds > 0 ? `${remainingSeconds}s` : 'agora';
    return {
      label: `ROOM RETRY: ${countdown}`,
      ariaLabel: `Erro ao sincronizar com Room Database. Nova tentativa em ${countdown}. Clique para tentar agora.`,
      tooltip: `Falha no espelhamento Room (${state.lastError ?? 'rede'}). Nova tentativa em ${countdown}. Clique para sincronizar agora.${lastSyncSuffix}`,
      remainingSeconds,
      isPending: false,
      isSyncing: false,
      isError: true,
    };
  }

  if (state.phase === 'scheduled') {
    const secs = Math.max(1, remainingSeconds);
    return {
      label: `ROOM SYNC: ${secs}s`,
      ariaLabel: `Alterações pendentes — próxima sincronização com Room Database em ${secs}s. Clique para sincronizar agora.`,
      tooltip: `Alterações locais detectadas — gravando no Room Database em ${secs}s. Clique para sincronizar agora.${lastSyncSuffix}`,
      remainingSeconds: secs,
      isPending: true,
      isSyncing: false,
      isError: false,
    };
  }

  const secs = remainingSeconds;
  return {
    label: `ROOM SYNC: ${secs}s`,
    ariaLabel: `Room Database sincronizado — próxima verificação em ${secs}s. Clique para sincronizar agora.`,
    tooltip: `Room Database sincronizado. Próxima verificação automática em ${secs}s (clique para sincronizar agora).${lastSyncSuffix}`,
    remainingSeconds: secs,
    isPending: false,
    isSyncing: false,
    isError: false,
  };
}

