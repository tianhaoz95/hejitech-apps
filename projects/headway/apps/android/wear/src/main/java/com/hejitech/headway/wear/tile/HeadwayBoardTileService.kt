package com.hejitech.headway.wear.tile

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.Layout
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.hejitech.headway.core.model.Clock
import com.hejitech.headway.core.model.TrainStatus
import com.hejitech.headway.wear.MainActivity
import com.hejitech.headway.wear.sync.WearStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.guava.future

private const val RESOURCES_VERSION = "1"
private const val COLOR_CALTRAIN_RED = 0xFFE31837.toInt()
private const val COLOR_ON_SURFACE = 0xFFFFFFFF.toInt()
private const val COLOR_ON_SURFACE_VARIANT = 0xFFAAAAAA.toInt()
private const val COLOR_GREEN = 0xFF4CAF50.toInt()
private const val COLOR_AMBER = 0xFFFF9800.toInt()

class HeadwayBoardTileService : TileService() {
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> = scope.future {
        WearStore.init(applicationContext)
        val state = WearStore.syncState.value
        val board = state?.board
        val nextTrain = board?.trains?.firstOrNull()

        val layout = Layout.Builder().setRoot(buildTileLayout(board, nextTrain)).build()
        TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setTileTimeline(Timeline.fromLayoutElement(layout.root!!))
            .build()
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest
    ): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())

    private fun buildTileLayout(
        board: com.hejitech.headway.core.model.Board?,
        train: com.hejitech.headway.core.model.BoardTrain?
    ): LayoutElementBuilders.LayoutElement {
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

        val routeText = if (board != null) {
            "${board.from.short} → ${board.to.short}"
        } else {
            "Caltrain"
        }

        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(
                Text.Builder(this, routeText)
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .setColor(argb(COLOR_CALTRAIN_RED))
                    .build()
            )

        if (train != null) {
            val depTime = Clock.time(train.predDep)
            val until = Clock.until(train.predDep)
            val delayMin = train.delayMin
            val statusColor = when {
                delayMin != null && delayMin > 0 -> COLOR_AMBER
                train.status == TrainStatus.ON_TIME -> COLOR_GREEN
                else -> COLOR_ON_SURFACE_VARIANT
            }

            val statusText = when {
                delayMin != null && delayMin > 0 -> "+${delayMin}m"
                train.status == TrainStatus.ON_TIME -> "On Time"
                else -> train.status.displayTitle
            }

            column.addContent(
                Text.Builder(this, depTime)
                    .setTypography(Typography.TYPOGRAPHY_DISPLAY2)
                    .setColor(argb(COLOR_ON_SURFACE))
                    .build()
            )
            column.addContent(
                Text.Builder(this, "$until · #$statusText")
                    .setTypography(Typography.TYPOGRAPHY_BODY2)
                    .setColor(argb(statusColor))
                    .build()
            )
            column.addContent(
                Text.Builder(this, "#${train.train} ${train.kindName}")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .setColor(argb(COLOR_ON_SURFACE_VARIANT))
                    .build()
            )
        } else {
            column.addContent(
                Text.Builder(this, "No trains")
                    .setTypography(Typography.TYPOGRAPHY_TITLE2)
                    .setColor(argb(COLOR_ON_SURFACE_VARIANT))
                    .build()
            )
            column.addContent(
                Text.Builder(this, "Tap to open board")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .setColor(argb(COLOR_ON_SURFACE_VARIANT))
                    .build()
            )
        }

        return LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(launchAppClickable)
                    .build()
            )
            .addContent(column.build())
            .build()
    }
}
