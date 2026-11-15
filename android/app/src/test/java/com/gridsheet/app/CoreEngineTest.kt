package com.gridsheet.app

import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SheetPayloadValidator
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.SheetTransferException
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import com.gridsheet.app.data.Fts5QuerySanitizer
import com.gridsheet.app.data.PdfTextLayerDetector
import com.gridsheet.app.data.ScannedPdfWithoutOcrException
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.GridSheetDatabase
import com.gridsheet.app.data.local.IndexedBookEntity
import com.gridsheet.app.data.local.PdfRuleQueryBuilder
import com.gridsheet.app.data.local.RulePageFtsEntity
import com.gridsheet.app.data.local.RulePagesStorageMode
import com.gridsheet.app.data.local.SheetEntity
import com.gridsheet.app.data.local.WorkspaceMetadataEntity
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
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
}
