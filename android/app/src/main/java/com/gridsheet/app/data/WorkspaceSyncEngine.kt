package com.gridsheet.app.data

import com.gridsheet.app.core.CanonicalSheet
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.SheetEntity
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import kotlin.math.max

data class ReconciledSyncResult(
    val workspace: WorkspaceState,
    val entitiesToUpsertIntoRoom: List<SheetEntity>,
    val metadataToUpsertIntoRoom: WorkspaceMetadataEntity,
    val shouldUpdatePrefs: Boolean,
    val resolvedTimestamp: Long
)

data class SyncConflict(
    val error: String = "REVISION_CONFLICT",
    val systemId: SystemId,
    val baseRevision: Int,
    val localSheet: CharacterSheetState,
    val serverSheet: CharacterSheetState
)

@Serializable
data class RevisionConflictEnvelope(
    val error: String = "REVISION_CONFLICT",
    val serverSheet: CharacterSheetState? = null
)

data class OptimisticPushOutcome(
    val ok: Boolean,
    val statusCode: Int,
    val baseRevision: Int,
    val isDirty: Boolean,
    val etag: String? = null,
    val sheet: CharacterSheetState,
    val conflict: SyncConflict? = null,
    val error: String? = null
)

object WorkspaceSyncEngine {
    fun parseSystemId(raw: String): SystemId? =
        SystemId.entries.firstOrNull { it.name.equals(raw, ignoreCase = true) }

    fun buildIfMatchHeader(baseRevision: Int): String =
        "\"${max(1, baseRevision)}\""

    fun buildIfNoneMatchHeader(): String = "*"

    fun parseETagRevision(etag: String?): Int? {
        if (etag.isNullOrBlank()) return null
        val cleaned = etag.trim()
            .removePrefix("W/")
            .trim()
            .removeSurrounding("\"")
            .trim()
        val parsed = cleaned.toIntOrNull() ?: return null
        return parsed.takeIf { it >= 1 }
    }

    fun markLocalEdit(
        sheet: CharacterSheetState,
        baseRevision: Int = max(1, sheet.revision),
        deviceId: String = sheet.deviceId.ifBlank { "local-device" },
        nowIso: String = Instant.now().toString(),
        nowMillis: Long = System.currentTimeMillis(),
        json: Json
    ): SheetEntity {
        val sysId = sheet.systemId ?: Presets.detectSystemId(sheet)
        val normalizedBase = max(1, baseRevision)
        // Local modifications update updatedAt and deviceId, but keep revision = baseRevision
        val dirtySheet = sheet.copy(
            id = sheet.id.ifBlank { "sheet_${sysId.name.lowercase()}" },
            systemId = sysId,
            revision = normalizedBase,
            updatedAt = nowIso,
            deviceId = deviceId
        )
        return toEntity(
            systemId = sysId,
            sheet = dirtySheet,
            updatedAtMillis = nowMillis,
            json = json,
            syncState = "PENDING_SYNC",
            baseRevision = normalizedBase,
            isDirty = true
        )
    }

    fun handlePushResponse(
        localSheet: CharacterSheetState,
        baseRevision: Int,
        statusCode: Int,
        responseBody: String?,
        etagHeader: String?,
        json: Json
    ): OptimisticPushOutcome {
        val sysId = localSheet.systemId ?: Presets.detectSystemId(localSheet)
        val effectiveBase = max(1, baseRevision)

        if (statusCode == 200 || statusCode == 201) {
            val revFromEtag = parseETagRevision(etagHeader)
            val revFromBody = runCatching {
                if (responseBody.isNullOrBlank()) null
                else {
                    val root = json.parseToJsonElement(responseBody).jsonObject
                    root["revision"]?.jsonPrimitive?.intOrNull
                        ?: root["sheet"]?.jsonObject?.get("revision")?.jsonPrimitive?.intOrNull
                }
            }.getOrNull()

            val nextRevision = revFromEtag
                ?: revFromBody
                ?: if (statusCode == 201) 1 else (effectiveBase + 1)

            val confirmedSheet = localSheet.copy(
                systemId = sysId,
                revision = max(1, nextRevision)
            )
            return OptimisticPushOutcome(
                ok = true,
                statusCode = statusCode,
                baseRevision = confirmedSheet.revision,
                isDirty = false,
                etag = etagHeader ?: buildIfMatchHeader(confirmedSheet.revision),
                sheet = confirmedSheet,
                conflict = null
            )
        }

        if (statusCode == 409) {
            val parsedServerSheet = parseConflictServerSheet(responseBody, localSheet, effectiveBase, json)
            val conflict = SyncConflict(
                error = "REVISION_CONFLICT",
                systemId = sysId,
                baseRevision = effectiveBase,
                localSheet = localSheet,
                serverSheet = parsedServerSheet
            )
            // Never silently overwrite localSheet on 409 Conflict; keep isDirty = true
            return OptimisticPushOutcome(
                ok = false,
                statusCode = 409,
                baseRevision = effectiveBase,
                isDirty = true,
                etag = etagHeader,
                sheet = localSheet,
                conflict = conflict,
                error = "REVISION_CONFLICT"
            )
        }

        val errCode = runCatching {
            if (responseBody.isNullOrBlank()) null
            else json.parseToJsonElement(responseBody).jsonObject["error"]?.jsonPrimitive?.content
        }.getOrNull() ?: "HTTP_$statusCode"

        return OptimisticPushOutcome(
            ok = false,
            statusCode = statusCode,
            baseRevision = effectiveBase,
            isDirty = true,
            etag = etagHeader,
            sheet = localSheet,
            conflict = null,
            error = errCode
        )
    }

    fun resolveConflict(
        conflict: SyncConflict,
        acceptServer: Boolean,
        deviceId: String = conflict.localSheet.deviceId,
        nowIso: String = Instant.now().toString()
    ): Pair<CharacterSheetState, Boolean> {
        val serverRev = max(1, conflict.serverSheet.revision)
        return if (acceptServer) {
            conflict.serverSheet.copy(revision = serverRev) to false
        } else {
            conflict.localSheet.copy(
                revision = serverRev,
                updatedAt = nowIso,
                deviceId = deviceId.ifBlank { "local-device" }
            ) to true
        }
    }

    private fun parseConflictServerSheet(
        responseBody: String?,
        fallbackLocal: CharacterSheetState,
        baseRevision: Int,
        json: Json
    ): CharacterSheetState {
        if (responseBody.isNullOrBlank()) {
            return fallbackLocal.copy(revision = baseRevision + 1)
        }
        return runCatching {
            val root: JsonObject = json.parseToJsonElement(responseBody).jsonObject
            val serverSheetElem = root["serverSheet"] ?: return@runCatching fallbackLocal.copy(revision = baseRevision + 1)
            val serverObj = serverSheetElem.jsonObject
            if (serverObj.containsKey("cards")) {
                json.decodeFromJsonElement(CharacterSheetState.serializer(), serverSheetElem)
            } else {
                val canonical = json.decodeFromJsonElement(CanonicalSheet.serializer(), serverSheetElem)
                val sysId = parseSystemId(canonical.systemId) ?: fallbackLocal.systemId ?: SystemId.WOD
                fallbackLocal.copy(
                    id = canonical.id,
                    systemId = sysId,
                    characterName = canonical.name,
                    revision = max(1, canonical.revision),
                    updatedAt = canonical.updatedAt,
                    deviceId = canonical.deviceId
                )
            }
        }.getOrDefault(fallbackLocal.copy(revision = baseRevision + 1))
    }

    fun toEntity(
        systemId: SystemId,
        sheet: CharacterSheetState,
        updatedAtMillis: Long,
        json: Json,
        syncState: String = "SYNCED",
        baseRevision: Int = max(1, sheet.revision),
        isDirty: Boolean = syncState == "PENDING_SYNC"
    ): SheetEntity {
        val migrated = Presets.migrateSheetMetadata(
            sheet = sheet.copy(systemId = systemId),
            deviceId = sheet.deviceId.ifBlank { "local-device" }
        )
        return SheetEntity(
            systemId = systemId.name,
            systemName = migrated.systemName,
            characterName = migrated.characterName,
            sheetJson = json.encodeToString(CharacterSheetState.serializer(), migrated),
            revision = migrated.revision,
            updatedAt = migrated.updatedAt,
            deviceId = migrated.deviceId,
            baseRevision = max(1, baseRevision),
            isDirty = isDirty,
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
        json: Json,
        deviceId: String = "local-device"
    ): ReconciledSyncResult {
        val roomMap = mutableMapOf<SystemId, Pair<CharacterSheetState, Long>>()
        for (entity in roomSheets) {
            val sysId = parseSystemId(entity.systemId) ?: continue
            val decoded = runCatching {
                json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
            }.getOrNull() ?: continue
            val migrated = Presets.migrateSheetMetadata(
                sheet = decoded.copy(
                    systemId = sysId,
                    revision = max(1, if (decoded.revision >= 1) decoded.revision else entity.revision),
                    updatedAt = decoded.updatedAt.ifBlank { entity.updatedAt },
                    deviceId = decoded.deviceId.ifBlank { entity.deviceId.ifBlank { deviceId } }
                ),
                deviceId = deviceId
            )
            roomMap[sysId] = migrated to entity.updatedAtMillis
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
                val normalized = Presets.migrateSheetMetadata(
                    sheet = prefsSheet.copy(systemId = sysId),
                    deviceId = deviceId
                )
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
            val initialWod = Presets.createWorldOfDarknessSheet(deviceId)
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
        val resolvedTimestamp: Long,
        val conflicts: List<SyncConflict> = emptyList()
    )

    fun reconcileWithRemoteMirror(
        roomSheets: List<SheetEntity>,
        roomMeta: WorkspaceMetadataEntity?,
        remoteWorkspace: WorkspaceState?,
        remoteUpdatedAt: Long,
        nowMillis: Long,
        json: Json
    ): RemoteReconcileResult {
        val roomMap = mutableMapOf<SystemId, Triple<CharacterSheetState, Long, SheetEntity>>()
        for (entity in roomSheets) {
            val sysId = parseSystemId(entity.systemId) ?: continue
            val decoded = runCatching {
                json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
            }.getOrNull() ?: continue
            val migrated = Presets.migrateSheetMetadata(decoded.copy(systemId = sysId))
            roomMap[sysId] = Triple(migrated, entity.updatedAtMillis, entity)
        }

        val localLatestMillis = maxOf(
            roomMeta?.updatedAtMillis ?: 0L,
            roomMap.values.maxOfOrNull { it.second } ?: 0L
        )

        // Detect optimistic concurrency conflicts when local has dirty edits and remote diverged
        val detectedConflicts = mutableListOf<SyncConflict>()
        if (remoteWorkspace != null) {
            for ((sysId, remoteSheet) in remoteWorkspace.sheetsBySystem) {
                val localTriple = roomMap[sysId] ?: continue
                val localEntity = localTriple.third
                if (localEntity.isDirty && remoteSheet.revision != localEntity.baseRevision) {
                    detectedConflicts.add(
                        SyncConflict(
                            error = "REVISION_CONFLICT",
                            systemId = sysId,
                            baseRevision = localEntity.baseRevision,
                            localSheet = localTriple.first,
                            serverSheet = remoteSheet.copy(systemId = sysId)
                        )
                    )
                }
            }
        }

        if (detectedConflicts.isNotEmpty()) {
            val fallbackActive = roomMeta?.let { parseSystemId(it.activeSystemId) }
                ?.takeIf { roomMap.containsKey(it) }
                ?: roomMap.keys.firstOrNull() ?: SystemId.WOD
            val localSheetsMap = roomMap.mapValues { it.value.first }
            val resolvedTs = if (localLatestMillis > 0L) localLatestMillis else nowMillis
            val localWs = WorkspaceState(
                activeSystemId = fallbackActive,
                sheetsBySystem = localSheetsMap
            )
            val conflictEntities = roomMap.map { (sysId, triple) ->
                toEntity(
                    systemId = sysId,
                    sheet = triple.first,
                    updatedAtMillis = triple.second,
                    json = json,
                    syncState = if (triple.third.isDirty) "PENDING_SYNC" else triple.third.syncState,
                    baseRevision = triple.third.baseRevision,
                    isDirty = triple.third.isDirty
                )
            }
            val localMeta = WorkspaceMetadataEntity(
                id = 1,
                activeSystemId = localWs.activeSystemId.name,
                updatedAtMillis = resolvedTs
            )
            return RemoteReconcileResult(
                workspace = localWs,
                entitiesToMirrorIntoRoom = conflictEntities,
                metadataToMirrorIntoRoom = localMeta,
                adoptedRemoteMirror = false,
                shouldPushLocalToRemote = false,
                resolvedTimestamp = resolvedTs,
                conflicts = detectedConflicts
            )
        }

        if (remoteWorkspace != null && remoteWorkspace.sheetsBySystem.isNotEmpty() && remoteUpdatedAt > localLatestMillis) {
            val mirroredEntities = remoteWorkspace.sheetsBySystem.map { (sysId, sheet) ->
                val normalized = Presets.migrateSheetMetadata(sheet.copy(systemId = sysId))
                toEntity(
                    systemId = sysId,
                    sheet = normalized,
                    updatedAtMillis = remoteUpdatedAt,
                    json = json,
                    syncState = "MIRRORED",
                    baseRevision = normalized.revision,
                    isDirty = false
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
                resolvedTimestamp = remoteUpdatedAt,
                conflicts = emptyList()
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
            val prevEntity = roomMap[sysId]?.third
            toEntity(
                systemId = sysId,
                sheet = sheet.copy(systemId = sysId),
                updatedAtMillis = resolvedTs,
                json = json,
                syncState = prevEntity?.syncState ?: "SYNCED",
                baseRevision = prevEntity?.baseRevision ?: max(1, sheet.revision),
                isDirty = prevEntity?.isDirty ?: false
            )
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
            resolvedTimestamp = resolvedTs,
            conflicts = emptyList()
        )
    }
}
