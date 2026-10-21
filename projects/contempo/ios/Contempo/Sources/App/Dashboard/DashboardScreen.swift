import ContempoCore
import ContempoData
import SwiftUI

struct DashboardScreen: View {
    @State private var viewModel = DashboardViewModel()
    @Environment(\.contempoPalette) private var palette
    // Collapsed by default — a role-by-role comparison is audit context,
    // not the thing most users open the app to check, so it stays hidden
    // until tapped rather than always taking up space under the progress bar.
    @State private var isRoleBreakdownExpanded = false

    private var progress: Double {
        guard viewModel.thresholdHours > 0 else { return 0 }
        return min(1, viewModel.confirmedHours / Double(viewModel.thresholdHours))
    }

    /// One line under the progress bar: met, the projected finish date, or the weekly
    /// hours that still reach the threshold by Dec 31 (see `TestYearProgress.Pace`).
    private var paceLine: some View {
        let threshold = viewModel.thresholdHours
        let (symbol, text, color): (String, String, Color) = switch viewModel.testProgress.pace {
        case .met:
            ("checkmark.seal.fill", "Test met for \(String(viewModel.testProgress.year))", palette.pine)
        case .onPace(let finish):
            ("calendar", "On pace to reach \(threshold) hrs by \(finish.formatted(.dateTime.month(.abbreviated).day()))", palette.pine)
        case .behind(let weekly):
            ("speedometer", "\(weekly.formatted(.number.precision(.fractionLength(1)))) hrs a week reaches \(threshold) by Dec 31", palette.brassDeep)
        }
        return Label(text, systemImage: symbol)
            .font(ContempoFont.bodyMedium())
            .foregroundStyle(color)
            .accessibilityIdentifier("dashboard_pace")
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
                Eyebrow("\(viewModel.testName) Test Progress · \(String(viewModel.testProgress.year))")

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

                paceLine

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

                if !viewModel.roleBreakdown.isEmpty {
                    Divider()
                    Button {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            isRoleBreakdownExpanded.toggle()
                        }
                    } label: {
                        HStack {
                            Text("Hours by role")
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(palette.inkSoft)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(palette.inkSoft)
                                .rotationEffect(.degrees(isRoleBreakdownExpanded ? 180 : 0))
                        }
                    }
                    .buttonStyle(.plain)

                    if isRoleBreakdownExpanded {
                        Text("Only your own hours count above — the IRS tests require your participation to exceed everyone else's.")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                        // Bar width is relative to the largest bucket in
                        // this breakdown (not the 100-hour threshold) — the
                        // point of this view is comparing participants
                        // against each other, not against the test's own
                        // progress bar above.
                        let maxRoleHours = max(viewModel.roleBreakdown.map(\.hours).max() ?? 0, 0.01)
                        VStack(spacing: 10) {
                            ForEach(viewModel.roleBreakdown) { summary in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(summary.name)
                                        Spacer()
                                        Text("\(summary.hours.formatted(.number.precision(.fractionLength(1)))) hrs")
                                    }
                                    .font(ContempoFont.labelSmall())
                                    .foregroundStyle(palette.inkSoft)

                                    GeometryReader { geo in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(palette.hairline).frame(height: 6)
                                            Capsule()
                                                // "Me" (id "") stands out as the reference bar; other
                                                // roles share a second color so the comparison reads
                                                // at a glance without needing a legend.
                                                .fill(summary.id.isEmpty ? palette.pine : palette.brass)
                                                .frame(width: max(4, geo.size.width * CGFloat(summary.hours / maxRoleHours)), height: 6)
                                        }
                                    }
                                    .frame(height: 6)
                                }
                            }
                        }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
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

            // ── Filters & Search ──────────────────────────────────────────
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(palette.inkFaint)
                    TextField("Search task, property, category...", text: $viewModel.searchText)
                        .font(ContempoFont.bodyMedium())
                    if !viewModel.searchText.isEmpty {
                        Button { viewModel.searchText = "" } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(palette.inkFaint)
                        }
                    }
                }
                .padding(8)
                .background(palette.paperRaised)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
                .overlay(RoundedRectangle(cornerRadius: ContempoRadius.small).stroke(palette.hairline, lineWidth: 1))

                HStack {
                    Menu {
                        ForEach(viewModel.propertyOptions, id: \.self) { prop in
                            Button { viewModel.selectedProperty = prop } label: {
                                if viewModel.selectedProperty == prop {
                                    Label(prop, systemImage: "checkmark")
                                } else {
                                    Text(prop)
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text("Property: \(viewModel.selectedProperty)")
                                .font(ContempoFont.labelSmall())
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(viewModel.selectedProperty == "All" ? palette.paperRaised : palette.pineTint)
                        .foregroundStyle(viewModel.selectedProperty == "All" ? palette.ink : palette.pine)
                        .clipShape(Capsule())
                    }

                    Spacer()

                    if viewModel.isFilterActive {
                        Button {
                            viewModel.selectedProperty = "All"
                            viewModel.selectedCategory = "All"
                            viewModel.searchText = ""
                        } label: {
                            Text("Reset")
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(palette.brassDeep)
                        }
                    }
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 4, trailing: 20))
            .listRowSeparator(.hidden)

            // ── Entries header ────────────────────────────────────────────
            HStack {
                Text("Recent Entries")
                    .font(ContempoFont.titleMedium())
                    .foregroundStyle(palette.ink)
                Spacer()
                if viewModel.isFilterActive {
                    Text("\(String(format: "%.1f", viewModel.filteredHours)) hrs (\(viewModel.filteredEntries.count))")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                } else {
                    Text("\(viewModel.entries.count)")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
            .listRowSeparator(.hidden)

            // ── Entry rows (or empty state) ───────────────────────────────
            if viewModel.filteredEntries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "note.text")
                        .font(.system(size: 32))
                        .foregroundStyle(palette.inkFaint)
                    Text(viewModel.isFilterActive ? "No matching entries" : "No work entries logged yet")
                        .font(ContempoFont.bodyLarge())
                        .foregroundStyle(palette.inkSoft)
                    Text(viewModel.isFilterActive ? "Try clearing or adjusting your search filters." : "Use Voice or Type in Capture to add your first contemporaneous record.")
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
                ForEach(viewModel.filteredEntries) { entry in
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
                    if entry.missingFields.isEmpty {
                        Badge(text: "Pending", color: palette.brass)
                    } else {
                        Badge(text: "Draft", color: palette.danger)
                    }
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
