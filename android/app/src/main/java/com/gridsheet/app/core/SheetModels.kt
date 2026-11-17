package com.gridsheet.app.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.text.Normalizer
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

@Serializable
enum class TabId {
    @SerialName("geral") GERAL,
    @SerialName("magias") MAGIAS,
    @SerialName("xp") XP
}

@Serializable
enum class AppMode {
    @SerialName("jogo") JOGO,
    @SerialName("edicao") EDICAO
}

@Serializable
enum class SystemId {
    @SerialName("wod") WOD,
    @SerialName("dnd5e") DND5E,
    @SerialName("cyberpunk") CYBERPUNK,
    @SerialName("default") DEFAULT,
    @SerialName("blank") BLANK
}

@Serializable
enum class FieldKind {
    @SerialName("number") NUMBER,
    @SerialName("text") TEXT,
    @SerialName("calculated") CALCULATED,
    @SerialName("resource") RESOURCE,
    @SerialName("boolean") BOOLEAN,
    @SerialName("roll") ROLL,
    @SerialName("repeatable") REPEATABLE
}

@Serializable
enum class XpUpgradeCategory {
    @SerialName("attribute") ATTRIBUTE,
    @SerialName("skill") SKILL,
    @SerialName("discipline") DISCIPLINE,
    @SerialName("virtue") VIRTUE
}

@Serializable
enum class XpRulePreset {
    @SerialName("storyteller_v20") STORYTELLER_V20,
    @SerialName("vampire_v5") VAMPIRE_V5,
    @SerialName("custom") CUSTOM
}

data class SystemOption(
    val id: SystemId,
    val label: String,
    val shortLabel: String,
    val description: String
)

data class SheetMetadata(
    val id: String,
    val systemId: SystemId,
    val systemName: String,
    val systemCode: String,
    val characterName: String,
    val updatedAt: String,
    val updatedAtMillis: Long,
    val cardCount: Int = 0,
    val rollCount: Int = 0,
    val availableXp: Int = 0
)

data class PresetSummary(
    val systemId: SystemId,
    val systemName: String,
    val systemCode: String,
    val shortLabel: String,
    val description: String,
    val cardCount: Int,
    val fieldCount: Int,
    val fromAsset: Boolean = false
)

object SheetMetadataMapper {
    fun parseEffectiveInstant(updatedAt: String, updatedAtMillis: Long): Instant {
        val trimmed = updatedAt.trim()
        if (trimmed.isNotEmpty() && trimmed != "1970-01-01T00:00:00Z") {
            runCatching { Instant.parse(trimmed) }.getOrNull()?.let { return it }
        }
        return Instant.ofEpochMilli(updatedAtMillis.coerceAtLeast(0L))
    }

    fun fromSheet(
        sheet: CharacterSheetState,
        systemId: SystemId,
        updatedAtMillis: Long
    ): SheetMetadata {
        val effectiveUpdatedAt = sheet.updatedAt.takeIf {
            it.isNotBlank() && it != "1970-01-01T00:00:00Z"
        } ?: Instant.ofEpochMilli(updatedAtMillis.coerceAtLeast(0L)).toString()
        val effectiveMillis = max(
            updatedAtMillis,
            runCatching { Instant.parse(effectiveUpdatedAt).toEpochMilli() }.getOrDefault(0L)
        )
        return SheetMetadata(
            id = sheet.id,
            systemId = systemId,
            systemName = sheet.systemName,
            systemCode = sheet.systemCode,
            characterName = sheet.characterName.ifBlank { "SEM NOME" },
            updatedAt = effectiveUpdatedAt,
            updatedAtMillis = effectiveMillis,
            cardCount = sheet.cards.size,
            rollCount = sheet.rollLogs.size,
            availableXp = XpSystem.getAvailableXp(sheet.xp)
        )
    }

    fun sortDescending(items: List<SheetMetadata>): List<SheetMetadata> =
        items.sortedWith(
            compareByDescending<SheetMetadata> {
                parseEffectiveInstant(it.updatedAt, it.updatedAtMillis)
            }.thenByDescending { it.updatedAtMillis }
                .thenByDescending { it.updatedAt }
                .thenBy { it.characterName.lowercase() }
        )
}

@Serializable
data class RepeatableRow(
    val id: String,
    val col1: String,
    val col2: String = ""
)

@Serializable
data class SheetField(
    val id: String,
    val key: String,
    val label: String,
    val kind: FieldKind,
    val numValue: Double? = null,
    val textValue: String? = null,
    val boolValue: Boolean? = null,
    val max: Int? = null,
    val damageTrack: Boolean? = null,
    val superficialDamage: Int? = null,
    val aggravatedDamage: Int? = null,
    val bashingDamage: Int? = null,
    val lethalDamage: Int? = null,
    val formula: String? = null,
    val showPlus: Boolean? = null,
    val rollLabel: String? = null,
    val rollExpr: String? = null,
    val rollDifficulty: Int? = null,
    val rollSpecialty: Boolean? = null,
    val columns: List<String>? = null,
    val col2Type: String? = null, // "number" | "text"
    val rows: List<RepeatableRow>? = null,
    val hint: String? = null
)

@Serializable
data class SheetCard(
    val id: String,
    val tab: TabId,
    val code: String,
    val title: String,
    val colSpan: Int = 1,
    val fields: List<SheetField>
)

@Serializable
data class RollLogEntry(
    val id: String,
    val timestamp: String,
    val label: String,
    val total: Int,
    val formula: String,
    val breakdown: String,
    val isCritical: Boolean = false,
    val isFumble: Boolean = false,
    val isPoolRoll: Boolean = false
)

@Serializable
data class XpLedgerEntry(
    val id: String,
    val timestamp: String,
    val kind: String, // "award" | "upgrade"
    val delta: Int,
    val label: String,
    val fieldId: String? = null,
    val category: XpUpgradeCategory? = null,
    val fromValue: Int? = null,
    val toValue: Int? = null,
    val createdField: Boolean? = null,
    val createdCardId: String? = null,
    val prevSpecialtyLabel: String? = null,
    val prevRollSpecialty: Boolean? = null
)

@Serializable
data class XpState(
    val totalEarned: Int = 0,
    val spent: Int = 0,
    val ledger: List<XpLedgerEntry> = emptyList(),
    val outOfClanFieldIds: Set<String> = emptySet(),
    val customMultipliers: Map<String, Int> = emptyMap(),
    val xpRulePreset: XpRulePreset = XpRulePreset.STORYTELLER_V20,
    val customUseNewLevelBase: Boolean = false
)

@Serializable
data class CharacterSheetState(
    val id: String = "sheet_wod",
    val systemId: SystemId? = null,
    val systemName: String,
    val systemCode: String,
    val characterName: String,
    val revision: Int = 1,
    val updatedAt: String = "1970-01-01T00:00:00Z",
    val deviceId: String = "local-device",
    val cards: List<SheetCard>,
    val rollLogs: List<RollLogEntry> = emptyList(),
    val xp: XpState = XpState(),
    val rulePreset: XpRulePreset = XpRulePreset.STORYTELLER_V20
)

typealias Sheet = CharacterSheetState

@Serializable
data class CanonicalRollConfig(
    val mode: String,
    val expression: String,
    val difficulty: Int? = null,
    val specialty: Boolean? = null,
    val useWillpower: Boolean? = null
)

@Serializable
data class CanonicalField(
    val id: String,
    val label: String,
    val type: String,
    val value: String? = null,
    val maxValue: Double? = null,
    val maxDots: Int? = null,
    val formula: String? = null,
    val rollConfig: CanonicalRollConfig? = null,
    val subFields: List<CanonicalField>? = null,
    val rows: List<Map<String, String>>? = null
)

@Serializable
data class CanonicalBentoCard(
    val id: String,
    val tag: String? = null,
    val title: String,
    val columns: Int = 1,
    val fields: List<CanonicalField> = emptyList()
)

@Serializable
data class CanonicalTab(
    val id: String,
    val title: String,
    val cards: List<CanonicalBentoCard> = emptyList()
)

@Serializable
data class CanonicalSheet(
    val id: String,
    val name: String,
    val systemId: String,
    val revision: Int,
    val updatedAt: String,
    val deviceId: String = "local-device",
    val tabs: List<CanonicalTab> = emptyList()
)

@Serializable
data class WorkspaceState(
    val activeSystemId: SystemId = SystemId.WOD,
    val sheetsBySystem: Map<SystemId, CharacterSheetState> = emptyMap()
)

data class ComputedFieldInfo(
    val value: Double,
    val formatted: String,
    val ok: Boolean,
    val error: String? = null
)

data class FormulaErrorInfo(
    val fieldId: String,
    val label: String,
    val error: String
)

data class SheetEvaluation(
    val variables: Map<String, Double>,
    val computedByFieldId: Map<String, ComputedFieldInfo>,
    val formulaErrors: List<FormulaErrorInfo>,
    val totalCargoWeight: Double,
    val woundPenalty: Int = 0
)

object SheetEvaluator {
    fun evaluateSheet(sheet: CharacterSheetState): SheetEvaluation {
        val variables = mutableMapOf<String, Double>()
        val computedByFieldId = mutableMapOf<String, ComputedFieldInfo>()
        val formulaErrors = mutableListOf<FormulaErrorInfo>()
        var totalCargoWeight = 0.0

        // Pass 1: collect direct variables and cargo weights
        for (card in sheet.cards) {
            for (field in card.fields) {
                val key = field.key.trim().lowercase()
                if (key.isEmpty()) continue
                when (field.kind) {
                    FieldKind.NUMBER -> {
                        val num = field.numValue ?: 0.0
                        variables[key] = if (num.isFinite()) num else 0.0
                    }
                    FieldKind.RESOURCE -> {
                        val maxVal = max(1, field.max ?: 12)
                        val num = field.numValue ?: 0.0
                        variables[key] = num
                        variables["${key}_max"] = maxVal.toDouble()
                        if (field.damageTrack == true) {
                            val sup = max(0, field.superficialDamage ?: 0)
                            val agg = max(0, field.aggravatedDamage ?: 0)
                            variables["${key}_superficial"] = sup.toDouble()
                            variables["${key}_aggravated"] = agg.toDouble()
                            variables["${key}_total_sup_eq"] = (agg * maxVal + sup).toDouble()
                        }
                    }
                    FieldKind.BOOLEAN -> {
                        variables[key] = if (field.boolValue == true) 1.0 else 0.0
                    }
                    FieldKind.REPEATABLE -> {
                        if (field.col2Type == "number") {
                            for (row in field.rows.orEmpty()) {
                                val w = row.col2.toDoubleOrNull()
                                if (w != null && w.isFinite()) totalCargoWeight += w
                            }
                        }
                    }
                    else -> Unit
                }
            }
        }

        val roundedCargo = ((totalCargoWeight * 100.0).roundToInt() / 100.0)
        variables["carga_total"] = roundedCargo

        val activeRulePreset = XpSystem.resolveRulePreset(sheet)
        var woundPenalty = 0
        if (XpSystem.isWodSystem(sheet)) {
            val healthField = sheet.cards.flatMap { it.fields }
                .firstOrNull { it.damageTrack == true || it.key.trim().lowercase() == "health" }
            if (healthField != null) {
                val maxVal = max(1, healthField.max ?: 7)
                woundPenalty = if (activeRulePreset == XpRulePreset.VAMPIRE_V5) {
                    val agg = (healthField.aggravatedDamage ?: 0).coerceIn(0, maxVal)
                    val sup = if (agg >= maxVal) 0 else (healthField.superficialDamage ?: 0).coerceIn(0, maxVal - 1)
                    if (agg + sup >= maxVal) -2 else 0
                } else {
                    val agg = (healthField.aggravatedDamage ?: 0).coerceIn(0, maxVal)
                    val lethal = (healthField.lethalDamage ?: 0).coerceIn(0, maxVal - agg)
                    val bashing = (healthField.bashingDamage ?: 0).coerceIn(0, maxVal - agg - lethal)
                    val totalDamaged = agg + lethal + bashing
                    val effectiveDamaged = max(0, totalDamaged - max(0, maxVal - 7))
                    when {
                        effectiveDamaged >= 6 -> -5
                        effectiveDamaged >= 4 -> -2
                        effectiveDamaged >= 2 -> -1
                        else -> 0
                    }
                }
            }
        }
        variables["wound_penalty"] = woundPenalty.toDouble()

        // Pass 2 & 3: evaluate calculated fields in 2 passes for chained formulas
        val calcFields = sheet.cards.flatMap { it.fields }.filter { it.kind == FieldKind.CALCULATED }
        repeat(2) {
            for (field in calcFields) {
                val res = FormulaEngine.evaluateFormula(
                    expression = field.formula ?: "0",
                    vars = variables,
                    showPlus = field.showPlus ?: true
                )
                computedByFieldId[field.id] = ComputedFieldInfo(
                    value = res.value,
                    formatted = res.formatted,
                    ok = res.ok,
                    error = res.error
                )
                if (res.ok && field.key.trim().isNotEmpty()) {
                    variables[field.key.trim().lowercase()] = res.value
                }
            }
        }

        for (field in calcFields) {
            val info = computedByFieldId[field.id]
            if (info != null && !info.ok) {
                formulaErrors.add(
                    FormulaErrorInfo(
                        fieldId = field.id,
                        label = field.label,
                        error = info.error ?: "Erro de fórmula"
                    )
                )
            }
        }

        val rollFields = sheet.cards.flatMap { it.fields }.filter { it.kind == FieldKind.ROLL }
        for (field in rollFields) {
            val testRoll = FormulaEngine.rollDiceExpression(field.rollExpr ?: "", variables) { 0.5 }
            if (!testRoll.ok) {
                formulaErrors.add(
                    FormulaErrorInfo(
                        fieldId = field.id,
                        label = field.rollLabel ?: field.label,
                        error = testRoll.error ?: "Fórmula de dado inválida"
                    )
                )
            }
        }

        return SheetEvaluation(
            variables = variables,
            computedByFieldId = computedByFieldId,
            formulaErrors = formulaErrors,
            totalCargoWeight = roundedCargo,
            woundPenalty = woundPenalty
        )
    }
}

object SheetMutators {
    fun updateNumberField(sheet: CharacterSheetState, fieldId: String, value: Double): CharacterSheetState =
        mapField(sheet, fieldId) { it.copy(numValue = value) }

    fun updateTextField(sheet: CharacterSheetState, fieldId: String, value: String): CharacterSheetState =
        mapField(sheet, fieldId) { it.copy(textValue = value) }

    fun updateBooleanField(sheet: CharacterSheetState, fieldId: String, value: Boolean): CharacterSheetState =
        mapField(sheet, fieldId) { it.copy(boolValue = value) }

    fun adjustResourceValue(sheet: CharacterSheetState, fieldId: String, delta: Int): CharacterSheetState {
        val rulePreset = XpSystem.resolveRulePreset(sheet)
        return mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE) return@mapField field
            val baseMax = max(1, field.max ?: 12)
            val maxVal = if (field.id == "f_hunger" && rulePreset != XpRulePreset.VAMPIRE_V5) {
                max(10, baseMax)
            } else {
                baseMax
            }
            val current = (field.numValue ?: 0.0).roundToInt()
            val clamped = max(0, min(maxVal, current + delta))
            if (field.damageTrack == true) {
                val nextAgg = max(0, maxVal - clamped)
                val nextSup = if (clamped == 0) 0 else min(maxVal - 1, field.superficialDamage ?: 0)
                return@mapField field.copy(
                    numValue = clamped.toDouble(),
                    aggravatedDamage = nextAgg,
                    superficialDamage = nextSup
                )
            }
            field.copy(numValue = clamped.toDouble())
        }
    }

    fun setResourceValue(sheet: CharacterSheetState, fieldId: String, target: Int): CharacterSheetState {
        val rulePreset = XpSystem.resolveRulePreset(sheet)
        return mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE) return@mapField field
            val baseMax = max(1, field.max ?: 12)
            val maxVal = if (field.id == "f_hunger" && rulePreset != XpRulePreset.VAMPIRE_V5) {
                max(10, baseMax)
            } else {
                baseMax
            }
            field.copy(numValue = max(0, min(maxVal, target)).toDouble())
        }
    }

    fun adjustHealthDamage(
        sheet: CharacterSheetState,
        fieldId: String,
        damageType: String,
        delta: Int
    ): CharacterSheetState {
        val rulePreset = XpSystem.resolveRulePreset(sheet)
        return mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE) return@mapField field
            val maxVal = max(1, field.max ?: 7)
            if (rulePreset != XpRulePreset.VAMPIRE_V5 && damageType in setOf("bashing", "lethal", "aggravated")) {
                var agg = (field.aggravatedDamage ?: 0).coerceIn(0, maxVal)
                var lethal = (field.lethalDamage ?: 0).coerceIn(0, maxVal - agg)
                var bashing = (field.bashingDamage ?: 0).coerceIn(0, maxVal - agg - lethal)

                if (delta > 0) {
                    repeat(delta) {
                        val total = agg + lethal + bashing
                        when (damageType) {
                            "bashing" -> {
                                if (total < maxVal) bashing++
                                else if (bashing > 0) {
                                    bashing--
                                    lethal++
                                }
                            }
                            "lethal" -> {
                                if (total < maxVal) lethal++
                                else if (bashing > 0) {
                                    bashing--
                                    lethal++
                                }
                            }
                            "aggravated" -> {
                                if (total < maxVal) agg++
                                else if (bashing > 0) {
                                    bashing--
                                    agg++
                                } else if (lethal > 0) {
                                    lethal--
                                    agg++
                                }
                            }
                        }
                    }
                } else if (delta < 0) {
                    repeat(-delta) {
                        when (damageType) {
                            "bashing" -> bashing = max(0, bashing - 1)
                            "lethal" -> lethal = max(0, lethal - 1)
                            "aggravated" -> agg = max(0, agg - 1)
                        }
                    }
                }

                val nextHealth = max(0, maxVal - agg - lethal - bashing)
                return@mapField field.copy(
                    damageTrack = true,
                    max = maxVal,
                    numValue = nextHealth.toDouble(),
                    aggravatedDamage = agg,
                    lethalDamage = lethal,
                    bashingDamage = bashing
                )
            }

            val currentAgg = (field.aggravatedDamage ?: max(0, maxVal - (field.numValue ?: maxVal.toDouble()).roundToInt()))
                .coerceIn(0, maxVal)
            val currentSup = if (currentAgg >= maxVal) 0 else (field.superficialDamage ?: 0).coerceIn(0, maxVal - 1)

            val totalSup = currentAgg * maxVal + currentSup
            val maxTotalSup = maxVal * maxVal
            val deltaSup = if (damageType == "aggravated") delta * maxVal else delta
            val nextTotalSup = (totalSup + deltaSup).coerceIn(0, maxTotalSup)

            val nextAgg = nextTotalSup / maxVal
            val nextSup = if (nextAgg >= maxVal) 0 else nextTotalSup % maxVal
            val nextHealth = max(0, maxVal - nextAgg)

            field.copy(
                damageTrack = true,
                max = maxVal,
                numValue = nextHealth.toDouble(),
                superficialDamage = nextSup,
                aggravatedDamage = nextAgg
            )
        }
    }

    fun reduceSuperficialDamage(sheet: CharacterSheetState, fieldId: String): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE || field.damageTrack != true) return@mapField field
            val maxVal = max(1, field.max ?: 7)
            val currentAgg = (field.aggravatedDamage ?: 0).coerceIn(0, maxVal)
            val currentSup = if (currentAgg >= maxVal) 0 else (field.superficialDamage ?: 0).coerceIn(0, maxVal - 1)
            val nextSup = currentSup / 2
            field.copy(superficialDamage = nextSup)
        }

    fun addRepeatableRow(sheet: CharacterSheetState, fieldId: String, newId: String): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.REPEATABLE) return@mapField field
            val defaultCol2 = if (field.col2Type == "number") "1.0" else "1 SLOT"
            val updatedRows = field.rows.orEmpty() + RepeatableRow(newId, "Novo Item", defaultCol2)
            field.copy(rows = updatedRows)
        }

    fun updateRepeatableRow(
        sheet: CharacterSheetState,
        fieldId: String,
        rowId: String,
        col1: String? = null,
        col2: String? = null
    ): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.REPEATABLE) return@mapField field
            val updatedRows = field.rows.orEmpty().map { row ->
                if (row.id == rowId) {
                    row.copy(
                        col1 = col1 ?: row.col1,
                        col2 = col2 ?: row.col2
                    )
                } else {
                    row
                }
            }
            field.copy(rows = updatedRows)
        }

    fun removeRepeatableRow(sheet: CharacterSheetState, fieldId: String, rowId: String): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.REPEATABLE) return@mapField field
            field.copy(rows = field.rows.orEmpty().filterNot { it.id == rowId })
        }

    fun updateFieldSchema(
        sheet: CharacterSheetState,
        fieldId: String,
        transform: (SheetField) -> SheetField
    ): CharacterSheetState = mapField(sheet, fieldId, transform)

    fun isSkillCard(card: SheetCard): Boolean {
        val code = card.code.uppercase()
        val title = card.title.uppercase()
        return card.id == "card_skills" ||
            code.contains("SKILL") ||
            code.contains("PERICIA") ||
            code.contains("HABILIDADE") ||
            title.contains("SKILL") ||
            title.contains("PERICIA") ||
            title.contains("PERÍCIA") ||
            title.contains("HABILIDADE")
    }

    fun buildFieldForCard(
        card: SheetCard?,
        id: String,
        label: String,
        key: String,
        kind: FieldKind,
        formulaOrExpr: String = "",
        isSkillTemplate: Boolean = false
    ): SheetField {
        val cleanKey = key.trim().lowercase().replace(Regex("[^a-z0-9_]+"), "_").trim('_').ifEmpty {
            "campo_${id.takeLast(4)}"
        }
        val cleanLabel = label.trim().uppercase().ifEmpty { "NOVO CAMPO" }
        val injectWodRollConfig = kind == FieldKind.ROLL || isSkillTemplate || (card != null && isSkillCard(card))
        val defaultDiff = if (injectWodRollConfig) 6 else null
        val defaultSpec = if (injectWodRollConfig) false else null
        val resolvedRollExpr = if (kind == FieldKind.ROLL) {
            formulaOrExpr.ifBlank { if (injectWodRollConfig) "pool(3, 6)" else "2d6" }
        } else {
            null
        }
        return SheetField(
            id = id,
            key = cleanKey,
            label = cleanLabel,
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
            rollLabel = if (kind == FieldKind.ROLL) cleanLabel else null,
            rollExpr = resolvedRollExpr,
            rollDifficulty = defaultDiff,
            rollSpecialty = defaultSpec,
            columns = if (kind == FieldKind.REPEATABLE) listOf("ITEM", "VALOR") else null,
            col2Type = if (kind == FieldKind.REPEATABLE) "text" else null,
            rows = if (kind == FieldKind.REPEATABLE) emptyList() else null
        )
    }

    fun addFieldToCard(sheet: CharacterSheetState, cardId: String, newField: SheetField): CharacterSheetState =
        touchMetadata(
            sheet.copy(
                cards = sheet.cards.map { card ->
                    if (card.id == cardId) card.copy(fields = card.fields + newField) else card
                }
            )
        )

    fun moveFieldInCard(
        sheet: CharacterSheetState,
        cardId: String,
        fieldId: String,
        delta: Int
    ): CharacterSheetState {
        if (delta == 0) return sheet
        return touchMetadata(
            sheet.copy(
                cards = sheet.cards.map { card ->
                    if (card.id != cardId) return@map card
                    val idx = card.fields.indexOfFirst { it.id == fieldId }
                    if (idx == -1) return@map card
                    val targetIdx = (idx + delta).coerceIn(0, card.fields.lastIndex)
                    if (targetIdx == idx) return@map card
                    val mutable = card.fields.toMutableList()
                    val item = mutable.removeAt(idx)
                    mutable.add(targetIdx, item)
                    card.copy(fields = mutable)
                }
            )
        )
    }

    fun syncRollExprDifficulty(expr: String?, nextDifficulty: Int): String? {
        if (expr.isNullOrBlank()) return expr
        val clamped = nextDifficulty.coerceIn(2, 10)
        val trimmed = expr.trim()
        val poolRegex = Regex("^pool\\((.+)\\)$", RegexOption.IGNORE_CASE)
        poolRegex.matchEntire(trimmed)?.let { match ->
            val inner = match.groupValues[1]
            var depth = 0
            var splitIdx = -1
            for (i in inner.indices) {
                when (inner[i]) {
                    '(' -> depth++
                    ')' -> depth--
                    ',' -> if (depth == 0) {
                        splitIdx = i
                        break
                    }
                }
            }
            val countPart = if (splitIdx == -1) inner.trim() else inner.substring(0, splitIdx).trim()
            return "pool($countPart, $clamped)"
        }
        val shortPoolRegex = Regex("^(.+?d10\\s*(?:@|>=)\\s*)(\\d+)$", RegexOption.IGNORE_CASE)
        shortPoolRegex.matchEntire(trimmed)?.let { match ->
            return "${match.groupValues[1]}$clamped"
        }
        return expr
    }

    fun cycleRollDifficulty(sheet: CharacterSheetState, fieldId: String): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            val current = (field.rollDifficulty ?: 6).coerceIn(2, 10)
            val next = if (current >= 10) 2 else current + 1
            field.copy(
                rollDifficulty = next,
                rollExpr = syncRollExprDifficulty(field.rollExpr, next)
            )
        }

    fun toggleRollSpecialty(sheet: CharacterSheetState, fieldId: String): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            field.copy(rollSpecialty = !(field.rollSpecialty ?: false))
        }

    fun removeFieldFromCard(sheet: CharacterSheetState, cardId: String, fieldId: String): CharacterSheetState =
        touchMetadata(
            sheet.copy(
                cards = sheet.cards.map { card ->
                    if (card.id == cardId) card.copy(fields = card.fields.filterNot { it.id == fieldId }) else card
                }
            )
        )

    fun addCardToSheet(sheet: CharacterSheetState, newCard: SheetCard): CharacterSheetState =
        touchMetadata(sheet.copy(cards = sheet.cards + newCard))

    fun updateCardSchema(
        sheet: CharacterSheetState,
        cardId: String,
        transform: (SheetCard) -> SheetCard
    ): CharacterSheetState =
        touchMetadata(
            sheet.copy(
                cards = sheet.cards.map { card -> if (card.id == cardId) transform(card) else card }
            )
        )

    fun removeCardFromSheet(sheet: CharacterSheetState, cardId: String): CharacterSheetState =
        touchMetadata(sheet.copy(cards = sheet.cards.filterNot { it.id == cardId }))

    fun touchMetadata(
        sheet: CharacterSheetState,
        nowIso: String = Instant.now().toString(),
        deviceId: String? = null
    ): CharacterSheetState = sheet.copy(
        revision = max(1, sheet.revision),
        updatedAt = nowIso,
        deviceId = deviceId?.takeIf { it.isNotBlank() } ?: sheet.deviceId.ifBlank { "local-device" }
    )

    private inline fun mapField(
        sheet: CharacterSheetState,
        fieldId: String,
        crossinline transform: (SheetField) -> SheetField
    ): CharacterSheetState = touchMetadata(
        sheet.copy(
            cards = sheet.cards.map { card ->
                card.copy(
                    fields = card.fields.map { f -> if (f.id == fieldId) transform(f) else f }
                )
            }
        )
    )
}

data class SheetValidationResult(
    val valid: Boolean,
    val errors: List<String>
)

/**
 * Unified structural & security validator aligned with `shared/presets/schema.v2.json`.
 * Rejects dangerous prototype keys, unknown properties (`additionalProperties: false`),
 * invalid field/tab enums, and out-of-range numeric bounds before Room persistence.
 */
object SheetPayloadValidator {
    private val dangerousKeys = setOf("__proto__", "constructor", "prototype")
    private val allowedSystemIds = setOf("wod", "dnd5e", "cyberpunk", "default", "blank")
    private val allowedTabIds = setOf("geral", "magias", "xp")
    private val allowedFieldKinds = setOf(
        "number", "text", "calculated", "resource", "boolean", "roll", "repeatable"
    )
    private val allowedRulePresets = setOf("storyteller_v20", "vampire_v5", "custom")
    val rootKeys = setOf(
        "id", "systemId", "systemName", "systemCode", "characterName",
        "revision", "updatedAt", "deviceId", "tabs", "cards", "rollLogs", "xp", "rulePreset"
    )
    val cardKeys = setOf("id", "tab", "code", "title", "colSpan", "fields")
    val fieldKeys = setOf(
        "id", "key", "label", "kind", "value", "numValue", "textValue", "boolValue",
        "max", "damageTrack", "superficialDamage", "aggravatedDamage", "bashingDamage", "lethalDamage",
        "formula", "showPlus", "rollLabel", "rollExpr", "rollDifficulty", "rollMod",
        "rollSpecialty", "useWillpower", "isSoak", "columns", "col2Type", "rows", "hint"
    )
    private val rowKeys = setOf("id", "col1", "col2")

    private val lenientJson = Json { ignoreUnknownKeys = false }

    fun validateRawJson(rawJson: String): SheetValidationResult {
        val parsed = runCatching { lenientJson.parseToJsonElement(rawJson) }.getOrElse {
            return SheetValidationResult(false, listOf("JSON inválido: ${it.message ?: "erro de sintaxe"}"))
        }
        return validateElement(parsed)
    }

    fun validateElement(element: JsonElement): SheetValidationResult {
        val errors = mutableListOf<String>()
        val root = element as? JsonObject
            ?: return SheetValidationResult(false, listOf("$: esperado objeto JSON."))

        checkObjectKeys(root, "$", rootKeys, errors)

        for (req in listOf("systemName", "systemCode", "characterName")) {
            val prim = root[req] as? JsonPrimitive
            if (prim == null || !prim.isString || prim.content.isEmpty()) {
                errors.add("$.$req: string obrigatória.")
            }
        }

        (root["systemId"] as? JsonPrimitive)?.let { prim ->
            if (!prim.isString || prim.content !in allowedSystemIds) {
                errors.add("$.systemId: sistema inválido '${prim.content}'.")
            }
        }

        (root["rulePreset"] as? JsonPrimitive)?.let { prim ->
            if (!prim.isString || prim.content !in allowedRulePresets) {
                errors.add("$.rulePreset: preset inválido '${prim.content}'.")
            }
        }

        (root["revision"] as? JsonPrimitive)?.let { prim ->
            val rev = prim.intOrNull
            if (rev == null || rev < 1) {
                errors.add("$.revision: deve ser inteiro >= 1.")
            }
        }

        val cardsElem = root["cards"] as? JsonArray
        if (cardsElem == null) {
            errors.add("$.cards: array obrigatório.")
        } else {
            if (cardsElem.size > 50) {
                errors.add("$.cards: máximo de 50 cartões excedido.")
            }
            cardsElem.forEachIndexed { cIdx, cardElem ->
                val cPath = "$.cards[$cIdx]"
                val cardObj = cardElem as? JsonObject
                if (cardObj == null) {
                    errors.add("$cPath: esperado objeto BentoCard.")
                    return@forEachIndexed
                }
                checkObjectKeys(cardObj, cPath, cardKeys, errors)

                val tabPrim = cardObj["tab"] as? JsonPrimitive
                if (tabPrim == null || !tabPrim.isString || tabPrim.content !in allowedTabIds) {
                    errors.add("$cPath.tab: aba inválida.")
                }

                val colSpan = (cardObj["colSpan"] as? JsonPrimitive)?.intOrNull
                if (colSpan == null || colSpan !in 1..4) {
                    errors.add("$cPath.colSpan: deve ser inteiro entre 1 e 4.")
                }

                val fieldsElem = cardObj["fields"] as? JsonArray
                if (fieldsElem == null) {
                    errors.add("$cPath.fields: array obrigatório.")
                    return@forEachIndexed
                }
                fieldsElem.forEachIndexed { fIdx, fieldElem ->
                    val fPath = "$cPath.fields[$fIdx]"
                    val fieldObj = fieldElem as? JsonObject
                    if (fieldObj == null) {
                        errors.add("$fPath: esperado objeto SheetField.")
                        return@forEachIndexed
                    }
                    checkObjectKeys(fieldObj, fPath, fieldKeys, errors)

                    val kindPrim = fieldObj["kind"] as? JsonPrimitive
                    if (kindPrim == null || !kindPrim.isString || kindPrim.content !in allowedFieldKinds) {
                        errors.add("$fPath.kind: tipo de campo inválido.")
                    }
                    (fieldObj["max"] as? JsonPrimitive)?.let { maxPrim ->
                        val maxVal = maxPrim.intOrNull
                        if (maxVal == null || maxVal !in 1..100000) {
                            errors.add("$fPath.max: deve ser inteiro entre 1 e 100000.")
                        }
                    }
                    (fieldObj["rollDifficulty"] as? JsonPrimitive)?.let { diffPrim ->
                        val diffVal = diffPrim.intOrNull
                        if (diffVal == null || diffVal !in 2..10) {
                            errors.add("$fPath.rollDifficulty: deve ser inteiro entre 2 e 10.")
                        }
                    }
                    (fieldObj["rows"] as? JsonArray)?.forEachIndexed { rIdx, rowElem ->
                        val rPath = "$fPath.rows[$rIdx]"
                        val rowObj = rowElem as? JsonObject
                        if (rowObj == null) {
                            errors.add("$rPath: esperado objeto RepeatableRow.")
                        } else {
                            checkObjectKeys(rowObj, rPath, rowKeys, errors)
                        }
                    }
                }
            }
        }

        return SheetValidationResult(valid = errors.isEmpty(), errors = errors)
    }

    private fun checkObjectKeys(
        obj: JsonObject,
        path: String,
        allowedKeys: Set<String>,
        errors: MutableList<String>
    ) {
        for (key in obj.keys) {
            if (key in dangerousKeys) {
                errors.add("$path: chave proibida '$key'.")
            } else if (key !in allowedKeys) {
                errors.add("$path: propriedade não permitida '$key'.")
            }
        }
    }
}


/**
 * Versioned export envelope shared with the Web build:
 * `{ "app": "gridsheet", "schemaVersion": 2, "exportedAt": "<ISO-8601>", "sheets": [...] }`.
 */
@Serializable
data class SheetExportEnvelope(
    val app: String = SheetTransfer.APP_ID,
    val schemaVersion: Int = SheetTransfer.SCHEMA_VERSION,
    val exportedAt: String,
    val sheets: List<CharacterSheetState>
)

/** Readable, user-facing failure raised by export/import (rendered in the status bar). */
class SheetTransferException(message: String, cause: Throwable? = null) : Exception(message, cause)

data class SheetIdResolution(
    val sheets: List<CharacterSheetState>,
    val clonedCount: Int
)

/**
 * Pure (Android-free) export/import pipeline so it can be unit-tested on the JVM:
 * bounded UTF-8 reads, envelope + legacy single-sheet detection, schema v2 validation,
 * legacy migration and id-collision cloning.
 */
object SheetTransfer {
    const val APP_ID = "gridsheet"
    const val SCHEMA_VERSION = 2
    const val MAX_IMPORT_BYTES = 5 * 1024 * 1024
    const val MAX_SHEETS_PER_FILE = 50
    const val COPY_SUFFIX = " (Cópia)"

    private const val MAX_CHARACTER_NAME = 120
    private const val MAX_ID_LENGTH = 64
    private val idPattern = Regex("^[a-zA-Z0-9_-]+$")
    private val envelopeKeys = setOf("app", "schemaVersion", "exportedAt", "sheets")
    private val dangerousKeys = setOf("__proto__", "constructor", "prototype")

    /** Omits nulls so re-imported payloads never carry `"max": null` (rejected by schema v2). */
    val transferJson = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
        prettyPrint = true
    }

    fun encodeEnvelope(
        sheets: List<CharacterSheetState>,
        nowIso: String = Instant.now().toString()
    ): String {
        if (sheets.isEmpty()) throw SheetTransferException("Nenhuma ficha para exportar.")
        if (sheets.size > MAX_SHEETS_PER_FILE) {
            throw SheetTransferException("Máximo de $MAX_SHEETS_PER_FILE fichas por arquivo.")
        }
        val normalized = sheets.map { it.copy(systemId = Presets.detectSystemId(it)) }
        val element = transferJson.encodeToJsonElement(
            SheetExportEnvelope.serializer(),
            SheetExportEnvelope(exportedAt = nowIso, sheets = normalized)
        )
        // Guarantee the backup is re-importable before anything is written to disk.
        (element as JsonObject)["sheets"]!!.let { it as JsonArray }.forEachIndexed { idx, sheetElem ->
            val errors = validateSheetElement(sheetElem)
            if (errors.isNotEmpty()) {
                throw SheetTransferException(
                    "Ficha '${normalized[idx].characterName}' não passa no schema v2: ${errors.take(2).joinToString(" | ")}"
                )
            }
        }
        return transferJson.encodeToString(JsonElement.serializer(), element)
    }

    /** Serializes the envelope as UTF-8 and always closes [output], even on failure. */
    fun writeEnvelope(
        output: OutputStream,
        sheets: List<CharacterSheetState>,
        nowIso: String = Instant.now().toString()
    ): Int {
        try {
            val payload = encodeEnvelope(sheets, nowIso)
            val writer = OutputStreamWriter(output, Charsets.UTF_8)
            writer.write(payload)
            writer.flush()
            return sheets.size
        } finally {
            runCatching { output.close() }
        }
    }

    /** Reads at most [maxBytes] bytes (guards against OOM) and always closes [input]. */
    fun readBoundedUtf8(input: InputStream, maxBytes: Int = MAX_IMPORT_BYTES): String {
        try {
            val buffer = ByteArrayOutputStream()
            val chunk = ByteArray(8 * 1024)
            var total = 0L
            while (true) {
                val read = input.read(chunk)
                if (read < 0) break
                total += read
                if (total > maxBytes) {
                    throw SheetTransferException(
                        "Arquivo excede o limite de ${formatBytes(maxBytes)} para importação."
                    )
                }
                buffer.write(chunk, 0, read)
            }
            return buffer.toString(Charsets.UTF_8.name()).removePrefix("\uFEFF")
        } finally {
            runCatching { input.close() }
        }
    }

    /**
     * Accepts either a versioned envelope (schemaVersion 1..2) or a bare v1/v2 sheet object.
     * Every sheet is validated against the schema v2 mirror before decoding, then migrated.
     */
    fun parseImportPayload(
        raw: String,
        deviceId: String = "local-device",
        nowIso: String = Instant.now().toString()
    ): List<CharacterSheetState> {
        if (raw.isBlank()) throw SheetTransferException("Arquivo vazio.")
        val parsed = runCatching { Json.parseToJsonElement(raw) }.getOrElse {
            throw SheetTransferException("JSON malformado: não foi possível ler o arquivo.", it)
        }
        val root = parsed as? JsonObject
            ?: throw SheetTransferException("Formato inválido: a raiz do JSON deve ser um objeto.")

        val isEnvelope = root.keys.any { it in envelopeKeys }
        val sheetElements: List<JsonElement> = if (isEnvelope) extractEnvelopeSheets(root) else listOf(root)

        return sheetElements.mapIndexed { idx, elem ->
            val label = if (isEnvelope) "Ficha #${idx + 1}" else "Ficha"
            val errors = validateSheetElement(elem)
            if (errors.isNotEmpty()) {
                throw SheetTransferException(
                    "$label inválida (schema v2): ${errors.take(3).joinToString(" | ")}"
                )
            }
            val decoded = runCatching {
                transferJson.decodeFromJsonElement(CharacterSheetState.serializer(), elem)
            }.getOrElse {
                throw SheetTransferException("$label com estrutura incompatível: campos obrigatórios ausentes.", it)
            }
            Presets.migrateLegacyWodSheet(decoded, deviceId, nowIso)
        }
    }

    /**
     * When [overwriteExisting] is false, any sheet whose id already exists (in the database or
     * earlier in the same batch) receives a fresh UUID and the " (Cópia)" suffix.
     */
    fun resolveIdCollisions(
        imported: List<CharacterSheetState>,
        existingIds: Set<String>,
        overwriteExisting: Boolean,
        idGenerator: () -> String = { UUID.randomUUID().toString() }
    ): SheetIdResolution {
        if (overwriteExisting) return SheetIdResolution(imported, 0)
        val taken = existingIds.toMutableSet()
        var cloned = 0
        val resolved = imported.map { sheet ->
            val result = if (sheet.id in taken) {
                var newId = idGenerator()
                var guard = 0
                while (newId in taken && guard++ < 16) newId = idGenerator()
                cloned++
                sheet.copy(id = newId, characterName = withCopySuffix(sheet.characterName))
            } else {
                sheet
            }
            taken += result.id
            result
        }
        return SheetIdResolution(resolved, cloned)
    }

    fun withCopySuffix(name: String): String {
        val base = name.trim().ifEmpty { "Ficha" }
        return base.take(MAX_CHARACTER_NAME - COPY_SUFFIX.length) + COPY_SUFFIX
    }

    /** `Vampira Ágata #2` → `vampira-agata-2.json` (ASCII, no path separators). */
    fun suggestedSheetFileName(sheet: CharacterSheetState): String {
        val ascii = Normalizer.normalize(sheet.characterName, Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
        val slug = ascii.lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .take(60)
            .trim('-')
        return "${slug.ifEmpty { "ficha" }}.json"
    }

    fun backupFileName(date: LocalDate = LocalDate.now()): String = "gridsheet-backup-$date.json"

    private fun extractEnvelopeSheets(root: JsonObject): List<JsonElement> {
        for (key in root.keys) {
            if (key in dangerousKeys) throw SheetTransferException("Envelope contém chave proibida '$key'.")
            if (key !in envelopeKeys) throw SheetTransferException("Envelope contém propriedade não permitida '$key'.")
        }
        val app = (root["app"] as? JsonPrimitive)?.takeIf { it.isString }?.content
        if (app != APP_ID) throw SheetTransferException("Arquivo não pertence ao GridSheet (app='${app ?: "?"}').")
        val version = (root["schemaVersion"] as? JsonPrimitive)?.takeIf { !it.isString }?.intOrNull
        if (version == null || version !in 1..SCHEMA_VERSION) {
            throw SheetTransferException("schemaVersion não suportada: ${root["schemaVersion"] ?: "ausente"}.")
        }
        root["exportedAt"]?.let { ts ->
            if (ts !is JsonPrimitive || !ts.isString) throw SheetTransferException("exportedAt deve ser string ISO-8601.")
        }
        val sheets = root["sheets"] as? JsonArray
            ?: throw SheetTransferException("Envelope sem array 'sheets'.")
        if (sheets.isEmpty()) throw SheetTransferException("Envelope não contém fichas.")
        if (sheets.size > MAX_SHEETS_PER_FILE) {
            throw SheetTransferException("Máximo de $MAX_SHEETS_PER_FILE fichas por arquivo.")
        }
        return sheets
    }

    /** Schema v2 structural validation plus the id/name bounds declared in schema.v2.json. */
    private fun validateSheetElement(elem: JsonElement): List<String> {
        val base = SheetPayloadValidator.validateElement(elem)
        val errors = base.errors.toMutableList()
        val obj = elem as? JsonObject ?: return errors
        (obj["id"] as? JsonPrimitive)?.let { idPrim ->
            if (!idPrim.isString || idPrim.content.length !in 1..MAX_ID_LENGTH || !idPattern.matches(idPrim.content)) {
                errors.add("$.id: deve casar ^[a-zA-Z0-9_-]+$ (1..$MAX_ID_LENGTH).")
            }
        }
        (obj["characterName"] as? JsonPrimitive)?.let { namePrim ->
            if (namePrim.isString && namePrim.content.length > MAX_CHARACTER_NAME) {
                errors.add("$.characterName: máximo de $MAX_CHARACTER_NAME caracteres.")
            }
        }
        return errors
    }

    private fun formatBytes(bytes: Int): String =
        if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) == 0) "${bytes / (1024 * 1024)} MB" else "$bytes bytes"
}
