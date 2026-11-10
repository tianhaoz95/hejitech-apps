import SwiftUI
import TradeboardKit

public struct PlanDetailView: View {
    let planId: String
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab = 0
    @State private var commentText = ""
    @State private var isQuestion = false
    @State private var showApproveConfirm = false
    @State private var approvalNote = ""
    @State private var showRejectPrompt = false
    @State private var rejectReason = ""
    @State private var showRequestChangesPrompt = false
    @State private var changeRequestText = ""

    public init(planId: String) {
        self.planId = planId
    }

    private var plan: PlanDetail? {
        model.selectedPlan
    }

    public var body: some View {
        Group {
            if let plan = plan, plan.plan_id == planId {
                planContent(plan)
            } else {
                ProgressView("Loading Plan Details…")
            }
        }
        .navigationTitle(plan?.ticker ?? "Plan")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await model.loadPlan(id: planId)
        }
        .refreshable {
            await model.loadPlan(id: planId)
        }
        .sheet(isPresented: $showApproveConfirm) {
            approveSheet(plan)
        }
        .alert("Reject Plan", isPresented: $showRejectPrompt) {
            TextField("Reason for rejection", text: $rejectReason)
            Button("Reject Plan", role: .destructive) {
                Task {
                    _ = await model.rejectPlan(planId: planId, reason: rejectReason)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Provide a reason explaining why this trade plan is rejected.")
        }
        .alert("Request Changes", isPresented: $showRequestChangesPrompt) {
            TextField("Describe needed changes", text: $changeRequestText)
            Button("Send Request") {
                Task {
                    _ = await model.requestChanges(planId: planId, body: changeRequestText)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Discussion agents will review this request and propose revisions.")
        }
    }

    // MARK: - Main Plan View

    private func planContent(_ plan: PlanDetail) -> some View {
        VStack(spacing: 0) {
            // Execution Mode Banner
            executionSafetyNotice(plan)

            ScrollView {
                VStack(spacing: 16) {
                    // Order Ticket Box
                    orderTicketCard(plan)

                    // Human Action Bar
                    humanActionBar(plan)

                    // Tab Selector
                    Picker("Section", selection: $selectedTab) {
                        Text("Thesis").tag(0)
                        Text("Discussion (\(plan.comments?.count ?? 0))").tag(1)
                        Text("Receipts (\(plan.receipts?.count ?? 0))").tag(2)
                        Text("Audit").tag(3)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Tab Contents
                    switch selectedTab {
                    case 0:
                        thesisSection(plan)
                    case 1:
                        discussionSection(plan)
                    case 2:
                        receiptsSection(plan)
                    case 3:
                        auditSection(plan)
                    default:
                        EmptyView()
                    }
                }
                .padding(.vertical, 12)
            }
        }
    }

    // MARK: - Safety Banner

    private func executionSafetyNotice(_ plan: PlanDetail) -> some View {
        let isDryRun = model.board?.control.dry_run ?? true
        let status = plan.status.lowercased()

        return HStack(spacing: 8) {
            Image(systemName: isDryRun ? "checkmark.shield" : "exclamationmark.triangle.fill")
                .foregroundStyle(isDryRun ? Color.blue : Color.orange)

            VStack(alignment: .leading, spacing: 2) {
                Text(isDryRun ? "DRY-RUN MODE" : "LIVE TRADING MODE")
                    .font(.caption2.bold())
                    .foregroundStyle(isDryRun ? Color.blue : Color.orange)

                Text(status == "approved"
                     ? "Plan approved. Executor claims and executes during market hours."
                     : "Approval requires explicit human authorization.")
                    .font(.caption2)
                    .foregroundStyle(Color.secondary)
            }

            Spacer()

            Text(plan.status.uppercased())
                .font(.caption2.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.secondary.opacity(0.15))
                .clipShape(Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background((isDryRun ? Color.blue : Color.orange).opacity(0.08))
    }

    // MARK: - Order Ticket Card

    private func orderTicketCard(_ plan: PlanDetail) -> some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ORDER TICKET")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                    Text(plan.title)
                        .font(.headline)
                }
                Spacer()
                Text("v\(plan.current_version)")
                    .font(.caption.monospaced())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }

            Divider()

            // Key Trade Details Grid
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 10) {
                GridRow {
                    ticketField(label: "SYMBOL", value: plan.ticker, isBold: true)
                    ticketField(label: "ACTION", value: plan.side.uppercased(), isBold: true)
                    ticketField(label: "ORDER TYPE", value: plan.order.order_type.uppercased())
                }

                GridRow {
                    if let shares = plan.order.quantity_shares {
                        ticketField(label: "QUANTITY", value: "\(shares) shares")
                    } else if let dollars = plan.order.quantity_dollars {
                        ticketField(label: "DOLLAR AMOUNT", value: String(format: "$%.2f", dollars))
                    } else {
                        ticketField(label: "QUANTITY", value: "—")
                    }

                    if let limit = plan.order.limit_price {
                        ticketField(label: "LIMIT PRICE", value: String(format: "$%.2f", limit))
                    } else {
                        ticketField(label: "LIMIT PRICE", value: "Market")
                    }

                    ticketField(label: "EST. NOTIONAL", value: String(format: "$%.2f", plan.order.estimatedNotional), isBold: true)
                }

                GridRow {
                    ticketField(label: "TIME IN FORCE", value: plan.order.time_in_force?.uppercased() ?? "DAY")
                    ticketField(label: "VALID UNTIL", value: plan.valid_until.prefix(16).replacingOccurrences(of: "T", with: " "))
                    ticketField(label: "ACCOUNT", value: "Dedicated MCP")
                }
            }
        }
        .padding(16)
        .background(Color.yellow.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.yellow.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
    }

    private func ticketField(label: String, value: String, isBold: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(.subheadline, design: .monospaced).weight(isBold ? .bold : .regular))
        }
    }

    // MARK: - Human Action Bar

    private func humanActionBar(_ plan: PlanDetail) -> some View {
        let status = plan.status.lowercased()

        return HStack(spacing: 12) {
            if status == "ready" {
                Button {
                    showApproveConfirm = true
                } label: {
                    Label("Approve Plan", systemImage: "checkmark.seal.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)

                Button {
                    showRequestChangesPrompt = true
                } label: {
                    Image(systemName: "pencil.and.outline")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.bordered)

                Button {
                    showRejectPrompt = true
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.bordered)
                .tint(.red)
            } else if status == "draft" || status == "discussion" {
                Button {
                    Task { _ = await model.markReady(planId: plan.plan_id) }
                } label: {
                    Label("Mark as Ready", systemImage: "flag.checkered")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)

                Button("Cancel Plan", role: .destructive) {
                    Task { _ = await model.cancelPlan(planId: plan.plan_id) }
                }
                .buttonStyle(.bordered)
            } else if status == "approved" {
                if let app = plan.approval {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Approved v\(app.version)")
                            .font(.subheadline.bold())
                            .foregroundStyle(.green)
                        Text("Expires: \(app.expires_at.prefix(16).replacingOccurrences(of: "T", with: " "))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }

                Button("Cancel Order", role: .destructive) {
                    Task { _ = await model.cancelPlan(planId: plan.plan_id, reason: "Cancelled by owner") }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Thesis Section

    private func thesisSection(_ plan: PlanDetail) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            detailBlock(title: "Thesis & Rationale", content: plan.thesis ?? "None provided")
            if let evidence = plan.evidence, !evidence.isEmpty {
                detailBlock(title: "Evidence & Catalysts", content: evidence)
            }
            if let risks = plan.risks_and_dissent, !risks.isEmpty {
                detailBlock(title: "Risks & Dissent", content: risks)
            }
            if let invalidation = plan.invalidation, !invalidation.isEmpty {
                detailBlock(title: "Invalidation Triggers", content: invalidation)
            }
            if let fit = plan.fit_with_strategy, !fit.isEmpty {
                detailBlock(title: "Strategy Alignment", content: fit)
            }
        }
        .padding(.horizontal)
    }

    private func detailBlock(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)
            Text(content)
                .font(.body)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.secondary.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Discussion Section

    private func discussionSection(_ plan: PlanDetail) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            let comments = plan.comments ?? []
            if comments.isEmpty {
                Text("No discussion or questions yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(comments) { comment in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Label(comment.author_id, systemImage: comment.author_type == "human" ? "person.fill" : "cpu")
                                .font(.caption.bold())
                                .foregroundStyle(comment.author_type == "human" ? Color.accentColor : Color.secondary)

                            if comment.is_question == true {
                                Text("QUESTION")
                                    .font(.system(size: 9, weight: .bold))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.orange.opacity(0.15))
                                    .foregroundStyle(.orange)
                                    .clipShape(Capsule())
                            }

                            Spacer()

                            Text(comment.created_at.prefix(16).replacingOccurrences(of: "T", with: " "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        Text(comment.body)
                            .font(.callout)
                            .textSelection(.enabled)
                    }
                    .padding(12)
                    .background(Color.secondary.opacity(comment.author_type == "human" ? 0.1 : 0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }

            // Comment input
            VStack(spacing: 8) {
                HStack {
                    TextField("Add comment or answer…", text: $commentText)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        let text = commentText
                        let question = isQuestion
                        commentText = ""
                        Task {
                            _ = await model.addComment(planId: plan.plan_id, body: text, isQuestion: question)
                        }
                    } label: {
                        Image(systemName: "paperplane.fill")
                    }
                    .disabled(commentText.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                Toggle(isOn: $isQuestion) {
                    Text("Ask as question to discussion agents")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.top, 8)
        }
        .padding(.horizontal)
    }

    // MARK: - Receipts Section

    private func receiptsSection(_ plan: PlanDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            let receipts = plan.receipts ?? []
            if receipts.isEmpty {
                Text("No execution receipts. Order has not been executed.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(receipts) { r in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(r.outcome.uppercased())
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(r.outcome == "success" ? Color.green.opacity(0.15) : Color.red.opacity(0.15))
                                .foregroundStyle(r.outcome == "success" ? .green : .red)
                                .clipShape(Capsule())

                            Text(r.mode.uppercased())
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)

                            Spacer()

                            Text(r.attempted_at.prefix(16).replacingOccurrences(of: "T", with: " "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        if let id = r.robinhood_order_id {
                            Text("Robinhood Order: \(id)")
                                .font(.footnote.monospaced())
                        }
                        if let q = r.filled_quantity, let p = r.filled_price {
                            Text(String(format: "Filled: %.2f shares @ $%.2f", q, p))
                                .font(.subheadline.bold())
                        }
                        if let reason = r.reason_text {
                            Text(reason)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                        if let fit = r.strategy_fit {
                            HStack {
                                Text("Model Advisory: \(fit.fit.uppercased())")
                                    .font(.caption2.bold())
                                Text("(\(fit.note))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.secondary.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Audit Section

    private func auditSection(_ plan: PlanDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            let audit = plan.audit ?? []
            ForEach(audit) { ev in
                HStack(alignment: .top, spacing: 12) {
                    Circle()
                        .fill(Color.secondary.opacity(0.4))
                        .frame(width: 8, height: 8)
                        .padding(.top, 5)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(ev.action)
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(ev.created_at.prefix(16).replacingOccurrences(of: "T", with: " "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Text("\(ev.actor_type): \(ev.actor_id)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Approve Sheet

    private func approveSheet(_ plan: PlanDetail?) -> some View {
        NavigationStack {
            VStack(spacing: 20) {
                let isDryRun = model.board?.control.dry_run ?? true

                VStack(spacing: 8) {
                    Image(systemName: isDryRun ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(isDryRun ? Color.blue : Color.orange)

                    Text(isDryRun ? "Approve Dry-Run Plan" : "Approve LIVE Order")
                        .font(.title2.bold())

                    Text(isDryRun
                         ? "This plan will be simulated and validated by the executor."
                         : "WARNING: This plan will place a REAL order on Robinhood for up to $\(String(format: "%.2f", plan?.order.estimatedNotional ?? 0)).")
                        .font(.callout)
                        .foregroundStyle(isDryRun ? Color.secondary : Color.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                TextField("Optional approval note", text: $approvalNote)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal)

                Spacer()

                Button {
                    if let plan {
                        Task {
                            let ok = await model.approvePlan(planId: plan.plan_id, version: plan.current_version, note: approvalNote)
                            if ok { showApproveConfirm = false }
                        }
                    }
                } label: {
                    Text(isDryRun ? "Confirm Dry-Run Approval" : "Confirm & Authorize LIVE Trade")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(isDryRun ? .blue : .green)
                .padding(.horizontal)

                Button("Cancel", role: .cancel) {
                    showApproveConfirm = false
                }
                .padding(.bottom)
            }
            .padding()
            .navigationTitle("Human Approval")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private extension Color {
    static var amber: Color { Color(red: 0.85, green: 0.55, blue: 0.0) }
}
