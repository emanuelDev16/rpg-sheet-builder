# GRID//SHEET — Android (Kotlin + Jetpack Compose)

Port nativo em **Kotlin + Jetpack Compose** da ficha agnóstica de RPG **GRID//SHEET**, mantendo a identidade **Cyber-Brutalism** (`Burgundy Wine #5B0F18` + `Soft Cream #F8F1E7` + `Deep Black #0B0B0B`), alternância de sistemas (`WOD`, `D&D 5E`, `CYBERPUNK`, `GENÉRICO`, `CUSTOM`), motor de fórmulas e dados (`pool(...)`, `Nd10@6`, `1d20 + mod`), monitor de XP com upgrades dinâmicos e persistência local por sistema em `SharedPreferences`.

## Como gerar o `.apk`

1. Abra a pasta `/android` no **Android Studio** (Ladybug ou superior, JDK 17).
2. Aguarde a sincronização do Gradle (`Gradle Sync`).
3. No menu superior, selecione **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. Ou via terminal dentro de `/android`:
   ```bash
   ./gradlew assembleDebug
   ```
   O arquivo gerado ficará em:
   `android/app/build/outputs/apk/debug/app-debug.apk`
