import ContempoCore
import ContempoFirestore
import SwiftUI

struct DashboardScreen: View {
    @State private var viewModel = DashboardViewModel()
    @Environment(\.contempoPalette) private var palette

    private var progress: Double {
        guard viewModel.thresholdHours > 0 else { return 0 }
        return min(1, viewModel.confirmedHours / Double(viewModel.thresholdHours))
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow(viewModel.testName + " test")
                    ProgressView(value: progress)
                        .tint(palette.pine)
                    Text("\(viewModel.confirmedHours.formatted(.number.precision(.fractionLength(1)))) / \(viewModel.thresholdHours) hrs confirmed")
                        .font(ContempoFont.titleMedium())
                    if viewModel.totalMiles > 0 {
                        Text("\(viewModel.totalMiles.formatted(.number.precision(.fractionLength(1)))) mi logged")
                            .font(ContempoFont.bodyLarge())
                            .foregroundStyle(palette.inkSoft)
                    }
                    if viewModel.pendingCount > 0 {
                        Text("\(viewModel.pendingCount) pending review")
                            .font(ContempoFont.bodyLarge())
                            .foregroundStyle(palette.brass)
                    }
                    if let timerEntry = viewModel.openTimerEntry {
                        Text("Timer running — \(timerEntry.task.isEmpty ? (timerEntry.propertyName.isEmpty ? "work" : timerEntry.propertyName) : timerEntry.task)")
                            .font(ContempoFont.labelLarge())
                            .foregroundStyle(palette.pine)
                    }
                    if let tripEntry = viewModel.openTripEntry {
                        Text(String(format: "Trip in progress — %.2f mi", tripEntry.miles))
                            .font(ContempoFont.labelLarge())
                            .foregroundStyle(palette.pine)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Entries") {
                ForEach(viewModel.entries) { entry in
                    NavigationLink(value: AppRoute.entryDetail(entry.id ?? "")) {
                        EntryRow(entry: entry)
                    }
                    .swipeActions {
                        Button("Delete", role: .destructive) {
                            Task { _ = await viewModel.deleteEntry(entry.id ?? "") }
                        }
                    }
                }
            }
        }
        .navigationTitle("Dashboard")
        .alert("Couldn't delete", isPresented: Binding(
            get: { viewModel.deleteError != nil },
            set: { if !$0 { viewModel.dismissDeleteError() } }
        )) {
            Button("OK") { viewModel.dismissDeleteError() }
        } message: {
            Text(viewModel.deleteError ?? "")
        }
    }
}

private struct EntryRow: View {
    let entry: Entry
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.propertyName.isEmpty ? "Untitled" : entry.propertyName)
                    .font(ContempoFont.titleMedium())
                Spacer()
                if entry.inProgress {
                    Badge(text: entry.isTrip ? "Trip" : "Timer", color: palette.navy)
                } else if entry.statusEnum == .pendingReview {
                    Badge(text: "Pending", color: palette.brass)
                }
            }
            BulletAwareText(entry.task, font: ContempoFont.bodyLarge())
                .foregroundStyle(palette.inkSoft)
            HStack {
                Text("\(entry.durationMinutes) min")
                if entry.miles > 0 {
                    Text("· \(entry.miles.formatted(.number.precision(.fractionLength(1)))) mi")
                }
            }
            .font(ContempoFont.labelSmall())
            .foregroundStyle(palette.inkFaint)
            if !entry.riskReasons.isEmpty {
                ForEach(entry.riskReasons, id: \.self) { reason in
                    Text(reason)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.danger)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text.uppercased())
            .font(ContempoFont.labelSmall())
            .tracking(ContempoFont.labelSmallTracking)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}
