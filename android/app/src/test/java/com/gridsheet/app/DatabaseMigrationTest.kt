package com.gridsheet.app

import android.content.ContentResolver
import android.content.ContentValues
import android.database.CharArrayBuffer
import android.database.ContentObserver
import android.database.Cursor
import android.database.DataSetObserver
import android.database.sqlite.SQLiteTransactionListener
import android.net.Uri
import android.os.Bundle
import android.os.CancellationSignal
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteQuery
import androidx.sqlite.db.SupportSQLiteStatement
import com.gridsheet.app.data.local.GridSheetDatabase
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.Locale

class DatabaseMigrationTest {

    private fun resolveProjectDir(): File {
        val candidates = listOf(
            File("."),
            File("app"),
            File("android/app")
        )
        return candidates.first { File(it, "schemas/com.gridsheet.app.data.local.GridSheetDatabase").isDirectory }
    }

    @Test
    fun roomAnnotationExportsSchemaAndDisablesDestructiveFallback() {
        val dbSourceCandidates = listOf(
            File("src/main/java/com/gridsheet/app/data/local/GridSheetDatabase.kt"),
            File("app/src/main/java/com/gridsheet/app/data/local/GridSheetDatabase.kt"),
            File("android/app/src/main/java/com/gridsheet/app/data/local/GridSheetDatabase.kt")
        )
        val dbSource = dbSourceCandidates.first { it.isFile }.readText(Charsets.UTF_8)
        assertTrue("exportSchema must be true", dbSource.contains("exportSchema = true"))
        assertTrue("GridSheetDatabase must be at version 4", dbSource.contains("version = 4"))
        assertFalse(
            "GridSheetDatabase must not use fallbackToDestructiveMigration",
            dbSource.contains("fallbackToDestructiveMigration")
        )
    }

    @Test
    fun exportedRoomSchemasExistForAllVersions() {
        val schemaDir = File(resolveProjectDir(), "schemas/com.gridsheet.app.data.local.GridSheetDatabase")
        for (version in 1..4) {
            val file = File(schemaDir, "$version.json")
            assertTrue("Missing Room schema $version.json at ${file.absolutePath}", file.isFile)
            val parsed = Json.parseToJsonElement(file.readText(Charsets.UTF_8)).jsonObject
            val dbObj = parsed["database"]!!.jsonObject
            assertEquals(version, dbObj["version"]!!.jsonPrimitive.intOrNull)
        }
    }

    @Test
    fun explicitMigrationsExecuteExpectedSqlStatements() {
        val db12 = RecordingSupportSQLiteDatabase()
        GridSheetDatabase.MIGRATION_1_2.migrate(db12)
        assertTrue(db12.executedSql.any { it.contains("ADD COLUMN revision") })
        assertTrue(db12.executedSql.any { it.contains("ADD COLUMN updatedAt") })
        assertTrue(db12.executedSql.any { it.contains("ADD COLUMN deviceId") })
        assertTrue(db12.executedSql.any { it.contains("ADD COLUMN baseRevision") })
        assertTrue(db12.executedSql.any { it.contains("ADD COLUMN isDirty") })

        val db23 = RecordingSupportSQLiteDatabase(
            compileOptions = listOf("ENABLE_FTS5"),
            ftsTableSql = null
        )
        GridSheetDatabase.MIGRATION_2_3.migrate(db23)
        assertTrue(db23.executedSql.any { it.contains("CREATE TABLE IF NOT EXISTS `indexed_books`") })
        assertTrue(db23.executedSql.any { it.contains("CREATE VIRTUAL TABLE IF NOT EXISTS `rule_pages_fts`") })

        val db34 = RecordingSupportSQLiteDatabase(
            characterSheetRows = listOf(
                arrayOf("WOD", "V20", "Elena", """{"id":"sheet_elena_1"}""", "2026-01-01T00:00:00Z", 1700000000000L, 2)
            )
        )
        GridSheetDatabase.MIGRATION_3_4.migrate(db34)
        assertTrue(db34.executedSql.any { it.contains("CREATE TABLE IF NOT EXISTS `saved_sheets`") })
        assertTrue(db34.executedBindArgs.any { it.firstOrNull() == "sheet_elena_1" })
    }

    @Test
    fun crashRecoveryLogRoundTripWritesReadsAndClearsSafely() {
        val tempDir = Files.createTempDirectory("gridsheet-crash-test").toFile()
        try {
            val file = CrashRecoveryManager.writeCrashLog(
                baseDir = tempDir,
                threadName = "main",
                throwable = IllegalStateException("Simulated Room failure"),
                nowIso = "2026-11-19T12:00:00Z"
            )
            assertEquals(CrashRecoveryManager.LAST_CRASH_FILE_NAME, file.name)
            val content = CrashRecoveryManager.readLastCrashLog(tempDir)
            assertTrue(content?.contains("Simulated Room failure") == true)
            assertTrue(content?.contains("IllegalStateException") == true)

            CrashRecoveryManager.clearLastCrashLog(tempDir)
            assertEquals(null, CrashRecoveryManager.readLastCrashLog(tempDir))
        } finally {
            tempDir.deleteRecursively()
        }
    }

    private class RecordingSupportSQLiteDatabase(
        private val compileOptions: List<String> = emptyList(),
        private val ftsTableSql: String? = null,
        private val characterSheetRows: List<Array<Any?>> = emptyList()
    ) : SupportSQLiteDatabase {
        val executedSql = mutableListOf<String>()
        val executedBindArgs = mutableListOf<List<Any?>>()

        override fun execSQL(sql: String) {
            executedSql += sql
        }

        override fun execSQL(sql: String, bindArgs: Array<out Any?>) {
            executedSql += sql
            executedBindArgs += bindArgs.toList()
        }

        override fun query(query: String): Cursor {
            return when {
                query.startsWith("PRAGMA compile_options", ignoreCase = true) ->
                    SimpleRowsCursor(listOf("compile_options"), compileOptions.map { arrayOf<Any?>(it) })
                query.contains("FROM sqlite_master", ignoreCase = true) ->
                    SimpleRowsCursor(listOf("sql"), listOfNotNull(ftsTableSql?.let { arrayOf<Any?>(it) }))
                query.contains("FROM `rule_pages_fts`", ignoreCase = true) ->
                    SimpleRowsCursor(listOf("1"), listOf(arrayOf<Any?>(1)))
                query.contains("FROM character_sheets", ignoreCase = true) ->
                    SimpleRowsCursor(
                        listOf("systemId", "systemName", "characterName", "sheetJson", "updatedAt", "updatedAtMillis", "revision"),
                        characterSheetRows
                    )
                else -> SimpleRowsCursor(emptyList(), emptyList())
            }
        }

        override fun query(query: String, bindArgs: Array<out Any?>): Cursor = query(query)
        override fun query(query: SupportSQLiteQuery): Cursor = query(query.sql)
        override fun query(query: SupportSQLiteQuery, cancellationSignal: CancellationSignal?): Cursor = query(query.sql)

        override fun compileStatement(sql: String): SupportSQLiteStatement = throw UnsupportedOperationException()
        override fun beginTransaction() {}
        override fun beginTransactionNonExclusive() {}
        override fun beginTransactionWithListener(transactionListener: SQLiteTransactionListener) {}
        override fun beginTransactionWithListenerNonExclusive(transactionListener: SQLiteTransactionListener) {}
        override fun endTransaction() {}
        override fun setTransactionSuccessful() {}
        override fun inTransaction(): Boolean = false
        override var isDbLockedByCurrentThread: Boolean = false
        override fun yieldIfContendedSafely(): Boolean = false
        override fun yieldIfContendedSafely(sleepAfterYieldDelayMillis: Long): Boolean = false
        override var version: Int = 1
        override val maximumSize: Long = 0L
        override fun setMaximumSize(numBytes: Long): Long = numBytes
        override var pageSize: Long = 4096L
        override fun insert(table: String, conflictAlgorithm: Int, values: ContentValues): Long = 0L
        override fun delete(table: String, whereClause: String?, whereArgs: Array<out Any?>?): Int = 0
        override fun update(table: String, conflictAlgorithm: Int, values: ContentValues, whereClause: String?, whereArgs: Array<out Any?>?): Int = 0
        override val isReadOnly: Boolean = false
        override val isOpen: Boolean = true
        override fun needUpgrade(newVersion: Int): Boolean = false
        override val path: String? = "test.db"
        override fun setLocale(locale: Locale) {}
        override fun setMaxSqlCacheSize(cacheSize: Int) {}
        override fun setForeignKeyConstraintsEnabled(enabled: Boolean) {}
        override fun enableWriteAheadLogging(): Boolean = true
        override fun disableWriteAheadLogging() {}
        override val isWriteAheadLoggingEnabled: Boolean = false
        override val attachedDbs: List<android.util.Pair<String, String>>? = null
        override val isDatabaseIntegrityOk: Boolean = true
        override fun close() {}
    }

    private class SimpleRowsCursor(
        private val cols: List<String>,
        private val rows: List<Array<Any?>>
    ) : Cursor {
        private var pos = -1
        private var closed = false
        private val colNames = cols.toTypedArray()

        override fun getCount(): Int = rows.size
        override fun getPosition(): Int = pos
        override fun move(offset: Int): Boolean = moveToPosition(pos + offset)
        override fun moveToPosition(position: Int): Boolean {
            if (position < 0 || position >= rows.size) {
                pos = if (position < 0) -1 else rows.size
                return false
            }
            pos = position
            return true
        }
        override fun moveToFirst(): Boolean = moveToPosition(0)
        override fun moveToLast(): Boolean = moveToPosition(rows.size - 1)
        override fun moveToNext(): Boolean = moveToPosition(pos + 1)
        override fun moveToPrevious(): Boolean = moveToPosition(pos - 1)
        override fun isFirst(): Boolean = pos == 0 && rows.isNotEmpty()
        override fun isLast(): Boolean = pos == rows.size - 1 && rows.isNotEmpty()
        override fun isBeforeFirst(): Boolean = pos < 0 || rows.isEmpty()
        override fun isAfterLast(): Boolean = pos >= rows.size || rows.isEmpty()
        override fun getColumnIndex(columnName: String?): Int = cols.indexOf(columnName)
        override fun getColumnIndexOrThrow(columnName: String?): Int {
            val idx = getColumnIndex(columnName)
            if (idx < 0) throw IllegalArgumentException("Column $columnName not found")
            return idx
        }
        override fun getColumnName(columnIndex: Int): String = cols[columnIndex]
        override fun getColumnNames(): Array<String> = colNames
        override fun getColumnCount(): Int = cols.size
        override fun getBlob(columnIndex: Int): ByteArray = ByteArray(0)
        override fun getString(columnIndex: Int): String? = rows[pos][columnIndex]?.toString()
        override fun copyStringToBuffer(columnIndex: Int, buffer: CharArrayBuffer?) {}
        override fun getShort(columnIndex: Int): Short = (rows[pos][columnIndex] as Number).toShort()
        override fun getInt(columnIndex: Int): Int = (rows[pos][columnIndex] as Number).toInt()
        override fun getLong(columnIndex: Int): Long = (rows[pos][columnIndex] as Number).toLong()
        override fun getFloat(columnIndex: Int): Float = (rows[pos][columnIndex] as Number).toFloat()
        override fun getDouble(columnIndex: Int): Double = (rows[pos][columnIndex] as Number).toDouble()
        override fun getType(columnIndex: Int): Int = when (rows[pos][columnIndex]) {
            null -> Cursor.FIELD_TYPE_NULL
            is Int, is Long, is Short -> Cursor.FIELD_TYPE_INTEGER
            is Float, is Double -> Cursor.FIELD_TYPE_FLOAT
            is ByteArray -> Cursor.FIELD_TYPE_BLOB
            else -> Cursor.FIELD_TYPE_STRING
        }
        override fun isNull(columnIndex: Int): Boolean = rows[pos][columnIndex] == null
        @Deprecated("Deprecated in Java")
        override fun deactivate() {}
        @Deprecated("Deprecated in Java")
        override fun requery(): Boolean = true
        override fun close() { closed = true }
        override fun isClosed(): Boolean = closed
        override fun registerContentObserver(observer: ContentObserver?) {}
        override fun unregisterContentObserver(observer: ContentObserver?) {}
        override fun registerDataSetObserver(observer: DataSetObserver?) {}
        override fun unregisterDataSetObserver(observer: DataSetObserver?) {}
        override fun setNotificationUri(cr: ContentResolver?, uri: Uri?) {}
        override fun getNotificationUri(): Uri? = null
        override fun getWantsAllOnMoveCalls(): Boolean = false
        override fun setExtras(extras: Bundle?) {}
        override fun getExtras(): Bundle = throw UnsupportedOperationException()
        override fun respond(extras: Bundle?): Bundle = throw UnsupportedOperationException()
    }
}
