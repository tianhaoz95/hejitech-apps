package com.hejitech.wear.tile

import com.hejitech.wear.data.fetchConfirmedHours
import android.app.PendingIntent
import android.content.Intent
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DeviceParametersBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.Layout
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.protolayout.material.layouts.PrimaryLayout
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.hejitech.wear.MainActivity
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.guava.future
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

private const val RESOURCES_VERSION = "1"
private const val QUERY_TIMEOUT_MS = 8_000L
private const val THRESHOLD_HOURS = 100

// Same literal values as the phone app's dark ColorScheme
// (app/.../ui/theme/Color.kt) so the tile reads as the same brand rather than
// an approximation of it: PaperRaisedDark (surface), InkDark/InkSoftDark
// (onSurface / onSurfaceVariant text), PineDark/PaperDark (primary button /
// onPrimary text).
private const val COLOR_SURFACE = 0xFF16201C.toInt()
private const val COLOR_ON_SURFACE = 0xFFECEEE8.toInt()
private const val COLOR_ON_SURFACE_VARIANT = 0xFFA9B3AC.toInt()
private const val COLOR_PRIMARY = 0xFF45A67C.toInt()
private const val COLOR_ON_PRIMARY = 0xFF0E1613.toInt()

// Same corner radius as ContempoShapes.small (app/.../ui/theme/Shapes.kt),
// which is also the exact shape the phone app's primary CTA Button uses
// (CaptureScreen's submit button: `shape = MaterialTheme.shapes.small`) — the
// brand is deliberately blockier than Wear Material's default fully-rounded
// pill chip, not a stadium shape.
private const val BUTTON_CORNER_RADIUS_DP = 4f

/**
 * The swipeable-tile-tray glanceable — a step up from the complication:
 * shows progress toward the 100-hour test and a "Capture" chip that jumps
 * straight into the mic (see MainActivity/WearCaptureScreen), the same
 * one-tap-away pitch as the complication's tap action but with room for a
 * real call to action.
 */
class ProgressTileService : TileService() {
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> = scope.future {
        val hours = confirmedHours()
        val layout = Layout.Builder().setRoot(rootLayout(hours)).build()
        TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setTileTimeline(Timeline.fromLayoutElement(layout.root!!))
            .build()
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())

    private suspend fun confirmedHours(): Double? {
        return withTimeoutOrNull(QUERY_TIMEOUT_MS) { runCatching { fetchConfirmedHours() }.getOrNull() }
    }

    private fun rootLayout(hours: Double?): LayoutElementBuilders.LayoutElement {
        val progressText = if (hours != null) {
            "${hours.toInt()} / $THRESHOLD_HOURS hrs"
        } else {
            "Sign in on the watch"
        }

        val launchAppClickable = ModifiersBuilders.Clickable.Builder()
            .setId("open_app")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName(MainActivity::class.java.name)
                            .build()
                    )
                    .build()
            )
            .build()

        val content = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(
                Text.Builder(this, "Contempo")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .setColor(argb(COLOR_ON_SURFACE_VARIANT))
                    .build()
            )
            .addContent(
                Text.Builder(this, progressText)
                    .setTypography(Typography.TYPOGRAPHY_TITLE3)
                    .setColor(argb(COLOR_ON_SURFACE))
                    .build()
            )
            .build()

        // A hand-built button rather than the material Chip component: Chip's
        // corner radius is hardcoded to height/2 (a full pill), which reads as
        // a generic Wear Material shape rather than this brand's shape — see
        // BUTTON_CORNER_RADIUS_DP above.
        val captureButton = LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(
                        ModifiersBuilders.Clickable.Builder()
                            .setId("capture")
                            .setOnClick(
                                ActionBuilders.LaunchAction.Builder()
                                    .setAndroidActivity(
                                        ActionBuilders.AndroidActivity.Builder()
                                            .setPackageName(packageName)
                                            .setClassName(MainActivity::class.java.name)
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .setBackground(
                        ModifiersBuilders.Background.Builder()
                            .setColor(argb(COLOR_PRIMARY))
                            .setCorner(
                                ModifiersBuilders.Corner.Builder()
                                    .setRadius(DimensionBuilders.dp(BUTTON_CORNER_RADIUS_DP))
                                    .build()
                            )
                            .build()
                    )
                    .setPadding(
                        ModifiersBuilders.Padding.Builder()
                            .setStart(DimensionBuilders.dp(20f))
                            .setEnd(DimensionBuilders.dp(20f))
                            .setTop(DimensionBuilders.dp(10f))
                            .setBottom(DimensionBuilders.dp(10f))
                            .build()
                    )
                    .build()
            )
            .addContent(
                Text.Builder(this, "Capture")
                    .setTypography(Typography.TYPOGRAPHY_BUTTON)
                    .setColor(argb(COLOR_ON_PRIMARY))
                    .build()
            )
            .build()

        val primaryLayout = PrimaryLayout.Builder(deviceParameters())
            .setResponsiveContentInsetEnabled(true)
            .setContent(content)
            .setPrimaryChipContent(captureButton)
            .build()

        // PrimaryLayout.Builder has no background modifier, so the round-screen-safe
        // layout it produces is wrapped in a Box just to paint the tile background.
        return LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(
                        ModifiersBuilders.Background.Builder().setColor(argb(COLOR_SURFACE)).build()
                    )
                    .build()
            )
            .addContent(primaryLayout)
            .build()
    }

    private fun deviceParameters() = DeviceParametersBuilders.DeviceParameters.Builder()
        .setScreenWidthDp(192)
        .setScreenHeightDp(192)
        .build()
}
