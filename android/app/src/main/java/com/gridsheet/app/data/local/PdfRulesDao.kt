package com.gridsheet.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RawQuery
import androidx.room.Transaction
import androidx.sqlite.db.SimpleSQLiteQuery
import androidx.sqlite.db.SupportSQLiteQuery
import com.gridsheet.app.data.Fts5QuerySanitizer
import kotlinx.coroutines.flow.Flow

@Dao
abstract class PdfRulesDao(private val db: GridSheetDatabase) {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertBook(book: IndexedBookEntity)

    @Query("SELECT * FROM indexed_books WHERE systemId = :systemId ORDER BY indexedAt DESC")
    abstract fun observeBooksBySystem(systemId: String): Flow<List<IndexedBookEntity>>

    @Query("SELECT * FROM indexed_books ORDER BY indexedAt DESC")
    abstract fun observeAllBooks(): Flow<List<IndexedBookEntity>>

    @Query("SELECT * FROM indexed_books WHERE systemId = :systemId ORDER BY indexedAt DESC")
    abstract suspend fun getBooksBySystem(systemId: String): List<IndexedBookEntity>

    @Query("DELETE FROM indexed_books WHERE bookId = :bookId")
    abstract suspend fun deleteBookMetadata(bookId: String)

    @RawQuery
    abstract suspend fun rawSearchPages(query: SupportSQLiteQuery): List<FtsRuleHitRow>

    @Transaction
    open suspend fun insertBookAndPages(
        book: IndexedBookEntity,
        pages: List<RulePageFtsEntity>
    ) {
        upsertBook(book)
        val writableDb = db.openHelper.writableDatabase
        writableDb.execSQL("DELETE FROM rule_pages_fts WHERE bookId = ?", arrayOf(book.bookId))
        if (pages.isEmpty()) return

        val statement = writableDb.compileStatement(
            "INSERT INTO rule_pages_fts(bookId, systemId, pageNumber, content) VALUES (?, ?, ?, ?)"
        )
        try {
            for (page in pages) {
                statement.clearBindings()
                statement.bindString(1, page.bookId)
                statement.bindString(2, page.systemId)
                statement.bindLong(3, page.pageNumber.toLong())
                statement.bindString(4, page.content)
                statement.executeInsert()
            }
        } finally {
            statement.close()
        }
    }

    @Transaction
    open suspend fun deleteBookCascade(bookId: String) {
        db.openHelper.writableDatabase.execSQL(
            "DELETE FROM rule_pages_fts WHERE bookId = ?",
            arrayOf(bookId)
        )
        deleteBookMetadata(bookId)
    }

    open suspend fun searchRulesFts5(
        rawQuery: String,
        systemId: String,
        limit: Int = 15
    ): List<FtsRuleHitRow> {
        val ftsQuery = Fts5QuerySanitizer.sanitizeQuery(rawQuery)
        if (ftsQuery.isEmpty()) return emptyList()

        val sql = """
            SELECT
                rule_pages_fts.bookId AS bookId,
                COALESCE(b.title, rule_pages_fts.bookId) AS bookTitle,
                rule_pages_fts.systemId AS systemId,
                CAST(rule_pages_fts.pageNumber AS INTEGER) AS pageNumber,
                snippet(
                    rule_pages_fts,
                    3,
                    '${Fts5QuerySanitizer.SNIPPET_START}',
                    '${Fts5QuerySanitizer.SNIPPET_END}',
                    '...',
                    24
                ) AS snippet,
                bm25(rule_pages_fts) AS rank
            FROM rule_pages_fts
            LEFT JOIN indexed_books AS b ON b.bookId = rule_pages_fts.bookId
            WHERE rule_pages_fts MATCH ? AND rule_pages_fts.systemId = ?
            ORDER BY bm25(rule_pages_fts) ASC, CAST(rule_pages_fts.pageNumber AS INTEGER) ASC
            LIMIT ?
        """.trimIndent()

        val query = SimpleSQLiteQuery(
            sql,
            arrayOf<Any?>(ftsQuery, systemId, limit.coerceIn(1, 50))
        )
        return Fts5QuerySanitizer.sortHits(rawSearchPages(query))
    }
}
