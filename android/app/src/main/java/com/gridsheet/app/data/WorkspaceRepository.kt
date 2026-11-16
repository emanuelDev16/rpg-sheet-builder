package com.gridsheet.app.data

import android.content.Context
import android.net.Uri
import com.gridsheet.app.BuildConfig
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.PresetSummary
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetMetadata
import com.gridsheet.app.core.SheetMetadataMapper
import com.gridsheet.app.core.SheetPayloadValidator
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.SheetTransferException
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.GridSheetDatabase
import com.gridsheet.app.data.local.IndexedBookEntity
import com.gridsheet.app.data.local.SavedSheetEntity
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import com.gridsheet.app.ui.theme.GridThemeMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
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

data class SheetImportResult(
    val workspace: WorkspaceState,
    val importedCount: Int,
    val clonedCount: Int,
    val skippedSameSystemCount: Int,
    val importedNames: List<String>
)

interface SheetRepositoryGateway {
    fun getOrCreateDeviceId(): String
    fun loadAvailablePresets(): List<PresetSummary>
    fun loadWorkspace(): WorkspaceState
    fun saveWorkspace(workspace: WorkspaceState, timestampMillis: Long = System.currentTimeMillis())
    suspend fun saveToRoom(
        workspace: WorkspaceState,
        timestampMillis: Long = System.currentTimeMillis(),
        isDirty: Boolean = true
    )
    suspend fun pushRemoteMirror(
        workspace: WorkspaceState,
        timestampMillis: Long = System.currentTimeMillis()
    ): Boolean
    suspend fun hydrateAndSyncFromRoom(): WorkspaceState
    suspend fun syncWithRemoteMirror(): WorkspaceState?
    fun observeSavedSheets(): Flow<List<SheetMetadata>>
    suspend fun getSavedSheet(sheetId: String): CharacterSheetState?
    suspend fun saveSheet(
        sheet: CharacterSheetState,
        timestampMillis: Long = System.currentTimeMillis()
    ): CharacterSheetState
    suspend fun createFreshSheetFromHome(
        systemId: String,
        customName: String? = null
    ): Pair<CharacterSheetState, WorkspaceState>
    suspend fun duplicateSheet(sheetId: String): CharacterSheetState?
    suspend fun deleteSheet(sheetId: String): WorkspaceState
    fun observeIndexedBooks(systemId: SystemId): Flow<List<IndexedBookEntity>>
    fun observeAllIndexedBooks(): Flow<List<IndexedBookEntity>>
    fun loadThemeMode(): GridThemeMode = GridThemeMode.LIGHT
    fun saveThemeMode(mode: GridThemeMode) {}
}

object SheetLibraryOps {
    fun generateNonCollidingId(
        existingIds: Set<String>,
        idGenerator: () -> String = { UUID.randomUUID().toString() }
    ): String {
        var candidate = idGenerator().trim()
        var guard = 0
        while ((candidate.isEmpty() || candidate in existingIds) && guard++ < 64) {
            candidate = idGenerator().trim()
        }
        if (candidate.isEmpty() || candidate in existingIds) {
            candidate = UUID.randomUUID().toString()
        }
        return candidate
    }

    fun buildDuplicatedSheet(
        source: CharacterSheetState,
        existingIds: Set<String>,
        deviceId: String,
        nowIso: String = Instant.now().toString(),
        idGenerator: () -> String = { UUID.randomUUID().toString() }
    ): CharacterSheetState {
        val sysId = Presets.detectSystemId(source)
        val newId = generateNonCollidingId(existingIds, idGenerator)
        return source.copy(
            id = newId,
            systemId = sysId,
            characterName = SheetTransfer.withCopySuffix(source.characterName),
            revision = 1,
            updatedAt = nowIso,
            deviceId = deviceId.ifBlank { "local-device" }
        )
    }
}

class WorkspaceRepository(context: Context) : SheetRepositoryGateway {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("grid_sheet_prefs", Context.MODE_PRIVATE)
    private val db = GridSheetDatabase.getInstance(appContext)
    private val pdfRulesDao = db.pdfRulesDao()
    private val pdfRulesIndexer = PdfRulesIndexer(appContext, pdfRulesDao)
    val roomRepository = RoomWorkspaceRepository(appContext)

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        encodeDefaults = true
        prettyPrint = true
    }

    override fun getOrCreateDeviceId(): String = runCatching {
        val existing = prefs.getString(DEVICE_ID_KEY, null)?.trim()
        if (!existing.isNullOrEmpty()) {
            return existing
        }
        val created = UUID.randomUUID().toString()
        prefs.edit().putString(DEVICE_ID_KEY, created).apply()
        created
    }.getOrDefault("local-device")

    override fun loadThemeMode(): GridThemeMode = runCatching {
        GridThemeMode.fromStorageKey(prefs.getString(THEME_MODE_KEY, null))
    }.getOrDefault(GridThemeMode.LIGHT)

    override fun saveThemeMode(mode: GridThemeMode) {
        runCatching {
            prefs.edit().putString(THEME_MODE_KEY, mode.storageKey).apply()
        }
    }

    override fun loadAvailablePresets(): List<PresetSummary> = runCatching {
        Presets.getAvailablePresets(appContext, getOrCreateDeviceId())
    }.getOrElse {
        Presets.getAvailablePresets(context = null, deviceId = "local-device")
    }

    fun observeOfflineSheetCount(): Flow<Int> = roomRepository.observeOfflineSheetCount()

    override fun observeIndexedBooks(systemId: SystemId): Flow<List<IndexedBookEntity>> =
        pdfRulesDao.observeBooksBySystem(systemId.name)

    override fun observeAllIndexedBooks(): Flow<List<IndexedBookEntity>> =
        pdfRulesDao.observeAllBooks()

    fun indexPdfRulebook(uri: Uri, systemId: SystemId): Flow<IndexProgress> =
        pdfRulesIndexer.indexPdf(uri, systemId.name)

    fun indexPdfRulebookWithOcr(
        uri: Uri,
        bookTitle: String,
        systemId: SystemId,
        pageRange: IntRange? = null
    ): Flow<IndexProgress> =
        pdfRulesIndexer.indexPdfWithOcr(uri, bookTitle, systemId.name, pageRange)

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

    private fun readPrefsWorkspaceRaw(): Pair<WorkspaceState?, Long> = runCatching {
        val raw = prefs.getString(WORKSPACE_KEY, null)
        val updatedAt = prefs.getLong(WORKSPACE_UPDATED_AT_KEY, 0L)
        val localDeviceId = getOrCreateDeviceId()
        val savedInitialized = prefs.getBoolean(SAVED_SHEETS_INITIALIZED_KEY, false)
        if (!raw.isNullOrBlank()) {
            val parsed = runCatching {
                json.decodeFromString<WorkspaceState>(raw)
            }.getOrNull()
            if (parsed != null && (parsed.sheetsBySystem.isNotEmpty() || savedInitialized)) {
                val migrated = parsed.copy(
                    sheetsBySystem = parsed.sheetsBySystem.mapValues { (sysId, s) ->
                        Presets.migrateSheetMetadata(s.copy(systemId = sysId), localDeviceId)
                    }
                )
                return migrated to updatedAt
            }
        }
        null to updatedAt
    }.getOrDefault(null to 0L)

    override fun loadWorkspace(): WorkspaceState = runCatching {
        val localDeviceId = getOrCreateDeviceId()
        runCatching { Presets.loadPresetsFromAsset(appContext, localDeviceId) }
        val (prefsWs, _) = readPrefsWorkspaceRaw()
        if (prefsWs != null) {
            return prefsWs.copy(
                sheetsBySystem = prefsWs.sheetsBySystem.mapValues { (_, s) ->
                    Presets.migrateLegacyWodSheet(s, localDeviceId)
                }
            )
        }
        Presets.createDefaultWorkspace(localDeviceId, appContext)
    }.getOrElse {
        Presets.createDefaultWorkspace("local-device", null)
    }

    override fun saveWorkspace(workspace: WorkspaceState, timestampMillis: Long) {
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

    override suspend fun saveToRoom(
        workspace: WorkspaceState,
        timestampMillis: Long,
        isDirty: Boolean
    ) {
        val localDeviceId = getOrCreateDeviceId()
        val normalized = workspace.copy(
            sheetsBySystem = workspace.sheetsBySystem.mapValues { (sysId, sheet) ->
                Presets.migrateSheetMetadata(sheet.copy(systemId = sysId), localDeviceId)
            }
        )
        if (normalized.sheetsBySystem.isNotEmpty()) {
            roomRepository.mirrorWorkspaceIntoRoom(
                workspace = normalized,
                updatedAtMillis = timestampMillis,
                syncState = if (isDirty) "DIRTY" else "SYNCED",
                isDirty = isDirty
            )
            val savedEntities = normalized.sheetsBySystem.values.map { sheet ->
                toSavedEntity(sheet, timestampMillis)
            }
            roomRepository.upsertSavedSheetEntities(savedEntities)
            prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
        } else {
            roomRepository.deleteAllWorkspaceSheets(normalized.activeSystemId, timestampMillis)
        }
    }

    override suspend fun pushRemoteMirror(
        workspace: WorkspaceState,
        timestampMillis: Long
    ): Boolean = roomRepository.pushRemoteMirror(workspace, timestampMillis)

    override suspend fun syncWithRemoteMirror(): WorkspaceState? = withContext(Dispatchers.IO) {
        runCatching {
            val outcome = roomRepository.syncWithRemoteMirror() ?: return@runCatching null
            if (outcome.updatedFromRemote) {
                saveWorkspace(outcome.workspace, outcome.updatedAtMillis)
                val savedEntities = outcome.workspace.sheetsBySystem.values.map { sheet ->
                    toSavedEntity(sheet, outcome.updatedAtMillis)
                }
                roomRepository.upsertSavedSheetEntities(savedEntities)
                prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
            }
            outcome.workspace
        }.getOrNull()
    }

    override suspend fun hydrateAndSyncFromRoom(): WorkspaceState = withContext(Dispatchers.IO) {
        runCatching {
            val localDeviceId = getOrCreateDeviceId()
            runCatching { Presets.loadPresetsFromAsset(appContext, localDeviceId) }
            val alreadyInitialized = prefs.getBoolean(SAVED_SHEETS_INITIALIZED_KEY, false)
            val existingSaved = roomRepository.getAllSavedSheetEntities()
            if (alreadyInitialized && existingSaved.isEmpty()) {
                val (prefsWs, _) = readPrefsWorkspaceRaw()
                if (prefsWs != null && prefsWs.sheetsBySystem.isEmpty()) {
                    return@runCatching prefsWs
                }
            }

            val roomSheets = roomRepository.getAllSheetEntities()
            val roomMeta = roomRepository.getMetadata()
            val (prefsWs, prefsUpdatedAt) = readPrefsWorkspaceRaw()
            val nowMillis = System.currentTimeMillis()

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

            if (!alreadyInitialized) {
                if (existingSaved.isEmpty() && migratedWorkspace.sheetsBySystem.isNotEmpty()) {
                    val seeded = migratedWorkspace.sheetsBySystem.values.map { sheet ->
                        toSavedEntity(sheet, reconciled.resolvedTimestamp)
                    }
                    roomRepository.upsertSavedSheetEntities(seeded)
                }
                prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
            }

            if (reconciled.shouldUpdatePrefs || migratedWorkspace != reconciled.workspace) {
                saveWorkspace(migratedWorkspace, reconciled.resolvedTimestamp)
            }

            migratedWorkspace
        }.getOrElse {
            loadWorkspace()
        }
    }

    override fun observeSavedSheets(): Flow<List<SheetMetadata>> =
        roomRepository.observeAllSavedSheets().map { entities ->
            val items = entities.mapNotNull { entity ->
                val decoded = decodeSavedEntity(entity) ?: return@mapNotNull null
                val sysId = Presets.detectSystemId(decoded)
                SheetMetadataMapper.fromSheet(
                    sheet = decoded,
                    systemId = sysId,
                    updatedAtMillis = entity.updatedAtMillis
                )
            }
            SheetMetadataMapper.sortDescending(items)
        }

    override suspend fun getSavedSheet(sheetId: String): CharacterSheetState? = withContext(Dispatchers.IO) {
        val localDeviceId = getOrCreateDeviceId()
        roomRepository.getSavedSheetEntity(sheetId)?.let { entity ->
            decodeSavedEntity(entity, localDeviceId)?.let { return@withContext it }
        }
        for (entity in roomRepository.getAllSheetEntities()) {
            val decoded = runCatching {
                roomRepository.json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
            }.getOrNull() ?: continue
            if (decoded.id == sheetId) {
                return@withContext Presets.migrateLegacyWodSheet(decoded, localDeviceId)
            }
        }
        null
    }

    override suspend fun saveSheet(
        sheet: CharacterSheetState,
        timestampMillis: Long
    ): CharacterSheetState = withContext(Dispatchers.IO) {
        val localDeviceId = getOrCreateDeviceId()
        val sysId = Presets.detectSystemId(sheet)
        val migrated = Presets.migrateLegacyWodSheet(
            sheet.copy(systemId = sysId),
            localDeviceId
        )
        roomRepository.upsertSavedSheetEntity(toSavedEntity(migrated, timestampMillis))
        prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
        migrated
    }

    override suspend fun createFreshSheetFromHome(
        systemId: String,
        customName: String?
    ): Pair<CharacterSheetState, WorkspaceState> = withContext(Dispatchers.IO) {
        val localDeviceId = getOrCreateDeviceId()
        runCatching { Presets.loadPresetsFromAsset(appContext, localDeviceId) }
        val baseWs = roomRepository.loadWorkspaceFromRoom().first ?: loadWorkspace()
        val existingIds = collectAllExistingIds(baseWs)
        val nowMillis = System.currentTimeMillis()
        val nowIso = Instant.ofEpochMilli(nowMillis).toString()

        val fresh = Presets.createFreshSheetForSystem(
            systemId = systemId,
            deviceId = localDeviceId,
            customName = customName,
            nowIso = nowIso,
            idGenerator = { SheetLibraryOps.generateNonCollidingId(existingIds) }
        )
        val resolvedSysId = Presets.detectSystemId(fresh)
        val normalizedFresh = fresh.copy(systemId = resolvedSysId)

        roomRepository.upsertSavedSheetEntity(toSavedEntity(normalizedFresh, nowMillis))
        prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()

        val nextWs = WorkspaceState(
            activeSystemId = resolvedSysId,
            sheetsBySystem = baseWs.sheetsBySystem + (resolvedSysId to normalizedFresh)
        )
        saveWorkspace(nextWs, nowMillis)
        roomRepository.mirrorWorkspaceIntoRoom(
            workspace = nextWs,
            updatedAtMillis = nowMillis,
            syncState = "DIRTY",
            isDirty = true
        )
        normalizedFresh to nextWs
    }

    override suspend fun duplicateSheet(sheetId: String): CharacterSheetState? = withContext(Dispatchers.IO) {
        val source = getSavedSheet(sheetId) ?: return@withContext null
        val localDeviceId = getOrCreateDeviceId()
        val baseWs = roomRepository.loadWorkspaceFromRoom().first ?: loadWorkspace()
        val existingIds = collectAllExistingIds(baseWs)
        val nowMillis = System.currentTimeMillis()
        val nowIso = Instant.ofEpochMilli(nowMillis).toString()

        val duplicated = SheetLibraryOps.buildDuplicatedSheet(
            source = source,
            existingIds = existingIds,
            deviceId = localDeviceId,
            nowIso = nowIso
        )
        roomRepository.upsertSavedSheetEntity(toSavedEntity(duplicated, nowMillis))
        prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
        duplicated
    }

    override suspend fun deleteSheet(sheetId: String): WorkspaceState = withContext(Dispatchers.IO) {
        val nowMillis = System.currentTimeMillis()
        val localDeviceId = getOrCreateDeviceId()
        prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
        roomRepository.deleteSavedSheetEntity(sheetId)

        val remainingSheets = roomRepository.getAllSavedSheetEntities()
            .mapNotNull { decodeSavedEntity(it, localDeviceId) }
        val currentWs = roomRepository.loadWorkspaceFromRoom().first ?: loadWorkspace()

        val updatedMap = LinkedHashMap<SystemId, CharacterSheetState>()
        for ((sysId, sheet) in currentWs.sheetsBySystem) {
            if (sheet.id != sheetId) {
                updatedMap[sysId] = sheet
            } else {
                val replacement = remainingSheets.firstOrNull { Presets.detectSystemId(it) == sysId }
                if (replacement != null) {
                    updatedMap[sysId] = replacement
                }
            }
        }
        for (sheet in remainingSheets) {
            val sysId = Presets.detectSystemId(sheet)
            if (sysId !in updatedMap) {
                updatedMap[sysId] = sheet
            }
        }

        val nextActiveSystem = when {
            updatedMap.containsKey(currentWs.activeSystemId) -> currentWs.activeSystemId
            updatedMap.isNotEmpty() -> updatedMap.keys.first()
            else -> SystemId.WOD
        }
        val nextWs = WorkspaceState(
            activeSystemId = nextActiveSystem,
            sheetsBySystem = updatedMap.toMap()
        )
        saveWorkspace(nextWs, nowMillis)
        if (nextWs.sheetsBySystem.isEmpty()) {
            roomRepository.deleteAllWorkspaceSheets(nextActiveSystem, nowMillis)
        } else {
            roomRepository.mirrorWorkspaceIntoRoom(
                workspace = nextWs,
                updatedAtMillis = nowMillis,
                syncState = "DIRTY",
                isDirty = true
            )
        }
        nextWs
    }

    private suspend fun collectAllExistingIds(baseWorkspace: WorkspaceState? = null): Set<String> {
        val ids = LinkedHashSet<String>()
        baseWorkspace?.sheetsBySystem?.values?.forEach { ids += it.id }
        roomRepository.getAllSavedSheetEntities().forEach { ids += it.sheetId }
        roomRepository.getAllSheetEntities().forEach { entity ->
            runCatching {
                roomRepository.json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson).id
            }.getOrNull()?.let { ids += it }
        }
        return ids
    }

    private fun decodeSavedEntity(
        entity: SavedSheetEntity,
        deviceId: String = getOrCreateDeviceId()
    ): CharacterSheetState? = runCatching {
        val parsed = roomRepository.json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
        val sysId = WorkspaceSyncEngine.parseSystemId(entity.systemId) ?: Presets.detectSystemId(parsed)
        Presets.migrateLegacyWodSheet(
            parsed.copy(
                id = parsed.id.ifBlank { entity.sheetId },
                systemId = sysId
            ),
            deviceId
        )
    }.getOrNull()

    private fun toSavedEntity(
        sheet: CharacterSheetState,
        timestampMillis: Long
    ): SavedSheetEntity {
        val localDeviceId = getOrCreateDeviceId()
        val sysId = Presets.detectSystemId(sheet)
        val migrated = Presets.migrateSheetMetadata(sheet.copy(systemId = sysId), localDeviceId)
        return SavedSheetEntity(
            sheetId = migrated.id,
            systemId = sysId.name,
            systemName = migrated.systemName,
            characterName = migrated.characterName,
            sheetJson = roomRepository.json.encodeToString(CharacterSheetState.serializer(), migrated),
            updatedAt = migrated.updatedAt,
            updatedAtMillis = timestampMillis,
            revision = migrated.revision
        )
    }

    fun exportSheetJson(sheet: CharacterSheetState): String =
        json.encodeToString(CharacterSheetState.serializer(), sheet)

    /**
     * Writes a versioned envelope (`app/schemaVersion/exportedAt/sheets`) as UTF-8 to [outputStream]
     * and always closes it. `sheetIds == null` exports every sheet stored in [GridSheetDatabase];
     * otherwise only the matching ids. [liveSheets] (in-memory state) override Room rows of the
     * same system, so edits not yet flushed to Room are never lost in the file.
     *
     * @return number of exported sheets.
     */
    suspend fun exportSheetsToStream(
        outputStream: OutputStream,
        sheetIds: List<String>?,
        liveSheets: Collection<CharacterSheetState> = emptyList()
    ): Int = withContext(Dispatchers.IO) {
        try {
            val localDeviceId = getOrCreateDeviceId()
            val byId = LinkedHashMap<String, CharacterSheetState>()
            for (saved in roomRepository.getAllSavedSheetEntities()) {
                val decoded = decodeSavedEntity(saved, localDeviceId) ?: continue
                byId[decoded.id] = decoded
            }
            for (entity in roomRepository.getAllSheetEntities()) {
                val sysId = WorkspaceSyncEngine.parseSystemId(entity.systemId) ?: continue
                val decoded = runCatching {
                    roomRepository.json.decodeFromString(CharacterSheetState.serializer(), entity.sheetJson)
                }.getOrNull() ?: continue
                val migrated = Presets.migrateSheetMetadata(decoded.copy(systemId = sysId), localDeviceId)
                if (!byId.containsKey(migrated.id)) {
                    byId[migrated.id] = migrated
                }
            }
            for (live in liveSheets) {
                val migratedLive = Presets.migrateSheetMetadata(
                    live.copy(systemId = Presets.detectSystemId(live)),
                    localDeviceId
                )
                byId[migratedLive.id] = migratedLive
            }
            val pool = byId.values.map { Presets.migrateSheetMetadata(it, localDeviceId) }
            val selected = if (sheetIds == null) {
                pool.take(SheetTransfer.MAX_SHEETS_PER_FILE)
            } else {
                sheetIds.mapNotNull { id -> pool.firstOrNull { it.id == id } }
            }
            if (selected.isEmpty()) {
                throw SheetTransferException("Nenhuma ficha encontrada para exportar.")
            }
            SheetTransfer.writeEnvelope(outputStream, selected)
        } finally {
            runCatching { outputStream.close() }
        }
    }

    /**
     * Reads at most [maxBytes] from [inputStream] (always closed), validates the payload against
     * the schema v2 contract (`assets/presets/schema.v2.json`), migrates legacy sheets and persists
     * them in Room through [SheetDao][com.gridsheet.app.data.local.SheetDao].
     *
     * When [overwriteExisting] is false, sheets whose `id` already exists get a new UUID and the
     * " (Cópia)" suffix. All imported sheets are persisted in `saved_sheets` by unique `sheetId`.
     */
    suspend fun importSheetsFromStream(
        inputStream: InputStream,
        overwriteExisting: Boolean,
        baseWorkspace: WorkspaceState? = null,
        maxBytes: Int = SheetTransfer.MAX_IMPORT_BYTES
    ): SheetImportResult = withContext(Dispatchers.IO) {
        val localDeviceId = getOrCreateDeviceId()
        val raw = SheetTransfer.readBoundedUtf8(inputStream, maxBytes)
        val parsed = SheetTransfer.parseImportPayload(raw, localDeviceId)

        val base = baseWorkspace
            ?: roomRepository.loadWorkspaceFromRoom().first
            ?: loadWorkspace()
        val existingIds = collectAllExistingIds(base)

        val resolution = SheetTransfer.resolveIdCollisions(parsed, existingIds, overwriteExisting)
        val now = System.currentTimeMillis()
        val normalizedImported = resolution.sheets.map { sheet ->
            val sysId = Presets.detectSystemId(sheet)
            Presets.migrateSheetMetadata(sheet.copy(systemId = sysId), localDeviceId)
        }
        val importedBySystem = LinkedHashMap<SystemId, CharacterSheetState>()
        for (sheet in normalizedImported) {
            importedBySystem[Presets.detectSystemId(sheet)] = sheet
        }
        val nextWorkspace = WorkspaceState(
            activeSystemId = importedBySystem.keys.first(),
            sheetsBySystem = base.sheetsBySystem + importedBySystem
        )
        roomRepository.upsertSavedSheetEntities(
            normalizedImported.map { toSavedEntity(it, now) }
        )
        prefs.edit().putBoolean(SAVED_SHEETS_INITIALIZED_KEY, true).apply()
        saveToRoom(nextWorkspace, now, isDirty = true)
        saveWorkspace(nextWorkspace, now)

        SheetImportResult(
            workspace = nextWorkspace,
            importedCount = normalizedImported.size,
            clonedCount = resolution.clonedCount,
            skippedSameSystemCount = 0,
            importedNames = normalizedImported.map { it.characterName }
        )
    }

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
        private const val SAVED_SHEETS_INITIALIZED_KEY = "grid_sheet_saved_sheets_seeded_v1"
        private const val THEME_MODE_KEY = "grid_sheet_theme_mode"
    }
}
