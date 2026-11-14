import {
  type CanonicalBentoCard,
  type CanonicalField,
  type CanonicalRollConfig,
  type CanonicalSheet,
  type CanonicalTab,
  type CharacterSheetState,
  fromCanonicalSheet,
  getOrCreateDeviceId,
  isValidIsoDateTime,
  migrateLegacySheetMetadata,
  nowIsoUtc,
  type SystemId,
  toCanonicalSheet,
  touchSheetMetadata,
  type WorkspaceState,
} from './sheetModel.ts';

export const ROOM_SYNC_META_KEY = 'grid_sheet_room_sync_meta_v1';

export type MirrorSource = 'web' | 'android';

export interface RoomSheetEntityMirror {
  systemId: string;
  systemName: string;
  characterName: string;
  sheetJson: string;
  revision: number;
  updatedAt: string;
  deviceId: string;
  baseRevision: number;
  isDirty: boolean;
  updatedAtMillis: number;
  syncState: 'SYNCED' | 'MIRRORED' | 'PENDING_SYNC' | 'CONFLICT';
}

export interface RoomWorkspaceMetadataMirror {
  id: 1;
  activeSystemId: string;
  updatedAtMillis: number;
}

export interface WorkspaceMirrorPayload {
  workspace: WorkspaceState;
  sheet?: CanonicalSheet;
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
  baseRevisions?: Partial<Record<SystemId, number>>;
  dirtySystems?: Partial<Record<SystemId, boolean>>;
}

export interface SyncConflictInfo {
  error: 'REVISION_CONFLICT';
  sheetId: string;
  systemId: SystemId;
  baseRevision: number;
  localSheet: CharacterSheetState;
  localCanonical: CanonicalSheet;
  serverSheet: CanonicalSheet;
  serverCharacterSheet: CharacterSheetState;
  detectedAt: string;
}

const VALID_SYSTEM_IDS: readonly SystemId[] = ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'];
const VALID_FIELD_TYPES = new Set([
  'number',
  'text',
  'resource',
  'calculated',
  'boolean',
  'dots',
  'roll_button',
  'repeatable_list',
]);
const VALID_ROLL_MODES = new Set(['standard', 'storyteller_skill', 'storyteller_soak']);

export function isValidSystemId(value: unknown): value is SystemId {
  return typeof value === 'string' && VALID_SYSTEM_IDS.includes(value as SystemId);
}

export function toAndroidRoomSystemId(systemId: SystemId): string {
  return systemId.toUpperCase();
}

export function formatETagHeader(revision: number): string {
  const rev = Math.max(1, Math.floor(revision || 1));
  return `"${rev}"`;
}

export function parseIfMatchRevision(headerValue: string | string[] | undefined | null): number | null {
  if (!headerValue) return null;
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutWeak = trimmed.startsWith('W/') ? trimmed.slice(2).trim() : trimmed;
  const unquoted =
    withoutWeak.startsWith('"') && withoutWeak.endsWith('"') && withoutWeak.length >= 2
      ? withoutWeak.slice(1, -1).trim()
      : withoutWeak;
  if (!/^\d+$/.test(unquoted)) return null;
  const parsed = Number.parseInt(unquoted, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

export function isIfNoneMatchWildcard(headerValue: string | string[] | undefined | null): boolean {
  if (!headerValue) return false;
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return trimmed === '*' || trimmed === '"*"';
}

function validateRollConfigNode(
  node: unknown,
  pathPrefix: string,
  errors: string[],
): node is CanonicalRollConfig {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`${pathPrefix} must be an object`);
    return false;
  }
  const obj = node as Record<string, unknown>;
  const allowedKeys = new Set(['mode', 'expression', 'difficulty', 'specialty', 'useWillpower']);
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      errors.push(`${pathPrefix} has disallowed additional property "${k}"`);
    }
  }
  if (typeof obj.mode !== 'string' || !VALID_ROLL_MODES.has(obj.mode)) {
    errors.push(`${pathPrefix}.mode must be one of standard, storyteller_skill, storyteller_soak`);
  }
  if (typeof obj.expression !== 'string' || obj.expression.length > 256) {
    errors.push(`${pathPrefix}.expression must be a string up to 256 chars`);
  }
  if (
    obj.difficulty !== undefined &&
    (typeof obj.difficulty !== 'number' ||
      !Number.isInteger(obj.difficulty) ||
      obj.difficulty < 2 ||
      obj.difficulty > 10)
  ) {
    errors.push(`${pathPrefix}.difficulty must be an integer between 2 and 10`);
  }
  if (obj.specialty !== undefined && typeof obj.specialty !== 'boolean') {
    errors.push(`${pathPrefix}.specialty must be a boolean`);
  }
  if (obj.useWillpower !== undefined && typeof obj.useWillpower !== 'boolean') {
    errors.push(`${pathPrefix}.useWillpower must be a boolean`);
  }
  return errors.length === 0;
}

function validateFieldNode(
  node: unknown,
  pathPrefix: string,
  errors: string[],
): node is CanonicalField {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`${pathPrefix} must be an object`);
    return false;
  }
  const obj = node as Record<string, unknown>;
  const allowedKeys = new Set([
    'id',
    'label',
    'type',
    'value',
    'maxValue',
    'maxDots',
    'formula',
    'rollConfig',
    'subFields',
    'rows',
  ]);
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      errors.push(`${pathPrefix} has disallowed additional property "${k}"`);
    }
  }
  if (
    typeof obj.id !== 'string' ||
    obj.id.length < 1 ||
    obj.id.length > 64 ||
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(obj.id)
  ) {
    errors.push(`${pathPrefix}.id must match ^[a-zA-Z_][a-zA-Z0-9_]*$`);
  }
  if (typeof obj.label !== 'string' || obj.label.length < 1 || obj.label.length > 100) {
    errors.push(`${pathPrefix}.label must be a string (1..100)`);
  }
  if (typeof obj.type !== 'string' || !VALID_FIELD_TYPES.has(obj.type)) {
    errors.push(`${pathPrefix}.type must be a valid field type`);
  }
  if (
    obj.value !== undefined &&
    obj.value !== null &&
    typeof obj.value !== 'number' &&
    typeof obj.value !== 'string' &&
    typeof obj.value !== 'boolean'
  ) {
    errors.push(`${pathPrefix}.value must be number, string, boolean, or null`);
  }
  if (obj.maxValue !== undefined && obj.maxValue !== null && typeof obj.maxValue !== 'number') {
    errors.push(`${pathPrefix}.maxValue must be number or null`);
  }
  if (
    obj.maxDots !== undefined &&
    (typeof obj.maxDots !== 'number' ||
      !Number.isInteger(obj.maxDots) ||
      obj.maxDots < 1 ||
      obj.maxDots > 20)
  ) {
    errors.push(`${pathPrefix}.maxDots must be an integer between 1 and 20`);
  }
  if (obj.formula !== undefined && (typeof obj.formula !== 'string' || obj.formula.length > 256)) {
    errors.push(`${pathPrefix}.formula must be a string up to 256 chars`);
  }
  if (obj.rollConfig !== undefined) {
    validateRollConfigNode(obj.rollConfig, `${pathPrefix}.rollConfig`, errors);
  }
  if (obj.subFields !== undefined) {
    if (!Array.isArray(obj.subFields) || obj.subFields.length > 20) {
      errors.push(`${pathPrefix}.subFields must be an array up to 20 items`);
    } else {
      obj.subFields.forEach((sf, idx) =>
        validateFieldNode(sf, `${pathPrefix}.subFields[${idx}]`, errors),
      );
    }
  }
  if (obj.rows !== undefined) {
    if (!Array.isArray(obj.rows) || obj.rows.length > 200) {
      errors.push(`${pathPrefix}.rows must be an array up to 200 items`);
    } else {
      obj.rows.forEach((row, rIdx) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          errors.push(`${pathPrefix}.rows[${rIdx}] must be an object`);
          return;
        }
        for (const [rk, rv] of Object.entries(row as Record<string, unknown>)) {
          if (
            rv !== null &&
            typeof rv !== 'number' &&
            typeof rv !== 'string' &&
            typeof rv !== 'boolean'
          ) {
            errors.push(`${pathPrefix}.rows[${rIdx}].${rk} must be primitive or null`);
          }
        }
      });
    }
  }
  return errors.length === 0;
}

function validateCardNode(
  node: unknown,
  pathPrefix: string,
  errors: string[],
): node is CanonicalBentoCard {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`${pathPrefix} must be an object`);
    return false;
  }
  const obj = node as Record<string, unknown>;
  const allowedKeys = new Set(['id', 'tag', 'title', 'columns', 'fields']);
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      errors.push(`${pathPrefix} has disallowed additional property "${k}"`);
    }
  }
  if (typeof obj.id !== 'string' || obj.id.length < 1 || obj.id.length > 64) {
    errors.push(`${pathPrefix}.id must be a string (1..64)`);
  }
  if (obj.tag !== undefined && (typeof obj.tag !== 'string' || obj.tag.length > 40)) {
    errors.push(`${pathPrefix}.tag must be a string up to 40 chars`);
  }
  if (typeof obj.title !== 'string' || obj.title.length < 1 || obj.title.length > 80) {
    errors.push(`${pathPrefix}.title must be a string (1..80)`);
  }
  if (
    typeof obj.columns !== 'number' ||
    !Number.isInteger(obj.columns) ||
    obj.columns < 1 ||
    obj.columns > 4
  ) {
    errors.push(`${pathPrefix}.columns must be an integer between 1 and 4`);
  }
  if (!Array.isArray(obj.fields) || obj.fields.length > 100) {
    errors.push(`${pathPrefix}.fields must be an array up to 100 items`);
  } else {
    obj.fields.forEach((f, fIdx) =>
      validateFieldNode(f, `${pathPrefix}.fields[${fIdx}]`, errors),
    );
  }
  return errors.length === 0;
}

function validateTabNode(
  node: unknown,
  pathPrefix: string,
  errors: string[],
): node is CanonicalTab {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`${pathPrefix} must be an object`);
    return false;
  }
  const obj = node as Record<string, unknown>;
  const allowedKeys = new Set(['id', 'title', 'cards']);
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      errors.push(`${pathPrefix} has disallowed additional property "${k}"`);
    }
  }
  if (typeof obj.id !== 'string' || obj.id.length < 1 || obj.id.length > 64) {
    errors.push(`${pathPrefix}.id must be a string (1..64)`);
  }
  if (typeof obj.title !== 'string' || obj.title.length < 1 || obj.title.length > 80) {
    errors.push(`${pathPrefix}.title must be a string (1..80)`);
  }
  if (!Array.isArray(obj.cards) || obj.cards.length > 50) {
    errors.push(`${pathPrefix}.cards must be an array up to 50 items`);
  } else {
    obj.cards.forEach((c, cIdx) => validateCardNode(c, `${pathPrefix}.cards[${cIdx}]`, errors));
  }
  return errors.length === 0;
}

export function validateCanonicalSheetPayload(
  payload: unknown,
  externalAjvValidator?: ((data: unknown) => boolean) & { errors?: unknown[] | null },
):
  | { ok: true; sheet: CanonicalSheet }
  | { ok: false; error: string; details: string[] } {
  if (externalAjvValidator) {
    const valid = externalAjvValidator(payload);
    if (!valid) {
      const details = Array.isArray(externalAjvValidator.errors)
        ? externalAjvValidator.errors.map((e) => JSON.stringify(e))
        : ['Schema validation failed'];
      return {
        ok: false,
        error: 'SCHEMA_VALIDATION_FAILED',
        details,
      };
    }
  }

  const errors: string[] = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      error: 'SCHEMA_VALIDATION_FAILED',
      details: ['Root payload must be a JSON object'],
    };
  }

  const obj = payload as Record<string, unknown>;
  const allowedRootKeys = new Set([
    'id',
    'name',
    'systemId',
    'revision',
    'updatedAt',
    'deviceId',
    'tabs',
  ]);
  for (const k of Object.keys(obj)) {
    if (!allowedRootKeys.has(k)) {
      errors.push(`root has disallowed additional property "${k}"`);
    }
  }

  if (
    typeof obj.id !== 'string' ||
    obj.id.length < 1 ||
    obj.id.length > 64 ||
    !/^[a-zA-Z0-9_-]+$/.test(obj.id)
  ) {
    errors.push('id must be a string (1..64) matching ^[a-zA-Z0-9_-]+$');
  }
  if (typeof obj.name !== 'string' || obj.name.length < 1 || obj.name.length > 120) {
    errors.push('name must be a string (1..120)');
  }
  if (typeof obj.systemId !== 'string' || obj.systemId.length < 1 || obj.systemId.length > 64) {
    errors.push('systemId must be a string (1..64)');
  }
  if (
    typeof obj.revision !== 'number' ||
    !Number.isInteger(obj.revision) ||
    obj.revision < 1
  ) {
    errors.push('revision must be an integer >= 1');
  }
  if (!isValidIsoDateTime(obj.updatedAt)) {
    errors.push('updatedAt must be a valid ISO-8601 date-time string');
  }
  if (typeof obj.deviceId !== 'string' || obj.deviceId.trim().length < 1 || obj.deviceId.length > 128) {
    errors.push('deviceId must be a non-empty string (1..128)');
  }
  if (!Array.isArray(obj.tabs) || obj.tabs.length < 1 || obj.tabs.length > 20) {
    errors.push('tabs must be an array with 1..20 items');
  } else {
    obj.tabs.forEach((tab, idx) => validateTabNode(tab, `tabs[${idx}]`, errors));
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: 'SCHEMA_VALIDATION_FAILED',
      details: errors,
    };
  }

  return {
    ok: true,
    sheet: obj as unknown as CanonicalSheet,
  };
}

export interface OptimisticServerRequest {
  method: 'POST' | 'PUT' | 'GET';
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  sheetIdParam?: string;
}

export interface OptimisticServerResponse {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export class OptimisticSheetStore {
  private readonly sheetsById = new Map<string, CanonicalSheet>();
  private readonly externalValidator?: ((data: unknown) => boolean) & { errors?: unknown[] | null };

  constructor(
    initialSheets: CanonicalSheet[] = [],
    externalValidator?: ((data: unknown) => boolean) & { errors?: unknown[] | null },
  ) {
    this.externalValidator = externalValidator;
    for (const sheet of initialSheets) {
      this.sheetsById.set(sheet.id, { ...sheet });
    }
  }

  getSheet(id: string): CanonicalSheet | undefined {
    const found = this.sheetsById.get(id);
    return found ? { ...found } : undefined;
  }

  getAllSheets(): CanonicalSheet[] {
    return Array.from(this.sheetsById.values()).map((s) => ({ ...s }));
  }

  setSheet(sheet: CanonicalSheet): void {
    this.sheetsById.set(sheet.id, { ...sheet });
  }

  handleRequest(req: OptimisticServerRequest): OptimisticServerResponse {
    const lowerHeaders: Record<string, string | string[] | undefined> = {};
    for (const [k, v] of Object.entries(req.headers ?? {})) {
      lowerHeaders[k.toLowerCase()] = v;
    }

    if (req.method === 'GET') {
      if (req.sheetIdParam) {
        const existing = this.getSheet(req.sheetIdParam);
        if (!existing) {
          return {
            status: 404,
            headers: {},
            body: { ok: false, error: 'SHEET_NOT_FOUND' },
          };
        }
        return {
          status: 200,
          headers: { ETag: formatETagHeader(existing.revision) },
          body: { ok: true, sheet: existing },
        };
      }
      const all = this.getAllSheets();
      const latest = all[all.length - 1] ?? null;
      return {
        status: 200,
        headers: latest ? { ETag: formatETagHeader(latest.revision) } : {},
        body: { ok: true, sheets: all, sheet: latest },
      };
    }

    // Extract candidate sheet payload (supports direct CanonicalSheet or { sheet: CanonicalSheet })
    const rawBody = req.body as Record<string, unknown> | null | undefined;
    const candidatePayload =
      rawBody &&
      typeof rawBody === 'object' &&
      !Array.isArray(rawBody) &&
      'sheet' in rawBody &&
      rawBody.sheet !== undefined
        ? rawBody.sheet
        : req.body;

    const validation = validateCanonicalSheetPayload(candidatePayload, this.externalValidator);
    if (!validation.ok) {
      return {
        status: 400,
        headers: {},
        body: {
          ok: false,
          error: validation.error,
          details: validation.details,
        },
      };
    }

    const incomingSheet = validation.sheet;
    const targetId = req.sheetIdParam || incomingSheet.id;
    const existing = this.sheetsById.get(targetId);

    const ifNoneMatch = lowerHeaders['if-none-match'];
    const ifMatch = lowerHeaders['if-match'];
    const isWildcardCreate = isIfNoneMatchWildcard(ifNoneMatch);
    const expectedRevision = parseIfMatchRevision(ifMatch);

    // Creation path: POST or If-None-Match: *
    if (req.method === 'POST' || isWildcardCreate) {
      if (!isWildcardCreate) {
        return {
          status: 412,
          headers: {},
          body: {
            ok: false,
            error: 'PRECONDITION_REQUIRED',
            message: 'Cabeçalho If-None-Match: * é obrigatório na criação de ficha.',
          },
        };
      }

      if (existing) {
        return {
          status: 409,
          headers: { ETag: formatETagHeader(existing.revision) },
          body: {
            ok: false,
            error: 'REVISION_CONFLICT',
            serverSheet: existing,
          },
        };
      }

      const createdSheet: CanonicalSheet = {
        ...incomingSheet,
        id: targetId,
        revision: 1,
      };
      this.sheetsById.set(targetId, createdSheet);
      const etag = formatETagHeader(createdSheet.revision);
      return {
        status: 201,
        headers: { ETag: etag },
        body: {
          ok: true,
          sheet: createdSheet,
        },
      };
    }

    // Update path (PUT): require If-Match: "<revision>"
    if (expectedRevision === null) {
      return {
        status: 412,
        headers: {},
        body: {
          ok: false,
          error: 'PRECONDITION_REQUIRED',
          message: 'Cabeçalho If-Match: "<revision>" é obrigatório na atualização.',
        },
      };
    }

    const currentServerSheet: CanonicalSheet =
      existing ?? {
        ...incomingSheet,
        id: targetId,
        revision: 1,
      };

    if (
      expectedRevision !== currentServerSheet.revision ||
      incomingSheet.revision !== currentServerSheet.revision
    ) {
      if (!existing) {
        this.sheetsById.set(targetId, currentServerSheet);
      }
      return {
        status: 409,
        headers: { ETag: formatETagHeader(currentServerSheet.revision) },
        body: {
          ok: false,
          error: 'REVISION_CONFLICT',
          serverSheet: currentServerSheet,
        },
      };
    }

    const nextRevision = currentServerSheet.revision + 1;
    const updatedSheet: CanonicalSheet = {
      ...incomingSheet,
      id: targetId,
      revision: nextRevision,
    };
    this.sheetsById.set(targetId, updatedSheet);
    const etag = formatETagHeader(updatedSheet.revision);

    return {
      status: 200,
      headers: { ETag: etag },
      body: {
        ok: true,
        sheet: updatedSheet,
      },
    };
  }
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
  syncState: 'SYNCED' | 'MIRRORED' | 'PENDING_SYNC' | 'CONFLICT' = 'MIRRORED',
  options?: {
    baseRevisions?: Partial<Record<SystemId, number>>;
    dirtySystems?: Partial<Record<SystemId, boolean>>;
  },
): { entities: RoomSheetEntityMirror[]; metadata: RoomWorkspaceMetadataMirror } {
  const entities: RoomSheetEntityMirror[] = [];

  for (const key of Object.keys(workspace.sheetsBySystem).sort()) {
    const sysId = key as SystemId;
    const sheet = workspace.sheetsBySystem[sysId];
    if (!sheet) continue;
    const migrated = migrateLegacySheetMetadata({ ...sheet, systemId: sysId });
    const baseRevision = options?.baseRevisions?.[sysId] ?? migrated.revision;
    const isDirty = Boolean(options?.dirtySystems?.[sysId]);
    entities.push({
      systemId: toAndroidRoomSystemId(sysId),
      systemName: migrated.systemName,
      characterName: migrated.characterName,
      sheetJson: JSON.stringify(migrated),
      revision: migrated.revision,
      updatedAt: migrated.updatedAt,
      deviceId: migrated.deviceId,
      baseRevision,
      isDirty,
      updatedAtMillis,
      syncState: isDirty ? 'PENDING_SYNC' : syncState,
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
  const activeSheet = workspace.sheetsBySystem[workspace.activeSystemId];
  return {
    workspace,
    sheet: activeSheet ? toCanonicalSheet(activeSheet) : undefined,
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
      sheet?: CanonicalSheet;
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
    sanitizedSheets[k] = migrateLegacySheetMetadata({
      ...candidate,
      systemId: k,
      rollLogs: Array.isArray(candidate.rollLogs) ? candidate.rollLogs : [],
    });
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
  options: {
    hadLocalWorkspace?: boolean;
    isDirty?: boolean;
    baseRevision?: number;
  } = {},
): {
  workspace: WorkspaceState;
  updatedAtMillis: number;
  adoptedRemote: boolean;
  conflict?: SyncConflictInfo | null;
} {
  if (!remoteMirror) {
    return {
      workspace: localWorkspace,
      updatedAtMillis: localUpdatedAtMillis,
      adoptedRemote: false,
      conflict: null,
    };
  }

  const activeSys = localWorkspace.activeSystemId;
  const localSheet = localWorkspace.sheetsBySystem[activeSys];
  const remoteSheet = remoteMirror.workspace.sheetsBySystem[activeSys];

  // Never silently overwrite dirty local edits when remote has diverged
  if (options.isDirty && localSheet && remoteSheet) {
    const baseRev = options.baseRevision ?? localSheet.revision ?? 1;
    const remoteRev = remoteSheet.revision ?? 1;
    if (remoteRev !== baseRev || remoteMirror.updatedAtMillis > localUpdatedAtMillis) {
      const serverCanonical = remoteMirror.sheet ?? toCanonicalSheet(remoteSheet);
      return {
        workspace: localWorkspace,
        updatedAtMillis: localUpdatedAtMillis,
        adoptedRemote: false,
        conflict: {
          error: 'REVISION_CONFLICT',
          sheetId: serverCanonical.id,
          systemId: activeSys,
          baseRevision: baseRev,
          localSheet,
          localCanonical: toCanonicalSheet(localSheet),
          serverSheet: serverCanonical,
          serverCharacterSheet: remoteSheet,
          detectedAt: nowIsoUtc(),
        },
      };
    }
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
      conflict: null,
    };
  }

  return {
    workspace: localWorkspace,
    updatedAtMillis: localUpdatedAtMillis,
    adoptedRemote: false,
    conflict: null,
  };
}

export interface MirrorSyncOutcome {
  ok: boolean;
  status?: number;
  digest: string;
  updatedAtMillis: number;
  usedBridge: boolean;
  usedHttp: boolean;
  confirmedRevision?: number;
  etag?: string;
  conflict?: SyncConflictInfo | null;
  error?: string;
}

export async function mirrorWorkspaceToRoom(
  workspace: WorkspaceState,
  options: {
    updatedAtMillis?: number;
    baseRevision?: number;
    createIfAbsent?: boolean;
    fetchImpl?: typeof fetch;
    keepalive?: boolean;
    bridge?: AndroidRoomBridge | null;
    endpoint?: string;
  } = {},
): Promise<MirrorSyncOutcome> {
  const updatedAtMillis = options.updatedAtMillis ?? Date.now();
  const digest = computeWorkspaceDigest(workspace);
  const endpoint = options.endpoint ?? '/api/workspace-sync';
  const activeSys = workspace.activeSystemId;
  const activeSheet = workspace.sheetsBySystem[activeSys];
  const baseRevision = Math.max(
    1,
    Math.floor(options.baseRevision ?? activeSheet?.revision ?? 1),
  );
  const canonicalSheet = activeSheet
    ? toCanonicalSheet({ ...activeSheet, revision: baseRevision })
    : undefined;

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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.createIfAbsent) {
      headers['If-None-Match'] = '*';
    } else {
      headers['If-Match'] = formatETagHeader(baseRevision);
    }

    const response = await fetchFn(endpoint, {
      method: options.createIfAbsent ? 'POST' : 'PUT',
      headers,
      keepalive: Boolean(options.keepalive),
      body: JSON.stringify({
        workspace,
        sheet: canonicalSheet,
        updatedAtMillis,
        digest,
        source: 'web',
      }),
    });

    const etagHeader = response.headers?.get?.('ETag') ?? response.headers?.get?.('etag') ?? undefined;
    let parsedBody: Record<string, unknown> | null = null;
    try {
      parsedBody = (await response.json()) as Record<string, unknown>;
    } catch {
      parsedBody = null;
    }

    if (response.status === 409) {
      const rawServerSheet = (parsedBody?.serverSheet ?? null) as CanonicalSheet | null;
      const fallbackCanonical = canonicalSheet ?? toCanonicalSheet(
        migrateLegacySheetMetadata({
          systemId: activeSys,
          systemName: 'SYSTEM',
          systemCode: '/SYS',
          characterName: 'CHARACTER',
          cards: [],
          rollLogs: [],
        }),
      );
      const resolvedServerCanonical = rawServerSheet ?? {
        ...fallbackCanonical,
        revision: baseRevision + 1,
      };
      const localCharSheet =
        activeSheet ?? fromCanonicalSheet(fallbackCanonical);
      const serverCharSheet = fromCanonicalSheet(resolvedServerCanonical, localCharSheet);

      return {
        ok: false,
        status: 409,
        digest,
        updatedAtMillis,
        usedBridge,
        usedHttp: false,
        etag: etagHeader,
        error: 'REVISION_CONFLICT',
        conflict: {
          error: 'REVISION_CONFLICT',
          sheetId: resolvedServerCanonical.id,
          systemId: activeSys,
          baseRevision,
          localSheet: localCharSheet,
          localCanonical: canonicalSheet ?? fallbackCanonical,
          serverSheet: resolvedServerCanonical,
          serverCharacterSheet: serverCharSheet,
          detectedAt: nowIsoUtc(),
        },
      };
    }

    if (!response.ok) {
      return {
        ok: usedBridge,
        status: response.status,
        digest,
        updatedAtMillis,
        usedBridge,
        usedHttp: false,
        error:
          typeof parsedBody?.error === 'string'
            ? parsedBody.error
            : `HTTP ${response.status}`,
      };
    }

    const confirmedFromEtag = parseIfMatchRevision(etagHeader);
    const bodySheet = parsedBody?.sheet as CanonicalSheet | undefined;
    const confirmedRevision =
      confirmedFromEtag ??
      (typeof bodySheet?.revision === 'number' ? bodySheet.revision : baseRevision + 1);

    return {
      ok: true,
      status: response.status,
      digest,
      updatedAtMillis,
      usedBridge,
      usedHttp: true,
      confirmedRevision,
      etag: etagHeader ?? formatETagHeader(confirmedRevision),
      conflict: null,
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

export interface WorkspaceSyncPushResult {
  ok: boolean;
  status: number;
  baseRevision: number;
  isDirty: boolean;
  etag?: string;
  sheet: CharacterSheetState;
  canonicalSheet: CanonicalSheet;
  conflict: SyncConflictInfo | null;
  error?: string;
}

/**
 * Motor de Sincronização Otimista (Web) — rastreia `baseRevision` separada de edições
 * locais pendentes (`isDirty`), envia `If-Match: "<baseRevision>"` no push e expõe
 * conflitos `409 Conflict` (`serverSheet` vs. `localSheet`) sem sobrescrita silenciosa.
 */
export class WorkspaceSyncEngine {
  private baseRevision: number;
  private dirty: boolean;
  private localSheet: CharacterSheetState;
  private conflictState: SyncConflictInfo | null = null;
  private readonly endpoint: string;
  private readonly fetchImpl?: typeof fetch;
  private readonly deviceId: string;

  constructor(options: {
    initialSheet: CharacterSheetState;
    baseRevision?: number;
    isDirty?: boolean;
    endpoint?: string;
    fetchImpl?: typeof fetch;
    deviceId?: string;
  }) {
    this.deviceId = options.deviceId ?? getOrCreateDeviceId();
    const migrated = migrateLegacySheetMetadata(options.initialSheet, {
      deviceId: this.deviceId,
    });
    this.baseRevision = Math.max(
      1,
      Math.floor(options.baseRevision ?? migrated.revision ?? 1),
    );
    this.dirty = Boolean(options.isDirty);
    this.localSheet = {
      ...migrated,
      revision: this.baseRevision,
    };
    this.endpoint = options.endpoint ?? '/api/workspace-sync';
    this.fetchImpl = options.fetchImpl;
  }

  getBaseRevision(): number {
    return this.baseRevision;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  getLocalSheet(): CharacterSheetState {
    return this.localSheet;
  }

  getConflict(): SyncConflictInfo | null {
    return this.conflictState;
  }

  applyLocalEdit(
    updater: CharacterSheetState | ((prev: CharacterSheetState) => CharacterSheetState),
    nowIso?: string,
  ): CharacterSheetState {
    const nextRaw = typeof updater === 'function' ? updater(this.localSheet) : updater;
    const touched = touchSheetMetadata(nextRaw, {
      updatedAt: nowIso ?? nowIsoUtc(),
      deviceId: this.deviceId,
    });
    // Local edits never increment revision; only the server increments revision on accepted write
    this.localSheet = {
      ...touched,
      revision: this.baseRevision,
    };
    this.dirty = true;
    return this.localSheet;
  }

  async create(options?: { fetchImpl?: typeof fetch; endpoint?: string }): Promise<WorkspaceSyncPushResult> {
    return this.sendWriteRequest({
      mode: 'create',
      fetchImpl: options?.fetchImpl ?? this.fetchImpl,
      endpoint: options?.endpoint ?? this.endpoint,
    });
  }

  async push(options?: { fetchImpl?: typeof fetch; endpoint?: string }): Promise<WorkspaceSyncPushResult> {
    return this.sendWriteRequest({
      mode: 'update',
      fetchImpl: options?.fetchImpl ?? this.fetchImpl,
      endpoint: options?.endpoint ?? this.endpoint,
    });
  }

  private async sendWriteRequest(params: {
    mode: 'create' | 'update';
    fetchImpl?: typeof fetch;
    endpoint: string;
  }): Promise<WorkspaceSyncPushResult> {
    const fetchFn = params.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    const canonicalPayload = toCanonicalSheet({
      ...this.localSheet,
      revision: this.baseRevision,
    });

    if (!fetchFn) {
      return {
        ok: false,
        status: 0,
        baseRevision: this.baseRevision,
        isDirty: this.dirty,
        sheet: this.localSheet,
        canonicalSheet: canonicalPayload,
        conflict: this.conflictState,
        error: 'Fetch indisponível neste ambiente.',
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (params.mode === 'create') {
      headers['If-None-Match'] = '*';
    } else {
      headers['If-Match'] = formatETagHeader(this.baseRevision);
    }

    const response = await fetchFn(params.endpoint, {
      method: params.mode === 'create' ? 'POST' : 'PUT',
      headers,
      body: JSON.stringify(canonicalPayload),
    });

    const etagHeader =
      response.headers?.get?.('ETag') ?? response.headers?.get?.('etag') ?? undefined;
    let bodyJson: Record<string, unknown> | null = null;
    try {
      bodyJson = (await response.json()) as Record<string, unknown>;
    } catch {
      bodyJson = null;
    }

    if (response.status === 409) {
      const serverSheetRaw = (bodyJson?.serverSheet ?? null) as CanonicalSheet | null;
      const serverCanonical: CanonicalSheet = serverSheetRaw ?? {
        ...canonicalPayload,
        revision: this.baseRevision + 1,
      };
      const serverCharacterSheet = fromCanonicalSheet(serverCanonical, this.localSheet);

      // Preserve localSheet and dirty state; expose both local and server versions without silent overwrite
      this.dirty = true;
      this.conflictState = {
        error: 'REVISION_CONFLICT',
        sheetId: serverCanonical.id,
        systemId: (this.localSheet.systemId ?? 'wod') as SystemId,
        baseRevision: this.baseRevision,
        localSheet: this.localSheet,
        localCanonical: canonicalPayload,
        serverSheet: serverCanonical,
        serverCharacterSheet,
        detectedAt: nowIsoUtc(),
      };

      return {
        ok: false,
        status: 409,
        baseRevision: this.baseRevision,
        isDirty: this.dirty,
        etag: etagHeader,
        sheet: this.localSheet,
        canonicalSheet: canonicalPayload,
        conflict: this.conflictState,
        error: 'REVISION_CONFLICT',
      };
    }

    if (response.status === 200 || response.status === 201) {
      const returnedSheet = (bodyJson?.sheet ?? bodyJson) as Partial<CanonicalSheet> | null;
      const parsedEtagRev = parseIfMatchRevision(etagHeader);
      const nextRevision =
        parsedEtagRev ??
        (typeof returnedSheet?.revision === 'number'
          ? returnedSheet.revision
          : params.mode === 'create'
            ? 1
            : this.baseRevision + 1);

      this.baseRevision = nextRevision;
      this.dirty = false;
      this.conflictState = null;
      this.localSheet = {
        ...this.localSheet,
        revision: nextRevision,
      };
      const confirmedCanonical = toCanonicalSheet(this.localSheet);

      return {
        ok: true,
        status: response.status,
        baseRevision: this.baseRevision,
        isDirty: false,
        etag: etagHeader ?? formatETagHeader(nextRevision),
        sheet: this.localSheet,
        canonicalSheet: confirmedCanonical,
        conflict: null,
      };
    }

    return {
      ok: false,
      status: response.status,
      baseRevision: this.baseRevision,
      isDirty: this.dirty,
      etag: etagHeader,
      sheet: this.localSheet,
      canonicalSheet: canonicalPayload,
      conflict: this.conflictState,
      error:
        typeof bodyJson?.error === 'string'
          ? bodyJson.error
          : `HTTP ${response.status}`,
    };
  }

  resolveConflict(resolution: 'accept_server' | 'keep_local' | CharacterSheetState): CharacterSheetState {
    if (!this.conflictState) return this.localSheet;
    const serverRevision = this.conflictState.serverSheet.revision;

    if (resolution === 'accept_server') {
      this.baseRevision = serverRevision;
      this.localSheet = {
        ...this.conflictState.serverCharacterSheet,
        revision: serverRevision,
      };
      this.dirty = false;
      this.conflictState = null;
      return this.localSheet;
    }

    const chosenLocal =
      resolution === 'keep_local' ? this.localSheet : resolution;
    this.baseRevision = serverRevision;
    this.localSheet = {
      ...touchSheetMetadata(chosenLocal, { deviceId: this.deviceId }),
      revision: serverRevision,
    };
    this.dirty = true;
    this.conflictState = null;
    return this.localSheet;
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

export type RoomSyncPhase = 'synced' | 'scheduled' | 'syncing' | 'error' | 'conflict';

export interface RoomSyncIndicatorState {
  phase: RoomSyncPhase;
  nextSyncAtMillis: number | null;
  lastSyncedAtMillis: number | null;
  lastError?: string;
  conflict?: SyncConflictInfo | null;
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

  if (state.phase === 'conflict') {
    const serverRev = state.conflict?.serverSheet.revision ?? '?';
    const localRev = state.conflict?.baseRevision ?? '?';
    return {
      label: `SYNC CONFLICT (R${localRev}≠R${serverRev})`,
      ariaLabel: `Conflito de revisão detectado (local R${localRev} vs servidor R${serverRev}).`,
      tooltip: `Conflito otimista 409: revisão local R${localRev} diverge da revisão do servidor R${serverRev}.${lastSyncSuffix}`,
      remainingSeconds: 0,
      isPending: false,
      isSyncing: false,
      isError: true,
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
