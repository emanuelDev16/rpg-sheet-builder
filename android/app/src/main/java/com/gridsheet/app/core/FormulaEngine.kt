package com.gridsheet.app.core

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

data class FormulaResult(
    val ok: Boolean,
    val value: Double,
    val formatted: String,
    val error: String? = null
)

data class DiceRollResult(
    val ok: Boolean,
    val total: Int,
    val resolvedExpression: String,
    val breakdown: String,
    val rolls: List<Int>,
    val isCritical: Boolean = false,
    val isFumble: Boolean = false,
    val isPoolRoll: Boolean = false,
    val isMessyCritical: Boolean = false,
    val isBestialFailure: Boolean = false,
    val normalDice: List<Int> = emptyList(),
    val hungerDice: List<Int> = emptyList(),
    val error: String? = null
) {
    val normalRolls: List<Int> get() = normalDice
    val hungerRolls: List<Int> get() = hungerDice
}

private sealed interface Token {
    data class Num(val value: Double) : Token
    data class Id(val value: String) : Token
    data class Op(val value: Char) : Token
    data object LParen : Token
    data object RParen : Token
    data object Comma : Token
}

private val ALLOWED_FUNCTIONS: Map<String, (List<Double>) -> Double> = mapOf(
    "floor" to { args ->
        require(args.isNotEmpty()) { "floor() requer argumento" }
        floor(args[0])
    },
    "ceil" to { args ->
        require(args.isNotEmpty()) { "ceil() requer argumento" }
        ceil(args[0])
    },
    "round" to { args ->
        require(args.isNotEmpty()) { "round() requer argumento" }
        args[0].roundToInt().toDouble()
    },
    "abs" to { args ->
        require(args.isNotEmpty()) { "abs() requer argumento" }
        abs(args[0])
    },
    "min" to { args ->
        require(args.isNotEmpty()) { "min() requer argumentos" }
        args.min()
    },
    "max" to { args ->
        require(args.isNotEmpty()) { "max() requer argumentos" }
        args.max()
    }
)

private fun tokenize(input: String): List<Token> {
    val tokens = mutableListOf<Token>()
    var i = 0
    while (i < input.length) {
        val ch = input[i]
        when {
            ch.isWhitespace() -> i++
            ch.isDigit() || ch == '.' -> {
                val sb = StringBuilder()
                var dotCount = 0
                while (i < input.length && (input[i].isDigit() || input[i] == '.')) {
                    if (input[i] == '.') dotCount++
                    if (dotCount > 1) throw IllegalArgumentException("Número inválido próximo a \"$sb\"")
                    sb.append(input[i])
                    i++
                }
                val parsed = sb.toString().toDoubleOrNull()
                    ?: throw IllegalArgumentException("Número inválido: $sb")
                tokens.add(Token.Num(parsed))
            }
            ch.isLetter() || ch == '_' -> {
                val sb = StringBuilder()
                while (i < input.length && (input[i].isLetterOrDigit() || input[i] == '_')) {
                    sb.append(input[i])
                    i++
                }
                tokens.add(Token.Id(sb.toString().lowercase()))
            }
            ch == '+' || ch == '-' || ch == '*' || ch == '/' -> {
                tokens.add(Token.Op(ch))
                i++
            }
            ch == '(' -> {
                tokens.add(Token.LParen)
                i++
            }
            ch == ')' -> {
                tokens.add(Token.RParen)
                i++
            }
            ch == ',' -> {
                tokens.add(Token.Comma)
                i++
            }
            else -> throw IllegalArgumentException("Caractere não suportado: \"$ch\"")
        }
    }
    return tokens
}

private class ExpressionParser(
    private val tokens: List<Token>,
    private val vars: Map<String, Double>,
    private val formulaMap: Map<String, String> = emptyMap(),
    private val visited: Set<String> = emptySet(),
    initialDepth: Int = 0,
    private val resolvedMemo: MutableMap<String, Double> = mutableMapOf()
) {
    private var pos = 0
    private var depth = initialDepth

    fun parse(): Double {
        if (tokens.isEmpty()) throw IllegalArgumentException("Fórmula vazia")
        val result = parseExpression()
        if (pos < tokens.size) throw IllegalArgumentException("Expressão incompleta ou tokens extras")
        return result
    }

    private fun peek(): Token? = tokens.getOrNull(pos)

    private fun consume(): Token = tokens[pos++]

    private fun enterDepth() {
        depth++
        if (depth > FormulaEngine.MAX_RECURSION_DEPTH) {
            throw IllegalArgumentException("Profundidade máxima de recursão excedida (${FormulaEngine.MAX_RECURSION_DEPTH})")
        }
    }

    private fun leaveDepth() {
        depth--
    }

    private fun parseExpression(): Double {
        var left = parseTerm()
        while (true) {
            val tok = peek()
            if (tok is Token.Op && (tok.value == '+' || tok.value == '-')) {
                consume()
                val right = parseTerm()
                left = if (tok.value == '+') left + right else left - right
            } else {
                break
            }
        }
        return left
    }

    private fun parseTerm(): Double {
        var left = parseUnary()
        while (true) {
            val tok = peek()
            if (tok is Token.Op && (tok.value == '*' || tok.value == '/')) {
                consume()
                val right = parseUnary()
                if (tok.value == '/') {
                    if (right == 0.0) throw IllegalArgumentException("Divisão por zero")
                    left /= right
                } else {
                    left *= right
                }
            } else {
                break
            }
        }
        return left
    }

    private fun parseUnary(): Double {
        val tok = peek()
        if (tok is Token.Op && (tok.value == '+' || tok.value == '-')) {
            consume()
            val value = parseUnary()
            return if (tok.value == '-') -value else value
        }
        return parsePrimary()
    }

    private fun parsePrimary(): Double {
        val tok = peek() ?: throw IllegalArgumentException("Fim inesperado da fórmula")
        return when (tok) {
            is Token.Num -> {
                consume()
                tok.value
            }
            is Token.LParen -> {
                consume()
                enterDepth()
                try {
                    val value = parseExpression()
                    if (peek() !is Token.RParen) throw IllegalArgumentException("Parêntese \")\" ausente")
                    consume()
                    value
                } finally {
                    leaveDepth()
                }
            }
            is Token.Id -> {
                consume()
                if (peek() is Token.LParen) {
                    val fn = ALLOWED_FUNCTIONS[tok.value]
                        ?: throw IllegalArgumentException("Função desconhecida: \"${tok.value}\"")
                    consume() // '('
                    enterDepth()
                    try {
                        val args = mutableListOf<Double>()
                        if (peek() !is Token.RParen) {
                            args.add(parseExpression())
                            while (peek() is Token.Comma) {
                                consume()
                                args.add(parseExpression())
                            }
                        }
                        if (peek() !is Token.RParen) {
                            throw IllegalArgumentException("Parêntese \")\" ausente em ${tok.value}()")
                        }
                        consume()
                        fn(args)
                    } finally {
                        leaveDepth()
                    }
                } else {
                    resolvedMemo[tok.value]?.let { return it }
                    if (tok.value in visited) {
                        val chain = (visited + tok.value).joinToString(" -> ")
                        throw IllegalArgumentException("Referência circular detectada: $chain")
                    }
                    val targetFormula = formulaMap[tok.value]
                    if (targetFormula != null) {
                        val nextDepth = depth + 1
                        if (nextDepth > FormulaEngine.MAX_RECURSION_DEPTH) {
                            throw IllegalArgumentException(
                                "Profundidade máxima de recursão excedida (${FormulaEngine.MAX_RECURSION_DEPTH})"
                            )
                        }
                        val subRes = FormulaEngine.evaluateFormula(
                            expression = targetFormula,
                            vars = vars,
                            showPlus = false,
                            formulaMap = formulaMap,
                            visited = visited + tok.value,
                            depth = nextDepth,
                            resolvedMemo = resolvedMemo
                        )
                        if (!subRes.ok) {
                            throw IllegalArgumentException(subRes.error ?: "Erro ao resolver \"${tok.value}\"")
                        }
                        resolvedMemo[tok.value] = subRes.value
                        subRes.value
                    } else {
                        vars[tok.value]
                            ?: throw IllegalArgumentException("Variável indefinida: \"${tok.value}\"")
                    }
                }
            }
            else -> throw IllegalArgumentException("Token inesperado na fórmula")
        }
    }
}

object FormulaEngine {
    const val MAX_RECURSION_DEPTH = 15
    const val MAX_DICE_COUNT = 100
    const val MAX_DICE_SIDES = 1000
    const val MAX_FORMULA_LENGTH = 256

    fun formatSigned(value: Double, showPlus: Boolean = true): String {
        if (!value.isFinite()) return "ERR"
        val rounded = if (value % 1.0 == 0.0) {
            value.toInt().toString()
        } else {
            val oneDec = (value * 10.0).roundToInt() / 10.0
            if (oneDec % 1.0 == 0.0) oneDec.toInt().toString() else oneDec.toString()
        }
        return if (showPlus && value >= 0.0) "+$rounded" else rounded
    }

    fun evaluateFormula(
        expression: String,
        vars: Map<String, Double>,
        showPlus: Boolean = true,
        formulaMap: Map<String, String> = emptyMap(),
        visited: Set<String> = emptySet(),
        depth: Int = 0,
        resolvedMemo: MutableMap<String, Double> = mutableMapOf()
    ): FormulaResult {
        return try {
            val trimmed = expression.trim()
            if (trimmed.length > MAX_FORMULA_LENGTH) {
                return FormulaResult(
                    false,
                    0.0,
                    "ERR",
                    "Fórmula excede o tamanho máximo ($MAX_FORMULA_LENGTH caracteres)"
                )
            }
            if (depth > MAX_RECURSION_DEPTH) {
                return FormulaResult(
                    false,
                    0.0,
                    "ERR",
                    "Profundidade máxima de recursão excedida ($MAX_RECURSION_DEPTH)"
                )
            }
            val tokens = tokenize(trimmed)
            val valResult = ExpressionParser(
                tokens = tokens,
                vars = vars,
                formulaMap = formulaMap,
                visited = visited,
                initialDepth = depth,
                resolvedMemo = resolvedMemo
            ).parse()
            if (!valResult.isFinite()) {
                FormulaResult(false, 0.0, "ERR", "Resultado numérico inválido")
            } else {
                FormulaResult(true, valResult, formatSigned(valResult, showPlus))
            }
        } catch (err: Exception) {
            FormulaResult(false, 0.0, "ERR", err.message ?: "Erro de sintaxe")
        }
    }

    fun evaluateV5PoolResult(
        normalRolls: List<Int>,
        hungerRolls: List<Int>,
        woundPenalty: Int = 0,
        extraTag: String = ""
    ): DiceRollResult {
        val effectivePoolSize = normalRolls.size + hungerRolls.size
        val allRolls = normalRolls + hungerRolls
        val baseSuccesses = allRolls.count { it >= 6 }
        val normalTens = normalRolls.count { it == 10 }
        val hungerTens = hungerRolls.count { it == 10 }
        val critPairs = (normalTens + hungerTens) / 2
        val totalSuccesses = baseSuccesses + critPairs * 2
        val isCritical = critPairs > 0
        val isMessyCritical = isCritical && hungerTens > 0
        val hungerOnes = hungerRolls.count { it == 1 }
        val isBestialFailure = effectivePoolSize > 0 && totalSuccesses == 0 && hungerOnes > 0

        val statusText = when {
            isBestialFailure -> "BESTIAL FAILURE!"
            isMessyCritical -> "$totalSuccesses SUCESSOS · MESSY CRITICAL!"
            isCritical -> "$totalSuccesses SUCESSOS · CRITICAL!"
            else -> "$totalSuccesses ${if (totalSuccesses == 1) "SUCESSO" else "SUCESSOS"}"
        }
        val woundTag = if (woundPenalty < 0) " (IMPAIRED $woundPenalty)" else ""
        val diceText = buildString {
            append("N:[${normalRolls.joinToString(", ")}]")
            if (hungerRolls.isNotEmpty()) {
                append(" | FOME:[${hungerRolls.joinToString(", ")}]")
            }
        }
        return DiceRollResult(
            ok = true,
            total = totalSuccesses,
            resolvedExpression = "V5 ${effectivePoolSize}d10 (DIFF 6)$woundTag$extraTag",
            breakdown = "V5 ${effectivePoolSize}d10 $diceText$woundTag$extraTag → $statusText",
            rolls = allRolls,
            isCritical = isCritical,
            isFumble = isBestialFailure,
            isPoolRoll = true,
            isMessyCritical = isMessyCritical,
            isBestialFailure = isBestialFailure,
            normalDice = normalRolls,
            hungerDice = hungerRolls
        )
    }

    fun rerollV5SelectedNormalDice(
        normalDice: List<Int>,
        hungerDice: List<Int>,
        selectedNormalIndices: Set<Int>,
        rng: () -> Double = { Random.nextDouble() }
    ): DiceRollResult {
        val mutableNormal = normalDice.toMutableList()
        val validIndices = selectedNormalIndices
            .filter { it in mutableNormal.indices }
            .distinct()
            .take(3)
        for (idx in validIndices) {
            mutableNormal[idx] = floor(rng() * 10.0).toInt().coerceIn(0, 9) + 1
        }
        return evaluateV5PoolResult(
            normalRolls = mutableNormal,
            hungerRolls = hungerDice,
            extraTag = " · WP SURGE (${validIndices.size})"
        )
    }

    fun rerollV5WithWillpower(
        normalRolls: List<Int>,
        hungerRolls: List<Int>,
        rng: () -> Double = { Random.nextDouble() }
    ): DiceRollResult {
        val failedIndices = normalRolls.indices
            .filter { normalRolls[it] < 6 }
            .take(3)
            .toSet()
        return rerollV5SelectedNormalDice(normalRolls, hungerRolls, failedIndices, rng)
    }

    private fun executeWodPool(
        countExpr: String,
        diffExpr: String,
        vars: Map<String, Double>,
        rulePreset: XpRulePreset,
        hunger: Int,
        woundPenalty: Int,
        rng: () -> Double,
        difficultyOverride: Int? = null,
        specialty: Boolean = false,
        willpowerAutoSuccess: Boolean = false,
        isSoak: Boolean = false,
        soakDamageType: String = "lethal"
    ): DiceRollResult {
        val effectiveVars = if (isSoak && rulePreset != XpRulePreset.VAMPIRE_V5 && soakDamageType == "aggravated") {
            vars + mapOf("stamina" to 0.0, "vigor" to 0.0)
        } else {
            vars
        }

        val countRes = evaluateFormula(countExpr, effectiveVars, showPlus = false)
        if (!countRes.ok) {
            return DiceRollResult(
                ok = false,
                total = 0,
                resolvedExpression = countExpr,
                breakdown = countRes.error ?: "Erro na parada de dados",
                rolls = emptyList(),
                isPoolRoll = true,
                error = countRes.error
            )
        }

        val diffRes = evaluateFormula(diffExpr, effectiveVars, showPlus = false)
        if (!diffRes.ok && difficultyOverride == null && rulePreset != XpRulePreset.VAMPIRE_V5) {
            return DiceRollResult(
                ok = false,
                total = 0,
                resolvedExpression = diffExpr,
                breakdown = diffRes.error ?: "Dificuldade inválida",
                rolls = emptyList(),
                isPoolRoll = true,
                error = diffRes.error
            )
        }

        if (countRes.value.roundToInt() > MAX_DICE_COUNT) {
            val err = "Quantidade de dados excede o limite ($MAX_DICE_COUNT)"
            return DiceRollResult(
                ok = false,
                total = 0,
                resolvedExpression = countExpr,
                breakdown = err,
                rolls = emptyList(),
                isPoolRoll = true,
                error = err
            )
        }

        val appliedWoundPenalty = if (isSoak) 0 else min(0, woundPenalty)
        val basePoolSize = max(0, min(30, countRes.value.roundToInt()))
        val effectivePoolSize = max(0, basePoolSize + appliedWoundPenalty)

        if (rulePreset == XpRulePreset.VAMPIRE_V5) {
            val hungerCount = min(effectivePoolSize, hunger.coerceIn(0, 5))
            val normalCount = effectivePoolSize - hungerCount
            val normalRolls = List(normalCount) {
                floor(rng() * 10.0).toInt().coerceIn(0, 9) + 1
            }
            val hungerRolls = List(hungerCount) {
                floor(rng() * 10.0).toInt().coerceIn(0, 9) + 1
            }
            return evaluateV5PoolResult(
                normalRolls = normalRolls,
                hungerRolls = hungerRolls,
                woundPenalty = appliedWoundPenalty
            )
        }

        val rawDiff = difficultyOverride ?: diffRes.value.roundToInt()
        val difficulty = max(2, min(10, rawDiff))
        val willpowerBlocked = isSoak && soakDamageType == "aggravated"
        val willpowerUsed = !willpowerBlocked && willpowerAutoSuccess

        val rolls = mutableListOf<Int>()
        var rawSuccesses = 0
        var ones = 0
        var anyDieMetTarget = false

        repeat(effectivePoolSize) {
            val roll = floor(rng() * 10.0).toInt().coerceIn(0, 9) + 1
            rolls.add(roll)
            if (roll >= difficulty) {
                anyDieMetTarget = true
                if (roll == 10 && specialty) {
                    rawSuccesses += 2
                } else {
                    rawSuccesses++
                }
            }
            if (roll == 1) ones++
        }

        val diceSuccessesAfterOnes = max(0, rawSuccesses - ones)
        val finalTotal = diceSuccessesAfterOnes + if (willpowerUsed) 1 else 0
        val isBotch = !isSoak && effectivePoolSize > 0 && finalTotal == 0 && !anyDieMetTarget && ones > 0 && !willpowerUsed
        val isExceptional = !isBotch && finalTotal >= 5
        val woundTag = if (appliedWoundPenalty < 0) " (FERIMENTO $appliedWoundPenalty)" else ""

        val statusText = when {
            isBotch -> "BOTCH!"
            finalTotal == 0 && isSoak -> "0 SOAKED · FAILURE"
            isSoak -> "$finalTotal SOAKED"
            else -> "$finalTotal ${if (finalTotal == 1) "SUCESSO" else "SUCESSOS"}"
        }

        return DiceRollResult(
            ok = true,
            total = if (isBotch) 0 else finalTotal,
            resolvedExpression = "${effectivePoolSize}d10 (DIFF $difficulty)$woundTag",
            breakdown = "${effectivePoolSize}d10[${rolls.joinToString(", ")}] ≥$difficulty$woundTag → $statusText",
            rolls = rolls,
            isCritical = isExceptional,
            isFumble = isBotch,
            isPoolRoll = true,
            normalDice = rolls
        )
    }

    fun rollDiceExpression(
        expression: String,
        vars: Map<String, Double>,
        rulePreset: XpRulePreset = XpRulePreset.STORYTELLER_V20,
        hunger: Int = 0,
        woundPenalty: Int = 0,
        difficultyOverride: Int? = null,
        specialty: Boolean = false,
        willpowerAutoSuccess: Boolean = false,
        isSoak: Boolean = false,
        soakDamageType: String = "lethal",
        rng: () -> Double = { Random.nextDouble() }
    ): DiceRollResult {
        val cleaned = expression.trim()
        if (cleaned.isEmpty()) {
            return DiceRollResult(
                ok = false,
                total = 0,
                resolvedExpression = "",
                breakdown = "Expressão vazia",
                rolls = emptyList(),
                error = "Expressão de rolagem vazia"
            )
        }

        // Storyteller pool syntax: pool(strength + brawl, 6)
        val poolRegex = Regex("^pool\\((.+)\\)$", RegexOption.IGNORE_CASE)
        poolRegex.matchEntire(cleaned)?.let { match ->
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
            val countPart = if (splitIdx == -1) inner else inner.substring(0, splitIdx)
            val diffPart = if (splitIdx == -1) "6" else inner.substring(splitIdx + 1)
            return executeWodPool(
                countExpr = countPart,
                diffExpr = diffPart,
                vars = vars,
                rulePreset = rulePreset,
                hunger = hunger,
                woundPenalty = woundPenalty,
                rng = rng,
                difficultyOverride = difficultyOverride,
                specialty = specialty,
                willpowerAutoSuccess = willpowerAutoSuccess,
                isSoak = isSoak,
                soakDamageType = soakDamageType
            )
        }

        // Shorthand pool syntax: 5d10@6 or 5d10>=6
        val shortPoolRegex = Regex("^(.+?)d10\\s*(?:@|>=)\\s*(\\d+)$", RegexOption.IGNORE_CASE)
        shortPoolRegex.matchEntire(cleaned)?.let { match ->
            return executeWodPool(
                countExpr = match.groupValues[1],
                diffExpr = match.groupValues[2],
                vars = vars,
                rulePreset = rulePreset,
                hunger = hunger,
                woundPenalty = woundPenalty,
                rng = rng,
                difficultyOverride = difficultyOverride,
                specialty = specialty,
                willpowerAutoSuccess = willpowerAutoSuccess,
                isSoak = isSoak,
                soakDamageType = soakDamageType
            )
        }

        // Substitute variables (ignoring dice literals like d20)
        val idRegex = Regex("\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b")
        val diceLiteralRegex = Regex("^d\\d+$", RegexOption.IGNORE_CASE)
        val substituted = idRegex.replace(cleaned) { m ->
            val lower = m.value.lowercase()
            if (diceLiteralRegex.matches(lower)) {
                "1$lower"
            } else {
                val value = vars[lower]
                if (value != null) {
                    val fmt = formatSigned(value, showPlus = false)
                    if (value < 0) "($fmt)" else fmt
                } else {
                    m.value
                }
            }
        }

        val allRolls = mutableListOf<Int>()
        val diceDisplayParts = mutableListOf<String>()
        var hasSingleD20 = false
        var singleD20Roll = 0
        var diceCount = 0
        var totalDiceRolled = 0

        return try {
            val diceRegex = Regex("(\\d*)d(\\d+)", RegexOption.IGNORE_CASE)
            val mathExpr = diceRegex.replace(substituted) { m ->
                val count = m.groupValues[1].ifEmpty { "1" }.toIntOrNull()
                    ?: throw IllegalArgumentException("Quantidade de dados inválida: ${m.groupValues[1]}")
                val sides = m.groupValues[2].toIntOrNull()
                    ?: throw IllegalArgumentException("Lados do dado inválidos: d${m.groupValues[2]}")
                require(count in 1..MAX_DICE_COUNT) {
                    "Quantidade de dados inválida: $count (máx $MAX_DICE_COUNT)"
                }
                totalDiceRolled += count
                require(totalDiceRolled <= MAX_DICE_COUNT) {
                    "Quantidade total de dados excede o limite ($MAX_DICE_COUNT)"
                }
                require(sides in 2..MAX_DICE_SIDES) { "Lados do dado inválidos: d$sides" }

                diceCount++
                val rolls = mutableListOf<Int>()
                repeat(count) {
                    val roll = floor(rng() * sides.toDouble()).toInt().coerceIn(0, sides - 1) + 1
                    rolls.add(roll)
                    allRolls.add(roll)
                }
                if (count == 1 && sides == 20 && diceCount == 1) {
                    hasSingleD20 = true
                    singleD20Roll = rolls[0]
                } else {
                    hasSingleD20 = false
                }
                diceDisplayParts.add("${count}d$sides[${rolls.joinToString(",")}]")
                rolls.sum().toString()
            }

            val evalResult = evaluateFormula(mathExpr, vars, showPlus = false)
            if (!evalResult.ok) {
                return DiceRollResult(
                    ok = false,
                    total = 0,
                    resolvedExpression = substituted,
                    breakdown = evalResult.error ?: "Erro na rolagem",
                    rolls = allRolls,
                    error = evalResult.error
                )
            }

            val prettyResolved = mathExpr
                .replace(Regex("\\+\\s*\\(-(\\d+(?:\\.\\d+)?)\\)"), "- $1")
                .replace(Regex("\\+\\s*-(\\d+(?:\\.\\d+)?)"), "- $1")
                .replace(Regex("\\s+"), " ")
                .trim()

            val prettyFormula = substituted
                .replace(Regex("\\+\\s*\\(-(\\d+(?:\\.\\d+)?)\\)"), "- $1")
                .replace(Regex("\\+\\s*-(\\d+(?:\\.\\d+)?)"), "- $1")
                .replace(Regex("\\s+"), " ")
                .trim()

            val breakdown = if (diceDisplayParts.isNotEmpty()) {
                "${diceDisplayParts.joinToString(" + ")} → $prettyResolved"
            } else {
                prettyResolved
            }

            DiceRollResult(
                ok = true,
                total = evalResult.value.roundToInt(),
                resolvedExpression = prettyFormula,
                breakdown = breakdown,
                rolls = allRolls,
                isCritical = hasSingleD20 && singleD20Roll == 20,
                isFumble = hasSingleD20 && singleD20Roll == 1
            )
        } catch (err: Exception) {
            DiceRollResult(
                ok = false,
                total = 0,
                resolvedExpression = substituted,
                breakdown = err.message ?: "Erro na rolagem",
                rolls = allRolls,
                error = err.message ?: "Erro na rolagem"
            )
        }
    }

    fun resolveRollPreview(
        expression: String,
        vars: Map<String, Double>,
        rulePreset: XpRulePreset = XpRulePreset.STORYTELLER_V20,
        woundPenalty: Int = 0
    ): String {
        val cleaned = expression.trim()
        if (cleaned.isEmpty()) return ""

        val poolRegex = Regex("^pool\\((.+)\\)$", RegexOption.IGNORE_CASE)
        poolRegex.matchEntire(cleaned)?.let { match ->
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
            val countPart = if (splitIdx == -1) inner else inner.substring(0, splitIdx)
            val diffPart = if (splitIdx == -1) "6" else inner.substring(splitIdx + 1)
            val countRes = evaluateFormula(countPart, vars, showPlus = false)
            val diffRes = evaluateFormula(diffPart, vars, showPlus = false)
            if (countRes.ok && diffRes.ok) {
                val basePool = max(0, min(30, countRes.value.roundToInt()))
                val poolSize = max(0, basePool + woundPenalty)
                val diff = if (rulePreset == XpRulePreset.VAMPIRE_V5) 6 else max(2, min(10, diffRes.value.roundToInt()))
                val penTag = if (woundPenalty < 0) " ($woundPenalty)" else ""
                return if (rulePreset == XpRulePreset.VAMPIRE_V5) {
                    "${poolSize}d10 @ V5$penTag"
                } else {
                    "${poolSize}d10 @ DIFF $diff$penTag"
                }
            }
        }

        val shortPoolRegex = Regex("^(.+?)d10\\s*(?:@|>=)\\s*(\\d+)$", RegexOption.IGNORE_CASE)
        shortPoolRegex.matchEntire(cleaned)?.let { match ->
            val countRes = evaluateFormula(match.groupValues[1], vars, showPlus = false)
            if (countRes.ok) {
                val basePool = max(0, min(30, countRes.value.roundToInt()))
                val poolSize = max(0, basePool + woundPenalty)
                val diff = if (rulePreset == XpRulePreset.VAMPIRE_V5) "6" else match.groupValues[2]
                val penTag = if (woundPenalty < 0) " ($woundPenalty)" else ""
                return if (rulePreset == XpRulePreset.VAMPIRE_V5) {
                    "${poolSize}d10 @ V5$penTag"
                } else {
                    "${poolSize}d10 @ DIFF $diff$penTag"
                }
            }
        }

        val idRegex = Regex("\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b")
        val diceLiteralRegex = Regex("^d\\d+$", RegexOption.IGNORE_CASE)
        return idRegex.replace(cleaned) { m ->
            val lower = m.value.lowercase()
            if (diceLiteralRegex.matches(lower)) {
                m.value
            } else {
                vars[lower]?.let { formatSigned(it, showPlus = false) } ?: m.value
            }
        }.replace(Regex("\\+\\s*-(\\d+(?:\\.\\d+)?)"), "- $1")
    }
}
