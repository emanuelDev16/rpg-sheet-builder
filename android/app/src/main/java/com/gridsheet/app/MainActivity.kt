package com.gridsheet.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.gridsheet.app.ui.GridSheetApp
import com.gridsheet.app.ui.SheetViewModel
import com.gridsheet.app.ui.theme.GridSheetTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val vm: SheetViewModel = viewModel()
            val themeMode by vm.themeMode.collectAsState()
            GridSheetTheme(themeMode = themeMode) {
                GridSheetApp(vm = vm)
            }
        }
    }
}
