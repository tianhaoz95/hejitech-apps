import WidgetKit
import SwiftUI

struct ComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(date: Date(), isRecording: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
        let entry = ComplicationEntry(date: Date(), isRecording: false)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let entry = ComplicationEntry(date: Date(), isRecording: false)
        // Refresh every 1 hour or when app updates
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

struct ComplicationEntry: TimelineEntry {
    let date: Date
    let isRecording: Bool
}

/// Bespoke Voxbrief "V-Wave" vector brand mark for Apple Watch complications.
struct VWaveComplicationMark: View {
    var color: Color = Color.accentColor

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height

            let stemWidth = w * 0.11
            let barWidth = w * 0.09
            let cornerRadius = barWidth / 2

            ZStack {
                // Left diagonal stem of the 'V'
                Path { path in
                    let start = CGPoint(x: w * 0.18, y: h * 0.24)
                    let end = CGPoint(x: w * 0.36, y: h * 0.76)
                    path.move(to: start)
                    path.addLine(to: end)
                }
                .stroke(color, style: StrokeStyle(lineWidth: stemWidth, lineCap: .round, lineJoin: .round))

                // Right arm: 3 widely spaced equalizer bars (1:1 stroke to gap ratio)
                Group {
                    // Bar 1 (near vertex)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.20)
                        .position(x: w * 0.52, y: h * 0.63)

                    // Bar 2 (mid voice)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.32)
                        .position(x: w * 0.68, y: h * 0.53)

                    // Bar 3 (peak voice bar)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.44)
                        .position(x: w * 0.84, y: h * 0.44)
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

struct VoxbriefComplicationView: View {
    @Environment(\.widgetFamily) var family
    var entry: ComplicationEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                if entry.isRecording {
                    Image(systemName: "waveform.badge.mic")
                        .font(.title3)
                        .foregroundColor(.red)
                } else {
                    VWaveComplicationMark(color: Color.accentColor)
                        .padding(6)
                }
            }
            .widgetURL(URL(string: "voxbrief://record?source=watch_complication"))

        case .accessoryCorner:
            VWaveComplicationMark(color: Color.accentColor)
                .frame(width: 22, height: 22)
                .widgetLabel {
                    Text("VoxBrief")
                }
                .widgetURL(URL(string: "voxbrief://record?source=watch_complication"))

        case .accessoryRectangular:
            HStack(spacing: 8) {
                if entry.isRecording {
                    Image(systemName: "waveform.circle.fill")
                        .font(.title2)
                        .foregroundColor(.red)
                } else {
                    ZStack {
                        Circle()
                            .fill(Color.accentColor.opacity(0.18))
                            .frame(width: 32, height: 32)
                        VWaveComplicationMark(color: Color.accentColor)
                            .frame(width: 22, height: 22)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.isRecording ? "Recording…" : "VoxBrief Memo")
                        .font(.headline)
                        .lineLimit(1)
                    Text(entry.isRecording ? "Tap to stop" : "Tap to speak memo")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .widgetURL(URL(string: "voxbrief://record?source=watch_complication"))

        case .accessoryInline:
            Label(entry.isRecording ? "Recording…" : "VoxBrief Memo", systemImage: entry.isRecording ? "waveform.badge.mic" : "mic.fill")
                .widgetURL(URL(string: "voxbrief://record?source=watch_complication"))

        default:
            VWaveComplicationMark(color: Color.accentColor)
                .widgetURL(URL(string: "voxbrief://record?source=watch_complication"))
        }
    }
}

struct VoxbriefComplication: Widget {
    let kind: String = "VoxbriefComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ComplicationProvider()) { entry in
            VoxbriefComplicationView(entry: entry)
        }
        .configurationDisplayName("Voice Note Quick Capture")
        .description("One-tap voice capture right from your watch face.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

@main
struct VoxbriefWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        VoxbriefComplication()
    }
}
