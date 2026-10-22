import SwiftUI
import WidgetKit

/// Watch face complications and Smart Stack widgets: one tap (or Double Tap on the selected Smart
/// Stack widget) opens the watch app already recording (`weehours://record`) or in tilt mode
/// (`weehours://tilt`), both handled in WatchApp.swift. They show no log data, so the extension
/// needs no App Group. On watchOS 26 a Control does the same from Control Center, the Smart Stack
/// or the Action Button.
@main
struct WeeHoursWatchWidgets: WidgetBundle {
    var body: some Widget {
        WeeHoursComplications()
        TiltComplication()
        if #available(watchOS 26.0, *) {
            TiltControl()
        }
    }
}

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

struct TiltComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "tilt", provider: Provider()) { _ in
            TiltComplicationView().widgetURL(URL(string: "weehours://tilt"))
        }
        .configurationDisplayName("Log by tilting")
        .description("Opens Wee Hours in tilt mode: tilt your wrist toward what happened.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline])
    }
}

@available(watchOS 26.0, *)
struct TiltControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "tilt-control") {
            ControlWidgetButton(action: TiltModeIntent()) {
                Label("Log by tilting", systemImage: "gyroscope")
            }
        }
        .displayName("Log by tilting")
        .description("Opens Wee Hours in tilt mode.")
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

struct TiltComplicationView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCorner:
            Image(systemName: "gyroscope").font(.title2)
                .widgetLabel("Tilt")
                .containerBackground(.clear, for: .widget)
        case .accessoryRectangular:
            HStack(spacing: 8) {
                Image(systemName: "gyroscope").font(.title)
                VStack(alignment: .leading) {
                    Text("Wee Hours").font(.headline)
                    Text("Tilt to log").font(.caption).foregroundStyle(.secondary)
                }
            }
            .containerBackground(.clear, for: .widget)
        case .accessoryInline:
            Label("Tilt to log", systemImage: "gyroscope")
                .containerBackground(.clear, for: .widget)
        default:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "gyroscope").font(.title2)
            }
            .containerBackground(.clear, for: .widget)
        }
    }
}

