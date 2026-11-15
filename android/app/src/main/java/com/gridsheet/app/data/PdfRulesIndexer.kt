package com.gridsheet.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.provider.OpenableColumns
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
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
import kotlinx.coroutines.tasks.await
import java.util.Locale
import java.util.UUID
import kotlin.math.roundToInt

class ScannedPdfWithoutOcrException(
    val bookTitle: String,
    val sampledPages: Int,
    val totalPages: Int,
    val totalExtractedChars: Int,
    message: String =
        "PDF escaneado detectado (sem OCR). As primeiras $sampledPages páginas de \"$bookTitle\" contêm apenas imagens sem camada de texto. Aplique OCR (ex.: OCRmyPDF, PDF24 ou Adobe Acrobat) antes de importar novamente."
) : IllegalStateException(message) {
    val code: String = CODE

    companion object {
        const val CODE = "SCANNED_PDF_NO_OCR"
    }
}

sealed class IndexProgress {
    data class Extracting(
        val bookId: String,
        val bookTitle: String,
        val currentPage: Int,
        val totalPages: Int
    ) : IndexProgress()

    data class OcrExtracting(
        val bookId: String,
        val bookTitle: String,
        val currentPage: Int,
        val totalPages: Int,
        val currentPdfPage: Int
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

    data class ScannedNoOcr(
        val bookTitle: String,
        val sampledPages: Int,
        val totalPages: Int,
        val message: String
    ) : IndexProgress()

    data class Error(
        val message: String
    ) : IndexProgress()
}

object PdfTextLayerDetector {
    const val SAMPLE_MAX_PAGES = 10
    const val MIN_AVG_CHARS_PER_PAGE = 30.0
    const val MIN_CHARS_FOR_TEXT_PAGE = 40

    fun countNonWhitespaceChars(text: String): Int {
        var count = 0
        for (ch in text) {
            if (!ch.isWhitespace()) count++
        }
        return count
    }

    inline fun extractPagesWithFailFast(
        bookId: String,
        bookTitle: String,
        systemId: String,
        totalPages: Int,
        readPageRawText: (pageNumber: Int) -> String,
        onPageExtracted: (currentPage: Int, totalPages: Int) -> Unit = { _, _ -> }
    ): List<RulePageFtsEntity> {
        if (totalPages <= 0) {
            throw ScannedPdfWithoutOcrException(
                bookTitle = bookTitle,
                sampledPages = 0,
                totalPages = 0,
                totalExtractedChars = 0,
                message = "O PDF selecionado não possui páginas legíveis."
            )
        }

        val sampleLimit = minOf(totalPages, SAMPLE_MAX_PAGES)
        var totalExtractedChars = 0
        var pagesWithText = 0
        val extractedPages = mutableListOf<RulePageFtsEntity>()

        for (page in 1..totalPages) {
            val cleanText = Fts5QuerySanitizer.sanitizeExtractedText(readPageRawText(page))
            val cleanLength = countNonWhitespaceChars(cleanText)

            if (page <= sampleLimit) {
                totalExtractedChars += cleanLength
                if (cleanLength >= MIN_CHARS_FOR_TEXT_PAGE) {
                    pagesWithText += 1
                }
            }

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

            onPageExtracted(page, totalPages)

            if (page == sampleLimit) {
                val avgChars = totalExtractedChars.toDouble() / sampleLimit.toDouble()
                if (avgChars < MIN_AVG_CHARS_PER_PAGE && pagesWithText == 0) {
                    throw ScannedPdfWithoutOcrException(
                        bookTitle = bookTitle,
                        sampledPages = sampleLimit,
                        totalPages = totalPages,
                        totalExtractedChars = totalExtractedChars
                    )
                }
            }
        }

        return extractedPages
    }
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

    /**
     * Converts arbitrary user text into a safe SQLite FTS3/FTS4 MATCH expression.
     * In SQLite FTS4, `"token"*` does not match prefix tokens; bare lowercase alphanumeric
     * tokens with trailing `*` (`token*`) match prefixes while avoiding uppercase `AND`/`OR`/`NOT`/`NEAR`.
     */
    fun sanitizeFts4Query(rawQuery: String, maxTerms: Int = 10): String {
        val terms = extractTerms(rawQuery, maxTerms)
        if (terms.isEmpty()) return ""
        return terms.joinToString(" ") { token ->
            val clean = token.replace("\"", "")
            "$clean*"
        }
    }

    fun sanitizePlainLikeTerms(rawQuery: String, maxTerms: Int = 6): List<String> =
        extractTerms(rawQuery, maxTerms)

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

object OcrPageRangeHelper {
    const val MAX_BITMAP_WIDTH_PX = 1600

    /**
     * Clamps a 0-based [pageRange] to `0 until totalPages`.
     * Returns an empty range if [totalPages] <= 0 or if the requested range has no overlap.
     */
    fun normalizeRange(totalPages: Int, pageRange: IntRange?): IntRange {
        if (totalPages <= 0) return IntRange.EMPTY
        val maxIdx = totalPages - 1
        if (pageRange == null) return 0..maxIdx
        val start = pageRange.first.coerceIn(0, maxIdx)
        val end = pageRange.last.coerceIn(0, maxIdx)
        return if (start <= end) start..end else IntRange.EMPTY
    }

    /**
     * Computes proportional bitmap dimensions capping width to [maxWidthPx] (default 1600px).
     */
    fun computeTargetBitmapSize(
        pageWidth: Int,
        pageHeight: Int,
        maxWidthPx: Int = MAX_BITMAP_WIDTH_PX
    ): Pair<Int, Int> {
        if (pageWidth <= 0 || pageHeight <= 0) {
            return maxWidthPx.coerceAtLeast(1) to maxWidthPx.coerceAtLeast(1)
        }
        val scale = if (pageWidth > maxWidthPx) {
            maxWidthPx.toDouble() / pageWidth.toDouble()
        } else {
            minOf(2.5, maxWidthPx.toDouble() / pageWidth.toDouble())
        }
        val targetW = (pageWidth * scale).roundToInt().coerceIn(1, maxWidthPx)
        val targetH = (pageHeight * scale).roundToInt().coerceAtLeast(1)
        return targetW to targetH
    }

    /**
     * Executes sequential OCR page-by-page, checking coroutine cancellation on every step.
     * Returns sanitized [RulePageFtsEntity] rows only if the entire range completes without cancellation.
     */
    suspend fun runSequentialOcr(
        bookId: String,
        systemId: String,
        totalPages: Int,
        pageRange: IntRange?,
        recognizePageText: suspend (pageIndex: Int) -> String,
        onPageProcessed: suspend (processedCount: Int, rangeTotal: Int, pdfPageNumber: Int) -> Unit = { _, _, _ -> }
    ): List<RulePageFtsEntity> {
        val normalized = normalizeRange(totalPages, pageRange)
        if (normalized.isEmpty()) return emptyList()

        val rangeTotal = normalized.last - normalized.first + 1
        val extracted = mutableListOf<RulePageFtsEntity>()
        var processed = 0

        for (pageIndex in normalized) {
            currentCoroutineContext().ensureActive()
            val rawText = recognizePageText(pageIndex)
            currentCoroutineContext().ensureActive()

            val cleanText = Fts5QuerySanitizer.sanitizeExtractedText(rawText)
            val pdfPageNum = pageIndex + 1
            if (cleanText.isNotBlank()) {
                extracted.add(
                    RulePageFtsEntity(
                        bookId = bookId,
                        systemId = systemId,
                        pageNumber = pdfPageNum,
                        content = cleanText
                    )
                )
            }
            processed += 1
            onPageProcessed(processed, rangeTotal, pdfPageNum)
        }

        return extracted
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

        var totalPages = 0

        val extractedPages = appContext.contentResolver.openInputStream(uri)?.use { inputStream ->
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

                PdfTextLayerDetector.extractPagesWithFailFast(
                    bookId = bookId,
                    bookTitle = bookTitle,
                    systemId = systemId,
                    totalPages = totalPages,
                    readPageRawText = { page ->
                        currentCoroutineContext().ensureActive()
                        stripper.startPage = page
                        stripper.endPage = page
                        stripper.getText(document)
                    },
                    onPageExtracted = { page, total ->
                        emit(
                            IndexProgress.Extracting(
                                bookId = bookId,
                                bookTitle = bookTitle,
                                currentPage = page,
                                totalPages = total
                            )
                        )
                    }
                )
            }
        } ?: throw IllegalStateException("Não foi possível abrir o arquivo PDF selecionado.")

        if (extractedPages.isEmpty()) {
            throw ScannedPdfWithoutOcrException(
                bookTitle = bookTitle,
                sampledPages = minOf(totalPages, PdfTextLayerDetector.SAMPLE_MAX_PAGES),
                totalPages = totalPages,
                totalExtractedChars = 0
            )
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
        when (err) {
            is ScannedPdfWithoutOcrException -> emit(
                IndexProgress.ScannedNoOcr(
                    bookTitle = err.bookTitle,
                    sampledPages = err.sampledPages,
                    totalPages = err.totalPages,
                    message = err.message ?: "PDF escaneado sem OCR."
                )
            )
            else -> emit(IndexProgress.Error(err.message ?: "Falha ao indexar o arquivo PDF selecionado."))
        }
    }.flowOn(Dispatchers.IO)

    fun indexPdfWithOcr(
        uri: Uri,
        bookTitle: String,
        systemId: String,
        pageRange: IntRange? = null
    ): Flow<IndexProgress> = flow {
        val appContext = context.applicationContext
        val resolvedTitle = bookTitle.trim().ifEmpty { resolveBookTitle(appContext, uri) }
        val bookId = "pdf_ocr_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"

        val pfd = appContext.contentResolver.openFileDescriptor(uri, "r")
            ?: throw IllegalStateException("Não foi possível abrir o arquivo PDF para OCR.")

        var totalPdfPages = 0
        val extractedPages = pfd.use { descriptor ->
            PdfRenderer(descriptor).use { renderer ->
                totalPdfPages = renderer.pageCount
                if (totalPdfPages <= 0) {
                    throw IllegalStateException("O PDF selecionado não possui páginas legíveis.")
                }

                val normalizedRange = OcrPageRangeHelper.normalizeRange(totalPdfPages, pageRange)
                if (normalizedRange.isEmpty()) {
                    throw IllegalArgumentException("Intervalo de páginas inválido para OCR (1–$totalPdfPages).")
                }
                val rangeTotal = normalizedRange.last - normalizedRange.first + 1

                emit(
                    IndexProgress.OcrExtracting(
                        bookId = bookId,
                        bookTitle = resolvedTitle,
                        currentPage = 0,
                        totalPages = rangeTotal,
                        currentPdfPage = normalizedRange.first + 1
                    )
                )

                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                try {
                    OcrPageRangeHelper.runSequentialOcr(
                        bookId = bookId,
                        systemId = systemId,
                        totalPages = totalPdfPages,
                        pageRange = normalizedRange,
                        recognizePageText = { pageIndex ->
                            val page = renderer.openPage(pageIndex)
                            var bitmap: Bitmap? = null
                            try {
                                val (targetW, targetH) = OcrPageRangeHelper.computeTargetBitmapSize(
                                    page.width,
                                    page.height
                                )
                                bitmap = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888)
                                bitmap.eraseColor(Color.WHITE)
                                page.render(
                                    bitmap,
                                    null,
                                    null,
                                    PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                                )
                                val result = recognizer.process(InputImage.fromBitmap(bitmap, 0)).await()
                                result.text
                            } finally {
                                bitmap?.let { bmp ->
                                    if (!bmp.isRecycled) bmp.recycle()
                                }
                                page.close()
                            }
                        },
                        onPageProcessed = { processedCount, totalInRange, pdfPageNum ->
                            emit(
                                IndexProgress.OcrExtracting(
                                    bookId = bookId,
                                    bookTitle = resolvedTitle,
                                    currentPage = processedCount,
                                    totalPages = totalInRange,
                                    currentPdfPage = pdfPageNum
                                )
                            )
                        }
                    )
                } finally {
                    recognizer.close()
                }
            }
        }

        currentCoroutineContext().ensureActive()

        if (extractedPages.isEmpty()) {
            throw IllegalStateException("Nenhum texto legível foi reconhecido via OCR no intervalo selecionado.")
        }

        emit(
            IndexProgress.Persisting(
                bookId = bookId,
                bookTitle = resolvedTitle,
                totalPages = totalPdfPages
            )
        )

        val bookEntity = IndexedBookEntity(
            bookId = bookId,
            title = resolvedTitle,
            systemId = systemId,
            pageCount = totalPdfPages,
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
        val message = when (err) {
            is MlKitException -> {
                if (err.errorCode == MlKitException.UNAVAILABLE ||
                    err.message?.contains("download", ignoreCase = true) == true
                ) {
                    "Módulo de OCR do Google Play Services indisponível ou aguardando download. Conecte-se brevemente à internet na 1ª execução ou verifique o Google Play Services."
                } else {
                    "Falha no motor OCR ML Kit (${err.errorCode}): ${err.message ?: "erro desconhecido"}"
                }
            }
            else -> err.message ?: "Falha ao executar OCR local no PDF selecionado."
        }
        emit(IndexProgress.Error(message))
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
