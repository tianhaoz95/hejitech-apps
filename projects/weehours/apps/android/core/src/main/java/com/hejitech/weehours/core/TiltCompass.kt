package com.hejitech.weehours.core

import java.util.Date
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

object TiltCompass {
    enum class Direction(val rawValue: String) {
        NORTH("north"),
        EAST("east"),
        SOUTH("south"),
        WEST("west");

        val id: String get() = rawValue
        val gesture: String
            get() = when (this) {
                NORTH -> "Tilt forward"
                EAST -> "Tilt right"
                SOUTH -> "Tilt back"
                WEST -> "Tilt left"
            }

        companion object {
            fun fromRaw(raw: String?): Direction? = entries.firstOrNull { it.rawValue == raw }
        }
    }

    data class Slot(
        var direction: Direction,
        var action: String,
        var type: String = "",
        var label: String,
        var icon: String,
        var runningId: String = "",
    ) {
        init {
            if (type.isEmpty()) type = action
        }

        val context: Map<String, String>
            get() = mapOf(
                "dir" to direction.rawValue,
                "action" to action,
                "type" to type,
                "label" to label,
                "icon" to icon,
                "runningId" to runningId
            )

        companion object {
            fun fromContext(c: Map<String, Any?>): Slot? {
                val dir = Direction.fromRaw(c["dir"] as? String) ?: return null
                val action = c["action"] as? String ?: return null
                val label = c["label"] as? String ?: return null
                return Slot(
                    direction = dir,
                    action = action,
                    type = (c["type"] as? String) ?: "",
                    label = label,
                    icon = (c["icon"] as? String) ?: "circle.fill",
                    runningId = (c["runningId"] as? String) ?: ""
                )
            }
        }
    }

    fun defaultAssignment(d: Direction, choices: List<String>): String = when (d) {
        Direction.NORTH -> "feed"
        Direction.EAST -> "diaper"
        Direction.SOUTH -> "sleep"
        Direction.WEST -> choices.firstOrNull { it !in setOf("feed", "diaper", "sleep") } ?: ""
    }

    fun choices(registry: EventRegistry = EventRegistry.shared, enabled: Set<String>): List<String> {
        val out = mutableListOf<String>()
        if (enabled.contains("bottle") || enabled.contains("breast")) out.add("feed")
        if (enabled.contains("diaper")) out.add("diaper")
        if (enabled.contains("sleep")) out.add("sleep")
        val grouped = registry.categories.filter { it.group != null }.map { it.id }.toSet()
        for (t in registry.types) {
            if (grouped.contains(t.category) && enabled.contains(t.category)) {
                if (t.fields.orEmpty().none { it.isRequired }) {
                    out.add(t.id)
                }
            }
        }
        return out
    }
}

class TiltLock(
    var available: Set<TiltCompass.Direction> = TiltCompass.Direction.entries.toSet(),
    var config: Config = Config(),
) {
    data class Config(
        var enter: Double = 18.0,
        var exit: Double = 12.0,
        var dwell: Double = 1.0,
        var maxRotation: Double = 1.0,
    )

    sealed class Phase {
        data object Idle : Phase()
        data class Aiming(val direction: TiltCompass.Direction, val since: Date) : Phase()
        data class Locked(val direction: TiltCompass.Direction) : Phase()
    }

    var phase: Phase = Phase.Idle
        private set

    fun direction(x: Double, y: Double): TiltCompass.Direction? {
        val magnitude = sqrt(x * x + y * y)
        val current = (phase as? Phase.Aiming)?.direction
        val d = if (abs(y) >= abs(x)) {
            if (y > 0) TiltCompass.Direction.NORTH else TiltCompass.Direction.SOUTH
        } else {
            if (x > 0) TiltCompass.Direction.EAST else TiltCompass.Direction.WEST
        }
        if (current != null && magnitude >= config.exit && (d == current || magnitude < config.enter)) {
            return current
        }
        return if (magnitude >= config.enter && available.contains(d)) d else null
    }

    fun progress(at: Date): Double = when (val p = phase) {
        is Phase.Idle -> 0.0
        is Phase.Locked -> 1.0
        is Phase.Aiming -> {
            val elapsed = (at.time - p.since.time) / 1000.0
            min(1.0, max(0.0, elapsed / config.dwell))
        }
    }

    fun update(x: Double, y: Double, rotation: Double, at: Date): TiltCompass.Direction? {
        if (phase is Phase.Locked) return null
        val d = direction(x, y)
        if (d == null) {
            phase = Phase.Idle
            return null
        }
        val aiming = phase as? Phase.Aiming
        if (aiming == null || aiming.direction != d) {
            phase = Phase.Aiming(d, since = at)
            return null
        }
        if (rotation > config.maxRotation) {
            phase = Phase.Aiming(d, since = at)
            return null
        }
        val elapsed = (at.time - aiming.since.time) / 1000.0
        if (elapsed >= config.dwell) {
            phase = Phase.Locked(d)
            return d
        }
        return null
    }

    fun reset() {
        phase = Phase.Idle
    }
}
