package com.hejitech.headway.core

import com.hejitech.headway.core.model.*
import com.hejitech.headway.core.sync.WatchSyncState
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class ModelsTest {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }

    @Test
    fun testStationList() {
        assertEquals(31, CaltrainStations.ALL.size)
        val sf = CaltrainStations.findById("san_francisco")
        assertNotNull(sf)
        assertEquals("San Francisco", sf?.name)
        assertEquals("SF", sf?.short)

        val mtv = CaltrainStations.findByShort("MTN VIEW")
        assertNotNull(mtv)
        assertEquals("mountain_view", mtv?.id)
    }

    @Test
    fun testBoardSerialization() {
        val board = Board(
            from = StationRef("mountain_view", "Mountain View", "MTN VIEW"),
            to = StationRef("san_francisco", "San Francisco", "SF"),
            leg = "morning",
            live = true,
            trains = listOf(
                BoardTrain(
                    tripId = "101",
                    train = "101",
                    kind = "LOC",
                    dir = "N",
                    serviceDate = "2026-10-26",
                    dep = 1729950000000.0,
                    arr = 1729954000000.0,
                    predDep = 1729950120000.0,
                    predArr = 1729954120000.0,
                    delayMin = 2,
                    status = TrainStatus.LATE,
                    stopsBetween = 15
                )
            ),
            alerts = listOf(
                ServiceAlert(id = "alert1", header = "Track maintenance at Millbrae")
            )
        )

        val encoded = json.encodeToString(board)
        val decoded = json.decodeFromString<Board>(encoded)

        assertEquals("mountain_view", decoded.from.id)
        assertEquals(1, decoded.trains.size)
        assertEquals(TrainStatus.LATE, decoded.trains[0].status)
        assertEquals(2, decoded.trains[0].delayMin)
        assertEquals(false, decoded.trains[0].isExpress)
    }

    @Test
    fun testWatchSyncStateEncoding() {
        val state = WatchSyncState(
            hasCommute = true,
            expressPreference = ExpressPreference.PREFER_EXPRESS,
            stations = CaltrainStations.ALL.take(2)
        )
        val encodedBytes = state.encode()
        val decoded = WatchSyncState.decode(encodedBytes)

        assertNotNull(decoded)
        assertEquals(true, decoded?.hasCommute)
        assertEquals(ExpressPreference.PREFER_EXPRESS, decoded?.expressPreference)
        assertEquals(2, decoded?.stations?.size)
    }

    @Test
    fun `settings from before the new choices get defaults, and they round-trip`() {
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }
        val old = json.decodeFromString<Settings>("""{"switch_at":"12:00","days":[0],"alerts":{"delay":true,"delay_threshold":5,"cancellation":true,"service":true,"leave_now":true,"arrival":true,"arrival_minutes":5}}""")
        assertEquals(OnTrainMode.CARD, old.onTrain)
        assertEquals(AlertScope.PRIORITY, old.alerts.scope)
        val next = old.copy(onTrain = OnTrainMode.BACKGROUND, alerts = old.alerts.copy(scope = AlertScope.ALL), shareName = "Sam")
        assertEquals(next, json.decodeFromString<Settings>(json.encodeToString(Settings.serializer(), next)))
    }

    @Test
    fun `decodes the on-train card and says when a train is past due`() {
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; coerceInputValues = true }
        val b = json.decodeFromString<MyBoard>("""{"has_commute":true,"on_train":{"trip_id":"t","service_date":"20261106","confidence":"high","train":"513","kind":"EXP","dir":"N","from":{"id":"a","name":"A","short":"A"},"to":{"id":"b","name":"B","short":"B"},"to_source":"commute","pred_arr":5,"arr":5,"stops":[{"id":"b","name":"B","short":"B","pred":5,"status":"now"}]}}""")
        assertEquals("513", b.onTrain?.train)
        assertEquals("Express", b.onTrain?.kindName)
        val t = BoardTrain(tripId = "t", train = "513", kind = "EXP", dir = "N", serviceDate = "x", dep = 1_000_000.0, arr = 2_000_000.0, predDep = 1_000_000.0, predArr = 2_000_000.0, status = TrainStatus.SCHEDULED, pastDue = true)
        assertEquals("Due", t.dueLabel(1_060_000))
        assertEquals("May have left", t.dueLabel(1_200_000))
    }

    @Test
    fun `decodes a commute board with leave-by, badges, a tip, a travel estimate and a finished leg`() {
        val raw = """{"board":{"from":{"id":"mountain_view","name":"Mountain View","short":"MTN VIEW"},"to":{"id":"san_francisco","name":"San Francisco","short":"SF"},
            "leg":"morning","generated_at":1,"live":true,"walk_minutes":10,
            "tip":{"wait_for":"511","wait_for_kind":"EXP","wait_for_dep":3,"wait_for_arr":9,"instead_of":"113","instead_of_arr":12,"saves_min":4},
            "travel":{"mode":"ebike","distance_m":2400,"minutes":9},
            "trains":[{"trip_id":"409","train":"409","kind":"LTD","dir":"N","service_date":"2026-11-10","dep":1,"arr":5,"pred_dep":2,"pred_arr":6,"status":"late","delay_min":3,
              "stops_between":10,"leave_by":1.5,"catch":"leave","buffer_min":4,"ride_min":52,"first_in":true,"overtaken_by":"511x","overtaken_by_train":"511"}],
            "alerts":[]},
            "has_commute":true,"saved":true,
            "tracked":{"trip_id":"409","service_date":"2026-11-10","from":"mountain_view","to":"san_francisco",
              "progress":{"trip_id":"409","train":"409","kind":"LTD","service_date":"2026-11-10","to":{"id":"san_francisco","name":"San Francisco","short":"SF"},"pred_arr":6,"arr":5,"stops_left":3,"departed":true}},
            "commute_done":{"part":"morning","to":{"id":"san_francisco","name":"San Francisco","short":"SF"},"at":7,"until":8}}"""
        val my = json.decodeFromString<MyBoard>(raw)
        val board = my.board!!
        assertEquals(10, board.walkMinutes)
        assertEquals("511", board.tip?.waitFor)
        assertEquals(TravelMode.EBIKE, board.travel?.travelMode)
        val t = board.trains.single()
        assertEquals("leave", t.catchState)
        assertEquals(1.5, t.leaveBy!!, 0.0)
        assertEquals(true, t.firstIn)
        assertNull(t.shortest)
        assertEquals("511", t.overtakenByTrain)
        assertTrue(my.tracked!!.progress.riding)
        assertEquals("morning", my.commuteDone?.part)
        // An unknown travel mode from a newer server reads as walking rather than failing.
        assertEquals(TravelMode.WALK, TravelMode.of("hoverboard"))
    }

    @Test
    fun `a leg is sent whole, with a cleared usual train as null`() {
        val leg = Leg.morning("mountain_view", "san_francisco").copy(travelMode = TravelMode.DRIVE.value)
        val out = json.encodeToString(Settings(morning = leg))
        assertTrue(out.contains("\"usual\":null"))
        assertTrue(out.contains("\"evening\":null"))
        assertTrue(out.contains("\"travel_mode\":\"drive\""))
    }
}
