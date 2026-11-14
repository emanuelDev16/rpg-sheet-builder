package com.gridsheet.app.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

data class UpgradableTrait(
    val fieldId: String,
    val key: String,
    val label: String,
    val category: XpUpgradeCategory,
    val currentValue: Int,
    val nextValue: Int,
    val maxCap: Int,
    val cost: Int,
    val formulaLabel: String,
    val isMaxed: Boolean,
    val isAffordable: Boolean,
    val isPossible: Boolean
)

data class XpMutationResult(
    val ok: Boolean,
    val sheet: CharacterSheetState,
    val trait: UpgradableTrait? = null,
    val revertedLabel: String? = null,
    val error: String? = null
)

object XpSystem {
    private val IGNORED_NUMERIC_KEYS = setOf("generation", "nivel", "level")

    private val ATTRIBUTE_KEYS = setOf(
        "strength", "dexterity", "stamina", "constitution", "charisma",
        "manipulation", "appearance", "perception", "intelligence", "wisdom", "wits",
        "forca", "destreza", "constituicao", "intelecto", "sabedoria", "carisma"
    )

    private val SKILL_KEYS = setOf(
        "brawl", "firearms", "stealth", "subterfuge", "occult", "melee",
        "athletics", "acrobatics", "arcana", "academics", "deception", "history",
        "insight", "investigation", "nature", "religion", "sleight_of_hand",
        "performance", "survival", "awareness", "persuasion", "intimidation",
        "larceny", "medicine", "science", "technology", "etiquette",
        "streetwise", "drive", "alertness", "empathy", "expression", "finance", "politics"
    )

    private val DISCIPLINE_KEYS = setOf(
        "dominate", "presence", "celerity", "fortitude", "potence", "obfuscate",
        "auspex", "protean", "animalism", "blood_sorcery", "thaumaturgy",
        "oblivion", "necromancy", "chimerstry", "dementation"
    )

    fun normalizeXpState(xp: XpState?): XpState {
        val total = max(0, xp?.totalEarned ?: 0)
        val spent = max(0, xp?.spent ?: 0)
        return XpState(totalEarned = total, spent = spent, ledger = xp?.ledger.orEmpty())
    }

    fun getAvailableXp(xp: XpState?): Int {
        val norm = normalizeXpState(xp)
        return max(0, norm.totalEarned - norm.spent)
    }

    fun classifyTraitField(card: SheetCard, field: SheetField): XpUpgradeCategory? {
        if (field.kind != FieldKind.NUMBER) return null
        val key = field.key.trim().lowercase()
        if (key.isEmpty() || key in IGNORED_NUMERIC_KEYS) return null

        val cardCode = card.code.uppercase()
        val isSkillCard = card.id == "card_skills" || cardCode.contains("SKILL") || cardCode.contains("PERICIA")

        if (key == "perception" && isSkillCard) return XpUpgradeCategory.SKILL

        if (key in ATTRIBUTE_KEYS) return XpUpgradeCategory.ATTRIBUTE
        if (key in SKILL_KEYS) return XpUpgradeCategory.SKILL
        if (key in DISCIPLINE_KEYS) return XpUpgradeCategory.DISCIPLINE

        if (card.id == "card_atributos" || cardCode.contains("ATTRIBUTE") || cardCode.contains("ATRIBUTO") || cardCode.contains("ABILITY")) {
            return XpUpgradeCategory.ATTRIBUTE
        }
        if (isSkillCard) return XpUpgradeCategory.SKILL
        if (card.id == "card_arcano" || cardCode.contains("DISCIPLINE") || cardCode.contains("ARCANO")) {
            return XpUpgradeCategory.DISCIPLINE
        }
        return null
    }

    fun isWodSystem(sheet: CharacterSheetState): Boolean {
        if (sheet.systemId == SystemId.WOD) return true
        if (sheet.systemId != null && sheet.systemId != SystemId.BLANK) return false
        val sig = "${sheet.systemName} ${sheet.systemCode}".uppercase()
        return sig.contains("DARKNESS") || sig.contains("STORYTELLER") || sig.contains("VAMPIRE")
    }

    fun calculateUpgradeCost(
        category: XpUpgradeCategory,
        currentValue: Int,
        useD20Scale: Boolean = false
    ): Pair<Int, String> {
        val rating = max(0, currentValue)
        if (useD20Scale) {
            return when (category) {
                XpUpgradeCategory.ATTRIBUTE ->
                    if (rating == 0) 100 to "NEW (100 XP)" else (rating * 100) to "$rating × 100"
                XpUpgradeCategory.SKILL ->
                    if (rating == 0) 50 to "NEW (50 XP)" else (rating * 50) to "$rating × 50"
                XpUpgradeCategory.DISCIPLINE ->
                    if (rating == 0) 150 to "NEW (150 XP)" else (rating * 150) to "$rating × 150"
            }
        }
        return when (category) {
            XpUpgradeCategory.ATTRIBUTE ->
                if (rating == 0) 4 to "NEW (4 XP)" else (rating * 4) to "$rating × 4"
            XpUpgradeCategory.SKILL ->
                if (rating == 0) 3 to "NEW (3 XP)" else (rating * 2) to "$rating × 2"
            XpUpgradeCategory.DISCIPLINE ->
                if (rating == 0) 10 to "NEW (10 XP)" else (rating * 5) to "$rating × 5"
        }
    }

    fun getCostRulesSummary(sheet: CharacterSheetState): List<String> =
        if (isWodSystem(sheet)) {
            listOf("ATTR CUR×4", "SKILL CUR×2 (3 EM 0)", "DISC CUR×5 (10 EM 0)", "CAP 5")
        } else {
            listOf("ABILITY CUR×100", "SKILL CUR×50 (50 EM 0)", "CAP 20/10")
        }

    fun getTraitMaxCap(
        sheet: CharacterSheetState,
        currentValue: Int,
        category: XpUpgradeCategory? = null
    ): Int {
        if (isWodSystem(sheet)) return 5
        if (category == XpUpgradeCategory.SKILL) return max(10, currentValue)
        return if (currentValue >= 5) 20 else 10
    }

    fun extractAllTraits(sheet: CharacterSheetState): List<UpgradableTrait> {
        val availableXp = getAvailableXp(sheet.xp)
        val useD20Scale = !isWodSystem(sheet)
        val traits = mutableListOf<UpgradableTrait>()

        for (card in sheet.cards) {
            for (field in card.fields) {
                val category = classifyTraitField(card, field) ?: continue
                val raw = field.numValue ?: 0.0
                val currentValue = if (raw.isFinite()) max(0, raw.roundToInt()) else 0
                val maxCap = getTraitMaxCap(sheet, currentValue, category)
                val isMaxed = currentValue >= maxCap
                val (cost, formulaLabel) = calculateUpgradeCost(category, currentValue, useD20Scale)
                val isAffordable = cost <= availableXp

                traits.add(
                    UpgradableTrait(
                        fieldId = field.id,
                        key = field.key,
                        label = field.label,
                        category = category,
                        currentValue = currentValue,
                        nextValue = currentValue + 1,
                        maxCap = maxCap,
                        cost = cost,
                        formulaLabel = formulaLabel,
                        isMaxed = isMaxed,
                        isAffordable = isAffordable,
                        isPossible = !isMaxed && isAffordable
                    )
                )
            }
        }

        val order = mapOf(
            XpUpgradeCategory.ATTRIBUTE to 0,
            XpUpgradeCategory.SKILL to 1,
            XpUpgradeCategory.DISCIPLINE to 2
        )
        return traits.sortedBy { order[it.category] ?: 9 }
    }

    fun getPossibleUpgrades(
        sheet: CharacterSheetState,
        categoryFilter: XpUpgradeCategory? = null
    ): List<UpgradableTrait> = extractAllTraits(sheet).filter { trait ->
        trait.isPossible && (categoryFilter == null || trait.category == categoryFilter)
    }

    fun getCheapestBlockedUpgrade(sheet: CharacterSheetState): UpgradableTrait? =
        extractAllTraits(sheet).filter { !it.isMaxed }.minByOrNull { it.cost }

    fun awardXp(
        sheet: CharacterSheetState,
        delta: Int,
        reason: String,
        timestamp: String,
        entryId: String
    ): XpMutationResult {
        if (delta == 0) {
            return XpMutationResult(false, sheet, error = "Informe uma quantidade inteira de XP diferente de zero.")
        }
        val currentXp = normalizeXpState(sheet.xp)
        val nextEarned = currentXp.totalEarned + delta
        if (nextEarned < 0) {
            return XpMutationResult(false, sheet, error = "O total de XP ganho não pode ser negativo.")
        }
        if (nextEarned < currentXp.spent) {
            return XpMutationResult(
                false,
                sheet,
                error = "XP total ($nextEarned) não pode ficar menor que o XP já gasto (${currentXp.spent})."
            )
        }
        val cleanLabel = reason.trim().ifEmpty {
            if (delta > 0) "SESSION XP AWARD" else "XP ADJUSTMENT"
        }.uppercase()

        val entry = XpLedgerEntry(
            id = entryId,
            timestamp = timestamp,
            kind = "award",
            delta = delta,
            label = cleanLabel
        )

        return XpMutationResult(
            ok = true,
            sheet = sheet.copy(
                xp = currentXp.copy(
                    totalEarned = nextEarned,
                    ledger = (listOf(entry) + currentXp.ledger).take(40)
                )
            )
        )
    }

    fun upgradeTraitWithXp(
        sheet: CharacterSheetState,
        fieldId: String,
        timestamp: String,
        entryId: String
    ): XpMutationResult {
        val trait = extractAllTraits(sheet).find { it.fieldId == fieldId }
            ?: return XpMutationResult(false, sheet, error = "Atributo, perícia ou disciplina não encontrado na ficha.")

        if (trait.isMaxed) {
            return XpMutationResult(false, sheet, error = "${trait.label} já está no limite máximo (${trait.maxCap}).")
        }

        val available = getAvailableXp(sheet.xp)
        if (trait.cost > available) {
            return XpMutationResult(
                false,
                sheet,
                error = "XP insuficiente para ${trait.label} (necessário: ${trait.cost} XP, disponível: $available XP)."
            )
        }

        val currentXp = normalizeXpState(sheet.xp)
        val entry = XpLedgerEntry(
            id = entryId,
            timestamp = timestamp,
            kind = "upgrade",
            delta = -trait.cost,
            label = "${trait.label} ${trait.currentValue} → ${trait.nextValue}",
            fieldId = trait.fieldId,
            category = trait.category,
            fromValue = trait.currentValue,
            toValue = trait.nextValue
        )

        val updatedSheet = SheetMutators.updateNumberField(sheet, fieldId, trait.nextValue.toDouble()).copy(
            xp = currentXp.copy(
                spent = currentXp.spent + trait.cost,
                ledger = (listOf(entry) + currentXp.ledger).take(40)
            )
        )

        return XpMutationResult(ok = true, sheet = updatedSheet, trait = trait)
    }

    fun undoLastUpgrade(sheet: CharacterSheetState): XpMutationResult {
        val currentXp = normalizeXpState(sheet.xp)
        val targetIdx = currentXp.ledger.indexOfFirst { it.kind == "upgrade" }
        if (targetIdx == -1) {
            return XpMutationResult(false, sheet, error = "Nenhum upgrade recente para desfazer.")
        }

        val entry = currentXp.ledger[targetIdx]
        val fieldId = entry.fieldId
        val fromVal = entry.fromValue
        if (fieldId == null || fromVal == null) {
            return XpMutationResult(false, sheet, error = "Registro de upgrade incompatível para reversão.")
        }

        val refund = abs(entry.delta)
        val nextLedger = currentXp.ledger.filterIndexed { idx, _ -> idx != targetIdx }
        val updatedSheet = SheetMutators.updateNumberField(sheet, fieldId, fromVal.toDouble()).copy(
            xp = currentXp.copy(
                spent = max(0, currentXp.spent - refund),
                ledger = nextLedger
            )
        )

        return XpMutationResult(ok = true, sheet = updatedSheet, revertedLabel = entry.label)
    }
}
