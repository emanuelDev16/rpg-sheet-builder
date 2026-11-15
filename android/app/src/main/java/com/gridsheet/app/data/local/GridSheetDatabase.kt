package com.gridsheet.app.data.local

import android.content.Context
import android.util.Log
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

enum class RulePagesStorageMode {
    FTS5,
    FTS4,
    PLAIN
}

@Database(
    entities = [
        SheetEntity::class,
        WorkspaceMetadataEntity::class,
        IndexedBookEntity::class,
        SavedSheetEntity::class
    ],
    version = 4,
    exportSchema = false
)
abstract class GridSheetDatabase : RoomDatabase() {
    abstract fun sheetDao(): SheetDao
    abstract fun pdfRulesDao(): PdfRulesDao

    companion object {
        private const val TAG = "GridSheetDatabase"

        @Volatile
        private var INSTANCE: GridSheetDatabase? = null

        val FTS5_CREATE_SQL: String = """
            CREATE VIRTUAL TABLE IF NOT EXISTS `rule_pages_fts` USING fts5(
                `bookId` UNINDEXED,
                `systemId` UNINDEXED,
                `pageNumber` UNINDEXED,
                `content`,
                tokenize='unicode61'
            )
        """.trimIndent()

        val FTS4_CREATE_SQL: String = """
            CREATE VIRTUAL TABLE IF NOT EXISTS `rule_pages_fts` USING fts4(
                `bookId`,
                `systemId`,
                `pageNumber`,
                `content`,
                notindexed=`bookId`,
                notindexed=`systemId`,
                notindexed=`pageNumber`,
                tokenize=unicode61
            )
        """.trimIndent()

        val PLAIN_CREATE_SQL: String = """
            CREATE TABLE IF NOT EXISTS `rule_pages_fts` (
                `bookId` TEXT NOT NULL,
                `systemId` TEXT NOT NULL,
                `pageNumber` INTEGER NOT NULL,
                `content` TEXT NOT NULL
            )
        """.trimIndent()

        const val PLAIN_INDEX_SQL: String =
            "CREATE INDEX IF NOT EXISTS `idx_rule_pages_fts_book_sys` ON `rule_pages_fts`(`bookId`, `systemId`)"

        val MIGRATION_1_2: Migration = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE character_sheets ADD COLUMN revision INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE character_sheets ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z'")
                db.execSQL("ALTER TABLE character_sheets ADD COLUMN deviceId TEXT NOT NULL DEFAULT 'local-device'")
                db.execSQL("ALTER TABLE character_sheets ADD COLUMN baseRevision INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE character_sheets ADD COLUMN isDirty INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_2_3: Migration = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                createPdfRulesSchema(db)
            }
        }

        val MIGRATION_3_4: Migration = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `saved_sheets` (
                        `sheetId` TEXT NOT NULL,
                        `systemId` TEXT NOT NULL,
                        `systemName` TEXT NOT NULL,
                        `characterName` TEXT NOT NULL,
                        `sheetJson` TEXT NOT NULL,
                        `updatedAt` TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z',
                        `updatedAtMillis` INTEGER NOT NULL,
                        `revision` INTEGER NOT NULL DEFAULT 1,
                        PRIMARY KEY(`sheetId`)
                    )
                    """.trimIndent()
                )
                db.query(
                    "SELECT systemId, systemName, characterName, sheetJson, updatedAt, updatedAtMillis, revision FROM character_sheets"
                ).use { cursor ->
                    while (cursor.moveToNext()) {
                        val sysId = cursor.getString(0) ?: continue
                        val sysName = cursor.getString(1) ?: ""
                        val charName = cursor.getString(2) ?: ""
                        val rawJson = cursor.getString(3) ?: continue
                        val updatedAt = cursor.getString(4) ?: "1970-01-01T00:00:00Z"
                        val updatedAtMillis = cursor.getLong(5)
                        val revision = cursor.getInt(6)
                        val extractedId = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"")
                            .find(rawJson)?.groupValues?.getOrNull(1)
                            ?.takeIf { it.isNotBlank() }
                            ?: "sheet_${sysId.lowercase()}"
                        db.execSQL(
                            """
                            INSERT OR IGNORE INTO `saved_sheets`
                            (`sheetId`, `systemId`, `systemName`, `characterName`, `sheetJson`, `updatedAt`, `updatedAtMillis`, `revision`)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """.trimIndent(),
                            arrayOf<Any>(extractedId, sysId, sysName, charName, rawJson, updatedAt, updatedAtMillis, revision)
                        )
                    }
                }
            }
        }

        private fun createPdfRulesSchema(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `indexed_books` (
                    `bookId` TEXT NOT NULL,
                    `title` TEXT NOT NULL,
                    `systemId` TEXT NOT NULL,
                    `pageCount` INTEGER NOT NULL,
                    `indexedAt` INTEGER NOT NULL,
                    PRIMARY KEY(`bookId`)
                )
                """.trimIndent()
            )
            ensureRulePagesTable(db)
        }

        private fun queryCompileOptions(db: SupportSQLiteDatabase): Set<String> = runCatching {
            val options = LinkedHashSet<String>()
            db.query("PRAGMA compile_options").use { cursor ->
                while (cursor.moveToNext()) {
                    cursor.getString(0)?.trim()?.uppercase()?.let { options += it }
                }
            }
            options
        }.getOrDefault(emptySet())

        fun detectRulePagesStorageMode(db: SupportSQLiteDatabase): RulePagesStorageMode? {
            val tableSql = runCatching {
                db.query(
                    "SELECT sql FROM sqlite_master WHERE name = 'rule_pages_fts' AND type IN ('table', 'view')"
                ).use { cursor ->
                    if (cursor.moveToFirst()) cursor.getString(0)?.lowercase() else null
                }
            }.getOrNull() ?: return null

            val detected = when {
                tableSql.contains("using fts5") -> RulePagesStorageMode.FTS5
                tableSql.contains("using fts4") || tableSql.contains("using fts3") -> RulePagesStorageMode.FTS4
                else -> RulePagesStorageMode.PLAIN
            }
            val compileOptions = queryCompileOptions(db)
            val compatibleWithRuntime = when (detected) {
                RulePagesStorageMode.FTS5 -> compileOptions.isEmpty() || "ENABLE_FTS5" in compileOptions
                RulePagesStorageMode.FTS4 -> compileOptions.isEmpty() || "ENABLE_FTS4" in compileOptions || "ENABLE_FTS3" in compileOptions
                RulePagesStorageMode.PLAIN -> true
            }
            if (!compatibleWithRuntime) {
                runCatching { db.execSQL("DROP TABLE IF EXISTS `rule_pages_fts`") }
                return null
            }

            val readable = runCatching {
                db.query("SELECT 1 FROM `rule_pages_fts` LIMIT 0").use { }
            }.isSuccess
            if (!readable) {
                runCatching { db.execSQL("DROP TABLE IF EXISTS `rule_pages_fts`") }
                return null
            }
            return detected
        }

        /**
         * Stock Android platform SQLite frequently compiles FTS3/FTS4 without SQLITE_ENABLE_FTS5.
         * Check `PRAGMA compile_options` before attempting FTS5 so we avoid throwing a SQLite error
         * inside Room's `onCreate`/`onUpgrade` transaction, then fall back to FTS4 or a plain table.
         */
        fun ensureRulePagesTable(db: SupportSQLiteDatabase): RulePagesStorageMode {
            detectRulePagesStorageMode(db)?.let { return it }

            val compileOptions = queryCompileOptions(db)
            val allowFts5 = compileOptions.isEmpty() || "ENABLE_FTS5" in compileOptions
            val allowFts4 = compileOptions.isEmpty() || "ENABLE_FTS4" in compileOptions || "ENABLE_FTS3" in compileOptions

            val attempts = buildList {
                if (allowFts5) add(RulePagesStorageMode.FTS5 to listOf(FTS5_CREATE_SQL))
                if (allowFts4) add(RulePagesStorageMode.FTS4 to listOf(FTS4_CREATE_SQL))
                add(RulePagesStorageMode.PLAIN to listOf(PLAIN_CREATE_SQL, PLAIN_INDEX_SQL))
            }
            for ((mode, statements) in attempts) {
                val created = runCatching {
                    statements.forEach { db.execSQL(it) }
                    db.query("SELECT 1 FROM `rule_pages_fts` LIMIT 0").use { }
                }
                if (created.isSuccess) {
                    return mode
                }
                runCatching { db.execSQL("DROP TABLE IF EXISTS `rule_pages_fts`") }
                runCatching {
                    Log.w(TAG, "Rule search mode $mode unavailable on device SQLite: ${created.exceptionOrNull()?.message}")
                }
            }
            return RulePagesStorageMode.PLAIN
        }

        fun getInstance(context: Context): GridSheetDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    GridSheetDatabase::class.java,
                    "gridsheet_offline.db"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
                    .addCallback(object : Callback() {
                        override fun onCreate(db: SupportSQLiteDatabase) {
                            super.onCreate(db)
                            runCatching { ensureRulePagesTable(db) }
                        }

                        override fun onOpen(db: SupportSQLiteDatabase) {
                            super.onOpen(db)
                            runCatching { ensureRulePagesTable(db) }
                        }
                    })
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
