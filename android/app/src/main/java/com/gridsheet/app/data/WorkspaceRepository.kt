package com.gridsheet.app.data

import android.content.Context
import com.gridsheet.app.BuildConfig
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.GridSheetDatabase
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
    private val prefs = context.getSharedPreferences("grid_sheet_prefs", Context.MODE_PRIVATE)
    private val sheetDao = GridSheetDatabase.getInstance(context).sheetDao()

    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = true
    }

    fun observeOfflineSheetCount(): Flow<Int> =
        sheetDao.observeAllSheets().map { it.size }

    private fun readPrefsWorkspaceRaw(): Pair<WorkspaceState?, Long> {
        val raw = prefs.getString(WORKSPACE_KEY, null)
        val updatedAt = prefs.getLong(WORKSPACE_UPDATED_AT_KEY, 0L)
        if (!raw.isNullOrBlank()) {
            val parsed = runCatching {
                json.decodeFromString<WorkspaceState>(raw)
            }.getOrNull()
            if (parsed != null && parsed.sheetsBySystem.isNotEmpty()) {
                return parsed to updatedAt
            }
        }
        return null to updatedAt
    }

    fun loadWorkspace(): WorkspaceState {
        val (prefsWs, _) = readPrefsWorkspaceRaw()
        if (prefsWs != null) return prefsWs

        val initialWod = Presets.createWorldOfDarknessSheet()
        return WorkspaceState(
            activeSystemId = SystemId.WOD,
            sheetsBySystem = mapOf(SystemId.WOD to initialWod)
        )
    }

    fun saveWorkspace(workspace: WorkspaceState, timestampMillis: Long = System.currentTimeMillis()) {
        runCatching {
            val encoded = json.encodeToString(WorkspaceState.serializer(), workspace)
            prefs.edit()
                .putString(WORKSPACE_KEY, encoded)
                .putLong(WORKSPACE_UPDATED_AT_KEY, timestampMillis)
                .apply()
        }
    }

    suspend fun saveToRoom(workspace: WorkspaceState, timestampMillis: Long = System.currentTimeMillis()) {
        withContext(Dispatchers.IO) {
            val entities = workspace.sheetsBySystem.map { (sysId, sheet) ->
                WorkspaceSyncEngine.toEntity(
                    systemId = sysId,
                    sheet = sheet.copy(systemId = sysId),
                    updatedAtMillis = timestampMillis,
                    json = json,
                    syncState = "SYNCED"
                )
            }
            if (entities.isNotEmpty()) {
                sheetDao.upsertSheets(entities)
            }
            sheetDao.upsertMetadata(
                WorkspaceMetadataEntity(
                    id = 1,
                    activeSystemId = workspace.activeSystemId.name,
                    updatedAtMillis = timestampMillis
                )
            )
        }
    }

    suspend fun hydrateAndSyncFromRoom(): WorkspaceState = withContext(Dispatchers.IO) {
        val roomSheets = sheetDao.getAllSheets()
        val roomMeta = sheetDao.getMetadata()
        val (prefsWs, prefsUpdatedAt) = readPrefsWorkspaceRaw()
        val nowMillis = System.currentTimeMillis()

        val reconciled = WorkspaceSyncEngine.reconcile(
            roomSheets = roomSheets,
            roomMeta = roomMeta,
            prefsWorkspace = prefsWs,
            prefsUpdatedAt = prefsUpdatedAt,
            nowMillis = nowMillis,
            json = json
        )

        if (reconciled.entitiesToUpsertIntoRoom.isNotEmpty()) {
            sheetDao.upsertSheets(reconciled.entitiesToUpsertIntoRoom)
        }
        sheetDao.upsertMetadata(reconciled.metadataToUpsertIntoRoom)

        if (reconciled.shouldUpdatePrefs) {
            saveWorkspace(reconciled.workspace, reconciled.resolvedTimestamp)
        }

        reconciled.workspace
    }

    fun exportSheetJson(sheet: CharacterSheetState): String =
        json.encodeToString(CharacterSheetState.serializer(), sheet)

    fun importSheetJson(rawJson: String): Result<CharacterSheetState> = runCatching {
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
    }
}
