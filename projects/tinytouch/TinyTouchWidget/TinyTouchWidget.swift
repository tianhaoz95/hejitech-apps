import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), activeMode: "Bubbles")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), activeMode: currentSavedMode())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let entry = SimpleEntry(date: Date(), activeMode: currentSavedMode())
        // Launcher complications rarely need frequent re-renders; update hourly
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private func currentSavedMode() -> String {
        return UserDefaults.standard.string(forKey: "tinyTouch_mode") ?? "Bubbles"
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let activeMode: String
}

struct TinyTouchWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: "face.smiling.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.pink)
                    Text("PLAY")
                        .font(.system(size: 8, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                }
            }
            .widgetURL(URL(string: "tinytouch://play"))
            
        case .accessoryCorner:
            Image(systemName: "hand.tap.fill")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.yellow)
                .widgetLabel {
                    Text("TinyTouch • Play")
                }
                .widgetURL(URL(string: "tinytouch://play"))
                
        case .accessoryRectangular:
            HStack(spacing: 8) {
                Image(systemName: "face.smiling.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.pink)
                VStack(alignment: .leading, spacing: 2) {
                    Text("TinyTouch")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("Tap to Lock & Play")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(URL(string: "tinytouch://play"))
            
        case .accessoryInline:
            ViewThatFits {
                HStack(spacing: 3) {
                    Image(systemName: "hand.tap.fill")
                    Text("TinyTouch: Play")
                }
                Text("TinyTouch")
            }
            .widgetURL(URL(string: "tinytouch://play"))
            
        default:
            Image(systemName: "face.smiling.fill")
                .widgetURL(URL(string: "tinytouch://play"))
        }
    }
}

@main
struct TinyTouchWidget: Widget {
    let kind: String = "TinyTouchWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TinyTouchWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("TinyTouch Quick Launch")
        .description("Quickly launch safe toddler sensory play directly from your watch face.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
