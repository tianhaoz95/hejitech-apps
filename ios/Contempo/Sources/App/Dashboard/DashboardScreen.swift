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
            // ── Sync banner ──────────────────────────────────────────────
            if viewModel.isSyncing {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text(viewModel.syncStatusMessage.isEmpty ? "Syncing pending audios..." : viewModel.syncStatusMessage)
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.pine)
                    }
                    ProgressView(value: viewModel.syncProgressFraction)
                        .tint(palette.pine)
                }
                .padding(14)
                .background(palette.pineTint)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                .listRowSeparator(.hidden)
            } else if let notice = viewModel.syncNotice {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(palette.pine)
                    Text(notice)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.ink)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.paperRaised)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                .overlay(
                    RoundedRectangle(cornerRadius: ContempoRadius.medium)
                        .stroke(palette.hairline, lineWidth: 1)
                )
                .transition(.opacity)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                .listRowSeparator(.hidden)
            }

            // ── Progress card ─────────────────────────────────────────────
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow("\(viewModel.testName) Test Progress")

                HStack(alignment: .firstTextBaseline) {
                    Text("\(viewModel.confirmedHours.formatted(.number.precision(.fractionLength(1))))")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.pine)
                    Text("/ \(viewModel.thresholdHours) hrs")
                        .font(ContempoFont.titleMedium())
                        .foregroundStyle(palette.inkSoft)
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(palette.pineTint)
                            .frame(height: 10)
                        Capsule()
                            .fill(palette.pine)
                            .frame(width: max(10, geo.size.width * CGFloat(progress)), height: 10)
                            .animation(.spring(response: 0.6, dampingFraction: 0.75), value: progress)
                    }
                }
                .frame(height: 10)

                HStack(spacing: 16) {
                    if viewModel.totalMiles > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "location.fill")
                            Text("\(viewModel.totalMiles.formatted(.number.precision(.fractionLength(1)))) mi logged")
                        }
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkSoft)
                    }

                    if viewModel.pendingCount > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.badge.exclamationmark")
                            Text("\(viewModel.pendingCount) pending review")
                        }
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.brass)
                    }
                }

                if let timerEntry = viewModel.openTimerEntry {
                    HStack(spacing: 6) {
                        Image(systemName: "timer")
                        Text("Timer running — \(timerEntry.task.isEmpty ? (timerEntry.propertyName.isEmpty ? "work" : timerEntry.propertyName) : timerEntry.task)")
                    }
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
                }

                if let tripEntry = viewModel.openTripEntry {
                    HStack(spacing: 6) {
                        Image(systemName: "location.fill")
                        Text(String(format: "Trip in progress — %.2f mi", tripEntry.miles))
                    }
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.pine)
                }
            }
            .padding(20)
            .background(palette.paperRaised)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.large)
                    .stroke(palette.hairline, lineWidth: 1)
            )
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
            .listRowSeparator(.hidden)

            // ── Entries header ────────────────────────────────────────────
            HStack {
                Text("Recent Entries")
                    .font(ContempoFont.titleMedium())
                    .foregroundStyle(palette.ink)
                Spacer()
                Text("\(viewModel.entries.count)")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
            .listRowSeparator(.hidden)

            // ── Entry rows (or empty state) ───────────────────────────────
            if viewModel.entries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "note.text")
                        .font(.system(size: 32))
                        .foregroundStyle(palette.inkFaint)
                    Text("No work entries logged yet")
                        .font(ContempoFont.bodyLarge())
                        .foregroundStyle(palette.inkSoft)
                    Text("Use Voice or Type in Capture to add your first contemporaneous record.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
                .background(palette.paperRaised)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                .overlay(
                    RoundedRectangle(cornerRadius: ContempoRadius.medium)
                        .stroke(palette.hairline, lineWidth: 1)
                )
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                .listRowSeparator(.hidden)
            } else {
                ForEach(viewModel.entries) { entry in
                    ZStack {
                        EntryCard(entry: entry)
                        NavigationLink(value: AppRoute.entryDetail(entry.id ?? "")) {
                            EmptyView()
                        }
                        .opacity(0)
                    }
                    .buttonStyle(.plain)
                    // Native swipe-to-delete (leading and trailing, matching Android's
                    // SwipeToDismissBox which enables both directions).
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            Task { _ = await viewModel.deleteEntry(entry.id ?? "") }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 5, leading: 20, bottom: 5, trailing: 20))
                    .listRowSeparator(.hidden)
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Dashboard")
        .refreshable {
            await viewModel.refreshAndProcessPendingAudios()
        }
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

private struct EntryCard: View {
    let entry: Entry
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.propertyName.isEmpty ? "—" : entry.propertyName)
                    .font(ContempoFont.titleMedium())
                    .foregroundStyle(palette.ink)

                Spacer()

                if entry.inProgress {
                    Badge(text: entry.isTrip ? "Trip" : "Timer", color: palette.navy)
                } else if entry.statusEnum == .pendingReview {
                    Badge(text: "Pending", color: palette.brass)
                } else {
                    Badge(text: "Confirmed", color: palette.pine)
                }
            }

            BulletAwareText(entry.task.isEmpty ? "No description" : entry.task, font: ContempoFont.bodyLarge())
                .foregroundStyle(palette.inkSoft)

            HStack {
                Text("\(entry.durationMinutes) min")
                if entry.miles > 0 {
                    Text("· \(entry.miles.formatted(.number.precision(.fractionLength(1)))) mi")
                }
                Spacer()
                Text(entry.activityDate.dateValue().formatted(date: .abbreviated, time: .shortened))
            }
            .font(ContempoFont.labelSmall())
            .foregroundStyle(palette.inkFaint)

            if !entry.riskReasons.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(entry.riskReasons, id: \.self) { reason in
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption2)
                            Text(reason)
                                .font(ContempoFont.labelSmall())
                        }
                        .foregroundStyle(palette.danger)
                    }
                }
                .padding(8)
                .background(palette.dangerTint)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
            }
        }
        .padding(16)
        .background(palette.paperRaised)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
        .overlay(
            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                .stroke(palette.hairline, lineWidth: 1)
        )
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
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }
}
