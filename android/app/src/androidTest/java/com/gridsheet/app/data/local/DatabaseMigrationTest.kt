package com.gridsheet.app.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DatabaseMigrationTest {
    private val testDbName = "gridsheet-migration-test.db"

    @get:Rule
    val helper: MigrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        GridSheetDatabase::class.java,
        emptyList(),
        FrameworkSQLiteOpenHelperFactory()
    )

    @Test
    fun migrate1To2() {
        helper.createDatabase(testDbName, 1).apply {
            execSQL(
                """
                INSERT INTO character_sheets (systemId, systemName, characterName, sheetJson, updatedAtMillis, syncState)
                VALUES ('WOD', 'V20', 'Kael', '{"id":"sheet_v1","characterName":"Kael"}', 1700000000000, 'SYNCED')
                """.trimIndent()
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(
            testDbName,
            2,
            true,
            GridSheetDatabase.MIGRATION_1_2
        )

        db.query("SELECT systemId, revision, deviceId, isDirty FROM character_sheets WHERE systemId = 'WOD'").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("WOD", cursor.getString(0))
            assertEquals(1, cursor.getInt(1))
            assertEquals("local-device", cursor.getString(2))
            assertEquals(0, cursor.getInt(3))
        }
    }

    @Test
    fun migrate2To3CreatesIndexedBooksAndRulePagesFts() {
        helper.createDatabase(testDbName, 2).apply { close() }

        val db = helper.runMigrationsAndValidate(
            testDbName,
            3,
            true,
            GridSheetDatabase.MIGRATION_2_3
        )

        db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('indexed_books', 'rule_pages_fts')").use { cursor ->
            val tables = mutableSetOf<String>()
            while (cursor.moveToNext()) tables += cursor.getString(0)
            assertTrue("indexed_books deve existir após MIGRATION_2_3", "indexed_books" in tables)
            assertTrue("rule_pages_fts deve existir após MIGRATION_2_3", "rule_pages_fts" in tables)
        }
    }

    @Test
    fun migrateAll1To4PreservesDataAndCreatesSavedSheets() {
        helper.createDatabase(testDbName, 1).apply {
            execSQL(
                """
                INSERT INTO character_sheets (systemId, systemName, characterName, sheetJson, updatedAtMillis, syncState)
                VALUES ('WOD', 'V20', 'Elena', '{"id":"sheet_elena_1","characterName":"Elena"}', 1700000000000, 'SYNCED')
                """.trimIndent()
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(
            testDbName,
            4,
            true,
            GridSheetDatabase.MIGRATION_1_2,
            GridSheetDatabase.MIGRATION_2_3,
            GridSheetDatabase.MIGRATION_3_4
        )

        db.query("SELECT sheetId, systemId, characterName FROM saved_sheets").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("sheet_elena_1", cursor.getString(0))
            assertEquals("WOD", cursor.getString(1))
            assertEquals("Elena", cursor.getString(2))
        }
    }
}
