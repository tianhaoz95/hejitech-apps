import WidgetKit
import SwiftUI

struct KidsCamComplicationEntry: TimelineEntry {
    let date: Date
    let title: String
    let status: String
}

struct KidsCamComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> KidsCamComplicationEntry {
        KidsCamComplicationEntry(date: Date(), title: "ToddlerCam", status: "Ready")
    }

    func getSnapshot(in context: Context, completion: @escaping (KidsCamComplicationEntry) -> ()) {
        let entry = KidsCamComplicationEntry(date: Date(), title: "ToddlerCam", status: "Ready")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KidsCamComplicationEntry>) -> ()) {
        let entry = KidsCamComplicationEntry(date: Date(), title: "ToddlerCam", status: "Ready")
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
}

struct KidsCamComplicationView: View {
    @Environment(\.widgetFamily) var family
    var entry: KidsCamComplicationProvider.Entry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.yellow)
                    Text("SNAP")
                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                }
            }

        case .accessoryRectangular:
            HStack(spacing: 8) {
                Image(systemName: "camera.circle.fill")
                    .font(.system(size: 26))
                    .foregroundColor(.yellow)

                VStack(alignment: .leading, spacing: 1) {
                    Text("ToddlerCam")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                    Text("Parent Remote Ready")
                        .font(.system(size: 11, weight: .regular, design: .rounded))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding(4)

        case .accessoryCorner:
            Image(systemName: "camera.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.yellow)

        case .accessoryInline:
            HStack(spacing: 4) {
                Image(systemName: "camera.fill")
                Text("ToddlerCam Remote")
            }

        default:
            Image(systemName: "camera.fill")
        }
    }
}

@main
struct KidsCamComplication: Widget {
    let kind: String = "com.hejitech.kidscam.watchkitapp.complications"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: KidsCamComplicationProvider()) { entry in
            KidsCamComplicationView(entry: entry)
        }
        .configurationDisplayName("ToddlerCam Remote")
        .description("Quick parent remote control for ToddlerCam.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryCorner,
            .accessoryInline
        ])
    }
}
