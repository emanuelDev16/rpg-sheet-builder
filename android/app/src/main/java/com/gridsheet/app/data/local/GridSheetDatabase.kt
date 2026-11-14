package com.gridsheet.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [SheetEntity::class, WorkspaceMetadataEntity::class],
    version = 1,
    exportSchema = false
)
abstract class GridSheetDatabase : RoomDatabase() {
    abstract fun sheetDao(): SheetDao

    companion object {
        @Volatile
        private var INSTANCE: GridSheetDatabase? = null

        fun getInstance(context: Context): GridSheetDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    GridSheetDatabase::class.java,
                    "gridsheet_offline.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
