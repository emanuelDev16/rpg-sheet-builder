package com.gridsheet.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
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
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
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
import com.gridsheet.app.core.PresetSummary
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluation
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMetadata
import com.gridsheet.app.core.SheetMetadataMapper
import com.gridsheet.app.core.TabId
import com.gridsheet.app.ui.theme.CyberDimens
import com.gridsheet.app.ui.theme.GridThemeTokens
import com.gridsheet.app.ui.theme.LocalGridTheme
import com.gridsheet.app.ui.theme.brutalistShadow
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

@Composable
private fun gridTextFieldColors(theme: GridThemeTokens = LocalGridTheme.current) = OutlinedTextFieldDefaults.colors(
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

@Composable
fun CyberGridBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val theme = LocalGridTheme.current
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(theme.bgBase)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val step = 36.dp.toPx()
            val crossHalf = 3.dp.toPx()
            val lineColor = theme.gridLineColor
            val crossColor = theme.gridCrossColor

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
    onAddField: (String, String, String, FieldKind, String, Boolean) -> Unit,
    onMoveField: (String, String, Int) -> Unit,
    onCycleRollDifficulty: (String) -> Unit,
    onToggleRollSpecialty: (String) -> Unit,
    onRemoveField: (String, String) -> Unit,
    onRemoveCard: (String) -> Unit
) {
    var showAddFieldDialog by remember { mutableStateOf(false) }
    var expandedFieldId by remember(card.id, mode) { mutableStateOf<String?>(null) }
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
        shape = cardShape,
        color = theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.borderColor),
        shadowElevation = 0.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Card Header Strip
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.bgStrip)
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
                        color = theme.accentPrimary
                    )
                    Text(
                        text = card.title,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = theme.textPrimary
                    )
                }
                if (mode == AppMode.EDICAO) {
                    Surface(
                        modifier = Modifier.clickable { onRemoveCard(card.id) },
                        shape = RoundedCornerShape(CyberDimens.SmallRadius),
                        color = theme.bgCard,
                        border = BorderStroke(1.dp, theme.borderColor)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Remover bloco ${card.title}",
                            tint = theme.accentDanger,
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
                                .background(theme.bgCard)
                                .border(1.dp, theme.borderColor, RoundedCornerShape(50))
                        )
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(RoundedCornerShape(50))
                                .background(theme.accentPrimary)
                        )
                    }
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(theme.borderWidth)
                    .background(theme.borderColor)
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (card.fields.isEmpty()) {
                    if (mode == AppMode.EDICAO) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                .clip(pillShape)
                                .background(theme.bgCardAlt)
                                .drawBehind {
                                    drawRoundRect(
                                        color = theme.accentPrimary,
                                        style = Stroke(
                                            width = theme.borderWidth.toPx(),
                                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 8f), 0f)
                                        ),
                                        cornerRadius = CornerRadius(theme.pillCornerRadius.toPx())
                                    )
                                }
                                .clickable { showAddFieldDialog = true }
                                .padding(horizontal = 12.dp, vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "+ ADICIONAR PRIMEIRO CAMPO",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = theme.accentPrimary
                            )
                        }
                    } else {
                        Text(
                            text = "Bloco vazio.",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = theme.textMuted
                        )
                    }
                }

                card.fields.forEachIndexed { index, field ->
                    FieldRenderer(
                        field = field,
                        mode = mode,
                        evaluation = evaluation,
                        isFirst = index == 0,
                        isLast = index == card.fields.lastIndex,
                        isExpanded = expandedFieldId == field.id,
                        onToggleExpand = {
                            expandedFieldId = if (expandedFieldId == field.id) null else field.id
                        },
                        onMoveUp = { onMoveField(card.id, field.id, -1) },
                        onMoveDown = { onMoveField(card.id, field.id, +1) },
                        onCycleRollDifficulty = { onCycleRollDifficulty(field.id) },
                        onToggleRollSpecialty = { onToggleRollSpecialty(field.id) },
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
                        onRemoveField = {
                            if (expandedFieldId == field.id) expandedFieldId = null
                            onRemoveField(card.id, field.id)
                        }
                    )
                }

                if (mode == AppMode.EDICAO && card.fields.isNotEmpty()) {
                    OutlinedButton(
                        onClick = { showAddFieldDialog = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                        shape = pillShape,
                        border = BorderStroke(theme.borderWidth, theme.borderColor),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = theme.bgCardAlt,
                            contentColor = theme.textPrimary
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
            onConfirm = { label, key, kind, expr, isSkillTemplate ->
                onAddField(card.id, label, key, kind, expr, isSkillTemplate)
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
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val fieldColors = gridTextFieldColors(theme)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
        shape = cardShape,
        color = theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.accentPrimary),
        shadowElevation = 0.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.bgStrip)
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
                        color = theme.accentPrimary
                    )
                    Text(
                        text = if (isEmptySheet) "CRIAR FICHA DO ZERO" else "ADICIONAR NOVO BLOCO",
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = theme.textPrimary
                    )
                }
                Text(
                    text = if (activeTab == TabId.GERAL) "ABA 01" else "ABA 02",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.accentPrimary
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(theme.borderWidth)
                    .background(theme.borderColor)
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
                        color = theme.textSecondary
                    )
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("TÍTULO DO BLOCO (ex: ATRIBUTOS)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true,
                    colors = fieldColors,
                    shape = pillShape,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text("TAG TÉCNICA (opcional, ex: //ATRIBUTOS)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true,
                    colors = fieldColors,
                    shape = pillShape,
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = {
                        onCreateCard(activeTab, title, code)
                        title = ""
                        code = ""
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                    shape = pillShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = theme.accentBlack,
                        contentColor = theme.accentContrast
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
    isFirst: Boolean,
    isLast: Boolean,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onCycleRollDifficulty: () -> Unit,
    onToggleRollSpecialty: () -> Unit,
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
    val theme = LocalGridTheme.current
    val cardShape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val fieldColors = gridTextFieldColors(theme)

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (mode == AppMode.EDICAO) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.bgCardAlt, RoundedCornerShape(CyberDimens.SmallRadius))
                    .border(1.dp, if (isExpanded) theme.accentPrimary else theme.borderSubtle, RoundedCornerShape(CyberDimens.SmallRadius))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${field.key} · ${field.kind.name}",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = theme.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    TextButton(
                        onClick = onMoveUp,
                        enabled = !isFirst,
                        modifier = Modifier.defaultMinSize(minWidth = CyberDimens.MinTouchTarget, minHeight = CyberDimens.MinTouchTarget),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            text = "↑",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = if (!isFirst) theme.textPrimary else theme.textMuted
                        )
                    }
                    TextButton(
                        onClick = onMoveDown,
                        enabled = !isLast,
                        modifier = Modifier.defaultMinSize(minWidth = CyberDimens.MinTouchTarget, minHeight = CyberDimens.MinTouchTarget),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            text = "↓",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = if (!isLast) theme.textPrimary else theme.textMuted
                        )
                    }
                    TextButton(
                        onClick = onToggleExpand,
                        modifier = Modifier.defaultMinSize(minWidth = CyberDimens.MinTouchTarget, minHeight = CyberDimens.MinTouchTarget),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Editar ${field.label}",
                            tint = if (isExpanded) theme.accentPrimary else theme.textPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            AnimatedVisibility(
                visible = isExpanded,
                enter = if (theme.isEink) EnterTransition.None else expandVertically() + fadeIn(),
                exit = if (theme.isEink) ExitTransition.None else shrinkVertically() + fadeOut()
            ) {
                var labelDraft by remember(field.id, field.label) { mutableStateOf(field.label) }
                var keyDraft by remember(field.id, field.key) { mutableStateOf(field.key) }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(theme.bgInput, cardShape)
                        .border(1.dp, theme.accentPrimary, cardShape)
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = labelDraft,
                        onValueChange = { next ->
                            labelDraft = next
                            onUpdateSchema(field.id) {
                                it.copy(
                                    label = next.uppercase(),
                                    rollLabel = if (it.kind == FieldKind.ROLL) next.uppercase() else it.rollLabel
                                )
                            }
                        },
                        label = { Text("RÓTULO", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                        singleLine = true,
                        colors = fieldColors,
                        shape = pillShape,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = keyDraft,
                        onValueChange = { next ->
                            val clean = next.lowercase().replace(Regex("[^a-z0-9_]+"), "_")
                            keyDraft = clean
                            if (clean.isNotBlank()) {
                                onUpdateSchema(field.id) { it.copy(key = clean) }
                            }
                        },
                        label = { Text("CHAVE (FÓRMULA)", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                        singleLine = true,
                        colors = fieldColors,
                        shape = pillShape,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (field.kind == FieldKind.CALCULATED) {
                        var formulaDraft by remember(field.id, field.formula) { mutableStateOf(field.formula.orEmpty()) }
                        OutlinedTextField(
                            value = formulaDraft,
                            onValueChange = { next ->
                                formulaDraft = next
                                onUpdateSchema(field.id) { it.copy(formula = next) }
                            },
                            label = { Text("FÓRMULA", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                            singleLine = true,
                            colors = fieldColors,
                            shape = pillShape,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (field.kind == FieldKind.ROLL) {
                        var exprDraft by remember(field.id, field.rollExpr) { mutableStateOf(field.rollExpr.orEmpty()) }
                        OutlinedTextField(
                            value = exprDraft,
                            onValueChange = { next ->
                                exprDraft = next
                                onUpdateSchema(field.id) { it.copy(rollExpr = next) }
                            },
                            label = { Text("EXPRESSÃO DE ROLAGEM", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                            singleLine = true,
                            colors = fieldColors,
                            shape = pillShape,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (field.kind == FieldKind.RESOURCE) {
                        var maxDraft by remember(field.id, field.max) { mutableStateOf((field.max ?: 6).toString()) }
                        OutlinedTextField(
                            value = maxDraft,
                            onValueChange = { next ->
                                val digits = next.filter { it.isDigit() }
                                maxDraft = digits
                                digits.toIntOrNull()?.coerceIn(1, 1000)?.let { maxVal ->
                                    onUpdateSchema(field.id) { it.copy(max = maxVal) }
                                }
                            },
                            label = { Text("MÁXIMO DO RECURSO", fontFamily = FontFamily.Monospace, fontSize = 10.sp) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = fieldColors,
                            shape = pillShape,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (field.rollDifficulty != null || field.kind == FieldKind.ROLL) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val diff = (field.rollDifficulty ?: 6).coerceIn(2, 10)
                            val spec = field.rollSpecialty == true
                            val specBg = when {
                                spec && theme.isEink -> theme.accentPrimary
                                spec -> theme.accentWineSoft
                                else -> theme.bgCard
                            }
                            val specFg = when {
                                spec && theme.isEink -> theme.accentContrast
                                spec -> theme.accentPrimary
                                else -> theme.textPrimary
                            }
                            OutlinedButton(
                                onClick = onCycleRollDifficulty,
                                modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                shape = pillShape,
                                border = BorderStroke(1.dp, theme.borderColor),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = theme.bgCard,
                                    contentColor = theme.textPrimary
                                )
                            ) {
                                Text("DIFF $diff ↻", fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = onToggleRollSpecialty,
                                modifier = Modifier.defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                                shape = pillShape,
                                border = BorderStroke(1.dp, if (spec) theme.accentPrimary else theme.borderColor),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = specBg
                                )
                            ) {
                                Text(
                                    text = if (spec) "SPECIALTY: ON" else "SPECIALTY: OFF",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = specFg
                                )
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = onRemoveField,
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                        shape = pillShape,
                        border = BorderStroke(1.dp, theme.accentDanger)
                    ) {
                        Text(
                            text = "REMOVER CAMPO ×",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.accentDanger
                        )
                    }
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
                        color = theme.textPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    if (field.rollDifficulty != null) {
                        val diff = field.rollDifficulty.coerceIn(2, 10)
                        val hasSpec = field.rollSpecialty == true
                        val pillText = if (hasSpec) "DIFF $diff · SPEC" else "DIFF $diff"
                        val pillBg = if (theme.isEink && hasSpec) theme.accentPrimary else theme.accentCreamBadge
                        val pillFg = if (theme.isEink && hasSpec) theme.accentContrast else theme.accentPrimary
                        Surface(
                            modifier = Modifier
                                .padding(end = 6.dp)
                                .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                .clickable(onClick = onCycleRollDifficulty),
                            shape = pillShape,
                            color = pillBg,
                            border = BorderStroke(1.dp, theme.accentPrimary)
                        ) {
                            Box(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = pillText,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = pillFg
                                )
                            }
                        }
                    }
                    BasicTextField(
                        value = textState,
                        onValueChange = { raw ->
                            textState = raw
                            raw.toDoubleOrNull()?.let { onUpdateNumber(field.id, it) }
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        cursorBrush = SolidColor(theme.accentPrimary),
                        textStyle = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = theme.textPrimary
                        ),
                        modifier = Modifier
                            .width(86.dp)
                            .background(theme.bgInput, pillShape)
                            .border(theme.borderWidth, theme.borderColor, pillShape)
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
                        color = theme.textSecondary
                    )
                    BasicTextField(
                        value = textState,
                        onValueChange = { next ->
                            textState = next
                            onUpdateText(field.id, next)
                        },
                        cursorBrush = SolidColor(theme.accentPrimary),
                        textStyle = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = theme.textPrimary
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(theme.bgInput, pillShape)
                            .border(theme.borderWidth, theme.borderColor, pillShape)
                            .padding(horizontal = 10.dp, vertical = 8.dp)
                    )
                }
            }

            FieldKind.CALCULATED -> {
                val info = evaluation.computedByFieldId[field.id]
                val isError = info != null && !info.ok
                val dashColor = if (isError) theme.accentDanger else theme.accentPrimary
                val bgColor = if (isError) theme.accentDangerSoft else theme.accentCreamBadge

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
                            color = theme.textPrimary
                        )
                        Text(
                            text = "= ${field.formula.orEmpty()}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = theme.textMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Box(
                        modifier = Modifier
                            .background(bgColor, pillShape)
                            .drawBehind {
                                drawRoundRect(
                                    color = dashColor,
                                    style = Stroke(
                                        width = theme.borderWidth.toPx(),
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f), 0f)
                                    ),
                                    cornerRadius = CornerRadius(theme.pillCornerRadius.toPx())
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
                val blockShape = RoundedCornerShape(if (theme.isEink) theme.pillCornerRadius else 2.dp)
                if (field.damageTrack == true) {
                    val maxVal = (field.max ?: 7).coerceAtLeast(1)
                    val agg = (field.aggravatedDamage ?: kotlin.math.max(0, maxVal - (field.numValue ?: maxVal.toDouble()).roundToInt())).coerceIn(0, maxVal)
                    val sup = if (agg >= maxVal) 0 else (field.superficialDamage ?: 0).coerceIn(0, maxVal - 1)
                    val healthy = (maxVal - agg).coerceAtLeast(0)
                    val totalSupEq = agg * maxVal + sup

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(theme.bgCardAlt, cardShape)
                            .border(theme.borderWidth, theme.borderColor, cardShape)
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
                                    color = theme.textPrimary
                                )
                                Box(
                                    modifier = Modifier
                                        .background(theme.accentCreamBadge, RoundedCornerShape(3.dp))
                                        .border(1.dp, theme.accentPrimary, RoundedCornerShape(3.dp))
                                        .padding(horizontal = 5.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "1 AGRAV = $maxVal SUP",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 9.sp,
                                        color = theme.accentPrimary
                                    )
                                }
                            }
                            Text(
                                text = "$healthy / $maxVal SAUDÁVEL",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = theme.textPrimary
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
                                    "aggravated" -> theme.accentBlack
                                    "superficial" -> if (theme.isEink) theme.bgStrip else theme.accentPrimary
                                    else -> theme.bgCard
                                }
                                val borderCol = when (state) {
                                    "aggravated" -> theme.accentBlack
                                    "superficial" -> if (theme.isEink) theme.borderColor else theme.accentPrimary
                                    else -> theme.borderColor.copy(alpha = if (theme.isEink) 1f else 0.45f)
                                }
                                val mark = when (state) {
                                    "aggravated" -> "✕"
                                    "superficial" -> "/"
                                    else -> ""
                                }
                                val markColor = if (state == "superficial" && theme.isEink) {
                                    theme.textPrimary
                                } else {
                                    theme.accentContrast
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(18.dp)
                                        .clip(blockShape)
                                        .background(bg)
                                        .border(1.dp, borderCol, blockShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (mark.isNotEmpty()) {
                                        Text(
                                            text = mark,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 10.sp,
                                            color = markColor
                                        )
                                    }
                                }
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(theme.borderSubtle)
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
                                color = theme.textPrimary,
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
                                    color = theme.textPrimary
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
                                color = theme.accentPrimary,
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
                                    color = theme.accentPrimary
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
                        .background(theme.bgCardAlt, cardShape)
                        .border(if (theme.isEink) theme.borderWidth else 1.dp, if (theme.isEink) theme.borderColor else theme.borderSubtle, cardShape)
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
                            color = theme.textPrimary,
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
                                color = theme.textPrimary
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
                                            else -> theme.accentPrimary.copy(alpha = 0.28f)
                                        },
                                        blockShape
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
                val inverted = theme.isEink && checked
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(pillShape)
                        .background(if (inverted) theme.accentPrimary else theme.bgInput)
                        .border(theme.borderWidth, theme.borderColor, pillShape)
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
                                    when {
                                        inverted -> theme.accentContrast
                                        checked -> theme.accentPrimary
                                        else -> theme.bgCard
                                    },
                                    RoundedCornerShape(CyberDimens.SmallRadius)
                                )
                                .border(
                                    theme.borderStrong,
                                    if (inverted) theme.accentContrast else theme.borderColor,
                                    RoundedCornerShape(CyberDimens.SmallRadius)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (checked) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = if (inverted) theme.accentPrimary else theme.accentContrast,
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
                                color = if (inverted) theme.accentContrast else theme.textPrimary
                            )
                            field.hint?.let {
                                Text(
                                    text = it,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    color = if (inverted) theme.accentContrast else theme.textMuted
                                )
                            }
                        }
                    }
                    Text(
                        text = if (checked) "ATIVO" else "INATIVO",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = when {
                            inverted -> theme.accentContrast
                            checked -> theme.accentPrimary
                            else -> theme.textMuted
                        }
                    )
                }
            }

            FieldKind.ROLL -> {
                val label = field.rollLabel ?: field.label
                val expr = field.rollExpr ?: "2d6"
                val preview = FormulaEngine.resolveRollPreview(expr, evaluation.variables)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (field.rollDifficulty != null) {
                        val diff = field.rollDifficulty.coerceIn(2, 10)
                        val hasSpec = field.rollSpecialty == true
                        val pillText = if (hasSpec) "DIFF $diff · SPEC" else "DIFF $diff"
                        val pillBg = if (theme.isEink && hasSpec) theme.accentPrimary else theme.accentCreamBadge
                        val pillFg = if (theme.isEink && hasSpec) theme.accentContrast else theme.accentPrimary
                        Surface(
                            modifier = Modifier
                                .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                .clickable(onClick = onCycleRollDifficulty),
                            shape = pillShape,
                            color = pillBg,
                            border = BorderStroke(1.dp, theme.accentPrimary)
                        ) {
                            Box(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = pillText,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = pillFg
                                )
                            }
                        }
                    }
                    Button(
                        onClick = { onRoll(label, expr) },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget),
                        shape = pillShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = theme.accentBlack,
                            contentColor = theme.accentContrast
                        ),
                        border = BorderStroke(theme.borderStrong, theme.borderColor)
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
                        .border(theme.borderWidth, theme.borderColor, cardShape)
                        .clip(cardShape),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(theme.bgStrip)
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = field.label,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = theme.textPrimary
                        )
                        if (field.col2Type == "number") {
                            Text(
                                text = "//CARGA: ${evaluation.totalCargoWeight}",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = theme.accentPrimary
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(theme.bgCardAlt)
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = cols.getOrElse(0) { "ITEM" },
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.textMuted,
                            modifier = Modifier.weight(1.7f)
                        )
                        Text(
                            text = cols.getOrElse(1) { "QTD" },
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = theme.textMuted,
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
                                .background(theme.borderSubtle)
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(theme.bgCard)
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
                                cursorBrush = SolidColor(theme.accentPrimary),
                                textStyle = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    color = theme.textPrimary
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
                                cursorBrush = SolidColor(theme.accentPrimary),
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = if (field.col2Type == "number") KeyboardType.Decimal else KeyboardType.Text
                                ),
                                textStyle = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = theme.accentPrimary
                                ),
                                modifier = Modifier.weight(1f)
                            )
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(RoundedCornerShape(CyberDimens.SmallRadius))
                                    .clickable { onRemoveRow(field.id, row.id) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Remover linha",
                                    tint = theme.textMuted,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(theme.borderColor)
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(theme.bgCardAlt)
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
                            color = theme.textPrimary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SmallSquareButton(label: String, onClick: () -> Unit) {
    val theme = LocalGridTheme.current
    Surface(
        modifier = Modifier
            .size(26.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(theme.pillCornerRadius),
        color = theme.bgCard,
        border = BorderStroke(theme.borderWidth, theme.borderColor)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 13.sp,
                color = theme.textPrimary
            )
        }
    }
}

private data class FieldPresetOption(
    val id: String,
    val label: String,
    val kind: FieldKind,
    val defaultExpr: String = "",
    val isSkillTemplate: Boolean = false
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddFieldDialog(
    cardCode: String,
    onDismiss: () -> Unit,
    onConfirm: (String, String, FieldKind, String, Boolean) -> Unit
) {
    var label by remember { mutableStateOf("") }
    var key by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf(FieldKind.NUMBER) }
    var expr by remember { mutableStateOf("") }
    var selectedPresetId by remember { mutableStateOf<String?>(null) }
    var isSkillTemplate by remember { mutableStateOf(false) }
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    val fieldColors = gridTextFieldColors(theme)

    val presetOptions = remember {
        listOf(
            FieldPresetOption("skill_d10", "Habilidade / Perícia d10", FieldKind.ROLL, "pool(3, 6)", isSkillTemplate = true),
            FieldPresetOption("attribute", "Atributo", FieldKind.NUMBER),
            FieldPresetOption("discipline", "Disciplina / Poder", FieldKind.NUMBER),
            FieldPresetOption("resource", "Recurso (Barra)", FieldKind.RESOURCE),
            FieldPresetOption("calculated", "Calculado", FieldKind.CALCULATED, "0"),
            FieldPresetOption("text", "Texto/Notas", FieldKind.TEXT)
        )
    }

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
        containerColor = theme.bgCard,
        shape = RoundedCornerShape(theme.cardCornerRadius),
        title = {
            Text(
                text = "NOVO CAMPO EM $cardCode",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = theme.textPrimary
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "PRESETS RÁPIDOS",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.accentPrimary
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    presetOptions.forEach { preset ->
                        val selected = selectedPresetId == preset.id
                        Surface(
                            modifier = Modifier
                                .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
                                .clickable {
                                    selectedPresetId = preset.id
                                    kind = preset.kind
                                    isSkillTemplate = preset.isSkillTemplate
                                    if (preset.defaultExpr.isNotEmpty() && expr.isBlank()) {
                                        expr = preset.defaultExpr
                                    }
                                },
                            shape = pillShape,
                            color = if (selected) theme.accentBlack else theme.accentCreamBadge,
                            border = BorderStroke(1.dp, if (selected) theme.accentBlack else theme.accentPrimary)
                        ) {
                            Box(
                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = preset.label,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (selected) theme.accentContrast else theme.accentPrimary
                                )
                            }
                        }
                    }
                }
                OutlinedTextField(
                    value = label,
                    onValueChange = {
                        label = it
                        key = it.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
                    },
                    label = { Text("RÓTULO", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true,
                    colors = fieldColors,
                    shape = pillShape
                )
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    label = { Text("CHAVE (FÓRMULAS)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                    singleLine = true,
                    colors = fieldColors,
                    shape = pillShape
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    kindLabels.forEach { (k, title) ->
                        val selected = kind == k
                        Surface(
                            modifier = Modifier.clickable {
                                kind = k
                                if (k != FieldKind.ROLL) isSkillTemplate = false
                            },
                            shape = pillShape,
                            color = if (selected) theme.accentPrimary else theme.bgCardAlt,
                            border = BorderStroke(1.dp, theme.borderColor)
                        ) {
                            Text(
                                text = title,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (selected) theme.accentContrast else theme.textPrimary,
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
                                if (kind == FieldKind.CALCULATED) "FÓRMULA (ex: atributo * 2)" else "EXPRESSÃO (ex: pool(strength + brawl, 6))",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp
                            )
                        },
                        singleLine = true,
                        colors = fieldColors,
                        shape = pillShape
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(label, key, kind, expr, isSkillTemplate) },
                shape = pillShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = theme.accentBlack,
                    contentColor = theme.accentContrast
                )
            ) {
                Text("CRIAR", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("CANCELAR", fontFamily = FontFamily.Monospace, color = theme.textMuted)
            }
        }
    )
}

// --- HOME SCREEN LIGHT CYBER BRUTALISM PRIMITIVES ---

private val homeDateFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.systemDefault())

private fun formatSheetTimestamp(updatedAt: String, updatedAtMillis: Long): String {
    val instant = SheetMetadataMapper.parseEffectiveInstant(updatedAt, updatedAtMillis)
    return if (instant.epochSecond <= 0L) {
        "AGORA"
    } else {
        runCatching { homeDateFormatter.format(instant) }.getOrDefault("RECENTE")
    }
}

@Composable
fun BrutalistSectionHeader(
    code: String,
    title: String,
    trailingBadge: String? = null
) {
    val theme = LocalGridTheme.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp, bottom = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = code,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
                color = theme.accentPrimary
            )
            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = theme.textPrimary
            )
        }
        if (!trailingBadge.isNullOrBlank()) {
            BrutalistTagBadge(
                text = trailingBadge,
                containerColor = theme.bgCardAlt,
                contentColor = theme.textPrimary
            )
        }
    }
}

@Composable
fun BrutalistTagBadge(
    text: String,
    containerColor: Color = LocalGridTheme.current.accentWineSoft,
    contentColor: Color = LocalGridTheme.current.accentPrimary,
    borderColor: Color = LocalGridTheme.current.borderColor
) {
    val theme = LocalGridTheme.current
    Surface(
        shape = RoundedCornerShape(theme.pillCornerRadius),
        color = containerColor,
        border = BorderStroke(1.dp, borderColor)
    ) {
        Text(
            text = text,
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.6.sp,
            color = contentColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ActiveSessionHeroCard(
    latestSheet: SheetMetadata?,
    onContinue: (String) -> Unit,
    onDuplicate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
        shape = shape,
        color = theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.borderColor),
        shadowElevation = 0.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(theme.bgStrip)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "// SESSÃO_ATIVA",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp,
                    color = theme.accentPrimary
                )
                BrutalistTagBadge(
                    text = latestSheet?.systemCode ?: "WORKSPACE VAZIO",
                    containerColor = if (latestSheet != null) theme.accentBlack else theme.bgCard,
                    contentColor = if (latestSheet != null) theme.accentContrast else theme.textMuted
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(theme.borderStrong)
                    .background(theme.borderColor)
            )
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (latestSheet != null) {
                    Text(
                        text = latestSheet.characterName,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.textPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${latestSheet.systemName} • ${latestSheet.cardCount} CARDS • ${latestSheet.rollCount} ROLAGENS • XP ${latestSheet.availableXp}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.textSecondary
                    )
                    Text(
                        text = "ÚLTIMA EDIÇÃO: ${formatSheetTimestamp(latestSheet.updatedAt, latestSheet.updatedAtMillis)}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = theme.textMuted
                    )
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { onContinue(latestSheet.id) },
                            shape = pillShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = theme.accentPrimary,
                                contentColor = theme.accentContrast
                            ),
                            border = BorderStroke(theme.borderStrong, theme.borderColor),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                            modifier = Modifier.defaultMinSize(
                                minWidth = CyberDimens.MinTouchTarget,
                                minHeight = CyberDimens.MinTouchTarget
                            )
                        ) {
                            Text(
                                text = "CONTINUAR FICHA →",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 0.6.sp
                            )
                        }
                        OutlinedButton(
                            onClick = { onDuplicate(latestSheet.id) },
                            shape = pillShape,
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = theme.bgCardAlt,
                                contentColor = theme.textPrimary
                            ),
                            border = BorderStroke(theme.borderWidth, theme.borderColor),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                            modifier = Modifier.defaultMinSize(
                                minWidth = CyberDimens.MinTouchTarget,
                                minHeight = CyberDimens.MinTouchTarget
                            )
                        ) {
                            Text(
                                text = "DUPLICAR",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                } else {
                    Text(
                        text = "NENHUMA FICHA SALVA NO DISPOSITIVO",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = theme.textPrimary
                    )
                    Text(
                        text = "Escolha um sistema em // NOVO_PERSONAGEM abaixo para criar sua primeira ficha zerada, ou importe um backup .JSON em // PORTABILIDADE_&_REGRAS.",
                        fontSize = 12.sp,
                        color = theme.textSecondary
                    )
                }
            }
        }
    }
}

@Composable
fun PresetSystemCard(
    preset: PresetSummary,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.cardCornerRadius)
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor)
            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
            .clip(shape)
            .clickable(role = Role.Button, onClick = onClick),
        shape = shape,
        color = theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.borderColor),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BrutalistTagBadge(
                    text = preset.systemCode,
                    containerColor = theme.accentWineSoft,
                    contentColor = theme.accentPrimary
                )
                Text(
                    text = "+ CRIAR →",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.accentPrimary
                )
            }
            Text(
                text = preset.shortLabel,
                fontFamily = FontFamily.Monospace,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = theme.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = preset.description,
                fontSize = 11.sp,
                color = theme.textSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${preset.cardCount} CARDS • ${preset.fieldCount} CAMPOS${if (preset.fromAsset) " • V2" else ""}",
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = theme.textMuted
            )
        }
    }
}

@Composable
fun DashedCustomSheetCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.cardCornerRadius)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = CyberDimens.MinTouchTarget)
            .clip(shape)
            .background(theme.bgCardAlt)
            .drawBehind {
                val strokeWidth = theme.borderStrong.toPx()
                val radiusPx = theme.cardCornerRadius.toPx()
                drawRoundRect(
                    color = theme.borderColor,
                    style = Stroke(
                        width = strokeWidth,
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 9f), 0f)
                    ),
                    cornerRadius = CornerRadius(radiusPx, radiusPx)
                )
            }
            .clickable(role = Role.Button, onClick = onClick)
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BrutalistTagBadge(
                    text = "CUSTOM // BLANK",
                    containerColor = theme.bgCard,
                    contentColor = theme.textPrimary
                )
                Text(
                    text = "+ CRIAR →",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = theme.accentPrimary
                )
            }
            Text(
                text = "FICHA PERSONALIZADA",
                fontFamily = FontFamily.Monospace,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = theme.textPrimary
            )
            Text(
                text = "Canvas em branco com criação livre de cards, status e fórmulas.",
                fontSize = 11.sp,
                color = theme.textSecondary
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CharacterLibraryCard(
    sheet: SheetMetadata,
    isLatest: Boolean,
    onOpen: () -> Unit,
    onDuplicate: () -> Unit,
    onDeleteRequest: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
        shape = shape,
        color = theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.borderColor),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BrutalistTagBadge(text = sheet.systemCode)
                    if (isLatest) {
                        BrutalistTagBadge(
                            text = "RECENTE",
                            containerColor = theme.accentBlack,
                            contentColor = theme.accentContrast
                        )
                    }
                }
                Text(
                    text = formatSheetTimestamp(sheet.updatedAt, sheet.updatedAtMillis),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = theme.textMuted
                )
            }

            Text(
                text = sheet.characterName,
                fontFamily = FontFamily.Monospace,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = theme.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = "${sheet.systemName} • ${sheet.cardCount} CARDS • ${sheet.rollCount} ROLAGENS • XP ${sheet.availableXp}",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = theme.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onOpen,
                    shape = pillShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = theme.accentBlack,
                        contentColor = theme.accentContrast
                    ),
                    border = BorderStroke(theme.borderWidth, theme.borderColor),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    modifier = Modifier.defaultMinSize(
                        minWidth = CyberDimens.MinTouchTarget,
                        minHeight = CyberDimens.MinTouchTarget
                    )
                ) {
                    Text(
                        text = "ABRIR",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
                OutlinedButton(
                    onClick = onDuplicate,
                    shape = pillShape,
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = theme.bgCardAlt,
                        contentColor = theme.textPrimary
                    ),
                    border = BorderStroke(theme.borderWidth, theme.borderColor),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    modifier = Modifier.defaultMinSize(
                        minWidth = CyberDimens.MinTouchTarget,
                        minHeight = CyberDimens.MinTouchTarget
                    )
                ) {
                    Text(
                        text = "DUPLICAR",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
                OutlinedButton(
                    onClick = onDeleteRequest,
                    shape = pillShape,
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = theme.accentDangerSoft,
                        contentColor = theme.accentDanger
                    ),
                    border = BorderStroke(theme.borderWidth, theme.accentDanger),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    modifier = Modifier.defaultMinSize(
                        minWidth = CyberDimens.MinTouchTarget,
                        minHeight = CyberDimens.MinTouchTarget
                    )
                ) {
                    Text(
                        text = "EXCLUIR",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PortabilityAndRulesCard(
    indexedBooksCount: Int,
    sheetCount: Int,
    transferBusy: Boolean,
    transferFeedbackMessage: String?,
    transferFeedbackIsError: Boolean,
    overwriteExisting: Boolean,
    onOverwriteChange: (Boolean) -> Unit,
    onExportBackup: () -> Unit,
    onImportJson: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = LocalGridTheme.current
    val shape = RoundedCornerShape(theme.cardCornerRadius)
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .brutalistShadow(theme.cardElevationShadow, theme.cardCornerRadius, theme.shadowColor),
        shape = shape,
        color = theme.bgCard,
        border = BorderStroke(theme.borderStrong, theme.borderColor),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BrutalistTagBadge(
                    text = "LIVROS PDF INDEXADOS: $indexedBooksCount",
                    containerColor = if (indexedBooksCount > 0) theme.accentWineSoft else theme.bgCardAlt,
                    contentColor = if (indexedBooksCount > 0) theme.accentPrimary else theme.textSecondary
                )
                Text(
                    text = "$sheetCount ${if (sheetCount == 1) "FICHA" else "FICHAS"} NO ROOM",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textMuted
                )
            }

            Text(
                text = "Exporte ou restaure todo o seu grimório em formato .JSON Schema V2 (compatível com a versão Web). Os PDFs indexados ficam disponíveis na aba REGRAS dentro de qualquer ficha.",
                fontSize = 11.sp,
                color = theme.textSecondary
            )

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onExportBackup,
                    enabled = !transferBusy && sheetCount > 0,
                    shape = pillShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = theme.accentBlack,
                        contentColor = theme.accentContrast,
                        disabledContainerColor = theme.bgHover,
                        disabledContentColor = theme.textMuted
                    ),
                    border = BorderStroke(theme.borderWidth, theme.borderColor),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                    modifier = Modifier.defaultMinSize(
                        minWidth = CyberDimens.MinTouchTarget,
                        minHeight = CyberDimens.MinTouchTarget
                    )
                ) {
                    Text(
                        text = if (transferBusy) "PROCESSANDO..." else "BACKUP COMPLETO (.JSON)",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                OutlinedButton(
                    onClick = onImportJson,
                    enabled = !transferBusy,
                    shape = pillShape,
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = theme.bgCardAlt,
                        contentColor = theme.textPrimary,
                        disabledContentColor = theme.textMuted
                    ),
                    border = BorderStroke(theme.borderWidth, theme.borderColor),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                    modifier = Modifier.defaultMinSize(
                        minWidth = CyberDimens.MinTouchTarget,
                        minHeight = CyberDimens.MinTouchTarget
                    )
                ) {
                    Text(
                        text = "IMPORTAR (.JSON)",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = CyberDimens.MinTouchTarget)
                    .toggleable(
                        value = overwriteExisting,
                        enabled = !transferBusy,
                        role = Role.Checkbox,
                        onValueChange = onOverwriteChange
                    ),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Checkbox(
                    checked = overwriteExisting,
                    onCheckedChange = null,
                    enabled = !transferBusy,
                    colors = CheckboxDefaults.colors(
                        checkedColor = theme.accentPrimary,
                        uncheckedColor = theme.borderColor,
                        checkmarkColor = theme.accentContrast
                    )
                )
                Text(
                    text = "SOBRESCREVER FICHAS COM MESMO ID NA IMPORTAÇÃO",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textPrimary
                )
            }

            if (!transferFeedbackMessage.isNullOrBlank()) {
                val accent = if (transferFeedbackIsError) theme.accentDanger else theme.accentPrimary
                val soft = if (transferFeedbackIsError) theme.accentDangerSoft else theme.accentWineSoft
                Text(
                    text = (if (transferFeedbackIsError) "> ERRO_ " else "> OK_ ") + transferFeedbackMessage,
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
}

@Composable
fun CreateCharacterDialog(
    systemLabel: String,
    systemCode: String,
    description: String,
    isCustomBlank: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String?) -> Unit
) {
    var characterName by remember { mutableStateOf("") }
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = theme.bgCard,
        shape = RoundedCornerShape(theme.cardCornerRadius),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                BrutalistTagBadge(text = systemCode)
                Text(
                    text = if (isCustomBlank) "NOVA FICHA PERSONALIZADA" else "NOVO PERSONAGEM · $systemLabel",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                    color = theme.textPrimary
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = description,
                    fontSize = 12.sp,
                    color = theme.textSecondary
                )
                OutlinedTextField(
                    value = characterName,
                    onValueChange = { characterName = it.take(120) },
                    label = {
                        Text(
                            text = "NOME DO PERSONAGEM (OPCIONAL)",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp
                        )
                    },
                    placeholder = {
                        Text(
                            text = "EX: NOVO PERSONAGEM",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp
                        )
                    },
                    singleLine = true,
                    colors = gridTextFieldColors(theme),
                    shape = pillShape,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    text = "Atributos base, rolamentos e XP iniciam zerados sem apagar suas fichas existentes.",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = theme.textMuted
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(characterName.trim().ifEmpty { null }) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = theme.accentPrimary,
                    contentColor = theme.accentContrast
                ),
                border = BorderStroke(theme.borderWidth, theme.borderColor),
                shape = pillShape,
                modifier = Modifier.defaultMinSize(
                    minWidth = CyberDimens.MinTouchTarget,
                    minHeight = CyberDimens.MinTouchTarget
                )
            ) {
                Text(
                    text = "CRIAR E ABRIR",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.defaultMinSize(
                    minWidth = CyberDimens.MinTouchTarget,
                    minHeight = CyberDimens.MinTouchTarget
                )
            ) {
                Text(
                    text = "CANCELAR",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textMuted
                )
            }
        }
    )
}

@Composable
fun DeleteCharacterConfirmDialog(
    sheet: SheetMetadata,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val theme = LocalGridTheme.current
    val pillShape = RoundedCornerShape(theme.pillCornerRadius)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = theme.bgCard,
        shape = RoundedCornerShape(theme.cardCornerRadius),
        title = {
            Text(
                text = "EXCLUIR FICHA?",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 15.sp,
                color = theme.accentDanger
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Deseja remover permanentemente \"${sheet.characterName}\" (${sheet.systemCode}) do armazenamento local?",
                    fontSize = 12.sp,
                    color = theme.textPrimary
                )
                Text(
                    text = "Esta ação apaga apenas esta ficha no Room; outras fichas e livros PDF indexados permanecem intactos.",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = theme.textMuted
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = theme.accentDanger,
                    contentColor = theme.accentContrast
                ),
                border = BorderStroke(theme.borderWidth, theme.borderColor),
                shape = pillShape,
                modifier = Modifier.defaultMinSize(
                    minWidth = CyberDimens.MinTouchTarget,
                    minHeight = CyberDimens.MinTouchTarget
                )
            ) {
                Text(
                    text = "EXCLUIR",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.defaultMinSize(
                    minWidth = CyberDimens.MinTouchTarget,
                    minHeight = CyberDimens.MinTouchTarget
                )
            ) {
                Text(
                    text = "CANCELAR",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = theme.textMuted
                )
            }
        }
    )
}
