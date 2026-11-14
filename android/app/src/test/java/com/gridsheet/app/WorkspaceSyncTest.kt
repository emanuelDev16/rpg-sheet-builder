package com.gridsheet.app

import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.WorkspaceSyncEngine
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
}
