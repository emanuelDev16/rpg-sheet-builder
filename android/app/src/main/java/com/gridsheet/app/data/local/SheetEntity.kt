package com.gridsheet.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "character_sheets")
data class SheetEntity(
    @PrimaryKey
    val systemId: String,
    val systemName: String,
    val characterName: String,
    val sheetJson: String,
    val revision: Int = 1,
    val updatedAt: String = "1970-01-01T00:00:00Z",
    val deviceId: String = "local-device",
    val baseRevision: Int = 1,
    val isDirty: Boolean = false,
    val updatedAtMillis: Long,
    val syncState: String = "SYNCED"
)

@Entity(tableName = "workspace_metadata")
data class WorkspaceMetadataEntity(
    @PrimaryKey
    val id: Int = 1,
    val activeSystemId: String,
    val updatedAtMillis: Long
)
