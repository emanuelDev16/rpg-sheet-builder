package com.gridsheet.app.ui.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

enum class GridThemeMode(
    val storageKey: String,
    val label: String
) {
    LIGHT(storageKey = "light", label = "CLARO"),
    DARK(storageKey = "dark", label = "ESCURO"),
    EINK(storageKey = "eink", label = "E-INK");

    companion object {
        fun fromStorageKey(raw: String?): GridThemeMode {
            val normalized = raw?.trim()?.uppercase() ?: return LIGHT
            return entries.firstOrNull {
                it.name == normalized || it.storageKey.equals(normalized, ignoreCase = true)
            } ?: LIGHT
        }
    }
}

@Immutable
data class GridThemeTokens(
    val mode: GridThemeMode,
    val bgBase: Color,
    val bgCard: Color,
    val bgStrip: Color,
    val bgInput: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val borderColor: Color,
    val cardCornerRadius: Dp,
    val pillCornerRadius: Dp,
    val cardElevationShadow: Dp,
    val accentPrimary: Color,
    val accentContrast: Color,
    val isEink: Boolean,
    val bgCardAlt: Color,
    val bgHover: Color,
    val textMuted: Color,
    val borderSubtle: Color,
    val borderWidth: Dp,
    val borderStrong: Dp,
    val shadowColor: Color,
    val accentBlack: Color,
    val accentWineSoft: Color,
    val accentCreamBadge: Color,
    val accentDanger: Color,
    val accentDangerSoft: Color,
    val gridLineColor: Color,
    val gridCrossColor: Color
) {
    val isDark: Boolean get() = mode == GridThemeMode.DARK
}

val LightGridThemeTokens = GridThemeTokens(
    mode = GridThemeMode.LIGHT,
    bgBase = Color(0xFFF8F1E7),
    bgCard = Color(0xFFFFFDF9),
    bgStrip = Color(0xFFEFE3D2),
    bgInput = Color(0xFFFFFFFF),
    textPrimary = Color(0xFF0B0B0B),
    textSecondary = Color(0xFF4A433D),
    borderColor = Color(0xFF0B0B0B),
    cardCornerRadius = 4.dp,
    pillCornerRadius = 4.dp,
    cardElevationShadow = 4.dp,
    accentPrimary = Color(0xFF5B0F18),
    accentContrast = Color(0xFFFFFDF9),
    isEink = false,
    bgCardAlt = Color(0xFFF3E9DB),
    bgHover = Color(0xFFEAE0D0),
    textMuted = Color(0xFF574D45),
    borderSubtle = Color(0xFFDFD2C0),
    borderWidth = 2.dp,
    borderStrong = 2.dp,
    shadowColor = Color(0xFF0B0B0B),
    accentBlack = Color(0xFF0B0B0B),
    accentWineSoft = Color(0xFFE9D7D6),
    accentCreamBadge = Color(0xFFEFE3D2),
    accentDanger = Color(0xFFB91C1C),
    accentDangerSoft = Color(0xFFFEE2E2),
    gridLineColor = Color(0xFF0B0B0B).copy(alpha = 0.075f),
    gridCrossColor = Color(0xFF5B0F18).copy(alpha = 0.35f)
)

val DarkGridThemeTokens = GridThemeTokens(
    mode = GridThemeMode.DARK,
    bgBase = Color(0xFF12100E),
    bgCard = Color(0xFF1C1916),
    bgStrip = Color(0xFF28231E),
    bgInput = Color(0xFF141210),
    textPrimary = Color(0xFFF4EFE8),
    textSecondary = Color(0xFFB5ACA2),
    borderColor = Color(0xFFEDE6DC),
    cardCornerRadius = 4.dp,
    pillCornerRadius = 4.dp,
    cardElevationShadow = 4.dp,
    accentPrimary = Color(0xFFD94858),
    accentContrast = Color(0xFF12100E),
    isEink = false,
    bgCardAlt = Color(0xFF24201C),
    bgHover = Color(0xFF322C26),
    textMuted = Color(0xFFA69D93),
    borderSubtle = Color(0xFF3D352E),
    borderWidth = 2.dp,
    borderStrong = 2.dp,
    shadowColor = Color(0xFF000000),
    accentBlack = Color(0xFFEDE6DC),
    accentWineSoft = Color(0xFF3A191D),
    accentCreamBadge = Color(0xFF241E1B),
    accentDanger = Color(0xFFF87171),
    accentDangerSoft = Color(0xFF3B1417),
    gridLineColor = Color(0xFFEDE6DC).copy(alpha = 0.065f),
    gridCrossColor = Color(0xFFD94858).copy(alpha = 0.35f)
)

val EinkGridThemeTokens = GridThemeTokens(
    mode = GridThemeMode.EINK,
    bgBase = Color(0xFFE6E6E6),
    bgCard = Color(0xFFF8F8F8),
    bgStrip = Color(0xFFDCDCDC),
    bgInput = Color(0xFFFFFFFF),
    textPrimary = Color(0xFF1A1A1A),
    textSecondary = Color(0xFF4D4D4D),
    borderColor = Color(0xFF1A1A1A),
    cardCornerRadius = 16.dp,
    pillCornerRadius = 50.dp,
    cardElevationShadow = 0.dp,
    accentPrimary = Color(0xFF1A1A1A),
    accentContrast = Color(0xFFF8F8F8),
    isEink = true,
    bgCardAlt = Color(0xFFEFEFEF),
    bgHover = Color(0xFFCFCFCF),
    textMuted = Color(0xFF4D4D4D),
    borderSubtle = Color(0xFFB8B8B8),
    borderWidth = 2.dp,
    borderStrong = 2.dp,
    shadowColor = Color.Transparent,
    accentBlack = Color(0xFF1A1A1A),
    accentWineSoft = Color(0xFFDCDCDC),
    accentCreamBadge = Color(0xFFEAEAEA),
    accentDanger = Color(0xFF1A1A1A),
    accentDangerSoft = Color(0xFFDCDCDC),
    gridLineColor = Color(0xFF1A1A1A).copy(alpha = 0.085f),
    gridCrossColor = Color(0xFF1A1A1A).copy(alpha = 0.28f)
)

fun themeTokensFor(mode: GridThemeMode): GridThemeTokens = when (mode) {
    GridThemeMode.LIGHT -> LightGridThemeTokens
    GridThemeMode.DARK -> DarkGridThemeTokens
    GridThemeMode.EINK -> EinkGridThemeTokens
}

val LocalGridTheme = staticCompositionLocalOf { LightGridThemeTokens }

/**
 * Draws a crisp, zero-blur hard brutalist offset shadow when [offset] > 0.dp.
 * In E-Ink mode, [offset] is 0.dp and no shadow or offset is added.
 */
fun Modifier.brutalistShadow(
    offset: Dp,
    cornerRadius: Dp,
    color: Color
): Modifier = if (offset <= 0.dp || color == Color.Transparent) {
    this
} else {
    this
        .padding(end = offset, bottom = offset)
        .drawBehind {
            val offsetPx = offset.toPx()
            val radiusPx = cornerRadius.toPx()
            drawRoundRect(
                color = color,
                topLeft = Offset(offsetPx, offsetPx),
                size = size,
                cornerRadius = CornerRadius(radiusPx, radiusPx)
            )
        }
}

object CyberDimens {
    val BorderWidth = 2.dp
    val BorderStrong = 2.dp
    val SmallRadius = 4.dp
    val MinTouchTarget = 48.dp
}

private object NoIndicationNodeFactory : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode =
        object : Modifier.Node(), DrawModifierNode {
            override fun ContentDrawScope.draw() {
                drawContent()
            }
        }

    override fun equals(other: Any?): Boolean = other === this
    override fun hashCode(): Int = System.identityHashCode(this)
}

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

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@Composable
fun GridSheetTheme(
    themeMode: GridThemeMode = GridThemeMode.LIGHT,
    content: @Composable () -> Unit
) {
    val tokens = themeTokensFor(themeMode)
    val colorScheme = if (tokens.isDark) {
        darkColorScheme(
            primary = tokens.accentPrimary,
            onPrimary = tokens.accentContrast,
            secondary = tokens.accentBlack,
            onSecondary = tokens.accentContrast,
            background = tokens.bgBase,
            onBackground = tokens.textPrimary,
            surface = tokens.bgCard,
            onSurface = tokens.textPrimary,
            surfaceVariant = tokens.bgStrip,
            onSurfaceVariant = tokens.textSecondary,
            outline = tokens.borderColor,
            error = tokens.accentDanger,
            onError = tokens.accentContrast
        )
    } else {
        lightColorScheme(
            primary = tokens.accentPrimary,
            onPrimary = tokens.accentContrast,
            secondary = tokens.accentBlack,
            onSecondary = tokens.accentContrast,
            background = tokens.bgBase,
            onBackground = tokens.textPrimary,
            surface = tokens.bgCard,
            onSurface = tokens.textPrimary,
            surfaceVariant = tokens.bgStrip,
            onSurfaceVariant = tokens.textSecondary,
            outline = tokens.borderColor,
            error = tokens.accentDanger,
            onError = tokens.accentContrast
        )
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        LaunchedEffect(tokens.mode) {
            val activity = view.context.findActivity()
            val window = activity?.window
            if (activity is ComponentActivity) {
                val barArgb = tokens.bgBase.toArgb()
                val barStyle = if (tokens.isDark) {
                    SystemBarStyle.dark(barArgb)
                } else {
                    SystemBarStyle.light(barArgb, barArgb)
                }
                activity.enableEdgeToEdge(
                    statusBarStyle = barStyle,
                    navigationBarStyle = barStyle
                )
            }
            if (window != null) {
                WindowCompat.getInsetsController(window, view).apply {
                    isAppearanceLightStatusBars = !tokens.isDark
                    isAppearanceLightNavigationBars = !tokens.isDark
                }
            }
        }
    }

    CompositionLocalProvider(LocalGridTheme provides tokens) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = CyberTypography
        ) {
            if (tokens.isEink) {
                CompositionLocalProvider(LocalIndication provides NoIndicationNodeFactory) {
                    content()
                }
            } else {
                content()
            }
        }
    }
}
