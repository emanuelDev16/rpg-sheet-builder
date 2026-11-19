package com.gridsheet.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.gridsheet.app.core.SheetTransfer
import com.gridsheet.app.data.local.GridSheetDatabase
import com.gridsheet.app.ui.GridSheetApp
import com.gridsheet.app.ui.SheetViewModel
import com.gridsheet.app.ui.theme.GridSheetTheme
import com.gridsheet.app.ui.theme.GridThemeMode
import com.gridsheet.app.ui.theme.LocalGridTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        CrashRecoveryManager.install(applicationContext)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val initialCrashLog = CrashRecoveryManager.readLastCrashLog(this)
        val initialTheme = GridThemeMode.fromStorageKey(CrashRecoveryManager.readStoredThemeKey(this))

        setContent {
            var crashLog by remember { mutableStateOf(initialCrashLog) }

            LaunchedEffect(Unit) {
                if (crashLog == null) {
                    val bootCheck = withContext(Dispatchers.IO) {
                        runCatching {
                            GridSheetDatabase.getInstance(applicationContext).openHelper.readableDatabase
                        }
                    }
                    bootCheck.exceptionOrNull()?.let { err ->
                        CrashRecoveryManager.writeCrashLog(filesDir, "boot-db", err)
                        crashLog = CrashRecoveryManager.readLastCrashLog(filesDir)
                            ?: "Erro ao abrir banco local: ${err.message ?: err::class.java.simpleName}"
                    }
                }
            }

            if (crashLog != null) {
                GridSheetTheme(themeMode = initialTheme) {
                    CrashRecoveryScreen(
                        crashReport = crashLog!!,
                        onDismissAndContinue = {
                            CrashRecoveryManager.clearLastCrashLog(applicationContext)
                            crashLog = null
                        }
                    )
                }
            } else {
                val vm: SheetViewModel = viewModel()
                val themeMode by vm.themeMode.collectAsState()
                GridSheetTheme(themeMode = themeMode) {
                    GridSheetApp(vm = vm)
                }
            }
        }
    }
}

@Composable
private fun CrashRecoveryScreen(
    crashReport: String,
    onDismissAndContinue: () -> Unit
) {
    val theme = LocalGridTheme.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exportStatus by remember { mutableStateOf<String?>(null) }

    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val payload = CrashRecoveryManager.collectEmergencyExportJson(context.applicationContext)
                    context.contentResolver.openOutputStream(uri)?.use { out ->
                        out.write(payload.toByteArray(Charsets.UTF_8))
                        out.flush()
                    } ?: error("Não foi possível abrir o arquivo de destino.")
                }
            }
            exportStatus = if (result.isSuccess) {
                "OK: Backup JSON exportado com segurança."
            } else {
                "ERRO: ${result.exceptionOrNull()?.message ?: "Falha ao exportar."}"
            }
        }
    }

    Surface(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding(),
        color = theme.bgBase
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "// RECUPERAÇÃO DE FALHA CRÍTICA",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = theme.accentDanger
            )
            Text(
                text = "Foi detectado um encerramento inesperado na execução anterior. Exporte suas fichas em JSON antes de tentar reiniciar o workspace.",
                fontSize = 13.sp,
                color = theme.textPrimary
            )

            if (!exportStatus.isNullOrBlank()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = theme.bgStrip,
                    border = BorderStroke(1.5.dp, theme.borderColor)
                ) {
                    Text(
                        text = exportStatus!!,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = theme.textPrimary,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                color = theme.bgCard,
                border = BorderStroke(theme.borderWidth, theme.borderColor)
            ) {
                Text(
                    text = crashReport,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = theme.textSecondary,
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(10.dp)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { exportLauncher.launch(SheetTransfer.backupFileName()) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = theme.accentPrimary,
                        contentColor = theme.accentContrast
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "EXPORTAR FICHAS (.JSON)",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                }
                OutlinedButton(
                    onClick = onDismissAndContinue,
                    border = BorderStroke(1.5.dp, theme.borderColor),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "TENTAR CONTINUAR",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = theme.textPrimary
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
        }
    }
}
