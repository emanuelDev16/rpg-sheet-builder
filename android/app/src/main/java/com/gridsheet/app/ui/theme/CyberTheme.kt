package com.gridsheet.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object CyberColors {
    val BgCanvas = Color(0xFFF8F1E7)       // Soft Cream
    val BgCard = Color(0xFFFFFDF9)
    val BgCardAlt = Color(0xFFF3E9DB)
    val BgHeaderStrip = Color(0xFFEFE3D2)
    val BgInput = Color(0xFFF8F1E7)
    val BgHover = Color(0xFFEAE0D0)

    val BorderInk = Color(0xFF0B0B0B)      // Deep Black
    val BorderSubtle = Color(0xFFDFD2C0)

    val InkPrimary = Color(0xFF0B0B0B)
    val InkSecondary = Color(0xFF3D332D)
    val InkMuted = Color(0xFF6E6258)
    val InkInverse = Color(0xFFF8F1E7)

    val AccentBlack = Color(0xFF0B0B0B)
    val AccentWine = Color(0xFF5B0F18)     // Burgundy Wine
    val AccentWineHover = Color(0xFF731621)
    val AccentWineSoft = Color(0xFFE9D7D6)
    val AccentCreamBadge = Color(0xFFEFE3D2)
    val AccentDanger = Color(0xFFB91C1C)
    val AccentDangerSoft = Color(0xFFFEE2E2)
}

object CyberDimens {
    val BorderWidth = 1.5.dp
    val BorderStrong = 2.dp
    val CardRadius = 10.dp
    val ControlRadius = 6.dp
    val SmallRadius = 4.dp
}

private val LightColorScheme = lightColorScheme(
    primary = CyberColors.AccentWine,
    onPrimary = CyberColors.InkInverse,
    secondary = CyberColors.AccentBlack,
    onSecondary = CyberColors.InkInverse,
    background = CyberColors.BgCanvas,
    onBackground = CyberColors.InkPrimary,
    surface = CyberColors.BgCard,
    onSurface = CyberColors.InkPrimary,
    error = CyberColors.AccentDanger,
    onError = CyberColors.InkInverse
)

private val CyberTypography = Typography(
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Black,
        fontSize = 18.sp,
        letterSpacing = 0.5.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 15.sp,
        letterSpacing = 0.4.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        letterSpacing = 0.6.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 13.sp
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 11.sp
    )
)

@Composable
fun GridSheetTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = CyberTypography,
        content = content
    )
}
