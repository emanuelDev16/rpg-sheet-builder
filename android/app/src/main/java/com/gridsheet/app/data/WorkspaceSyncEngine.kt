package com.gridsheet.app.data

import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.SheetEntity
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import kotlinx.serialization.json.Json

data class ReconciledSyncResult(
    val workspace: WorkspaceState,
    val entitiesToUpsertIntoRoom: List<SheetEntity>,
    val metadataToUpsertIntoRoom: WorkspaceMetadataEntity,
    val shouldUpdatePrefs: Boolean,
    val resolvedTimestamp: Long
)

object WorkspaceSyncEngine {
    fun parseSystemId(raw: String): SystemId? =
        SystemId.entries.firstOrNull { it.name.equals(raw, ignoreCase = true) }

    fun toEntity(
        systemId: SystemId,
        sheet: CharacterSheetState,
        updatedAtMillis: Long,
        json: Json,
        syncState: String = "SYNCED"
    ): SheetEntity {
        return SheetEntity(
            systemId = systemId.name,
            systemName = sheet.systemName,
            characterName = sheet.characterName,
            sheetJson = json.encodeToString(CharacterSheetState.serializer(), sheet),
            updatedAtMillis = updatedAtMillis,
            syncState = syncState
        )
    }

    fun reconcile(
        roomSheets: List<SheetEntity>,
        roomMeta: WorkspaceMetadataEntity?,
        prefsWorkspace: WorkspaceState?,
        prefsUpdatedAt: Long,
        nowMillis: Long,
        json: Json
    ): ReconciledSyncResult {
        val roomMap = mutableMapOf<SystemId, Pair<CharacterSheetState, Long>>()
        for (entity in roomSheets) {
            val sysId = parseSystemId(entity.systemId) ?: continue
            val decoded = runCatching {
                json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
            }.getOrNull() ?: continue
            roomMap[sysId] = decoded.copy(systemId = sysId) to entity.updatedAtMillis
        }

        val mergedMap = mutableMapOf<SystemId, CharacterSheetState>()
        val mergedTimestamps = mutableMapOf<SystemId, Long>()
        val toUpsert = mutableListOf<SheetEntity>()
        var shouldUpdatePrefs = false

        // 1. Seed merged state with everything currently in Room
        for ((sysId, pair) in roomMap) {
            mergedMap[sysId] = pair.first
            mergedTimestamps[sysId] = pair.second
        }

        // 2. Reconcile SharedPreferences workspace entries against Room
        if (prefsWorkspace != null) {
            val effectivePrefsTime = if (prefsUpdatedAt > 0L) prefsUpdatedAt else nowMillis
            for ((sysId, prefsSheet) in prefsWorkspace.sheetsBySystem) {
                val roomEntry = roomMap[sysId]
                val normalized = prefsSheet.copy(systemId = sysId)
                if (roomEntry == null || effectivePrefsTime > roomEntry.second) {
                    // SharedPreferences has newer or un-migrated sheet -> sync into Room
                    mergedMap[sysId] = normalized
                    mergedTimestamps[sysId] = effectivePrefsTime
                    toUpsert.add(toEntity(sysId, normalized, effectivePrefsTime, json))
                } else if (roomEntry.second > effectivePrefsTime) {
                    // Room has newer offline edit -> push back to SharedPreferences
                    shouldUpdatePrefs = true
                }
            }
        }

        // 3. Any Room sheet absent from SharedPreferences must update SharedPreferences
        if (prefsWorkspace == null && roomMap.isNotEmpty()) {
            shouldUpdatePrefs = true
        } else if (prefsWorkspace != null) {
            for (sysId in roomMap.keys) {
                if (!prefsWorkspace.sheetsBySystem.containsKey(sysId)) {
                    shouldUpdatePrefs = true
                    break
                }
            }
        }

        // 4. Bootstrap default WoD sheet if both Room and SharedPreferences are empty
        if (mergedMap.isEmpty()) {
            val initialWod = Presets.createWorldOfDarknessSheet()
            mergedMap[SystemId.WOD] = initialWod
            mergedTimestamps[SystemId.WOD] = nowMillis
            toUpsert.add(toEntity(SystemId.WOD, initialWod, nowMillis, json))
            shouldUpdatePrefs = true
        }

        // 5. Resolve active system ID using most recent metadata timestamp
        val roomMetaSys = roomMeta?.let { parseSystemId(it.activeSystemId) }
        val roomMetaTime = roomMeta?.updatedAtMillis ?: 0L
        val activeSystemId = when {
            roomMetaSys != null && roomMetaTime > prefsUpdatedAt -> {
                shouldUpdatePrefs = true
                roomMetaSys
            }
            prefsWorkspace != null && mergedMap.containsKey(prefsWorkspace.activeSystemId) ->
                prefsWorkspace.activeSystemId
            roomMetaSys != null && mergedMap.containsKey(roomMetaSys) -> roomMetaSys
            mergedMap.containsKey(SystemId.WOD) -> SystemId.WOD
            else -> mergedMap.keys.first()
        }

        val resolvedTimestamp = maxOf(
            nowMillis,
            roomMetaTime,
            prefsUpdatedAt,
            mergedTimestamps.values.maxOrNull() ?: 0L
        )

        val metaToUpsert = WorkspaceMetadataEntity(
            id = 1,
            activeSystemId = activeSystemId.name,
            updatedAtMillis = resolvedTimestamp
        )

        return ReconciledSyncResult(
            workspace = WorkspaceState(
                activeSystemId = activeSystemId,
                sheetsBySystem = mergedMap.toMap()
            ),
            entitiesToUpsertIntoRoom = toUpsert,
            metadataToUpsertIntoRoom = metaToUpsert,
            shouldUpdatePrefs = shouldUpdatePrefs,
            resolvedTimestamp = resolvedTimestamp
        )
    }

    data class RemoteReconcileResult(
        val workspace: WorkspaceState,
        val entitiesToMirrorIntoRoom: List<SheetEntity>,
        val metadataToMirrorIntoRoom: WorkspaceMetadataEntity,
        val adoptedRemoteMirror: Boolean,
        val shouldPushLocalToRemote: Boolean,
        val resolvedTimestamp: Long
    )

    fun reconcileWithRemoteMirror(
        roomSheets: List<SheetEntity>,
        roomMeta: WorkspaceMetadataEntity?,
        remoteWorkspace: WorkspaceState?,
        remoteUpdatedAt: Long,
        nowMillis: Long,
        json: Json
    ): RemoteReconcileResult {
        val roomMap = mutableMapOf<SystemId, Pair<CharacterSheetState, Long>>()
        for (entity in roomSheets) {
            val sysId = parseSystemId(entity.systemId) ?: continue
            val decoded = runCatching {
                json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
            }.getOrNull() ?: continue
            roomMap[sysId] = decoded.copy(systemId = sysId) to entity.updatedAtMillis
        }

        val localLatestMillis = maxOf(
            roomMeta?.updatedAtMillis ?: 0L,
            roomMap.values.maxOfOrNull { it.second } ?: 0L
        )

        if (remoteWorkspace != null && remoteWorkspace.sheetsBySystem.isNotEmpty() && remoteUpdatedAt > localLatestMillis) {
            val mirroredEntities = remoteWorkspace.sheetsBySystem.map { (sysId, sheet) ->
                toEntity(
                    systemId = sysId,
                    sheet = sheet.copy(systemId = sysId),
                    updatedAtMillis = remoteUpdatedAt,
                    json = json,
                    syncState = "MIRRORED"
                )
            }
            val mirroredMeta = WorkspaceMetadataEntity(
                id = 1,
                activeSystemId = remoteWorkspace.activeSystemId.name,
                updatedAtMillis = remoteUpdatedAt
            )
            return RemoteReconcileResult(
                workspace = remoteWorkspace,
                entitiesToMirrorIntoRoom = mirroredEntities,
                metadataToMirrorIntoRoom = mirroredMeta,
                adoptedRemoteMirror = true,
                shouldPushLocalToRemote = false,
                resolvedTimestamp = remoteUpdatedAt
            )
        }

        val fallbackActive = roomMeta?.let { parseSystemId(it.activeSystemId) }
            ?.takeIf { roomMap.containsKey(it) }
            ?: if (roomMap.containsKey(SystemId.WOD)) SystemId.WOD else roomMap.keys.firstOrNull() ?: SystemId.WOD

        val localSheetsMap = if (roomMap.isNotEmpty()) {
            roomMap.mapValues { it.value.first }
        } else {
            mapOf(SystemId.WOD to Presets.createWorldOfDarknessSheet())
        }

        val resolvedTs = if (localLatestMillis > 0L) localLatestMillis else nowMillis
        val localWs = WorkspaceState(
            activeSystemId = fallbackActive,
            sheetsBySystem = localSheetsMap
        )
        val localEntities = localWs.sheetsBySystem.map { (sysId, sheet) ->
            toEntity(sysId, sheet.copy(systemId = sysId), resolvedTs, json, "SYNCED")
        }
        val localMeta = WorkspaceMetadataEntity(
            id = 1,
            activeSystemId = localWs.activeSystemId.name,
            updatedAtMillis = resolvedTs
        )

        return RemoteReconcileResult(
            workspace = localWs,
            entitiesToMirrorIntoRoom = localEntities,
            metadataToMirrorIntoRoom = localMeta,
            adoptedRemoteMirror = false,
            shouldPushLocalToRemote = roomMap.isNotEmpty() && (remoteWorkspace == null || localLatestMillis > remoteUpdatedAt),
            resolvedTimestamp = resolvedTs
        )
    }
}
