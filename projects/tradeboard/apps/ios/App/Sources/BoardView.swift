import SwiftUI
import TradeboardKit

public struct BoardView: View {
    @Environment(AppModel.self) private var model
    @State private var showCreateSheet = false
    @State private var showSettingsSheet = false
    @State private var showEmergencyKillConfirm = false
    @State private var showDryRunToggleConfirm = false
    @State private var openPlanId: String?

    public init() {}

    private var filteredPlans: [PlanSummary] {
        guard let all = model.board?.plans else { return [] }
        switch model.selectedFilter {
        case .all:
            return all
        case .pendingApproval:
            return all.filter { $0.status.lowercased() == "ready" }
        case .discussion:
            return all.filter { ["draft", "debated"].contains($0.status.lowercased()) }
        case .active:
            return all.filter {
                let s = $0.status.lowercased()
                return s == "approved" || s == "validated" || s == "executing"
            }
        case .executed:
            return all.filter { $0.status.lowercased() == "executed" }
        case .closed:
            return all.filter {
                let s = $0.status.lowercased()
                return ["cancelled", "rejected", "expired", "failed", "stale"].contains(s)
            }
        }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // System Safety Header Banner
                safetyStatusBanner

                // Filter tabs
                filterPicker
                    .padding(.horizontal)
                    .padding(.vertical, 8)

                // Main plan list
                if model.isLoading && model.board == nil {
                    Spacer()
                    ProgressView("Loading Trading Board…")
                    Spacer()
                } else if filteredPlans.isEmpty {
                    emptyStateView
                } else {
                    List {
                        ForEach(filteredPlans) { plan in
                            NavigationLink {
                                PlanDetailView(planId: plan.plan_id)
                            } label: {
                                PlanCardView(plan: plan)
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                            .listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await model.refresh()
                    }
                }
            }
            .navigationTitle("Trading Board")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showSettingsSheet = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                CreatePlanView()
            }
            .sheet(isPresented: $showSettingsSheet) {
                SettingsView()
            }
            .navigationDestination(item: $openPlanId) { id in
                PlanDetailView(planId: id)
            }
            .task(id: model.board?.plans.count ?? 0) {
                #if DEBUG
                // Screenshots and checks without taps: `-openSettings`, or `-openPlan ready|debated`
                // opens the first plan with that status once the board has loaded.
                let args = ProcessInfo.processInfo.arguments
                if args.contains("-openSettings"), model.board != nil { showSettingsSheet = true }
                if let i = args.firstIndex(of: "-openPlan"), i + 1 < args.count, openPlanId == nil,
                   let p = model.board?.plans.first(where: { $0.status.lowercased() == args[i + 1] }) {
                    openPlanId = p.plan_id
                }
                #endif
            }
            .confirmationDialog(
                "Trigger Emergency Kill Switch?",
                isPresented: $showEmergencyKillConfirm,
                titleVisibility: .visible
            ) {
                Button("Activate Emergency Kill", role: .destructive) {
                    Task { await model.emergencyKill() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will immediately cancel all pending orders and stop the executor from placing any new trades.")
            }
            .confirmationDialog(
                model.board?.control.dry_run == true ? "Switch to LIVE Trading?" : "Switch to Dry-Run Mode?",
                isPresented: $showDryRunToggleConfirm,
                titleVisibility: .visible
            ) {
                Button(model.board?.control.dry_run == true ? "Enable LIVE Mode" : "Enable Dry-Run") {
                    let next = !(model.board?.control.dry_run ?? true)
                    Task { await model.toggleDryRun(enabled: next) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(model.board?.control.dry_run == true
                     ? "LIVE orders place real money trades with Robinhood. Ensure your dedicated MCP account has appropriate funds and policy limits."
                     : "Dry-run simulates order validation without routing orders to Robinhood.")
            }
        }
    }

    // MARK: - Safety Status Banner

    private var safetyStatusBanner: some View {
        let control = model.board?.control
        let isDryRun = control?.dry_run ?? true
        let isPaused = control?.paused ?? false
        let isKilled = control?.killed ?? false
        let executors = model.board?.executors ?? []
        let onlineCount = executors.filter(\.online).count

        return VStack(spacing: 8) {
            if isKilled {
                HStack {
                    Image(systemName: "exclamationmark.octagon.fill")
                    Text("EMERGENCY KILL SWITCH ACTIVE")
                        .font(.caption.bold())
                    Spacer()
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.red)
            } else if isPaused {
                HStack {
                    Image(systemName: "pause.circle.fill")
                    Text("BOARD PAUSED — No orders will be executed")
                        .font(.caption.bold())
                    Spacer()
                    Button("Resume") {
                        Task { await model.pauseBoard(paused: false) }
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(Color.orange)
            }

            HStack(spacing: 12) {
                // Mode Pill
                Button {
                    showDryRunToggleConfirm = true
                } label: {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(isDryRun ? Color.blue : Color.green)
                            .frame(width: 8, height: 8)
                        Text(isDryRun ? "DRY-RUN" : "LIVE")
                            .font(.caption.bold())
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(isDryRun ? Color.blue.opacity(0.12) : Color.green.opacity(0.15))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                // Executor Status
                HStack(spacing: 4) {
                    Image(systemName: onlineCount > 0 ? "bolt.horizontal.circle.fill" : "bolt.horizontal.circle")
                        .foregroundStyle(onlineCount > 0 ? .green : .secondary)
                    Text(onlineCount > 0 ? "\(onlineCount) Executor\(onlineCount > 1 ? "s" : "")" : "No Executor")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Emergency Controls
                Menu {
                    Button(isPaused ? "Resume Board" : "Pause Board") {
                        Task { await model.pauseBoard(paused: !isPaused) }
                    }
                    Button(role: .destructive) {
                        showEmergencyKillConfirm = true
                    } label: {
                        Label("Emergency Kill Switch", systemImage: "exclamationmark.octagon")
                    }
                } label: {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(Color.secondary.opacity(0.06))
        }
    }

    // MARK: - Filter Picker

    private var filterPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(PlanFilter.allCases) { filter in
                    Button {
                        model.selectedFilter = filter
                    } label: {
                        Text(filter.rawValue)
                            .font(.subheadline.weight(model.selectedFilter == filter ? .semibold : .regular))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(model.selectedFilter == filter ? Color.accentColor : Color.secondary.opacity(0.12))
                            .foregroundStyle(model.selectedFilter == filter ? Color.white : Color.primary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "tray")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No Plans in \(model.selectedFilter.rawValue)")
                .font(.headline)
            Text("Draft a new plan or wait for discussion agents to propose trades.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Create New Plan") {
                showCreateSheet = true
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.regular)
            .padding(.top, 8)
            Spacer()
        }
    }
}

// MARK: - Plan Card Row

private struct PlanCardView: View {
    let plan: PlanSummary

    private var statusColor: Color {
        switch plan.status.lowercased() {
        case "ready": return .orange
        case "approved": return .green
        case "executed": return .teal
        case "draft", "discussion": return .blue
        case "rejected", "cancelled": return .red
        default: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                // Ticker Symbol
                Text(plan.ticker)
                    .font(.system(.headline, design: .monospaced).bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                Text(plan.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)

                Spacer()

                // Status Badge
                Text(plan.status.uppercased())
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor.opacity(0.15))
                    .foregroundStyle(statusColor)
                    .clipShape(Capsule())
            }

            // Validity & Discussion Row
            HStack(spacing: 12) {
                if let author = plan.author {
                    Label(author.id, systemImage: author.type == "human" ? "person.fill" : "cpu")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text("v\(plan.current_version)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)

                Spacer()

                if let questions = plan.open_questions, questions > 0 {
                    HStack(spacing: 3) {
                        Image(systemName: "questionmark.bubble.fill")
                        Text("\(questions) question\(questions > 1 ? "s" : "")")
                    }
                    .font(.caption2.bold())
                    .foregroundStyle(.orange)
                }
            }
        }
        .padding(14)
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
