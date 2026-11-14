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
    val error: String? = null
)

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
    private val vars: Map<String, Double>
) {
    private var pos = 0

    fun parse(): Double {
        if (tokens.isEmpty()) throw IllegalArgumentException("Fórmula vazia")
        val result = parseExpression()
        if (pos < tokens.size) throw IllegalArgumentException("Expressão incompleta ou tokens extras")
        return result
    }

    private fun peek(): Token? = tokens.getOrNull(pos)

    private fun consume(): Token = tokens[pos++]

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
                val value = parseExpression()
                if (peek() !is Token.RParen) throw IllegalArgumentException("Parêntese \")\" ausente")
                consume()
                value
            }
            is Token.Id -> {
                consume()
                if (peek() is Token.LParen) {
                    val fn = ALLOWED_FUNCTIONS[tok.value]
                        ?: throw IllegalArgumentException("Função desconhecida: \"${tok.value}\"")
                    consume() // '('
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
                } else {
                    vars[tok.value]
                        ?: throw IllegalArgumentException("Variável indefinida: \"${tok.value}\"")
                }
            }
            else -> throw IllegalArgumentException("Token inesperado na fórmula")
        }
    }
}

object FormulaEngine {
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
        showPlus: Boolean = true
    ): FormulaResult {
        return try {
            val tokens = tokenize(expression.trim())
            val valResult = ExpressionParser(tokens, vars).parse()
            if (!valResult.isFinite()) {
                FormulaResult(false, 0.0, "ERR", "Resultado numérico inválido")
            } else {
                FormulaResult(true, valResult, formatSigned(valResult, showPlus))
            }
        } catch (err: Exception) {
            FormulaResult(false, 0.0, "ERR", err.message ?: "Erro de sintaxe")
        }
    }

    private fun executeWodPool(
        countExpr: String,
        diffExpr: String,
        vars: Map<String, Double>,
        rng: () -> Double
    ): DiceRollResult {
        val countRes = evaluateFormula(countExpr, vars, showPlus = false)
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

        val diffRes = evaluateFormula(diffExpr, vars, showPlus = false)
        if (!diffRes.ok) {
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

        val poolSize = max(0, min(30, countRes.value.roundToInt()))
        val difficulty = max(2, min(10, diffRes.value.roundToInt()))
        val rolls = mutableListOf<Int>()
        var rawSuccesses = 0
        var ones = 0

        repeat(poolSize) {
            val roll = floor(rng() * 10.0).toInt().coerceIn(0, 9) + 1
            rolls.add(roll)
            if (roll >= difficulty) rawSuccesses++
            if (roll == 1) ones++
        }

        val isBotch = poolSize > 0 && rawSuccesses == 0 && ones > 0
        val netSuccesses = max(0, rawSuccesses - ones)
        val isExceptional = !isBotch && netSuccesses >= 5

        val statusText = if (isBotch) {
            "BOTCH!"
        } else {
            "$netSuccesses ${if (netSuccesses == 1) "SUCESSO" else "SUCESSOS"}"
        }

        return DiceRollResult(
            ok = true,
            total = if (isBotch) 0 else netSuccesses,
            resolvedExpression = "${poolSize}d10 (DIFF $difficulty)",
            breakdown = "${poolSize}d10[${rolls.joinToString(", ")}] ≥$difficulty → $statusText",
            rolls = rolls,
            isCritical = isExceptional,
            isFumble = isBotch,
            isPoolRoll = true
        )
    }

    fun rollDiceExpression(
        expression: String,
        vars: Map<String, Double>,
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
            return executeWodPool(countPart, diffPart, vars, rng)
        }

        // Shorthand pool syntax: 5d10@6 or 5d10>=6
        val shortPoolRegex = Regex("^(.+?)d10\\s*(?:@|>=)\\s*(\\d+)$", RegexOption.IGNORE_CASE)
        shortPoolRegex.matchEntire(cleaned)?.let { match ->
            return executeWodPool(match.groupValues[1], match.groupValues[2], vars, rng)
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

        return try {
            val diceRegex = Regex("(\\d*)d(\\d+)", RegexOption.IGNORE_CASE)
            val mathExpr = diceRegex.replace(substituted) { m ->
                val count = m.groupValues[1].ifEmpty { "1" }.toInt()
                val sides = m.groupValues[2].toInt()
                require(count in 1..50) { "Quantidade de dados inválida: $count" }
                require(sides in 2..1000) { "Lados do dado inválidos: d$sides" }

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

    fun resolveRollPreview(expression: String, vars: Map<String, Double>): String {
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
                val poolSize = max(0, min(30, countRes.value.roundToInt()))
                val diff = max(2, min(10, diffRes.value.roundToInt()))
                return "${poolSize}d10 @ DIFF $diff"
            }
        }

        val shortPoolRegex = Regex("^(.+?)d10\\s*(?:@|>=)\\s*(\\d+)$", RegexOption.IGNORE_CASE)
        shortPoolRegex.matchEntire(cleaned)?.let { match ->
            val countRes = evaluateFormula(match.groupValues[1], vars, showPlus = false)
            if (countRes.ok) {
                val poolSize = max(0, min(30, countRes.value.roundToInt()))
                return "${poolSize}d10 @ DIFF ${match.groupValues[2]}"
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
