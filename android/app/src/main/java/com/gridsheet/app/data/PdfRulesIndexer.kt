package com.gridsheet.app.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.gridsheet.app.data.local.FtsRuleHitRow
import com.gridsheet.app.data.local.IndexedBookEntity
import com.gridsheet.app.data.local.PdfRulesDao
import com.gridsheet.app.data.local.RulePageFtsEntity
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.util.Locale
import java.util.UUID

sealed class IndexProgress {
    data class Extracting(
        val bookId: String,
        val bookTitle: String,
        val currentPage: Int,
        val totalPages: Int
    ) : IndexProgress()

    data class Persisting(
        val bookId: String,
        val bookTitle: String,
        val totalPages: Int
    ) : IndexProgress()

    data class Completed(
        val book: IndexedBookEntity,
        val indexedPagesCount: Int
    ) : IndexProgress()

    data class Error(
        val message: String
    ) : IndexProgress()
}

object Fts5QuerySanitizer {
    const val SNIPPET_START = "\uE001"
    const val SNIPPET_END = "\uE002"

    private val NON_ALNUM_REGEX = Regex("[^\\p{L}\\p{N}]+")
    private val SOFT_HYPHEN_LINEBREAK_REGEX = Regex("\\u00AD\\s*\\r?\\n\\s*")
    private val HYPHEN_LINEBREAK_REGEX = Regex("([\\p{L}\\p{N}])[-‐‑‒–]\\s*\\r?\\n\\s*([\\p{L}\\p{N}])")
    private val CONTROL_CHARS_REGEX = Regex("[\\u0000-\\u001F\\u007F\\uE001\\uE002]+")
    private val MULTI_SPACE_REGEX = Regex("\\s+")

    fun extractTerms(rawQuery: String, maxTerms: Int = 10): List<String> {
        if (rawQuery.isBlank() || maxTerms <= 0) return emptyList()
        return rawQuery
            .trim()
            .split(NON_ALNUM_REGEX)
            .map { it.trim().lowercase(Locale.ROOT) }
            .filter { it.isNotEmpty() }
            .distinct()
            .take(maxTerms)
    }

    /**
     * Converts arbitrary user text into a safe SQLite FTS5 MATCH expression.
     * Double-quoting each extracted alphanumeric token with a trailing `*` prefix
     * operator prevents syntax errors from `-`, `*`, `"`, `:`, `^`, parentheses,
     * and uppercase FTS5 boolean operators (`AND`, `OR`, `NOT`, `NEAR`).
     */
    fun sanitizeQuery(rawQuery: String, maxTerms: Int = 10): String {
        val terms = extractTerms(rawQuery, maxTerms)
        if (terms.isEmpty()) return ""
        return terms.joinToString(" ") { token ->
            val clean = token.replace("\"", "")
            "\"$clean\"*"
        }
    }

    fun sanitizeExtractedText(rawText: String): String {
        if (rawText.isEmpty()) return ""
        return rawText
            .replace(SOFT_HYPHEN_LINEBREAK_REGEX, "")
            .replace("\u00AD", "")
            .replace(HYPHEN_LINEBREAK_REGEX, "$1$2")
            .replace(CONTROL_CHARS_REGEX, " ")
            .replace(MULTI_SPACE_REGEX, " ")
            .trim()
    }

    /**
     * Orders FTS5 results by BM25 score ascending (in SQLite FTS5, more negative
     * values indicate higher relevance), breaking ties by page number and title.
     */
    fun sortHits(hits: List<FtsRuleHitRow>): List<FtsRuleHitRow> =
        hits.sortedWith(
            compareBy<FtsRuleHitRow> { it.rank }
                .thenBy { it.pageNumber }
                .thenBy { it.bookTitle.lowercase() }
        )

    fun parseSnippetSegments(snippet: String): List<Pair<String, Boolean>> {
        if (snippet.isEmpty()) return emptyList()
        val segments = mutableListOf<Pair<String, Boolean>>()
        var cursor = 0
        while (cursor < snippet.length) {
            val startIdx = snippet.indexOf(SNIPPET_START, cursor)
            if (startIdx < 0) {
                val tail = snippet.substring(cursor).replace(SNIPPET_END, "")
                if (tail.isNotEmpty()) segments.add(tail to false)
                break
            }
            if (startIdx > cursor) {
                val plain = snippet.substring(cursor, startIdx).replace(SNIPPET_END, "")
                if (plain.isNotEmpty()) segments.add(plain to false)
            }
            val matchStart = startIdx + SNIPPET_START.length
            val endIdx = snippet.indexOf(SNIPPET_END, matchStart)
            if (endIdx < 0) {
                val rest = snippet.substring(matchStart)
                if (rest.isNotEmpty()) segments.add(rest to true)
                break
            }
            val matched = snippet.substring(matchStart, endIdx)
            if (matched.isNotEmpty()) segments.add(matched to true)
            cursor = endIdx + SNIPPET_END.length
        }
        return segments
    }
}

class PdfRulesIndexer(
    private val context: Context,
    private val pdfRulesDao: PdfRulesDao
) {
    fun indexPdf(uri: Uri, systemId: String): Flow<IndexProgress> = flow {
        val appContext = context.applicationContext
        ensurePdfBoxInitialized(appContext)

        val bookTitle = resolveBookTitle(appContext, uri)
        val bookId = "pdf_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"

        emit(
            IndexProgress.Extracting(
                bookId = bookId,
                bookTitle = bookTitle,
                currentPage = 0,
                totalPages = 0
            )
        )

        val extractedPages = mutableListOf<RulePageFtsEntity>()
        var totalPages = 0

        appContext.contentResolver.openInputStream(uri)?.use { inputStream ->
            PDDocument.load(inputStream).use { document ->
                if (document.isEncrypted) {
                    throw IllegalStateException("PDF protegido por senha não pode ser indexado offline.")
                }
                totalPages = document.numberOfPages
                if (totalPages <= 0) {
                    throw IllegalStateException("O PDF selecionado não possui páginas legíveis.")
                }

                val stripper = PDFTextStripper().apply {
                    sortByPosition = true
                }

                for (page in 1..totalPages) {
                    currentCoroutineContext().ensureActive()
                    stripper.startPage = page
                    stripper.endPage = page
                    val rawText = stripper.getText(document)
                    val cleanText = Fts5QuerySanitizer.sanitizeExtractedText(rawText)
                    if (cleanText.isNotBlank()) {
                        extractedPages.add(
                            RulePageFtsEntity(
                                bookId = bookId,
                                systemId = systemId,
                                pageNumber = page,
                                content = cleanText
                            )
                        )
                    }
                    emit(
                        IndexProgress.Extracting(
                            bookId = bookId,
                            bookTitle = bookTitle,
                            currentPage = page,
                            totalPages = totalPages
                        )
                    )
                }
            }
        } ?: throw IllegalStateException("Não foi possível abrir o arquivo PDF selecionado.")

        if (extractedPages.isEmpty()) {
            throw IllegalStateException("Nenhum texto selecionável encontrado no PDF (arquivo escaneado sem OCR?).")
        }

        emit(
            IndexProgress.Persisting(
                bookId = bookId,
                bookTitle = bookTitle,
                totalPages = totalPages
            )
        )

        val bookEntity = IndexedBookEntity(
            bookId = bookId,
            title = bookTitle,
            systemId = systemId,
            pageCount = totalPages,
            indexedAt = System.currentTimeMillis()
        )
        pdfRulesDao.insertBookAndPages(bookEntity, extractedPages)

        emit(
            IndexProgress.Completed(
                book = bookEntity,
                indexedPagesCount = extractedPages.size
            )
        )
    }.catch { err ->
        if (err is CancellationException) throw err
        emit(IndexProgress.Error(err.message ?: "Falha ao indexar o arquivo PDF selecionado."))
    }.flowOn(Dispatchers.IO)

    private fun resolveBookTitle(context: Context, uri: Uri): String {
        val displayName = runCatching {
            context.contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
            }
        }.getOrNull()

        val rawName = displayName?.takeIf { it.isNotBlank() }
            ?: uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.isNotBlank() }
            ?: "Livro de Regras"

        return rawName.replace(Regex("\\.pdf$", RegexOption.IGNORE_CASE), "").trim()
            .ifEmpty { "Livro de Regras" }
    }

    companion object {
        @Volatile
        private var pdfBoxInitialized = false

        fun ensurePdfBoxInitialized(context: Context) {
            if (!pdfBoxInitialized) {
                synchronized(this) {
                    if (!pdfBoxInitialized) {
                        PDFBoxResourceLoader.init(context.applicationContext)
                        pdfBoxInitialized = true
                    }
                }
            }
        }
    }
}
