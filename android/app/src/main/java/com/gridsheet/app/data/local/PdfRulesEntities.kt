package com.gridsheet.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "indexed_books")
data class IndexedBookEntity(
    @PrimaryKey
    val bookId: String,
    val title: String,
    val systemId: String,
    val pageCount: Int,
    val indexedAt: Long
)

/**
 * Row model for the SQLite FTS5 virtual table `rule_pages_fts`.
 * Note: Room 2.6.1 only provides @Fts3/@Fts4 annotations, so `rule_pages_fts`
 * is provisioned and migrated as a genuine SQLite FTS5 virtual table in
 * GridSheetDatabase and queried via @RawQuery with bm25() and snippet().
 */
data class RulePageFtsEntity(
    val bookId: String,
    val systemId: String,
    val pageNumber: Int,
    val content: String
)

data class FtsRuleHitRow(
    val bookId: String,
    val bookTitle: String,
    val systemId: String,
    val pageNumber: Int,
    val snippet: String,
    val rank: Double
)
