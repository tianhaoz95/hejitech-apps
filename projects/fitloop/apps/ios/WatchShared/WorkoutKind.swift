#if canImport(HealthKit)
import HealthKit

/// The plan's workout kind (strength, cardio, mobility, hiit, sport, other) as a Health workout type,
/// so a FitLoop workout lands in Health (and the rings) as what it was. Compiled into the iPhone
/// app, the Watch app and the complication.
enum WorkoutKind {
    static func activityType(_ kind: String) -> HKWorkoutActivityType {
        switch kind {
        case "strength": .traditionalStrengthTraining
        case "cardio": .mixedCardio
        case "mobility": .flexibility
        case "hiit": .highIntensityIntervalTraining
        case "sport": .other
        default: .functionalStrengthTraining
        }
    }

    static func configuration(_ kind: String) -> HKWorkoutConfiguration {
        let c = HKWorkoutConfiguration()
        c.activityType = activityType(kind)
        c.locationType = .indoor
        return c
    }

    /// Metadata FitLoop adds to every workout it saves: the plan's title and its ref.
    static let titleKey = "FitLoopWorkoutTitle"
    static let refKey = "FitLoopWorkoutRef"
}
#endif
