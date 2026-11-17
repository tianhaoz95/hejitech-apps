import SwiftUI

/// What each recording cost in battery, newest first.
public struct WatchBatteryLogView: View {
    @ObservedObject private var log = WatchBatteryLog.shared

    public init() {}

    public var body: some View {
        List {
            if log.sessions.isEmpty {
                Text("Nothing yet. Each recording adds a line here with the battery it used.")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(log.sessions) { session in
                    row(for: session)
                }
                if log.sessions.contains(where: { $0.endedAt != nil }) {
                    Button(role: .destructive) {
                        log.clear()
                    } label: {
                        Text("Clear Log")
                            .font(.system(size: 12, weight: .medium))
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .navigationTitle("Battery Log")
    }

    @ViewBuilder
    private func row(for session: BatterySession) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(session.startedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                Spacer()
                if session.endedAt == nil {
                    Text("NOW")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.red)
                }
            }

            Text(headline(for: session))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color.accentColor)

            if let start = session.startPercent, let end = session.endPercent {
                Text("\(start)% → \(end)% in \(Self.length(session.hours * 3600))")
                    .font(.system(size: 11))
            }

            Text(session.config.summary)
                .font(.system(size: 9))
                .foregroundColor(.secondary)

            Text(footnote(for: session))
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }

    private func headline(for session: BatterySession) -> String {
        guard let rate = session.percentPerHour else {
            return session.wasCharging && session.startPercent == nil ? "On charger" : "Too short to tell"
        }
        guard let hours = session.projectedHoursOnFullCharge else {
            return "No drop measured"
        }
        return String(format: "%.1f%% an hour · about %.0f h a charge", rate, hours)
    }

    private func footnote(for session: BatterySession) -> String {
        var parts = ["\(session.pieces) piece\(session.pieces == 1 ? "" : "s")"]
        if session.interruptions > 0 {
            parts.append("\(session.interruptions) interruption\(session.interruptions == 1 ? "" : "s")")
        }
        if session.wasCharging { parts.append("partly on charger") }
        if let reason = session.endReason, reason != "stopped" { parts.append(reason) }
        return parts.joined(separator: " · ")
    }

    private static func length(_ seconds: TimeInterval) -> String {
        let minutes = Int((seconds / 60).rounded())
        return minutes >= 60 ? "\(minutes / 60) h \(minutes % 60) min" : "\(minutes) min"
    }
}
