package com.gridsheet.app.data

import android.content.Context
import android.webkit.JavascriptInterface
import com.gridsheet.app.core.WorkspaceState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * JavascriptInterface bridge ("AndroidRoomBridge") allowing App.tsx inside an
 * Android WebView to mirror workspace state directly into the local Room DB.
 */
class RoomSyncBridge(context: Context) {
    private val roomRepo = RoomWorkspaceRepository(context.applicationContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @JavascriptInterface
    fun syncWorkspace(workspaceJson: String, updatedAtMillis: Long) {
        val parsed = runCatching {
            roomRepo.json.decodeFromString(WorkspaceState.serializer(), workspaceJson)
        }.getOrNull() ?: return

        val ts = if (updatedAtMillis > 0L) updatedAtMillis else System.currentTimeMillis()
        scope.launch {
            roomRepo.mirrorWorkspaceIntoRoom(
                workspace = parsed,
                updatedAtMillis = ts,
                syncState = "MIRRORED"
            )
        }
    }

    @JavascriptInterface
    fun loadWorkspace(): String? = runBlocking(Dispatchers.IO) {
        val (ws, _) = roomRepo.loadWorkspaceFromRoom()
        ws?.let { roomRepo.json.encodeToString(WorkspaceState.serializer(), it) }
    }
}
