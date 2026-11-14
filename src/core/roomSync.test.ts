import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomMirrorProjection,
  computeRemainingSyncSeconds,
  computeWorkspaceDigest,
  createWorkspaceMirrorPayload,
  formatETagHeader,
  formatRoomSyncIndicator,
  isIfNoneMatchWildcard,
  mirrorWorkspaceToRoom,
  OptimisticSheetStore,
  parseIfMatchRevision,
  reconcileWorkspaceWithMirror,
  validateCanonicalSheetPayload,
  validateWorkspaceMirrorInput,
  WorkspaceSyncEngine,
} from './roomSync';
import {
  createDnd5ePreset,
  createWorldOfDarknessSheet,
  toCanonicalSheet,
  updateFieldValue,
  WorkspaceState,
} from './sheetModel';
import {
  requireSyncAuth,
  resolveAllowedCorsOrigins,
  SYNC_TOKEN,
  verifySyncBearerToken,
} from '../../server';

test('computeWorkspaceDigest is deterministic and detects changes across systems', () => {
  const wod = createWorldOfDarknessSheet();
  const ws1: WorkspaceState = {
    activeSystemId: 'wod',
    sheetsBySystem: { wod },
  };
  const ws2: WorkspaceState = {
    activeSystemId: 'wod',
    sheetsBySystem: { wod: { ...wod } },
  };
  assert.equal(computeWorkspaceDigest(ws1), computeWorkspaceDigest(ws2));

  const wsModified: WorkspaceState = {
    activeSystemId: 'wod',
    sheetsBySystem: { wod: { ...wod, characterName: 'MARCUS VANE' } },
  };
  assert.notEqual(computeWorkspaceDigest(ws1), computeWorkspaceDigest(wsModified));
});

test('buildRoomMirrorProjection produces Room SheetEntity and WorkspaceMetadataEntity records', () => {
  const wod = createWorldOfDarknessSheet();
  const dnd = createDnd5ePreset();
  const ws: WorkspaceState = {
    activeSystemId: 'dnd5e',
    sheetsBySystem: { wod, dnd5e: dnd },
  };

  const { entities, metadata } = buildRoomMirrorProjection(ws, 123456789, 'MIRRORED');
  assert.equal(metadata.id, 1);
  assert.equal(metadata.activeSystemId, 'DND5E');
  assert.equal(metadata.updatedAtMillis, 123456789);
  assert.equal(entities.length, 2);

  const dndEntity = entities.find((e) => e.systemId === 'DND5E');
  assert.ok(dndEntity);
  assert.equal(dndEntity.syncState, 'MIRRORED');
  assert.equal(dndEntity.characterName, dnd.characterName);
  assert.equal(JSON.parse(dndEntity.sheetJson).systemId, 'dnd5e');
});

test('validateWorkspaceMirrorInput rejects invalid payloads and sanitizes valid ones', () => {
  const invalid = validateWorkspaceMirrorInput({ workspace: { activeSystemId: 'unknown', sheetsBySystem: {} } });
  assert.equal(invalid.ok, false);

  const wod = createWorldOfDarknessSheet();
  const valid = validateWorkspaceMirrorInput({
    workspace: { activeSystemId: 'wod', sheetsBySystem: { wod } },
    updatedAtMillis: 99000,
    source: 'android',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.source, 'android');
    assert.equal(valid.updatedAtMillis, 99000);
    assert.equal(valid.workspace.sheetsBySystem.wod?.systemId, 'wod');
  }
});

test('reconcileWorkspaceWithMirror adopts newer Android edits and ignores stale web mirrors', () => {
  const localWod = createWorldOfDarknessSheet();
  const localWs: WorkspaceState = { activeSystemId: 'wod', sheetsBySystem: { wod: localWod } };

  const androidWod = { ...localWod, characterName: 'EDITED ON ANDROID ROOM' };
  const androidMirror = createWorkspaceMirrorPayload(
    { activeSystemId: 'wod', sheetsBySystem: { wod: androidWod } },
    5000,
    'android',
  );

  const adopted = reconcileWorkspaceWithMirror(localWs, 3000, androidMirror, { hadLocalWorkspace: true });
  assert.equal(adopted.adoptedRemote, true);
  assert.equal(adopted.workspace.sheetsBySystem.wod?.characterName, 'EDITED ON ANDROID ROOM');

  const webMirror = createWorkspaceMirrorPayload(
    { activeSystemId: 'wod', sheetsBySystem: { wod: { ...localWod, characterName: 'OLD WEB' } } },
    9999,
    'web',
  );
  const keptLocal = reconcileWorkspaceWithMirror(localWs, 3000, webMirror, { hadLocalWorkspace: false });
  assert.equal(keptLocal.adoptedRemote, false);
  assert.equal(keptLocal.workspace.sheetsBySystem.wod?.characterName, localWod.characterName);
});

test('mirrorWorkspaceToRoom invokes AndroidRoomBridge and sends PUT /api/workspace-sync', async () => {
  const wod = createWorldOfDarknessSheet();
  const ws: WorkspaceState = { activeSystemId: 'wod', sheetsBySystem: { wod } };

  let bridgeCalls = 0;
  let capturedUrl = '';
  let capturedMethod = '';

  const outcome = await mirrorWorkspaceToRoom(ws, {
    updatedAtMillis: 77777,
    bridge: {
      syncWorkspace: (json, ts) => {
        bridgeCalls += 1;
        assert.equal(ts, 77777);
        assert.equal(JSON.parse(json).activeSystemId, 'wod');
      },
    },
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedMethod = init?.method ?? '';
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.usedBridge, true);
  assert.equal(outcome.usedHttp, true);
  assert.equal(bridgeCalls, 1);
  assert.equal(capturedUrl, '/api/workspace-sync');
  assert.equal(capturedMethod, 'PUT');
});

test('computeRemainingSyncSeconds and formatRoomSyncIndicator format all Room sync phases', () => {
  assert.equal(computeRemainingSyncSeconds(null, 1000), 0);
  assert.equal(computeRemainingSyncSeconds(1000, 2500), 0);
  assert.equal(computeRemainingSyncSeconds(15200, 1000), 15);

  const synced = formatRoomSyncIndicator(
    { phase: 'synced', nextSyncAtMillis: 40_000, lastSyncedAtMillis: 10_000 },
    12_100,
  );
  assert.equal(synced.label, 'ROOM SYNC: 28s');
  assert.equal(synced.remainingSeconds, 28);
  assert.equal(synced.isPending, false);
  assert.equal(synced.isSyncing, false);
  assert.equal(synced.isError, false);

  const scheduled = formatRoomSyncIndicator(
    { phase: 'scheduled', nextSyncAtMillis: 11_200, lastSyncedAtMillis: 10_000 },
    10_100,
  );
  assert.equal(scheduled.label, 'ROOM SYNC: 2s');
  assert.equal(scheduled.isPending, true);

  const syncing = formatRoomSyncIndicator(
    { phase: 'syncing', nextSyncAtMillis: null, lastSyncedAtMillis: 10_000 },
    11_300,
  );
  assert.equal(syncing.label, 'ROOM SYNC: ...');
  assert.equal(syncing.isSyncing, true);

  const errored = formatRoomSyncIndicator(
    { phase: 'error', nextSyncAtMillis: 15_000, lastSyncedAtMillis: 10_000, lastError: 'HTTP 503' },
    11_500,
  );
  assert.equal(errored.label, 'ROOM RETRY: 4s');
  assert.equal(errored.isError, true);
  assert.match(errored.tooltip, /HTTP 503/);

  const conflict = formatRoomSyncIndicator(
    { phase: 'conflict', nextSyncAtMillis: null, lastSyncedAtMillis: 10_000 },
    12_000,
  );
  assert.equal(conflict.label, 'SYNC CONFLICT (R?≠R?)');
  assert.equal(conflict.isError, true);
});

test('Optimistic sync server contract: 201 creation, 200 update (revision + 1), 400 schema failure, 412 missing If-Match, and 409 REVISION_CONFLICT', () => {
  const store = new OptimisticSheetStore();
  const baseChar = createWorldOfDarknessSheet();
  const initialCanonical = toCanonicalSheet({
    ...baseChar,
    id: 'sheet-wod-1',
    revision: 1,
    updatedAt: '2026-11-14T12:00:00.000Z',
    deviceId: 'dev-client-a',
  });

  // 1. Creation (201 Created) with If-None-Match: * starts at revision 1 and returns ETag "1"
  const createRes = store.handleRequest({
    method: 'POST',
    headers: { 'if-none-match': '*' },
    body: initialCanonical,
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.headers.ETag, '"1"');
  assert.equal((createRes.body.sheet as typeof initialCanonical).revision, 1);

  // 2. Valid update (200 OK) with If-Match: "1" increments server revision to 2 and returns ETag "2"
  const updatedCanonical = {
    ...initialCanonical,
    name: 'ELENA VANCE // ARCHON',
    updatedAt: '2026-11-14T12:05:00.000Z',
    deviceId: 'dev-client-a',
  };
  const updateRes = store.handleRequest({
    method: 'PUT',
    headers: { 'if-match': '"1"' },
    body: updatedCanonical,
    sheetIdParam: 'sheet-wod-1',
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.headers.ETag, '"2"');
  assert.equal((updateRes.body.sheet as typeof initialCanonical).revision, 2);
  assert.equal((updateRes.body.sheet as typeof initialCanonical).name, 'ELENA VANCE // ARCHON');

  // 3. Schema failure (400 Bad Request) when payload violates @shared-specs/sheet.schema.json
  const invalidPayload = {
    ...updatedCanonical,
    revision: 0, // minimum is 1
    updatedAt: 'invalid-timestamp',
    deviceId: '',
    extraUnsupportedProp: true,
  };
  const schemaFailRes = store.handleRequest({
    method: 'PUT',
    headers: { 'if-match': '"2"' },
    body: invalidPayload,
    sheetIdParam: 'sheet-wod-1',
  });
  assert.equal(schemaFailRes.status, 400);
  assert.equal(schemaFailRes.body.error, 'SCHEMA_VALIDATION_FAILED');
  assert.ok(Array.isArray(schemaFailRes.body.details));
  assert.ok((schemaFailRes.body.details as string[]).length >= 1);

  // 4. Missing If-Match header on PUT returns 412 Precondition Failed
  const missingPreconditionRes = store.handleRequest({
    method: 'PUT',
    headers: {},
    body: updatedCanonical,
    sheetIdParam: 'sheet-wod-1',
  });
  assert.equal(missingPreconditionRes.status, 412);
  assert.equal(missingPreconditionRes.body.error, 'PRECONDITION_REQUIRED');

  // 5. Revision conflict (409 Conflict) when client sends stale If-Match: "1" against server revision 2
  const conflictingClientSheet = {
    ...initialCanonical,
    name: 'STALE DEVICE EDIT',
    updatedAt: '2026-11-14T12:06:00.000Z',
    deviceId: 'dev-client-b',
  };
  const conflictRes = store.handleRequest({
    method: 'PUT',
    headers: { 'if-match': '"1"' },
    body: conflictingClientSheet,
    sheetIdParam: 'sheet-wod-1',
  });
  assert.equal(conflictRes.status, 409);
  assert.equal(conflictRes.headers.ETag, '"2"');
  assert.equal(conflictRes.body.error, 'REVISION_CONFLICT');
  const serverSheetOnConflict = conflictRes.body.serverSheet as typeof initialCanonical;
  assert.ok(serverSheetOnConflict);
  assert.equal(serverSheetOnConflict.revision, 2);
  assert.equal(serverSheetOnConflict.name, 'ELENA VANCE // ARCHON');
});

test('WorkspaceSyncEngine tracks baseRevision vs isDirty, sends If-Match: "<baseRevision>", and exposes 409 Conflict without silent overwrite', async () => {
  const store = new OptimisticSheetStore();
  const initialWod = { ...createWorldOfDarknessSheet(), deviceId: 'device-web-1' };

  const storeFetch: typeof fetch = async (_url, init) => {
    const method = (init?.method ?? 'PUT').toUpperCase() as 'POST' | 'PUT';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = JSON.parse(String(init?.body ?? '{}'));
    const res = store.handleRequest({
      method,
      headers: {
        'if-match': headers['If-Match'] ?? headers['if-match'],
        'if-none-match': headers['If-None-Match'] ?? headers['if-none-match'],
      },
      body,
    });
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: res.headers,
    });
  };

  const engine = new WorkspaceSyncEngine({
    initialSheet: initialWod,
    deviceId: 'device-web-1',
    fetchImpl: storeFetch,
  });

  // First creation on server via If-None-Match: * (201 Created, revision 1)
  const createOutcome = await engine.create();
  assert.equal(createOutcome.ok, true);
  assert.equal(createOutcome.status, 201);
  assert.equal(engine.getBaseRevision(), 1);
  assert.equal(engine.isDirty(), false);

  // Local edit marks engine as dirty while baseRevision remains 1
  engine.applyLocalEdit((prev) => {
    const updated = updateFieldValue(prev, 'f_strength', 5);
    return { ...updated, characterName: 'LOCAL EDIT V1' };
  });
  assert.equal(engine.getBaseRevision(), 1);
  assert.equal(engine.isDirty(), true);
  assert.equal(engine.getLocalSheet().revision, 1);

  // Push valid update with If-Match: "1" -> 200 OK, baseRevision advances to 2, isDirty becomes false
  let sentIfMatch = '';
  const pushOk = await engine.push({
    fetchImpl: async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      sentIfMatch = headers['If-Match'] ?? '';
      return storeFetch(url, init);
    },
  });
  assert.equal(sentIfMatch, '"1"');
  assert.equal(pushOk.ok, true);
  assert.equal(pushOk.status, 200);
  assert.equal(engine.getBaseRevision(), 2);
  assert.equal(engine.isDirty(), false);
  assert.equal(engine.getLocalSheet().revision, 2);

  // Simulate another device updating the server to revision 3
  const currentServerSheet = store.getSheet(engine.getLocalSheet().id!)!;
  const remoteEditRes = store.handleRequest({
    method: 'PUT',
    headers: { 'if-match': '"2"' },
    body: {
      ...currentServerSheet,
      name: 'REMOTE DEVICE V3',
      updatedAt: '2026-11-14T15:00:00.000Z',
      deviceId: 'device-android-2',
    },
  });
  assert.equal(remoteEditRes.status, 200);
  assert.equal(store.getSheet(engine.getLocalSheet().id!)?.revision, 3);

  // Now user makes a local edit on Web (still at baseRevision 2, isDirty = true)
  engine.applyLocalEdit((prev) => ({
    ...prev,
    characterName: 'UNSAVED LOCAL WEB EDIT',
  }));
  assert.equal(engine.getBaseRevision(), 2);
  assert.equal(engine.isDirty(), true);

  // Pushing with If-Match: "2" against server revision 3 returns 409 Conflict
  // Engine MUST expose serverSheet vs localSheet and NOT overwrite localSheet
  const conflictOutcome = await engine.push();
  assert.equal(conflictOutcome.ok, false);
  assert.equal(conflictOutcome.status, 409);
  assert.ok(conflictOutcome.conflict);
  assert.equal(conflictOutcome.conflict.baseRevision, 2);
  assert.equal(conflictOutcome.conflict.serverSheet.revision, 3);
  assert.equal(conflictOutcome.conflict.serverSheet.name, 'REMOTE DEVICE V3');
  assert.equal(conflictOutcome.conflict.localSheet.characterName, 'UNSAVED LOCAL WEB EDIT');
  assert.equal(engine.getLocalSheet().characterName, 'UNSAVED LOCAL WEB EDIT');
  assert.equal(engine.isDirty(), true);

  // Resolving conflict by keeping local rebases baseRevision to serverSheet.revision (3) and keeps isDirty=true
  engine.resolveConflict('keep_local');
  assert.equal(engine.getBaseRevision(), 3);
  assert.equal(engine.isDirty(), true);
  assert.equal(engine.getConflict(), null);

  // Subsequent push now sends If-Match: "3" and succeeds -> revision 4
  const retryOutcome = await engine.push();
  assert.equal(retryOutcome.ok, true);
  assert.equal(retryOutcome.status, 200);
  assert.equal(engine.getBaseRevision(), 4);
  assert.equal(engine.isDirty(), false);
  assert.equal(store.getSheet(engine.getLocalSheet().id!)?.name, 'UNSAVED LOCAL WEB EDIT');

  // Helper unit checks for header parsing/formatting
  assert.equal(parseIfMatchRevision('"4"'), 4);
  assert.equal(parseIfMatchRevision('W/"12"'), 12);
  assert.equal(parseIfMatchRevision('invalid'), null);
  assert.equal(isIfNoneMatchWildcard('*'), true);
  assert.equal(formatETagHeader(4), '"4"');
  assert.equal(validateCanonicalSheetPayload({ invalid: true }).ok, false);
});

test('requireSyncAuth validates Bearer token with timingSafeEqual and rejects invalid/missing tokens with 401', () => {
  assert.equal(verifySyncBearerToken(`Bearer ${SYNC_TOKEN}`, SYNC_TOKEN), true);
  assert.equal(verifySyncBearerToken('Bearer wrong-length-token', SYNC_TOKEN), false);
  assert.equal(
    verifySyncBearerToken(`Bearer ${'0'.repeat(SYNC_TOKEN.length)}`, SYNC_TOKEN),
    false,
  );
  assert.equal(verifySyncBearerToken(undefined, SYNC_TOKEN), false);

  let statusCode = 200;
  let nextCalled = false;
  requireSyncAuth(
    { header: () => undefined } as unknown as Parameters<typeof requireSyncAuth>[0],
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Parameters<typeof requireSyncAuth>[1],
    () => {
      nextCalled = true;
    },
  );
  assert.equal(statusCode, 401);
  assert.equal(nextCalled, false);

  requireSyncAuth(
    { header: () => `Bearer ${SYNC_TOKEN}` } as unknown as Parameters<typeof requireSyncAuth>[0],
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Parameters<typeof requireSyncAuth>[1],
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);

  // CORS origin list filters out '*' and falls back to localhost in dev
  const origins = resolveAllowedCorsOrigins('https://app.example.com, * , http://localhost:3000');
  assert.deepEqual(origins, ['https://app.example.com', 'http://localhost:3000']);
  assert.equal(origins.includes('*'), false);
});
