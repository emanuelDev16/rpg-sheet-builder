package com.gridsheet.app

import com.gridsheet.app.core.FieldKind
import com.gridsheet.app.core.FormulaEngine
import com.gridsheet.app.core.Presets
import com.gridsheet.app.core.SheetCard
import com.gridsheet.app.core.SheetEvaluator
import com.gridsheet.app.core.SheetField
import com.gridsheet.app.core.SheetMutators
import com.gridsheet.app.core.SystemId
import com.gridsheet.app.core.TabId
import com.gridsheet.app.core.XpSystem
import com.gridsheet.app.core.XpUpgradeCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

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
}
