package com.gridsheet.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SheetDao {
    @Query("SELECT * FROM character_sheets ORDER BY updatedAtMillis DESC")
    suspend fun getAllSheets(): List<SheetEntity>

    @Query("SELECT * FROM character_sheets ORDER BY updatedAtMillis DESC")
    fun observeAllSheets(): Flow<List<SheetEntity>>

    @Query("SELECT * FROM character_sheets WHERE systemId = :systemId LIMIT 1")
    suspend fun getSheetBySystem(systemId: String): SheetEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSheet(entity: SheetEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSheets(entities: List<SheetEntity>)

    @Query("SELECT * FROM workspace_metadata WHERE id = 1 LIMIT 1")
    suspend fun getMetadata(): WorkspaceMetadataEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMetadata(meta: WorkspaceMetadataEntity)
}
