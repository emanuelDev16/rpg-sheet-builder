package com.gridsheet.app

import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.PresetSummary
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMetadata
import com.gridsheet.app.core.SheetMetadataMapper
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SheetPayloadValidator
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.SheetTransferException
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.WorkspaceState
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.data.Fts5QuerySanitizer
import com.gridsheet.app.data.OcrPageRangeHelper
import com.gridsheet.app.data.PdfTextLayerDetector
import com.gridsheet.app.data.ScannedPdfWithoutOcrException
import com.gridsheet.app.data.SheetLibraryOps
import com.gridsheet.app.data.SheetRepositoryGateway
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.GridSheetDatabase
import com.gridsheet.app.data.local.IndexedBookEntity
import com.gridsheet.app.data.local.PdfRuleQueryBuilder
import com.gridsheet.app.data.local.RulePageFtsEntity
import com.gridsheet.app.data.local.RulePagesStorageMode
import com.gridsheet.app.data.local.SavedSheetEntity
import com.gridsheet.app.data.local.SheetEntity
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import com.gridsheet.app.ui.ActiveScreen
import com.gridsheet.app.ui.SheetStateController
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
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

    private fun resolveSharedPresetFile(fileName: String): File? {
        val candidates = listOf(
            File("../../shared/presets/$fileName"),
            File("../shared/presets/$fileName"),
            File("shared/presets/$fileName"),
            File("src/main/assets/presets/$fileName")
        )
        candidates.firstOrNull { it.exists() }?.let { return it }

        var dir: File? = File(".").canonicalFile
        repeat(6) {
            val candidate = dir?.let { File(it, "shared/presets/$fileName") }
            if (candidate != null && candidate.exists()) return candidate
            dir = dir?.parentFile
        }
        return null
    }

    @Test
    fun presetsV2BundlePassesValidatorAndMalformedPayloadsAreRejected() {
        val bundleFile = resolveSharedPresetFile("presets.v2.json")
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

    // ---------------------------------------------------------------------------------------
    // SAF export / import (envelope v2)
    // ---------------------------------------------------------------------------------------

    private class CloseTrackingOutputStream : ByteArrayOutputStream() {
        var closed = false
        override fun close() {
            closed = true
            super.close()
        }
    }

    private class CloseTrackingInputStream(bytes: ByteArray) : ByteArrayInputStream(bytes) {
        var closed = false
        override fun close() {
            closed = true
            super.close()
        }
    }

    private val fixedNow = "2026-11-14T23:00:00Z"

    private fun allPresets() = SystemId.values().map { Presets.createPresetBySystemId(it) }

    @Test
    fun envelopeV2RoundTripsAllPresetsAndClosesStream() {
        val originals = allPresets()
        val out = CloseTrackingOutputStream()
        val written = SheetTransfer.writeEnvelope(out, originals, fixedNow)

        assertEquals(originals.size, written)
        assertTrue("OutputStream deve ser fechado após exportação", out.closed)

        val raw = out.toByteArray().toString(Charsets.UTF_8)
        val root = Json.parseToJsonElement(raw).jsonObject
        assertEquals(setOf("app", "schemaVersion", "exportedAt", "sheets"), root.keys)
        assertEquals("gridsheet", root["app"]!!.jsonPrimitive.content)
        assertEquals(2, root["schemaVersion"]!!.jsonPrimitive.int)
        assertEquals(fixedNow, root["exportedAt"]!!.jsonPrimitive.content)
        assertEquals(originals.size, root["sheets"]!!.jsonArray.size)
        assertFalse("Nulls não devem ser serializados (schema v2 rejeita max:null)", raw.contains(": null"))

        val input = CloseTrackingInputStream(out.toByteArray())
        val imported = SheetTransfer.parseImportPayload(
            SheetTransfer.readBoundedUtf8(input),
            deviceId = "device-test",
            nowIso = fixedNow
        )
        assertTrue("InputStream deve ser fechado após importação", input.closed)

        val expected = originals.map {
            Presets.migrateLegacyWodSheet(it.copy(systemId = Presets.detectSystemId(it)), "device-test", fixedNow)
        }
        assertEquals(expected, imported)
    }

    @Test
    fun legacySingleSheetJsonIsAcceptedAndMigrated() {
        // v1-style payload: bare sheet object, no id / systemId / revision / updatedAt.
        val legacy = """
            {"systemName":"WORLD OF DARKNESS","systemCode":"//WOD","characterName":"Ágata",
             "cards":[{"id":"card_combate","tab":"geral","code":"//C","title":"HEALTH · WILLPOWER · BLOOD","colSpan":1,
               "fields":[{"id":"f_blood_pool","key":"blood_pool","label":"BLOOD","kind":"resource","numValue":3,"max":10}]}]}
        """.trimIndent()

        val sheets = SheetTransfer.parseImportPayload(legacy, deviceId = "device-test", nowIso = fixedNow)
        assertEquals(1, sheets.size)
        val sheet = sheets.single()
        assertEquals(SystemId.WOD, sheet.systemId)
        assertEquals("sheet_wod", sheet.id)
        assertEquals(1, sheet.revision)
        assertEquals(fixedNow, sheet.updatedAt)
        assertEquals("device-test", sheet.deviceId)
        val combat = sheet.cards.single()
        assertEquals("HEALTH · WILLPOWER · HUNGER", combat.title)
        assertEquals("f_hunger", combat.fields.single().id)

        // Envelope declaring schemaVersion 1 is also accepted.
        val v1Envelope = """{"app":"gridsheet","schemaVersion":1,"sheets":[$legacy]}"""
        assertEquals(1, SheetTransfer.parseImportPayload(v1Envelope, nowIso = fixedNow).size)
    }

    @Test
    fun malformedOrInvalidPayloadsAreRejectedWithReadableErrors() {
        fun rejectMessage(raw: String): String {
            try {
                SheetTransfer.parseImportPayload(raw, nowIso = fixedNow)
            } catch (e: SheetTransferException) {
                return e.message.orEmpty()
            }
            fail("Payload deveria ser rejeitado: $raw")
            error("unreachable")
        }

        assertTrue(rejectMessage("""{"app":"gridsheet","sheets":[""").contains("JSON malformado"))
        assertTrue(rejectMessage("   ").contains("vazio"))
        assertTrue(rejectMessage("""[1,2,3]""").contains("raiz"))
        assertTrue(rejectMessage("""{"app":"outro","schemaVersion":2,"sheets":[]}""").contains("GridSheet"))
        assertTrue(rejectMessage("""{"app":"gridsheet","schemaVersion":3,"sheets":[]}""").contains("schemaVersion"))
        assertTrue(rejectMessage("""{"app":"gridsheet","schemaVersion":2,"sheets":[]}""").contains("não contém"))
        assertTrue(
            rejectMessage("""{"app":"gridsheet","schemaVersion":2,"sheets":[],"__proto__":{}}""").contains("__proto__")
        )

        val validSheet = SheetTransfer.transferJson.encodeToString(
            com.gridsheet.app.core.CharacterSheetState.serializer(),
            Presets.createBlankSheet().copy(systemId = SystemId.BLANK)
        )
        val injected = validSheet.replaceFirst("{", """{"isAdmin":true,""")
        val msg = rejectMessage("""{"app":"gridsheet","schemaVersion":2,"sheets":[$validSheet,$injected]}""")
        assertTrue(msg, msg.contains("Ficha #2") && msg.contains("isAdmin"))

        val badId = validSheet.replaceFirst("\"id\": \"sheet_blank\"", "\"id\": \"../../etc\"")
        assertTrue(rejectMessage(badId).contains("$.id"))

        val tooMany = (1..51).joinToString(",") { validSheet }
        assertTrue(rejectMessage("""{"app":"gridsheet","schemaVersion":2,"sheets":[$tooMany]}""").contains("Máximo"))
    }

    @Test
    fun payloadAboveSizeLimitIsRejectedBeforeParsing() {
        val small = CloseTrackingInputStream(ByteArray(2048) { ' '.code.toByte() })
        try {
            SheetTransfer.readBoundedUtf8(small, maxBytes = 1024)
            fail("Leitura acima do limite deveria falhar")
        } catch (e: SheetTransferException) {
            assertTrue(e.message!!.contains("limite"))
        }
        assertTrue("Stream deve ser fechado mesmo em falha", small.closed)

        val oversize = ByteArrayInputStream(ByteArray(SheetTransfer.MAX_IMPORT_BYTES + 1) { ' '.code.toByte() })
        try {
            SheetTransfer.readBoundedUtf8(oversize)
            fail("Arquivo > 5 MB deveria ser rejeitado")
        } catch (e: SheetTransferException) {
            assertTrue(e.message!!.contains("5 MB"))
        }

        // Exactly at the limit is accepted; UTF-8 BOM is stripped.
        val bom = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())
        val atLimit = bom + "{}".toByteArray()
        assertEquals("{}", SheetTransfer.readBoundedUtf8(ByteArrayInputStream(atLimit), maxBytes = atLimit.size))
    }

    @Test
    fun existingIdIsClonedWithNewUuidAndCopySuffixUnlessOverwriting() {
        val wod = Presets.createWorldOfDarknessSheet()
        val dnd = Presets.createDnd5ePreset()
        val existingIds = setOf(wod.id)
        val generated = ArrayDeque(listOf(wod.id, "11111111-2222-3333-4444-555555555555", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"))

        val res = SheetTransfer.resolveIdCollisions(
            imported = listOf(wod, dnd, wod),
            existingIds = existingIds,
            overwriteExisting = false,
            idGenerator = { generated.removeFirst() }
        )
        assertEquals(2, res.clonedCount)
        val (clonedWod, keptDnd, secondClone) = res.sheets
        // Generator collision with an existing id is retried.
        assertEquals("11111111-2222-3333-4444-555555555555", clonedWod.id)
        assertEquals("${wod.characterName} (Cópia)", clonedWod.characterName)
        assertEquals(wod.cards, clonedWod.cards)
        assertEquals(dnd, keptDnd)
        // Duplicate within the same batch is also cloned.
        assertEquals("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", secondClone.id)

        // Default generator yields a schema-compatible UUID.
        val uuidRes = SheetTransfer.resolveIdCollisions(listOf(wod), existingIds, overwriteExisting = false)
        assertTrue(Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").matches(uuidRes.sheets.single().id))

        val overwrite = SheetTransfer.resolveIdCollisions(listOf(wod), existingIds, overwriteExisting = true)
        assertEquals(0, overwrite.clonedCount)
        assertEquals(wod, overwrite.sheets.single())

        // Name stays within schema maxLength 120.
        val longName = SheetTransfer.withCopySuffix("X".repeat(200))
        assertEquals(120, longName.length)
        assertTrue(longName.endsWith(" (Cópia)"))
    }

    @Test
    fun exportFileNamesAreSanitized() {
        val sheet = Presets.createBlankSheet().copy(characterName = "  Vampira Ágata / #2: <Noite>  ")
        assertEquals("vampira-agata-2-noite.json", SheetTransfer.suggestedSheetFileName(sheet))
        assertEquals("ficha.json", SheetTransfer.suggestedSheetFileName(sheet.copy(characterName = "???")))
        assertEquals(
            "gridsheet-backup-2026-11-14.json",
            SheetTransfer.backupFileName(java.time.LocalDate.of(2026, 11, 14))
        )
    }

    @Test
    fun validatorKeySetsMatchSharedSchemaV2() {
        val schemaFile = resolveSharedPresetFile("schema.v2.json")
        assertTrue("schema.v2.json deve existir", schemaFile != null)
        val schema = Json.parseToJsonElement(schemaFile!!.readText()).jsonObject
        val defs = schema["\$defs"]!!.jsonObject
        assertEquals(schema["properties"]!!.jsonObject.keys, SheetPayloadValidator.rootKeys)
        assertEquals(defs["BentoCard"]!!.jsonObject["properties"]!!.jsonObject.keys, SheetPayloadValidator.cardKeys)
        assertEquals(defs["SheetField"]!!.jsonObject["properties"]!!.jsonObject.keys, SheetPayloadValidator.fieldKeys)
    }

    @Test
    fun presetsV2JsonLoadsAllSystemsSafelyAndFallsBackWhenMalformed() {
        val bundleFile = resolveSharedPresetFile("presets.v2.json")
        assertNotNull("presets.v2.json deve existir", bundleFile)
        val raw = bundleFile!!.readText()

        val loaded = Presets.loadPresetsFromJson(raw, deviceId = "cold-start-device")
        assertEquals(
            setOf(SystemId.WOD, SystemId.DND5E, SystemId.CYBERPUNK, SystemId.DEFAULT, SystemId.BLANK),
            loaded.keys
        )

        val wod = loaded[SystemId.WOD]!!
        assertEquals("cold-start-device", wod.deviceId)
        val wodNameField = wod.cards.flatMap { it.fields }.first { it.id == "f_nome" }
        assertEquals("Julian Cross", wodNameField.textValue)
        val wodEval = SheetEvaluator.evaluateSheet(wod)
        assertEquals("3", wodEval.computedByFieldId["f_blood_potency"]?.formatted)

        val dnd = loaded[SystemId.DND5E]!!
        val dndGear = dnd.cards.flatMap { it.fields }.first { it.id == "f_mochila" }
        assertEquals("3", dndGear.rows?.firstOrNull()?.col2)
        val dndEval = SheetEvaluator.evaluateSheet(dnd)
        assertEquals("18", dndEval.computedByFieldId["f_ac"]?.formatted)

        val withUnknownKeys = raw.replace(
            "\"version\": \"2.0\"",
            "\"version\": \"2.0\", \"futureBundleFlag\": true"
        )
        assertEquals(5, Presets.loadPresetsFromJson(withUnknownKeys).size)

        assertTrue(Presets.loadPresetsFromJson("{invalid json").isEmpty())
        val fallbackWs = Presets.createDefaultWorkspace(deviceId = "fallback-device", context = null)
        assertEquals(SystemId.WOD, fallbackWs.activeSystemId)
        assertNotNull(fallbackWs.sheetsBySystem[SystemId.WOD])
    }

    @Test
    fun databaseMigrationsAndRuleSearchFallbacksAreConsistent() {
        val generatedDbImpl = Class.forName("com.gridsheet.app.data.local.GridSheetDatabase_Impl")
        assertTrue(GridSheetDatabase::class.java.isAssignableFrom(generatedDbImpl))
        assertNotNull(Class.forName("com.gridsheet.app.data.local.SheetDao_Impl"))
        assertNotNull(Class.forName("com.gridsheet.app.data.local.PdfRulesDao_Impl"))

        val sheetRow = SheetEntity(
            systemId = "WOD",
            systemName = "WORLD OF DARKNESS",
            characterName = "Julian Cross",
            sheetJson = "{}",
            updatedAtMillis = 1L,
            syncState = "SYNCED"
        )
        assertEquals("WOD", sheetRow.systemId)
        val savedSheetRow = SavedSheetEntity(
            sheetId = "sheet-1",
            systemId = "WOD",
            systemName = "WORLD OF DARKNESS",
            characterName = "Julian Cross",
            sheetJson = "{}",
            updatedAt = "2026-11-15T12:00:00Z",
            updatedAtMillis = 1L
        )
        assertEquals("sheet-1", savedSheetRow.sheetId)
        val metaRow = WorkspaceMetadataEntity(
            id = 1,
            activeSystemId = "WOD",
            updatedAtMillis = 1L
        )
        assertEquals(1, metaRow.id)
        val bookRow = IndexedBookEntity(
            bookId = "book-1",
            title = "V5 Core",
            systemId = "WOD",
            pageCount = 100,
            indexedAt = 1L
        )
        assertEquals("book-1", bookRow.bookId)

        assertEquals(1, GridSheetDatabase.MIGRATION_1_2.startVersion)
        assertEquals(2, GridSheetDatabase.MIGRATION_1_2.endVersion)
        assertEquals(2, GridSheetDatabase.MIGRATION_2_3.startVersion)
        assertEquals(3, GridSheetDatabase.MIGRATION_2_3.endVersion)
        assertEquals(3, GridSheetDatabase.MIGRATION_3_4.startVersion)
        assertEquals(4, GridSheetDatabase.MIGRATION_3_4.endVersion)

        val samplePage = RulePageFtsEntity(
            bookId = "book-1",
            systemId = "WOD",
            pageNumber = 12,
            content = "Frenzy test rule"
        )
        assertEquals("book-1", samplePage.bookId)

        assertTrue(GridSheetDatabase.FTS5_CREATE_SQL.contains("USING fts5"))
        assertTrue(GridSheetDatabase.FTS4_CREATE_SQL.contains("USING fts4"))
        assertTrue(GridSheetDatabase.FTS4_CREATE_SQL.contains("notindexed=`bookId`"))
        assertTrue(GridSheetDatabase.PLAIN_CREATE_SQL.contains("CREATE TABLE IF NOT EXISTS `rule_pages_fts`"))

        val fts5Query = PdfRuleQueryBuilder.buildSearchQuery("Frenzy! 50%", "WOD", 10, RulePagesStorageMode.FTS5)!!
        assertTrue(fts5Query.first.contains("bm25(rule_pages_fts)"))
        assertEquals("\"frenzy\"* \"50\"*", fts5Query.second[0])

        val fts4Query = PdfRuleQueryBuilder.buildSearchQuery("Frenzy! 50%", "WOD", 10, RulePagesStorageMode.FTS4)!!
        assertTrue(fts4Query.first.contains("offsets(rule_pages_fts)"))
        assertEquals("frenzy* 50*", fts4Query.second[0])

        val plainQuery = PdfRuleQueryBuilder.buildSearchQuery("100%_test", "WOD", 10, RulePagesStorageMode.PLAIN)!!
        assertTrue(plainQuery.first.contains("LIKE ? ESCAPE '\\'"))
        assertEquals("%100%", plainQuery.second[1])
        assertEquals("%test%", plainQuery.second[2])
    }

    @Test
    fun ocrPipelineSanitizesTextRespectsPageRangeAndAbortsCleanlyOnCancellation() = runBlocking {
        // 1. Range normalization and bitmap 1600px cap
        assertEquals(3..5, OcrPageRangeHelper.normalizeRange(totalPages = 10, pageRange = 3..5))
        assertEquals(0..9, OcrPageRangeHelper.normalizeRange(totalPages = 10, pageRange = -5..99))
        assertTrue(OcrPageRangeHelper.normalizeRange(totalPages = 10, pageRange = 8..4).isEmpty())

        val (cappedW, cappedH) = OcrPageRangeHelper.computeTargetBitmapSize(pageWidth = 3200, pageHeight = 4000)
        assertEquals(1600, cappedW)
        assertEquals(2000, cappedH)

        // 2. Sequential OCR respects pageRange and sanitizes recognized text
        val visited = mutableListOf<Int>()
        val progressSteps = mutableListOf<Triple<Int, Int, Int>>()
        val entities = OcrPageRangeHelper.runSequentialOcr(
            bookId = "ocr_book_1",
            systemId = "WOD",
            totalPages = 10,
            pageRange = 3..5,
            recognizePageText = { idx ->
                visited.add(idx)
                when (idx) {
                    3 -> "Frene-\nsi   e\tFome\u00AD   testes\uE001"
                    4 -> "   "
                    else -> "Combate tático página ${idx + 1}"
                }
            },
            onPageProcessed = { processed, total, pdfPage ->
                progressSteps.add(Triple(processed, total, pdfPage))
            }
        )

        assertEquals(listOf(3, 4, 5), visited)
        assertEquals(listOf(Triple(1, 3, 4), Triple(2, 3, 5), Triple(3, 3, 6)), progressSteps)
        assertEquals(2, entities.size)
        assertEquals(4, entities[0].pageNumber)
        assertEquals("Frenesi e Fome testes", entities[0].content)
        assertEquals(6, entities[1].pageNumber)

        // 3. Cancellation mid-loop aborts immediately and prevents persistence
        var persistedCalled = false
        var cancelledCaught = false
        try {
            val partial = OcrPageRangeHelper.runSequentialOcr(
                bookId = "ocr_abort",
                systemId = "WOD",
                totalPages = 10,
                pageRange = 0..9,
                recognizePageText = { idx ->
                    if (idx == 2) throw CancellationException("User cancelled OCR")
                    "Página ${idx + 1}"
                }
            )
            if (partial.isNotEmpty()) persistedCalled = true
        } catch (_: CancellationException) {
            cancelledCaught = true
        }

        assertTrue(cancelledCaught)
        assertFalse("Persistência não deve ocorrer após cancelamento do OCR", persistedCalled)
    }

    private class FakeSheetRepositoryGateway(
        initialSheets: List<CharacterSheetState> = emptyList(),
        initialBooks: List<IndexedBookEntity> = emptyList(),
        private val failWorkspaceLoad: Boolean = false,
        private val failRoomObserve: Boolean = false,
        private val idGenerator: () -> String = { java.util.UUID.randomUUID().toString() }
    ) : SheetRepositoryGateway {
        private val deviceId = "test-device"
        private val storedSheets = linkedMapOf<String, Pair<CharacterSheetState, Long>>()
        private val savedSheetsFlow = MutableStateFlow<List<SheetMetadata>>(emptyList())
        private val booksFlow = MutableStateFlow(initialBooks)
        private var currentWorkspace: WorkspaceState = Presets.createDefaultWorkspace(context = null, deviceId = deviceId)

        init {
            val baseMillis = 1_700_000_000_000L
            initialSheets.forEachIndexed { idx, sheet ->
                val sysId = Presets.detectSystemId(sheet)
                val tsMillis = runCatching {
                    java.time.Instant.parse(sheet.updatedAt).toEpochMilli()
                }.getOrDefault(baseMillis + idx * 1000L)
                storedSheets[sheet.id] = sheet.copy(systemId = sysId) to tsMillis
                currentWorkspace = WorkspaceState(
                    activeSystemId = sysId,
                    sheetsBySystem = currentWorkspace.sheetsBySystem + (sysId to sheet.copy(systemId = sysId))
                )
            }
            emitMetadataSnapshot()
        }

        private fun emitMetadataSnapshot() {
            val list = storedSheets.values.map { (sheet, millis) ->
                SheetMetadataMapper.fromSheet(sheet, Presets.detectSystemId(sheet), millis)
            }
            savedSheetsFlow.value = SheetMetadataMapper.sortDescending(list)
        }

        override fun getOrCreateDeviceId(): String = deviceId

        override fun loadAvailablePresets(): List<PresetSummary> =
            Presets.getAvailablePresets(context = null, deviceId = deviceId)

        override fun loadWorkspace(): WorkspaceState {
            if (failWorkspaceLoad) throw IllegalStateException("Simulated empty/corrupt prefs")
            return currentWorkspace
        }

        override fun saveWorkspace(workspace: WorkspaceState, timestampMillis: Long) {
            currentWorkspace = workspace
            workspace.sheetsBySystem.values.forEach { sheet ->
                val sysId = Presets.detectSystemId(sheet)
                storedSheets[sheet.id] = sheet.copy(systemId = sysId) to timestampMillis
            }
            emitMetadataSnapshot()
        }

        override suspend fun saveToRoom(workspace: WorkspaceState, timestampMillis: Long, isDirty: Boolean) {
            saveWorkspace(workspace, timestampMillis)
        }

        override suspend fun pushRemoteMirror(workspace: WorkspaceState, timestampMillis: Long): Boolean = false

        override suspend fun hydrateAndSyncFromRoom(): WorkspaceState {
            if (failWorkspaceLoad) throw IllegalStateException("Simulated empty Room during init")
            return currentWorkspace
        }

        override suspend fun syncWithRemoteMirror(): WorkspaceState? = null

        override fun observeSavedSheets(): Flow<List<SheetMetadata>> =
            if (failRoomObserve) {
                flow { throw IllegalStateException("Simulated Room query error") }
            } else {
                savedSheetsFlow
            }

        override suspend fun getSavedSheet(sheetId: String): CharacterSheetState? =
            storedSheets[sheetId]?.first

        override suspend fun saveSheet(
            sheet: CharacterSheetState,
            timestampMillis: Long
        ): CharacterSheetState {
            val sysId = Presets.detectSystemId(sheet)
            val tagged = sheet.copy(systemId = sysId)
            storedSheets[tagged.id] = tagged to timestampMillis
            emitMetadataSnapshot()
            return tagged
        }

        override suspend fun createFreshSheetFromHome(
            systemId: String,
            customName: String?
        ): Pair<CharacterSheetState, WorkspaceState> {
            val fresh = Presets.createFreshSheetForSystem(
                systemId = systemId,
                deviceId = deviceId,
                customName = customName,
                nowIso = "2026-11-15T14:00:00Z",
                idGenerator = idGenerator
            )
            val nowMillis = 1_794_837_600_000L
            storedSheets[fresh.id] = fresh to nowMillis
            val resolvedSys = Presets.detectSystemId(fresh)
            val nextWs = WorkspaceState(
                activeSystemId = resolvedSys,
                sheetsBySystem = currentWorkspace.sheetsBySystem + (resolvedSys to fresh)
            )
            currentWorkspace = nextWs
            emitMetadataSnapshot()
            return fresh to nextWs
        }

        override suspend fun duplicateSheet(sheetId: String): CharacterSheetState? {
            val source = storedSheets[sheetId]?.first ?: return null
            val duplicated = SheetLibraryOps.buildDuplicatedSheet(
                source = source,
                existingIds = storedSheets.keys,
                deviceId = deviceId,
                nowIso = "2026-11-15T14:05:00Z",
                idGenerator = idGenerator
            )
            val nowMillis = 1_794_837_900_000L
            storedSheets[duplicated.id] = duplicated to nowMillis
            emitMetadataSnapshot()
            return duplicated
        }

        override suspend fun deleteSheet(sheetId: String): WorkspaceState {
            val removed = storedSheets.remove(sheetId)?.first
            if (removed != null) {
                val sysId = Presets.detectSystemId(removed)
                val replacement = storedSheets.values
                    .filter { Presets.detectSystemId(it.first) == sysId }
                    .maxByOrNull { it.second }
                    ?.first
                val updatedMap = currentWorkspace.sheetsBySystem.toMutableMap()
                if (replacement != null) {
                    updatedMap[sysId] = replacement
                } else {
                    updatedMap.remove(sysId)
                }
                val fallbackWs = if (updatedMap.isEmpty()) {
                    WorkspaceState(activeSystemId = SystemId.WOD, sheetsBySystem = emptyMap())
                } else {
                    val activeSys = if (updatedMap.containsKey(currentWorkspace.activeSystemId)) {
                        currentWorkspace.activeSystemId
                    } else {
                        updatedMap.keys.first()
                    }
                    WorkspaceState(activeSystemId = activeSys, sheetsBySystem = updatedMap)
                }
                currentWorkspace = fallbackWs
            }
            emitMetadataSnapshot()
            return currentWorkspace
        }

        override fun observeIndexedBooks(systemId: SystemId): Flow<List<IndexedBookEntity>> =
            booksFlow.map { list -> list.filter { it.systemId.equals(systemId.name, ignoreCase = true) } }

        override fun observeAllIndexedBooks(): Flow<List<IndexedBookEntity>> = booksFlow
    }

    @Test
    fun homeScreenStartsInHomeWithDefensiveFallbackAndBookCount() = runBlocking {
        val emptyGateway = FakeSheetRepositoryGateway(
            initialBooks = listOf(
                IndexedBookEntity("b1", "V5 Core", "WOD", 420, 100L),
                IndexedBookEntity("b2", "PHB 5e", "DND5E", 316, 200L)
            )
        )
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val controller = SheetStateController(emptyGateway, scope, Dispatchers.Unconfined)
            controller.awaitIdle()

            assertEquals(ActiveScreen.HOME, controller.uiState.value.activeScreen)
            assertTrue(controller.uiState.value.sheets.isEmpty())
            assertEquals(2, controller.uiState.value.indexedBooksCount)
            assertTrue(controller.uiState.value.presets.any { it.systemId == SystemId.WOD })
            assertTrue(controller.uiState.value.presets.any { it.systemId == SystemId.DND5E })
        } finally {
            scope.cancel()
        }

        // Fallback defensivo caso o Room / prefs falhem durante a inicialização
        val failingGateway = FakeSheetRepositoryGateway(
            failWorkspaceLoad = true,
            failRoomObserve = true
        )
        val failingScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val controller = SheetStateController(failingGateway, failingScope, Dispatchers.Unconfined)
            controller.awaitIdle()

            assertEquals(ActiveScreen.HOME, controller.uiState.value.activeScreen)
            assertTrue(controller.uiState.value.sheets.isEmpty())
            assertTrue(controller.uiState.value.presets.isNotEmpty())
        } finally {
            failingScope.cancel()
        }
    }

    @Test
    fun createNewSheetFromHomeBuildsZeroedSheetWithoutRemovingExistingSheets() = runBlocking {
        val existingWod = Presets.createWorldOfDarknessSheet().copy(
            id = "existing-wod-1",
            characterName = "JULIAN CROSS",
            updatedAt = "2026-11-10T10:00:00Z"
        )
        val gateway = FakeSheetRepositoryGateway(initialSheets = listOf(existingWod))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val controller = SheetStateController(gateway, scope, Dispatchers.Unconfined)
            controller.awaitIdle()

            controller.createNewSheetFromHome("WOD", "  Helena Moreau  ")
            controller.awaitIdle()

            val state = controller.uiState.value
            assertEquals(ActiveScreen.SHEET, state.activeScreen)
            assertNotNull(state.activeSheetId)
            assertNotEquals("existing-wod-1", state.activeSheetId)
            assertEquals(2, state.sheets.size)
            assertTrue(state.sheets.any { it.id == "existing-wod-1" })
            assertTrue(state.sheets.any { it.characterName == "HELENA MOREAU" })

            val active = controller.activeSheet.value
            assertEquals("HELENA MOREAU", active.characterName)
            assertEquals(0, active.xp.totalEarned)
            assertEquals(0, active.xp.spent)
            assertTrue(active.xp.ledger.isEmpty())
            assertTrue(active.rollLogs.isEmpty())

            val allFields = active.cards.flatMap { it.fields }
            val nameField = allFields.firstOrNull { it.key == "nome_personagem" || it.key == "character_name" }
            assertEquals("Helena Moreau", nameField?.textValue)
            val clanField = allFields.firstOrNull { it.key == "clan" || it.key == "cla" }
            assertEquals("", clanField?.textValue)
            val strField = allFields.firstOrNull { it.key == "strength" }
            assertEquals(1.0, strField?.numValue ?: -1.0, 0.001)
            val genField = allFields.firstOrNull { it.key == "generation" }
            assertEquals(13.0, genField?.numValue ?: -1.0, 0.001)

            // Preserva comportamento de nome padrão quando customName é omitido/vazio
            val freshDnd = Presets.createFreshSheetForSystem("DND5E", customName = "   ")
            assertEquals("NOVO PERSONAGEM", freshDnd.characterName)
            assertEquals(10.0, freshDnd.cards.flatMap { it.fields }.first { it.key == "strength" }.numValue ?: -1.0, 0.001)
            assertEquals(1.0, freshDnd.cards.flatMap { it.fields }.first { it.key == "level" }.numValue ?: -1.0, 0.001)
            assertEquals(0, freshDnd.xp.totalEarned)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun duplicateSheetAvoidsUuidCollisionAndDeleteRemovesOnlyTarget() = runBlocking {
        val original = Presets.createDnd5ePreset().copy(
            id = "sheet-dnd-1",
            characterName = "LYRA VALERIAN",
            updatedAt = "2026-11-12T08:00:00Z"
        )
        // Testa explicitamente colisão de UUID antes de gerar ID único
        var attempts = 0
        val collidingDup = SheetLibraryOps.buildDuplicatedSheet(
            source = original,
            existingIds = setOf("sheet-dnd-1"),
            deviceId = "test-device",
            idGenerator = {
                if (attempts++ < 2) "sheet-dnd-1" else "sheet-dnd-unique-copy"
            }
        )
        assertEquals("sheet-dnd-unique-copy", collidingDup.id)
        assertEquals("LYRA VALERIAN (Cópia)", collidingDup.characterName)

        var controllerAttempts = 0
        val gateway = FakeSheetRepositoryGateway(
            initialSheets = listOf(original),
            idGenerator = {
                if (controllerAttempts++ == 0) "sheet-dnd-1" else "sheet-dnd-dup-uuid"
            }
        )
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val controller = SheetStateController(gateway, scope, Dispatchers.Unconfined)
            controller.awaitIdle()

            controller.duplicateSheet("sheet-dnd-1")
            controller.awaitIdle()

            val afterDup = controller.uiState.value.sheets
            assertEquals(2, afterDup.size)
            assertEquals(2, afterDup.map { it.id }.toSet().size)
            val duplicatedMeta = afterDup.firstOrNull { it.id != "sheet-dnd-1" }
            assertNotNull(duplicatedMeta)
            assertEquals("LYRA VALERIAN (Cópia)", duplicatedMeta?.characterName)

            controller.deleteSheet(duplicatedMeta!!.id)
            controller.awaitIdle()

            val afterDelete = controller.uiState.value.sheets
            assertEquals(1, afterDelete.size)
            assertEquals("sheet-dnd-1", afterDelete.first().id)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun navigationTogglesBetweenHomeAndSheetAndFiltersSavedLibrary() = runBlocking {
        val olderWod = Presets.createWorldOfDarknessSheet().copy(
            id = "wod-old",
            characterName = "JULIAN CROSS",
            updatedAt = "2026-11-10T09:00:00Z"
        )
        val newerDnd = Presets.createDnd5ePreset().copy(
            id = "dnd-new",
            characterName = "LYRA VALERIAN",
            updatedAt = "2026-11-14T18:30:00Z"
        )
        val gateway = FakeSheetRepositoryGateway(initialSheets = listOf(olderWod, newerDnd))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val controller = SheetStateController(gateway, scope, Dispatchers.Unconfined)
            controller.awaitIdle()

            assertEquals(ActiveScreen.HOME, controller.uiState.value.activeScreen)
            assertEquals("dnd-new", controller.uiState.value.sheets.first().id)

            // Filtragem por nome e por sistema na Home
            controller.setHomeSearchQuery("jul")
            assertEquals(listOf("wod-old"), controller.uiState.value.filteredSheets.map { it.id })

            controller.setHomeSearchQuery("")
            controller.setHomeSystemFilter(SystemId.DND5E)
            assertEquals(listOf("dnd-new"), controller.uiState.value.filteredSheets.map { it.id })

            controller.setHomeSystemFilter(null)
            assertEquals(2, controller.uiState.value.filteredSheets.size)

            // Alternância HOME -> SHEET carregando ficha específica do repositório
            controller.navigateToSheet("wod-old")
            controller.awaitIdle()
            assertEquals(ActiveScreen.SHEET, controller.uiState.value.activeScreen)
            assertEquals("wod-old", controller.uiState.value.activeSheetId)
            assertEquals("JULIAN CROSS", controller.activeSheet.value.characterName)

            // Retorno para HOME sem perder fichas salvas
            controller.navigateToHome()
            assertEquals(ActiveScreen.HOME, controller.uiState.value.activeScreen)
            assertEquals(2, controller.uiState.value.sheets.size)

            // Reabertura rápida da ficha ativa com sheetId = null
            controller.navigateToSheet(null)
            assertEquals(ActiveScreen.SHEET, controller.uiState.value.activeScreen)
            assertEquals("wod-old", controller.activeSheet.value.id)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun skillFieldAutoInjectsDifficulty6AndSupportsCycleAndReorder() {
        var wod = Presets.createWorldOfDarknessSheet()
        val skillsCard = wod.cards.first { it.id == "card_skills" }

        val skillNumField = SheetMutators.buildFieldForCard(
            card = skillsCard,
            id = "f_athletics",
            label = "ATHLETICS",
            key = "athletics",
            kind = FieldKind.NUMBER
        )
        assertEquals(6, skillNumField.rollDifficulty)
        assertEquals(false, skillNumField.rollSpecialty)

        val skillRollField = SheetMutators.buildFieldForCard(
            card = null,
            id = "f_roll_athletics",
            label = "ROLL ATHLETICS",
            key = "roll_athletics",
            kind = FieldKind.ROLL,
            formulaOrExpr = "",
            isSkillTemplate = true
        )
        assertEquals(6, skillRollField.rollDifficulty)
        assertEquals(false, skillRollField.rollSpecialty)
        assertEquals("pool(3, 6)", skillRollField.rollExpr)

        wod = SheetMutators.addFieldToCard(wod, "card_skills", skillRollField)
        wod = SheetMutators.cycleRollDifficulty(wod, "f_roll_athletics")
        val cycled = wod.cards.first { it.id == "card_skills" }.fields.first { it.id == "f_roll_athletics" }
        assertEquals(7, cycled.rollDifficulty)
        assertEquals("pool(3, 7)", cycled.rollExpr)

        wod = SheetMutators.toggleRollSpecialty(wod, "f_roll_athletics")
        val withSpec = wod.cards.first { it.id == "card_skills" }.fields.first { it.id == "f_roll_athletics" }
        assertEquals(true, withSpec.rollSpecialty)

        // Move newly added field up by 1
        val originalSize = wod.cards.first { it.id == "card_skills" }.fields.size
        wod = SheetMutators.moveFieldInCard(wod, "card_skills", "f_roll_athletics", -1)
        val reordered = wod.cards.first { it.id == "card_skills" }.fields
        assertEquals("f_roll_athletics", reordered[originalSize - 2].id)
    }

    @Test
    fun wodXpCatalogCoversAllCategoriesClanVsOutOfClanManualOverrideAndUndo() {
        var wod = Presets.createWorldOfDarknessSheet()
        // Add a 0-dot skill, a 0-dot discipline, and a virtue (Conscience)
        wod = SheetMutators.addFieldToCard(
            wod,
            "card_skills",
            SheetField(id = "f_larceny", key = "larceny", label = "LARCENY", kind = FieldKind.NUMBER, numValue = 0.0)
        )
        wod = SheetMutators.addFieldToCard(
            wod,
            "card_arcano",
            SheetField(id = "f_auspex", key = "auspex", label = "AUSPEX", kind = FieldKind.NUMBER, numValue = 0.0)
        )
        wod = SheetMutators.addFieldToCard(
            wod,
            "card_combate",
            SheetField(id = "f_conscience", key = "conscience", label = "CONSCIENCE", kind = FieldKind.NUMBER, numValue = 3.0)
        )

        val traits = XpSystem.extractAllTraits(wod)
        val byId = traits.associateBy { it.fieldId }

        // Attribute: Strength 3 -> 4 = 3 * 4 = 12
        assertEquals(XpUpgradeCategory.ATTRIBUTE, byId["f_strength"]?.category)
        assertEquals(12, byId["f_strength"]?.cost)

        // Skill: 0 -> 1 = 3 XP; Brawl 2 -> 3 = 2 * 2 = 4 XP
        assertEquals(XpUpgradeCategory.SKILL, byId["f_larceny"]?.category)
        assertEquals(3, byId["f_larceny"]?.cost)
        assertEquals(4, byId["f_brawl"]?.cost)

        // Discipline: 0 -> 1 = 10 XP; Clan Dominate 3 -> 4 = 3 * 5 = 15 XP
        assertEquals(XpUpgradeCategory.DISCIPLINE, byId["f_auspex"]?.category)
        assertEquals(10, byId["f_auspex"]?.cost)
        assertEquals(15, byId["f_dominate"]?.cost)
        assertFalse(byId["f_dominate"]?.isOutOfClan ?: true)

        // Toggle Dominate to Out-of-Clan: 3 * 7 = 21 XP
        wod = XpSystem.toggleDisciplineClan(wod, "f_dominate")
        val afterOutOfClan = XpSystem.extractAllTraits(wod).associateBy { it.fieldId }
        assertTrue(afterOutOfClan["f_dominate"]?.isOutOfClan == true)
        assertEquals(21, afterOutOfClan["f_dominate"]?.cost)

        // Virtue: Conscience 3 -> 4 = 6 XP; Humanity 7 -> 8 = 14 XP; Willpower 6 -> 7 = 6 XP
        assertEquals(XpUpgradeCategory.VIRTUE, afterOutOfClan["f_conscience"]?.category)
        assertEquals(6, afterOutOfClan["f_conscience"]?.cost)
        assertEquals(XpUpgradeCategory.VIRTUE, afterOutOfClan["f_humanity"]?.category)
        assertEquals(14, afterOutOfClan["f_humanity"]?.cost)
        assertEquals(10, afterOutOfClan["f_humanity"]?.maxCap)
        assertEquals(XpUpgradeCategory.VIRTUE, afterOutOfClan["f_willpower"]?.category)
        assertEquals(6, afterOutOfClan["f_willpower"]?.cost)
        assertEquals(10, afterOutOfClan["f_willpower"]?.maxCap)

        // Manual multiplier override on Strength: 3 * 2 = 6 XP
        wod = XpSystem.setCustomMultiplier(wod, "f_strength", 2)
        val afterManual = XpSystem.extractAllTraits(wod).associateBy { it.fieldId }
        assertEquals(6, afterManual["f_strength"]?.cost)

        // Insufficient XP blocks Dominate (21 > 14)
        val blocked = XpSystem.upgradeTraitWithXp(wod, "f_dominate", "19:00", "xp_blocked")
        assertFalse(blocked.ok)

        // Purchase Willpower 6 -> 7 (6 XP), leaving 8 XP, then Undo restores 14 XP
        val boughtWp = XpSystem.upgradeTraitWithXp(wod, "f_willpower", "19:05", "xp_wp")
        assertTrue(boughtWp.ok)
        assertEquals(8, XpSystem.getAvailableXp(boughtWp.sheet.xp))

        val undone = XpSystem.undoLastUpgrade(boughtWp.sheet)
        assertTrue(undone.ok)
        assertEquals(14, XpSystem.getAvailableXp(undone.sheet.xp))
    }
}
