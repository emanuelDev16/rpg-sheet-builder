package com.gridsheet.app

import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.WorkspaceSyncEngine
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkspaceSyncTest {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    @Test
    fun migratesExistingSharedPreferencesIntoEmptyRoomDatabase() {
        val prefsWod = Presets.createWorldOfDarknessSheet().copy(characterName = "EDITED IN PREFS")
        val prefsWs = WorkspaceState(
            activeSystemId = SystemId.WOD,
            sheetsBySystem = mapOf(SystemId.WOD to prefsWod)
        )

        val result = WorkspaceSyncEngine.reconcile(
            roomSheets = emptyList(),
            roomMeta = null,
            prefsWorkspace = prefsWs,
            prefsUpdatedAt = 5000L,
            nowMillis = 6000L,
            json = json
        )

        assertEquals(1, result.entitiesToUpsertIntoRoom.size)
        assertEquals("EDITED IN PREFS", result.workspace.sheetsBySystem[SystemId.WOD]?.characterName)
        assertFalse(result.shouldUpdatePrefs)
    }

    @Test
    fun restoresOfflineRoomSheetsWhenSharedPreferencesAreEmpty() {
        val roomDnd = Presets.createDnd5ePreset().copy(characterName = "OFFLINE ROOM LYRA")
        val entity = WorkspaceSyncEngine.toEntity(SystemId.DND5E, roomDnd, 9000L, json)
        val meta = WorkspaceMetadataEntity(id = 1, activeSystemId = SystemId.DND5E.name, updatedAtMillis = 9000L)

        val result = WorkspaceSyncEngine.reconcile(
            roomSheets = listOf(entity),
            roomMeta = meta,
            prefsWorkspace = null,
            prefsUpdatedAt = 0L,
            nowMillis = 10000L,
            json = json
        )

        assertEquals(SystemId.DND5E, result.workspace.activeSystemId)
        assertEquals("OFFLINE ROOM LYRA", result.workspace.sheetsBySystem[SystemId.DND5E]?.characterName)
        assertTrue(result.entitiesToUpsertIntoRoom.isEmpty())
        assertTrue(result.shouldUpdatePrefs)
    }

    @Test
    fun resolvesPerSystemConflictsByNewestTimestampBetweenRoomAndPrefs() {
        val olderPrefsWod = Presets.createWorldOfDarknessSheet().copy(characterName = "STALE PREFS WOD")
        val newerRoomWod = Presets.createWorldOfDarknessSheet().copy(characterName = "NEWER ROOM WOD")
        val newerPrefsDnd = Presets.createDnd5ePreset().copy(characterName = "NEWER PREFS DND")

        val roomWodEntity = WorkspaceSyncEngine.toEntity(SystemId.WOD, newerRoomWod, 8000L, json)
        val prefsWs = WorkspaceState(
            activeSystemId = SystemId.DND5E,
            sheetsBySystem = mapOf(
                SystemId.WOD to olderPrefsWod,
                SystemId.DND5E to newerPrefsDnd
            )
        )

        val result = WorkspaceSyncEngine.reconcile(
            roomSheets = listOf(roomWodEntity),
            roomMeta = WorkspaceMetadataEntity(id = 1, activeSystemId = SystemId.WOD.name, updatedAtMillis = 7000L),
            prefsWorkspace = prefsWs,
            prefsUpdatedAt = 7500L,
            nowMillis = 9000L,
            json = json
        )

        // Room WOD (8000) > Prefs (7500), while Prefs DND5E was missing in Room -> both merged
        assertEquals("NEWER ROOM WOD", result.workspace.sheetsBySystem[SystemId.WOD]?.characterName)
        assertEquals("NEWER PREFS DND", result.workspace.sheetsBySystem[SystemId.DND5E]?.characterName)
        assertEquals(1, result.entitiesToUpsertIntoRoom.size)
        assertEquals(SystemId.DND5E.name, result.entitiesToUpsertIntoRoom.first().systemId)
        assertTrue(result.shouldUpdatePrefs)
    }

    @Test
    fun mirrorsNewerWebWorkspaceIntoRoomEntities() {
        val localWod = Presets.createWorldOfDarknessSheet()
        val localEntity = WorkspaceSyncEngine.toEntity(SystemId.WOD, localWod, 4000L, json)
        val localMeta = WorkspaceMetadataEntity(id = 1, activeSystemId = SystemId.WOD.name, updatedAtMillis = 4000L)

        val remoteDnd = Presets.createDnd5ePreset().copy(characterName = "MIRRORED FROM APP.TSX")
        val remoteWs = WorkspaceState(
            activeSystemId = SystemId.DND5E,
            sheetsBySystem = mapOf(
                SystemId.WOD to localWod,
                SystemId.DND5E to remoteDnd
            )
        )

        val result = WorkspaceSyncEngine.reconcileWithRemoteMirror(
            roomSheets = listOf(localEntity),
            roomMeta = localMeta,
            remoteWorkspace = remoteWs,
            remoteUpdatedAt = 9500L,
            nowMillis = 10000L,
            json = json
        )

        assertTrue(result.adoptedRemoteMirror)
        assertFalse(result.shouldPushLocalToRemote)
        assertEquals(SystemId.DND5E, result.workspace.activeSystemId)
        assertEquals(2, result.entitiesToMirrorIntoRoom.size)
        assertTrue(result.entitiesToMirrorIntoRoom.all { it.syncState == "MIRRORED" })
        assertEquals("DND5E", result.metadataToMirrorIntoRoom.activeSystemId)
    }

    @Test
    fun preservesNewerOfflineRoomEditsOverOlderWebMirror() {
        val offlineRoomWod = Presets.createWorldOfDarknessSheet().copy(characterName = "OFFLINE ROOM EDIT")
        val localEntity = WorkspaceSyncEngine.toEntity(SystemId.WOD, offlineRoomWod, 12000L, json)
        val localMeta = WorkspaceMetadataEntity(id = 1, activeSystemId = SystemId.WOD.name, updatedAtMillis = 12000L)

        val olderWebWod = Presets.createWorldOfDarknessSheet().copy(characterName = "STALE WEB")
        val remoteWs = WorkspaceState(
            activeSystemId = SystemId.WOD,
            sheetsBySystem = mapOf(SystemId.WOD to olderWebWod)
        )

        val result = WorkspaceSyncEngine.reconcileWithRemoteMirror(
            roomSheets = listOf(localEntity),
            roomMeta = localMeta,
            remoteWorkspace = remoteWs,
            remoteUpdatedAt = 8000L,
            nowMillis = 13000L,
            json = json
        )

        assertFalse(result.adoptedRemoteMirror)
        assertTrue(result.shouldPushLocalToRemote)
        assertEquals("OFFLINE ROOM EDIT", result.workspace.sheetsBySystem[SystemId.WOD]?.characterName)
    }

    @Test
    fun tracksBaseRevisionSeparateFromDirtyLocalEditsAndHandles201And200And409Conflict() {
        val initialSheet = Presets.createWorldOfDarknessSheet("android-device-uuid-1")
        assertEquals(1, initialSheet.revision)
        assertEquals("android-device-uuid-1", initialSheet.deviceId)
        assertTrue(initialSheet.updatedAt.endsWith("Z"))

        // 1. Create initial entity (201 Created) and verify Authorization: Bearer <token> header
        val syncHeaders = WorkspaceSyncEngine.buildSyncHeaders(
            syncToken = "secret-sync-token-123",
            baseRevision = 1,
            isCreate = true
        )
        assertEquals("Bearer secret-sync-token-123", syncHeaders["Authorization"])
        assertEquals("*", syncHeaders["If-None-Match"])

        val res201 = WorkspaceSyncEngine.handlePushResponse(
            localSheet = initialSheet,
            baseRevision = 1,
            statusCode = 201,
            responseBody = """{"ok":true}""",
            etagHeader = "\"1\"",
            json = json
        )
        assertTrue(res201.ok)
        assertEquals(201, res201.statusCode)
        assertEquals(1, res201.baseRevision)
        assertFalse(res201.isDirty)

        // 2. Local edit marks isDirty = true while keeping baseRevision = 1
        val locallyEditedSheet = SheetMutators.updateFieldValue(
            initialSheet.copy(characterName = "LOCAL ANDROID EDIT"),
            "f_strength",
            com.gridsheet.app.core.FieldValue.NumberValue(4.0),
            deviceId = "android-device-uuid-1"
        )
        assertEquals(1, locallyEditedSheet.revision)
        val dirtyEntity = WorkspaceSyncEngine.markLocalEdit(
            sheet = locallyEditedSheet,
            baseRevision = res201.baseRevision,
            deviceId = "android-device-uuid-1",
            nowMillis = 2000L,
            json = json
        )
        assertEquals(1, dirtyEntity.baseRevision)
        assertTrue(dirtyEntity.isDirty)
        assertEquals("\"1\"", WorkspaceSyncEngine.buildIfMatchHeader(dirtyEntity.baseRevision))

        // 3. Valid update (200 OK) advances baseRevision and revision to 2 and clears isDirty
        val res200 = WorkspaceSyncEngine.handlePushResponse(
            localSheet = locallyEditedSheet,
            baseRevision = dirtyEntity.baseRevision,
            statusCode = 200,
            responseBody = """{"ok":true}""",
            etagHeader = "\"2\"",
            json = json
        )
        assertTrue(res200.ok)
        assertEquals(200, res200.statusCode)
        assertEquals(2, res200.sheet.revision)
        assertEquals(2, res200.baseRevision)
        assertFalse(res200.isDirty)

        // 4. Schema failure (400 Bad Request) returns error without losing dirty state
        val secondDirtySheet = locallyEditedSheet.copy(characterName = "SECOND EDIT", revision = 2)
        val res400 = WorkspaceSyncEngine.handlePushResponse(
            localSheet = secondDirtySheet,
            baseRevision = 2,
            statusCode = 400,
            responseBody = """{"ok":false,"error":"SCHEMA_VALIDATION_FAILED"}""",
            etagHeader = null,
            json = json
        )
        assertFalse(res400.ok)
        assertEquals(400, res400.statusCode)
        assertTrue(res400.isDirty)

        // 5. Revision conflict (409 Conflict) exposes serverSheet vs localSheet without silent overwrite
        val conflictBody = """
            {
              "ok": false,
              "error": "REVISION_CONFLICT",
              "serverSheet": {
                "id": "wod-default-sheet",
                "name": "SERVER VERSION REV 3",
                "systemId": "wod",
                "revision": 3,
                "updatedAt": "2026-11-14T16:00:00.000Z",
                "deviceId": "web-device-99",
                "tabs": []
              }
            }
        """.trimIndent()
        val res409 = WorkspaceSyncEngine.handlePushResponse(
            localSheet = secondDirtySheet,
            baseRevision = 2,
            statusCode = 409,
            responseBody = conflictBody,
            etagHeader = "\"3\"",
            json = json
        )
        assertFalse(res409.ok)
        assertEquals(409, res409.statusCode)
        assertNotNull(res409.conflict)
        assertEquals(2, res409.conflict?.baseRevision)
        assertEquals(3, res409.conflict?.serverSheet?.revision)
        assertEquals("SERVER VERSION REV 3", res409.conflict?.serverSheet?.characterName)
        assertEquals("SECOND EDIT", res409.conflict?.localSheet?.characterName)
        assertTrue(res409.isDirty)

        // Resolve conflict keeping local rebases revision to 3 while remaining dirty for retry
        val (resolvedSheet, resolvedDirty) = WorkspaceSyncEngine.resolveConflict(
            conflict = res409.conflict!!,
            acceptServer = false
        )
        assertEquals(3, resolvedSheet.revision)
        assertTrue(resolvedDirty)
        assertNull(res200.conflict)
    }
}
