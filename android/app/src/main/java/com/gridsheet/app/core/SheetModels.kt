package com.gridsheet.app.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import java.time.Instant
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
    @SerialName("discipline") DISCIPLINE
}

data class SystemOption(
    val id: SystemId,
    val label: String,
    val shortLabel: String,
    val description: String
)

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
    val formula: String? = null,
    val showPlus: Boolean? = null,
    val rollLabel: String? = null,
    val rollExpr: String? = null,
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
    val toValue: Int? = null
)

@Serializable
data class XpState(
    val totalEarned: Int = 0,
    val spent: Int = 0,
    val ledger: List<XpLedgerEntry> = emptyList()
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
    val xp: XpState = XpState()
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
    val totalCargoWeight: Double
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
            totalCargoWeight = roundedCargo
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

    fun adjustResourceValue(sheet: CharacterSheetState, fieldId: String, delta: Int): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE) return@mapField field
            val maxVal = max(1, field.max ?: 12)
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

    fun setResourceValue(sheet: CharacterSheetState, fieldId: String, target: Int): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE) return@mapField field
            val maxVal = max(1, field.max ?: 12)
            field.copy(numValue = max(0, min(maxVal, target)).toDouble())
        }

    fun adjustHealthDamage(
        sheet: CharacterSheetState,
        fieldId: String,
        damageType: String,
        delta: Int
    ): CharacterSheetState =
        mapField(sheet, fieldId) { field ->
            if (field.kind != FieldKind.RESOURCE) return@mapField field
            val maxVal = max(1, field.max ?: 7)
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

    fun addFieldToCard(sheet: CharacterSheetState, cardId: String, newField: SheetField): CharacterSheetState =
        touchMetadata(
            sheet.copy(
                cards = sheet.cards.map { card ->
                    if (card.id == cardId) card.copy(fields = card.fields + newField) else card
                }
            )
        )

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
    private val rootKeys = setOf(
        "id", "systemId", "systemName", "systemCode", "characterName",
        "revision", "updatedAt", "deviceId", "tabs", "cards", "rollLogs", "xp"
    )
    private val cardKeys = setOf("id", "tab", "code", "title", "colSpan", "fields")
    private val fieldKeys = setOf(
        "id", "key", "label", "kind", "value", "numValue", "textValue", "boolValue",
        "max", "damageTrack", "superficialDamage", "aggravatedDamage",
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
