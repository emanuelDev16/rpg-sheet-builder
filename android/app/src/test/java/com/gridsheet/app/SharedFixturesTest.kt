package com.gridsheet.app

import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetPayloadValidator
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.XpRulePreset
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SharedFixturesTest {

    private fun resolveFixtureFile(name: String): File {
        val candidates = listOf(
            File("../shared/presets/fixtures/$name"),
            File("shared/presets/fixtures/$name"),
            File("../../shared/presets/fixtures/$name")
        )
        return candidates.firstOrNull { it.isFile }
            ?: error("Shared fixture not found: $name")
    }

    @Test
    fun v20BotchFixtureMatchesDeterministicOutcomeWithAndWithoutWillpower() {
        val root = Json.parseToJsonElement(resolveFixtureFile("v20-botch.json").readText()).jsonObject
        val expr = root["expression"]!!.jsonPrimitive.content
        val vars = root["vars"]!!.jsonObject.mapValues { it.value.jsonPrimitive.double }
        val difficulty = root["difficulty"]!!.jsonPrimitive.int
        val rngValues = root["rng"]!!.jsonArray.map { it.jsonPrimitive.double }
        val expectedRolls = root["expectedRolls"]!!.jsonArray.map { it.jsonPrimitive.int }

        var idx1 = 0
        val withoutWp = FormulaEngine.rollDiceExpression(
            expression = expr,
            vars = vars,
            rulePreset = XpRulePreset.STORYTELLER_V20,
            difficultyOverride = difficulty,
            willpowerAutoSuccess = false
        ) { rngValues[idx1++] }
        val expNoWp = root["expectedWithoutWillpower"]!!.jsonObject
        assertTrue(withoutWp.ok)
        assertEquals(expectedRolls, withoutWp.rolls)
        assertEquals(expNoWp["total"]!!.jsonPrimitive.int, withoutWp.total)
        assertEquals(expNoWp["isFumble"]!!.jsonPrimitive.boolean, withoutWp.isFumble)

        var idx2 = 0
        val withWp = FormulaEngine.rollDiceExpression(
            expression = expr,
            vars = vars,
            rulePreset = XpRulePreset.STORYTELLER_V20,
            difficultyOverride = difficulty,
            willpowerAutoSuccess = true
        ) { rngValues[idx2++] }
        val expWithWp = root["expectedWithWillpower"]!!.jsonObject
        assertTrue(withWp.ok)
        assertEquals(expectedRolls, withWp.rolls)
        assertEquals(expWithWp["total"]!!.jsonPrimitive.int, withWp.total)
        assertEquals(expWithWp["isFumble"]!!.jsonPrimitive.boolean, withWp.isFumble)
    }

    @Test
    fun v5MessyCriticalFixtureAndWillpowerSurgeBlockHungerDice() {
        val root = Json.parseToJsonElement(resolveFixtureFile("v5-messy-critical.json").readText()).jsonObject
        val expr = root["expression"]!!.jsonPrimitive.content
        val hunger = root["hunger"]!!.jsonPrimitive.int
        val rngValues = root["rng"]!!.jsonArray.map { it.jsonPrimitive.double }

        var idx = 0
        val initial = FormulaEngine.rollDiceExpression(
            expression = expr,
            vars = emptyMap(),
            rulePreset = XpRulePreset.VAMPIRE_V5,
            hunger = hunger
        ) { rngValues[idx++] }
        val expInit = root["expectedInitial"]!!.jsonObject
        assertTrue(initial.ok)
        assertEquals(expInit["normalDice"]!!.jsonArray.map { it.jsonPrimitive.int }, initial.normalDice)
        assertEquals(expInit["hungerDice"]!!.jsonArray.map { it.jsonPrimitive.int }, initial.hungerDice)
        assertEquals(expInit["total"]!!.jsonPrimitive.int, initial.total)
        assertEquals(expInit["isCritical"]!!.jsonPrimitive.boolean, initial.isCritical)
        assertEquals(expInit["isMessyCritical"]!!.jsonPrimitive.boolean, initial.isMessyCritical)
        assertEquals(expInit["isBestialFailure"]!!.jsonPrimitive.boolean, initial.isBestialFailure)

        val attemptIndices = root["willpowerRerollAttemptIndices"]!!.jsonArray.map { it.jsonPrimitive.int }.toSet()
        val rerollRng = root["rerollRng"]!!.jsonArray.map { it.jsonPrimitive.double }
        var rIdx = 0
        val surged = FormulaEngine.rerollV5SelectedNormalDice(
            normalDice = initial.normalDice,
            hungerDice = initial.hungerDice,
            selectedNormalIndices = attemptIndices
        ) { rerollRng[rIdx++] }
        val expAfter = root["expectedAfterWillpowerReroll"]!!.jsonObject
        assertTrue(surged.ok)
        assertEquals(expAfter["normalDice"]!!.jsonArray.map { it.jsonPrimitive.int }, surged.normalDice)
        assertEquals(expAfter["hungerDice"]!!.jsonArray.map { it.jsonPrimitive.int }, surged.hungerDice)
        assertEquals(expAfter["total"]!!.jsonPrimitive.int, surged.total)
        assertEquals(expAfter["isCritical"]!!.jsonPrimitive.boolean, surged.isCritical)
        assertEquals(expAfter["isMessyCritical"]!!.jsonPrimitive.boolean, surged.isMessyCritical)
        assertEquals(expAfter["isBestialFailure"]!!.jsonPrimitive.boolean, surged.isBestialFailure)
    }

    @Test
    fun envelopeV1UpcastsCleanlyToV2() {
        val raw = resolveFixtureFile("envelope-v1-upcast.json").readText()
        val sheets = SheetTransfer.parseImportPayload(raw, deviceId = "android-test-dev")
        assertEquals(1, sheets.size)

        val upgraded = sheets.first()
        assertTrue(upgraded.id.isNotBlank())
        assertTrue(upgraded.revision >= 1)
        assertTrue(upgraded.updatedAt.isNotBlank())
        assertEquals("android-test-dev", upgraded.deviceId)

        val combate = upgraded.cards.firstOrNull { it.id == "card_combate" }
        assertNotNull(combate)
        assertEquals("HEALTH · WILLPOWER · HUNGER", combate!!.title)
        assertTrue(combate.fields.any { it.id == "f_hunger" })
        assertFalse(combate.fields.any { it.id == "f_blood_pool" })
    }

    @Test
    fun malformedXssFixtureRejectsPrototypePollutionAndEngineBlocksCyclesAndAbusiveDice() {
        val root = Json.parseToJsonElement(resolveFixtureFile("malformed-xss.json").readText()).jsonObject
        val pollutedRawJson = root["pollutedRawJson"]!!.jsonPrimitive.content
        val validation = SheetPayloadValidator.validateRawJson(pollutedRawJson)
        assertFalse(validation.valid)
        assertTrue(validation.errors.any { it.contains("__proto__") })

        val circSheet = CharacterSheetState(
            id = "sheet_circ",
            systemId = SystemId.BLANK,
            systemName = "CUSTOM",
            systemCode = "/TEST",
            characterName = "Loop",
            cards = listOf(
                SheetCard(
                    id = "c1",
                    tab = TabId.GERAL,
                    code = "//TEST",
                    title = "CALC",
                    fields = listOf(
                        SheetField(id = "f_a", key = "a", label = "A", kind = FieldKind.CALCULATED, formula = "b + 1"),
                        SheetField(id = "f_b", key = "b", label = "B", kind = FieldKind.CALCULATED, formula = "a + 1")
                    )
                )
            )
        )
        val eval = SheetEvaluator.evaluateSheet(circSheet)
        assertFalse(eval.computedByFieldId["f_a"]?.ok ?: true)
        assertTrue(eval.computedByFieldId["f_a"]?.error?.contains("circular", ignoreCase = true) == true)

        val deepExpr = "(".repeat(FormulaEngine.MAX_RECURSION_DEPTH + 3) + "1" + ")".repeat(FormulaEngine.MAX_RECURSION_DEPTH + 3)
        assertFalse(FormulaEngine.evaluateFormula(deepExpr, emptyMap()).ok)

        val abusiveDice = FormulaEngine.rollDiceExpression("500000d20", emptyMap())
        assertFalse(abusiveDice.ok)

        val abusivePool = FormulaEngine.rollDiceExpression("pool(500000, 6)", emptyMap())
        assertFalse(abusivePool.ok)
    }

    @Test
    fun transferRoundTripsV5SheetWithOptionalContractFieldsCleanly() {
        val v5Base = com.gridsheet.app.core.Presets.createWorldOfDarknessV5Sheet("roundtrip-dev")
        val enriched = v5Base.copy(
            bloodSurge = true,
            virtues = com.gridsheet.app.core.VirtuesState(conscience = 3, selfControl = 4, courage = 5)
        )
        val encoded = SheetTransfer.encodeEnvelope(listOf(enriched), "2026-11-20T14:00:00Z")
        val webStyleJson = encoded.replace("\"vampire_v5\"", "\"vampire-v5\"")
        val roundTripped = SheetTransfer.parseImportPayload(webStyleJson, deviceId = "roundtrip-dev")

        assertEquals(1, roundTripped.size)
        val sheet = roundTripped.single()
        assertEquals(XpRulePreset.VAMPIRE_V5, sheet.rulePreset)
        assertEquals(XpRulePreset.VAMPIRE_V5, sheet.xpRulePreset)
        assertEquals(true, sheet.bloodSurge)
        assertEquals(4, sheet.virtues?.selfControl)
        val health = sheet.cards.first { it.id == "card_combate" }.fields.first { it.id == "f_health" }
        assertEquals("stamina + 3", health.maxFormula)
        val composure = sheet.cards.first { it.id == "card_atributos" }.fields.first { it.id == "f_composure" }
        assertEquals("social", composure.attributeGroup)
    }
}
