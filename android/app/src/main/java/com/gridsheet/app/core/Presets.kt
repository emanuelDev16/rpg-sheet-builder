package com.gridsheet.app.core

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import java.time.Instant
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

@Serializable
private data class PresetBundleV2(
    val version: String = "2.0",
    val presets: Map<String, JsonElement> = emptyMap()
)

object Presets {
    val presetJson = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    @Volatile
    private var cachedAssetPresets: Map<SystemId, CharacterSheetState> = emptyMap()
    val SYSTEM_OPTIONS = listOf(
        SystemOption(
            id = SystemId.WOD,
            label = "WORLD OF DARKNESS (STORYTELLER d10)",
            shortLabel = "WOD · STORYTELLER d10",
            description = "Atributos, Health (Superficial/Aggravated), Willpower, Hunger, Disciplines e pools Nd10"
        ),
        SystemOption(
            id = SystemId.DND5E,
            label = "D&D 5E (D20 SYSTEM)",
            shortLabel = "D&D 5E · d20",
            description = "6 Atributos D&D 5e, Modificadores, HP, Slots de Magia, Perícias e 1d20"
        ),
        SystemOption(
            id = SystemId.CYBERPUNK,
            label = "NET//RUNNER D10 PROTOCOL",
            shortLabel = "CYBERPUNK · d10",
            description = "Sistema cyberpunk 1d10 com Reflexos, Interface e Invasão ICE"
        ),
        SystemOption(
            id = SystemId.DEFAULT,
            label = "SISTEMA GENÉRICO EXEMPLO (D20)",
            shortLabel = "GENÉRICO · d20",
            description = "Atributos D20, PV segmentado, mochila com peso e módulo arcano"
        ),
        SystemOption(
            id = SystemId.BLANK,
            label = "CUSTOM · CRIAR DO ZERO",
            shortLabel = "CUSTOM · DO ZERO",
            description = "Ficha vazia para criar cada bloco e cada campo manualmente no Modo Edição"
        )
    )

    fun createWorldOfDarknessSheet(deviceId: String = "local-device"): CharacterSheetState = CharacterSheetState(
        id = "sheet_wod",
        systemId = SystemId.WOD,
        systemName = "WORLD OF DARKNESS // STORYTELLER",
        systemCode = "/SYS: WORLD OF DARKNESS · d10 STORYTELLER",
        characterName = "JULIAN CROSS · NEONATE (VENTRUE)",
        revision = 1,
        updatedAt = Instant.now().toString(),
        deviceId = deviceId,
        cards = listOf(
            SheetCard(
                id = "card_identidade",
                tab = TabId.GERAL,
                code = "//CHRONICLE_ID",
                title = "IDENTITY & LINEAGE",
                colSpan = 2,
                fields = listOf(
                    SheetField(id = "f_nome", key = "character_name", label = "NAME", kind = FieldKind.TEXT, textValue = "Julian Cross"),
                    SheetField(id = "f_clan", key = "clan", label = "CLAN / FACTION", kind = FieldKind.TEXT, textValue = "Ventrue"),
                    SheetField(id = "f_generation", key = "generation", label = "GENERATION", kind = FieldKind.NUMBER, numValue = 10.0),
                    SheetField(id = "f_blood_potency", key = "blood_potency", label = "BLOOD_POTENCY", kind = FieldKind.CALCULATED, formula = "max(1, 13 - generation)", showPlus = false)
                )
            ),
            SheetCard(
                id = "card_atributos",
                tab = TabId.GERAL,
                code = "//ATTRIBUTES",
                title = "PHYSICAL · SOCIAL · MENTAL",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_strength", key = "strength", label = "STRENGTH", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_dexterity", key = "dexterity", label = "DEXTERITY", kind = FieldKind.NUMBER, numValue = 4.0),
                    SheetField(id = "f_stamina", key = "stamina", label = "STAMINA", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_charisma", key = "charisma", label = "CHARISMA", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_manipulation", key = "manipulation", label = "MANIPULATION", kind = FieldKind.NUMBER, numValue = 4.0),
                    SheetField(id = "f_wits", key = "wits", label = "WITS", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_initiative", key = "initiative", label = "INITIATIVE_MOD", kind = FieldKind.CALCULATED, formula = "dexterity + wits", showPlus = true),
                    SheetField(id = "f_defense", key = "defense", label = "DEFENSE", kind = FieldKind.CALCULATED, formula = "min(dexterity, wits)", showPlus = false)
                )
            ),
            SheetCard(
                id = "card_combate",
                tab = TabId.GERAL,
                code = "//VITAL_STATUS",
                title = "HEALTH · WILLPOWER · HUNGER",
                colSpan = 1,
                fields = listOf(
                    SheetField(
                        id = "f_health",
                        key = "health",
                        label = "HEALTH",
                        kind = FieldKind.RESOURCE,
                        numValue = 7.0,
                        max = 7,
                        damageTrack = true,
                        superficialDamage = 0,
                        aggravatedDamage = 0
                    ),
                    SheetField(id = "f_willpower", key = "willpower", label = "WILLPOWER", kind = FieldKind.RESOURCE, numValue = 6.0, max = 8),
                    SheetField(id = "f_hunger", key = "hunger", label = "HUNGER", kind = FieldKind.RESOURCE, numValue = 1.0, max = 5),
                    SheetField(id = "f_humanity", key = "humanity", label = "HUMANITY", kind = FieldKind.RESOURCE, numValue = 7.0, max = 10),
                    SheetField(id = "f_wp_boost", key = "wp_boost", label = "WILLPOWER SURGE (+1 DIE)", kind = FieldKind.BOOLEAN, boolValue = false, hint = "SPENT THIS TURN"),
                    SheetField(id = "f_soak", key = "soak_roll", label = "SOAK DAMAGE", kind = FieldKind.ROLL, rollLabel = "ROLL SOAK", rollExpr = "pool(stamina, 6)")
                )
            ),
            SheetCard(
                id = "card_skills",
                tab = TabId.GERAL,
                code = "//SKILLS_&_POOLS",
                title = "ABILITIES & DICE POOLS",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_brawl", key = "brawl", label = "BRAWL", kind = FieldKind.NUMBER, numValue = 2.0),
                    SheetField(id = "f_firearms", key = "firearms", label = "FIREARMS", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_stealth", key = "stealth", label = "STEALTH", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_subterfuge", key = "subterfuge", label = "SUBTERFUGE", kind = FieldKind.NUMBER, numValue = 4.0),
                    SheetField(id = "f_roll_brawl", key = "roll_brawl", label = "MELEE / BRAWL", kind = FieldKind.ROLL, rollLabel = "ROLL BRAWL", rollExpr = "pool(strength + brawl + wp_boost, 6)", rollDifficulty = 6, rollSpecialty = false),
                    SheetField(id = "f_roll_firearms", key = "roll_firearms", label = "RANGED ATTACK", kind = FieldKind.ROLL, rollLabel = "ROLL FIREARMS", rollExpr = "pool(dexterity + firearms + wp_boost, 6)", rollDifficulty = 6, rollSpecialty = false),
                    SheetField(id = "f_roll_subterfuge", key = "roll_subterfuge", label = "SOCIAL MANIPULATION", kind = FieldKind.ROLL, rollLabel = "ROLL SUBTERFUGE", rollExpr = "pool(manipulation + subterfuge + wp_boost, 6)", rollDifficulty = 6, rollSpecialty = false)
                )
            ),
            SheetCard(
                id = "card_inventario",
                tab = TabId.GERAL,
                code = "//INVENTORY",
                title = "GEAR & CONCEALMENT",
                colSpan = 1,
                fields = listOf(
                    SheetField(
                        id = "f_mochila",
                        key = "gear",
                        label = "EQUIPMENT",
                        kind = FieldKind.REPEATABLE,
                        columns = listOf("ITEM", "WEIGHT (KG)"),
                        col2Type = "number",
                        rows = listOf(
                            RepeatableRow("r_1", "Heavy Pistol (9mm)", "1.2"),
                            RepeatableRow("r_2", "Kevlar Trench Coat", "2.5"),
                            RepeatableRow("r_3", "Silver Dagger", "0.5"),
                            RepeatableRow("r_4", "Encrypted Burner Phone", "0.3")
                        )
                    ),
                    SheetField(id = "f_carga_max", key = "carry_limit", label = "CARRY_CAPACITY", kind = FieldKind.CALCULATED, formula = "strength * 15", showPlus = false)
                )
            ),
            SheetCard(
                id = "card_arcano",
                tab = TabId.MAGIAS,
                code = "//DISCIPLINES",
                title = "DISCIPLINES & OCCULT",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_dominate", key = "dominate", label = "DOMINATE", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_presence", key = "presence", label = "PRESENCE", kind = FieldKind.NUMBER, numValue = 2.0),
                    SheetField(id = "f_occult", key = "occult", label = "OCCULT", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_dominate_pool", key = "dominate_pool", label = "DOMINATE_POOL", kind = FieldKind.CALCULATED, formula = "manipulation + dominate", showPlus = false),
                    SheetField(id = "f_roll_dominate", key = "roll_dominate", label = "MESMERIZE / COMMAND", kind = FieldKind.ROLL, rollLabel = "ROLL DOMINATE", rollExpr = "pool(manipulation + dominate + wp_boost, 6)", rollDifficulty = 6, rollSpecialty = false),
                    SheetField(id = "f_roll_occult", key = "roll_occult", label = "ARCANE LORE CHECK", kind = FieldKind.ROLL, rollLabel = "ROLL OCCULT", rollExpr = "pool(wits + occult + wp_boost, 7)", rollDifficulty = 7, rollSpecialty = false)
                )
            ),
            SheetCard(
                id = "card_grimorio",
                tab = TabId.MAGIAS,
                code = "//MERITS_&_POWERS",
                title = "DISCIPLINE POWERS & MERITS",
                colSpan = 1,
                fields = listOf(
                    SheetField(
                        id = "f_lista_magias",
                        key = "powers",
                        label = "ACTIVE POWERS & BACKGROUNDS",
                        kind = FieldKind.REPEATABLE,
                        columns = listOf("POWER / MERIT", "COST / DOTS"),
                        col2Type = "text",
                        rows = listOf(
                            RepeatableRow("m_1", "Command (Dominate 1)", "FREE"),
                            RepeatableRow("m_2", "Mesmerize (Dominate 3)", "1 WP"),
                            RepeatableRow("m_3", "Awe (Presence 1)", "1 BLOOD"),
                            RepeatableRow("m_4", "Haven: Old Observatory", "•••")
                        )
                    ),
                    SheetField(id = "f_frenzy_check", key = "frenzy_resisted", label = "FRENZY RESISTED", kind = FieldKind.BOOLEAN, boolValue = true, hint = "BEAST CALMED THIS SCENE")
                )
            ),
            SheetCard(
                id = "card_notas",
                tab = TabId.MAGIAS,
                code = "//CHRONICLE_LOG",
                title = "COTERIE & SESSION NOTES",
                colSpan = 2,
                fields = listOf(
                    SheetField(
                        id = "f_notas",
                        key = "notas_campanha",
                        label = "CHRONICLE RECORDS",
                        kind = FieldKind.TEXT,
                        textValue = "Elysium meeting confirmed at 02:00. Sheriff suspects Masquerade breach in the Harbor District; secure the obsidian ledger before sunrise."
                    )
                )
            )
        ),
        rollLogs = listOf(
            RollLogEntry("log_wod_1", "23:14", "ROLL SUBTERFUGE", 4, "8d10 (DIFF 6)", "8d10[9, 6, 3, 10, 7, 2, 8, 5] ≥6 → 4 SUCESSOS", isPoolRoll = true),
            RollLogEntry("log_wod_2", "22:58", "ROLL DOMINATE", 3, "7d10 (DIFF 6)", "7d10[8, 6, 4, 9, 2, 7, 1] ≥6 → 3 SUCESSOS", isPoolRoll = true)
        ),
        xp = XpState(
            totalEarned = 14,
            spent = 0,
            ledger = listOf(
                XpLedgerEntry("xp_seed_1", "22:00", "award", 14, "CHRONICLE SESSION AWARD")
            )
        )
    )

    fun createDnd5ePreset(deviceId: String = "local-device"): CharacterSheetState = CharacterSheetState(
        id = "sheet_dnd5e",
        systemId = SystemId.DND5E,
        systemName = "D&D 5E // D20 SYSTEM",
        systemCode = "/SYS: D&D 5E · D20 HEROIC EDITION",
        characterName = "LYRA VANCE · ELDRITCH KNIGHT (LV 5)",
        revision = 1,
        updatedAt = Instant.now().toString(),
        deviceId = deviceId,
        cards = listOf(
            SheetCard(
                id = "card_identidade",
                tab = TabId.GERAL,
                code = "//CHARACTER_ID",
                title = "IDENTITY & CLASS",
                colSpan = 2,
                fields = listOf(
                    SheetField(id = "f_nome", key = "character_name", label = "CHARACTER NAME", kind = FieldKind.TEXT, textValue = "Lyra Vance"),
                    SheetField(id = "f_classe", key = "class_race", label = "CLASS & ANCESTRY", kind = FieldKind.TEXT, textValue = "Fighter (Eldritch Knight) · Half-Elf"),
                    SheetField(id = "f_nivel", key = "level", label = "LEVEL", kind = FieldKind.NUMBER, numValue = 5.0),
                    SheetField(id = "f_prof", key = "prof", label = "PROFICIENCY_BONUS", kind = FieldKind.CALCULATED, formula = "floor((level - 1) / 4) + 2", showPlus = true)
                )
            ),
            SheetCard(
                id = "card_atributos",
                tab = TabId.GERAL,
                code = "//ABILITY_SCORES",
                title = "ATTRIBUTES & MODIFIERS",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_strength", key = "strength", label = "STRENGTH", kind = FieldKind.NUMBER, numValue = 16.0),
                    SheetField(id = "f_mod_str", key = "mod_str", label = "MOD_STR", kind = FieldKind.CALCULATED, formula = "floor((strength - 10) / 2)", showPlus = true),
                    SheetField(id = "f_dexterity", key = "dexterity", label = "DEXTERITY", kind = FieldKind.NUMBER, numValue = 14.0),
                    SheetField(id = "f_mod_dex", key = "mod_dex", label = "MOD_DEX", kind = FieldKind.CALCULATED, formula = "floor((dexterity - 10) / 2)", showPlus = true),
                    SheetField(id = "f_constitution", key = "constitution", label = "CONSTITUTION", kind = FieldKind.NUMBER, numValue = 15.0),
                    SheetField(id = "f_mod_con", key = "mod_con", label = "MOD_CON", kind = FieldKind.CALCULATED, formula = "floor((constitution - 10) / 2)", showPlus = true),
                    SheetField(id = "f_intelligence", key = "intelligence", label = "INTELLIGENCE", kind = FieldKind.NUMBER, numValue = 14.0),
                    SheetField(id = "f_mod_int", key = "mod_int", label = "MOD_INT", kind = FieldKind.CALCULATED, formula = "floor((intelligence - 10) / 2)", showPlus = true),
                    SheetField(id = "f_wisdom", key = "wisdom", label = "WISDOM", kind = FieldKind.NUMBER, numValue = 12.0),
                    SheetField(id = "f_mod_wis", key = "mod_wis", label = "MOD_WIS", kind = FieldKind.CALCULATED, formula = "floor((wisdom - 10) / 2)", showPlus = true),
                    SheetField(id = "f_charisma", key = "charisma", label = "CHARISMA", kind = FieldKind.NUMBER, numValue = 10.0),
                    SheetField(id = "f_mod_cha", key = "mod_cha", label = "MOD_CHA", kind = FieldKind.CALCULATED, formula = "floor((charisma - 10) / 2)", showPlus = true)
                )
            ),
            SheetCard(
                id = "card_combate",
                tab = TabId.GERAL,
                code = "//COMBAT_STATUS",
                title = "HP · DEFENSE · ACTIONS",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_hp", key = "hp", label = "HIT POINTS", kind = FieldKind.RESOURCE, numValue = 44.0, max = 44),
                    SheetField(id = "f_hit_dice", key = "hit_dice", label = "HIT DICE (d10)", kind = FieldKind.RESOURCE, numValue = 5.0, max = 5),
                    SheetField(id = "f_action_surge", key = "action_surge", label = "ACTION SURGE", kind = FieldKind.RESOURCE, numValue = 1.0, max = 1),
                    SheetField(id = "f_ac", key = "armor_class", label = "ARMOR_CLASS", kind = FieldKind.CALCULATED, formula = "16 + min(2, mod_dex)", showPlus = false),
                    SheetField(id = "f_initiative", key = "initiative", label = "INITIATIVE", kind = FieldKind.CALCULATED, formula = "mod_dex", showPlus = true),
                    SheetField(id = "f_inspiration", key = "inspiration", label = "HEROIC INSPIRATION", kind = FieldKind.BOOLEAN, boolValue = true, hint = "REROLL / ADVANTAGE"),
                    SheetField(id = "f_roll_sword", key = "roll_sword", label = "LONGSWORD ATTACK", kind = FieldKind.ROLL, rollLabel = "ATTACK LONGSWORD", rollExpr = "1d20 + mod_str + prof"),
                    SheetField(id = "f_roll_dmg", key = "roll_dmg", label = "LONGSWORD DAMAGE", kind = FieldKind.ROLL, rollLabel = "ROLL DAMAGE", rollExpr = "1d8 + mod_str")
                )
            ),
            SheetCard(
                id = "card_skills",
                tab = TabId.GERAL,
                code = "//SKILLS_&_SAVES",
                title = "PROFICIENCIES & CHECKS",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_athletics", key = "athletics", label = "ATHLETICS", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_perception", key = "perception", label = "PERCEPTION", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_arcana", key = "arcana", label = "ARCANA", kind = FieldKind.NUMBER, numValue = 2.0),
                    SheetField(id = "f_stealth", key = "stealth", label = "STEALTH", kind = FieldKind.NUMBER, numValue = 1.0),
                    SheetField(id = "f_roll_athletics", key = "roll_athletics", label = "ATHLETICS CHECK", kind = FieldKind.ROLL, rollLabel = "ROLL ATHLETICS", rollExpr = "1d20 + mod_str + athletics"),
                    SheetField(id = "f_roll_perception", key = "roll_perception", label = "PERCEPTION CHECK", kind = FieldKind.ROLL, rollLabel = "ROLL PERCEPTION", rollExpr = "1d20 + mod_wis + perception"),
                    SheetField(id = "f_roll_con_save", key = "roll_con_save", label = "CON SAVING THROW", kind = FieldKind.ROLL, rollLabel = "CON SAVE", rollExpr = "1d20 + mod_con + prof")
                )
            ),
            SheetCard(
                id = "card_inventario",
                tab = TabId.GERAL,
                code = "//INVENTORY",
                title = "ADVENTURING GEAR",
                colSpan = 1,
                fields = listOf(
                    SheetField(
                        id = "f_mochila",
                        key = "gear",
                        label = "BACKPACK",
                        kind = FieldKind.REPEATABLE,
                        columns = listOf("ITEM", "WEIGHT (LB)"),
                        col2Type = "number",
                        rows = listOf(
                            RepeatableRow("d_1", "Longsword +1", "3"),
                            RepeatableRow("d_2", "Half Plate Armor", "40"),
                            RepeatableRow("d_3", "Healer Kit & Potions (2x)", "4"),
                            RepeatableRow("d_4", "Explorer Pack", "12")
                        )
                    ),
                    SheetField(id = "f_carga_max", key = "carry_limit", label = "CARRY_CAPACITY", kind = FieldKind.CALCULATED, formula = "strength * 15", showPlus = false)
                )
            ),
            SheetCard(
                id = "card_arcano",
                tab = TabId.MAGIAS,
                code = "//SPELLCASTING",
                title = "ARCANE SLOTS & SAVE DC",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_spell_dc", key = "spell_dc", label = "SPELL_SAVE_DC", kind = FieldKind.CALCULATED, formula = "8 + prof + mod_int", showPlus = false),
                    SheetField(id = "f_spell_atk", key = "spell_atk", label = "SPELL_ATTACK_MOD", kind = FieldKind.CALCULATED, formula = "prof + mod_int", showPlus = true),
                    SheetField(id = "f_slots_1", key = "slots_1st", label = "1ST LEVEL SLOTS", kind = FieldKind.RESOURCE, numValue = 3.0, max = 4),
                    SheetField(id = "f_slots_2", key = "slots_2nd", label = "2ND LEVEL SLOTS", kind = FieldKind.RESOURCE, numValue = 2.0, max = 2),
                    SheetField(id = "f_roll_firebolt", key = "roll_firebolt", label = "CANTRIP ATTACK", kind = FieldKind.ROLL, rollLabel = "CAST FIRE BOLT", rollExpr = "1d20 + mod_int + prof")
                )
            ),
            SheetCard(
                id = "card_grimorio",
                tab = TabId.MAGIAS,
                code = "//GRIMOIRE_&_FEATS",
                title = "PREPARED SPELLS & FEATURES",
                colSpan = 1,
                fields = listOf(
                    SheetField(
                        id = "f_lista_magias",
                        key = "spells",
                        label = "SPELLS & CLASS FEATURES",
                        kind = FieldKind.REPEATABLE,
                        columns = listOf("SPELL / FEATURE", "SLOT / COST"),
                        col2Type = "text",
                        rows = listOf(
                            RepeatableRow("s_1", "Shield (+5 AC)", "1ST · REACT"),
                            RepeatableRow("s_2", "Misty Step (30ft)", "2ND · BONUS"),
                            RepeatableRow("s_3", "Magic Missile (3 darts)", "1ST · ACTION"),
                            RepeatableRow("s_4", "Extra Attack (2x)", "PASSIVE")
                        )
                    ),
                    SheetField(id = "f_concentration", key = "concentration", label = "CONCENTRATION ACTIVE", kind = FieldKind.BOOLEAN, boolValue = false, hint = "CON SAVE ON DAMAGE")
                )
            ),
            SheetCard(
                id = "card_notas",
                tab = TabId.MAGIAS,
                code = "//CAMPAIGN_LOG",
                title = "PARTY & QUEST NOTES",
                colSpan = 2,
                fields = listOf(
                    SheetField(
                        id = "f_notas",
                        key = "notas_campanha",
                        label = "ADVENTURE RECORDS",
                        kind = FieldKind.TEXT,
                        textValue = "Cleared the Sunless Citadel lower gate. Recover the Obsidian Signet from the Red Wizard enclave before the next long rest."
                    )
                )
            )
        ),
        rollLogs = listOf(
            RollLogEntry("log_dnd_1", "21:40", "ATTACK LONGSWORD", 19, "1d20 + 3 + 3", "1d20[13] → 13 + 3 + 3"),
            RollLogEntry("log_dnd_2", "21:35", "ROLL PERCEPTION", 16, "1d20 + 1 + 3", "1d20[12] → 12 + 1 + 3")
        ),
        xp = XpState(
            totalEarned = 1800,
            spent = 0,
            ledger = listOf(
                XpLedgerEntry("xp_dnd_seed_1", "21:00", "award", 1800, "MILESTONE TRAINING POOL")
            )
        )
    )

    fun createGenericD20Preset(deviceId: String = "local-device"): CharacterSheetState = CharacterSheetState(
        id = "sheet_default",
        systemId = SystemId.DEFAULT,
        systemName = "SISTEMA GENÉRICO EXEMPLO",
        systemCode = "/SYS: SISTEMA GENÉRICO EXEMPLO",
        characterName = "KAELEN VANCE · OPERADOR",
        revision = 1,
        updatedAt = Instant.now().toString(),
        deviceId = deviceId,
        cards = listOf(
            SheetCard(
                id = "card_identidade",
                tab = TabId.GERAL,
                code = "//IDENTIFICAÇÃO",
                title = "PERFIL DO PERSONAGEM",
                colSpan = 2,
                fields = listOf(
                    SheetField(id = "f_nome", key = "nome_personagem", label = "NOME_OPERATIVO", kind = FieldKind.TEXT, textValue = "Kaelen Vance"),
                    SheetField(id = "f_arquetipo", key = "arquetipo", label = "ARQUÉTIPO / CLASSE", kind = FieldKind.TEXT, textValue = "Vanguarda Tática"),
                    SheetField(id = "f_nivel", key = "nivel", label = "NÍVEL", kind = FieldKind.NUMBER, numValue = 3.0),
                    SheetField(id = "f_bonus_prof", key = "prof", label = "BÔNUS_MAESTRIA", kind = FieldKind.CALCULATED, formula = "floor((nivel - 1) / 4) + 2", showPlus = true)
                )
            ),
            SheetCard(
                id = "card_atributos",
                tab = TabId.GERAL,
                code = "//ATRIBUTOS",
                title = "NÚCLEO DE ATRIBUTOS",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_forca", key = "forca", label = "FORÇA", kind = FieldKind.NUMBER, numValue = 14.0),
                    SheetField(id = "f_mod_forca", key = "mod_forca", label = "MOD_FORCA", kind = FieldKind.CALCULATED, formula = "floor((forca - 10) / 2)", showPlus = true),
                    SheetField(id = "f_roll_forca", key = "roll_forca", label = "TESTE DE FORÇA", kind = FieldKind.ROLL, rollLabel = "ROLAR FORÇA", rollExpr = "1d20 + mod_forca"),
                    SheetField(id = "f_destreza", key = "destreza", label = "DESTREZA", kind = FieldKind.NUMBER, numValue = 16.0),
                    SheetField(id = "f_mod_destreza", key = "mod_destreza", label = "MOD_DESTREZA", kind = FieldKind.CALCULATED, formula = "floor((destreza - 10) / 2)", showPlus = true),
                    SheetField(id = "f_roll_destreza", key = "roll_destreza", label = "TESTE DE DESTREZA", kind = FieldKind.ROLL, rollLabel = "ROLAR DESTREZA", rollExpr = "1d20 + mod_destreza")
                )
            ),
            SheetCard(
                id = "card_combate",
                tab = TabId.GERAL,
                code = "//STATUS_VITAL",
                title = "COMBATE & RECURSOS",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_pv", key = "pv", label = "PONTOS DE VIDA", kind = FieldKind.RESOURCE, numValue = 12.0, max = 12),
                    SheetField(id = "f_estamina", key = "estamina", label = "ENERGIA / FOCO", kind = FieldKind.RESOURCE, numValue = 6.0, max = 8),
                    SheetField(id = "f_defesa", key = "defesa", label = "DEFESA_BASE", kind = FieldKind.CALCULATED, formula = "10 + mod_destreza", showPlus = false),
                    SheetField(id = "f_inspiracao", key = "inspiracao", label = "INSPIRAÇÃO", kind = FieldKind.BOOLEAN, boolValue = true, hint = "MARCADOR TÁTICO / VANTAGEM"),
                    SheetField(id = "f_ataque_espada", key = "ataque_principal", label = "GOLPE TÁTICO", kind = FieldKind.ROLL, rollLabel = "ATACAR LÂMINA", rollExpr = "1d20 + mod_forca + prof"),
                    SheetField(id = "f_dano_espada", key = "dano_principal", label = "DANO DA LÂMINA", kind = FieldKind.ROLL, rollLabel = "ROLAR DANO", rollExpr = "1d8 + mod_forca")
                )
            ),
            SheetCard(
                id = "card_inventario",
                tab = TabId.GERAL,
                code = "//INVENTÁRIO",
                title = "MOCHILA & CARGA",
                colSpan = 2,
                fields = listOf(
                    SheetField(
                        id = "f_mochila",
                        key = "mochila",
                        label = "MOCHILA",
                        kind = FieldKind.REPEATABLE,
                        columns = listOf("ITEM", "PESO (KG)"),
                        col2Type = "number",
                        rows = listOf(
                            RepeatableRow("r_1", "Lâmina Monomolecular", "2.5"),
                            RepeatableRow("r_2", "Kit de Primeiros Socorros", "1.5"),
                            RepeatableRow("r_3", "Corda Sintética (15m)", "2.0"),
                            RepeatableRow("r_4", "Ração Desidratada (3x)", "1.0")
                        )
                    ),
                    SheetField(id = "f_carga_max", key = "carga_max", label = "CAPACIDADE_CARGA", kind = FieldKind.CALCULATED, formula = "forca * 5", showPlus = false)
                )
            ),
            SheetCard(
                id = "card_arcano",
                tab = TabId.MAGIAS,
                code = "//MÓDULO_ARCANO",
                title = "CONJURAÇÃO & RESERVA",
                colSpan = 1,
                fields = listOf(
                    SheetField(id = "f_intelecto", key = "intelecto", label = "INTELECTO", kind = FieldKind.NUMBER, numValue = 15.0),
                    SheetField(id = "f_mod_int", key = "mod_int", label = "MOD_INTELECTO", kind = FieldKind.CALCULATED, formula = "floor((intelecto - 10) / 2)", showPlus = true),
                    SheetField(id = "f_slots", key = "espacos_magia", label = "SLOTS DE CONJURAÇÃO", kind = FieldKind.RESOURCE, numValue = 3.0, max = 4),
                    SheetField(id = "f_cd_magia", key = "cd_magia", label = "CD_RESISTÊNCIA", kind = FieldKind.CALCULATED, formula = "8 + prof + mod_int", showPlus = false),
                    SheetField(id = "f_ataque_magico", key = "ataque_magico", label = "CONJURAÇÃO OFENSIVA", kind = FieldKind.ROLL, rollLabel = "ROLAR ATAQUE ARCANO", rollExpr = "1d20 + mod_int + prof")
                )
            ),
            SheetCard(
                id = "card_grimorio",
                tab = TabId.MAGIAS,
                code = "//GRIMÓRIO",
                title = "MAGIAS & HABILIDADES",
                colSpan = 1,
                fields = listOf(
                    SheetField(
                        id = "f_lista_magias",
                        key = "grimorio",
                        label = "LISTA DE CONJURAÇÕES",
                        kind = FieldKind.REPEATABLE,
                        columns = listOf("MAGIA / PROTOCOLO", "CUSTO"),
                        col2Type = "text",
                        rows = listOf(
                            RepeatableRow("m_1", "Disparo de Éter", "1 SLOT"),
                            RepeatableRow("m_2", "Barreira Cinética", "1 SLOT"),
                            RepeatableRow("m_3", "Passo Dimensional", "2 SLOTS")
                        )
                    ),
                    SheetField(id = "f_concentracao", key = "concentracao", label = "CONCENTRAÇÃO ATIVA", kind = FieldKind.BOOLEAN, boolValue = false, hint = "MANTER EFEITO CONTÍNUO")
                )
            ),
            SheetCard(
                id = "card_notas",
                tab = TabId.MAGIAS,
                code = "//DIÁRIO_CAMPO",
                title = "ANOTAÇÕES DE CAMPANHA",
                colSpan = 2,
                fields = listOf(
                    SheetField(
                        id = "f_notas",
                        key = "notas_campanha",
                        label = "REGISTROS DA SESSÃO",
                        kind = FieldKind.TEXT,
                        textValue = "Contato confirmado no Setor 04. Chave de acesso ao arquivo antigo recuperada; verificar selo rúnico antes da próxima descida."
                    )
                )
            )
        ),
        rollLogs = listOf(
            RollLogEntry("log_init_1", "14:42", "ROLAR FORÇA", 17, "1d20 + 2", "1d20[15] → 15 + 2"),
            RollLogEntry("log_init_2", "14:38", "ATACAR LÂMINA", 22, "1d20 + 2 + 2", "1d20[18] → 18 + 2 + 2")
        ),
        xp = XpState(totalEarned = 12, spent = 0)
    )

    fun createCyberpunkPreset(deviceId: String = "local-device"): CharacterSheetState {
        val base = createGenericD20Preset(deviceId)
        return base.copy(
            id = "sheet_cyberpunk",
            systemId = SystemId.CYBERPUNK,
            systemName = "NET//RUNNER D10 PROTOCOL",
            systemCode = "/SYS: CYBERPUNK D10 PROTOCOL",
            characterName = "ZERO_K · NETRUNNER",
            revision = 1,
            updatedAt = Instant.now().toString(),
            deviceId = deviceId,
            cards = base.cards.map { c ->
                if (c.id == "card_atributos") {
                    c.copy(
                        fields = listOf(
                            SheetField(id = "f_forca", key = "forca", label = "REFLEXOS", kind = FieldKind.NUMBER, numValue = 8.0),
                            SheetField(id = "f_mod_forca", key = "mod_forca", label = "INICIATIVA_NET", kind = FieldKind.CALCULATED, formula = "forca + 2", showPlus = true),
                            SheetField(id = "f_roll_forca", key = "roll_forca", label = "TESTE REFLEXOS", kind = FieldKind.ROLL, rollLabel = "ROLAR REFLEXOS", rollExpr = "1d10 + forca"),
                            SheetField(id = "f_destreza", key = "destreza", label = "INTERFACE", kind = FieldKind.NUMBER, numValue = 9.0),
                            SheetField(id = "f_mod_destreza", key = "mod_destreza", label = "PODER_ICE", kind = FieldKind.CALCULATED, formula = "destreza * 2", showPlus = false),
                            SheetField(id = "f_roll_destreza", key = "roll_destreza", label = "INVASÃO ICE", kind = FieldKind.ROLL, rollLabel = "HACKEAR NÓ", rollExpr = "1d10 + destreza")
                        )
                    )
                } else {
                    c
                }
            }
        )
    }

    fun createBlankSheet(deviceId: String = "local-device"): CharacterSheetState = CharacterSheetState(
        id = "sheet_blank",
        systemId = SystemId.BLANK,
        systemName = "SISTEMA CUSTOMIZADO (DO ZERO)",
        systemCode = "/SYS: CUSTOM · DO ZERO",
        characterName = "NOVO PERSONAGEM",
        revision = 1,
        updatedAt = Instant.now().toString(),
        deviceId = deviceId,
        cards = emptyList(),
        rollLogs = emptyList(),
        xp = XpState()
    )

    fun detectSystemId(sheet: CharacterSheetState): SystemId {
        sheet.systemId?.let { return it }
        val sig = "${sheet.systemName} ${sheet.systemCode}".uppercase()
        return when {
            sig.contains("DARKNESS") || sig.contains("STORYTELLER") || sig.contains("VAMPIRE") -> SystemId.WOD
            sig.contains("D&D") || sig.contains("DND") || sig.contains("5E") -> SystemId.DND5E
            sig.contains("CYBERPUNK") || sig.contains("RUNNER") -> SystemId.CYBERPUNK
            sig.contains("GENÉRICO") || sig.contains("GENERICO") -> SystemId.DEFAULT
            else -> SystemId.BLANK
        }
    }

    fun migrateSheetMetadata(
        sheet: CharacterSheetState,
        deviceId: String = "local-device",
        nowIso: String = Instant.now().toString()
    ): CharacterSheetState {
        val sysId = detectSystemId(sheet)
        val validRevision = if (sheet.revision >= 1) sheet.revision else 1
        val validUpdatedAt = if (sheet.updatedAt.isNotBlank() && sheet.updatedAt != "1970-01-01T00:00:00Z") {
            sheet.updatedAt
        } else {
            nowIso
        }
        val validDeviceId = if (sheet.deviceId.isNotBlank() && sheet.deviceId != "local-device") {
            sheet.deviceId
        } else {
            deviceId.ifBlank { "local-device" }
        }
        val validId = sheet.id.ifBlank { "sheet_${sysId.name.lowercase()}" }
        return sheet.copy(
            id = validId,
            systemId = sysId,
            revision = validRevision,
            updatedAt = validUpdatedAt,
            deviceId = validDeviceId
        )
    }

    fun migrateLegacyWodSheet(
        sheet: CharacterSheetState,
        deviceId: String = "local-device",
        nowIso: String = Instant.now().toString()
    ): CharacterSheetState {
        val withMeta = migrateSheetMetadata(sheet, deviceId, nowIso)
        if (detectSystemId(withMeta) != SystemId.WOD) return withMeta
        var changed = false
        val updatedCards = withMeta.cards.map { card ->
            if (card.id != "card_combate") return@map card
            var cardChanged = false
            val nextTitle = if (card.title == "HEALTH · WILLPOWER · BLOOD") {
                cardChanged = true
                "HEALTH · WILLPOWER · HUNGER"
            } else {
                card.title
            }
            val nextFields = card.fields.map { field ->
                when {
                    field.id == "f_blood_pool" || field.key == "blood_pool" -> {
                        cardChanged = true
                        SheetField(
                            id = "f_hunger",
                            key = "hunger",
                            label = "HUNGER",
                            kind = FieldKind.RESOURCE,
                            numValue = 1.0,
                            max = 5
                        )
                    }
                    field.id == "f_health" && field.damageTrack != true -> {
                        cardChanged = true
                        val maxVal = kotlin.math.max(1, field.max ?: 7)
                        val curr = kotlin.math.max(0, kotlin.math.min(maxVal, (field.numValue ?: maxVal.toDouble()).toInt()))
                        field.copy(
                            max = maxVal,
                            numValue = curr.toDouble(),
                            damageTrack = true,
                            superficialDamage = field.superficialDamage ?: 0,
                            aggravatedDamage = field.aggravatedDamage ?: kotlin.math.max(0, maxVal - curr)
                        )
                    }
                    else -> field
                }
            }
            if (cardChanged) {
                changed = true
                card.copy(title = nextTitle, fields = nextFields)
            } else {
                card
            }
        }
        return if (changed) withMeta.copy(cards = updatedCards) else withMeta
    }

    private val WOD_BASE_ONE_KEYS = setOf(
        "strength", "dexterity", "stamina", "charisma", "manipulation", "wits"
    )

    private val DND_ABILITY_KEYS = setOf(
        "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
        "forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma", "intelecto"
    )

    fun parseSystemId(raw: String): SystemId =
        SystemId.entries.firstOrNull { it.name.equals(raw.trim(), ignoreCase = true) }
            ?: SystemId.BLANK

    fun createPresetBySystemId(systemId: SystemId, deviceId: String = "local-device"): CharacterSheetState {
        cachedAssetPresets[systemId]?.let { cached ->
            return cached.copy(deviceId = deviceId)
        }
        return when (systemId) {
            SystemId.WOD -> createWorldOfDarknessSheet(deviceId)
            SystemId.DND5E -> createDnd5ePreset(deviceId)
            SystemId.CYBERPUNK -> createCyberpunkPreset(deviceId)
            SystemId.DEFAULT -> createGenericD20Preset(deviceId)
            SystemId.BLANK -> createBlankSheet(deviceId)
        }
    }

    /**
     * Instantiates a fresh, zeroed-out fillable character sheet for [systemId] with a unique ID,
     * preserving card layout/formulas from `presets.v2.json` (when loaded) while resetting sample
     * values, XP ledger, and roll logs.
     */
    fun createFreshSheetForSystem(
        systemId: String,
        deviceId: String = "local-device",
        customName: String? = null,
        nowIso: String = Instant.now().toString(),
        idGenerator: () -> String = { UUID.randomUUID().toString() }
    ): CharacterSheetState = createFreshSheetForSystem(
        systemId = parseSystemId(systemId),
        deviceId = deviceId,
        customName = customName,
        nowIso = nowIso,
        idGenerator = idGenerator
    )

    fun createFreshSheetForSystem(
        systemId: SystemId,
        deviceId: String = "local-device",
        customName: String? = null,
        nowIso: String = Instant.now().toString(),
        idGenerator: () -> String = { UUID.randomUUID().toString() }
    ): CharacterSheetState {
        val cleanName = customName?.trim()?.takeIf { it.isNotEmpty() }?.take(120)
        val sheetDisplayName = cleanName?.uppercase() ?: "NOVO PERSONAGEM"
        val freshId = idGenerator().ifBlank { UUID.randomUUID().toString() }.take(64)
        val safeDeviceId = deviceId.ifBlank { "local-device" }

        if (systemId == SystemId.BLANK) {
            return createPresetBySystemId(SystemId.BLANK, safeDeviceId).copy(
                id = freshId,
                systemId = SystemId.BLANK,
                characterName = sheetDisplayName,
                revision = 1,
                updatedAt = nowIso,
                deviceId = safeDeviceId,
                cards = emptyList(),
                rollLogs = emptyList(),
                xp = XpState()
            )
        }

        val preset = createPresetBySystemId(systemId, safeDeviceId)
        val resetCards = preset.cards.map { card ->
            card.copy(
                fields = card.fields.map { field ->
                    val k = field.key.trim().lowercase()
                    when (field.kind) {
                        FieldKind.TEXT -> {
                            val sample = field.textValue?.trim().orEmpty()
                            val derivedHint = if (
                                field.hint.isNullOrBlank() &&
                                sample.isNotEmpty() &&
                                sample.length <= 48 &&
                                k != "notas_campanha"
                            ) {
                                sample
                            } else {
                                field.hint
                            }
                            val nextText = if (
                                cleanName != null &&
                                (field.id == "f_nome" || k == "character_name" || k == "nome_personagem")
                            ) {
                                cleanName
                            } else {
                                ""
                            }
                            field.copy(textValue = nextText, hint = derivedHint)
                        }
                        FieldKind.NUMBER -> {
                            val nextNum = when (systemId) {
                                SystemId.WOD -> when {
                                    k == "generation" -> 13.0
                                    k in WOD_BASE_ONE_KEYS -> 1.0
                                    else -> 0.0
                                }
                                SystemId.CYBERPUNK -> when {
                                    k == "nivel" || k == "level" -> 1.0
                                    k in DND_ABILITY_KEYS -> 5.0
                                    else -> 0.0
                                }
                                else -> when {
                                    k == "level" || k == "nivel" -> 1.0
                                    k in DND_ABILITY_KEYS -> 10.0
                                    else -> 0.0
                                }
                            }
                            field.copy(numValue = nextNum)
                        }
                        FieldKind.RESOURCE -> {
                            val maxVal = max(1, field.max ?: 10)
                            when {
                                field.damageTrack == true -> field.copy(
                                    max = maxVal,
                                    numValue = maxVal.toDouble(),
                                    superficialDamage = 0,
                                    aggravatedDamage = 0
                                )
                                k == "hunger" -> field.copy(max = maxVal, numValue = 1.0)
                                k == "humanity" -> field.copy(max = maxVal, numValue = min(maxVal, 7).toDouble())
                                else -> field.copy(max = maxVal, numValue = maxVal.toDouble())
                            }
                        }
                        FieldKind.BOOLEAN -> field.copy(boolValue = false)
                        FieldKind.REPEATABLE -> field.copy(rows = emptyList())
                        FieldKind.CALCULATED, FieldKind.ROLL -> field
                    }
                }
            )
        }

        return preset.copy(
            id = freshId,
            systemId = systemId,
            characterName = sheetDisplayName,
            revision = 1,
            updatedAt = nowIso,
            deviceId = safeDeviceId,
            cards = resetCards,
            rollLogs = emptyList(),
            xp = XpState(totalEarned = 0, spent = 0, ledger = emptyList())
        )
    }

    fun getAvailablePresets(
        context: Context? = null,
        deviceId: String = "local-device"
    ): List<PresetSummary> {
        if (context != null && cachedAssetPresets.isEmpty()) {
            loadPresetsFromAsset(context, deviceId)
        }
        return SYSTEM_OPTIONS.map { opt ->
            val assetSheet = cachedAssetPresets[opt.id]
            val resolved = assetSheet ?: createPresetBySystemId(opt.id, deviceId)
            PresetSummary(
                systemId = opt.id,
                systemName = resolved.systemName,
                systemCode = resolved.systemCode,
                shortLabel = opt.shortLabel,
                description = opt.description,
                cardCount = resolved.cards.size,
                fieldCount = resolved.cards.sumOf { it.fields.size },
                fromAsset = assetSheet != null
            )
        }
    }

    fun loadPresetsFromJson(
        rawJson: String,
        deviceId: String = "local-device"
    ): Map<SystemId, CharacterSheetState> = runCatching {
        val bundle = presetJson.decodeFromString(PresetBundleV2.serializer(), rawJson)
        val decodedMap = LinkedHashMap<SystemId, CharacterSheetState>()
        for ((key, rawSheet) in bundle.presets) {
            val sysId = enumValues<SystemId>().firstOrNull { it.name.equals(key, ignoreCase = true) }
                ?: continue
            val normalized = normalizePresetSheetElement(rawSheet)
            val sheet = runCatching {
                presetJson.decodeFromJsonElement(CharacterSheetState.serializer(), normalized)
            }.getOrNull() ?: continue
            decodedMap[sysId] = migrateLegacyWodSheet(
                sheet.copy(systemId = sysId, deviceId = deviceId),
                deviceId
            )
        }
        decodedMap
    }.getOrDefault(emptyMap())

    fun loadPresetsFromAsset(
        context: Context,
        deviceId: String = "local-device"
    ): Map<SystemId, CharacterSheetState> {
        val loaded = runCatching {
            context.assets.open("presets/presets.v2.json").bufferedReader(Charsets.UTF_8).use { reader ->
                loadPresetsFromJson(reader.readText(), deviceId)
            }
        }.getOrDefault(emptyMap())
        if (loaded.isNotEmpty()) {
            cachedAssetPresets = loaded
        }
        return loaded
    }

    /**
     * Loads the startup workspace from bundled `assets/presets/presets.v2.json` when available,
     * and falls back safely to the in-memory Storyteller preset if asset I/O or JSON fails.
     */
    fun createDefaultWorkspace(
        deviceId: String = "local-device",
        context: Context? = null
    ): WorkspaceState {
        val assetPresets = runCatching {
            if (context != null) loadPresetsFromAsset(context, deviceId) else cachedAssetPresets
        }.getOrDefault(emptyMap())
        val initialWod = assetPresets[SystemId.WOD] ?: createWorldOfDarknessSheet(deviceId)
        return WorkspaceState(
            activeSystemId = SystemId.WOD,
            sheetsBySystem = mapOf(SystemId.WOD to initialWod)
        )
    }

    /**
     * Converts v2 web-style preset fields (`"value": 10|"text"|true` and numeric `row.col2`)
     * into typed Android `SheetField` properties (`numValue`/`textValue`/`boolValue`).
     */
    internal fun normalizePresetSheetElement(element: JsonElement): JsonObject {
        val sheetObj = element as? JsonObject ?: return JsonObject(emptyMap())
        val rawCards = sheetObj["cards"] as? JsonArray ?: return sheetObj
        val normalizedCards = JsonArray(rawCards.map { cardElem ->
            val cardObj = cardElem as? JsonObject ?: return@map cardElem
            val rawFields = cardObj["fields"] as? JsonArray ?: return@map cardObj
            val normalizedFields = JsonArray(rawFields.map { fieldElem ->
                val fieldObj = fieldElem as? JsonObject ?: return@map fieldElem
                val mutableField = fieldObj.toMutableMap()
                val rawValue = mutableField["value"] as? JsonPrimitive
                if (rawValue != null) {
                    val boolVal = if (!rawValue.isString) rawValue.booleanOrNull else null
                    val numVal = if (!rawValue.isString) rawValue.doubleOrNull else null
                    when {
                        boolVal != null && "boolValue" !in mutableField ->
                            mutableField["boolValue"] = JsonPrimitive(boolVal)
                        numVal != null && "numValue" !in mutableField ->
                            mutableField["numValue"] = JsonPrimitive(numVal)
                        rawValue.isString && "textValue" !in mutableField ->
                            mutableField["textValue"] = JsonPrimitive(rawValue.content)
                    }
                }
                val rawRows = mutableField["rows"] as? JsonArray
                if (rawRows != null) {
                    mutableField["rows"] = JsonArray(rawRows.map { rowElem ->
                        val rowObj = rowElem as? JsonObject ?: return@map rowElem
                        val col2 = rowObj["col2"] as? JsonPrimitive
                        if (col2 != null && !col2.isString) {
                            JsonObject(rowObj.toMutableMap().apply {
                                put("col2", JsonPrimitive(col2.content))
                            })
                        } else {
                            rowObj
                        }
                    })
                }
                JsonObject(mutableField)
            })
            JsonObject(cardObj.toMutableMap().apply { put("fields", normalizedFields) })
        })
        return JsonObject(sheetObj.toMutableMap().apply { put("cards", normalizedCards) })
    }
}
