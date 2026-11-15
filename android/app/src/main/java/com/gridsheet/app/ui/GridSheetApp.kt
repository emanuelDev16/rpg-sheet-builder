package com.gridsheet.app.ui

import android.content.ActivityNotFoundException
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.gridsheet.app.core.AppMode
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.ui.components.BentoCardView
import com.gridsheet.app.ui.components.CustomCardBuilderView
import com.gridsheet.app.ui.components.CyberGridBackground
import com.gridsheet.app.ui.components.RollAndRulesBottomSheet
import com.gridsheet.app.ui.components.XpUpgradeWorkspace
import com.gridsheet.app.ui.theme.CyberColors
import com.gridsheet.app.ui.theme.CyberDimens

@Composable
fun GridSheetApp(vm: SheetViewModel = viewModel()) {
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

    CyberGridBackground(
        modifier = Modifier.windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Technical Header Bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = CyberColors.BgCard,
                border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
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
                                    .background(CyberColors.AccentBlack, RoundedCornerShape(4.dp))
                                    .padding(horizontal = 7.dp, vertical = 3.dp)
                            ) {
                                Text("+", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, color = CyberColors.InkInverse, fontSize = 12.sp)
                            }
                            Text(
                                text = sheet.systemCode,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = CyberColors.InkPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        // MODO JOGO | MODO EDIÇÃO toggle
                        Row(
                            modifier = Modifier
                                .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                        ) {
                            ModeSegment("JOGO", mode == AppMode.JOGO, CyberColors.AccentBlack, CyberColors.InkInverse) {
                                vm.setMode(AppMode.JOGO)
                            }
                            ModeSegment("EDIÇÃO", mode == AppMode.EDICAO, CyberColors.AccentWine, CyberColors.InkInverse) {
                                vm.setMode(AppMode.EDICAO)
                            }
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

            // Tab Navigation + Character Label
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
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
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberColors.InkSecondary
                )
            }

            // Main Bento Card Feed
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (activeTab == TabId.XP) {
                    item {
                        XpUpgradeWorkspace(
                            sheet = sheet,
                            filter = xpFilter,
                            onFilterChange = vm::setXpFilter,
                            onAwardXp = vm::awardXp,
                            onUpgradeTrait = vm::upgradeTrait,
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
                color = CyberColors.BgCard,
                border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
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
                        color = if (evaluation.formulaErrors.isNotEmpty()) CyberColors.AccentDanger else CyberColors.InkPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Box(
                        modifier = Modifier
                            .background(CyberColors.AccentWine, RoundedCornerShape(3.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "> ACCESS GRANTED_",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = CyberColors.InkInverse
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "XP: $availableXp",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberColors.AccentWine
                    )
                }
            }
        }
    }

    if (sideSheetOpen) {
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

    if (systemModalOpen) {
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
private fun SystemSwitcherDropdown(
    activeSystemId: SystemId,
    onSelect: (SystemId) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val activeOption = Presets.SYSTEM_OPTIONS.find { it.id == activeSystemId }

    Box {
        Surface(
            modifier = Modifier.clickable { expanded = true },
            shape = RoundedCornerShape(CyberDimens.ControlRadius),
            color = CyberColors.BgCardAlt,
            border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
        ) {
            Text(
                text = "SYS: ${activeOption?.shortLabel ?: "WOD"} ▾",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = CyberColors.InkPrimary,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(CyberColors.BgCard)
        ) {
            Presets.SYSTEM_OPTIONS.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = option.shortLabel,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            fontWeight = if (option.id == activeSystemId) FontWeight.Black else FontWeight.Medium,
                            color = if (option.id == activeSystemId) CyberColors.AccentWine else CyberColors.InkPrimary
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
private fun TopOutlineBtn(label: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(CyberDimens.ControlRadius),
        color = CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = CyberColors.InkPrimary,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
        )
    }
}

@Composable
private fun ModeSegment(
    label: String,
    active: Boolean,
    activeBg: androidx.compose.ui.graphics.Color,
    activeInk: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .background(if (active) activeBg else CyberColors.BgCard)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = if (active) activeInk else CyberColors.InkPrimary
        )
    }
}

@Composable
private fun SheetTabButton(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(CyberDimens.ControlRadius),
        color = if (selected) CyberColors.AccentWine else CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderStrong, CyberColors.BorderInk)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) CyberColors.InkInverse else CyberColors.InkPrimary,
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

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.BgCard,
        title = {
            Text(
                text = "SISTEMAS & JSON",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Presets.SYSTEM_OPTIONS.forEach { preset ->
                    val isCurrent = preset.id == activeSystemId
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(if (isCurrent) CyberColors.AccentWineSoft else CyberColors.BgCardAlt, RoundedCornerShape(6.dp))
                            .border(1.5.dp, CyberColors.BorderInk, RoundedCornerShape(6.dp))
                            .clickable { onLoadPreset(preset.id) }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(preset.shortLabel, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            Text(preset.description, fontSize = 10.sp, color = CyberColors.InkMuted)
                        }
                        Text(
                            text = if (isCurrent) "REINICIAR ↗" else "CARREGAR ↗",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = CyberColors.AccentWine
                        )
                    }
                }
                OutlinedTextField(
                    value = jsonInput,
                    onValueChange = { jsonInput = it },
                    label = { Text("JSON DA FICHA (EXPORTAR / IMPORTAR)", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                    maxLines = 4
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
                colors = ButtonDefaults.buttonColors(containerColor = CyberColors.AccentBlack)
            ) {
                Text("IMPORTAR JSON", fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("FECHAR", fontFamily = FontFamily.Monospace, color = CyberColors.InkMuted)
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
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(CyberColors.BgCardAlt, RoundedCornerShape(CyberDimens.ControlRadius))
            .border(CyberDimens.BorderStrong, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = if (busy) "// ARQUIVOS .JSON · PROCESSANDO_" else "// ARQUIVOS .JSON · SCHEMA V2",
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 10.sp,
            color = CyberColors.AccentWine
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
                    checkedColor = CyberColors.AccentWine,
                    uncheckedColor = CyberColors.BorderInk,
                    checkmarkColor = CyberColors.InkInverse
                )
            )
            Text(
                text = "SOBRESCREVER FICHAS COM MESMO ID (SENÃO CRIA \"(CÓPIA)\")",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = CyberColors.InkPrimary
            )
        }

        if (feedback != null) {
            val accent = if (feedback.success) CyberColors.AccentWine else CyberColors.AccentDanger
            val soft = if (feedback.success) CyberColors.AccentWineSoft else CyberColors.AccentDangerSoft
            Text(
                text = (if (feedback.success) "> OK_ " else "> ERRO_ ") + feedback.message,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = accent,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(soft, RoundedCornerShape(CyberDimens.SmallRadius))
                    .border(CyberDimens.BorderWidth, accent, RoundedCornerShape(CyberDimens.SmallRadius))
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
    val shape = RoundedCornerShape(CyberDimens.ControlRadius)
    val bg = when {
        !enabled -> CyberColors.BgHover
        primary -> CyberColors.AccentBlack
        else -> CyberColors.BgCard
    }
    val ink = when {
        !enabled -> CyberColors.InkMuted
        primary -> CyberColors.InkInverse
        else -> CyberColors.InkPrimary
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .background(bg, shape)
            .border(CyberDimens.BorderStrong, CyberColors.BorderInk, shape)
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
