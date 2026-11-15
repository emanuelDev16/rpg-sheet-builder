package com.gridsheet.app.data

import android.content.Context
import com.gridsheet.app.BuildConfig
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.GridSheetDatabase
import com.gridsheet.app.data.local.SavedSheetEntity
import com.gridsheet.app.data.local.SheetEntity
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

@Serializable
data class RemoteWorkspaceMirrorDto(
    val workspace: WorkspaceState,
    val updatedAtMillis: Long,
    val digest: String = "",
    val source: String = "web"
)

@Serializable
private data class RemoteWorkspaceGetEnvelope(
    val ok: Boolean = false,
    val mirror: RemoteWorkspaceMirrorDto? = null
)

@Serializable
private data class RemoteWorkspacePutRequest(
    val workspace: WorkspaceState,
    val updatedAtMillis: Long,
    val source: String = "android"
)

data class RoomMirrorSyncOutcome(
    val workspace: WorkspaceState,
    val updatedAtMillis: Long,
    val updatedFromRemote: Boolean,
    val conflicts: Map<SystemId, SyncConflict> = emptyMap()
)

/**
 * Dedicated Room database repository managing local offline character sheets,
 * transactional workspace mirroring, and bidirectional synchronization with the
 * web App.tsx mirror endpoint (/api/workspace-sync).
 */
class RoomWorkspaceRepository(context: Context) {
    private val db = GridSheetDatabase.getInstance(context)
    private val sheetDao = db.sheetDao()

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        encodeDefaults = true
        prettyPrint = false
    }

    fun observeAllSheets(): Flow<List<SheetEntity>> = sheetDao.observeAllSheets()

    fun observeAllSavedSheets(): Flow<List<SavedSheetEntity>> = sheetDao.observeAllSavedSheets()

    fun observeOfflineSheetCount(): Flow<Int> = sheetDao.observeAllSavedSheets().map { it.size }

    suspend fun getAllSheetEntities(): List<SheetEntity> = withContext(Dispatchers.IO) {
        sheetDao.getAllSheets()
    }

    suspend fun getAllSavedSheetEntities(): List<SavedSheetEntity> = withContext(Dispatchers.IO) {
        sheetDao.getAllSavedSheets()
    }

    suspend fun getSavedSheetEntity(sheetId: String): SavedSheetEntity? = withContext(Dispatchers.IO) {
        sheetDao.getSavedSheetById(sheetId)
    }

    suspend fun upsertSavedSheetEntity(entity: SavedSheetEntity) = withContext(Dispatchers.IO) {
        sheetDao.upsertSavedSheet(entity)
    }

    suspend fun upsertSavedSheetEntities(entities: List<SavedSheetEntity>) = withContext(Dispatchers.IO) {
        if (entities.isNotEmpty()) {
            sheetDao.upsertSavedSheets(entities)
        }
    }

    suspend fun deleteSavedSheetEntity(sheetId: String) = withContext(Dispatchers.IO) {
        sheetDao.deleteSavedSheetById(sheetId)
    }

    suspend fun deleteWorkspaceSheetBySystem(systemId: SystemId) = withContext(Dispatchers.IO) {
        sheetDao.deleteSheetBySystem(systemId.name)
    }

    suspend fun deleteAllWorkspaceSheets(
        activeSystemId: SystemId,
        updatedAtMillis: Long
    ) = withContext(Dispatchers.IO) {
        sheetDao.deleteAllSheets()
        sheetDao.upsertMetadata(
            WorkspaceMetadataEntity(
                id = 1,
                activeSystemId = activeSystemId.name,
                updatedAtMillis = updatedAtMillis
            )
        )
    }

    suspend fun getMetadata(): WorkspaceMetadataEntity? = withContext(Dispatchers.IO) {
        sheetDao.getMetadata()
    }

    suspend fun loadWorkspaceFromRoom(): Pair<WorkspaceState?, Long> = withContext(Dispatchers.IO) {
        val entities = sheetDao.getAllSheets()
        if (entities.isEmpty()) return@withContext null to 0L
        val meta = sheetDao.getMetadata()
        val sheetsMap = mutableMapOf<SystemId, CharacterSheetState>()
        var maxTs = meta?.updatedAtMillis ?: 0L

        for (entity in entities) {
            val sysId = WorkspaceSyncEngine.parseSystemId(entity.systemId) ?: continue
            val decoded = runCatching {
                json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
            }.getOrNull() ?: continue
            sheetsMap[sysId] = decoded.copy(systemId = sysId)
            if (entity.updatedAtMillis > maxTs) maxTs = entity.updatedAtMillis
        }

        if (sheetsMap.isEmpty()) return@withContext null to 0L

        val activeId = meta?.let { WorkspaceSyncEngine.parseSystemId(it.activeSystemId) }
            ?.takeIf { sheetsMap.containsKey(it) }
            ?: sheetsMap.keys.first()

        WorkspaceState(
            activeSystemId = activeId,
            sheetsBySystem = sheetsMap.toMap()
        ) to maxTs
    }

    suspend fun mirrorWorkspaceIntoRoom(
        workspace: WorkspaceState,
        updatedAtMillis: Long = System.currentTimeMillis(),
        syncState: String = "MIRRORED",
        isDirty: Boolean = false
    ) = withContext(Dispatchers.IO) {
        val existingBySystem = sheetDao.getAllSheets().associateBy { it.systemId }
        val entities = workspace.sheetsBySystem.map { (sysId, sheet) ->
            val prev = existingBySystem[sysId.name]
            val baseRev = prev?.baseRevision ?: sheet.revision.coerceAtLeast(1)
            WorkspaceSyncEngine.toEntity(
                systemId = sysId,
                sheet = sheet.copy(systemId = sysId),
                updatedAtMillis = updatedAtMillis,
                json = json,
                syncState = syncState,
                baseRevision = baseRev,
                isDirty = isDirty
            )
        }
        val metadata = WorkspaceMetadataEntity(
            id = 1,
            activeSystemId = workspace.activeSystemId.name,
            updatedAtMillis = updatedAtMillis
        )
        sheetDao.mirrorWorkspaceTransaction(entities, metadata)
    }

    suspend fun upsertReconciledEntities(
        entities: List<SheetEntity>,
        metadata: WorkspaceMetadataEntity
    ) = withContext(Dispatchers.IO) {
        if (entities.isNotEmpty()) {
            sheetDao.upsertSheets(entities)
        }
        sheetDao.upsertMetadata(metadata)
    }

    suspend fun pullRemoteMirror(
        baseUrl: String = BuildConfig.RULES_API_BASE_URL,
        syncToken: String = BuildConfig.SYNC_TOKEN
    ): RemoteWorkspaceMirrorDto? = withContext(Dispatchers.IO) {
        val cleanBase = baseUrl.trimEnd('/')
        if (cleanBase.isEmpty()) return@withContext null

        var conn: HttpURLConnection? = null
        try {
            val url = URL("$cleanBase/api/sync")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 10000
                WorkspaceSyncEngine.applySyncHeaders(
                    connection = this,
                    syncToken = syncToken
                )
            }
            if (conn.responseCode !in 200..299) return@withContext null
            val body = BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { it.readText() }
            val envelope = json.decodeFromString(RemoteWorkspaceGetEnvelope.serializer(), body)
            if (envelope.ok) envelope.mirror else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun pushRemoteMirror(
        workspace: WorkspaceState,
        updatedAtMillis: Long,
        baseUrl: String = BuildConfig.RULES_API_BASE_URL,
        syncToken: String = BuildConfig.SYNC_TOKEN
    ): Boolean = withContext(Dispatchers.IO) {
        val cleanBase = baseUrl.trimEnd('/')
        if (cleanBase.isEmpty()) return@withContext false

        val existingEntities = sheetDao.getAllSheets().associateBy { it.systemId }
        val activeEntity = existingEntities[workspace.activeSystemId.name]
        val activeSheet = workspace.sheetsBySystem[workspace.activeSystemId]
        val baseRevision = (activeEntity?.baseRevision ?: activeSheet?.revision ?: 1).coerceAtLeast(1)

        var conn: HttpURLConnection? = null
        try {
            val url = URL("$cleanBase/api/sync")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "PUT"
                connectTimeout = 8000
                readTimeout = 10000
                doOutput = true
                WorkspaceSyncEngine.applySyncHeaders(
                    connection = this,
                    syncToken = syncToken,
                    baseRevision = baseRevision
                )
            }
            val payload = json.encodeToString(
                RemoteWorkspacePutRequest.serializer(),
                RemoteWorkspacePutRequest(
                    workspace = workspace,
                    updatedAtMillis = updatedAtMillis,
                    source = "android"
                )
            )
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(payload)
                writer.flush()
            }
            val statusCode = conn.responseCode
            val stream = if (statusCode in 200..299) conn.inputStream else conn.errorStream
            val responseBody = stream?.let { BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { r -> r.readText() } }
            val etagHeader = conn.getHeaderField("ETag")

            if (activeEntity != null && activeSheet != null) {
                val pushOutcome = WorkspaceSyncEngine.handlePushResponse(
                    localSheet = activeSheet,
                    baseRevision = baseRevision,
                    statusCode = statusCode,
                    responseBody = responseBody,
                    etagHeader = etagHeader,
                    json = json
                )
                val updatedEntity = WorkspaceSyncEngine.toEntity(
                    systemId = workspace.activeSystemId,
                    sheet = pushOutcome.sheet,
                    updatedAtMillis = System.currentTimeMillis(),
                    json = json,
                    syncState = if (pushOutcome.ok) "SYNCED" else if (pushOutcome.statusCode == 409) "CONFLICT" else "ERROR",
                    baseRevision = pushOutcome.baseRevision,
                    isDirty = pushOutcome.isDirty
                )
                sheetDao.upsertSheets(listOf(updatedEntity))
            }
            statusCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun syncWithRemoteMirror(
        baseUrl: String = BuildConfig.RULES_API_BASE_URL,
        syncToken: String = BuildConfig.SYNC_TOKEN
    ): RoomMirrorSyncOutcome? = withContext(Dispatchers.IO) {
        val remote = pullRemoteMirror(baseUrl, syncToken)
        val roomSheets = sheetDao.getAllSheets()
        val roomMeta = sheetDao.getMetadata()
        val now = System.currentTimeMillis()

        val reconciled = WorkspaceSyncEngine.reconcileWithRemoteMirror(
            roomSheets = roomSheets,
            roomMeta = roomMeta,
            remoteWorkspace = remote?.workspace,
            remoteUpdatedAt = remote?.updatedAtMillis ?: 0L,
            nowMillis = now,
            json = json
        )

        val conflictsMap = reconciled.conflicts.associateBy { it.systemId }

        if (reconciled.adoptedRemoteMirror) {
            sheetDao.mirrorWorkspaceTransaction(
                reconciled.entitiesToMirrorIntoRoom,
                reconciled.metadataToMirrorIntoRoom
            )
            return@withContext RoomMirrorSyncOutcome(
                workspace = reconciled.workspace,
                updatedAtMillis = reconciled.resolvedTimestamp,
                updatedFromRemote = true,
                conflicts = conflictsMap
            )
        }

        if (conflictsMap.isNotEmpty()) {
            return@withContext RoomMirrorSyncOutcome(
                workspace = reconciled.workspace,
                updatedAtMillis = reconciled.resolvedTimestamp,
                updatedFromRemote = false,
                conflicts = conflictsMap
            )
        }

        if (reconciled.shouldPushLocalToRemote) {
            pushRemoteMirror(
                workspace = reconciled.workspace,
                updatedAtMillis = reconciled.resolvedTimestamp,
                baseUrl = baseUrl,
                syncToken = syncToken
            )
        }

        null
    }
}
