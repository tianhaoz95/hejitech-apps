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

            let stemWidth = w * 0.13
            let barWidth = w * 0.12
            let cornerRadius = barWidth / 2

            ZStack {
                // Left diagonal stem of the 'V'
                Path { path in
                    let start = CGPoint(x: w * 0.26, y: h * 0.28)
                    let end = CGPoint(x: w * 0.44, y: h * 0.72)
                    path.move(to: start)
                    path.addLine(to: end)
                }
                .stroke(color, style: StrokeStyle(lineWidth: stemWidth, lineCap: .round, lineJoin: .round))

                // Right arm: 4 stepped equalizer bars
                Group {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.16)
                        .position(x: w * 0.53, y: h * 0.65)

                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.30)
                        .position(x: w * 0.61, y: h * 0.53)

                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.42)
                        .position(x: w * 0.69, y: h * 0.41)

                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.28)
                        .position(x: w * 0.77, y: h * 0.32)
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
                        .padding(9)
                }
            }
            .widgetURL(URL(string: "voxbrief://record?source=watch_complication"))

        case .accessoryCorner:
            VWaveComplicationMark(color: Color.accentColor)
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
                            .fill(Color.accentColor.opacity(0.2))
                            .frame(width: 30, height: 30)
                        VWaveComplicationMark(color: Color.accentColor)
                            .frame(width: 18, height: 18)
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
