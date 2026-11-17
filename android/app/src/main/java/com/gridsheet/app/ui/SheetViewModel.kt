package com.gridsheet.app.ui

import android.app.Application
import android.net.Uri
import android.os.SystemClock
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gridsheet.app.core.AppMode
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.PresetSummary
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.RollLogEntry
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluation
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMetadata
import com.gridsheet.app.core.SheetMetadataMapper
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.SheetTransferException
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.core.XpRulePreset
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.data.Fts5QuerySanitizer
import com.gridsheet.app.data.IndexProgress
import com.gridsheet.app.data.RulesSearchResponse
import com.gridsheet.app.data.SheetRepositoryGateway
import com.gridsheet.app.data.WorkspaceRepository
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.IndexedBookEntity
import com.gridsheet.app.ui.theme.GridThemeMode
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.roundToInt

enum class ActiveScreen {
    HOME,
    SHEET
}

enum class SideSheetMode {
    LOGS,
    RULES
}

/** Result banner for SAF export/import shown in the sheet management modal and home screen. */
data class TransferFeedback(
    val success: Boolean,
    val message: String
)

data class UiState(
    val activeScreen: ActiveScreen = ActiveScreen.HOME,
    val activeSheetId: String? = null,
    val sheets: List<SheetMetadata> = emptyList(),
    val filteredSheets: List<SheetMetadata> = emptyList(),
    val searchQuery: String = "",
    val selectedSystemFilter: SystemId? = null,
    val presets: List<PresetSummary> = emptyList(),
    val indexedBooksCount: Int = 0,
    val isLoading: Boolean = false
)

/**
 * Pure-Kotlin state and navigation coordinator backing [SheetViewModel], allowing deterministic
 * JVM unit testing without Android framework dependencies while running Room I/O on [ioDispatcher].
 */
class SheetStateController(
    private val gateway: SheetRepositoryGateway,
    private val scope: CoroutineScope,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    hydrateOnInit: Boolean = true
) {
    private val pendingJobs = Collections.synchronizedSet(mutableSetOf<Job>())

    private val initialPresets: List<PresetSummary> = runCatching {
        gateway.loadAvailablePresets()
    }.getOrElse {
        Presets.getAvailablePresets(context = null, deviceId = "local-device")
    }

    private val _workspace = MutableStateFlow(
        runCatching { gateway.loadWorkspace() }
            .getOrElse { Presets.createDefaultWorkspace(context = null) }
    )
    val workspace: StateFlow<WorkspaceState> = _workspace.asStateFlow()

    val activeSheet: StateFlow<CharacterSheetState> = _workspace
        .map { ws ->
            ws.sheetsBySystem[ws.activeSystemId]
                ?: Presets.createPresetBySystemId(ws.activeSystemId)
        }
        .stateIn(
            scope,
            SharingStarted.Eagerly,
            _workspace.value.sheetsBySystem[_workspace.value.activeSystemId]
                ?: Presets.createWorldOfDarknessSheet()
        )

    val evaluation: StateFlow<SheetEvaluation> = activeSheet
        .map { SheetEvaluator.evaluateSheet(it) }
        .stateIn(
            scope,
            SharingStarted.Eagerly,
            SheetEvaluator.evaluateSheet(activeSheet.value)
        )

    private val _uiState = MutableStateFlow(
        runCatching {
            val initialActive = _workspace.value.sheetsBySystem[_workspace.value.activeSystemId]
            UiState(
                activeScreen = ActiveScreen.HOME,
                activeSheetId = initialActive?.id,
                presets = initialPresets
            )
        }.getOrElse {
            UiState(
                activeScreen = ActiveScreen.HOME,
                presets = initialPresets
            )
        }
    )
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _activeTab = MutableStateFlow(TabId.GERAL)
    val activeTab: StateFlow<TabId> = _activeTab.asStateFlow()

    private val _mode = MutableStateFlow(AppMode.JOGO)
    val mode: StateFlow<AppMode> = _mode.asStateFlow()

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    private val _xpFilter = MutableStateFlow<XpUpgradeCategory?>(null)
    val xpFilter: StateFlow<XpUpgradeCategory?> = _xpFilter.asStateFlow()

    private val _themeMode = MutableStateFlow(
        runCatching { gateway.loadThemeMode() }.getOrDefault(GridThemeMode.LIGHT)
    )
    val themeMode: StateFlow<GridThemeMode> = _themeMode.asStateFlow()

    init {
        observeSavedSheetsFlow()
        observeIndexedBooksCountFlow()
        if (hydrateOnInit) {
            launchTracked {
                runCatching {
                    val reconciled = withContext(ioDispatcher) { gateway.hydrateAndSyncFromRoom() }
                    _workspace.value = reconciled
                    syncActiveSheetIdFromWorkspace(reconciled)
                    val remoteSynced = withContext(ioDispatcher) { gateway.syncWithRemoteMirror() }
                    if (remoteSynced != null) {
                        _workspace.value = remoteSynced
                        syncActiveSheetIdFromWorkspace(remoteSynced)
                    }
                }.onFailure { err ->
                    if (err is CancellationException) throw err
                }
            }
        }
    }

    private fun observeSavedSheetsFlow() {
        runCatching {
            scope.launch {
                gateway.observeSavedSheets()
                    .catch { emit(emptyList()) }
                    .collect { rawSheets ->
                        val sorted = SheetMetadataMapper.sortDescending(rawSheets)
                        _uiState.update { state ->
                            val resolvedFilter = if (
                                state.selectedSystemFilter != null &&
                                sorted.none { it.systemId == state.selectedSystemFilter }
                            ) {
                                null
                            } else {
                                state.selectedSystemFilter
                            }
                            state.copy(
                                sheets = sorted,
                                selectedSystemFilter = resolvedFilter,
                                filteredSheets = filterSheets(sorted, state.searchQuery, resolvedFilter)
                            )
                        }
                    }
            }
        }
    }

    private fun observeIndexedBooksCountFlow() {
        runCatching {
            scope.launch {
                gateway.observeAllIndexedBooks()
                    .catch { emit(emptyList()) }
                    .collect { books ->
                        _uiState.update { it.copy(indexedBooksCount = books.size) }
                    }
            }
        }
    }

    private fun launchTracked(block: suspend CoroutineScope.() -> Unit): Job {
        val job = scope.launch(block = block)
        pendingJobs.add(job)
        job.invokeOnCompletion { pendingJobs.remove(job) }
        return job
    }

    suspend fun awaitIdle() {
        while (true) {
            val snapshot = synchronized(pendingJobs) { pendingJobs.toList() }
            if (snapshot.isEmpty()) break
            snapshot.forEach { it.join() }
        }
    }

    private fun syncActiveSheetIdFromWorkspace(ws: WorkspaceState) {
        val activeId = ws.sheetsBySystem[ws.activeSystemId]?.id
        if (activeId != null) {
            _uiState.update { it.copy(activeSheetId = activeId) }
        }
    }

    fun navigateToHome() {
        _uiState.update { it.copy(activeScreen = ActiveScreen.HOME) }
    }

    fun navigateToSheet(sheetId: String? = null) {
        if (sheetId == null) {
            val current = activeSheet.value
            _uiState.update {
                it.copy(
                    activeScreen = ActiveScreen.SHEET,
                    activeSheetId = current.id
                )
            }
            return
        }
        launchTracked {
            val loaded = runCatching {
                withContext(ioDispatcher) { gateway.getSavedSheet(sheetId) }
            }.getOrNull() ?: _workspace.value.sheetsBySystem.values.firstOrNull { it.id == sheetId }

            if (loaded == null) {
                _statusMessage.value = "FICHA NÃO ENCONTRADA"
                return@launchTracked
            }

            val sysId = Presets.detectSystemId(loaded)
            val normalized = loaded.copy(systemId = sysId)
            val currentWs = _workspace.value
            val nextWs = WorkspaceState(
                activeSystemId = sysId,
                sheetsBySystem = currentWs.sheetsBySystem + (sysId to normalized)
            )
            _workspace.value = nextWs
            _activeTab.value = TabId.GERAL
            _xpFilter.value = null
            _mode.value = if (sysId == SystemId.BLANK && normalized.cards.isEmpty()) {
                AppMode.EDICAO
            } else {
                AppMode.JOGO
            }
            _uiState.update {
                it.copy(
                    activeScreen = ActiveScreen.SHEET,
                    activeSheetId = normalized.id
                )
            }
            _statusMessage.value = "FICHA ABERTA: ${normalized.characterName}"
            runCatching {
                withContext(ioDispatcher) {
                    gateway.saveWorkspace(nextWs)
                    gateway.saveToRoom(nextWs, isDirty = false)
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
            }
        }
    }

    fun createNewSheetFromHome(systemId: String, customName: String? = null) {
        launchTracked {
            val outcome = runCatching {
                withContext(ioDispatcher) {
                    gateway.createFreshSheetFromHome(systemId, customName)
                }
            }
            outcome.onSuccess { (fresh, nextWs) ->
                val resolvedSysId = Presets.detectSystemId(fresh)
                val nowMillis = System.currentTimeMillis()
                val newMeta = SheetMetadataMapper.fromSheet(fresh, resolvedSysId, nowMillis)
                _workspace.value = nextWs
                _activeTab.value = TabId.GERAL
                _xpFilter.value = null
                _mode.value = if (resolvedSysId == SystemId.BLANK) AppMode.EDICAO else AppMode.JOGO
                _uiState.update { state ->
                    val merged = SheetMetadataMapper.sortDescending(
                        listOf(newMeta) + state.sheets.filterNot { it.id == newMeta.id }
                    )
                    state.copy(
                        activeScreen = ActiveScreen.SHEET,
                        activeSheetId = fresh.id,
                        sheets = merged,
                        filteredSheets = filterSheets(merged, state.searchQuery, state.selectedSystemFilter)
                    )
                }
                _statusMessage.value = "NOVA FICHA: ${fresh.characterName}"
                runCatching {
                    withContext(ioDispatcher) { gateway.pushRemoteMirror(nextWs, nowMillis) }
                }.onFailure { err ->
                    if (err is CancellationException) throw err
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                _statusMessage.value = "FALHA AO CRIAR FICHA: ${err.message ?: "erro"}"
            }
        }
    }

    fun duplicateSheet(sheetId: String) {
        launchTracked {
            val outcome = runCatching {
                withContext(ioDispatcher) { gateway.duplicateSheet(sheetId) }
            }
            outcome.onSuccess { duplicated ->
                if (duplicated != null) {
                    val sysId = Presets.detectSystemId(duplicated)
                    val meta = SheetMetadataMapper.fromSheet(duplicated, sysId, System.currentTimeMillis())
                    _uiState.update { state ->
                        val merged = SheetMetadataMapper.sortDescending(
                            listOf(meta) + state.sheets.filterNot { it.id == meta.id }
                        )
                        state.copy(
                            sheets = merged,
                            filteredSheets = filterSheets(merged, state.searchQuery, state.selectedSystemFilter)
                        )
                    }
                    _statusMessage.value = "FICHA DUPLICADA: ${duplicated.characterName}"
                } else {
                    _statusMessage.value = "FICHA NÃO ENCONTRADA PARA DUPLICAR"
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                _statusMessage.value = "FALHA AO DUPLICAR: ${err.message ?: "erro"}"
            }
        }
    }

    fun deleteSheet(sheetId: String) {
        launchTracked {
            val outcome = runCatching {
                withContext(ioDispatcher) { gateway.deleteSheet(sheetId) }
            }
            outcome.onSuccess { nextWs ->
                _workspace.value = nextWs
                val fallbackActiveId = nextWs.sheetsBySystem[nextWs.activeSystemId]?.id
                _uiState.update { state ->
                    val remaining = state.sheets.filterNot { it.id == sheetId }
                    val resolvedFilter = if (
                        state.selectedSystemFilter != null &&
                        remaining.none { it.systemId == state.selectedSystemFilter }
                    ) {
                        null
                    } else {
                        state.selectedSystemFilter
                    }
                    val nextScreen = if (state.activeSheetId == sheetId) {
                        ActiveScreen.HOME
                    } else {
                        state.activeScreen
                    }
                    state.copy(
                        activeScreen = nextScreen,
                        activeSheetId = if (state.activeSheetId == sheetId) fallbackActiveId else state.activeSheetId,
                        sheets = remaining,
                        selectedSystemFilter = resolvedFilter,
                        filteredSheets = filterSheets(remaining, state.searchQuery, resolvedFilter)
                    )
                }
                _statusMessage.value = "FICHA EXCLUÍDA"
            }.onFailure { err ->
                if (err is CancellationException) throw err
                _statusMessage.value = "FALHA AO EXCLUIR: ${err.message ?: "erro"}"
            }
        }
    }

    fun setHomeSearchQuery(query: String) {
        _uiState.update { state ->
            state.copy(
                searchQuery = query,
                filteredSheets = filterSheets(state.sheets, query, state.selectedSystemFilter)
            )
        }
    }

    fun setHomeSystemFilter(systemId: SystemId?) {
        _uiState.update { state ->
            state.copy(
                selectedSystemFilter = systemId,
                filteredSheets = filterSheets(state.sheets, state.searchQuery, systemId)
            )
        }
    }

    fun persistWorkspace(nextWs: WorkspaceState) {
        val now = System.currentTimeMillis()
        _workspace.value = nextWs
        syncActiveSheetIdFromWorkspace(nextWs)
        runCatching { gateway.saveWorkspace(nextWs, now) }
        launchTracked {
            runCatching {
                withContext(ioDispatcher) {
                    gateway.saveToRoom(nextWs, now)
                    gateway.pushRemoteMirror(nextWs, now)
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
            }
        }
    }

    fun updateActiveSheet(transform: (CharacterSheetState) -> CharacterSheetState) {
        val currentWs = _workspace.value
        val currentSheet = currentWs.sheetsBySystem[currentWs.activeSystemId]
            ?: Presets.createPresetBySystemId(currentWs.activeSystemId)
        val updatedSheet = SheetMutators.touchMetadata(transform(currentSheet))
        val nextWs = currentWs.copy(
            sheetsBySystem = currentWs.sheetsBySystem + (currentWs.activeSystemId to updatedSheet)
        )
        persistWorkspace(nextWs)
    }

    fun setTab(tab: TabId) {
        _activeTab.value = tab
    }

    fun setMode(mode: AppMode) {
        _mode.value = mode
    }

    fun setXpFilter(category: XpUpgradeCategory?) {
        _xpFilter.value = category
    }

    fun setStatusMessage(message: String?) {
        _statusMessage.value = message
    }

    fun setThemeMode(mode: GridThemeMode) {
        if (_themeMode.value == mode) return
        _themeMode.value = mode
        runCatching { gateway.saveThemeMode(mode) }
    }

    fun applyImportedWorkspace(workspace: WorkspaceState) {
        _workspace.value = workspace
        syncActiveSheetIdFromWorkspace(workspace)
        _activeTab.value = TabId.GERAL
        _xpFilter.value = null
    }

    companion object {
        fun filterSheets(
            sheets: List<SheetMetadata>,
            searchQuery: String,
            systemFilter: SystemId?
        ): List<SheetMetadata> {
            val normalizedQuery = searchQuery.trim().lowercase()
            return sheets.filter { meta ->
                val matchesSystem = systemFilter == null || meta.systemId == systemFilter
                val matchesQuery = normalizedQuery.isEmpty() ||
                    meta.characterName.lowercase().contains(normalizedQuery) ||
                    meta.systemName.lowercase().contains(normalizedQuery) ||
                    meta.systemCode.lowercase().contains(normalizedQuery)
                matchesSystem && matchesQuery
            }
        }
    }
}

class SheetViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = WorkspaceRepository(application)
    private val controller = SheetStateController(
        gateway = repo,
        scope = viewModelScope,
        ioDispatcher = Dispatchers.IO,
        hydrateOnInit = true
    )

    val uiState: StateFlow<UiState> = controller.uiState
    val workspace: StateFlow<WorkspaceState> = controller.workspace
    val activeSheet: StateFlow<CharacterSheetState> = controller.activeSheet
    val evaluation: StateFlow<SheetEvaluation> = controller.evaluation
    val activeTab: StateFlow<TabId> = controller.activeTab
    val mode: StateFlow<AppMode> = controller.mode
    val statusMessage: StateFlow<String?> = controller.statusMessage
    val xpFilter: StateFlow<XpUpgradeCategory?> = controller.xpFilter
    val themeMode: StateFlow<GridThemeMode> = controller.themeMode

    private val _sideSheetOpen = MutableStateFlow(false)
    val sideSheetOpen: StateFlow<Boolean> = _sideSheetOpen.asStateFlow()

    private val _sideSheetMode = MutableStateFlow(SideSheetMode.LOGS)
    val sideSheetMode: StateFlow<SideSheetMode> = _sideSheetMode.asStateFlow()

    private val _systemModalOpen = MutableStateFlow(false)
    val systemModalOpen: StateFlow<Boolean> = _systemModalOpen.asStateFlow()

    private val _rulesLoading = MutableStateFlow(false)
    val rulesLoading: StateFlow<Boolean> = _rulesLoading.asStateFlow()

    private val _rulesResult = MutableStateFlow<RulesSearchResponse?>(null)
    val rulesResult: StateFlow<RulesSearchResponse?> = _rulesResult.asStateFlow()

    private val _rulesQuery = MutableStateFlow("")
    val rulesQuery: StateFlow<String> = _rulesQuery.asStateFlow()

    private val _indexProgress = MutableStateFlow<IndexProgress?>(null)
    val indexProgress: StateFlow<IndexProgress?> = _indexProgress.asStateFlow()

    private val _scannedPdfAlert = MutableStateFlow<IndexProgress.ScannedNoOcr?>(null)
    val scannedPdfAlert: StateFlow<IndexProgress.ScannedNoOcr?> = _scannedPdfAlert.asStateFlow()

    private val _localRuleHits = MutableStateFlow<List<FtsRuleHitRow>>(emptyList())
    val localRuleHits: StateFlow<List<FtsRuleHitRow>> = _localRuleHits.asStateFlow()

    private val _localSearchElapsedMs = MutableStateFlow<Long?>(null)
    val localSearchElapsedMs: StateFlow<Long?> = _localSearchElapsedMs.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val indexedBooks: StateFlow<List<IndexedBookEntity>> = workspace
        .map { it.activeSystemId }
        .distinctUntilChanged()
        .flatMapLatest { sysId ->
            repo.observeIndexedBooks(sysId).catch { emit(emptyList()) }
        }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private var indexingJob: Job? = null
    private var localSearchJob: Job? = null
    private var lastScannedPdfUri: Uri? = null
    private var lastScannedPdfSystemId: SystemId? = null

    val offlineSheetCount: StateFlow<Int> = repo.observeOfflineSheetCount()
        .catch { emit(workspace.value.sheetsBySystem.size) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, workspace.value.sheetsBySystem.size)

    private val _transferBusy = MutableStateFlow(false)
    val transferBusy: StateFlow<Boolean> = _transferBusy.asStateFlow()

    private val _transferFeedback = MutableStateFlow<TransferFeedback?>(null)
    val transferFeedback: StateFlow<TransferFeedback?> = _transferFeedback.asStateFlow()

    fun navigateToHome() {
        _sideSheetOpen.value = false
        _systemModalOpen.value = false
        controller.navigateToHome()
    }

    fun navigateToSheet(sheetId: String? = null) {
        controller.navigateToSheet(sheetId)
    }

    fun createNewSheetFromHome(systemId: String, customName: String? = null) {
        controller.createNewSheetFromHome(systemId, customName)
    }

    fun duplicateSheet(sheetId: String) {
        controller.duplicateSheet(sheetId)
    }

    fun deleteSheet(sheetId: String) {
        controller.deleteSheet(sheetId)
    }

    fun setHomeSearchQuery(query: String) {
        controller.setHomeSearchQuery(query)
    }

    fun setHomeSystemFilter(systemId: SystemId?) {
        controller.setHomeSystemFilter(systemId)
    }

    fun setTab(tab: TabId) = controller.setTab(tab)

    fun setMode(mode: AppMode) = controller.setMode(mode)

    fun setXpFilter(category: XpUpgradeCategory?) = controller.setXpFilter(category)

    fun setThemeMode(mode: GridThemeMode) = controller.setThemeMode(mode)

    fun openSideSheet(mode: SideSheetMode) {
        _sideSheetMode.value = mode
        _sideSheetOpen.value = true
    }

    fun closeSideSheet() {
        _sideSheetOpen.value = false
    }

    fun setSystemModalOpen(open: Boolean) {
        _systemModalOpen.value = open
    }

    fun clearStatusMessage() = controller.setStatusMessage(null)

    fun switchSystem(nextSystemId: SystemId) {
        val currentWs = workspace.value
        val activeId = currentWs.activeSystemId
        val active = currentWs.sheetsBySystem[activeId] ?: Presets.createPresetBySystemId(activeId)
        val preservedMap = currentWs.sheetsBySystem + (activeId to active)
        val targetSheet = preservedMap[nextSystemId] ?: Presets.createPresetBySystemId(nextSystemId)
        val nextWs = WorkspaceState(
            activeSystemId = nextSystemId,
            sheetsBySystem = preservedMap + (nextSystemId to targetSheet)
        )
        controller.persistWorkspace(nextWs)
        controller.setXpFilter(null)
        _localRuleHits.value = emptyList()
        _localSearchElapsedMs.value = null
        _rulesResult.value = null
        if (_rulesQuery.value.trim().length >= 2) {
            runLocalFts5Search(_rulesQuery.value, nextSystemId)
        }
        if (nextSystemId == SystemId.BLANK && targetSheet.cards.isEmpty()) {
            if (activeTab.value == TabId.XP) controller.setTab(TabId.GERAL)
            controller.setMode(AppMode.EDICAO)
        }
        val shortLabel = Presets.SYSTEM_OPTIONS.find { it.id == nextSystemId }?.shortLabel ?: nextSystemId.name
        controller.setStatusMessage("SISTEMA ALTERADO: $shortLabel")
    }

    fun resetActiveSystemPreset(systemId: SystemId = workspace.value.activeSystemId) {
        val preset = Presets.createPresetBySystemId(systemId, repo.getOrCreateDeviceId())
        val currentWs = workspace.value
        val nextWs = WorkspaceState(
            activeSystemId = systemId,
            sheetsBySystem = currentWs.sheetsBySystem + (systemId to preset)
        )
        controller.persistWorkspace(nextWs)
        controller.setTab(TabId.GERAL)
        controller.setXpFilter(null)
        _systemModalOpen.value = false
        if (systemId == SystemId.BLANK && preset.cards.isEmpty()) {
            controller.setMode(AppMode.EDICAO)
        }
        controller.setStatusMessage("PRESET CARREGADO: ${preset.systemName}")
    }

    fun createNewBlankSheet() {
        createNewSheetFromHome(SystemId.BLANK.name, null)
    }

    fun updateNumberField(fieldId: String, value: Double) {
        controller.updateActiveSheet { SheetMutators.updateNumberField(it, fieldId, value) }
    }

    fun updateTextField(fieldId: String, value: String) {
        controller.updateActiveSheet { SheetMutators.updateTextField(it, fieldId, value) }
    }

    fun updateBooleanField(fieldId: String, value: Boolean) {
        controller.updateActiveSheet { SheetMutators.updateBooleanField(it, fieldId, value) }
    }

    fun adjustResource(fieldId: String, delta: Int) {
        controller.updateActiveSheet { SheetMutators.adjustResourceValue(it, fieldId, delta) }
    }

    private data class LastV5RollState(
        val label: String,
        val normalRolls: List<Int>,
        val hungerRolls: List<Int>
    )
    private var lastV5RollState: LastV5RollState? = null

    fun adjustHealthDamage(fieldId: String, damageType: String, delta: Int) {
        controller.updateActiveSheet { SheetMutators.adjustHealthDamage(it, fieldId, damageType, delta) }
    }

    fun reduceSuperficialDamage(fieldId: String) {
        controller.updateActiveSheet { SheetMutators.reduceSuperficialDamage(it, fieldId) }
        controller.setStatusMessage("DANO SUPERFICIAL REDUZIDO (÷2)")
    }

    fun performRouseCheck() {
        val res = FormulaEngine.rollDiceExpression("1d10", emptyMap())
        if (!res.ok) return
        val die = res.total
        val passed = die >= 6
        val sheet = activeSheet.value
        val hungerField = sheet.cards.flatMap { it.fields }
            .firstOrNull { it.id == "f_hunger" || it.key.trim().lowercase() == "hunger" }
        val currentHunger = (hungerField?.numValue ?: 0.0).roundToInt().coerceIn(0, 5)
        val nextHunger = if (passed) currentHunger else (currentHunger + 1).coerceAtMost(5)
        val statusText = when {
            passed -> "SUCESSO ($die) · FOME $currentHunger"
            currentHunger >= 5 -> "FALHA ($die) · FOME MÁXIMA (5)!"
            else -> "FALHA ($die) · FOME $currentHunger → $nextHunger"
        }
        val entry = RollLogEntry(
            id = "roll_${UUID.randomUUID().toString().take(8)}",
            timestamp = currentTimeStamp(),
            label = "ROUSE CHECK (1D10)",
            total = die,
            formula = "1d10 ≥ 6",
            breakdown = "1d10[$die] → $statusText",
            isCritical = passed && die == 10,
            isFumble = !passed && currentHunger >= 5,
            isPoolRoll = false
        )
        controller.updateActiveSheet { current ->
            val withHunger = if (!passed && hungerField != null && nextHunger != currentHunger) {
                SheetMutators.setResourceValue(current, hungerField.id, nextHunger)
            } else {
                current
            }
            withHunger.copy(rollLogs = (listOf(entry) + withHunger.rollLogs).take(30))
        }
        controller.setStatusMessage("ROUSE CHECK: $statusText")
    }

    fun rollSoak(soakType: String) {
        val (label, expr) = when (soakType) {
            "aggravated" -> "SOAK AGRAVADO (FORTITUDE)" to "pool(fortitude_armor, 6)"
            "lethal" -> "SOAK LETAL" to "pool(stamina + fortitude_armor, 6)"
            else -> "SOAK CONTUNDENTE (÷2)" to "pool(stamina + fortitude_armor, 6)"
        }
        rollExpression(label, expr, isSoak = true)
    }

    fun performWillpowerSurge() {
        val sheet = activeSheet.value
        val wpField = sheet.cards.flatMap { it.fields }
            .firstOrNull { it.id == "f_willpower" || it.key.trim().lowercase() == "willpower" }
        val currentWp = (wpField?.numValue ?: 0.0).roundToInt()
        if (wpField == null || currentWp <= 0) {
            controller.setStatusMessage("FORÇA DE VONTADE INSUFICIENTE PARA WILLPOWER SURGE")
            return
        }
        val last = lastV5RollState
        if (last == null) {
            controller.setStatusMessage("FAÇA UMA ROLAGEM V5 ANTES DE USAR WILLPOWER SURGE")
            return
        }
        if (last.normalRolls.none { it < 6 }) {
            controller.setStatusMessage("NENHUM DADO NORMAL FALHO PARA REROLAR")
            return
        }
        val res = FormulaEngine.rerollV5WithWillpower(last.normalRolls, last.hungerRolls)
        lastV5RollState = LastV5RollState(last.label, res.normalRolls, res.hungerRolls)
        val entry = RollLogEntry(
            id = "roll_${UUID.randomUUID().toString().take(8)}",
            timestamp = currentTimeStamp(),
            label = "${last.label} · WP SURGE",
            total = res.total,
            formula = res.resolvedExpression,
            breakdown = res.breakdown,
            isCritical = res.isCritical,
            isFumble = res.isFumble,
            isPoolRoll = res.isPoolRoll
        )
        controller.updateActiveSheet { current ->
            SheetMutators.adjustResourceValue(current, wpField.id, -1)
                .copy(rollLogs = (listOf(entry) + current.rollLogs).take(30))
        }
        controller.setStatusMessage("WILLPOWER SURGE: ${res.total} SUCESSOS (-1 WP)")
        _sideSheetMode.value = SideSheetMode.LOGS
        _sideSheetOpen.value = true
    }

    fun setResource(fieldId: String, target: Int) {
        controller.updateActiveSheet { SheetMutators.setResourceValue(it, fieldId, target) }
    }

    fun addRepeatableRow(fieldId: String) {
        val rowId = "row_${UUID.randomUUID().toString().take(8)}"
        controller.updateActiveSheet { SheetMutators.addRepeatableRow(it, fieldId, rowId) }
    }

    fun updateRepeatableRow(fieldId: String, rowId: String, col1: String? = null, col2: String? = null) {
        controller.updateActiveSheet { SheetMutators.updateRepeatableRow(it, fieldId, rowId, col1, col2) }
    }

    fun removeRepeatableRow(fieldId: String, rowId: String) {
        controller.updateActiveSheet { SheetMutators.removeRepeatableRow(it, fieldId, rowId) }
    }

    fun updateFieldSchema(fieldId: String, transform: (SheetField) -> SheetField) {
        controller.updateActiveSheet { SheetMutators.updateFieldSchema(it, fieldId, transform) }
    }

    fun addCardToSheet(tab: TabId, title: String, code: String, colSpan: Int = 1) {
        val cleanTitle = title.trim().uppercase().ifEmpty { "NOVO BLOCO" }
        val derivedCode = code.trim().uppercase().ifEmpty {
            "//" + cleanTitle.replace(Regex("[^A-Z0-9]+"), "_").trim('_').take(16).ifEmpty { "BLOCO" }
        }
        val normalizedCode = if (derivedCode.startsWith("//")) derivedCode else "//$derivedCode"
        val newCard = SheetCard(
            id = "card_${UUID.randomUUID().toString().take(8)}",
            tab = if (tab == TabId.XP) TabId.GERAL else tab,
            code = normalizedCode,
            title = cleanTitle,
            colSpan = colSpan.coerceIn(1, 2),
            fields = emptyList()
        )
        controller.updateActiveSheet { SheetMutators.addCardToSheet(it, newCard) }
        controller.setStatusMessage("BLOCO CRIADO: $cleanTitle")
    }

    fun updateCardSchema(cardId: String, transform: (SheetCard) -> SheetCard) {
        controller.updateActiveSheet { SheetMutators.updateCardSchema(it, cardId, transform) }
    }

    fun removeCardFromSheet(cardId: String) {
        controller.updateActiveSheet { SheetMutators.removeCardFromSheet(it, cardId) }
        controller.setStatusMessage("BLOCO REMOVIDO")
    }

    fun addFieldToCard(
        cardId: String,
        label: String,
        key: String,
        kind: FieldKind,
        formulaOrExpr: String,
        isSkillTemplate: Boolean = false
    ) {
        val targetCard = activeSheet.value.cards.find { it.id == cardId }
        val newField = SheetMutators.buildFieldForCard(
            card = targetCard,
            id = "f_${UUID.randomUUID().toString().take(8)}",
            label = label,
            key = key,
            kind = kind,
            formulaOrExpr = formulaOrExpr,
            isSkillTemplate = isSkillTemplate
        )
        controller.updateActiveSheet { SheetMutators.addFieldToCard(it, cardId, newField) }
        controller.setStatusMessage("CAMPO ADICIONADO: ${newField.label}")
    }

    fun moveFieldInCard(cardId: String, fieldId: String, delta: Int) {
        controller.updateActiveSheet { SheetMutators.moveFieldInCard(it, cardId, fieldId, delta) }
    }

    fun cycleRollDifficulty(fieldId: String) {
        controller.updateActiveSheet { SheetMutators.cycleRollDifficulty(it, fieldId) }
    }

    fun toggleRollSpecialty(fieldId: String) {
        controller.updateActiveSheet { SheetMutators.toggleRollSpecialty(it, fieldId) }
    }

    fun removeFieldFromCard(cardId: String, fieldId: String) {
        controller.updateActiveSheet { SheetMutators.removeFieldFromCard(it, cardId, fieldId) }
    }

    fun rollExpression(label: String, expression: String, isSoak: Boolean = false) {
        val sheet = activeSheet.value
        val isWod = XpSystem.isWodSystem(sheet)
        val rulePreset = XpSystem.resolveRulePreset(sheet)
        val vars = evaluation.value.variables
        val hunger = (vars["hunger"] ?: 0.0).roundToInt().coerceIn(0, 5)
        val woundPenalty = if (isWod && !isSoak) evaluation.value.woundPenalty else 0
        val res = FormulaEngine.rollDiceExpression(
            expression = expression,
            vars = vars,
            rulePreset = rulePreset,
            hunger = hunger,
            woundPenalty = woundPenalty
        )
        if (!res.ok) {
            controller.setStatusMessage("ERRO NA ROLAGEM: ${res.error ?: "Fórmula inválida"}")
            return
        }
        if (res.isPoolRoll && rulePreset == XpRulePreset.VAMPIRE_V5) {
            lastV5RollState = LastV5RollState(
                label = label.uppercase(),
                normalRolls = res.normalRolls,
                hungerRolls = res.hungerRolls
            )
        }
        val entry = RollLogEntry(
            id = "roll_${UUID.randomUUID().toString().take(8)}",
            timestamp = currentTimeStamp(),
            label = label.uppercase(),
            total = res.total,
            formula = res.resolvedExpression,
            breakdown = res.breakdown,
            isCritical = res.isCritical,
            isFumble = res.isFumble,
            isPoolRoll = res.isPoolRoll
        )
        controller.updateActiveSheet { it.copy(rollLogs = (listOf(entry) + it.rollLogs).take(30)) }
        _sideSheetMode.value = SideSheetMode.LOGS
        _sideSheetOpen.value = true
    }

    fun clearRollLogs() {
        controller.updateActiveSheet { it.copy(rollLogs = emptyList()) }
    }

    fun awardXp(delta: Int, reason: String) {
        val res = XpSystem.awardXp(
            sheet = activeSheet.value,
            delta = delta,
            reason = reason,
            timestamp = currentTimeStamp(),
            entryId = "xp_${UUID.randomUUID().toString().take(8)}"
        )
        if (!res.ok) {
            controller.setStatusMessage(res.error)
            return
        }
        controller.updateActiveSheet { res.sheet }
        controller.setStatusMessage(if (delta > 0) "+$delta XP ADICIONADO" else "$delta XP AJUSTADO")
    }

    fun upgradeTrait(fieldId: String) {
        val res = XpSystem.upgradeTraitWithXp(
            sheet = activeSheet.value,
            fieldId = fieldId,
            timestamp = currentTimeStamp(),
            entryId = "xp_${UUID.randomUUID().toString().take(8)}"
        )
        if (!res.ok) {
            controller.setStatusMessage(res.error)
            return
        }
        controller.updateActiveSheet { res.sheet }
        res.trait?.let {
            controller.setStatusMessage("UPGRADE: ${it.label} ${it.currentValue} → ${it.nextValue} (-${it.cost} XP)")
        }
    }

    fun toggleDisciplineClan(fieldId: String) {
        controller.updateActiveSheet { XpSystem.toggleDisciplineClan(it, fieldId) }
    }

    fun setTraitCustomMultiplier(fieldId: String, multiplier: Int?) {
        controller.updateActiveSheet { XpSystem.setCustomMultiplier(it, fieldId, multiplier) }
    }

    fun setXpRulePreset(preset: XpRulePreset) {
        controller.updateActiveSheet { XpSystem.setXpRulePreset(it, preset) }
        val label = when (preset) {
            XpRulePreset.STORYTELLER_V20 -> "V20 CLÁSSICO"
            XpRulePreset.VAMPIRE_V5 -> "VAMPIRO V5"
            XpRulePreset.CUSTOM -> "CUSTOM"
        }
        controller.setStatusMessage("REGRA DE XP: $label")
    }

    fun setCustomUseNewLevelBase(useNewLevelBase: Boolean) {
        controller.updateActiveSheet { XpSystem.setCustomUseNewLevelBase(it, useNewLevelBase) }
    }

    fun buySpecialty(skillFieldId: String, focus: String) {
        val res = XpSystem.buySpecialtyWithXp(
            sheet = activeSheet.value,
            skillFieldId = skillFieldId,
            specialtyFocus = focus,
            timestamp = currentTimeStamp(),
            entryId = "xp_${UUID.randomUUID().toString().take(8)}"
        )
        if (!res.ok) {
            controller.setStatusMessage(res.error)
            return
        }
        controller.updateActiveSheet { res.sheet }
        controller.setStatusMessage("ESPECIALIZAÇÃO ADQUIRIDA (-${XpSystem.SPECIALTY_XP_COST} XP)")
    }

    fun buyBackground(label: String, customCost: Int? = null) {
        val res = XpSystem.buyBackgroundWithXp(
            sheet = activeSheet.value,
            label = label,
            timestamp = currentTimeStamp(),
            entryId = "xp_${UUID.randomUUID().toString().take(8)}",
            customCost = customCost
        )
        if (!res.ok) {
            controller.setStatusMessage(res.error)
            return
        }
        controller.updateActiveSheet { res.sheet }
        val spent = customCost ?: XpSystem.DEFAULT_BACKGROUND_XP_COST
        controller.setStatusMessage("ANTECEDENTE: ${label.trim().uppercase()} (-$spent XP)")
    }

    fun undoLastUpgrade() {
        val res = XpSystem.undoLastUpgrade(activeSheet.value)
        if (!res.ok) {
            controller.setStatusMessage(res.error)
            return
        }
        controller.updateActiveSheet { res.sheet }
        controller.setStatusMessage("DESFEITO: ${res.revertedLabel}")
    }

    fun exportCurrentJson(): String = repo.exportSheetJson(activeSheet.value)

    /** Suggested SAF file name for the active sheet, e.g. `vampira-agata.json`. */
    fun suggestedSheetFileName(): String = SheetTransfer.suggestedSheetFileName(activeSheet.value)

    /** Suggested SAF file name for a full backup, e.g. `gridsheet-backup-2026-11-14.json`. */
    fun suggestedBackupFileName(): String = SheetTransfer.backupFileName()

    fun clearTransferFeedback() {
        _transferFeedback.value = null
    }

    /** Called when no SAF document provider can handle the picker intent. */
    fun reportPickerUnavailable() {
        reportTransfer(success = false, message = "NENHUM GERENCIADOR DE ARQUIVOS DISPONÍVEL NO DISPOSITIVO")
    }

    /**
     * Writes the active sheet ([fullBackup] = false) or every Room sheet ([fullBackup] = true)
     * to a document picked with `ActivityResultContracts.CreateDocument`. All ContentResolver
     * I/O and JSON work runs on [Dispatchers.IO].
     */
    fun exportToUri(uri: Uri, fullBackup: Boolean) {
        if (_transferBusy.value) return
        val snapshot = workspace.value
        val active = activeSheet.value
        val activeId = active.id
        val liveList = if (snapshot.sheetsBySystem.containsKey(snapshot.activeSystemId)) {
            (snapshot.sheetsBySystem.values + active).distinctBy { it.id }
        } else {
            snapshot.sheetsBySystem.values.toList()
        }
        viewModelScope.launch {
            _transferBusy.value = true
            val outcome = runCatching {
                withContext(Dispatchers.IO) {
                    val resolver = getApplication<Application>().contentResolver
                    val stream = runCatching { resolver.openOutputStream(uri, "wt") }.getOrNull()
                        ?: resolver.openOutputStream(uri)
                        ?: throw SheetTransferException("Não foi possível abrir o arquivo de destino.")
                    repo.exportSheetsToStream(
                        outputStream = stream,
                        sheetIds = if (fullBackup) null else listOf(activeId),
                        liveSheets = liveList
                    )
                }
            }
            _transferBusy.value = false
            outcome.onSuccess { count ->
                val label = if (fullBackup) "BACKUP EXPORTADO" else "FICHA EXPORTADA"
                reportTransfer(success = true, message = "$label: $count FICHA(S) SALVA(S) EM .JSON")
            }.onFailure { err ->
                reportTransfer(success = false, message = "FALHA AO EXPORTAR: ${readableError(err)}")
            }
        }
    }

    /**
     * Reads a document picked with `ActivityResultContracts.OpenDocument`, validates it against
     * schema v2 and persists it in Room. Same-id sheets are cloned unless [overwriteExisting].
     */
    fun importFromUri(uri: Uri, overwriteExisting: Boolean) {
        if (_transferBusy.value) return
        val base = workspace.value
        viewModelScope.launch {
            _transferBusy.value = true
            val outcome = runCatching {
                withContext(Dispatchers.IO) {
                    val stream = getApplication<Application>().contentResolver.openInputStream(uri)
                        ?: throw SheetTransferException("Não foi possível abrir o arquivo selecionado.")
                    repo.importSheetsFromStream(
                        inputStream = stream,
                        overwriteExisting = overwriteExisting,
                        baseWorkspace = base
                    )
                }
            }
            _transferBusy.value = false
            outcome.onSuccess { result ->
                controller.applyImportedWorkspace(result.workspace)
                viewModelScope.launch(Dispatchers.IO) {
                    runCatching { repo.pushRemoteMirror(result.workspace, System.currentTimeMillis()) }
                }
                val extras = buildList {
                    if (result.clonedCount > 0) add("${result.clonedCount} CÓPIA(S) COM NOVO ID")
                    if (result.skippedSameSystemCount > 0) {
                        add("${result.skippedSameSystemCount} IGNORADA(S) (MESMO SISTEMA)")
                    }
                }
                val suffix = if (extras.isEmpty()) "" else " · " + extras.joinToString(" · ")
                reportTransfer(
                    success = true,
                    message = "IMPORTADO: ${result.importedCount} FICHA(S)$suffix"
                )
            }.onFailure { err ->
                reportTransfer(success = false, message = "FALHA AO IMPORTAR: ${readableError(err)}")
            }
        }
    }

    private fun reportTransfer(success: Boolean, message: String) {
        _transferFeedback.value = TransferFeedback(success, message)
        controller.setStatusMessage(message)
    }

    private fun readableError(err: Throwable): String = when (err) {
        is SheetTransferException -> err.message ?: "erro desconhecido"
        is SecurityException -> "permissão negada pelo provedor de arquivos."
        is java.io.FileNotFoundException -> "arquivo não encontrado ou inacessível."
        is java.io.IOException -> "erro de leitura/escrita (${err.message ?: "I/O"})."
        else -> err.message ?: err.javaClass.simpleName
    }

    fun importJson(raw: String): Boolean {
        val parsed = repo.importSheetJson(raw).getOrNull() ?: run {
            controller.setStatusMessage("JSON inválido para importação.")
            return false
        }
        val sysId = Presets.detectSystemId(parsed)
        val tagged = parsed.copy(systemId = sysId)
        val currentWs = workspace.value
        val nextWs = WorkspaceState(
            activeSystemId = sysId,
            sheetsBySystem = currentWs.sheetsBySystem + (sysId to tagged)
        )
        controller.persistWorkspace(nextWs)
        _systemModalOpen.value = false
        controller.setStatusMessage("FICHA IMPORTADA: ${tagged.characterName}")
        return true
    }

    fun updateRulesQuery(rawQuery: String) {
        _rulesQuery.value = rawQuery
        runLocalFts5Search(rawQuery, workspace.value.activeSystemId)
    }

    private fun runLocalFts5Search(rawQuery: String, systemId: SystemId) {
        localSearchJob?.cancel()
        val trimmed = rawQuery.trim()
        if (trimmed.length < 2 || Fts5QuerySanitizer.sanitizeQuery(trimmed).isEmpty()) {
            _localRuleHits.value = emptyList()
            _localSearchElapsedMs.value = null
            return
        }
        localSearchJob = viewModelScope.launch {
            val startedAt = SystemClock.elapsedRealtime()
            val hits = runCatching {
                repo.searchLocalPdfRules(trimmed, systemId, limit = 15)
            }.getOrElse { emptyList() }
            val elapsed = (SystemClock.elapsedRealtime() - startedAt).coerceAtLeast(1L)
            _localRuleHits.value = hits
            _localSearchElapsedMs.value = elapsed
        }
    }

    fun importPdfRulebook(uri: Uri, targetSystemId: SystemId = workspace.value.activeSystemId) {
        indexingJob?.cancel()
        _scannedPdfAlert.value = null
        lastScannedPdfUri = uri
        lastScannedPdfSystemId = targetSystemId
        indexingJob = viewModelScope.launch {
            collectIndexingFlow(repo.indexPdfRulebook(uri, targetSystemId))
        }
    }

    fun startOcrIndexing(startPage: Int? = null, endPage: Int? = null) {
        val uri = lastScannedPdfUri
        val alert = _scannedPdfAlert.value
        val targetSystemId = lastScannedPdfSystemId ?: workspace.value.activeSystemId
        if (uri == null || alert == null) {
            controller.setStatusMessage("SELECIONE O PDF NOVAMENTE PARA EXECUTAR OCR")
            return
        }

        val totalPages = alert.totalPages.coerceAtLeast(1)
        val rawStart = startPage?.coerceIn(1, totalPages) ?: 1
        val rawEnd = endPage?.coerceIn(1, totalPages) ?: totalPages
        if (rawStart > rawEnd) {
            controller.setStatusMessage("PÁGINA INICIAL NÃO PODE SER MAIOR QUE A FINAL")
            return
        }
        val zeroBasedRange = (rawStart - 1)..(rawEnd - 1)

        indexingJob?.cancel()
        _scannedPdfAlert.value = null
        indexingJob = viewModelScope.launch {
            collectIndexingFlow(
                repo.indexPdfRulebookWithOcr(
                    uri = uri,
                    bookTitle = alert.bookTitle,
                    systemId = targetSystemId,
                    pageRange = zeroBasedRange
                )
            )
        }
    }

    fun cancelIndexing() {
        indexingJob?.cancel()
        indexingJob = null
        _indexProgress.value = null
        controller.setStatusMessage("INDEXAÇÃO CANCELADA")
    }

    private suspend fun collectIndexingFlow(flow: kotlinx.coroutines.flow.Flow<IndexProgress>) {
        flow.collect { progress ->
            when (progress) {
                is IndexProgress.Extracting,
                is IndexProgress.OcrExtracting,
                is IndexProgress.Persisting -> {
                    _indexProgress.value = progress
                }
                is IndexProgress.Completed -> {
                    _indexProgress.value = null
                    _scannedPdfAlert.value = null
                    lastScannedPdfUri = null
                    lastScannedPdfSystemId = null
                    controller.setStatusMessage(
                        "PDF INDEXADO: ${progress.book.title} (${progress.indexedPagesCount} PÁGS)"
                    )
                    if (_rulesQuery.value.trim().length >= 2) {
                        runLocalFts5Search(_rulesQuery.value, workspace.value.activeSystemId)
                    }
                }
                is IndexProgress.ScannedNoOcr -> {
                    _indexProgress.value = null
                    _scannedPdfAlert.value = progress
                    controller.setStatusMessage("PDF ESCANEADO (SEM OCR): ${progress.bookTitle}")
                }
                is IndexProgress.Error -> {
                    _indexProgress.value = progress
                    controller.setStatusMessage("ERRO PDF: ${progress.message}")
                }
            }
        }
    }

    fun dismissScannedPdfAlert() {
        _scannedPdfAlert.value = null
        lastScannedPdfUri = null
        lastScannedPdfSystemId = null
    }

    fun dismissIndexError() {
        if (_indexProgress.value is IndexProgress.Error) {
            _indexProgress.value = null
        }
        _scannedPdfAlert.value = null
        lastScannedPdfUri = null
        lastScannedPdfSystemId = null
    }

    fun deleteIndexedBook(bookId: String) {
        viewModelScope.launch {
            runCatching { repo.deleteIndexedBook(bookId) }
                .onSuccess {
                    controller.setStatusMessage("MANUAL REMOVIDO DO ÍNDICE")
                    if (_rulesQuery.value.trim().length >= 2) {
                        runLocalFts5Search(_rulesQuery.value, workspace.value.activeSystemId)
                    }
                }
                .onFailure { err ->
                    controller.setStatusMessage("FALHA AO REMOVER PDF: ${err.message ?: "erro"}")
                }
        }
    }

    fun searchRules(query: String, forceOnline: Boolean = false) {
        val trimmed = query.trim()
        _rulesQuery.value = query
        if (trimmed.length < 2) {
            _localRuleHits.value = emptyList()
            _localSearchElapsedMs.value = null
            _rulesResult.value = RulesSearchResponse(
                ok = false,
                query = trimmed,
                error = "Digite pelo menos 2 caracteres para pesquisar uma regra."
            )
            return
        }
        viewModelScope.launch {
            val activeSys = workspace.value.activeSystemId
            val startedAt = SystemClock.elapsedRealtime()
            val localHits = runCatching {
                repo.searchLocalPdfRules(trimmed, activeSys, limit = 15)
            }.getOrElse { emptyList() }
            _localRuleHits.value = localHits
            _localSearchElapsedMs.value = (SystemClock.elapsedRealtime() - startedAt).coerceAtLeast(1L)

            val shouldSearchOnline = forceOnline || (indexedBooks.value.isEmpty() && localHits.isEmpty())
            if (shouldSearchOnline) {
                _rulesLoading.value = true
                _rulesResult.value = repo.searchRules(trimmed, activeSheet.value.systemName)
                _rulesLoading.value = false
            } else {
                _rulesResult.value = null
            }
        }
    }

    fun getQuickDicePresets(systemId: SystemId): List<String> = when (systemId) {
        SystemId.WOD -> listOf("3d10@6", "5d10@6", "7d10@6", "1d10")
        SystemId.CYBERPUNK -> listOf("1d10", "1d10+8", "2d6", "3d6")
        SystemId.BLANK -> listOf("1d6", "2d6", "1d10", "1d20")
        else -> listOf("1d20", "1d20+5", "1d8+3", "2d6")
    }

    private fun currentTimeStamp(): String =
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
}
