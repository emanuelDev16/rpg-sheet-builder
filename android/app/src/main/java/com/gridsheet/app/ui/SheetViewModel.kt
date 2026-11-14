package com.gridsheet.app.ui

import android.app.Application
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
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.data.RulesSearchResponse
import com.gridsheet.app.data.WorkspaceRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

enum class SideSheetMode {
    LOGS,
    RULES
}

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

    val offlineSheetCount: StateFlow<Int> = repo.observeOfflineSheetCount()
        .stateIn(viewModelScope, SharingStarted.Eagerly, _workspace.value.sheetsBySystem.size)

    init {
        viewModelScope.launch {
            val reconciled = repo.hydrateAndSyncFromRoom()
            _workspace.value = reconciled
        }
    }

    private fun persistWorkspace(nextWs: WorkspaceState) {
        val now = System.currentTimeMillis()
        _workspace.value = nextWs
        repo.saveWorkspace(nextWs, now)
        viewModelScope.launch {
            repo.saveToRoom(nextWs, now)
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

    fun searchRules(query: String) {
        val trimmed = query.trim()
        if (trimmed.length < 2) {
            _rulesResult.value = RulesSearchResponse(
                ok = false,
                query = trimmed,
                error = "Digite pelo menos 2 caracteres para pesquisar uma regra."
            )
            return
        }
        viewModelScope.launch {
            _rulesLoading.value = true
            _rulesResult.value = repo.searchRules(trimmed, activeSheet.value.systemName)
            _rulesLoading.value = false
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
