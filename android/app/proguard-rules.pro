-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable

# App domain models, presets, sync & crash recovery
-keep class com.gridsheet.app.core.** { *; }
-keepclassmembers class com.gridsheet.app.core.** { *; }
-keep class com.gridsheet.app.core.SheetModelsKt { *; }
-keep class com.gridsheet.app.core.PresetsKt { *; }
-keep class com.gridsheet.app.core.SheetExportEnvelope { *; }
-keep class com.gridsheet.app.data.** { *; }
-keepclassmembers class com.gridsheet.app.data.** { *; }
-keep class com.gridsheet.app.data.RoomSyncBridge { *; }
-keep class com.gridsheet.app.data.WorkspaceSyncEngine { *; }
-keep class com.gridsheet.app.data.RemoteWorkspaceMirrorDto { *; }
-keep class com.gridsheet.app.CrashRecoveryManager { *; }
-keep class com.gridsheet.app.GridSheetApplication { *; }

# kotlinx.serialization
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keepclasseswithmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
-if @kotlinx.serialization.Serializable class **
-keep class <1> { *; }
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class ** {
    static **$Companion Companion;
}
-keepclassmembers class <1>$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keep class <1>$$serializer { *; }

# Room entities, DAOs, database & generated *_Impl
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class com.gridsheet.app.data.local.** { *; }
-keep @androidx.room.Entity class ** { *; }
-keep @androidx.room.Dao class ** { *; }
-keep @androidx.room.Dao interface ** { *; }
-keep class **Dao_Impl* { *; }
-keep class **Database_Impl* { *; }

# WebView / JS bridges
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# PdfBox-Android
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-keep class com.tom_roush.harmony.** { *; }
-dontwarn com.tom_roush.pdfbox.**
-dontwarn com.tom_roush.fontbox.**
-dontwarn com.tom_roush.harmony.**
-dontwarn org.bouncycastle.**
