package com.hejitech.fitloop.core

import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Converts canonical metric vitals (kg, cm, L) for display and manual entry according to `settings.units`. */
object UnitFormat {
    private const val LB_PER_KG = 2.2046226218
    private const val CM_PER_IN = 2.54
    private const val FLOZ_PER_L = 33.8140227

    private val names = mapOf(
        "weight" to "Weight",
        "waist" to "Waist",
        "body_fat" to "Body fat",
        "energy" to "Energy",
        "mood" to "Mood",
        "soreness" to "Soreness",
        "sleep_hours" to "Sleep",
        "resting_hr" to "Resting HR",
        "hrv" to "HRV",
        "steps" to "Steps",
        "active_energy" to "Active energy",
    )

    fun unit(metric: String, units: String): String {
        val imperial = units == "imperial"
        return when (metric) {
            "weight" -> if (imperial) "lb" else "kg"
            "waist" -> if (imperial) "in" else "cm"
            "body_fat" -> "%"
            "energy", "mood", "soreness" -> "1-5"
            "sleep_hours" -> "h"
            "resting_hr" -> "bpm"
            "hrv" -> "ms"
            "steps" -> "steps"
            "active_energy" -> "kcal"
            else -> ""
        }
    }

    fun label(metric: String, units: String): String {
        val name = names[metric] ?: metric
        val u = unit(metric, units)
        return if (u.isEmpty()) name else "$name ($u)"
    }

    fun toDisplay(value: Double, metric: String, units: String): Double {
        if (units != "imperial") return value
        return when (metric) {
            "weight" -> round1(value * LB_PER_KG)
            "waist" -> round1(value / CM_PER_IN)
            else -> value
        }
    }

    fun fromDisplay(value: Double, metric: String, units: String): Double {
        if (units != "imperial") return value
        return when (metric) {
            "weight" -> round2(value / LB_PER_KG)
            "waist" -> round2(value * CM_PER_IN)
            else -> value
        }
    }

    fun format(value: Double, metric: String, units: String): String {
        val v = toDisplay(value, metric, units)
        return if (v % 1.0 == 0.0) v.toLong().toString() else "%.1f".format(v)
    }

    fun water(liters: Double, units: String): String {
        if (units == "imperial") return "${(liters * FLOZ_PER_L).roundToInt()} fl oz water"
        val r = round1(liters)
        val text = if (r % 1.0 == 0.0) r.toLong().toString() else "%.1f".format(r)
        return "$text L water"
    }

    private fun round1(n: Double): Double = (n * 10.0).roundToLong() / 10.0
    private fun round2(n: Double): Double = (n * 100.0).roundToLong() / 100.0
}
