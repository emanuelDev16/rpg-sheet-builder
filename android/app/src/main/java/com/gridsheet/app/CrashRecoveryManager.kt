package com.gridsheet.app

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.gridsheet.app.core.CharacterSheetState
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.core.WorkspaceState
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean

object CrashRecoveryManager {
    const val LAST_CRASH_FILE_NAME = "last_crash.log"
    private const val PREFS_NAME = "grid_sheet_prefs"
    private const val WORKSPACE_KEY = "grid_sheet_workspace_v2"
    private const val THEME_MODE_KEY = "grid_sheet_theme_mode"
    private const val DB_NAME = "gridsheet_offline.db"

    private val installed = AtomicBoolean(false)

    @Volatile
    private var previousHandler: Thread.UncaughtExceptionHandler? = null

    fun install(context: Context) {
        if (!installed.compareAndSet(false, true)) return
        val appContext = context.applicationContext
        val existing = Thread.getDefaultUncaughtExceptionHandler()
        previousHandler = existing
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                writeCrashLog(appContext.filesDir, thread.name, throwable)
            }
            existing?.uncaughtException(thread, throwable)
        }
    }

    fun writeCrashLog(
        baseDir: File,
        threadName: String,
        throwable: Throwable,
        nowIso: String = Instant.now().toString()
    ): File {
        if (!baseDir.exists()) baseDir.mkdirs()
        val logFile = File(baseDir, LAST_CRASH_FILE_NAME)
        val stack = StringWriter().also { sw ->
            PrintWriter(sw).use { pw -> throwable.printStackTrace(pw) }
        }.toString()
        val report = buildString {
            appendLine("=== GRIDSHEET CRASH REPORT ===")
            appendLine("timestamp: $nowIso")
            appendLine("thread: $threadName")
            appendLine("exception: ${throwable::class.java.name}: ${throwable.message ?: "(sem mensagem)"}")
            appendLine()
            append(stack)
        }
        logFile.writeText(report, Charsets.UTF_8)
        return logFile
    }

    fun readLastCrashLog(baseDir: File): String? {
        val file = File(baseDir, LAST_CRASH_FILE_NAME)
        if (!file.isFile) return null
        return runCatching { file.readText(Charsets.UTF_8) }.getOrNull()?.takeIf { it.isNotBlank() }
    }

    fun readLastCrashLog(context: Context): String? = readLastCrashLog(context.filesDir)

    fun clearLastCrashLog(baseDir: File) {
        runCatching {
            val file = File(baseDir, LAST_CRASH_FILE_NAME)
            if (file.exists()) file.delete()
        }
    }

    fun clearLastCrashLog(context: Context) = clearLastCrashLog(context.filesDir)

    fun readStoredThemeKey(context: Context): String? = runCatching {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(THEME_MODE_KEY, null)
    }.getOrNull()

    /**
     * Collects all persisted character sheets using raw SQLite and SharedPreferences fallback
     * so emergency JSON backup succeeds even when Room initialization or migrations fail.
     */
    fun collectEmergencyExportJson(context: Context): String {
        val nowIso = Instant.now().toString()
        val decodedById = LinkedHashMap<String, CharacterSheetState>()
        val rawFallbackBlobs = mutableListOf<String>()

        val dbFile = context.getDatabasePath(DB_NAME)
        if (dbFile.exists() && dbFile.isFile) {
            runCatching {
                SQLiteDatabase.openDatabase(
                    dbFile.absolutePath,
                    null,
                    SQLiteDatabase.OPEN_READONLY or SQLiteDatabase.NO_LOCALIZED_COLLATORS
                ).use { sqlDb ->
                    extractSheetsFromTable(sqlDb, "saved_sheets", decodedById, rawFallbackBlobs)
                    if (decodedById.isEmpty() && rawFallbackBlobs.isEmpty()) {
                        extractSheetsFromTable(sqlDb, "character_sheets", decodedById, rawFallbackBlobs)
                    }
                }
            }
        }

        // Fallback to SharedPreferences workspace snapshot
        runCatching {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val wsRaw = prefs.getString(WORKSPACE_KEY, null)
            if (!wsRaw.isNullOrBlank()) {
                val ws = SheetTransfer.transferJson.decodeFromString(WorkspaceState.serializer(), wsRaw)
                ws.sheetsBySystem.values.forEach { sheet ->
                    decodedById.putIfAbsent(sheet.id, sheet)
                }
            }
        }

        if (decodedById.isNotEmpty()) {
            return runCatching {
                SheetTransfer.encodeEnvelope(decodedById.values.toList(), nowIso)
            }.getOrElse {
                val json = Json { prettyPrint = true; explicitNulls = false }
                json.encodeToString(
                    buildJsonObject {
                        put("app", JsonPrimitive(SheetTransfer.APP_ID))
                        put("schemaVersion", JsonPrimitive(SheetTransfer.SCHEMA_VERSION))
                        put("exportedAt", JsonPrimitive(nowIso))
                        put("sheets", JsonArray(decodedById.values.map {
                            SheetTransfer.transferJson.encodeToJsonElement(CharacterSheetState.serializer(), it)
                        }))
                    }
                )
            }
        }

        val json = Json { prettyPrint = true }
        return json.encodeToString(
            JsonObject.serializer(),
            buildJsonObject {
                put("app", JsonPrimitive(SheetTransfer.APP_ID))
                put("schemaVersion", JsonPrimitive(SheetTransfer.SCHEMA_VERSION))
                put("exportedAt", JsonPrimitive(nowIso))
                put("recoveryMode", JsonPrimitive(true))
                put("rawSheets", buildJsonArray {
                    rawFallbackBlobs.forEach { add(JsonPrimitive(it)) }
                })
            }
        )
    }

    private fun extractSheetsFromTable(
        db: SQLiteDatabase,
        tableName: String,
        decodedById: MutableMap<String, CharacterSheetState>,
        rawFallbackBlobs: MutableList<String>
    ) {
        val hasTable = runCatching {
            db.rawQuery(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                arrayOf(tableName)
            ).use { cursor -> cursor.moveToFirst() }
        }.getOrDefault(false)
        if (!hasTable) return

        runCatching {
            db.rawQuery("SELECT sheetJson FROM `$tableName`", null).use { cursor ->
                while (cursor.moveToNext()) {
                    val raw = cursor.getString(0) ?: continue
                    val decoded = runCatching {
                        SheetTransfer.transferJson.decodeFromString(CharacterSheetState.serializer(), raw)
                    }.getOrNull()
                    if (decoded != null) {
                        decodedById.putIfAbsent(decoded.id, decoded)
                    } else if (raw.isNotBlank()) {
                        rawFallbackBlobs += raw
                    }
                }
            }
        }
    }
}
