package com.gridsheet.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        SheetEntity::class,
        WorkspaceMetadataEntity::class,
        IndexedBookEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class GridSheetDatabase : RoomDatabase() {
    abstract fun sheetDao(): SheetDao
    abstract fun pdfRulesDao(): PdfRulesDao

    companion object {
        @Volatile
        private var INSTANCE: GridSheetDatabase? = null

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
            createFts5VirtualTable(db)
        }

        private fun createFts5VirtualTable(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS `rule_pages_fts` USING fts5(
                    `bookId` UNINDEXED,
                    `systemId` UNINDEXED,
                    `pageNumber` UNINDEXED,
                    `content`,
                    tokenize='unicode61'
                )
                """.trimIndent()
            )
        }

        fun getInstance(context: Context): GridSheetDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    GridSheetDatabase::class.java,
                    "gridsheet_offline.db"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .addCallback(object : Callback() {
                        override fun onCreate(db: SupportSQLiteDatabase) {
                            super.onCreate(db)
                            createFts5VirtualTable(db)
                        }

                        override fun onOpen(db: SupportSQLiteDatabase) {
                            super.onOpen(db)
                            createFts5VirtualTable(db)
                        }
                    })
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
