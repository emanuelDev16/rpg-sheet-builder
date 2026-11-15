package com.gridsheet.app

import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SheetPayloadValidator
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.data.Fts5QuerySanitizer
import com.gridsheet.app.data.PdfTextLayerDetector
import com.gridsheet.app.data.ScannedPdfWithoutOcrException
import com.gridsheet.app.data.local.FtsRuleHitRow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class CoreEngineTest {
    @Test
    fun wodDefaultSheetComputesDerivedTraitsAndPools() {
        val wod = Presets.createWorldOfDarknessSheet()
        val eval = SheetEvaluator.evaluateSheet(wod)

        assertEquals("3", eval.computedByFieldId["f_blood_potency"]?.formatted)
        assertEquals("+7", eval.computedByFieldId["f_initiative"]?.formatted)
        assertEquals("3", eval.computedByFieldId["f_defense"]?.formatted)
        assertEquals(4.5, eval.totalCargoWeight, 0.01)
        assertTrue(eval.formulaErrors.isEmpty())

        val pool = FormulaEngine.rollDiceExpression("pool(strength + brawl, 6)", eval.variables) { 0.7 }
        assertTrue(pool.ok)
        assertTrue(pool.isPoolRoll)
        assertEquals(5, pool.total)
    }

    @Test
    fun dnd5ePresetComputesModifiersAndClassifiesPerceptionAsSkill() {
        val dnd = Presets.createPresetBySystemId(SystemId.DND5E)
        val eval = SheetEvaluator.evaluateSheet(dnd)

        assertEquals("+3", eval.computedByFieldId["f_prof"]?.formatted)
        assertEquals("+3", eval.computedByFieldId["f_mod_str"]?.formatted)
        assertEquals("18", eval.computedByFieldId["f_ac"]?.formatted)
        assertEquals("13", eval.computedByFieldId["f_spell_dc"]?.formatted)
        assertTrue(eval.formulaErrors.isEmpty())

        val possible = XpSystem.getPossibleUpgrades(dnd)
        val perception = possible.find { it.key == "perception" }
        assertTrue(perception != null)
        assertEquals(XpUpgradeCategory.SKILL, perception?.category)
        assertEquals(150, perception?.cost)

        val upgraded = XpSystem.upgradeTraitWithXp(dnd, "f_strength", "21:45", "xp_test_1")
        assertTrue(upgraded.ok)
        assertEquals(200, XpSystem.getAvailableXp(upgraded.sheet.xp))
        val after = XpSystem.getPossibleUpgrades(upgraded.sheet)
        assertFalse(after.any { it.category == XpUpgradeCategory.ATTRIBUTE })
    }

    @Test
    fun wodUpgradeCostAndUndoWorkDeterministically() {
        val wod = Presets.createWorldOfDarknessSheet()
        val res = XpSystem.upgradeTraitWithXp(wod, "f_dominate", "22:10", "xp_test_2")
        // Dominate 3 -> 4 costs 3 * 5 = 15 > 14 available XP
        assertFalse(res.ok)

        val awarded = XpSystem.awardXp(wod, 2, "BONUS", "22:11", "xp_test_3")
        assertTrue(awarded.ok)
        val res2 = XpSystem.upgradeTraitWithXp(awarded.sheet, "f_dominate", "22:12", "xp_test_4")
        assertTrue(res2.ok)
        assertEquals(1, XpSystem.getAvailableXp(res2.sheet.xp))

        val undone = XpSystem.undoLastUpgrade(res2.sheet)
        assertTrue(undone.ok)
        assertEquals(16, XpSystem.getAvailableXp(undone.sheet.xp))
    }

    @Test
    fun customBlankSheetStartsEmptyAndSupportsCardFieldCreation() {
        var sheet = Presets.createBlankSheet()
        assertEquals(SystemId.BLANK, Presets.detectSystemId(sheet))
        assertTrue(sheet.cards.isEmpty())

        sheet = SheetMutators.addCardToSheet(
            sheet,
            SheetCard(
                id = "c_custom_1",
                tab = TabId.GERAL,
                code = "//PILARES",
                title = "ATRIBUTOS",
                colSpan = 1,
                fields = emptyList()
            )
        )
        sheet = SheetMutators.addFieldToCard(
            sheet,
            "c_custom_1",
            SheetField(id = "f_coragem", key = "coragem", label = "CORAGEM", kind = FieldKind.NUMBER, numValue = 4.0)
        )
        sheet = SheetMutators.addFieldToCard(
            sheet,
            "c_custom_1",
            SheetField(id = "f_dobro", key = "impacto", label = "IMPACTO", kind = FieldKind.CALCULATED, formula = "coragem * 2", showPlus = false)
        )

        val eval = SheetEvaluator.evaluateSheet(sheet)
        assertEquals("8", eval.computedByFieldId["f_dobro"]?.formatted)
        assertTrue(eval.formulaErrors.isEmpty())

        sheet = SheetMutators.removeCardFromSheet(sheet, "c_custom_1")
        assertTrue(sheet.cards.isEmpty())
    }

    @Test
    fun wodVitalStatusUsesHungerAndRollsOverSuperficialDamageToAggravated() {
        var wod = Presets.createWorldOfDarknessSheet()
        val combatCard = wod.cards.find { it.id == "card_combate" }!!
        val hunger = combatCard.fields.find { it.id == "f_hunger" }
        val legacyBlood = combatCard.fields.find { it.id == "f_blood_pool" }
        val health = combatCard.fields.find { it.id == "f_health" }

        assertTrue(hunger != null)
        assertEquals(1.0, hunger?.numValue ?: -1.0, 0.01)
        assertEquals(5, hunger?.max)
        assertTrue(legacyBlood == null)
        assertTrue(health?.damageTrack == true)
        assertEquals(7, health?.max)

        // 7 superficial damage == 1 aggravated damage (full health track)
        wod = SheetMutators.adjustHealthDamage(wod, "f_health", "superficial", 6)
        val afterSix = wod.cards.find { it.id == "card_combate" }!!.fields.find { it.id == "f_health" }!!
        assertEquals(6, afterSix.superficialDamage)
        assertEquals(0, afterSix.aggravatedDamage)
        assertEquals(7.0, afterSix.numValue ?: 0.0, 0.01)

        wod = SheetMutators.adjustHealthDamage(wod, "f_health", "superficial", 1)
        val afterSeven = wod.cards.find { it.id == "card_combate" }!!.fields.find { it.id == "f_health" }!!
        assertEquals(0, afterSeven.superficialDamage)
        assertEquals(1, afterSeven.aggravatedDamage)
        assertEquals(6.0, afterSeven.numValue ?: 0.0, 0.01)

        // Healing 1 superficial rolls back from 1 aggravated to 6 superficial
        wod = SheetMutators.adjustHealthDamage(wod, "f_health", "superficial", -1)
        val afterHeal = wod.cards.find { it.id == "card_combate" }!!.fields.find { it.id == "f_health" }!!
        assertEquals(6, afterHeal.superficialDamage)
        assertEquals(0, afterHeal.aggravatedDamage)
        assertEquals(7.0, afterHeal.numValue ?: 0.0, 0.01)
    }

    @Test
    fun presetsV2BundlePassesValidatorAndMalformedPayloadsAreRejected() {
        val candidates = listOf(
            File("../shared/presets/presets.v2.json"),
            File("shared/presets/presets.v2.json")
        )
        val bundleFile = candidates.firstOrNull { it.exists() }
        assertTrue("presets.v2.json deve existir para validação", bundleFile != null)

        val bundleObj = Json.parseToJsonElement(bundleFile!!.readText()).jsonObject
        val presetsObj = bundleObj["presets"]!!.jsonObject
        assertEquals(5, presetsObj.size)
        for ((presetName, presetElem) in presetsObj) {
            val res = SheetPayloadValidator.validateElement(presetElem)
            assertTrue("Preset $presetName falhou na validação: ${res.errors}", res.valid)
        }

        val pollutedJson = """{"systemName":"WOD","systemCode":"/WOD","characterName":"X","cards":[],"__proto__":{"admin":true}}"""
        val pollutedRes = SheetPayloadValidator.validateRawJson(pollutedJson)
        assertFalse(pollutedRes.valid)
        assertTrue(pollutedRes.errors.any { it.contains("__proto__") })

        val badBoundsJson = """{"systemName":"WOD","systemCode":"/WOD","characterName":"X","revision":0,"cards":[{"id":"c1","tab":"geral","code":"//A","title":"C","colSpan":9,"fields":[{"id":"f1","key":"k1","label":"L","kind":"roll","rollDifficulty":99}]}]}"""
        val badBoundsRes = SheetPayloadValidator.validateRawJson(badBoundsJson)
        assertFalse(badBoundsRes.valid)
        assertTrue(badBoundsRes.errors.size >= 3)
    }

    @Test
    fun fts5QuerySanitizerPreventsSyntaxErrorsOnSpecialCharacters() {
        assertEquals(
            "\"super\"* \"natural\"* \"frenzy\"* \"check\"* \"1\"*",
            Fts5QuerySanitizer.sanitizeQuery("super-natural * \"frenzy\" (check):^1")
        )
        assertEquals(
            "\"frenzy\"* \"and\"* \"or\"* \"not\"* \"near\"*",
            Fts5QuerySanitizer.sanitizeQuery("frenzy AND OR NOT NEAR")
        )
        assertEquals("", Fts5QuerySanitizer.sanitizeQuery("   --- *** \"\" () : ^ + /   "))
        assertEquals(
            "\"frenesi\"* \"ação\"* \"rápida\"*",
            Fts5QuerySanitizer.sanitizeQuery("Frenesi, frenesi! Ação-rápida")
        )
    }

    @Test
    fun fts5ResultSortingOrdersByBm25ScoreAndBreaksTiesByPageAndTitle() {
        val hits = listOf(
            FtsRuleHitRow(
                bookId = "b2",
                bookTitle = "Player Guide",
                systemId = "WOD",
                pageNumber = 120,
                snippet = "weak match",
                rank = -1.2
            ),
            FtsRuleHitRow(
                bookId = "b1",
                bookTitle = "Vampire Core",
                systemId = "WOD",
                pageNumber = 88,
                snippet = "best match",
                rank = -5.75
            ),
            FtsRuleHitRow(
                bookId = "b2",
                bookTitle = "Companion",
                systemId = "WOD",
                pageNumber = 45,
                snippet = "tied mid B",
                rank = -2.4
            ),
            FtsRuleHitRow(
                bookId = "b1",
                bookTitle = "Anarch",
                systemId = "WOD",
                pageNumber = 45,
                snippet = "tied mid A",
                rank = -2.4
            )
        )

        val sorted = Fts5QuerySanitizer.sortHits(hits)
        assertEquals(listOf("best match", "tied mid A", "tied mid B", "weak match"), sorted.map { it.snippet })
    }

    @Test
    fun pdfTextSanitizerAndSnippetParserNormalizeAndHighlightMatches() {
        val cleaned = Fts5QuerySanitizer.sanitizeExtractedText("desen-\nvolvimento com\u00ADplexo   de\tregras\uE001")
        assertEquals("desenvolvimento complexo de regras", cleaned)

        val snippet = "Teste de ${Fts5QuerySanitizer.SNIPPET_START}frenesi${Fts5QuerySanitizer.SNIPPET_END} em combate."
        val segments = Fts5QuerySanitizer.parseSnippetSegments(snippet)
        assertEquals(
            listOf("Teste de " to false, "frenesi" to true, " em combate." to false),
            segments
        )
    }

    @Test
    fun failFastDetectorAbortsOnPage10ForScannedPdfWithoutOcrAndReturnsNoPages() {
        var pagesVisited = 0
        val noisyPages = (1..15).map { pageNum -> "Pg $pageNum / 15" }

        var thrown: ScannedPdfWithoutOcrException? = null
        val persistedPages = mutableListOf<com.gridsheet.app.data.local.RulePageFtsEntity>()
        try {
            val extracted = PdfTextLayerDetector.extractPagesWithFailFast(
                bookId = "scanned_15p",
                bookTitle = "Manual Escaneado",
                systemId = "WOD",
                totalPages = noisyPages.size,
                readPageRawText = { pageNum ->
                    pagesVisited += 1
                    noisyPages[pageNum - 1]
                }
            )
            persistedPages.addAll(extracted)
        } catch (err: ScannedPdfWithoutOcrException) {
            thrown = err
        }

        assertTrue(thrown != null)
        assertEquals(ScannedPdfWithoutOcrException.CODE, thrown?.code)
        assertEquals(10, thrown?.sampledPages)
        assertEquals(15, thrown?.totalPages)
        assertEquals(10, pagesVisited)
        assertTrue(persistedPages.isEmpty())
    }

    @Test
    fun failFastDetectorContinuesBeyondPage10WhenTextLayerIsPresent() {
        var pagesVisited = 0
        val extracted = PdfTextLayerDetector.extractPagesWithFailFast(
            bookId = "valid_15p",
            bookTitle = "Manual OCR",
            systemId = "WOD",
            totalPages = 15,
            readPageRawText = { pageNum ->
                pagesVisited += 1
                if (pageNum < 10) "" else "Chapter $pageNum: Combat rules, initiative order, and damage resolution mechanics."
            }
        )

        assertEquals(15, pagesVisited)
        assertEquals(6, extracted.size)
        assertEquals(10, extracted.first().pageNumber)
    }
}
