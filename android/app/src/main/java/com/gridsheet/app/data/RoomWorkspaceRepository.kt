package com.gridsheet.app.data

import android.content.Context
import com.gridsheet.app.BuildConfig
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.GridSheetDatabase
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
    val updatedFromRemote: Boolean
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
        encodeDefaults = true
        prettyPrint = false
    }

    fun observeAllSheets(): Flow<List<SheetEntity>> = sheetDao.observeAllSheets()

    fun observeOfflineSheetCount(): Flow<Int> = sheetDao.observeAllSheets().map { it.size }

    suspend fun getAllSheetEntities(): List<SheetEntity> = withContext(Dispatchers.IO) {
        sheetDao.getAllSheets()
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
        syncState: String = "MIRRORED"
    ) = withContext(Dispatchers.IO) {
        val entities = workspace.sheetsBySystem.map { (sysId, sheet) ->
            WorkspaceSyncEngine.toEntity(
                systemId = sysId,
                sheet = sheet.copy(systemId = sysId),
                updatedAtMillis = updatedAtMillis,
                json = json,
                syncState = syncState
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
        baseUrl: String = BuildConfig.RULES_API_BASE_URL
    ): RemoteWorkspaceMirrorDto? = withContext(Dispatchers.IO) {
        val cleanBase = baseUrl.trimEnd('/')
        if (cleanBase.isEmpty()) return@withContext null

        var conn: HttpURLConnection? = null
        try {
            val url = URL("$cleanBase/api/workspace-sync")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 10000
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
        baseUrl: String = BuildConfig.RULES_API_BASE_URL
    ): Boolean = withContext(Dispatchers.IO) {
        val cleanBase = baseUrl.trimEnd('/')
        if (cleanBase.isEmpty()) return@withContext false

        var conn: HttpURLConnection? = null
        try {
            val url = URL("$cleanBase/api/workspace-sync")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "PUT"
                connectTimeout = 8000
                readTimeout = 10000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
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
            conn.responseCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun syncWithRemoteMirror(
        baseUrl: String = BuildConfig.RULES_API_BASE_URL
    ): RoomMirrorSyncOutcome? = withContext(Dispatchers.IO) {
        val remote = pullRemoteMirror(baseUrl)
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

        if (reconciled.adoptedRemoteMirror) {
            sheetDao.mirrorWorkspaceTransaction(
                reconciled.entitiesToMirrorIntoRoom,
                reconciled.metadataToMirrorIntoRoom
            )
            return@withContext RoomMirrorSyncOutcome(
                workspace = reconciled.workspace,
                updatedAtMillis = reconciled.resolvedTimestamp,
                updatedFromRemote = true
            )
        }

        if (reconciled.shouldPushLocalToRemote) {
            pushRemoteMirror(
                workspace = reconciled.workspace,
                updatedAtMillis = reconciled.resolvedTimestamp,
                baseUrl = baseUrl
            )
        }

        null
    }
}
