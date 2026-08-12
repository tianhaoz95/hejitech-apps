package com.hejitech.contempo.ui.entrydetail

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.hejitech.core.model.Entry
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.CopyrightOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

private data class MapPoint(val lat: Double, val lng: Double, val label: String? = null)

private const val MAP_HEIGHT_DP = 180
private const val SINGLE_POINT_ZOOM = 15.0
private const val BOUNDING_BOX_PADDING_PX = 80

/**
 * Non-interactive OpenStreetMap thumbnail on the Entry Detail screen — a
 * single pin for a captured location, or a start/end pin pair with a
 * straight connecting line for a GPS-tracked trip. Renders nothing if the
 * entry has no usable coordinates (most entries, and every odometer-photo
 * trip, which carries no location data at all).
 *
 * The trip "route" is a straight line, not the literal road driven —
 * MileageTrackingService/MileageTracker only ever persist the trip's start
 * and end fix, not a breadcrumb trail (see their kdoc on why: continuous
 * distance accumulation doesn't need to keep individual points around).
 */
@Composable
fun EntryLocationMap(entry: Entry) {
    val tripPoints = if (entry.isTrip) {
        listOfNotNull(
            latLngOrNull(entry.tripStartLat, entry.tripStartLng, "Start"),
            latLngOrNull(entry.tripEndLat, entry.tripEndLng, "End"),
        )
    } else {
        emptyList()
    }
    val points = tripPoints.ifEmpty { capturedLocationPoints(entry) }
    if (points.isEmpty()) return

    MiniMap(points = points, drawRoute = tripPoints.size == 2)
}

private fun latLngOrNull(lat: Double?, lng: Double?, label: String): MapPoint? =
    if (lat != null && lng != null) MapPoint(lat, lng, label) else null

private fun capturedLocationPoints(entry: Entry): List<MapPoint> {
    val points = mutableListOf<MapPoint>()
    val captureLat = entry.captureLat
    val captureLng = entry.captureLng
    if (captureLat != null && captureLng != null) points += MapPoint(captureLat, captureLng)
    val stopLat = entry.stopLat
    val stopLng = entry.stopLng
    if (stopLat != null && stopLng != null && (stopLat != captureLat || stopLng != captureLng)) {
        points += MapPoint(stopLat, stopLng)
    }
    return points
}

@Composable
private fun MiniMap(points: List<MapPoint>, drawRoute: Boolean) {
    val context = LocalContext.current
    val routeColor = MaterialTheme.colorScheme.primary.toArgb()
    AndroidView(
        modifier = Modifier
            .fillMaxWidth()
            .height(MAP_HEIGHT_DP.dp)
            .padding(vertical = 8.dp)
            .clip(RoundedCornerShape(12.dp)),
        factory = {
            MapView(context).apply {
                setTileSource(TileSourceFactory.MAPNIK)
                setMultiTouchControls(false)
                // A static thumbnail, not a full interactive map — swallow
                // touches so a finger landing on it pans the map instead of
                // scrolling the Entry Detail screen underneath it.
                setOnTouchListener { _, _ -> true }
                overlays.add(CopyrightOverlay(context))
            }
        },
        update = { mapView ->
            mapView.overlays.removeAll { it is Marker || it is Polyline }
            val geoPoints = points.map { GeoPoint(it.lat, it.lng) }
            geoPoints.forEachIndexed { index, geoPoint ->
                mapView.overlays.add(
                    Marker(mapView).apply {
                        position = geoPoint
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                        title = points[index].label
                    },
                )
            }
            if (drawRoute && geoPoints.size == 2) {
                mapView.overlays.add(
                    Polyline(mapView).apply {
                        setPoints(geoPoints)
                        outlinePaint.color = routeColor
                        outlinePaint.strokeWidth = 8f
                    },
                )
            }
            if (geoPoints.size == 1) {
                mapView.controller.setZoom(SINGLE_POINT_ZOOM)
                mapView.controller.setCenter(geoPoints.first())
            } else {
                val box = BoundingBox.fromGeoPoints(geoPoints)
                mapView.post { mapView.zoomToBoundingBox(box, false, BOUNDING_BOX_PADDING_PX) }
            }
            mapView.invalidate()
        },
        onRelease = { mapView -> mapView.onDetach() },
    )
}
