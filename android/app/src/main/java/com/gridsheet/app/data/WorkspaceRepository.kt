package com.gridsheet.app.data

import android.content.Context
import android.net.Uri
import com.gridsheet.app.BuildConfig
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetPayloadValidator
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.GridSheetDatabase
import com.gridsheet.app.data.local.IndexedBookEntity
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
import java.util.UUID

@Serializable
data class GroundedSource(
    val title: String = "",
    val uri: String = ""
)

@Serializable
data class RulesSearchResponse(
    val ok: Boolean = false,
    val query: String = "",
    val answer: String = "",
    val sources: List<GroundedSource> = emptyList(),
    val searchQueries: List<String> = emptyList(),
    val error: String? = null
)

@Serializable
private data class RulesSearchRequest(
    val query: String,
    val systemName: String
)

class WorkspaceRepository(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("grid_sheet_prefs", Context.MODE_PRIVATE)
    private val db = GridSheetDatabase.getInstance(appContext)
    private val pdfRulesDao = db.pdfRulesDao()
    private val pdfRulesIndexer = PdfRulesIndexer(appContext, pdfRulesDao)
    val roomRepository = RoomWorkspaceRepository(appContext)

    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = true
    }

    fun getOrCreateDeviceId(): String {
        val existing = prefs.getString(DEVICE_ID_KEY, null)?.trim()
        if (!existing.isNullOrEmpty()) {
            return existing
        }
        val created = UUID.randomUUID().toString()
        prefs.edit().putString(DEVICE_ID_KEY, created).apply()
        return created
    }

    fun observeOfflineSheetCount(): Flow<Int> = roomRepository.observeOfflineSheetCount()

    fun observeIndexedBooks(systemId: SystemId): Flow<List<IndexedBookEntity>> =
        pdfRulesDao.observeBooksBySystem(systemId.name)

    fun observeAllIndexedBooks(): Flow<List<IndexedBookEntity>> =
        pdfRulesDao.observeAllBooks()

    fun indexPdfRulebook(uri: Uri, systemId: SystemId): Flow<IndexProgress> =
        pdfRulesIndexer.indexPdf(uri, systemId.name)

    suspend fun deleteIndexedBook(bookId: String) = withContext(Dispatchers.IO) {
        pdfRulesDao.deleteBookCascade(bookId)
    }

    suspend fun searchLocalPdfRules(
        query: String,
        systemId: SystemId,
        limit: Int = 15
    ): List<FtsRuleHitRow> = withContext(Dispatchers.IO) {
        pdfRulesDao.searchRulesFts5(query, systemId.name, limit)
    }

    private fun readPrefsWorkspaceRaw(): Pair<WorkspaceState?, Long> {
        val raw = prefs.getString(WORKSPACE_KEY, null)
        val updatedAt = prefs.getLong(WORKSPACE_UPDATED_AT_KEY, 0L)
        val localDeviceId = getOrCreateDeviceId()
        if (!raw.isNullOrBlank()) {
            val parsed = runCatching {
                json.decodeFromString<WorkspaceState>(raw)
            }.getOrNull()
            if (parsed != null && parsed.sheetsBySystem.isNotEmpty()) {
                val migrated = parsed.copy(
                    sheetsBySystem = parsed.sheetsBySystem.mapValues { (sysId, s) ->
                        Presets.migrateSheetMetadata(s.copy(systemId = sysId), localDeviceId)
                    }
                )
                return migrated to updatedAt
            }
        }
        return null to updatedAt
    }

    fun loadWorkspace(): WorkspaceState {
        val localDeviceId = getOrCreateDeviceId()
        val (prefsWs, _) = readPrefsWorkspaceRaw()
        if (prefsWs != null) {
            return prefsWs.copy(
                sheetsBySystem = prefsWs.sheetsBySystem.mapValues { (_, s) ->
                    Presets.migrateLegacyWodSheet(s, localDeviceId)
                }
            )
        }

        val initialWod = Presets.createWorldOfDarknessSheet(localDeviceId)
        return WorkspaceState(
            activeSystemId = SystemId.WOD,
            sheetsBySystem = mapOf(SystemId.WOD to initialWod)
        )
    }

    fun saveWorkspace(workspace: WorkspaceState, timestampMillis: Long = System.currentTimeMillis()) {
        runCatching {
            val localDeviceId = getOrCreateDeviceId()
            val normalized = workspace.copy(
                sheetsBySystem = workspace.sheetsBySystem.mapValues { (sysId, sheet) ->
                    Presets.migrateSheetMetadata(sheet.copy(systemId = sysId), localDeviceId)
                }
            )
            val encoded = json.encodeToString(WorkspaceState.serializer(), normalized)
            prefs.edit()
                .putString(WORKSPACE_KEY, encoded)
                .putLong(WORKSPACE_UPDATED_AT_KEY, timestampMillis)
                .apply()
        }
    }

    suspend fun saveToRoom(
        workspace: WorkspaceState,
        timestampMillis: Long = System.currentTimeMillis(),
        isDirty: Boolean = true
    ) {
        val localDeviceId = getOrCreateDeviceId()
        val normalized = workspace.copy(
            sheetsBySystem = workspace.sheetsBySystem.mapValues { (sysId, sheet) ->
                Presets.migrateSheetMetadata(sheet.copy(systemId = sysId), localDeviceId)
            }
        )
        roomRepository.mirrorWorkspaceIntoRoom(
            workspace = normalized,
            updatedAtMillis = timestampMillis,
            syncState = if (isDirty) "DIRTY" else "SYNCED",
            isDirty = isDirty
        )
    }

    suspend fun pushRemoteMirror(
        workspace: WorkspaceState,
        timestampMillis: Long = System.currentTimeMillis()
    ): Boolean = roomRepository.pushRemoteMirror(workspace, timestampMillis)

    suspend fun syncWithRemoteMirror(): WorkspaceState? = withContext(Dispatchers.IO) {
        val outcome = roomRepository.syncWithRemoteMirror() ?: return@withContext null
        if (outcome.updatedFromRemote) {
            saveWorkspace(outcome.workspace, outcome.updatedAtMillis)
        }
        outcome.workspace
    }

    suspend fun hydrateAndSyncFromRoom(): WorkspaceState = withContext(Dispatchers.IO) {
        val roomSheets = roomRepository.getAllSheetEntities()
        val roomMeta = roomRepository.getMetadata()
        val (prefsWs, prefsUpdatedAt) = readPrefsWorkspaceRaw()
        val nowMillis = System.currentTimeMillis()

        val localDeviceId = getOrCreateDeviceId()
        val reconciled = WorkspaceSyncEngine.reconcile(
            roomSheets = roomSheets,
            roomMeta = roomMeta,
            prefsWorkspace = prefsWs,
            prefsUpdatedAt = prefsUpdatedAt,
            nowMillis = nowMillis,
            json = json,
            deviceId = localDeviceId
        )

        roomRepository.upsertReconciledEntities(
            entities = reconciled.entitiesToUpsertIntoRoom,
            metadata = reconciled.metadataToUpsertIntoRoom
        )

        val migratedWorkspace = reconciled.workspace.copy(
            sheetsBySystem = reconciled.workspace.sheetsBySystem.mapValues { (_, s) ->
                Presets.migrateLegacyWodSheet(s, localDeviceId)
            }
        )

        if (reconciled.shouldUpdatePrefs || migratedWorkspace != reconciled.workspace) {
            saveWorkspace(migratedWorkspace, reconciled.resolvedTimestamp)
        }

        migratedWorkspace
    }

    fun exportSheetJson(sheet: CharacterSheetState): String =
        json.encodeToString(CharacterSheetState.serializer(), sheet)

    fun importSheetJson(rawJson: String): Result<CharacterSheetState> = runCatching {
        val validation = SheetPayloadValidator.validateRawJson(rawJson)
        require(validation.valid) {
            "Schema v2.0 inválido: ${validation.errors.take(3).joinToString(" | ")}"
        }
        json.decodeFromString<CharacterSheetState>(rawJson)
    }

    suspend fun searchRules(query: String, systemName: String): RulesSearchResponse =
        withContext(Dispatchers.IO) {
            val baseUrl = BuildConfig.RULES_API_BASE_URL.trimEnd('/')
            if (baseUrl.isEmpty()) {
                return@withContext RulesSearchResponse(
                    ok = false,
                    query = query,
                    error = "Endpoint de consulta de regras não configurado."
                )
            }
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$baseUrl/api/rules-search")
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 12000
                    readTimeout = 20000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                }
                val payload = json.encodeToString(
                    RulesSearchRequest.serializer(),
                    RulesSearchRequest(query = query, systemName = systemName)
                )
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(payload)
                    writer.flush()
                }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
                json.decodeFromString(RulesSearchResponse.serializer(), body)
            } catch (err: Exception) {
                RulesSearchResponse(
                    ok = false,
                    query = query,
                    error = "Falha de conexão com a busca de regras: ${err.message ?: "rede indisponível"}"
                )
            } finally {
                conn?.disconnect()
            }
        }

    companion object {
        private const val WORKSPACE_KEY = "grid_sheet_workspace_v2"
        private const val WORKSPACE_UPDATED_AT_KEY = "grid_sheet_workspace_updated_at"
        private const val DEVICE_ID_KEY = "grid_sheet_device_id"
    }
}
