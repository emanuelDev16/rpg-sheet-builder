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
    val isPossible: Boolean,
    val isOutOfClan: Boolean = false,
    val customMultiplier: Int? = null,
    val isWillpower: Boolean = false,
    val isHumanity: Boolean = false,
    val isBlockedByRule: Boolean = false,
    val blockedReason: String? = null
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

    private val WILLPOWER_KEYS = setOf("willpower", "forca_de_vontade")

    private val HUMANITY_KEYS = setOf("humanity", "humanidade", "path", "trilha", "road")

    private val VIRTUE_TEN_CAP_KEYS = setOf(
        "willpower", "forca_de_vontade", "humanity", "humanidade", "path", "trilha", "road"
    )

    private val VIRTUE_KEYS = setOf(
        "willpower", "forca_de_vontade", "humanity", "humanidade", "path", "trilha", "road",
        "conscience", "consciencia", "self_control", "autocontrole", "courage", "coragem",
        "conviction", "conviccao", "instinct", "instinto"
    )

    fun normalizeXpState(xp: XpState?): XpState {
        val total = max(0, xp?.totalEarned ?: 0)
        val spent = max(0, xp?.spent ?: 0)
        return XpState(
            totalEarned = total,
            spent = spent,
            ledger = xp?.ledger.orEmpty(),
            outOfClanFieldIds = xp?.outOfClanFieldIds.orEmpty(),
            customMultipliers = xp?.customMultipliers.orEmpty(),
            xpRulePreset = xp?.xpRulePreset ?: XpRulePreset.STORYTELLER_V20,
            customUseNewLevelBase = xp?.customUseNewLevelBase ?: false
        )
    }

    fun getAvailableXp(xp: XpState?): Int {
        val norm = normalizeXpState(xp)
        return max(0, norm.totalEarned - norm.spent)
    }

    fun classifyTraitField(card: SheetCard, field: SheetField): XpUpgradeCategory? {
        val key = field.key.trim().lowercase()
        if (key.isEmpty() || key in IGNORED_NUMERIC_KEYS) return null

        val cardCode = card.code.uppercase()
        val cardTitle = card.title.uppercase()
        val isVirtueCard = cardCode.contains("VIRTUE") || cardCode.contains("VIRTUDE") ||
            cardCode.contains("HUMANITY") || cardCode.contains("HUMANIDADE") ||
            cardTitle.contains("VIRTUE") || cardTitle.contains("VIRTUDE")

        if (field.kind == FieldKind.RESOURCE) {
            return if (key in VIRTUE_KEYS || isVirtueCard) XpUpgradeCategory.VIRTUE else null
        }
        if (field.kind != FieldKind.NUMBER) return null

        val isSkillCard = card.id == "card_skills" || cardCode.contains("SKILL") || cardCode.contains("PERICIA") || cardCode.contains("HABILIDADE")

        if (key == "perception" && isSkillCard) return XpUpgradeCategory.SKILL

        if (key in ATTRIBUTE_KEYS) return XpUpgradeCategory.ATTRIBUTE
        if (key in SKILL_KEYS) return XpUpgradeCategory.SKILL
        if (key in DISCIPLINE_KEYS) return XpUpgradeCategory.DISCIPLINE
        if (key in VIRTUE_KEYS) return XpUpgradeCategory.VIRTUE

        if (card.id == "card_atributos" || cardCode.contains("ATTRIBUTE") || cardCode.contains("ATRIBUTO") || cardCode.contains("ABILITY")) {
            return XpUpgradeCategory.ATTRIBUTE
        }
        if (isSkillCard) return XpUpgradeCategory.SKILL
        if (card.id == "card_arcano" || cardCode.contains("DISCIPLINE") || cardCode.contains("ARCANO") || cardCode.contains("PODER") || cardCode.contains("POWER")) {
            return XpUpgradeCategory.DISCIPLINE
        }
        if (isVirtueCard) return XpUpgradeCategory.VIRTUE
        return null
    }

    fun isWodSystem(sheet: CharacterSheetState): Boolean {
        if (sheet.systemId == SystemId.WOD) return true
        if (sheet.systemId != null && sheet.systemId != SystemId.BLANK) return false
        val sig = "${sheet.systemName} ${sheet.systemCode}".uppercase()
        return sig.contains("DARKNESS") || sig.contains("STORYTELLER") || sig.contains("VAMPIRE")
    }

    fun setXpRulePreset(sheet: CharacterSheetState, preset: XpRulePreset): CharacterSheetState {
        val norm = normalizeXpState(sheet.xp)
        return SheetMutators.touchMetadata(
            sheet.copy(xp = norm.copy(xpRulePreset = preset))
        )
    }

    fun setCustomUseNewLevelBase(sheet: CharacterSheetState, useNewLevelBase: Boolean): CharacterSheetState {
        val norm = normalizeXpState(sheet.xp)
        return SheetMutators.touchMetadata(
            sheet.copy(xp = norm.copy(customUseNewLevelBase = useNewLevelBase))
        )
    }

    fun calculateUpgradeCost(
        currentLevel: Int,
        category: XpUpgradeCategory,
        preset: XpRulePreset = XpRulePreset.STORYTELLER_V20,
        customOverride: Int? = null,
        isOutOfClan: Boolean = false,
        isWillpower: Boolean = false,
        isHumanity: Boolean = false,
        useNewLevelBase: Boolean = false,
        useD20Scale: Boolean = false
    ): Pair<Int, String>? {
        val rating = max(0, currentLevel)
        val nextLevel = rating + 1

        if (preset == XpRulePreset.VAMPIRE_V5 && (isWillpower || isHumanity)) {
            return null
        }

        if (customOverride != null && customOverride > 0) {
            return if (preset == XpRulePreset.VAMPIRE_V5 || (preset == XpRulePreset.CUSTOM && useNewLevelBase)) {
                (nextLevel * customOverride) to "$nextLevel × $customOverride (MANUAL)"
            } else if (rating == 0) {
                customOverride to "NEW ($customOverride XP · MANUAL)"
            } else {
                (rating * customOverride) to "$rating × $customOverride (MANUAL)"
            }
        }

        if (useD20Scale && preset != XpRulePreset.CUSTOM) {
            return when (category) {
                XpUpgradeCategory.ATTRIBUTE ->
                    if (rating == 0) 100 to "NEW (100 XP)" else (rating * 100) to "$rating × 100"
                XpUpgradeCategory.SKILL ->
                    if (rating == 0) 50 to "NEW (50 XP)" else (rating * 50) to "$rating × 50"
                XpUpgradeCategory.DISCIPLINE ->
                    if (rating == 0) 150 to "NEW (150 XP)" else (rating * 150) to "$rating × 150"
                XpUpgradeCategory.VIRTUE ->
                    if (rating == 0) 50 to "NEW (50 XP)" else (rating * 50) to "$rating × 50"
            }
        }

        return when (preset) {
            XpRulePreset.VAMPIRE_V5 -> when (category) {
                XpUpgradeCategory.ATTRIBUTE -> (nextLevel * 5) to "$nextLevel × 5 (V5)"
                XpUpgradeCategory.SKILL -> (nextLevel * 3) to "$nextLevel × 3 (V5)"
                XpUpgradeCategory.DISCIPLINE ->
                    if (isOutOfClan) (nextLevel * 7) to "$nextLevel × 7 (V5 FORA)"
                    else (nextLevel * 5) to "$nextLevel × 5 (V5 CLÃ)"
                XpUpgradeCategory.VIRTUE -> (nextLevel * 3) to "$nextLevel × 3 (V5)"
            }
            XpRulePreset.CUSTOM -> {
                val base = if (useNewLevelBase) nextLevel else rating
                val baseTag = if (useNewLevelBase) "NOVO" else "ATUAL"
                when (category) {
                    XpUpgradeCategory.ATTRIBUTE ->
                        if (base == 0) 4 to "NEW (4 XP)" else (base * 4) to "$base × 4 ($baseTag)"
                    XpUpgradeCategory.SKILL ->
                        if (base == 0) 3 to "NEW (3 XP)" else (base * 2) to "$base × 2 ($baseTag)"
                    XpUpgradeCategory.DISCIPLINE ->
                        when {
                            base == 0 -> 10 to "NEW (10 XP)"
                            isOutOfClan -> (base * 7) to "$base × 7 (FORA · $baseTag)"
                            else -> (base * 5) to "$base × 5 (CLÃ · $baseTag)"
                        }
                    XpUpgradeCategory.VIRTUE ->
                        if (isWillpower) {
                            if (base == 0) 1 to "NEW (1 XP)" else (base * 1) to "$base × 1 (WP · $baseTag)"
                        } else {
                            if (base == 0) 2 to "NEW (2 XP)" else (base * 2) to "$base × 2 ($baseTag)"
                        }
                }
            }
            XpRulePreset.STORYTELLER_V20 -> when (category) {
                XpUpgradeCategory.ATTRIBUTE ->
                    if (rating == 0) 4 to "NEW (4 XP)" else (rating * 4) to "$rating × 4"
                XpUpgradeCategory.SKILL ->
                    if (rating == 0) 3 to "NEW (3 XP)" else (rating * 2) to "$rating × 2"
                XpUpgradeCategory.DISCIPLINE ->
                    when {
                        rating == 0 -> 10 to "NEW (10 XP)"
                        isOutOfClan -> (rating * 7) to "$rating × 7 (FORA)"
                        else -> (rating * 5) to "$rating × 5 (CLÃ)"
                    }
                XpUpgradeCategory.VIRTUE ->
                    if (isWillpower) {
                        if (rating == 0) 1 to "NEW (1 XP)" else (rating * 1) to "$rating × 1 (WP)"
                    } else {
                        if (rating == 0) 2 to "NEW (2 XP)" else (rating * 2) to "$rating × 2"
                    }
            }
        }
    }

    fun getCostRulesSummary(sheet: CharacterSheetState): List<String> {
        val norm = normalizeXpState(sheet.xp)
        return when {
            norm.xpRulePreset == XpRulePreset.VAMPIRE_V5 ->
                listOf("ATTR NOVO×5", "PERÍCIA NOVO×3", "CLÃ NOVO×5 / FORA NOVO×7", "VANTAGENS NOVO×3", "WP/HUM: EM JOGO")
            norm.xpRulePreset == XpRulePreset.CUSTOM -> {
                val baseLabel = if (norm.customUseNewLevelBase) "NOVO NÍVEL" else "NÍVEL ATUAL"
                listOf("BASE: $baseLabel", "MULTIPLICADORES EDITÁVEIS")
            }
            isWodSystem(sheet) ->
                listOf("ATTR ×4", "SKILL ×2 (3 EM 0)", "CLÃ ×5 / FORA ×7 (10 EM 0)", "VIRT ×2", "WP ×1")
            else ->
                listOf("ABILITY CUR×100", "SKILL CUR×50 (50 EM 0)", "CAP 20/10")
        }
    }

    fun getTraitMaxCap(
        sheet: CharacterSheetState,
        currentValue: Int,
        category: XpUpgradeCategory? = null,
        key: String = ""
    ): Int {
        if (isWodSystem(sheet)) {
            val cleanKey = key.trim().lowercase()
            return if (category == XpUpgradeCategory.VIRTUE && cleanKey in VIRTUE_TEN_CAP_KEYS) 10 else 5
        }
        if (category == XpUpgradeCategory.SKILL) return max(10, currentValue)
        return if (currentValue >= 5) 20 else 10
    }

    fun toggleDisciplineClan(sheet: CharacterSheetState, fieldId: String): CharacterSheetState {
        val norm = normalizeXpState(sheet.xp)
        val nextSet = if (fieldId in norm.outOfClanFieldIds) {
            norm.outOfClanFieldIds - fieldId
        } else {
            norm.outOfClanFieldIds + fieldId
        }
        return SheetMutators.touchMetadata(
            sheet.copy(xp = norm.copy(outOfClanFieldIds = nextSet))
        )
    }

    fun setCustomMultiplier(sheet: CharacterSheetState, fieldId: String, multiplier: Int?): CharacterSheetState {
        val norm = normalizeXpState(sheet.xp)
        val nextMap = if (multiplier == null || multiplier <= 0) {
            norm.customMultipliers - fieldId
        } else {
            norm.customMultipliers + (fieldId to multiplier.coerceIn(1, 1000))
        }
        return SheetMutators.touchMetadata(
            sheet.copy(xp = norm.copy(customMultipliers = nextMap))
        )
    }

    fun extractAllTraits(sheet: CharacterSheetState): List<UpgradableTrait> {
        val normXp = normalizeXpState(sheet.xp)
        val availableXp = getAvailableXp(normXp)
        val useD20Scale = !isWodSystem(sheet)
        val traits = mutableListOf<UpgradableTrait>()

        for (card in sheet.cards) {
            for (field in card.fields) {
                val category = classifyTraitField(card, field) ?: continue
                val cleanKey = field.key.trim().lowercase()
                val raw = field.numValue ?: 0.0
                val currentValue = if (raw.isFinite()) max(0, raw.roundToInt()) else 0
                val maxCap = getTraitMaxCap(sheet, currentValue, category, cleanKey)
                val isMaxed = currentValue >= maxCap
                val isOutOfClan = category == XpUpgradeCategory.DISCIPLINE && field.id in normXp.outOfClanFieldIds
                val isWillpower = category == XpUpgradeCategory.VIRTUE && cleanKey in WILLPOWER_KEYS
                val isHumanity = category == XpUpgradeCategory.VIRTUE && cleanKey in HUMANITY_KEYS
                val customMult = normXp.customMultipliers[field.id]
                val costResult = calculateUpgradeCost(
                    currentLevel = currentValue,
                    category = category,
                    preset = normXp.xpRulePreset,
                    customOverride = customMult,
                    isOutOfClan = isOutOfClan,
                    isWillpower = isWillpower,
                    isHumanity = isHumanity,
                    useNewLevelBase = normXp.customUseNewLevelBase,
                    useD20Scale = useD20Scale
                )
                val isBlockedByRule = costResult == null
                val blockedReason = if (isBlockedByRule) "Gerenciado em jogo no V5" else null
                val cost = costResult?.first ?: 0
                val formulaLabel = costResult?.second ?: "GERENCIADO EM JOGO NO V5"
                val isAffordable = !isBlockedByRule && cost <= availableXp

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
                        isPossible = !isMaxed && !isBlockedByRule && isAffordable,
                        isOutOfClan = isOutOfClan,
                        customMultiplier = customMult,
                        isWillpower = isWillpower,
                        isHumanity = isHumanity,
                        isBlockedByRule = isBlockedByRule,
                        blockedReason = blockedReason
                    )
                )
            }
        }

        val order = mapOf(
            XpUpgradeCategory.ATTRIBUTE to 0,
            XpUpgradeCategory.SKILL to 1,
            XpUpgradeCategory.DISCIPLINE to 2,
            XpUpgradeCategory.VIRTUE to 3
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
        extractAllTraits(sheet).filter { !it.isMaxed && !it.isBlockedByRule }.minByOrNull { it.cost }

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

        if (trait.isBlockedByRule) {
            return XpMutationResult(false, sheet, error = trait.blockedReason ?: "${trait.label} não pode ser evoluído com XP neste preset.")
        }

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

        val updatedSheet = SheetMutators.updateFieldSchema(sheet, fieldId) { field ->
            if (field.kind == FieldKind.RESOURCE && (field.max ?: 10) < trait.nextValue) {
                field.copy(numValue = trait.nextValue.toDouble(), max = trait.nextValue)
            } else {
                field.copy(numValue = trait.nextValue.toDouble())
            }
        }.copy(
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
