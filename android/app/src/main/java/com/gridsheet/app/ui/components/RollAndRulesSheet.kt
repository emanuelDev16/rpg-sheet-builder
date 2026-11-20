package com.gridsheet.app.ui.components

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gridsheet.app.core.RollLogEntry
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.XpRulePreset
import com.gridsheet.app.data.Fts5QuerySanitizer
import com.gridsheet.app.data.IndexProgress
import com.gridsheet.app.data.RulesSearchResponse
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.IndexedBookEntity
import com.gridsheet.app.ui.SideSheetMode
import com.gridsheet.app.ui.theme.CyberDimens
import com.gridsheet.app.ui.theme.LocalGridTheme
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RollAndRulesBottomSheet(
    mode: SideSheetMode,
    systemId: SystemId,
    systemName: String,
    rulePreset: XpRulePreset = XpRulePreset.STORYTELLER_V20,
    quickDice: List<String>,
    logs: List<RollLogEntry>,
    rulesQuery: String,
    rulesLoading: Boolean,
    rulesResult: RulesSearchResponse?,
    indexedBooks: List<IndexedBookEntity>,
    indexProgress: IndexProgress?,
    scannedPdfAlert: IndexProgress.ScannedNoOcr?,
    localRuleHits: List<FtsRuleHitRow>,
    localSearchElapsedMs: Long?,
    onSwitchMode: (SideSheetMode) -> Unit,
    onRollExpression: (String, String) -> Unit,
    onWillpowerSurge: (String, Set<Int>) -> Unit = { _, _ -> },
    onClearLogs: () -> Unit,
    onRulesQueryChange: (String) -> Unit,
    onSearchRules: (String, Boolean) -> Unit,
    onPickPdf: () -> Unit,
    onDeleteBook: (String) -> Unit,
    onStartOcr: (Int?, Int?) -> Unit,
    onCancelIndexing: () -> Unit,
    onDismissScannedPdfAlert: () -> Unit,
    onDismissIndexError: () -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var diceExpr by remember(systemId) { mutableStateOf(quickDice.getOrElse(1) { quickDice.first() }) }
    var libraryExpanded by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)

    LaunchedEffect(systemId) {
        diceExpr = quickDice.getOrElse(1) { quickDice.first() }
    }

    LaunchedEffect(indexProgress, scannedPdfAlert) {
        if (indexProgress != null || scannedPdfAlert != null) {
            libraryExpanded = true
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = theme.bgCard
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.86f)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ModeTabButton("// LOG_ROLAGENS", mode == SideSheetMode.LOGS) {
                        onSwitchMode(SideSheetMode.LOGS)
                    }
                    ModeTabButton("// REGRAS", mode == SideSheetMode.RULES) {
                        onSwitchMode(SideSheetMode.RULES)
                    }
                }
                if (mode == SideSheetMode.LOGS && logs.isNotEmpty()) {
                    TextButton(onClick = onClearLogs) {
                        Text(
                            "LIMPAR",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = theme.accentDanger
                        )
                    }
                } else if (mode == SideSheetMode.RULES) {
                    val libBg = when {
                        libraryExpanded && theme.isEink -> theme.accentPrimary
                        libraryExpanded -> theme.accentWineSoft
                        else -> theme.bgCardAlt
                    }
                    val libFg = if (libraryExpanded && theme.isEink) theme.accentContrast else theme.textPrimary
                    val libIcon = if (libraryExpanded && theme.isEink) theme.accentContrast else theme.accentPrimary
                    Surface(
                        modifier = Modifier.clickable { libraryExpanded = !libraryExpanded },
                        shape = pillShape,
                        color = libBg,
                        border = BorderStroke(
                            theme.borderWidth,
                            if (libraryExpanded) theme.accentPrimary else theme.borderColor
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.MenuBook,
                                contentDescription = "Biblioteca PDF",
                                tint = libIcon,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "PDFS (${indexedBooks.size})",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = libFg
                            )
                        }
                    }
                }
            }

            if (mode == SideSheetMode.LOGS) {
                LogsModeContent(
                    diceExpr = diceExpr,
                    onDiceExprChange = { diceExpr = it },
                    quickDice = quickDice,
                    logs = logs,
                    rulePreset = rulePreset,
                    onRollExpression = onRollExpression,
                    onWillpowerSurge = onWillpowerSurge
                )
            } else {
                RulesModeContent(
                    systemId = systemId,
                    systemName = systemName,
                    rulesQuery = rulesQuery,
                    rulesLoading = rulesLoading,
                    rulesResult = rulesResult,
                    indexedBooks = indexedBooks,
                    indexProgress = indexProgress,
                    scannedPdfAlert = scannedPdfAlert,
                    localRuleHits = localRuleHits,
                    localSearchElapsedMs = localSearchElapsedMs,
                    libraryExpanded = libraryExpanded,
                    onToggleLibrary = { libraryExpanded = !libraryExpanded },
                    onRulesQueryChange = onRulesQueryChange,
                    onSearchRules = onSearchRules,
                    onPickPdf = onPickPdf,
                    onDeleteBook = onDeleteBook,
                    onStartOcr = onStartOcr,
                    onCancelIndexing = onCancelIndexing,
                    onDismissScannedPdfAlert = onDismissScannedPdfAlert,
                    onDismissIndexError = onDismissIndexError,
                    onOpenExternalUri = { uri ->
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)))
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun LogsModeContent(
    diceExpr: String,
    onDiceExprChange: (String) -> Unit,
    quickDice: List<String>,
    logs: List<RollLogEntry>,
    rulePreset: XpRulePreset,
    onRollExpression: (String, String) -> Unit,
    onWillpowerSurge: (String, Set<Int>) -> Unit
) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    var rerollTargetEntryId by remember { mutableStateOf<String?>(null) }
    var selectedNormalIndices by remember { mutableStateOf<Set<Int>>(emptySet()) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BasicTextField(
            value = diceExpr,
            onValueChange = onDiceExprChange,
            singleLine = true,
            cursorBrush = SolidColor(theme.accentPrimary),
            textStyle = TextStyle(
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = theme.textPrimary
            ),
            modifier = Modifier
                .weight(1f)
                .background(theme.bgInput, pillShape)
                .border(theme.borderWidth, theme.borderColor, pillShape)
                .padding(horizontal = 10.dp, vertical = 9.dp)
        )
        Button(
            onClick = { onRollExpression("ROLAGEM RÁPIDA", diceExpr) },
            shape = pillShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = theme.accentBlack,
                contentColor = theme.accentContrast
            )
        ) {
            Text("ROLAR ↗", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        quickDice.forEach { preset ->
            OutlinedButton(
                onClick = {
                    onDiceExprChange(preset)
                    onRollExpression("ROLAGEM $preset", preset)
                },
                modifier = Modifier.weight(1f),
                shape = pillShape,
                border = BorderStroke(1.dp, theme.borderColor),
                contentPadding = PaddingValues(vertical = 4.dp)
            ) {
                Text(
                    text = preset.uppercase(),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textPrimary
                )
            }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(logs.size, key = { idx -> logs[idx].id }) { idx ->
            val entry = logs[idx]
            val isLatestV5Pool = idx == 0 &&
                rulePreset == XpRulePreset.VAMPIRE_V5 &&
                entry.isPoolRoll &&
                entry.normalDice.isNotEmpty()
            val isSelectingThis = rerollTargetEntryId == entry.id

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = cardShape,
                color = theme.bgCardAlt,
                border = BorderStroke(theme.borderWidth, theme.borderColor)
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            entry.label,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.textPrimary
                        )
                        Text(
                            entry.timestamp,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = theme.textMuted
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "${entry.total}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Black,
                                fontSize = 28.sp,
                                color = if (entry.isFumble || entry.isBestialFailure) theme.accentDanger else theme.accentPrimary
                            )
                            if (entry.isPoolRoll) {
                                Text(
                                    text = if (entry.isFumble && !entry.isBestialFailure) "BOTCH" else "SUCS",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.textMuted,
                                    modifier = Modifier.padding(bottom = 5.dp)
                                )
                            }
                        }
                        V5OutcomeBadges(
                            isMessyCritical = entry.isMessyCritical,
                            isBestialFailure = entry.isBestialFailure,
                            isCritical = entry.isCritical
                        )
                    }
                    if (entry.normalDice.isNotEmpty() || entry.hungerDice.isNotEmpty()) {
                        V5DiceChipsRow(
                            normalDice = entry.normalDice,
                            hungerDice = entry.hungerDice,
                            rerollSelectionActive = isSelectingThis,
                            selectedNormalIndices = if (isSelectingThis) selectedNormalIndices else emptySet(),
                            onToggleNormalDie = { dieIdx ->
                                selectedNormalIndices = if (dieIdx in selectedNormalIndices) {
                                    selectedNormalIndices - dieIdx
                                } else if (selectedNormalIndices.size < 3) {
                                    selectedNormalIndices + dieIdx
                                } else {
                                    selectedNormalIndices
                                }
                            }
                        )
                    }
                    if (isLatestV5Pool) {
                        if (isSelectingThis) {
                            Text(
                                text = "TOQUE EM ATÉ 3 DADOS NORMAIS (DADOS DE FOME BLOQUEADOS)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.accentPrimary
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        onWillpowerSurge(entry.id, selectedNormalIndices)
                                        rerollTargetEntryId = null
                                        selectedNormalIndices = emptySet()
                                    },
                                    enabled = selectedNormalIndices.isNotEmpty(),
                                    modifier = Modifier
                                        .weight(1f)
                                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                    shape = pillShape,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = theme.accentPrimary,
                                        contentColor = theme.accentContrast
                                    ),
                                    border = BorderStroke(theme.borderWidth, theme.borderColor)
                                ) {
                                    Text(
                                        text = "CONFIRMAR (${selectedNormalIndices.size}/3)",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 11.sp
                                    )
                                }
                                OutlinedButton(
                                    onClick = {
                                        rerollTargetEntryId = null
                                        selectedNormalIndices = emptySet()
                                    },
                                    modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                    shape = pillShape,
                                    border = BorderStroke(theme.borderWidth, theme.borderColor)
                                ) {
                                    Text(
                                        text = "CANCELAR",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        color = theme.textPrimary
                                    )
                                }
                            }
                        } else {
                            OutlinedButton(
                                onClick = {
                                    rerollTargetEntryId = entry.id
                                    selectedNormalIndices = entry.normalDice.indices
                                        .filter { entry.normalDice[it] < 6 }
                                        .take(3)
                                        .toSet()
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                shape = pillShape,
                                border = BorderStroke(theme.borderWidth, theme.borderColor)
                            ) {
                                Text(
                                    text = "REROLL WP (ATÉ 3 NORMAIS)",
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 11.sp,
                                    color = theme.textPrimary
                                )
                            }
                        }
                    }
                    Text(entry.breakdown, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = theme.textSecondary)
                    Text(entry.formula, fontFamily = FontFamily.Monospace, fontSize = 10.sp, color = theme.textMuted)
                }
            }
        }
    }
}

@Composable
private fun RulesModeContent(
    systemId: SystemId,
    systemName: String,
    rulesQuery: String,
    rulesLoading: Boolean,
    rulesResult: RulesSearchResponse?,
    indexedBooks: List<IndexedBookEntity>,
    indexProgress: IndexProgress?,
    scannedPdfAlert: IndexProgress.ScannedNoOcr?,
    localRuleHits: List<FtsRuleHitRow>,
    localSearchElapsedMs: Long?,
    libraryExpanded: Boolean,
    onToggleLibrary: () -> Unit,
    onRulesQueryChange: (String) -> Unit,
    onSearchRules: (String, Boolean) -> Unit,
    onPickPdf: () -> Unit,
    onDeleteBook: (String) -> Unit,
    onStartOcr: (Int?, Int?) -> Unit,
    onCancelIndexing: () -> Unit,
    onDismissScannedPdfAlert: () -> Unit,
    onDismissIndexError: () -> Unit,
    onOpenExternalUri: (String) -> Unit
) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val isIndexing = indexProgress is IndexProgress.Extracting ||
        indexProgress is IndexProgress.OcrExtracting ||
        indexProgress is IndexProgress.Persisting
    val suggestions = remember(systemId) {
        when (systemId) {
            SystemId.WOD -> listOf("Frenzy", "Hunger", "Superficial", "Rouse")
            SystemId.CYBERPUNK -> listOf("Netrunning", "Armor SP", "Critical", "Fumble")
            else -> listOf("Grapple", "Concentration", "Advantage", "Opportunity")
        }
    }

    Text(
        text = "CONTEXTO ATIVO: $systemName",
        fontFamily = FontFamily.Monospace,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = theme.accentPrimary
    )

    if (libraryExpanded || indexedBooks.isEmpty() || scannedPdfAlert != null) {
        PdfLibraryCard(
            indexedBooks = indexedBooks,
            indexProgress = indexProgress,
            scannedPdfAlert = scannedPdfAlert,
            isIndexing = isIndexing,
            expanded = libraryExpanded,
            onToggleExpand = onToggleLibrary,
            onPickPdf = onPickPdf,
            onDeleteBook = onDeleteBook,
            onStartOcr = onStartOcr,
            onCancelIndexing = onCancelIndexing,
            onDismissScannedPdfAlert = onDismissScannedPdfAlert,
            onDismissError = onDismissIndexError
        )
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BasicTextField(
            value = rulesQuery,
            onValueChange = onRulesQueryChange,
            singleLine = true,
            cursorBrush = SolidColor(theme.accentPrimary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { onSearchRules(rulesQuery, false) }),
            textStyle = TextStyle(
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                color = theme.textPrimary
            ),
            decorationBox = { inner ->
                Box {
                    if (rulesQuery.isEmpty()) {
                        Text(
                            text = if (indexedBooks.isNotEmpty()) {
                                "Busca instantânea offline (FTS5)..."
                            } else {
                                "Ex: grappling, concentration, frenzy..."
                            },
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = theme.textMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    inner()
                }
            },
            modifier = Modifier
                .weight(1f)
                .background(theme.bgInput, pillShape)
                .border(theme.borderWidth, theme.borderColor, pillShape)
                .padding(horizontal = 10.dp, vertical = 9.dp)
        )
        Button(
            onClick = { onSearchRules(rulesQuery, false) },
            enabled = !rulesLoading,
            shape = pillShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = theme.accentBlack,
                contentColor = theme.accentContrast
            )
        ) {
            Text("BUSCAR ↗", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 11.sp)
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        suggestions.forEach { term ->
            Surface(
                modifier = Modifier.clickable {
                    onRulesQueryChange(term)
                    onSearchRules(term, false)
                },
                shape = pillShape,
                color = theme.bgCardAlt,
                border = BorderStroke(1.dp, theme.borderColor)
            ) {
                Text(
                    text = term.uppercase(),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textPrimary,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                )
            }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (localRuleHits.isNotEmpty()) {
            item(key = "local_hits_header") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "// ÍNDICE OFFLINE FTS5 (${localRuleHits.size} · ${localSearchElapsedMs ?: 1}ms)",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.accentPrimary
                    )
                    Text(
                        text = "WEB ↗",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.textSecondary,
                        modifier = Modifier
                            .border(1.dp, theme.borderColor, pillShape)
                            .clickable(enabled = !rulesLoading) { onSearchRules(rulesQuery, true) }
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            items(localRuleHits, key = { "${it.bookId}_${it.pageNumber}" }) { hit ->
                LocalFtsHitCard(hit = hit)
            }
        } else if (rulesQuery.trim().length >= 2 && indexedBooks.isNotEmpty() && !rulesLoading && rulesResult == null) {
            item(key = "local_empty_state") {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = cardShape,
                    color = theme.bgCardAlt,
                    border = BorderStroke(theme.borderWidth, theme.borderColor)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Nenhum trecho encontrado nos manuais locais para \"${rulesQuery.trim()}\".",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = theme.textSecondary
                        )
                        OutlinedButton(
                            onClick = { onSearchRules(rulesQuery, true) },
                            shape = pillShape,
                            border = BorderStroke(1.dp, theme.borderColor)
                        ) {
                            Text(
                                text = "BUSCAR ONLINE ↗",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = theme.accentPrimary
                            )
                        }
                    }
                }
            }
        }

        if (rulesLoading) {
            item(key = "rules_loading") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(color = theme.accentPrimary)
                }
            }
        } else if (rulesResult != null) {
            if (!rulesResult.ok && !rulesResult.error.isNullOrBlank()) {
                item(key = "online_error") {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.accentDangerSoft,
                        border = BorderStroke(1.dp, theme.accentDanger)
                    ) {
                        Text(
                            text = rulesResult.error,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            color = theme.accentDanger,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            } else {
                item(key = "online_answer") {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.bgCardAlt,
                        border = BorderStroke(theme.borderWidth, theme.borderColor)
                    ) {
                        Text(
                            text = rulesResult.answer,
                            fontSize = 13.sp,
                            color = theme.textPrimary,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
                items(rulesResult.sources) { src ->
                    Text(
                        text = "↗ ${src.title}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = theme.accentPrimary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenExternalUri(src.uri) }
                            .padding(vertical = 4.dp)
                    )
                }
            }
        } else if (localRuleHits.isEmpty() && indexedBooks.isEmpty()) {
            item(key = "rules_hint") {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Importe um manual PDF para consulta instantânea 100% offline via SQLite FTS5, ou pesquise online pelo servidor configurado.",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = theme.textMuted
                )
            }
        }
    }
}

@Composable
private fun PdfLibraryCard(
    indexedBooks: List<IndexedBookEntity>,
    indexProgress: IndexProgress?,
    scannedPdfAlert: IndexProgress.ScannedNoOcr?,
    isIndexing: Boolean,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onPickPdf: () -> Unit,
    onDeleteBook: (String) -> Unit,
    onStartOcr: (Int?, Int?) -> Unit,
    onCancelIndexing: () -> Unit,
    onDismissScannedPdfAlert: () -> Unit,
    onDismissError: () -> Unit
) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = cardShape,
        color = theme.bgStrip,
        border = BorderStroke(theme.borderWidth, theme.borderColor)
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "// BIBLIOTECA PDF OFFLINE (${indexedBooks.size})",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.textPrimary,
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onToggleExpand() }
                )
                Surface(
                    modifier = Modifier.clickable(enabled = !isIndexing, onClick = onPickPdf),
                    shape = pillShape,
                    color = if (isIndexing) theme.bgHover else theme.accentPrimary,
                    border = BorderStroke(1.dp, theme.borderColor)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.UploadFile,
                            contentDescription = "Importar PDF",
                            tint = if (isIndexing) theme.textMuted else theme.accentContrast,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = if (isIndexing) "INDEXANDO..." else "IMPORTAR PDF",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isIndexing) theme.textMuted else theme.accentContrast
                        )
                    }
                }
            }

            if (scannedPdfAlert != null) {
                var startPageText by remember(scannedPdfAlert.bookTitle) { mutableStateOf("") }
                var endPageText by remember(scannedPdfAlert.bookTitle) { mutableStateOf("") }

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = cardShape,
                    color = theme.accentDangerSoft,
                    border = BorderStroke(theme.borderStrong, theme.borderColor)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.WarningAmber,
                                    contentDescription = "PDF sem OCR",
                                    tint = theme.accentDanger,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "// PDF ESCANEADO (SEM OCR)",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.accentDanger
                                )
                            }
                            Surface(
                                modifier = Modifier
                                    .heightIn(min = 48.dp)
                                    .clickable(onClick = onDismissScannedPdfAlert),
                                shape = pillShape,
                                color = theme.bgCard,
                                border = BorderStroke(1.dp, theme.borderColor)
                            ) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = "FECHAR",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.textPrimary
                                    )
                                }
                            }
                        }
                        Text(
                            text = "O arquivo \"${scannedPdfAlert.bookTitle}\" contém apenas imagens nas primeiras ${scannedPdfAlert.sampledPages} páginas (de ${scannedPdfAlert.totalPages}).",
                            fontSize = 14.sp,
                            lineHeight = 19.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = theme.textPrimary
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "PÁG. INICIAL",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.textPrimary
                                )
                                BasicTextField(
                                    value = startPageText,
                                    onValueChange = { next ->
                                        startPageText = next.filter { it.isDigit() }
                                    },
                                    singleLine = true,
                                    cursorBrush = SolidColor(theme.accentPrimary),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Number,
                                        imeAction = ImeAction.Next
                                    ),
                                    textStyle = TextStyle(
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = theme.textPrimary
                                    ),
                                    decorationBox = { inner ->
                                        Box(
                                            contentAlignment = Alignment.CenterStart,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            if (startPageText.isEmpty()) {
                                                Text(
                                                    text = "1",
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 14.sp,
                                                    color = theme.textMuted
                                                )
                                            }
                                            inner()
                                        }
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(min = 48.dp)
                                        .background(theme.bgInput, pillShape)
                                        .border(theme.borderWidth, theme.borderColor, pillShape)
                                        .padding(horizontal = 10.dp, vertical = 12.dp)
                                )
                            }

                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "PÁG. FINAL",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.textPrimary
                                )
                                BasicTextField(
                                    value = endPageText,
                                    onValueChange = { next ->
                                        endPageText = next.filter { it.isDigit() }
                                    },
                                    singleLine = true,
                                    cursorBrush = SolidColor(theme.accentPrimary),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Number,
                                        imeAction = ImeAction.Done
                                    ),
                                    textStyle = TextStyle(
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = theme.textPrimary
                                    ),
                                    decorationBox = { inner ->
                                        Box(
                                            contentAlignment = Alignment.CenterStart,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            if (endPageText.isEmpty()) {
                                                Text(
                                                    text = "${scannedPdfAlert.totalPages}",
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 14.sp,
                                                    color = theme.textMuted
                                                )
                                            }
                                            inner()
                                        }
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(min = 48.dp)
                                        .background(theme.bgInput, pillShape)
                                        .border(theme.borderWidth, theme.borderColor, pillShape)
                                        .padding(horizontal = 10.dp, vertical = 12.dp)
                                )
                            }
                        }

                        Button(
                            onClick = {
                                val start = startPageText.toIntOrNull()
                                val end = endPageText.toIntOrNull()
                                onStartOcr(start, end)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp),
                            shape = pillShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = theme.accentPrimary,
                                contentColor = theme.accentContrast
                            ),
                            border = BorderStroke(theme.borderWidth, theme.borderColor)
                        ) {
                            Text(
                                text = "CONVERTER COM OCR (OFFLINE / LENTO)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }
            }

            when (indexProgress) {
                is IndexProgress.Extracting -> {
                    val pct = if (indexProgress.totalPages > 0) {
                        ((indexProgress.currentPage.toFloat() / indexProgress.totalPages) * 100f)
                            .toInt()
                            .coerceIn(0, 100)
                    } else 0
                    val fraction = if (indexProgress.totalPages > 0) {
                        (indexProgress.currentPage.toFloat() / indexProgress.totalPages).coerceIn(0f, 1f)
                    } else 0f

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.bgCard,
                        border = BorderStroke(1.dp, theme.borderColor)
                    ) {
                        Column(
                            modifier = Modifier.padding(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = indexProgress.bookTitle,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.accentPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = if (indexProgress.totalPages > 0) {
                                        "PÁG. ${indexProgress.currentPage}/${indexProgress.totalPages} ($pct%)"
                                    } else {
                                        "ABRINDO PDF..."
                                    },
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.textPrimary
                                )
                            }
                            LinearProgressIndicator(
                                progress = { fraction },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp),
                                color = theme.accentPrimary,
                                trackColor = theme.accentWineSoft
                            )
                        }
                    }
                }

                is IndexProgress.OcrExtracting -> {
                    val pct = if (indexProgress.totalPages > 0) {
                        ((indexProgress.currentPage.toFloat() / indexProgress.totalPages) * 100f)
                            .toInt()
                            .coerceIn(0, 100)
                    } else 0
                    val fraction = if (indexProgress.totalPages > 0) {
                        (indexProgress.currentPage.toFloat() / indexProgress.totalPages).coerceIn(0f, 1f)
                    } else 0f

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.bgCard,
                        border = BorderStroke(theme.borderWidth, theme.borderColor)
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = indexProgress.bookTitle,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.accentPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = if (indexProgress.totalPages > 0) {
                                        "OCR PÁG. ${indexProgress.currentPage} / ${indexProgress.totalPages} ($pct%)"
                                    } else {
                                        "OCR PÁG. 0 / ..."
                                    },
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.textPrimary
                                )
                            }
                            LinearProgressIndicator(
                                progress = { fraction },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp),
                                color = theme.accentPrimary,
                                trackColor = theme.accentWineSoft
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "OCR offline via ML Kit (pág. PDF ${indexProgress.currentPdfPage})",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    color = theme.textSecondary,
                                    modifier = Modifier.weight(1f)
                                )
                                OutlinedButton(
                                    onClick = onCancelIndexing,
                                    modifier = Modifier.heightIn(min = 48.dp),
                                    shape = pillShape,
                                    border = BorderStroke(theme.borderWidth, theme.borderColor),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = "CANCELAR",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Black,
                                        color = theme.accentDanger
                                    )
                                }
                            }
                        }
                    }
                }

                is IndexProgress.Persisting -> {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.bgCard,
                        border = BorderStroke(1.dp, theme.borderColor)
                    ) {
                        Column(
                            modifier = Modifier.padding(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "GRAVANDO ÍNDICE FTS5: ${indexProgress.bookTitle} (${indexProgress.totalPages} PÁGS)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.accentPrimary
                            )
                            LinearProgressIndicator(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp),
                                color = theme.accentPrimary,
                                trackColor = theme.accentWineSoft
                            )
                        }
                    }
                }

                is IndexProgress.Error -> {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        color = theme.accentDangerSoft,
                        border = BorderStroke(1.dp, theme.accentDanger)
                    ) {
                        Row(
                            modifier = Modifier.padding(8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = indexProgress.message,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                color = theme.accentDanger,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = "OK",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.accentDanger,
                                modifier = Modifier
                                    .clickable(onClick = onDismissError)
                                    .padding(start = 8.dp)
                            )
                        }
                    }
                }

                else -> Unit
            }

            if (expanded && indexedBooks.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    indexedBooks.forEach { book ->
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = cardShape,
                            color = theme.bgCard,
                            border = BorderStroke(1.dp, theme.borderColor)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = book.title,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.textPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = "${book.pageCount} PÁGINAS · INDEXADO OFFLINE",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 9.sp,
                                        color = theme.textMuted
                                    )
                                }
                                Icon(
                                    imageVector = Icons.Outlined.DeleteOutline,
                                    contentDescription = "Remover ${book.title}",
                                    tint = theme.accentDanger,
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clickable { onDeleteBook(book.bookId) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LocalFtsHitCard(hit: FtsRuleHitRow) {
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val highlightBg = if (theme.isEink) theme.accentPrimary else theme.accentWineSoft
    val highlightFg = if (theme.isEink) theme.accentContrast else theme.accentPrimary

    val annotatedSnippet = remember(hit.snippet, theme.mode) {
        val segments = Fts5QuerySanitizer.parseSnippetSegments(hit.snippet)
        buildAnnotatedString {
            if (segments.isEmpty()) {
                append(hit.snippet)
            } else {
                for ((text, highlighted) in segments) {
                    if (highlighted) {
                        withStyle(
                            SpanStyle(
                                background = highlightBg,
                                color = highlightFg,
                                fontWeight = FontWeight.Black
                            )
                        ) {
                            append(text)
                        }
                    } else {
                        append(text)
                    }
                }
            }
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = cardShape,
        color = theme.bgCardAlt,
        border = BorderStroke(theme.borderWidth, theme.borderColor)
    ) {
        Column(
            modifier = Modifier.padding(11.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = hit.bookTitle.uppercase(),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.size(6.dp))
                Box(
                    modifier = Modifier
                        .background(theme.accentPrimary, pillShape)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "PÁG. ${hit.pageNumber}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.accentContrast
                    )
                }
            }
            Text(
                text = annotatedSnippet,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = theme.textPrimary
            )
            Text(
                text = "BM25: ${String.format(Locale.US, "%.2f", hit.rank)}",
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                color = theme.textMuted
            )
        }
    }
}

@Composable
private fun ModeTabButton(label: String, selected: Boolean, onClick: () -> Unit) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = pillShape,
        color = if (selected) theme.accentBlack else theme.bgCard,
        border = BorderStroke(theme.borderWidth, theme.borderColor)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) theme.accentContrast else theme.textPrimary,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
        )
    }
}
