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
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.RollLogEntry
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluation
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.SheetTransferException
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.data.Fts5QuerySanitizer
import com.gridsheet.app.data.IndexProgress
import com.gridsheet.app.data.RulesSearchResponse
import com.gridsheet.app.data.WorkspaceRepository
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.IndexedBookEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

enum class SideSheetMode {
    LOGS,
    RULES
}

/** Result banner for SAF export/import shown in the sheet management modal. */
data class TransferFeedback(
    val success: Boolean,
    val message: String
)

class SheetViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = WorkspaceRepository(application)

    private val _workspace = MutableStateFlow(repo.loadWorkspace())
    val workspace: StateFlow<WorkspaceState> = _workspace.asStateFlow()

    val activeSheet: StateFlow<CharacterSheetState> = _workspace
        .map { ws ->
            ws.sheetsBySystem[ws.activeSystemId]
                ?: Presets.createPresetBySystemId(ws.activeSystemId)
        }
        .stateIn(
            viewModelScope,
            SharingStarted.Eagerly,
            _workspace.value.sheetsBySystem[_workspace.value.activeSystemId]
                ?: Presets.createWorldOfDarknessSheet()
        )

    val evaluation: StateFlow<SheetEvaluation> = activeSheet
        .map { SheetEvaluator.evaluateSheet(it) }
        .stateIn(
            viewModelScope,
            SharingStarted.Eagerly,
            SheetEvaluator.evaluateSheet(activeSheet.value)
        )

    private val _activeTab = MutableStateFlow(TabId.GERAL)
    val activeTab: StateFlow<TabId> = _activeTab.asStateFlow()

    private val _mode = MutableStateFlow(AppMode.JOGO)
    val mode: StateFlow<AppMode> = _mode.asStateFlow()

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    private val _xpFilter = MutableStateFlow<XpUpgradeCategory?>(null)
    val xpFilter: StateFlow<XpUpgradeCategory?> = _xpFilter.asStateFlow()

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
    val indexedBooks: StateFlow<List<IndexedBookEntity>> = _workspace
        .map { it.activeSystemId }
        .distinctUntilChanged()
        .flatMapLatest { sysId -> repo.observeIndexedBooks(sysId) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private var indexingJob: Job? = null
    private var localSearchJob: Job? = null

    val offlineSheetCount: StateFlow<Int> = repo.observeOfflineSheetCount()
        .stateIn(viewModelScope, SharingStarted.Eagerly, _workspace.value.sheetsBySystem.size)

    private val _transferBusy = MutableStateFlow(false)
    val transferBusy: StateFlow<Boolean> = _transferBusy.asStateFlow()

    private val _transferFeedback = MutableStateFlow<TransferFeedback?>(null)
    val transferFeedback: StateFlow<TransferFeedback?> = _transferFeedback.asStateFlow()

    init {
        viewModelScope.launch {
            val reconciled = repo.hydrateAndSyncFromRoom()
            _workspace.value = reconciled
            val remoteSynced = repo.syncWithRemoteMirror()
            if (remoteSynced != null) {
                _workspace.value = remoteSynced
            }
        }
    }

    private fun persistWorkspace(nextWs: WorkspaceState) {
        val now = System.currentTimeMillis()
        _workspace.value = nextWs
        repo.saveWorkspace(nextWs, now)
        viewModelScope.launch {
            repo.saveToRoom(nextWs, now)
            repo.pushRemoteMirror(nextWs, now)
        }
    }

    private fun updateActiveSheet(transform: (CharacterSheetState) -> CharacterSheetState) {
        val currentWs = _workspace.value
        val currentSheet = currentWs.sheetsBySystem[currentWs.activeSystemId]
            ?: Presets.createPresetBySystemId(currentWs.activeSystemId)
        val updatedSheet = transform(currentSheet)
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

    fun clearStatusMessage() {
        _statusMessage.value = null
    }

    fun switchSystem(nextSystemId: SystemId) {
        val currentWs = _workspace.value
        val activeId = currentWs.activeSystemId
        val active = currentWs.sheetsBySystem[activeId] ?: Presets.createPresetBySystemId(activeId)
        val preservedMap = currentWs.sheetsBySystem + (activeId to active)
        val targetSheet = preservedMap[nextSystemId] ?: Presets.createPresetBySystemId(nextSystemId)
        val nextWs = WorkspaceState(
            activeSystemId = nextSystemId,
            sheetsBySystem = preservedMap + (nextSystemId to targetSheet)
        )
        persistWorkspace(nextWs)
        _xpFilter.value = null
        _localRuleHits.value = emptyList()
        _localSearchElapsedMs.value = null
        _rulesResult.value = null
        if (_rulesQuery.value.trim().length >= 2) {
            runLocalFts5Search(_rulesQuery.value, nextSystemId)
        }
        if (nextSystemId == SystemId.BLANK && targetSheet.cards.isEmpty()) {
            if (_activeTab.value == TabId.XP) _activeTab.value = TabId.GERAL
            _mode.value = AppMode.EDICAO
        }
        val shortLabel = Presets.SYSTEM_OPTIONS.find { it.id == nextSystemId }?.shortLabel ?: nextSystemId.name
        _statusMessage.value = "SISTEMA ALTERADO: $shortLabel"
    }

    fun resetActiveSystemPreset(systemId: SystemId = _workspace.value.activeSystemId) {
        val preset = Presets.createPresetBySystemId(systemId)
        val currentWs = _workspace.value
        val nextWs = WorkspaceState(
            activeSystemId = systemId,
            sheetsBySystem = currentWs.sheetsBySystem + (systemId to preset)
        )
        persistWorkspace(nextWs)
        _activeTab.value = TabId.GERAL
        _xpFilter.value = null
        _systemModalOpen.value = false
        if (systemId == SystemId.BLANK && preset.cards.isEmpty()) {
            _mode.value = AppMode.EDICAO
        }
        _statusMessage.value = "PRESET CARREGADO: ${preset.systemName}"
    }

    fun createNewBlankSheet() {
        val blank = Presets.createBlankSheet()
        val currentWs = _workspace.value
        val nextWs = WorkspaceState(
            activeSystemId = SystemId.BLANK,
            sheetsBySystem = currentWs.sheetsBySystem + (SystemId.BLANK to blank)
        )
        persistWorkspace(nextWs)
        _activeTab.value = TabId.GERAL
        _mode.value = AppMode.EDICAO
        _statusMessage.value = "FICHA EM BRANCO · CRIE SEUS BLOCOS"
    }

    fun updateNumberField(fieldId: String, value: Double) {
        updateActiveSheet { SheetMutators.updateNumberField(it, fieldId, value) }
    }

    fun updateTextField(fieldId: String, value: String) {
        updateActiveSheet { SheetMutators.updateTextField(it, fieldId, value) }
    }

    fun updateBooleanField(fieldId: String, value: Boolean) {
        updateActiveSheet { SheetMutators.updateBooleanField(it, fieldId, value) }
    }

    fun adjustResource(fieldId: String, delta: Int) {
        updateActiveSheet { SheetMutators.adjustResourceValue(it, fieldId, delta) }
    }

    fun adjustHealthDamage(fieldId: String, damageType: String, delta: Int) {
        updateActiveSheet { SheetMutators.adjustHealthDamage(it, fieldId, damageType, delta) }
    }

    fun setResource(fieldId: String, target: Int) {
        updateActiveSheet { SheetMutators.setResourceValue(it, fieldId, target) }
    }

    fun addRepeatableRow(fieldId: String) {
        val rowId = "row_${UUID.randomUUID().toString().take(8)}"
        updateActiveSheet { SheetMutators.addRepeatableRow(it, fieldId, rowId) }
    }

    fun updateRepeatableRow(fieldId: String, rowId: String, col1: String? = null, col2: String? = null) {
        updateActiveSheet { SheetMutators.updateRepeatableRow(it, fieldId, rowId, col1, col2) }
    }

    fun removeRepeatableRow(fieldId: String, rowId: String) {
        updateActiveSheet { SheetMutators.removeRepeatableRow(it, fieldId, rowId) }
    }

    fun updateFieldSchema(fieldId: String, transform: (SheetField) -> SheetField) {
        updateActiveSheet { SheetMutators.updateFieldSchema(it, fieldId, transform) }
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
        updateActiveSheet { SheetMutators.addCardToSheet(it, newCard) }
        _statusMessage.value = "BLOCO CRIADO: $cleanTitle"
    }

    fun updateCardSchema(cardId: String, transform: (SheetCard) -> SheetCard) {
        updateActiveSheet { SheetMutators.updateCardSchema(it, cardId, transform) }
    }

    fun removeCardFromSheet(cardId: String) {
        updateActiveSheet { SheetMutators.removeCardFromSheet(it, cardId) }
        _statusMessage.value = "BLOCO REMOVIDO"
    }

    fun addFieldToCard(cardId: String, label: String, key: String, kind: FieldKind, formulaOrExpr: String) {
        val cleanKey = key.trim().lowercase().replace(Regex("[^a-z0-9_]+"), "_").trim('_').ifEmpty {
            "campo_${UUID.randomUUID().toString().take(4)}"
        }
        val newField = SheetField(
            id = "f_${UUID.randomUUID().toString().take(8)}",
            key = cleanKey,
            label = label.trim().uppercase().ifEmpty { "NOVO CAMPO" },
            kind = kind,
            numValue = when (kind) {
                FieldKind.NUMBER -> 0.0
                FieldKind.RESOURCE -> 4.0
                else -> null
            },
            textValue = if (kind == FieldKind.TEXT) "" else null,
            boolValue = if (kind == FieldKind.BOOLEAN) false else null,
            max = if (kind == FieldKind.RESOURCE) 6 else null,
            formula = if (kind == FieldKind.CALCULATED) formulaOrExpr.ifBlank { "0" } else null,
            showPlus = if (kind == FieldKind.CALCULATED) true else null,
            rollLabel = if (kind == FieldKind.ROLL) label.trim().uppercase().ifEmpty { "ROLAR TESTE" } else null,
            rollExpr = if (kind == FieldKind.ROLL) formulaOrExpr.ifBlank { "2d6" } else null,
            columns = if (kind == FieldKind.REPEATABLE) listOf("ITEM", "VALOR") else null,
            col2Type = if (kind == FieldKind.REPEATABLE) "text" else null,
            rows = if (kind == FieldKind.REPEATABLE) emptyList() else null
        )
        updateActiveSheet { SheetMutators.addFieldToCard(it, cardId, newField) }
        _statusMessage.value = "CAMPO ADICIONADO: ${newField.label}"
    }

    fun removeFieldFromCard(cardId: String, fieldId: String) {
        updateActiveSheet { SheetMutators.removeFieldFromCard(it, cardId, fieldId) }
    }

    fun rollExpression(label: String, expression: String) {
        val res = FormulaEngine.rollDiceExpression(expression, evaluation.value.variables)
        if (!res.ok) {
            _statusMessage.value = "ERRO NA ROLAGEM: ${res.error ?: "Fórmula inválida"}"
            return
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
        updateActiveSheet { it.copy(rollLogs = (listOf(entry) + it.rollLogs).take(30)) }
        _sideSheetMode.value = SideSheetMode.LOGS
        _sideSheetOpen.value = true
    }

    fun clearRollLogs() {
        updateActiveSheet { it.copy(rollLogs = emptyList()) }
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
            _statusMessage.value = res.error
            return
        }
        updateActiveSheet { res.sheet }
        _statusMessage.value = if (delta > 0) "+$delta XP ADICIONADO" else "$delta XP AJUSTADO"
    }

    fun upgradeTrait(fieldId: String) {
        val res = XpSystem.upgradeTraitWithXp(
            sheet = activeSheet.value,
            fieldId = fieldId,
            timestamp = currentTimeStamp(),
            entryId = "xp_${UUID.randomUUID().toString().take(8)}"
        )
        if (!res.ok) {
            _statusMessage.value = res.error
            return
        }
        updateActiveSheet { res.sheet }
        res.trait?.let {
            _statusMessage.value = "UPGRADE: ${it.label} ${it.currentValue} → ${it.nextValue} (-${it.cost} XP)"
        }
    }

    fun undoLastUpgrade() {
        val res = XpSystem.undoLastUpgrade(activeSheet.value)
        if (!res.ok) {
            _statusMessage.value = res.error
            return
        }
        updateActiveSheet { res.sheet }
        _statusMessage.value = "DESFEITO: ${res.revertedLabel}"
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
        val snapshot = _workspace.value
        val active = activeSheet.value
        val activeId = active.id
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
                        liveSheets = snapshot.sheetsBySystem.values + active
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
        val base = _workspace.value
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
                _workspace.value = result.workspace
                _activeTab.value = TabId.GERAL
                _xpFilter.value = null
                viewModelScope.launch {
                    repo.pushRemoteMirror(result.workspace, System.currentTimeMillis())
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
        _statusMessage.value = message
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
            _statusMessage.value = "JSON inválido para importação."
            return false
        }
        val sysId = Presets.detectSystemId(parsed)
        val tagged = parsed.copy(systemId = sysId)
        val currentWs = _workspace.value
        val nextWs = WorkspaceState(
            activeSystemId = sysId,
            sheetsBySystem = currentWs.sheetsBySystem + (sysId to tagged)
        )
        persistWorkspace(nextWs)
        _systemModalOpen.value = false
        _statusMessage.value = "FICHA IMPORTADA: ${tagged.characterName}"
        return true
    }

    fun updateRulesQuery(rawQuery: String) {
        _rulesQuery.value = rawQuery
        runLocalFts5Search(rawQuery, _workspace.value.activeSystemId)
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

    fun importPdfRulebook(uri: Uri, targetSystemId: SystemId = _workspace.value.activeSystemId) {
        indexingJob?.cancel()
        _scannedPdfAlert.value = null
        indexingJob = viewModelScope.launch {
            repo.indexPdfRulebook(uri, targetSystemId).collect { progress ->
                when (progress) {
                    is IndexProgress.Extracting,
                    is IndexProgress.Persisting -> {
                        _indexProgress.value = progress
                    }
                    is IndexProgress.Completed -> {
                        _indexProgress.value = null
                        _scannedPdfAlert.value = null
                        _statusMessage.value =
                            "PDF INDEXADO: ${progress.book.title} (${progress.indexedPagesCount} PÁGS)"
                        if (_rulesQuery.value.trim().length >= 2) {
                            runLocalFts5Search(_rulesQuery.value, _workspace.value.activeSystemId)
                        }
                    }
                    is IndexProgress.ScannedNoOcr -> {
                        _indexProgress.value = null
                        _scannedPdfAlert.value = progress
                        _statusMessage.value = "PDF ESCANEADO (SEM OCR): ${progress.bookTitle}"
                    }
                    is IndexProgress.Error -> {
                        _indexProgress.value = progress
                        _statusMessage.value = "ERRO PDF: ${progress.message}"
                    }
                }
            }
        }
    }

    fun dismissScannedPdfAlert() {
        _scannedPdfAlert.value = null
    }

    fun dismissIndexError() {
        if (_indexProgress.value is IndexProgress.Error) {
            _indexProgress.value = null
        }
        _scannedPdfAlert.value = null
    }

    fun deleteIndexedBook(bookId: String) {
        viewModelScope.launch {
            runCatching { repo.deleteIndexedBook(bookId) }
                .onSuccess {
                    _statusMessage.value = "MANUAL REMOVIDO DO ÍNDICE"
                    if (_rulesQuery.value.trim().length >= 2) {
                        runLocalFts5Search(_rulesQuery.value, _workspace.value.activeSystemId)
                    }
                }
                .onFailure { err ->
                    _statusMessage.value = "FALHA AO REMOVER PDF: ${err.message ?: "erro"}"
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
            val activeSys = _workspace.value.activeSystemId
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
