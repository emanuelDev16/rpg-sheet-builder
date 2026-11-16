package com.gridsheet.app.ui

import android.content.ActivityNotFoundException
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.gridsheet.app.core.AppMode
import com.gridsheet.app.core.PresetSummary
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetMetadata
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.ui.components.ActiveSessionHeroCard
import com.gridsheet.app.ui.components.BentoCardView
import com.gridsheet.app.ui.components.BrutalistSectionHeader
import com.gridsheet.app.ui.components.BrutalistTagBadge
import com.gridsheet.app.ui.components.CharacterLibraryCard
import com.gridsheet.app.ui.components.CreateCharacterDialog
import com.gridsheet.app.ui.components.CustomCardBuilderView
import com.gridsheet.app.ui.components.CyberGridBackground
import com.gridsheet.app.ui.components.DashedCustomSheetCard
import com.gridsheet.app.ui.components.DeleteCharacterConfirmDialog
import com.gridsheet.app.ui.components.PortabilityAndRulesCard
import com.gridsheet.app.ui.components.PresetSystemCard
import com.gridsheet.app.ui.components.RollAndRulesBottomSheet
import com.gridsheet.app.ui.components.XpUpgradeWorkspace
import com.gridsheet.app.ui.theme.CyberDimens
import com.gridsheet.app.ui.theme.GridThemeMode
import com.gridsheet.app.ui.theme.LocalGridTheme
import com.gridsheet.app.ui.theme.brutalistShadow

@Composable
fun GridSheetApp(vm: SheetViewModel = viewModel()) {
    val uiState by vm.uiState.collectAsState()
    val workspace by vm.workspace.collectAsState()
    val sheet by vm.activeSheet.collectAsState()
    val evaluation by vm.evaluation.collectAsState()
    val activeTab by vm.activeTab.collectAsState()
    val mode by vm.mode.collectAsState()
    val statusMessage by vm.statusMessage.collectAsState()
    val xpFilter by vm.xpFilter.collectAsState()
    val sideSheetOpen by vm.sideSheetOpen.collectAsState()
    val sideSheetMode by vm.sideSheetMode.collectAsState()
    val systemModalOpen by vm.systemModalOpen.collectAsState()
    val rulesLoading by vm.rulesLoading.collectAsState()
    val rulesResult by vm.rulesResult.collectAsState()
    val rulesQuery by vm.rulesQuery.collectAsState()
    val indexedBooks by vm.indexedBooks.collectAsState()
    val indexProgress by vm.indexProgress.collectAsState()
    val scannedPdfAlert by vm.scannedPdfAlert.collectAsState()
    val localRuleHits by vm.localRuleHits.collectAsState()
    val localSearchElapsedMs by vm.localSearchElapsedMs.collectAsState()
    val themeMode by vm.themeMode.collectAsState()
    val theme = LocalGridTheme.current

    val pdfPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            vm.importPdfRulebook(uri)
        }
    }
    val transferBusy by vm.transferBusy.collectAsState()
    val transferFeedback by vm.transferFeedback.collectAsState()
    var overwriteOnImport by rememberSaveable { mutableStateOf(false) }

    // Storage Access Framework launchers: no WRITE/READ_EXTERNAL_STORAGE permission required.
    // Registered at the root so results survive the modal being recomposed or dismissed.
    val exportSheetLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri -> if (uri != null) vm.exportToUri(uri, fullBackup = false) }
    val exportBackupLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri -> if (uri != null) vm.exportToUri(uri, fullBackup = true) }
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> if (uri != null) vm.importFromUri(uri, overwriteOnImport) }

    val availableXp = XpSystem.getAvailableXp(sheet.xp)
    val activeSystemId = workspace.activeSystemId
    val visibleCards = remember(sheet.cards, activeTab) {
        sheet.cards.filter { it.tab == activeTab }
    }

    BackHandler(
        enabled = uiState.activeScreen == ActiveScreen.SHEET && !sideSheetOpen && !systemModalOpen
    ) {
        vm.navigateToHome()
    }

    CyberGridBackground(
        modifier = Modifier.fillMaxSize()
    ) {
        if (uiState.activeScreen == ActiveScreen.HOME) {
            HomeScreen(
                uiState = uiState,
                themeMode = themeMode,
                onSelectTheme = vm::setThemeMode,
                transferBusy = transferBusy,
                transferFeedback = transferFeedback,
                overwriteOnImport = overwriteOnImport,
                onOverwriteChange = { overwriteOnImport = it },
                onContinueSheet = { sheetId -> vm.navigateToSheet(sheetId) },
                onOpenSheet = { sheetId -> vm.navigateToSheet(sheetId) },
                onCreateNewSheet = { systemId, customName ->
                    vm.createNewSheetFromHome(systemId, customName)
                },
                onDuplicateSheet = vm::duplicateSheet,
                onDeleteSheet = vm::deleteSheet,
                onSearchQueryChange = vm::setHomeSearchQuery,
                onSystemFilterSelect = vm::setHomeSystemFilter,
                onExportBackup = {
                    vm.clearTransferFeedback()
                    launchSafely(vm) { exportBackupLauncher.launch(vm.suggestedBackupFileName()) }
                },
                onImportJson = {
                    vm.clearTransferFeedback()
                    launchSafely(vm) { importLauncher.launch(arrayOf("application/json", "text/plain")) }
                },
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
            )
        } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            // Top Technical Header Bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = theme.bgCard,
                border = BorderStroke(theme.borderWidth, theme.borderColor)
            ) {
                BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                    val isWideHeader = maxWidth >= 600.dp
                    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
                    Column(
                        modifier = Modifier.padding(horizontal = theme.cardPadding, vertical = theme.cardHeaderPadding),
                        verticalArrangement = Arrangement.spacedBy(theme.fieldGap)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .background(theme.accentBlack, RoundedCornerShape(CyberDimens.SmallRadius))
                                        .padding(horizontal = 7.dp, vertical = 3.dp)
                                ) {
                                    Text("+", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, color = theme.accentContrast, fontSize = 12.sp)
                                }
                                Text(
                                    text = sheet.systemCode,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    color = theme.textPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                if (isWideHeader) {
                                    GridThemeSelector(
                                        activeTheme = themeMode,
                                        onSelectTheme = vm::setThemeMode
                                    )
                                }
                                // MODO JOGO | MODO EDIÇÃO toggle
                                Row(
                                    modifier = Modifier
                                        .clip(pillShape)
                                        .border(theme.borderWidth, theme.borderColor, pillShape)
                                ) {
                                    ModeSegment("JOGO", mode == AppMode.JOGO, theme.accentBlack, theme.accentContrast) {
                                        vm.setMode(AppMode.JOGO)
                                    }
                                    ModeSegment("EDIÇÃO", mode == AppMode.EDICAO, theme.accentPrimary, theme.accentContrast) {
                                        vm.setMode(AppMode.EDICAO)
                                    }
                                }
                            }
                        }

                        if (!isWideHeader) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "// TEMA",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.textSecondary
                                )
                                GridThemeSelector(
                                    activeTheme = themeMode,
                                    onSelectTheme = vm::setThemeMode
                                )
                            }
                        }

                        // System Switcher + Action Buttons
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            TopHomeBtn(onClick = vm::navigateToHome)
                            SystemSwitcherDropdown(
                                activeSystemId = activeSystemId,
                                onSelect = vm::switchSystem
                            )
                            TopOutlineBtn("NOVA") { vm.createNewBlankSheet() }
                            TopOutlineBtn("ABRIR") {
                                vm.clearTransferFeedback()
                                vm.setSystemModalOpen(true)
                            }
                            TopOutlineBtn("ROLAGENS (${sheet.rollLogs.size})") {
                                vm.openSideSheet(SideSheetMode.LOGS)
                            }
                            TopOutlineBtn("REGRAS") {
                                vm.openSideSheet(SideSheetMode.RULES)
                            }
                        }
                    }
                }
            }

            // Tab Navigation + Character Label
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = theme.gridGap, vertical = theme.fieldGap),
                verticalArrangement = Arrangement.spacedBy(theme.fieldGap)
            ) {
                val (tab1Label, tab2Label) = when (activeSystemId) {
                    SystemId.WOD -> "/01 ATTRIBUTES & COMBAT" to "/02 DISCIPLINES & NOTES"
                    SystemId.DND5E -> "/01 ABILITIES & COMBAT" to "/02 SPELLS & NOTES"
                    SystemId.CYBERPUNK -> "/01 STATS & COMBAT" to "/02 NETRUNNING & NOTES"
                    SystemId.BLANK -> "/01 FICHA PRINCIPAL" to "/02 EXTRAS & NOTAS"
                    else -> "/01 GERAL & COMBATE" to "/02 MAGIAS & NOTAS"
                }

                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SheetTabButton(tab1Label, activeTab == TabId.GERAL) { vm.setTab(TabId.GERAL) }
                    SheetTabButton(tab2Label, activeTab == TabId.MAGIAS) { vm.setTab(TabId.MAGIAS) }
                    SheetTabButton("/03 XP & UPGRADES", activeTab == TabId.XP) { vm.setTab(TabId.XP) }
                }

                Text(
                    text = sheet.characterName,
                    fontFamily = theme.titleFontFamily,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textSecondary
                )
            }

            // Main Bento Card Feed
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(start = theme.gridGap, end = theme.gridGap, bottom = theme.gridGap + 6.dp),
                verticalArrangement = Arrangement.spacedBy(theme.gridGap)
            ) {
                if (activeTab == TabId.XP) {
                    item {
                        XpUpgradeWorkspace(
                            sheet = sheet,
                            filter = xpFilter,
                            onFilterChange = vm::setXpFilter,
                            onAwardXp = vm::awardXp,
                            onUpgradeTrait = vm::upgradeTrait,
                            onToggleDisciplineClan = vm::toggleDisciplineClan,
                            onSetCustomMultiplier = vm::setTraitCustomMultiplier,
                            onSelectRulePreset = vm::setXpRulePreset,
                            onToggleCustomBase = vm::setCustomUseNewLevelBase,
                            onBuySpecialty = vm::buySpecialty,
                            onBuyBackground = vm::buyBackground,
                            onUndoLastUpgrade = vm::undoLastUpgrade
                        )
                    }
                } else {
                    items(visibleCards, key = { it.id }) { card ->
                        BentoCardView(
                            card = card,
                            mode = mode,
                            evaluation = evaluation,
                            onUpdateNumber = vm::updateNumberField,
                            onUpdateText = vm::updateTextField,
                            onUpdateBoolean = vm::updateBooleanField,
                            onAdjustResource = vm::adjustResource,
                            onAdjustHealthDamage = vm::adjustHealthDamage,
                            onSetResource = vm::setResource,
                            onRoll = vm::rollExpression,
                            onAddRow = vm::addRepeatableRow,
                            onUpdateRow = vm::updateRepeatableRow,
                            onRemoveRow = vm::removeRepeatableRow,
                            onUpdateSchema = vm::updateFieldSchema,
                            onAddField = vm::addFieldToCard,
                            onMoveField = vm::moveFieldInCard,
                            onCycleRollDifficulty = vm::cycleRollDifficulty,
                            onToggleRollSpecialty = vm::toggleRollSpecialty,
                            onRemoveField = vm::removeFieldFromCard,
                            onRemoveCard = vm::removeCardFromSheet
                        )
                    }
                    if (visibleCards.isEmpty() || mode == AppMode.EDICAO) {
                        item(key = "custom_card_builder") {
                            CustomCardBuilderView(
                                activeTab = activeTab,
                                isEmptySheet = visibleCards.isEmpty(),
                                onCreateCard = { tab, title, code ->
                                    vm.addCardToSheet(tab, title, code)
                                }
                            )
                        }
                    }
                }
            }

            // Bottom Technical Status Bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = theme.bgCard,
                border = BorderStroke(theme.borderWidth, theme.borderColor)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val leftStatus = when {
                        evaluation.formulaErrors.isNotEmpty() -> "// ERROS: ${evaluation.formulaErrors.size}"
                        statusMessage != null -> "// $statusMessage"
                        else -> "// STATUS: PRONTO"
                    }
                    Text(
                        text = leftStatus,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (evaluation.formulaErrors.isNotEmpty()) theme.accentDanger else theme.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Box(
                        modifier = Modifier
                            .background(
                                theme.accentPrimary,
                                RoundedCornerShape(if (theme.isEink) theme.pillCornerRadius else 3.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "> ACCESS GRANTED_",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.accentContrast
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "XP: $availableXp",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.accentPrimary
                    )
                }
            }
        }
        }
    }

    if (uiState.activeScreen == ActiveScreen.SHEET && sideSheetOpen) {
        RollAndRulesBottomSheet(
            mode = sideSheetMode,
            systemId = activeSystemId,
            systemName = sheet.systemName,
            quickDice = vm.getQuickDicePresets(activeSystemId),
            logs = sheet.rollLogs,
            rulesQuery = rulesQuery,
            rulesLoading = rulesLoading,
            rulesResult = rulesResult,
            indexedBooks = indexedBooks,
            indexProgress = indexProgress,
            scannedPdfAlert = scannedPdfAlert,
            localRuleHits = localRuleHits,
            localSearchElapsedMs = localSearchElapsedMs,
            onSwitchMode = { vm.openSideSheet(it) },
            onRollExpression = vm::rollExpression,
            onClearLogs = vm::clearRollLogs,
            onRulesQueryChange = vm::updateRulesQuery,
            onSearchRules = { q, forceOnline -> vm.searchRules(q, forceOnline) },
            onPickPdf = { pdfPickerLauncher.launch(arrayOf("application/pdf")) },
            onDeleteBook = vm::deleteIndexedBook,
            onStartOcr = vm::startOcrIndexing,
            onCancelIndexing = vm::cancelIndexing,
            onDismissScannedPdfAlert = vm::dismissScannedPdfAlert,
            onDismissIndexError = vm::dismissIndexError,
            onDismiss = vm::closeSideSheet
        )
    }

    if (uiState.activeScreen == ActiveScreen.SHEET && systemModalOpen) {
        SystemPresetAndJsonDialog(
            activeSystemId = activeSystemId,
            exportedJson = vm.exportCurrentJson(),
            transferBusy = transferBusy,
            transferFeedback = transferFeedback,
            overwriteExisting = overwriteOnImport,
            onOverwriteChange = { overwriteOnImport = it },
            onExportSheet = {
                launchSafely(vm) { exportSheetLauncher.launch(vm.suggestedSheetFileName()) }
            },
            onExportBackup = {
                launchSafely(vm) { exportBackupLauncher.launch(vm.suggestedBackupFileName()) }
            },
            onImportFile = {
                launchSafely(vm) { importLauncher.launch(arrayOf("application/json", "text/plain")) }
            },
            onLoadPreset = vm::resetActiveSystemPreset,
            onImportJson = vm::importJson,
            onDismiss = { vm.setSystemModalOpen(false) }
        )
    }
}

private inline fun launchSafely(vm: SheetViewModel, block: () -> Unit) {
    try {
        block()
    } catch (_: ActivityNotFoundException) {
        vm.reportPickerUnavailable()
    }
}

@Composable
private fun GridThemeSelector(
    activeTheme: GridThemeMode,
    onSelectTheme: (GridThemeMode) -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    Row(
        modifier = modifier
            .height(IntrinsicSize.Min)
            .clip(pillShape)
            .background(theme.bgCard)
            .border(theme.borderWidth, theme.borderColor, pillShape),
        verticalAlignment = Alignment.CenterVertically
    ) {
        GridThemeMode.entries.forEachIndexed { index, option ->
            if (index > 0) {
                Box(
                    modifier = Modifier
                        .width(theme.borderWidth)
                        .fillMaxHeight()
                        .background(theme.borderColor)
                )
            }
            val isSelected = activeTheme == option
            Box(
                modifier = Modifier
                    .defaultMinSize(
                        minWidth = CyberDimens.MinTouchTarget,
                        minHeight = CyberDimens.MinTouchTarget
                    )
                    .background(if (isSelected) theme.accentPrimary else theme.bgCard)
                    .semantics { selected = isSelected }
                    .clickable(role = Role.RadioButton) { onSelectTheme(option) }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = option.label,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = if (isSelected) theme.accentContrast else theme.textPrimary,
                    maxLines = 1
                )
            }
        }
    }
}

@Composable
private fun SystemSwitcherDropdown(
    activeSystemId: SystemId,
    onSelect: (SystemId) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val activeOption = Presets.SYSTEM_OPTIONS.find { it.id == activeSystemId }
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)

    Box {
        Surface(
            modifier = Modifier.clickable { expanded = true },
            shape = pillShape,
            color = theme.bgCardAlt,
            border = BorderStroke(theme.borderWidth, theme.borderColor)
        ) {
            Text(
                text = "SYS: ${activeOption?.shortLabel ?: "WOD"} ▾",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = theme.textPrimary,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(theme.bgCard)
        ) {
            Presets.SYSTEM_OPTIONS.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = option.shortLabel,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            fontWeight = if (option.id == activeSystemId) FontWeight.Black else FontWeight.Medium,
                            color = if (option.id == activeSystemId) theme.accentPrimary else theme.textPrimary
                        )
                    },
                    onClick = {
                        expanded = false
                        onSelect(option.id)
                    }
                )
            }
        }
    }
}

@Composable
private fun HomeScreen(
    uiState: UiState,
    themeMode: GridThemeMode,
    onSelectTheme: (GridThemeMode) -> Unit,
    transferBusy: Boolean,
    transferFeedback: TransferFeedback?,
    overwriteOnImport: Boolean,
    onOverwriteChange: (Boolean) -> Unit,
    onContinueSheet: (String) -> Unit,
    onOpenSheet: (String) -> Unit,
    onCreateNewSheet: (String, String?) -> Unit,
    onDuplicateSheet: (String) -> Unit,
    onDeleteSheet: (String) -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onSystemFilterSelect: (SystemId?) -> Unit,
    onExportBackup: () -> Unit,
    onImportJson: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val latestSheet = uiState.sheets.firstOrNull()
    val systemPresets = remember(uiState.presets) {
        uiState.presets.filter { it.systemId != SystemId.BLANK }
    }
    val blankPreset = remember(uiState.presets) {
        uiState.presets.find { it.systemId == SystemId.BLANK } ?: PresetSummary(
            systemId = SystemId.BLANK,
            systemName = "CUSTOM BLANK",
            systemCode = "CUSTOM // BLANK",
            shortLabel = "CUSTOM",
            description = "Canvas em branco com criação livre de cards, status e fórmulas.",
            cardCount = 0,
            fieldCount = 0,
            fromAsset = false
        )
    }
    val activeSystems = remember(uiState.sheets) {
        val presentIds = uiState.sheets.map { it.systemId }.toSet()
        Presets.SYSTEM_OPTIONS.filter { it.id in presentIds }
    }

    var creationTarget by remember { mutableStateOf<PresetSummary?>(null) }
    var deletionTarget by remember { mutableStateOf<SheetMetadata?>(null) }

    BoxWithConstraints(modifier = modifier) {
        val columns = if (maxWidth >= 600.dp) 2 else 1

        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(theme.gridGap),
            horizontalArrangement = Arrangement.spacedBy(theme.gridGap),
            verticalArrangement = Arrangement.spacedBy(theme.gridGap)
        ) {
            item(span = { GridItemSpan(columns) }, key = "home_masthead") {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
                    shape = cardShape,
                    color = theme.bgCard,
                    border = BorderStroke(theme.borderStrong, theme.borderColor),
                    shadowElevation = 0.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = theme.cardPadding, vertical = theme.cardHeaderPadding),
                        verticalArrangement = Arrangement.spacedBy(theme.fieldGap)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .background(theme.accentBlack, RoundedCornerShape(CyberDimens.SmallRadius))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "+",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Black,
                                        color = theme.accentContrast,
                                        fontSize = 14.sp
                                    )
                                }
                                Column {
                                    Text(
                                        text = "GRIDSHEET // TERMINAL",
                                        fontFamily = theme.titleFontFamily,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 15.sp,
                                        color = theme.textPrimary
                                    )
                                    Text(
                                        text = if (uiState.isLoading) "SINCRONIZANDO ROOM..." else "ARMÁRIO DE FICHAS & REGRAS OFFLINE",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.textMuted
                                    )
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                BrutalistTagBadge(
                                    text = "${uiState.sheets.size} FICHAS",
                                    containerColor = theme.bgStrip,
                                    contentColor = theme.textPrimary
                                )
                                BrutalistTagBadge(
                                    text = "PDF: ${uiState.indexedBooksCount}",
                                    containerColor = if (uiState.indexedBooksCount > 0) theme.accentWineSoft else theme.bgCardAlt,
                                    contentColor = if (uiState.indexedBooksCount > 0) theme.accentPrimary else theme.textSecondary
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "// TEMA VISUAL",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.textSecondary
                            )
                            GridThemeSelector(
                                activeTheme = themeMode,
                                onSelectTheme = onSelectTheme
                            )
                        }
                    }
                }
            }

            // Bloco 1: // SESSÃO_ATIVA (Hero Card)
            item(span = { GridItemSpan(columns) }, key = "home_active_session") {
                ActiveSessionHeroCard(
                    latestSheet = latestSheet,
                    onContinue = onContinueSheet,
                    onDuplicate = onDuplicateSheet
                )
            }

            // Bloco 2: // NOVO_PERSONAGEM
            item(span = { GridItemSpan(columns) }, key = "home_new_header") {
                BrutalistSectionHeader(
                    code = "// NOVO_PERSONAGEM",
                    title = "Instanciar ficha zerada",
                    trailingBadge = "${systemPresets.size + 1} MODELOS"
                )
            }

            gridItems(
                items = systemPresets,
                key = { "preset_${it.systemId.name}" }
            ) { preset ->
                PresetSystemCard(
                    preset = preset,
                    onClick = { creationTarget = preset }
                )
            }

            item(key = "preset_custom_blank") {
                DashedCustomSheetCard(
                    onClick = { creationTarget = blankPreset }
                )
            }

            // Bloco 3: // MEUS_PERSONAGENS
            item(span = { GridItemSpan(columns) }, key = "home_library_header") {
                BrutalistSectionHeader(
                    code = "// MEUS_PERSONAGENS",
                    title = "Personagens salvos no Room",
                    trailingBadge = "${uiState.filteredSheets.size}/${uiState.sheets.size}"
                )
            }

            item(span = { GridItemSpan(columns) }, key = "home_library_filters") {
                Column(verticalArrangement = Arrangement.spacedBy(theme.fieldGap)) {
                    OutlinedTextField(
                        value = uiState.searchQuery,
                        onValueChange = onSearchQueryChange,
                        singleLine = true,
                        label = {
                            Text(
                                text = "BUSCAR PERSONAGEM POR NOME",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp
                            )
                        },
                        placeholder = {
                            Text(
                                text = "EX: JULIAN, LYRA...",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Buscar",
                                tint = theme.textPrimary
                            )
                        },
                        trailingIcon = {
                            if (uiState.searchQuery.isNotEmpty()) {
                                IconButton(onClick = { onSearchQueryChange("") }) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Limpar busca",
                                        tint = theme.textPrimary
                                    )
                                }
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = theme.bgCard,
                            unfocusedContainerColor = theme.bgCard,
                            focusedTextColor = theme.textPrimary,
                            unfocusedTextColor = theme.textPrimary,
                            focusedBorderColor = theme.accentPrimary,
                            unfocusedBorderColor = theme.borderColor,
                            focusedLabelColor = theme.accentPrimary,
                            unfocusedLabelColor = theme.textSecondary,
                            cursorColor = theme.accentPrimary
                        ),
                        shape = pillShape,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HomeFilterChip(
                            label = "TODOS (${uiState.sheets.size})",
                            selected = uiState.selectedSystemFilter == null,
                            onClick = { onSystemFilterSelect(null) }
                        )
                        activeSystems.forEach { opt ->
                            val countForSystem = uiState.sheets.count { it.systemId == opt.id }
                            HomeFilterChip(
                                label = "${opt.shortLabel} ($countForSystem)",
                                selected = uiState.selectedSystemFilter == opt.id,
                                onClick = {
                                    val next = if (uiState.selectedSystemFilter == opt.id) null else opt.id
                                    onSystemFilterSelect(next)
                                }
                            )
                        }
                    }
                }
            }

            if (uiState.filteredSheets.isEmpty()) {
                item(span = { GridItemSpan(columns) }, key = "home_library_empty") {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.bgCardAlt,
                        border = BorderStroke(theme.borderWidth, theme.borderColor)
                    ) {
                        Column(
                            modifier = Modifier.padding(theme.cardPadding),
                            verticalArrangement = Arrangement.spacedBy(theme.fieldGap)
                        ) {
                            Text(
                                text = if (uiState.sheets.isEmpty()) {
                                    "// BIBLIOTECA VAZIA"
                                } else {
                                    "// NENHUM RESULTADO PARA O FILTRO"
                                },
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp,
                                color = theme.accentPrimary
                            )
                            Text(
                                text = if (uiState.sheets.isEmpty()) {
                                    "Crie seu primeiro personagem em // NOVO_PERSONAGEM acima ou importe um arquivo .JSON."
                                } else {
                                    "Nenhuma ficha corresponde à busca \"${uiState.searchQuery}\" e sistema selecionado."
                                },
                                fontFamily = theme.bodyFontFamily,
                                fontSize = 12.sp,
                                color = theme.textSecondary
                            )
                        }
                    }
                }
            } else {
                gridItems(
                    items = uiState.filteredSheets,
                    key = { "sheet_${it.id}" }
                ) { item ->
                    CharacterLibraryCard(
                        sheet = item,
                        isLatest = latestSheet?.id == item.id,
                        onOpen = { onOpenSheet(item.id) },
                        onDuplicate = { onDuplicateSheet(item.id) },
                        onDeleteRequest = { deletionTarget = item }
                    )
                }
            }

            // Bloco 4: // PORTABILIDADE_&_REGRAS
            item(span = { GridItemSpan(columns) }, key = "home_portability_header") {
                BrutalistSectionHeader(
                    code = "// PORTABILIDADE_&_REGRAS",
                    title = "Backup JSON Schema V2 & Grimório",
                    trailingBadge = "PDF INDEXADOS: ${uiState.indexedBooksCount}"
                )
            }

            item(span = { GridItemSpan(columns) }, key = "home_portability_card") {
                PortabilityAndRulesCard(
                    indexedBooksCount = uiState.indexedBooksCount,
                    sheetCount = uiState.sheets.size,
                    transferBusy = transferBusy,
                    transferFeedbackMessage = transferFeedback?.message,
                    transferFeedbackIsError = transferFeedback?.success == false,
                    overwriteExisting = overwriteOnImport,
                    onOverwriteChange = onOverwriteChange,
                    onExportBackup = onExportBackup,
                    onImportJson = onImportJson
                )
            }

            item(span = { GridItemSpan(columns) }, key = "home_bottom_spacer") {
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }

    creationTarget?.let { target ->
        CreateCharacterDialog(
            systemLabel = target.shortLabel,
            systemCode = target.systemCode,
            description = target.description,
            isCustomBlank = target.systemId == SystemId.BLANK,
            onDismiss = { creationTarget = null },
            onConfirm = { customName ->
                creationTarget = null
                onCreateNewSheet(target.systemId.name, customName)
            }
        )
    }

    deletionTarget?.let { target ->
        DeleteCharacterConfirmDialog(
            sheet = target,
            onDismiss = { deletionTarget = null },
            onConfirm = {
                deletionTarget = null
                onDeleteSheet(target.id)
            }
        )
    }
}

@Composable
private fun HomeFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val theme = LocalGridTheme.current
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Text(
                text = label,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black
            )
        },
        shape = RoundedCornerShape(theme.pillCornerRadius),
        colors = FilterChipDefaults.filterChipColors(
            containerColor = theme.bgCard,
            labelColor = theme.textPrimary,
            selectedContainerColor = theme.accentPrimary,
            selectedLabelColor = theme.accentContrast
        ),
        border = FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = selected,
            borderColor = theme.borderColor,
            selectedBorderColor = theme.borderColor,
            borderWidth = theme.borderWidth,
            selectedBorderWidth = theme.borderStrong
        ),
        modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
    )
}

@Composable
private fun TopHomeBtn(onClick: () -> Unit) {
    val theme = LocalGridTheme.current
    Surface(
        modifier = Modifier
            .defaultMinSize(minWidth = CyberDimens.MinTouchTarget, minHeight = CyberDimens.MinTouchTarget)
            .clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(theme.pillCornerRadius),
        color = theme.bgStrip,
        border = BorderStroke(theme.borderStrong, theme.borderColor)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
        ) {
            Text(
                text = "// INÍCIO",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = theme.accentPrimary
            )
        }
    }
}

@Composable
private fun TopOutlineBtn(label: String, onClick: () -> Unit) {
    val theme = LocalGridTheme.current
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(theme.pillCornerRadius),
        color = theme.bgCard,
        border = BorderStroke(theme.borderWidth, theme.borderColor)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = theme.textPrimary,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
        )
    }
}

@Composable
private fun ModeSegment(
    label: String,
    active: Boolean,
    activeBg: Color,
    activeInk: Color,
    onClick: () -> Unit
) {
    val theme = LocalGridTheme.current
    Box(
        modifier = Modifier
            .background(if (active) activeBg else theme.bgCard)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = if (active) activeInk else theme.textPrimary
        )
    }
}

@Composable
private fun SheetTabButton(label: String, selected: Boolean, onClick: () -> Unit) {
    val theme = LocalGridTheme.current
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(theme.pillCornerRadius),
        color = if (selected) theme.accentPrimary else theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.borderColor)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) theme.accentContrast else theme.textPrimary,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

@Composable
private fun SystemPresetAndJsonDialog(
    activeSystemId: SystemId,
    exportedJson: String,
    transferBusy: Boolean,
    transferFeedback: TransferFeedback?,
    overwriteExisting: Boolean,
    onOverwriteChange: (Boolean) -> Unit,
    onExportSheet: () -> Unit,
    onExportBackup: () -> Unit,
    onImportFile: () -> Unit,
    onLoadPreset: (SystemId) -> Unit,
    onImportJson: (String) -> Boolean,
    onDismiss: () -> Unit
) {
    var jsonInput by remember { mutableStateOf(exportedJson) }
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = theme.bgCard,
        shape = cardShape,
        title = {
            Text(
                text = "SISTEMAS & JSON",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = theme.textPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Presets.SYSTEM_OPTIONS.forEach { preset ->
                    val isCurrent = preset.id == activeSystemId
                    val rowBg = when {
                        isCurrent && theme.isEink -> theme.accentPrimary
                        isCurrent -> theme.accentWineSoft
                        else -> theme.bgCardAlt
                    }
                    val rowTitleColor = if (isCurrent && theme.isEink) theme.accentContrast else theme.textPrimary
                    val rowDescColor = if (isCurrent && theme.isEink) theme.accentContrast else theme.textMuted
                    val rowActionColor = if (isCurrent && theme.isEink) theme.accentContrast else theme.accentPrimary

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(rowBg, pillShape)
                            .border(theme.borderWidth, theme.borderColor, pillShape)
                            .clickable { onLoadPreset(preset.id) }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                preset.shortLabel,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = rowTitleColor
                            )
                            Text(preset.description, fontSize = 10.sp, color = rowDescColor)
                        }
                        Text(
                            text = if (isCurrent) "REINICIAR ↗" else "CARREGAR ↗",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = rowActionColor
                        )
                    }
                }
                OutlinedTextField(
                    value = jsonInput,
                    onValueChange = { jsonInput = it },
                    label = { Text("JSON DA FICHA (EXPORTAR / IMPORTAR)", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                    maxLines = 4,
                    shape = pillShape,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = theme.bgInput,
                        unfocusedContainerColor = theme.bgInput,
                        focusedTextColor = theme.textPrimary,
                        unfocusedTextColor = theme.textPrimary,
                        focusedBorderColor = theme.accentPrimary,
                        unfocusedBorderColor = theme.borderColor,
                        focusedLabelColor = theme.accentPrimary,
                        unfocusedLabelColor = theme.textSecondary,
                        cursorColor = theme.accentPrimary
                    )
                )

                SheetFileTransferSection(
                    busy = transferBusy,
                    feedback = transferFeedback,
                    overwriteExisting = overwriteExisting,
                    onOverwriteChange = onOverwriteChange,
                    onExportSheet = onExportSheet,
                    onExportBackup = onExportBackup,
                    onImportFile = onImportFile
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onImportJson(jsonInput) },
                shape = pillShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = theme.accentBlack,
                    contentColor = theme.accentContrast
                )
            ) {
                Text("IMPORTAR JSON", fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("FECHAR", fontFamily = FontFamily.Monospace, color = theme.textMuted)
            }
        }
    )
}


/** SAF export/import controls (Light Cyber Brutalism, 48dp minimum touch targets). */
@Composable
private fun SheetFileTransferSection(
    busy: Boolean,
    feedback: TransferFeedback?,
    overwriteExisting: Boolean,
    onOverwriteChange: (Boolean) -> Unit,
    onExportSheet: () -> Unit,
    onExportBackup: () -> Unit,
    onImportFile: () -> Unit
) {
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(theme.bgCardAlt, cardShape)
            .border(theme.borderStrong, theme.borderColor, cardShape)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = if (busy) "// ARQUIVOS .JSON · PROCESSANDO_" else "// ARQUIVOS .JSON · SCHEMA V2",
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 10.sp,
            color = theme.accentPrimary
        )
        BrutalistActionButton("EXPORTAR FICHA (.JSON)", primary = true, enabled = !busy, onClick = onExportSheet)
        BrutalistActionButton("BACKUP COMPLETO (.JSON)", primary = true, enabled = !busy, onClick = onExportBackup)
        BrutalistActionButton("IMPORTAR FICHA / BACKUP (.JSON)", primary = false, enabled = !busy, onClick = onImportFile)

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .toggleable(
                    value = overwriteExisting,
                    enabled = !busy,
                    role = Role.Checkbox,
                    onValueChange = onOverwriteChange
                ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Checkbox(
                checked = overwriteExisting,
                onCheckedChange = null,
                enabled = !busy,
                colors = CheckboxDefaults.colors(
                    checkedColor = theme.accentPrimary,
                    uncheckedColor = theme.borderColor,
                    checkmarkColor = theme.accentContrast
                )
            )
            Text(
                text = "SOBRESCREVER FICHAS COM MESMO ID (SENÃO CRIA \"(CÓPIA)\")",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = theme.textPrimary
            )
        }

        if (feedback != null) {
            val accent = if (feedback.success) theme.accentPrimary else theme.accentDanger
            val soft = if (feedback.success) theme.accentWineSoft else theme.accentDangerSoft
            Text(
                text = (if (feedback.success) "> OK_ " else "> ERRO_ ") + feedback.message,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = accent,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(soft, RoundedCornerShape(CyberDimens.SmallRadius))
                    .border(theme.borderWidth, accent, RoundedCornerShape(CyberDimens.SmallRadius))
                    .padding(horizontal = 8.dp, vertical = 6.dp)
            )
        }
    }
}

@Composable
private fun BrutalistActionButton(
    label: String,
    primary: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.pillCornerRadius)
    val bg = when {
        !enabled -> theme.bgHover
        primary -> theme.accentBlack
        else -> theme.bgCard
    }
    val ink = when {
        !enabled -> theme.textMuted
        primary -> theme.accentContrast
        else -> theme.textPrimary
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .background(bg, shape)
            .border(theme.borderStrong, theme.borderColor, shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = ink
        )
    }
}
