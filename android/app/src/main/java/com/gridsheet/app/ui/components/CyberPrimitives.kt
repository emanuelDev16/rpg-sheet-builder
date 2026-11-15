package com.gridsheet.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gridsheet.app.core.AppMode
import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluation
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.TabId
import com.gridsheet.app.ui.theme.CyberColors
import com.gridsheet.app.ui.theme.CyberDimens
import kotlin.math.roundToInt

@Composable
fun CyberGridBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CyberColors.BgCanvas)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val step = 36.dp.toPx()
            val crossHalf = 3.dp.toPx()
            val lineColor = CyberColors.BorderInk.copy(alpha = 0.075f)
            val crossColor = CyberColors.AccentWine.copy(alpha = 0.35f)

            var x = 0f
            while (x <= size.width) {
                drawLine(lineColor, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
                x += step
            }
            var y = 0f
            while (y <= size.height) {
                drawLine(lineColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
                y += step
            }

            x = 0f
            while (x <= size.width) {
                y = 0f
                while (y <= size.height) {
                    drawLine(crossColor, Offset(x - crossHalf, y), Offset(x + crossHalf, y), strokeWidth = 1.2f)
                    drawLine(crossColor, Offset(x, y - crossHalf), Offset(x, y + crossHalf), strokeWidth = 1.2f)
                    y += step
                }
                x += step
            }
        }
        content()
    }
}

@Composable
fun BentoCardView(
    card: SheetCard,
    mode: AppMode,
    evaluation: SheetEvaluation,
    onUpdateNumber: (String, Double) -> Unit,
    onUpdateText: (String, String) -> Unit,
    onUpdateBoolean: (String, Boolean) -> Unit,
    onAdjustResource: (String, Int) -> Unit,
    onAdjustHealthDamage: (String, String, Int) -> Unit,
    onSetResource: (String, Int) -> Unit,
    onRoll: (String, String) -> Unit,
    onAddRow: (String) -> Unit,
    onUpdateRow: (String, String, String?, String?) -> Unit,
    onRemoveRow: (String, String) -> Unit,
    onUpdateSchema: (String, (SheetField) -> SheetField) -> Unit,
    onAddField: (String, String, String, FieldKind, String) -> Unit,
    onRemoveField: (String, String) -> Unit,
    onRemoveCard: (String) -> Unit
) {
    var showAddFieldDialog by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(CyberDimens.CardRadius),
        color = CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderStrong, CyberColors.BorderInk),
        shadowElevation = 2.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Card Header Strip
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CyberColors.BgHeaderStrip)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = card.code,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberColors.AccentWine
                    )
                    Text(
                        text = card.title,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = CyberColors.InkPrimary
                    )
                }
                if (mode == AppMode.EDICAO) {
                    Surface(
                        modifier = Modifier.clickable { onRemoveCard(card.id) },
                        shape = RoundedCornerShape(4.dp),
                        color = CyberColors.BgCard,
                        border = BorderStroke(1.dp, CyberColors.BorderInk)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Remover bloco ${card.title}",
                            tint = CyberColors.AccentDanger,
                            modifier = Modifier
                                .padding(6.dp)
                                .size(14.dp)
                        )
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(RoundedCornerShape(50))
                                .background(CyberColors.BgCard)
                                .border(1.dp, CyberColors.BorderInk, RoundedCornerShape(50))
                        )
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(RoundedCornerShape(50))
                                .background(CyberColors.AccentWine)
                        )
                    }
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(CyberDimens.BorderWidth)
                    .background(CyberColors.BorderInk)
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (card.fields.isEmpty() && mode == AppMode.EDICAO) {
                    Text(
                        text = "Bloco vazio. Toque abaixo para adicionar o primeiro campo.",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = CyberColors.InkMuted
                    )
                }

                card.fields.forEach { field ->
                    FieldRenderer(
                        field = field,
                        mode = mode,
                        evaluation = evaluation,
                        onUpdateNumber = onUpdateNumber,
                        onUpdateText = onUpdateText,
                        onUpdateBoolean = onUpdateBoolean,
                        onAdjustResource = onAdjustResource,
                        onAdjustHealthDamage = onAdjustHealthDamage,
                        onSetResource = onSetResource,
                        onRoll = onRoll,
                        onAddRow = onAddRow,
                        onUpdateRow = onUpdateRow,
                        onRemoveRow = onRemoveRow,
                        onUpdateSchema = onUpdateSchema,
                        onRemoveField = { onRemoveField(card.id, field.id) }
                    )
                }

                if (mode == AppMode.EDICAO) {
                    OutlinedButton(
                        onClick = { showAddFieldDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(CyberDimens.ControlRadius),
                        border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = CyberColors.BgCardAlt,
                            contentColor = CyberColors.InkPrimary
                        )
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "ADICIONAR CAMPO EM ${card.code}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    if (showAddFieldDialog) {
        AddFieldDialog(
            cardCode = card.code,
            onDismiss = { showAddFieldDialog = false },
            onConfirm = { label, key, kind, expr ->
                onAddField(card.id, label, key, kind, expr)
                showAddFieldDialog = false
            }
        )
    }
}

@Composable
fun CustomCardBuilderView(
    activeTab: TabId,
    isEmptySheet: Boolean,
    onCreateCard: (TabId, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(CyberDimens.CardRadius),
        color = CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderStrong, CyberColors.AccentWine),
        shadowElevation = 2.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CyberColors.BgHeaderStrip)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "//CONSTRUTOR_CUSTOM",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberColors.AccentWine
                    )
                    Text(
                        text = if (isEmptySheet) "CRIAR FICHA DO ZERO" else "ADICIONAR NOVO BLOCO",
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = CyberColors.InkPrimary
                    )
                }
                Text(
                    text = if (activeTab == TabId.GERAL) "ABA 01" else "ABA 02",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberColors.AccentWine
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(CyberDimens.BorderWidth)
                    .background(CyberColors.BorderInk)
            )
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (isEmptySheet) {
                    Text(
                        text = "Nenhum campo pré-definido foi carregado. Crie seu primeiro bloco (ex: Atributos, Recursos, Perícias) e depois adicione cada campo dentro dele.",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = CyberColors.InkSecondary
                    )
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("TÍTULO DO BLOCO (ex: ATRIBUTOS)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text("TAG TÉCNICA (opcional, ex: //ATRIBUTOS)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = {
                        onCreateCard(activeTab, title, code)
                        title = ""
                        code = ""
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(CyberDimens.ControlRadius),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CyberColors.AccentBlack,
                        contentColor = CyberColors.InkInverse
                    )
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "CRIAR BLOCO",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun FieldRenderer(
    field: SheetField,
    mode: AppMode,
    evaluation: SheetEvaluation,
    onUpdateNumber: (String, Double) -> Unit,
    onUpdateText: (String, String) -> Unit,
    onUpdateBoolean: (String, Boolean) -> Unit,
    onAdjustResource: (String, Int) -> Unit,
    onAdjustHealthDamage: (String, String, Int) -> Unit,
    onSetResource: (String, Int) -> Unit,
    onRoll: (String, String) -> Unit,
    onAddRow: (String) -> Unit,
    onUpdateRow: (String, String, String?, String?) -> Unit,
    onRemoveRow: (String, String) -> Unit,
    onUpdateSchema: (String, (SheetField) -> SheetField) -> Unit,
    onRemoveField: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (mode == AppMode.EDICAO) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CyberColors.BgCardAlt, RoundedCornerShape(4.dp))
                    .border(1.dp, CyberColors.BorderSubtle, RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "KEY: ${field.key} · ${field.kind.name}",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = CyberColors.InkSecondary
                )
                TextButton(
                    onClick = onRemoveField,
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 6.dp, vertical = 0.dp)
                ) {
                    Text(
                        text = "REMOVER ×",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberColors.AccentDanger
                    )
                }
            }
        }

        when (field.kind) {
            FieldKind.NUMBER -> {
                val initial = field.numValue ?: 0.0
                val displayNum = if (initial % 1.0 == 0.0) initial.toInt().toString() else initial.toString()
                var textState by remember(field.id, displayNum) { mutableStateOf(displayNum) }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = field.label,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = CyberColors.InkPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    BasicTextField(
                        value = textState,
                        onValueChange = { raw ->
                            textState = raw
                            raw.toDoubleOrNull()?.let { onUpdateNumber(field.id, it) }
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        textStyle = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = CyberColors.InkPrimary
                        ),
                        modifier = Modifier
                            .width(86.dp)
                            .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                            .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                            .padding(horizontal = 10.dp, vertical = 7.dp)
                    )
                }
            }

            FieldKind.TEXT -> {
                var textState by remember(field.id, field.textValue) { mutableStateOf(field.textValue.orEmpty()) }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = field.label,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = CyberColors.InkSecondary
                    )
                    BasicTextField(
                        value = textState,
                        onValueChange = { next ->
                            textState = next
                            onUpdateText(field.id, next)
                        },
                        textStyle = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = CyberColors.InkPrimary
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(CyberColors.BgInput, RoundedCornerShape(CyberDimens.ControlRadius))
                            .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                            .padding(horizontal = 10.dp, vertical = 8.dp)
                    )
                }
            }

            FieldKind.CALCULATED -> {
                val info = evaluation.computedByFieldId[field.id]
                val isError = info != null && !info.ok
                val dashColor = if (isError) CyberColors.AccentDanger else CyberColors.AccentWine
                val bgColor = if (isError) CyberColors.AccentDangerSoft else CyberColors.AccentCreamBadge

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                        Text(
                            text = field.label,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = CyberColors.InkPrimary
                        )
                        if (mode == AppMode.EDICAO) {
                            var formulaDraft by remember(field.id, field.formula) { mutableStateOf(field.formula.orEmpty()) }
                            BasicTextField(
                                value = formulaDraft,
                                onValueChange = { next ->
                                    formulaDraft = next
                                    onUpdateSchema(field.id) { it.copy(formula = next) }
                                },
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    color = CyberColors.AccentWine
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 3.dp)
                                    .background(CyberColors.BgInput, RoundedCornerShape(4.dp))
                                    .border(1.dp, CyberColors.AccentWine, RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 4.dp)
                            )
                        } else {
                            Text(
                                text = "= ${field.formula.orEmpty()}",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                color = CyberColors.InkMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .background(bgColor, RoundedCornerShape(CyberDimens.ControlRadius))
                            .drawBehind {
                                drawRoundRect(
                                    color = dashColor,
                                    style = Stroke(
                                        width = CyberDimens.BorderWidth.toPx(),
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f), 0f)
                                    ),
                                    cornerRadius = CornerRadius(CyberDimens.ControlRadius.toPx())
                                )
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = info?.formatted ?: "--",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Black,
                            fontSize = 14.sp,
                            color = dashColor
                        )
                    }
                }
            }

            FieldKind.RESOURCE -> {
                if (field.damageTrack == true) {
                    val maxVal = (field.max ?: 7).coerceAtLeast(1)
                    val agg = (field.aggravatedDamage ?: kotlin.math.max(0, maxVal - (field.numValue ?: maxVal.toDouble()).roundToInt())).coerceIn(0, maxVal)
                    val sup = if (agg >= maxVal) 0 else (field.superficialDamage ?: 0).coerceIn(0, maxVal - 1)
                    val healthy = (maxVal - agg).coerceAtLeast(0)
                    val totalSupEq = agg * maxVal + sup

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(CyberColors.BgCardAlt, RoundedCornerShape(CyberDimens.ControlRadius))
                            .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = field.label,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = CyberColors.InkPrimary
                                )
                                Box(
                                    modifier = Modifier
                                        .background(CyberColors.AccentCreamBadge, RoundedCornerShape(3.dp))
                                        .border(1.dp, CyberColors.AccentWine, RoundedCornerShape(3.dp))
                                        .padding(horizontal = 5.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "1 AGRAV = $maxVal SUP",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 9.sp,
                                        color = CyberColors.AccentWine
                                    )
                                }
                            }
                            Text(
                                text = "$healthy / $maxVal SAUDÁVEL",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = CyberColors.InkPrimary
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            for (idx in 0 until maxVal) {
                                val state = when {
                                    idx < agg -> "aggravated"
                                    idx < agg + sup -> "superficial"
                                    else -> "healthy"
                                }
                                val bg = when (state) {
                                    "aggravated" -> CyberColors.AccentBlack
                                    "superficial" -> CyberColors.AccentWine
                                    else -> CyberColors.BgCard
                                }
                                val borderCol = when (state) {
                                    "aggravated" -> CyberColors.AccentBlack
                                    "superficial" -> CyberColors.AccentWine
                                    else -> CyberColors.BorderInk.copy(alpha = 0.45f)
                                }
                                val mark = when (state) {
                                    "aggravated" -> "✕"
                                    "superficial" -> "/"
                                    else -> ""
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(18.dp)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(bg)
                                        .border(1.dp, borderCol, RoundedCornerShape(2.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (mark.isNotEmpty()) {
                                        Text(
                                            text = mark,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 10.sp,
                                            color = CyberColors.InkInverse
                                        )
                                    }
                                }
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(CyberColors.BorderSubtle)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "DANO AGRAVADO ($totalSupEq SUP EQ)",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = CyberColors.InkPrimary,
                                modifier = Modifier.weight(1f)
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                SmallSquareButton(label = "-") { onAdjustHealthDamage(field.id, "aggravated", -1) }
                                Text(
                                    text = "$agg / $maxVal",
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = CyberColors.InkPrimary
                                )
                                SmallSquareButton(label = "+") { onAdjustHealthDamage(field.id, "aggravated", +1) }
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "DANO SUPERFICIAL",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = CyberColors.AccentWine,
                                modifier = Modifier.weight(1f)
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                SmallSquareButton(label = "-") { onAdjustHealthDamage(field.id, "superficial", -1) }
                                Text(
                                    text = "$sup / $maxVal",
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = CyberColors.AccentWine
                                )
                                SmallSquareButton(label = "+") { onAdjustHealthDamage(field.id, "superficial", +1) }
                            }
                        }
                    }
                } else {
                val maxVal = (field.max ?: 10).coerceIn(1, 50)
                val current = (field.numValue ?: 0.0).roundToInt().coerceIn(0, maxVal)

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CyberColors.BgCardAlt, RoundedCornerShape(CyberDimens.ControlRadius))
                        .border(1.dp, CyberColors.BorderSubtle, RoundedCornerShape(CyberDimens.ControlRadius))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = field.label,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = CyberColors.InkPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            SmallSquareButton(label = "-") { onAdjustResource(field.id, -1) }
                            Text(
                                text = "$current / $maxVal",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = CyberColors.InkPrimary
                            )
                            SmallSquareButton(label = "+") { onAdjustResource(field.id, +1) }
                        }
                    }

                    // Segmented bar (max 22 blocks displayed proportionally if max > 22)
                    val displaySegments = maxVal.coerceAtMost(22)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        for (idx in 1..displaySegments) {
                            val threshold = ((idx.toFloat() / displaySegments.toFloat()) * maxVal).roundToInt()
                            val filled = current >= threshold && current > 0
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(14.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(if (filled) CyberColors.AccentWine else CyberColors.AccentWineSoft)
                                    .border(
                                        1.dp,
                                        if (filled) CyberColors.AccentWine else CyberColors.AccentWine.copy(alpha = 0.28f),
                                        RoundedCornerShape(2.dp)
                                    )
                                    .clickable {
                                        val target = if (displaySegments == maxVal) {
                                            if (current == idx) idx - 1 else idx
                                        } else {
                                            threshold
                                        }
                                        onSetResource(field.id, target)
                                    }
                            )
                        }
                    }
                }
                }
            }

            FieldKind.BOOLEAN -> {
                val checked = field.boolValue == true
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(CyberDimens.ControlRadius))
                        .background(CyberColors.BgInput)
                        .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                        .clickable { onUpdateBoolean(field.id, !checked) }
                        .padding(horizontal = 10.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .background(
                                    if (checked) CyberColors.AccentWine else CyberColors.BgCard,
                                    RoundedCornerShape(4.dp)
                                )
                                .border(CyberDimens.BorderStrong, CyberColors.BorderInk, RoundedCornerShape(4.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            if (checked) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = CyberColors.InkInverse,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                text = field.label,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = CyberColors.InkPrimary
                            )
                            field.hint?.let {
                                Text(
                                    text = it,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    color = CyberColors.InkMuted
                                )
                            }
                        }
                    }
                    Text(
                        text = if (checked) "ATIVO" else "INATIVO",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = if (checked) CyberColors.AccentWine else CyberColors.InkMuted
                    )
                }
            }

            FieldKind.ROLL -> {
                val label = field.rollLabel ?: field.label
                val expr = field.rollExpr ?: "2d6"
                val preview = FormulaEngine.resolveRollPreview(expr, evaluation.variables)

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (mode == AppMode.EDICAO) {
                        var exprDraft by remember(field.id, expr) { mutableStateOf(expr) }
                        BasicTextField(
                            value = exprDraft,
                            onValueChange = { next ->
                                exprDraft = next
                                onUpdateSchema(field.id) { it.copy(rollExpr = next) }
                            },
                            singleLine = true,
                            textStyle = TextStyle(
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                color = CyberColors.AccentWine
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CyberColors.BgInput, RoundedCornerShape(4.dp))
                                .border(1.dp, CyberColors.AccentWine, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 5.dp)
                        )
                    }
                    Button(
                        onClick = { onRoll(label, expr) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(CyberDimens.ControlRadius),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CyberColors.AccentBlack,
                            contentColor = CyberColors.InkInverse
                        ),
                        border = BorderStroke(CyberDimens.BorderStrong, CyberColors.AccentBlack)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "$label · $preview",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = "↗",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Black,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }

            FieldKind.REPEATABLE -> {
                val cols = field.columns ?: listOf("ITEM", "VALOR")
                val rows = field.rows.orEmpty()

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(CyberDimens.BorderWidth, CyberColors.BorderInk, RoundedCornerShape(CyberDimens.ControlRadius))
                        .clip(RoundedCornerShape(CyberDimens.ControlRadius)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(CyberColors.BgHeaderStrip)
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = field.label,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = CyberColors.InkPrimary
                        )
                        if (field.col2Type == "number") {
                            Text(
                                text = "//CARGA: ${evaluation.totalCargoWeight}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = CyberColors.AccentWine
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(CyberColors.BgCardAlt)
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = cols.getOrElse(0) { "ITEM" },
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = CyberColors.InkMuted,
                            modifier = Modifier.weight(1.7f)
                        )
                        Text(
                            text = cols.getOrElse(1) { "QTD" },
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = CyberColors.InkMuted,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(Modifier.width(26.dp))
                    }

                    rows.forEach { row ->
                        var c1 by remember(row.id, row.col1) { mutableStateOf(row.col1) }
                        var c2 by remember(row.id, row.col2) { mutableStateOf(row.col2) }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(CyberColors.BorderSubtle)
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CyberColors.BgCard)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = c1,
                                onValueChange = {
                                    c1 = it
                                    onUpdateRow(field.id, row.id, it, null)
                                },
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    color = CyberColors.InkPrimary
                                ),
                                modifier = Modifier.weight(1.7f).padding(end = 6.dp)
                            )
                            BasicTextField(
                                value = c2,
                                onValueChange = {
                                    c2 = it
                                    onUpdateRow(field.id, row.id, null, it)
                                },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = if (field.col2Type == "number") KeyboardType.Decimal else KeyboardType.Text
                                ),
                                textStyle = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CyberColors.AccentWine
                                ),
                                modifier = Modifier.weight(1f)
                            )
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .clickable { onRemoveRow(field.id, row.id) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Remover linha",
                                    tint = CyberColors.InkMuted,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(CyberColors.BorderInk)
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(CyberColors.BgCardAlt)
                            .clickable { onAddRow(field.id) }
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "+ ADICIONAR LINHA",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = CyberColors.InkPrimary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SmallSquareButton(label: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .size(26.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(CyberDimens.SmallRadius),
        color = CyberColors.BgCard,
        border = BorderStroke(CyberDimens.BorderWidth, CyberColors.BorderInk)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 13.sp,
                color = CyberColors.InkPrimary
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddFieldDialog(
    cardCode: String,
    onDismiss: () -> Unit,
    onConfirm: (String, String, FieldKind, String) -> Unit
) {
    var label by remember { mutableStateOf("") }
    var key by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf(FieldKind.NUMBER) }
    var expr by remember { mutableStateOf("") }

    val kindLabels = listOf(
        FieldKind.NUMBER to "NÚMERO",
        FieldKind.TEXT to "TEXTO",
        FieldKind.CALCULATED to "FÓRMULA",
        FieldKind.RESOURCE to "RECURSO",
        FieldKind.BOOLEAN to "BOOLEANO",
        FieldKind.ROLL to "ROLAGEM",
        FieldKind.REPEATABLE to "LISTA"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.BgCard,
        title = {
            Text(
                text = "NOVO CAMPO EM $cardCode",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = CyberColors.InkPrimary
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = label,
                    onValueChange = {
                        label = it
                        key = it.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
                    },
                    label = { Text("RÓTULO", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    label = { Text("CHAVE (FÓRMULAS)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    kindLabels.forEach { (k, title) ->
                        val selected = kind == k
                        Surface(
                            modifier = Modifier.clickable { kind = k },
                            shape = RoundedCornerShape(4.dp),
                            color = if (selected) CyberColors.AccentWine else CyberColors.BgCardAlt,
                            border = BorderStroke(1.dp, CyberColors.BorderInk)
                        ) {
                            Text(
                                text = title,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (selected) CyberColors.InkInverse else CyberColors.InkPrimary,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 5.dp)
                            )
                        }
                    }
                }
                if (kind == FieldKind.CALCULATED || kind == FieldKind.ROLL) {
                    OutlinedTextField(
                        value = expr,
                        onValueChange = { expr = it },
                        label = {
                            Text(
                                if (kind == FieldKind.CALCULATED) "FÓRMULA (ex: atributo * 2)" else "EXPRESSÃO (ex: 2d6 + atributo)",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp
                            )
                        },
                        singleLine = true
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(label, key, kind, expr) },
                colors = ButtonDefaults.buttonColors(containerColor = CyberColors.AccentBlack)
            ) {
                Text("CRIAR", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("CANCELAR", fontFamily = FontFamily.Monospace, color = CyberColors.InkMuted)
            }
        }
    )
}
