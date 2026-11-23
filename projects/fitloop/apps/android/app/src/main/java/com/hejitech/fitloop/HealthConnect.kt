package com.hejitech.fitloop

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.hejitech.fitloop.core.Vital
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import kotlin.math.roundToLong

/**
 * Health Connect, the Android side of what the iPhone app does with Health: the daily summary
 * (weight, resting heart rate, HRV, sleep, steps, active energy sent as `health` vitals, only when
 * that option is on) and finished workouts saved as exercise sessions. Asks for its own permissions;
 * everything here is a no-op without them.
 */
class HealthConnect(private val context: Context) {
    val available: Boolean get() = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun granted(): Set<String> = if (available) client.permissionController.getGrantedPermissions() else emptySet()
    suspend fun canRead(): Boolean = granted().containsAll(READ)
    suspend fun canWriteWorkouts(): Boolean = WRITE_WORKOUT in granted()

    /** One value per metric and day for the last [days] days (local calendar). */
    suspend fun dailySummary(days: Int, zone: ZoneId = ZoneId.systemDefault()): List<Vital> {
        val have = granted()
        if (have.isEmpty()) return emptyList()
        val first = LocalDate.now(zone).minusDays((days - 1).toLong())
        val start = first.atStartOfDay()
        val end = LocalDateTime.now(zone)
        val out = mutableListOf<Vital>()
        fun add(day: LocalDate, metric: String, value: Double?) {
            if (value != null && value > 0) out += Vital(day.toString(), metric, (value * 10).roundToLong() / 10.0, "health")
        }
        val wanted = buildSet {
            if (HealthPermission.getReadPermission(StepsRecord::class) in have) add(StepsRecord.COUNT_TOTAL)
            if (HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class) in have) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
            if (HealthPermission.getReadPermission(WeightRecord::class) in have) add(WeightRecord.WEIGHT_AVG)
            if (HealthPermission.getReadPermission(RestingHeartRateRecord::class) in have) add(RestingHeartRateRecord.BPM_AVG)
        }
        if (wanted.isNotEmpty()) {
            for (g in client.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(wanted, TimeRangeFilter.between(start, end), Period.ofDays(1)))) {
                val day = g.startTime.toLocalDate()
                add(day, "steps", g.result[StepsRecord.COUNT_TOTAL]?.toDouble())
                add(day, "active_energy", g.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories)
                add(day, "weight", g.result[WeightRecord.WEIGHT_AVG]?.inKilograms)
                add(day, "resting_hr", g.result[RestingHeartRateRecord.BPM_AVG]?.toDouble())
            }
        }
        val range = TimeRangeFilter.between(start.atZone(zone).toInstant(), end.atZone(zone).toInstant())
        if (HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class) in have) {
            client.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, range)).records
                .groupBy { it.time.atZone(zone).toLocalDate() }
                .forEach { (day, rs) -> add(day, "hrv", rs.map { it.heartRateVariabilityMillis }.average()) }
        }
        if (HealthPermission.getReadPermission(SleepSessionRecord::class) in have) {
            // Hours asleep per night (awake stages left out), credited to the day the night ends.
            val awake = setOf(SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED)
            client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records
                .groupBy { it.endTime.atZone(zone).toLocalDate() }
                .forEach { (day, rs) ->
                    val seconds = rs.sumOf { r ->
                        val total = r.endTime.epochSecond - r.startTime.epochSecond
                        total - r.stages.filter { it.stage in awake }.sumOf { it.endTime.epochSecond - it.startTime.epochSecond }
                    }
                    add(day, "sleep_hours", seconds / 3600.0)
                }
        }
        return out
    }

    /** A finished FitLoop workout as an exercise session (its kind, title and time). */
    suspend fun saveWorkout(kind: String, title: String, ref: String, date: String, start: Instant, end: Instant): Boolean {
        if (!available || !canWriteWorkouts() || end.epochSecond - start.epochSecond < 60) return false
        val offset = ZoneId.systemDefault().rules.getOffset(start)
        val record = ExerciseSessionRecord(
            startTime = start, startZoneOffset = offset, endTime = end, endZoneOffset = ZoneId.systemDefault().rules.getOffset(end),
            exerciseType = exerciseType(kind), title = title,
            // The same workout saved twice (a retry) replaces itself.
            metadata = Metadata.activelyRecorded(device = Device(type = Device.TYPE_PHONE), clientRecordId = "fitloop:$date:$ref"),
        )
        return runCatching { client.insertRecords(listOf(record)) }.isSuccess
    }

    companion object {
        val READ = setOf(
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        )
        val WRITE_WORKOUT = HealthPermission.getWritePermission(ExerciseSessionRecord::class)

        fun permissionContract() = PermissionController.createRequestPermissionResultContract()

        /** The plan's workout kind as a Health Connect exercise type. */
        fun exerciseType(kind: String): Int = when (kind) {
            "strength" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
            "hiit" -> ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
            "mobility" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
            "cardio" -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
            else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
        }
    }
}
