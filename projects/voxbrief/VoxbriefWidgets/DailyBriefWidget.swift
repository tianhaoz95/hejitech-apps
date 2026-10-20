import SwiftUI
import WidgetKit

/// The Daily Brief on the Home Screen and Lock Screen: open action items, high priority first.
/// Reads the `DailyBriefSnapshot` the app writes to the App Group whenever notes change (the
/// widget never sees the notes store itself). Tapping it opens the brief.
struct DailyBriefWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: DailyBriefSnapshot.widgetKind, provider: DailyBriefProvider()) { entry in
            DailyBriefWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "voxbrief://navigate?screen=brief"))
        }
        .configurationDisplayName("Daily Brief")
        .description("Your open action items across all notes, high priority first.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct DailyBriefEntry: TimelineEntry {
    let date: Date
    /// Nil until the app has written a snapshot (installed widget, app not opened since).
    let snapshot: DailyBriefSnapshot?

    static let placeholder = DailyBriefEntry(date: Date(), snapshot: DailyBriefSnapshot(
        openCount: 3, highCount: 1,
        items: [
            .init(text: "Send Priya the revised mockups", noteTitle: "Design sync", priority: "high"),
            .init(text: "Book the usability study room", noteTitle: "Design sync", priority: nil),
            .init(text: "Renew the car registration", noteTitle: "Errands", priority: nil),
        ],
        recentNoteCount: 2, updatedAt: Date()
    ))
}

struct DailyBriefProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyBriefEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (DailyBriefEntry) -> Void) {
        completion(context.isPreview ? .placeholder : DailyBriefEntry(date: Date(), snapshot: DailyBriefSnapshot.load()))
    }

    /// One entry; the app reloads the widget when the brief changes, so the only refresh asked
    /// for here is a slow one in case the app isn't opened for a while.
    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyBriefEntry>) -> Void) {
        let entry = DailyBriefEntry(date: Date(), snapshot: DailyBriefSnapshot.load())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(6 * 3600))))
    }
}

struct DailyBriefWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyBriefEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(inlineText)
        case .accessoryRectangular:
            rectangular
        case .systemMedium:
            medium
        default:
            small
        }
    }

    private var snapshot: DailyBriefSnapshot? { entry.snapshot }

    private var inlineText: String {
        guard let snapshot else { return "Open Voxbrief" }
        return snapshot.openCount == 0 ? "No open items" : "\(snapshot.openCount) open · \(snapshot.highCount) high"
    }

    private var header: some View {
        Label("Your brief", systemImage: "sun.horizon.fill")
            .font(.caption.weight(.bold))
            .foregroundStyle(.orange)
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 4) {
            header
            Spacer(minLength: 0)
            if let snapshot {
                Text("\(snapshot.openCount)")
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .contentTransition(.numericText())
                Text(snapshot.openCount == 1 ? "open action item" : "open action items")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if snapshot.highCount > 0 {
                    Text("\(snapshot.highCount) high priority")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                }
            } else {
                notYetText
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                header
                Spacer()
                if let snapshot, snapshot.openCount > 0 {
                    Text("\(snapshot.openCount) open")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            if let snapshot {
                if snapshot.items.isEmpty {
                    Spacer(minLength: 0)
                    Label("No open action items. Nice.", systemImage: "checkmark.seal")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                } else {
                    ForEach(Array(snapshot.items.prefix(3).enumerated()), id: \.offset) { _, item in
                        itemRow(item)
                    }
                    Spacer(minLength: 0)
                    if snapshot.recentNoteCount > 0 {
                        Text("\(snapshot.recentNoteCount) note\(snapshot.recentNoteCount == 1 ? "" : "s") recorded in the last day")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                Spacer(minLength: 0)
                notYetText
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func itemRow(_ item: DailyBriefSnapshot.Item) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: "circle")
                .font(.caption2)
                .foregroundStyle(item.priority == "high" ? .red : .secondary)
            VStack(alignment: .leading, spacing: 0) {
                Text(item.text)
                    .font(.subheadline)
                    .lineLimit(1)
                Text(item.noteTitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Label("Brief", systemImage: "sun.horizon.fill")
                .font(.caption.weight(.bold))
            if let snapshot {
                if let first = snapshot.items.first {
                    Text(first.text).lineLimit(1)
                    Text(snapshot.openCount > 1 ? "+\(snapshot.openCount - 1) more open" : "1 open item")
                        .foregroundStyle(.secondary)
                } else {
                    Text("No open items")
                }
            } else {
                Text("Open Voxbrief")
            }
        }
        .font(.caption)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var notYetText: some View {
        Text("Open Voxbrief once to fill this in.")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
}
