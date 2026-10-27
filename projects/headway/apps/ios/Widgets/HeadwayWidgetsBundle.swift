#if os(iOS) && canImport(WidgetKit)
import SwiftUI
import WidgetKit

@main
struct HeadwayWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TrackActivityWidget()
    }
}
#endif
