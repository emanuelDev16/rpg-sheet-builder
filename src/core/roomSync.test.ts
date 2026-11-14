import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomMirrorProjection,
  computeRemainingSyncSeconds,
  computeWorkspaceDigest,
  createWorkspaceMirrorPayload,
  formatRoomSyncIndicator,
  mirrorWorkspaceToRoom,
  reconcileWorkspaceWithMirror,
  validateWorkspaceMirrorInput,
} from './roomSync';
import { createDnd5ePreset, createWorldOfDarknessSheet, WorkspaceState } from './sheetModel';

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
});
