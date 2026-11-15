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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.UpgradableTrait
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.ui.theme.CyberColors
import com.gridsheet.app.ui.theme.CyberDimens

@Composable
fun XpUpgradeWorkspace(
    sheet: CharacterSheetState,
    filter: XpUpgradeCategory?,
    onFilterChange: (XpUpgradeCategory?) -> Unit,
    onAwardXp: (Int, String) -> Unit,
    onUpgradeTrait: (String) -> Unit,
    onToggleDisciplineClan: (String) -> Unit,
    onSetCustomMultiplier: (String, Int?) -> Unit,
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

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // Card 1: XP Monitor
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(CyberDimens.CardRadius),
            color = CyberColors.BgCard,
            border = BorderStroke(CyberDimens.BorderStrong, CyberColors.BorderInk)
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CyberColors.BgHeaderStrip)
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
                            color = CyberColors.AccentWine
                        )
                        Text(
                            text = "EXPERIENCE MONITOR",
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp,
                            color = CyberColors.InkPrimary
                        )
                    }
                    if (hasRecentUpgrade) {
                        OutlinedButton(
                            onClick = onUndoLastUpgrade,
                            modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                            shape = RoundedCornerShape(CyberDimens.ControlRadius),
                            border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "DESFAZER (UNDO)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = CyberColors.InkPrimary
                            )
                        }
                    }
                }
                Box(Modifier.fillMaxWidth().height(CyberDimens.BorderWidth).background(CyberColors.BorderInk))

                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        XpMetricBox("AVAILABLE XP", "$availableXp", CyberColors.AccentWine, Modifier.weight(1f))
                        XpMetricBox("TOTAL EARNED", "${xp.totalEarned}", CyberColors.InkPrimary, Modifier.weight(1f))
                        XpMetricBox("TOTAL SPENT", "${xp.spent}", CyberColors.InkSecondary, Modifier.weight(1f))
                    }

                    val pct = if (xp.totalEarned > 0) ((xp.spent.toFloat() / xp.totalEarned) * 100).toInt().coerceIn(0, 100) else 0
                    val filledBlocks = ((pct / 100f) * 12).toInt()
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("XP ALLOCATION", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = CyberColors.InkMuted)
                            Text("${xp.spent} / ${xp.totalEarned} SPENT · $pct%", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = CyberColors.InkPrimary)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            for (i in 1..12) {
                                val filled = i <= filledBlocks
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(12.dp)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(if (filled) CyberColors.AccentWine else CyberColors.AccentWineSoft)
                                        .border(1.dp, if (filled) CyberColors.AccentWine else CyberColors.AccentWine.copy(alpha = 0.25f), RoundedCornerShape(2.dp))
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
                                shape = RoundedCornerShape(CyberDimens.ControlRadius),
                                border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 6.dp)
                            ) {
                                Text(label, fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CyberColors.InkPrimary)
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
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = CyberColors.InkPrimary),
                            modifier = Modifier
                                .width(64.dp)
                                .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                                .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        )
                        BasicTextField(
                            value = customReason,
                            onValueChange = { customReason = it },
                            singleLine = true,
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = CyberColors.InkPrimary),
                            decorationBox = { inner ->
                                Box {
                                    if (customReason.isEmpty()) {
                                        Text("Nota (ex: Capítulo 04)", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberColors.InkMuted)
                                    }
                                    inner()
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                                .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        )
                        Button(
                            onClick = {
                                val delta = customAmount.toIntOrNull() ?: 0
                                onAwardXp(delta, customReason)
                                customReason = ""
                            },
                            shape = RoundedCornerShape(CyberDimens.ControlRadius),
                            colors = ButtonDefaults.buttonColors(containerColor = CyberColors.AccentBlack),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text("ADD ↗", fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (xp.ledger.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("XP LEDGER (${xp.ledger.size})", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = CyberColors.InkMuted)
                            xp.ledger.take(5).forEach { entry ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(CyberColors.BgInput, RoundedCornerShape(4.dp))
                                        .border(1.dp, CyberColors.BorderSubtle, RoundedCornerShape(4.dp))
                                        .padding(horizontal = 8.dp, vertical = 5.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${entry.timestamp}  ${entry.label}",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        color = CyberColors.InkPrimary,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = if (entry.delta > 0) "+${entry.delta} XP" else "${entry.delta} XP",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (entry.delta > 0) CyberColors.AccentWine else CyberColors.InkPrimary
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
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(CyberDimens.CardRadius),
            color = CyberColors.BgCard,
            border = BorderStroke(CyberDimens.BorderStrong, CyberColors.BorderInk)
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CyberColors.BgHeaderStrip)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("//TRAIT_UPGRADES", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = CyberColors.AccentWine)
                        Text("XP EVOLUTION CATALOG", fontWeight = FontWeight.Black, fontSize = 15.sp, color = CyberColors.InkPrimary)
                    }
                    Text(
                        text = "$possibleCount / ${filteredTraits.size} COMPRÁVEIS",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberColors.AccentWine
                    )
                }
                Box(Modifier.fillMaxWidth().height(CyberDimens.BorderWidth).background(CyberColors.BorderInk))

                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "REGRAS: ${rulesSummary.joinToString(" · ")} · ORÇAMENTO: $availableXp XP",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = CyberColors.InkMuted
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
                                .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                                .border(CyberDimens.BorderWidth, CyberColors.BorderSubtle, RoundedCornerShape(CyberDimens.ControlRadius))
                                .padding(14.dp)
                        ) {
                            Text(
                                text = "Nenhum campo elegível encontrado nesta categoria na ficha atual.",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                color = CyberColors.InkSecondary
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
                                    color = CyberColors.AccentWine
                                )
                                items.forEach { trait ->
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(CyberColors.BgCardAlt, RoundedCornerShape(CyberDimens.ControlRadius))
                                            .border(
                                                CyberDimens.BorderWidth,
                                                if (trait.isPossible) CyberColors.BorderInk else CyberColors.BorderSubtle,
                                                RoundedCornerShape(CyberDimens.ControlRadius)
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
                                                    text = "${trait.category.name} · ${trait.formulaLabel}",
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 10.sp,
                                                    color = CyberColors.AccentWine,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(
                                                    text = if (trait.isMaxed) {
                                                        "${trait.label}  ${trait.currentValue} (MAX)"
                                                    } else {
                                                        "${trait.label}  ${trait.currentValue} → ${trait.nextValue}"
                                                    },
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = CyberColors.InkPrimary
                                                )
                                            }
                                            Button(
                                                onClick = { onUpgradeTrait(trait.fieldId) },
                                                enabled = trait.isPossible,
                                                modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                                shape = RoundedCornerShape(CyberDimens.ControlRadius),
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = CyberColors.AccentBlack,
                                                    disabledContainerColor = CyberColors.BgInput,
                                                    disabledContentColor = CyberColors.InkMuted
                                                ),
                                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                                            ) {
                                                val btnText = when {
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

                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            if (trait.category == XpUpgradeCategory.DISCIPLINE && isWod) {
                                                Surface(
                                                    modifier = Modifier
                                                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                                        .clickable { onToggleDisciplineClan(trait.fieldId) },
                                                    shape = RoundedCornerShape(CyberDimens.SmallRadius),
                                                    color = if (trait.isOutOfClan) CyberColors.AccentWineSoft else CyberColors.BgCard,
                                                    border = BorderStroke(1.dp, if (trait.isOutOfClan) CyberColors.AccentWine else CyberColors.BorderInk)
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
                                                            color = if (trait.isOutOfClan) CyberColors.AccentWine else CyberColors.InkPrimary
                                                        )
                                                    }
                                                }
                                            }
                                            Surface(
                                                modifier = Modifier
                                                    .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                                    .clickable { multiplierTarget = trait },
                                                shape = RoundedCornerShape(CyberDimens.SmallRadius),
                                                color = if (trait.customMultiplier != null) CyberColors.AccentCreamBadge else CyberColors.BgCard,
                                                border = BorderStroke(1.dp, CyberColors.BorderInk)
                                            ) {
                                                Box(
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(
                                                        text = if (trait.customMultiplier != null) "MULT: ×${trait.customMultiplier}" else "MULT: AUTO",
                                                        fontFamily = FontFamily.Monospace,
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = CyberColors.InkPrimary
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

    multiplierTarget?.let { target ->
        var multInput by remember(target.fieldId) {
            mutableStateOf(target.customMultiplier?.toString().orEmpty())
        }
        AlertDialog(
            onDismissRequest = { multiplierTarget = null },
            containerColor = CyberColors.BgCard,
            title = {
                Text(
                    text = "MULTIPLICADOR MANUAL · ${target.label}",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                    color = CyberColors.InkPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Defina um multiplicador manual (custo = nível × multiplicador) para sistemas agnósticos ou regras da casa. Deixe vazio para usar a regra padrão.",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = CyberColors.InkSecondary
                    )
                    OutlinedTextField(
                        value = multInput,
                        onValueChange = { multInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("MULTIPLICADOR (ex: 3, 5, 7)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
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
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.AccentBlack)
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
                        Text("PADRÃO", fontFamily = FontFamily.Monospace, color = CyberColors.AccentWine)
                    }
                    TextButton(onClick = { multiplierTarget = null }) {
                        Text("FECHAR", fontFamily = FontFamily.Monospace, color = CyberColors.InkMuted)
                    }
                }
            }
        )
    }
}

@Composable
private fun XpMetricBox(label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(CyberColors.BgCardAlt, RoundedCornerShape(CyberDimens.ControlRadius))
            .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
            .padding(10.dp)
    ) {
        Text(label, fontFamily = FontFamily.Monospace, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = CyberColors.InkMuted)
        Text(value, fontFamily = FontFamily.Monospace, fontSize = 22.sp, fontWeight = FontWeight.Black, color = color)
    }
}

@Composable
private fun FilterPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(CyberDimens.ControlRadius),
        color = if (selected) CyberColors.AccentBlack else CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
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
                color = if (selected) CyberColors.InkInverse else CyberColors.InkPrimary
            )
        }
    }
}
