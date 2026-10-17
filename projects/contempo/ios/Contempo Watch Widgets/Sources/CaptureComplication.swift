import ContempoCore
import SwiftUI
import WidgetKit

struct CaptureComplicationEntry: TimelineEntry {
    let date: Date
}

struct CaptureComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> CaptureComplicationEntry {
        CaptureComplicationEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (CaptureComplicationEntry) -> Void) {
        completion(CaptureComplicationEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CaptureComplicationEntry>) -> Void) {
        completion(Timeline(entries: [CaptureComplicationEntry(date: Date())], policy: .never))
    }
}

struct CaptureComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "CaptureComplication", provider: CaptureComplicationProvider()) { entry in
            CaptureComplicationView(entry: entry)
        }
        .configurationDisplayName("Quick Capture")
        .description("Quick shortcuts to start voice recording, work timer, or GPS trip.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline])
    }
}

private struct CaptureComplicationView: View {
    let entry: CaptureComplicationEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            VStack(spacing: 1) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.red)
                Text("REC")
                    .font(.system(size: 9, weight: .bold))
            }
            .widgetURL(URL(string: "contempo://capture?mode=voice"))

        case .accessoryCorner:
            Image(systemName: "mic.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.red)
                .widgetURL(URL(string: "contempo://capture?mode=voice"))

        case .accessoryInline:
            Text("🎙️ Tap to Log Work")
                .widgetURL(URL(string: "contempo://capture?mode=voice"))

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.yellow)
                    Text("QUICK LOG")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.secondary)
                }

                HStack(spacing: 6) {
                    Link(destination: URL(string: "contempo://capture?mode=voice")!) {
                        HStack(spacing: 2) {
                            Image(systemName: "mic.fill")
                            Text("Voice")
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                        .background(Color.red.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }

                    Link(destination: URL(string: "contempo://capture?mode=work")!) {
                        HStack(spacing: 2) {
                            Image(systemName: "play.fill")
                            Text("Work")
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                        .background(Color.green.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }

                    Link(destination: URL(string: "contempo://capture?mode=trip")!) {
                        HStack(spacing: 2) {
                            Image(systemName: "location.fill")
                            Text("Trip")
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                        .background(Color.blue.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }

        @unknown default:
            Image(systemName: "mic.fill")
        }
    }
}
