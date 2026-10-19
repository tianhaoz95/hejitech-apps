import SwiftUI
import WidgetKit

/// Watch face complications: one tap opens the watch app already recording (`weehours://record`,
/// handled in WatchApp.swift). They show no log data, so the extension needs no App Group.
@main
struct WeeHoursComplications: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "speak", provider: Provider()) { _ in
            ComplicationView().widgetURL(URL(string: "weehours://record"))
        }
        .configurationDisplayName("Speak a log entry")
        .description("Opens Wee Hours listening, ready for what happened.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline])
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry { SimpleEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) { completion(SimpleEntry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        completion(Timeline(entries: [SimpleEntry(date: Date())], policy: .never))   // static: nothing to refresh
    }
}

struct SimpleEntry: TimelineEntry { let date: Date }

struct ComplicationView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCorner:
            Image(systemName: "mic.fill").font(.title2)
                .widgetLabel("Speak")
                .containerBackground(.clear, for: .widget)
        case .accessoryRectangular:
            HStack(spacing: 8) {
                Image(systemName: "mic.circle.fill").font(.title)
                VStack(alignment: .leading) {
                    Text("Wee Hours").font(.headline)
                    Text("Tap to speak").font(.caption).foregroundStyle(.secondary)
                }
            }
            .containerBackground(.clear, for: .widget)
        case .accessoryInline:
            Label("Speak to Wee Hours", systemImage: "mic.fill")
                .containerBackground(.clear, for: .widget)
        default:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.title2)
            }
            .containerBackground(.clear, for: .widget)
        }
    }
}
