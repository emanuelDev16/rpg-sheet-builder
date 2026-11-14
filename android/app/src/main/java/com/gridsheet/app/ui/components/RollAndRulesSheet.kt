package com.gridsheet.app.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gridsheet.app.core.RollLogEntry
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.data.RulesSearchResponse
import com.gridsheet.app.ui.SideSheetMode
import com.gridsheet.app.ui.theme.CyberColors
import com.gridsheet.app.ui.theme.CyberDimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RollAndRulesBottomSheet(
    mode: SideSheetMode,
    systemId: SystemId,
    systemName: String,
    quickDice: List<String>,
    logs: List<RollLogEntry>,
    rulesLoading: Boolean,
    rulesResult: RulesSearchResponse?,
    onSwitchMode: (SideSheetMode) -> Unit,
    onRollExpression: (String, String) -> Unit,
    onClearLogs: () -> Unit,
    onSearchRules: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var diceExpr by remember(systemId) { mutableStateOf(quickDice.getOrElse(1) { quickDice.first() }) }
    var rulesQuery by remember { mutableStateOf("") }
    val context = LocalContext.current

    LaunchedEffect(systemId) {
        diceExpr = quickDice.getOrElse(1) { quickDice.first() }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CyberColors.BgCard
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.84f)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
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
                        Text("LIMPAR", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberColors.AccentDanger)
                    }
                }
            }

            if (mode == SideSheetMode.LOGS) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BasicTextField(
                        value = diceExpr,
                        onValueChange = { diceExpr = it },
                        singleLine = true,
                        textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = CyberColors.InkPrimary),
                        modifier = Modifier
                            .weight(1f)
                            .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                            .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                            .padding(horizontal = 10.dp, vertical = 9.dp)
                    )
                    Button(
                        onClick = { onRollExpression("ROLAGEM RÁPIDA", diceExpr) },
                        shape = RoundedCornerShape(CyberDimens.ControlRadius),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.AccentBlack)
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
                                diceExpr = preset
                                onRollExpression("ROLAGEM $preset", preset)
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(CyberDimens.SmallRadius),
                            border = BorderStroke(1.dp, CyberColors.BorderInk),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)
                        ) {
                            Text(
                                text = preset.uppercase(),
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = CyberColors.InkPrimary
                            )
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(logs, key = { it.id }) { entry ->
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(CyberDimens.ControlRadius),
                            color = CyberColors.BgCardAlt,
                            border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(entry.label, fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CyberColors.InkPrimary)
                                    Text(entry.timestamp, fontFamily = FontFamily.Monospace, fontSize = 10.sp, color = CyberColors.InkMuted)
                                }
                                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(
                                        text = "${entry.total}",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 28.sp,
                                        color = if (entry.isFumble) CyberColors.AccentDanger else CyberColors.AccentWine
                                    )
                                    if (entry.isPoolRoll) {
                                        Text(
                                            text = if (entry.isFumble) "BOTCH" else "SUCS",
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = CyberColors.InkMuted,
                                            modifier = Modifier.padding(bottom = 5.dp)
                                        )
                                    }
                                }
                                Text(entry.breakdown, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberColors.InkSecondary)
                                Text(entry.formula, fontFamily = FontFamily.Monospace, fontSize = 10.sp, color = CyberColors.InkMuted)
                            }
                        }
                    }
                }
            } else {
                Text(
                    text = "CONTEXTO ATIVO: $systemName",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberColors.AccentWine
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BasicTextField(
                        value = rulesQuery,
                        onValueChange = { rulesQuery = it },
                        singleLine = true,
                        textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = CyberColors.InkPrimary),
                        decorationBox = { inner ->
                            Box {
                                if (rulesQuery.isEmpty()) {
                                    Text("Ex: grappling, concentration, frenzy...", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberColors.InkMuted)
                                }
                                inner()
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                            .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                            .padding(horizontal = 10.dp, vertical = 9.dp)
                    )
                    Button(
                        onClick = { onSearchRules(rulesQuery) },
                        enabled = !rulesLoading,
                        shape = RoundedCornerShape(CyberDimens.ControlRadius),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.AccentBlack)
                    ) {
                        Text("BUSCAR ↗", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }

                if (rulesLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(color = CyberColors.AccentWine)
                    }
                } else if (rulesResult != null) {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (!rulesResult.ok && !rulesResult.error.isNullOrBlank()) {
                            item {
                                Surface(
                                    shape = RoundedCornerShape(CyberDimens.ControlRadius),
                                    color = CyberColors.AccentDangerSoft,
                                    border = BorderStroke(1.dp, CyberColors.AccentDanger)
                                ) {
                                    Text(
                                        text = rulesResult.error,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 12.sp,
                                        color = CyberColors.AccentDanger,
                                        modifier = Modifier.padding(12.dp)
                                    )
                                }
                            }
                        } else {
                            item {
                                Surface(
                                    shape = RoundedCornerShape(CyberDimens.ControlRadius),
                                    color = CyberColors.BgCardAlt,
                                    border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
                                ) {
                                    Text(
                                        text = rulesResult.answer,
                                        fontSize = 13.sp,
                                        color = CyberColors.InkPrimary,
                                        modifier = Modifier.padding(12.dp)
                                    )
                                }
                            }
                            items(rulesResult.sources) { src ->
                                Text(
                                    text = "↗ ${src.title}",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    color = CyberColors.AccentWine,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            runCatching {
                                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(src.uri)))
                                            }
                                        }
                                        .padding(vertical = 4.dp)
                                )
                            }
                        }
                    }
                } else {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "Consulte regras em tempo real via Google Search Grounding usando o contexto do sistema selecionado.",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = CyberColors.InkMuted
                    )
                }
            }
        }
    }
}

@Composable
private fun ModeTabButton(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(CyberDimens.ControlRadius),
        color = if (selected) CyberColors.AccentBlack else CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
    ) {
        Text(
            text = label,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) CyberColors.InkInverse else CyberColors.InkPrimary,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
        )
    }
}
