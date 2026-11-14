package com.gridsheet.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [SheetEntity::class, WorkspaceMetadataEntity::class],
    version = 2,
    exportSchema = false
)
abstract class GridSheetDatabase : RoomDatabase() {
    abstract fun sheetDao(): SheetDao

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

        fun getInstance(context: Context): GridSheetDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    GridSheetDatabase::class.java,
                    "gridsheet_offline.db"
                )
                    .addMigrations(MIGRATION_1_2)
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
