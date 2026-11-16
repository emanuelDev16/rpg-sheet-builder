package com.gridsheet.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.UpgradableTrait
import com.gridsheet.app.core.XpRulePreset
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.ui.theme.CyberDimens
import com.gridsheet.app.ui.theme.LocalGridTheme
import com.gridsheet.app.ui.theme.brutalistShadow

@Composable
fun XpUpgradeWorkspace(
    sheet: CharacterSheetState,
    filter: XpUpgradeCategory?,
    onFilterChange: (XpUpgradeCategory?) -> Unit,
    onAwardXp: (Int, String) -> Unit,
    onUpgradeTrait: (String) -> Unit,
    onToggleDisciplineClan: (String) -> Unit,
    onSetCustomMultiplier: (String, Int?) -> Unit,
    onSelectRulePreset: (XpRulePreset) -> Unit,
    onToggleCustomBase: (Boolean) -> Unit,
    onBuySpecialty: (String, String) -> Unit,
    onBuyBackground: (String, Int?) -> Unit,
    onUndoLastUpgrade: () -> Unit
) {
    val xp = XpSystem.normalizeXpState(sheet.xp)
    val availableXp = XpSystem.getAvailableXp(xp)
    val allTraits = remember(sheet) { XpSystem.extractAllTraits(sheet) }
    val filteredTraits = remember(allTraits, filter) {
        if (filter == null) allTraits else allTraits.filter { it.category == filter }
    }
    val possibleCount = remember(filteredTraits) { filteredTraits.count { it.isPossible } }
    val isWod = remember(sheet) { XpSystem.isWodSystem(sheet) }
    val rulesSummary = remember(sheet) { XpSystem.getCostRulesSummary(sheet) }
    val hasRecentUpgrade = xp.ledger.any { it.kind == "upgrade" }

    var customAmount by remember { mutableStateOf("3") }
    var customReason by remember { mutableStateOf("") }
    var multiplierTarget by remember { mutableStateOf<UpgradableTrait?>(null) }
    var specOpen by remember { mutableStateOf(false) }
    var specSkillId by remember { mutableStateOf("") }
    var specFocus by remember { mutableStateOf("") }
    var specDropdownOpen by remember { mutableStateOf(false) }
    var bgOpen by remember { mutableStateOf(false) }
    var bgName by remember { mutableStateOf("") }
    var bgCost by remember { mutableStateOf(XpSystem.DEFAULT_BACKGROUND_XP_COST.toString()) }
    val skillTraits = remember(allTraits) { allTraits.filter { it.category == XpUpgradeCategory.SKILL } }
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val blockShape = RoundedCornerShape(if (theme.isEink) theme.pillCornerRadius else 2.dp)
    val xpTextFieldColors = OutlinedTextFieldDefaults.colors(
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

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // Card 1: XP Monitor
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
            shape = cardShape,
            color = theme.bgCard,
            border = BorderStroke(theme.borderStrong, theme.borderColor),
            shadowElevation = 0.dp
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.bgStrip)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "//XP_MONITOR",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.accentPrimary
                        )
                        Text(
                            text = "EXPERIENCE MONITOR",
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp,
                            color = theme.textPrimary
                        )
                    }
                    if (hasRecentUpgrade) {
                        OutlinedButton(
                            onClick = onUndoLastUpgrade,
                            modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                            shape = pillShape,
                            border = BorderStroke(theme.borderWidth, theme.borderColor),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "DESFAZER (UNDO)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.textPrimary
                            )
                        }
                    }
                }
                Box(Modifier.fillMaxWidth().height(theme.borderWidth).background(theme.borderColor))

                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        XpMetricBox("AVAILABLE XP", "$availableXp", theme.accentPrimary, Modifier.weight(1f))
                        XpMetricBox("TOTAL EARNED", "${xp.totalEarned}", theme.textPrimary, Modifier.weight(1f))
                        XpMetricBox("TOTAL SPENT", "${xp.spent}", theme.textSecondary, Modifier.weight(1f))
                    }

                    // Segmented XP Rule Preset Selector
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(pillShape)
                                .border(theme.borderWidth, theme.borderColor, pillShape),
                            horizontalArrangement = Arrangement.spacedBy(0.dp)
                        ) {
                            listOf(
                                XpRulePreset.STORYTELLER_V20 to "V20 CLÁSSICO",
                                XpRulePreset.VAMPIRE_V5 to "VAMPIRO V5",
                                XpRulePreset.CUSTOM to "CUSTOM"
                            ).forEach { (preset, label) ->
                                val selected = xp.xpRulePreset == preset
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                        .background(if (selected) theme.accentBlack else theme.bgCard)
                                        .clickable { onSelectRulePreset(preset) }
                                        .padding(horizontal = 6.dp, vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (selected) theme.accentContrast else theme.textPrimary
                                    )
                                }
                            }
                        }

                        val formulaBadgeText = when (xp.xpRulePreset) {
                            XpRulePreset.STORYTELLER_V20 -> "FÓRMULA V20: ATUAL × MULT"
                            XpRulePreset.VAMPIRE_V5 -> "FÓRMULA V5: NOVO NÍVEL × MULT"
                            XpRulePreset.CUSTOM ->
                                "FÓRMULA CUSTOM: ${if (xp.customUseNewLevelBase) "NOVO NÍVEL" else "ATUAL"} × MULT"
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .background(theme.accentCreamBadge, pillShape)
                                    .border(1.dp, theme.borderColor, pillShape)
                                    .padding(horizontal = 8.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = formulaBadgeText,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.textPrimary
                                )
                            }
                            if (xp.xpRulePreset == XpRulePreset.CUSTOM) {
                                Surface(
                                    modifier = Modifier
                                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                        .clickable { onToggleCustomBase(!xp.customUseNewLevelBase) },
                                    shape = pillShape,
                                    color = theme.bgCard,
                                    border = BorderStroke(1.dp, theme.borderColor)
                                ) {
                                    Box(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = if (xp.customUseNewLevelBase) "BASE: NOVO" else "BASE: ATUAL",
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

                    val pct = if (xp.totalEarned > 0) ((xp.spent.toFloat() / xp.totalEarned) * 100).toInt().coerceIn(0, 100) else 0
                    val filledBlocks = ((pct / 100f) * 12).toInt()
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("XP ALLOCATION", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.textMuted)
                            Text("${xp.spent} / ${xp.totalEarned} SPENT · $pct%", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.textPrimary)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            for (i in 1..12) {
                                val filled = i <= filledBlocks
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(12.dp)
                                        .clip(blockShape)
                                        .background(
                                            when {
                                                filled -> theme.accentPrimary
                                                theme.isEink -> theme.bgCard
                                                else -> theme.accentWineSoft
                                            }
                                        )
                                        .border(
                                            1.dp,
                                            when {
                                                filled -> theme.accentPrimary
                                                theme.isEink -> theme.borderColor
                                                else -> theme.accentPrimary.copy(alpha = 0.25f)
                                            },
                                            blockShape
                                        )
                                )
                            }
                        }
                    }

                    // Quick awards
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(1 to "+1 XP", 3 to "+3 XP", 5 to "+5 XP", -1 to "-1 XP").forEach { (delta, label) ->
                            OutlinedButton(
                                onClick = { onAwardXp(delta, if (delta > 0) "SESSION XP AWARD" else "XP ADJUSTMENT") },
                                modifier = Modifier.weight(1f),
                                shape = pillShape,
                                border = BorderStroke(theme.borderWidth, theme.borderColor),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = theme.bgCard,
                                    contentColor = theme.textPrimary
                                ),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 6.dp)
                            ) {
                                Text(label, fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = theme.textPrimary)
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        BasicTextField(
                            value = customAmount,
                            onValueChange = { customAmount = it },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            cursorBrush = SolidColor(theme.accentPrimary),
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = theme.textPrimary),
                            modifier = Modifier
                                .width(64.dp)
                                .background(theme.bgInput, pillShape)
                                .border(theme.borderWidth, theme.borderColor, pillShape)
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        )
                        BasicTextField(
                            value = customReason,
                            onValueChange = { customReason = it },
                            singleLine = true,
                            cursorBrush = SolidColor(theme.accentPrimary),
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = theme.textPrimary),
                            decorationBox = { inner ->
                                Box {
                                    if (customReason.isEmpty()) {
                                        Text("Nota (ex: Capítulo 04)", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = theme.textMuted)
                                    }
                                    inner()
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .background(theme.bgInput, pillShape)
                                .border(theme.borderWidth, theme.borderColor, pillShape)
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        )
                        Button(
                            onClick = {
                                val delta = customAmount.toIntOrNull() ?: 0
                                onAwardXp(delta, customReason)
                                customReason = ""
                            },
                            shape = pillShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = theme.accentBlack,
                                contentColor = theme.accentContrast
                            ),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text("ADD ↗", fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (xp.ledger.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("XP LEDGER (${xp.ledger.size})", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.textMuted)
                            xp.ledger.take(5).forEach { entry ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(theme.bgInput, RoundedCornerShape(CyberDimens.SmallRadius))
                                        .border(1.dp, theme.borderSubtle, RoundedCornerShape(CyberDimens.SmallRadius))
                                        .padding(horizontal = 8.dp, vertical = 5.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${entry.timestamp}  ${entry.label}",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        color = theme.textPrimary,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = if (entry.delta > 0) "+${entry.delta} XP" else "${entry.delta} XP",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (entry.delta > 0) theme.accentPrimary else theme.textPrimary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Card 2: Possible Upgrades Only
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
            shape = cardShape,
            color = theme.bgCard,
            border = BorderStroke(theme.borderStrong, theme.borderColor),
            shadowElevation = 0.dp
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.bgStrip)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("//TRAIT_UPGRADES", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = theme.accentPrimary)
                        Text("XP EVOLUTION CATALOG", fontWeight = FontWeight.Black, fontSize = 15.sp, color = theme.textPrimary)
                    }
                    Text(
                        text = "$possibleCount / ${filteredTraits.size} COMPRÁVEIS",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.accentPrimary
                    )
                }
                Box(Modifier.fillMaxWidth().height(theme.borderWidth).background(theme.borderColor))

                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "REGRAS: ${rulesSummary.joinToString(" · ")} · ORÇAMENTO: $availableXp XP",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = theme.textMuted
                    )

                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        val attrCount = allTraits.count { it.category == XpUpgradeCategory.ATTRIBUTE }
                        val skillCount = allTraits.count { it.category == XpUpgradeCategory.SKILL }
                        val discCount = allTraits.count { it.category == XpUpgradeCategory.DISCIPLINE }
                        val virtueCount = allTraits.count { it.category == XpUpgradeCategory.VIRTUE }

                        FilterPill("TODOS (${allTraits.size})", filter == null) { onFilterChange(null) }
                        FilterPill("${if (isWod) "ATRIBUTOS" else "ABILITIES"} ($attrCount)", filter == XpUpgradeCategory.ATTRIBUTE) { onFilterChange(XpUpgradeCategory.ATTRIBUTE) }
                        FilterPill("${if (isWod) "HABILIDADES" else "SKILLS"} ($skillCount)", filter == XpUpgradeCategory.SKILL) { onFilterChange(XpUpgradeCategory.SKILL) }
                        FilterPill("${if (isWod) "DISCIPLINAS" else "PODERES"} ($discCount)", filter == XpUpgradeCategory.DISCIPLINE) { onFilterChange(XpUpgradeCategory.DISCIPLINE) }
                        FilterPill("VIRTUDES / WP ($virtueCount)", filter == XpUpgradeCategory.VIRTUE) { onFilterChange(XpUpgradeCategory.VIRTUE) }
                    }

                    if (filteredTraits.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(theme.bgInput, cardShape)
                                .border(theme.borderWidth, theme.borderSubtle, cardShape)
                                .padding(14.dp)
                        ) {
                            Text(
                                text = "Nenhum campo elegível encontrado nesta categoria na ficha atual.",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                color = theme.textSecondary
                            )
                        }
                    } else {
                        val grouped = filteredTraits.groupBy { it.category }
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            grouped.forEach { (category, items) ->
                                val catTitle = when (category) {
                                    XpUpgradeCategory.ATTRIBUTE -> if (isWod) "ATRIBUTOS" else "ABILITIES"
                                    XpUpgradeCategory.SKILL -> if (isWod) "HABILIDADES" else "SKILLS"
                                    XpUpgradeCategory.DISCIPLINE -> if (isWod) "DISCIPLINAS / PODERES" else "POWERS"
                                    XpUpgradeCategory.VIRTUE -> "VIRTUDES / HUMANIDADE / FORÇA DE VONTADE"
                                }
                                Text(
                                    text = "// $catTitle (${items.size})",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = theme.accentPrimary
                                )
                                items.forEach { trait ->
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(theme.bgCardAlt, cardShape)
                                            .border(
                                                theme.borderWidth,
                                                if (trait.isPossible) theme.borderColor else theme.borderSubtle,
                                                cardShape
                                            )
                                            .padding(horizontal = 12.dp, vertical = 10.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                                Text(
                                                    text = if (trait.isBlockedByRule) {
                                                        "${trait.category.name} · ${trait.blockedReason ?: "Gerenciado em jogo no V5"}"
                                                    } else {
                                                        "${trait.category.name} · ${trait.formulaLabel}"
                                                    },
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 10.sp,
                                                    color = if (trait.isBlockedByRule) theme.textMuted else theme.accentPrimary,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(
                                                    text = if (trait.isMaxed || trait.isBlockedByRule) {
                                                        if (trait.isBlockedByRule) "${trait.label}  ${trait.currentValue} (EM JOGO)"
                                                        else "${trait.label}  ${trait.currentValue} (MAX)"
                                                    } else {
                                                        "${trait.label}  ${trait.currentValue} → ${trait.nextValue}"
                                                    },
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (trait.isBlockedByRule) theme.textMuted else theme.textPrimary
                                                )
                                            }
                                            Button(
                                                onClick = { onUpgradeTrait(trait.fieldId) },
                                                enabled = trait.isPossible,
                                                modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                                shape = pillShape,
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = theme.accentBlack,
                                                    contentColor = theme.accentContrast,
                                                    disabledContainerColor = theme.bgInput,
                                                    disabledContentColor = theme.textMuted
                                                ),
                                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                                            ) {
                                                val btnText = when {
                                                    trait.isBlockedByRule -> "V5: EM JOGO"
                                                    trait.isMaxed -> "MAX (${trait.maxCap})"
                                                    !trait.isAffordable -> "FALTA XP · ${trait.cost}"
                                                    else -> "UPGRADE · ${trait.cost} XP ↗"
                                                }
                                                Text(
                                                    text = btnText,
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }

                                        if (!trait.isBlockedByRule) {
                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                if (trait.category == XpUpgradeCategory.DISCIPLINE && isWod) {
                                                    val clanBg = when {
                                                        trait.isOutOfClan && theme.isEink -> theme.accentPrimary
                                                        trait.isOutOfClan -> theme.accentWineSoft
                                                        else -> theme.bgCard
                                                    }
                                                    val clanFg = when {
                                                        trait.isOutOfClan && theme.isEink -> theme.accentContrast
                                                        trait.isOutOfClan -> theme.accentPrimary
                                                        else -> theme.textPrimary
                                                    }
                                                    Surface(
                                                        modifier = Modifier
                                                            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                                            .clickable { onToggleDisciplineClan(trait.fieldId) },
                                                        shape = pillShape,
                                                        color = clanBg,
                                                        border = BorderStroke(1.dp, if (trait.isOutOfClan) theme.accentPrimary else theme.borderColor)
                                                    ) {
                                                        Box(
                                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                                            contentAlignment = Alignment.Center
                                                        ) {
                                                            Text(
                                                                text = if (trait.isOutOfClan) "FORA DE CLÃ (×7)" else "CLÃ (×5)",
                                                                fontFamily = FontFamily.Monospace,
                                                                fontSize = 10.sp,
                                                                fontWeight = FontWeight.Bold,
                                                                color = clanFg
                                                            )
                                                        }
                                                    }
                                                }
                                                val hasCustomMult = trait.customMultiplier != null
                                                val multBg = when {
                                                    hasCustomMult && theme.isEink -> theme.accentPrimary
                                                    hasCustomMult -> theme.accentCreamBadge
                                                    else -> theme.bgCard
                                                }
                                                val multFg = if (hasCustomMult && theme.isEink) theme.accentContrast else theme.textPrimary
                                                Surface(
                                                    modifier = Modifier
                                                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                                        .clickable { multiplierTarget = trait },
                                                    shape = pillShape,
                                                    color = multBg,
                                                    border = BorderStroke(1.dp, theme.borderColor)
                                                ) {
                                                    Box(
                                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Text(
                                                            text = if (hasCustomMult) "MULT: ×${trait.customMultiplier}" else "MULT: AUTO",
                                                            fontFamily = FontFamily.Monospace,
                                                            fontSize = 10.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = multFg
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Card 3: Specialties & Backgrounds / Advantages
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
            shape = cardShape,
            color = theme.bgCard,
            border = BorderStroke(theme.borderStrong, theme.borderColor),
            shadowElevation = 0.dp
        ) {
            Column {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.bgStrip)
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = "// ANTECEDENTES_&_VANTAGENS",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.accentPrimary
                    )
                    Text(
                        text = "ESPECIALIZAÇÕES & VANTAGENS",
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = theme.textPrimary
                    )
                }
                Box(Modifier.fillMaxWidth().height(theme.borderWidth).background(theme.borderColor))

                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                specOpen = !specOpen
                                if (specOpen) bgOpen = false
                            },
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                            shape = pillShape,
                            border = BorderStroke(theme.borderWidth, theme.borderColor),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (specOpen && theme.isEink) theme.accentPrimary else theme.bgCard,
                                contentColor = if (specOpen && theme.isEink) theme.accentContrast else theme.textPrimary
                            )
                        ) {
                            Text(
                                text = "+ COMPRAR ESPECIALIZAÇÃO (${XpSystem.SPECIALTY_XP_COST} XP)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (specOpen && theme.isEink) theme.accentContrast else theme.textPrimary
                            )
                        }
                        Button(
                            onClick = {
                                bgOpen = !bgOpen
                                if (bgOpen) specOpen = false
                            },
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                            shape = pillShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = theme.accentBlack,
                                contentColor = theme.accentContrast
                            )
                        ) {
                            Text(
                                text = "+ ADICIONAR ANTECEDENTE / VANTAGEM",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    if (specOpen) {
                        val selectedSkill = skillTraits.find { it.fieldId == specSkillId } ?: skillTraits.firstOrNull()
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(theme.bgCardAlt, cardShape)
                                .border(theme.borderWidth, theme.borderColor, cardShape)
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "ESPECIALIZAÇÃO DE PERÍCIA · ${XpSystem.SPECIALTY_XP_COST} XP FIXO",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.textSecondary
                            )
                            Box {
                                OutlinedButton(
                                    onClick = { specDropdownOpen = true },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                    shape = pillShape,
                                    border = BorderStroke(theme.borderWidth, theme.borderColor)
                                ) {
                                    val prefix = when {
                                        selectedSkill == null -> ""
                                        xp.xpRulePreset == XpRulePreset.STORYTELLER_V20 && selectedSkill.currentValue >= 4 -> "★ "
                                        xp.xpRulePreset == XpRulePreset.VAMPIRE_V5 && selectedSkill.currentValue >= 1 -> "• "
                                        else -> ""
                                    }
                                    Text(
                                        text = selectedSkill?.let { "$prefix${it.label} (${it.currentValue})" } ?: "Nenhuma perícia",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = theme.textPrimary
                                    )
                                }
                                DropdownMenu(
                                    expanded = specDropdownOpen,
                                    onDismissRequest = { specDropdownOpen = false },
                                    modifier = Modifier.background(theme.bgCard)
                                ) {
                                    skillTraits.forEach { sk ->
                                        val hint = when {
                                            xp.xpRulePreset == XpRulePreset.STORYTELLER_V20 && sk.currentValue >= 4 -> " ★ V20"
                                            xp.xpRulePreset == XpRulePreset.VAMPIRE_V5 && sk.currentValue >= 1 -> " • V5"
                                            else -> ""
                                        }
                                        DropdownMenuItem(
                                            text = {
                                                Text(
                                                    text = "${sk.label} (${sk.currentValue})$hint",
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 12.sp,
                                                    color = theme.textPrimary
                                                )
                                            },
                                            onClick = {
                                                specSkillId = sk.fieldId
                                                specDropdownOpen = false
                                            }
                                        )
                                    }
                                }
                            }
                            OutlinedTextField(
                                value = specFocus,
                                onValueChange = { specFocus = it },
                                label = { Text("Foco (ex: Armas de Fogo: Precisão)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                                singleLine = true,
                                colors = xpTextFieldColors,
                                shape = pillShape,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    val targetId = selectedSkill?.fieldId ?: return@Button
                                    onBuySpecialty(targetId, specFocus)
                                    specFocus = ""
                                    specOpen = false
                                },
                                enabled = selectedSkill != null && specFocus.isNotBlank() && availableXp >= XpSystem.SPECIALTY_XP_COST,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                shape = pillShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = theme.accentBlack,
                                    contentColor = theme.accentContrast
                                )
                            ) {
                                Text(
                                    text = "CONFIRMAR (${XpSystem.SPECIALTY_XP_COST} XP)",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    if (bgOpen) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(theme.bgCardAlt, cardShape)
                                .border(theme.borderWidth, theme.borderColor, cardShape)
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "NOVO ANTECEDENTE / VANTAGEM (0 → 1)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = theme.textSecondary
                            )
                            Row(
                                modifier = Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                XpSystem.BACKGROUND_PRESETS.forEach { (_, presetLabel) ->
                                    FilterPill(
                                        label = presetLabel.uppercase(),
                                        selected = bgName.trim().equals(presetLabel, ignoreCase = true)
                                    ) {
                                        bgName = presetLabel
                                    }
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedTextField(
                                    value = bgName,
                                    onValueChange = { bgName = it },
                                    label = { Text("Nome (ex: Recursos)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                                    singleLine = true,
                                    colors = xpTextFieldColors,
                                    shape = pillShape,
                                    modifier = Modifier.weight(2f)
                                )
                                OutlinedTextField(
                                    value = bgCost,
                                    onValueChange = { bgCost = it.filter { ch -> ch.isDigit() } },
                                    label = { Text("XP", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    colors = xpTextFieldColors,
                                    shape = pillShape,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            val parsedBgCost = bgCost.toIntOrNull() ?: XpSystem.DEFAULT_BACKGROUND_XP_COST
                            Button(
                                onClick = {
                                    onBuyBackground(bgName, parsedBgCost)
                                    bgName = ""
                                    bgCost = XpSystem.DEFAULT_BACKGROUND_XP_COST.toString()
                                    bgOpen = false
                                },
                                enabled = bgName.isNotBlank() && availableXp >= parsedBgCost,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                shape = pillShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = theme.accentBlack,
                                    contentColor = theme.accentContrast
                                )
                            ) {
                                Text(
                                    text = "ADICIONAR ($parsedBgCost XP)",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    multiplierTarget?.let { target ->
        var multInput by remember(target.fieldId) {
            mutableStateOf(target.customMultiplier?.toString().orEmpty())
        }
        AlertDialog(
            onDismissRequest = { multiplierTarget = null },
            containerColor = theme.bgCard,
            shape = cardShape,
            title = {
                Text(
                    text = "MULTIPLICADOR MANUAL · ${target.label}",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                    color = theme.textPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Defina um multiplicador manual (custo = nível × multiplicador) para sistemas agnósticos ou regras da casa. Deixe vazio para usar a regra padrão.",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = theme.textSecondary
                    )
                    OutlinedTextField(
                        value = multInput,
                        onValueChange = { multInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("MULTIPLICADOR (ex: 3, 5, 7)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = xpTextFieldColors,
                        shape = pillShape
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val parsed = multInput.toIntOrNull()
                        onSetCustomMultiplier(target.fieldId, parsed)
                        multiplierTarget = null
                    },
                    shape = pillShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = theme.accentBlack,
                        contentColor = theme.accentContrast
                    )
                ) {
                    Text("APLICAR", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(onClick = {
                        onSetCustomMultiplier(target.fieldId, null)
                        multiplierTarget = null
                    }) {
                        Text("PADRÃO", fontFamily = FontFamily.Monospace, color = theme.accentPrimary)
                    }
                    TextButton(onClick = { multiplierTarget = null }) {
                        Text("FECHAR", fontFamily = FontFamily.Monospace, color = theme.textMuted)
                    }
                }
            }
        )
    }
}

@Composable
private fun XpMetricBox(label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.cardCornerRadius)
    Column(
        modifier = modifier
            .background(theme.bgCardAlt, shape)
            .border(theme.borderWidth, theme.borderColor, shape)
            .padding(10.dp)
    ) {
        Text(label, fontFamily = FontFamily.Monospace, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = theme.textMuted)
        Text(value, fontFamily = FontFamily.Monospace, fontSize = 22.sp, fontWeight = FontWeight.Black, color = color)
    }
}

@Composable
private fun FilterPill(label: String, selected: Boolean, onClick: () -> Unit) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    Surface(
        modifier = Modifier
            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
            .clickable(onClick = onClick),
        shape = pillShape,
        color = if (selected) theme.accentBlack else theme.bgCard,
        border = BorderStroke(theme.borderWidth, theme.borderColor)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) theme.accentContrast else theme.textPrimary
            )
        }
    }
}
