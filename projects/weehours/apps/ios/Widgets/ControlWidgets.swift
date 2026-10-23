import AppIntents
import SwiftUI
import WidgetKit

/// Control Center and Lock Screen control to log a wet diaper change with one tap.
struct WetDiaperControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.hejitech.weehours.control.wet-diaper") {
            ControlWidgetButton(action: LogDiaperIntent(kind: .wet)) {
                Label("Wet Diaper", systemImage: "humidity.fill")
            }
        }
        .displayName("Log Wet Diaper")
        .description("Quickly logs a wet diaper change with one tap.")
    }
}

/// Control Center and Lock Screen control to log a dirty diaper change with one tap.
struct DirtyDiaperControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.hejitech.weehours.control.dirty-diaper") {
            ControlWidgetButton(action: LogDiaperIntent(kind: .dirty)) {
                Label("Dirty Diaper", systemImage: "humidity")
            }
        }
        .displayName("Log Dirty Diaper")
        .description("Quickly logs a dirty diaper change with one tap.")
    }
}

/// Control Center and Lock Screen control to toggle baby sleep/wake with one tap.
struct ToggleSleepControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.hejitech.weehours.control.toggle-sleep") {
            ControlWidgetButton(action: ToggleSleepIntent()) {
                Label("Baby Sleep / Wake", systemImage: "moon.zzz.fill")
            }
        }
        .displayName("Baby Sleep / Wake")
        .description("Toggles sleep or wake timer with one tap.")
    }
}
