import SwiftUI
import WidgetKit

@main
struct ContempoWidgetsBundle: WidgetBundle {
    var body: some Widget {
        HoursLockScreenWidget()
        TimerLiveActivity()
        TripLiveActivity()
    }
}
