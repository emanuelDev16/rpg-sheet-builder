package com.gridsheet.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.gridsheet.app.ui.GridSheetApp
import com.gridsheet.app.ui.theme.GridSheetTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GridSheetTheme {
                GridSheetApp()
            }
        }
    }
}
