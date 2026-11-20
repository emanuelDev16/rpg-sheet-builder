package com.gridsheet.app

import android.app.Application

class GridSheetApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashRecoveryManager.install(this)
    }
}
