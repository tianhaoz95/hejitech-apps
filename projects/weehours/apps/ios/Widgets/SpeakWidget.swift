import AppIntents
import SwiftUI
import WidgetKit

/// One tap to speak a log entry: opens the app on weehours://voice, which starts listening
/// (the same link the Action Button uses; App.swift handles it).
struct SpeakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "speak", provider: SpeakProvider()) { _ in
            SpeakView().widgetURL(URL(string: "weehours://voice"))
        }
        .configurationDisplayName("Speak")
        .description("Tap to say what happened. Wee Hours opens listening.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

struct SpeakProvider: TimelineProvider {
    struct Entry: TimelineEntry { let date: Date }
    func placeholder(in context: Context) -> Entry { Entry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: Date())], policy: .never))   // static: nothing to refresh
    }
}

struct SpeakView: View {
    @Environment(\.widgetFamily) private var family
    private let accent = Color(red: 0.95, green: 0.62, blue: 0.40)

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.title2)
            }
            .containerBackground(.clear, for: .widget)
        case .accessoryRectangular:
            HStack(spacing: 8) {
                Image(systemName: "mic.circle.fill").font(.title)
                VStack(alignment: .leading) {
                    Text("Wee Hours").font(.headline)
                    Text("Tap to speak").font(.caption)
                }
            }
            .containerBackground(.clear, for: .widget)
        default:
            VStack(spacing: 10) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 72, height: 72)
                    .background(accent, in: Circle())
                Text("Speak").font(.headline)
                Text("say what happened").font(.caption).foregroundStyle(.secondary)
            }
            .containerBackground(for: .widget) { Color(red: 0.11, green: 0.10, blue: 0.22).opacity(0.06) }
        }
    }
}

/// Control Center, Lock Screen and Action Button control (iOS 18): the same one tap.
struct SpeakControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.hejitech.weehours.speak") {
            ControlWidgetButton(action: OpenURLIntent(URL(string: "weehours://voice")!)) {
                Label("Speak to Wee Hours", systemImage: "mic.fill")
            }
        }
        .displayName("Speak to Wee Hours")
        .description("Opens Wee Hours listening.")
    }
}
