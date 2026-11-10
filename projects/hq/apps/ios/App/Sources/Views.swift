// HQ for iPhone: the owner's few minutes a day. Inbox (decide, ready to ship, discussing, working),
// card detail (approve, reject with a reason, discuss), health board, runs, and controls.
import SwiftUI

let tierHelp: [String: String] = [
    "L0": "Just do it: built and merged on green CI",
    "L1": "Build, then ask: a finished change waits for one tap",
    "L2": "Ask, then build: approve before any work starts",
    "L3": "Never autonomous: you run it yourself",
]

func tierColor(_ t: String) -> Color {
    switch t {
    case "L0": return .green
    case "L1": return .blue
    case "L2": return .orange
    default: return .red
    }
}

struct TierBadge: View {
    var tier: String
    var body: some View {
        Text(tier).font(.caption2.weight(.bold)).foregroundStyle(.white)
            .padding(.horizontal, 7).padding(.vertical, 2)
            .background(tierColor(tier), in: Capsule())
            .accessibilityLabel("Tier \(tier): \(tierHelp[tier] ?? "")")
    }
}

struct Chip: View {
    var text: String
    var body: some View {
        Text(text).font(.caption2.weight(.medium)).foregroundStyle(.secondary)
            .padding(.horizontal, 7).padding(.vertical, 2)
            .background(Color.secondary.opacity(0.12), in: Capsule())
    }
}

struct CardRowView: View {
    var card: Card
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                TierBadge(tier: card.tier)
                Chip(text: card.project)
                Chip(text: card.kind)
                Spacer()
                Text(relativeTime(card.created_at)).font(.caption2).foregroundStyle(.secondary)
            }
            Text(card.title).font(.subheadline.weight(.semibold)).lineLimit(2)
            Text(card.why).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
        .padding(.vertical, 3)
    }
}

// MARK: - Inbox

struct InboxView: View {
    @State private var inbox: Inbox?
    @State private var digest: Digest?
    @State private var error: String?

    var body: some View {
        List {
            if let digest {
                Section {
                    HStack {
                        stat("\(digest.needs_you)", "need you")
                        stat("\(digest.shipped)", "shipped 24h")
                        stat("\(digest.failed + digest.runs_failed)", "failed 24h", bad: digest.failed + digest.runs_failed > 0)
                        stat(String(format: "$%.2f", digest.spent_this_week_usd), "this week")
                    }
                    if digest.paused {
                        Label("HQ is paused. Resume it in Settings.", systemImage: "pause.circle").foregroundStyle(.orange)
                    }
                }
            }
            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red) }
            }
            if let inbox {
                group("Decide", inbox.decide, empty: "Nothing to decide. HQ shows at most \(inbox.cap) at a time.")
                group("Ready to ship", inbox.ready, empty: "No finished builds waiting.")
                group("Discussing", inbox.discussing, empty: "No open discussions.")
                group("Working", inbox.working, empty: "Nothing being built.")
                if !inbox.backlog.isEmpty { group("Backlog", inbox.backlog, empty: "") }
            } else if error == nil {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("Inbox")
        .navigationDestination(for: Card.self) { CardDetailView(cardID: $0.id, reasons: inbox?.reject_reasons ?? []) }
        .refreshable { await load() }
        .task { await load() }
    }

    private func stat(_ value: String, _ label: String, bad: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.headline.monospacedDigit()).foregroundStyle(bad ? .red : .primary)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func group(_ title: String, _ cards: [Card], empty: String) -> some View {
        Section {
            if cards.isEmpty {
                Text(empty).font(.footnote).foregroundStyle(.secondary)
            } else {
                ForEach(cards) { c in NavigationLink(value: c) { CardRowView(card: c) } }
            }
        } header: {
            HStack { Text(title); Spacer(); Text("\(cards.count)") }
        }
    }

    private func load() async {
        do {
            async let i = HQClient().inbox()
            async let d = HQClient().digest()
            (inbox, digest) = try await (i, d)
            error = nil
            DigestNotifier.updateBadge(digest?.needs_you ?? 0)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Card

struct CardDetailView: View {
    var cardID: String
    var reasons: [String]
    @Environment(AppModel.self) private var model
    @State private var detail: CardDetail?
    @State private var error: String?
    @State private var busy = false
    @State private var showReject = false
    @State private var customReason = ""
    @State private var comment = ""
    @FocusState private var commentFocused: Bool

    var body: some View {
        Form {
            if let error { Section { Text(error).foregroundStyle(.red) } }
            if let d = detail {
                let c = d.card
                Section {
                    HStack(spacing: 5) { TierBadge(tier: c.tier); Chip(text: c.project); Chip(text: c.kind); Chip(text: c.status.replacingOccurrences(of: "_", with: " ")) }
                    Text(c.title).font(.title3.weight(.semibold))
                    Text("\(tierHelp[c.tier] ?? "") · effort \(c.effort) · risk \(c.risk)\(c.risk_reason.map { " (\($0))" } ?? "") · from \(c.source.scout ?? c.source.agent ?? "unknown")")
                        .font(.caption).foregroundStyle(.secondary)
                    actions(c)
                }
                Section("Why") { Text(c.why).font(.callout) }
                Section("Evidence") { ForEach(c.evidence, id: \.self) { EvidenceView(e: $0) } }
                Section("Plan") { Text(c.plan).font(.callout) }
                Section("How we'll know it worked") { Text(c.verify).font(.callout) }
                if c.branch != nil || c.pr_url != nil {
                    Section("Change") {
                        if let b = c.branch { LabeledContent("Branch", value: b).font(.footnote.monospaced()) }
                        if let p = c.pr_url, let u = URL(string: p) { Link("Open pull request", destination: u) }
                    }
                }
                if !d.attachments.isEmpty {
                    Section("Build & review evidence") {
                        ForEach(d.attachments) { a in
                            if a.evidence.type == "screenshot", let key = a.file_key { RemoteImage(key: key, caption: a.evidence.text ?? "") }
                            else { EvidenceView(e: a.evidence, phase: a.phase) }
                        }
                    }
                }
                Section("Discussion") {
                    if d.comments.isEmpty { Text("No discussion yet.").font(.footnote).foregroundStyle(.secondary) }
                    ForEach(d.comments) { m in
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(m.author == "owner" ? "You" : m.author) · \(relativeTime(m.created_at))").font(.caption2).foregroundStyle(.secondary)
                            Text(m.body).font(.callout)
                        }
                    }
                    TextField("Ask a question or suggest a change", text: $comment, axis: .vertical)
                        .lineLimit(2...6).focused($commentFocused)
                    Button("Send") { Task { await act { try await HQClient().comment(cardID, comment); comment = "" } } }
                        .disabled(comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy)
                }
                if !d.decisions.isEmpty || !d.runs.isEmpty {
                    Section("History") {
                        ForEach(d.decisions, id: \.self) { x in Text("\(x.decision) by \(x.by)\(x.reason.map { " — “\($0)”" } ?? "") · \(relativeTime(x.at))").font(.caption) }
                        ForEach(d.runs) { r in Text("\(r.kind) run \(r.status)\(r.summary.map { ": \($0)" } ?? "") · \(String(format: "$%.2f", r.cost_usd ?? 0))").font(.caption) }
                    }
                }
            } else if error == nil {
                ProgressView()
            }
        }
        .navigationTitle(cardID)
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Why reject it? Your reason teaches the scouts.", isPresented: $showReject, titleVisibility: .visible) {
            ForEach(reasons, id: \.self) { r in Button(r) { Task { await act { try await HQClient().decide(cardID, approve: false, reason: r) } } } }
            Button("Cancel", role: .cancel) {}
        }
        .refreshable { await load() }
        .task { await load() }
    }

    @ViewBuilder private func actions(_ c: Card) -> some View {
        switch model.canDecide ? c.status : "read-only" {
        case "proposed", "discussing":
            VStack(spacing: 8) {
                Button { Task { await act { try await HQClient().decide(cardID, approve: true) } } } label: { Label("Approve", systemImage: "checkmark").frame(maxWidth: .infinity) }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                HStack {
                    Button(role: .destructive) { showReject = true } label: { Label("Reject", systemImage: "xmark").frame(maxWidth: .infinity) }
                        .buttonStyle(.bordered)
                    Button { commentFocused = true } label: { Label("Discuss", systemImage: "bubble.left").frame(maxWidth: .infinity) }
                        .buttonStyle(.bordered)
                }
            }.disabled(busy).font(.subheadline.weight(.semibold))
        case "in_review":
            VStack(spacing: 8) {
                Button { Task { await act { try await HQClient().setStatus(cardID, "shipped") } } } label: { Text("Mark shipped").frame(maxWidth: .infinity) }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                HStack {
                    Button { Task { await act { try await HQClient().setStatus(cardID, "approved") } } } label: { Text("Build again").frame(maxWidth: .infinity) }.buttonStyle(.bordered)
                    Button(role: .destructive) { showReject = true } label: { Text("Reject").frame(maxWidth: .infinity) }.buttonStyle(.bordered)
                }
            }.disabled(busy).font(.subheadline.weight(.semibold))
        case "failed":
            Button("Retry build") { Task { await act { try await HQClient().setStatus(cardID, "approved") } } }.disabled(busy)
        default:
            EmptyView()
        }
    }

    private func act(_ fn: () async throws -> Void) async {
        busy = true
        defer { busy = false }
        do {
            try await fn()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do { detail = try await HQClient().card(cardID); error = nil } catch { self.error = error.localizedDescription }
    }
}

struct EvidenceView: View {
    var e: Evidence
    var phase: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 5) {
                Chip(text: phase.map { "\($0) · \(e.type)" } ?? e.type)
                if e.type == "metric", let v = e.value {
                    Text("\(e.name ?? "metric"): \(v.formatted()) \(e.unit ?? "")").font(.caption.weight(.semibold))
                }
            }
            if let ref = e.ref {
                if ref.hasPrefix("http"), let u = URL(string: ref) { Link(ref, destination: u).font(.caption).lineLimit(2) }
                else { Text(ref).font(.caption.monospaced()).lineLimit(3) }
            }
            if let t = e.text { Text(t).font(e.type == "log" || e.type == "test" || e.type == "commit" ? .caption2.monospaced() : .caption).lineLimit(14) }
            if let s = e.source { Text("source: \(s)").font(.caption2).foregroundStyle(.secondary) }
        }
    }
}

struct RemoteImage: View {
    var key: String
    var caption: String
    @State private var image: UIImage?
    var body: some View {
        VStack(alignment: .leading) {
            if let image { Image(uiImage: image).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 8)) }
            else { ProgressView() }
            Text(caption).font(.caption2).foregroundStyle(.secondary)
        }
        .task { if let d = try? await HQClient().file(key) { image = UIImage(data: d) } }
    }
}

// MARK: - Health

struct HealthView: View {
    @State private var board: HealthBoard?
    @State private var error: String?
    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            if let b = board {
                Section { LabeledContent("Spend this week", value: String(format: "$%.2f%@", b.spent_this_week_usd, b.weekly_budget_usd.map { String(format: " of $%.0f", $0) } ?? "")) }
                ForEach(b.projects) { p in
                    HStack(alignment: .top) {
                        Image(systemName: p.health == nil ? "circle.dashed" : (p.health!.ok ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"))
                            .foregroundStyle(p.health == nil ? .secondary : (p.health!.ok ? Color.green : Color.red))
                        VStack(alignment: .leading, spacing: 2) {
                            HStack { Text(p.project).font(.subheadline.weight(.semibold)); if let t = p.tier_ceiling { TierBadge(tier: t) } }
                            if let h = p.health {
                                Text(["ci", "latest_release", "workflows_failing", "isolation"].compactMap { k in h.data[k].map { "\(k.replacingOccurrences(of: "_", with: " ")): \($0)" } }.joined(separator: " · "))
                                    .font(.caption).foregroundStyle(.secondary)
                                Text("\(p.open_cards) open · checked \(relativeTime(h.at))").font(.caption2).foregroundStyle(.secondary)
                            } else {
                                Text("No report yet").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            } else if error == nil { ProgressView() }
        }
        .navigationTitle("Health")
        .refreshable { await load() }
        .task { await load() }
    }
    private func load() async {
        do { board = try await HQClient().health(); error = nil } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Runs

struct RunsView: View {
    @State private var runs: [RunRow] = []
    @State private var error: String?
    var body: some View {
        List {
            Section {
                Button("Run the CEO now") { Task { try? await HQClient().startRun(kind: "ceo"); await load() } }
                Button("Check health now") { Task { try? await HQClient().startRun(kind: "health"); await load() } }
            }
            if let error { Text(error).foregroundStyle(.red) }
            ForEach(runs) { r in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        Chip(text: r.kind)
                        Text(r.status).font(.caption.weight(.semibold)).foregroundStyle(r.status == "failed" ? .red : r.status == "done" ? .green : .primary)
                        Text([r.scout, r.verb, r.project].compactMap { $0 }.joined(separator: " · ")).font(.caption).lineLimit(1)
                        Spacer()
                        Text(String(format: "$%.2f", r.cost_usd ?? 0)).font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    if let s = r.summary { Text(s).font(.caption).foregroundStyle(.secondary).lineLimit(6) }
                    Text(relativeTime(r.created_at)).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Runs")
        .refreshable { await load() }
        .task { await load() }
    }
    private func load() async {
        do { runs = try await HQClient().runs(); error = nil } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Settings: workspace, members, kill switch

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var members: [Member] = []
    @State private var paused: Bool?
    @State private var invite: Invite?
    @State private var error: String?
    @State private var confirmDelete = false

    var body: some View {
        Form {
            if let ws = model.current {
                Section("Workspace") {
                    Picker("Workspace", selection: Binding(get: { ws.id }, set: { model.select($0) })) {
                        ForEach(model.workspaces) { w in Text(w.name).tag(w.id) }
                    }
                    LabeledContent("Repository", value: ws.repo).font(.footnote)
                    LabeledContent("Your role", value: ws.role)
                    NavigationLink("New workspace") { WorkspaceSetupView(first: false) }
                }
                Section {
                    ForEach(members) { m in
                        HStack { Text(m.email ?? m.user_id).lineLimit(1); Spacer(); Chip(text: m.role) }
                    }
                    if model.isAdmin {
                        Menu("Invite someone") {
                            ForEach(["approver", "viewer", "admin"], id: \.self) { r in
                                Button("as \(r)") { Task { do { invite = try await HQClient().invite(role: r) } catch { self.error = error.localizedDescription } } }
                            }
                        }
                    }
                    if let invite {
                        let link = "\(Backend.shared.config.site.absoluteString)/#/join/\(invite.code)"
                        ShareLink(item: link) { Label("Share invite link (\(invite.role), until \(invite.expires_at.prefix(10)))", systemImage: "square.and.arrow.up") }
                    }
                } header: { Text("Members") } footer: { Text("admin: members, tokens, kill switch · approver: approve, reject, ship, run verbs · viewer: read and comment") }
                Section {
                    if let paused {
                        if model.isAdmin {
                            Button(paused ? "Resume HQ" : "Pause everything", role: paused ? nil : .destructive) {
                                Task { try? await HQClient().setPaused(!paused); self.paused = !paused }
                            }
                        } else {
                            Text(paused ? "Paused" : "Running")
                        }
                    } else { ProgressView() }
                } header: { Text("Kill switch") } footer: { Text("Paused: no scouts, no builds, no verbs except the ones a person starts.") }
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
            Section {
                Button("Allow a digest notification") { Task { await DigestNotifier.requestPermission() } }
            } footer: { Text("HQ checks in the background and tells you how many cards need you.") }
            Section {
                if let e = model.email { LabeledContent("Signed in as", value: e).font(.footnote) }
                Button("Sign out", role: .destructive) { model.signOut() }
                Button("Delete account", role: .destructive) { confirmDelete = true }
            } footer: {
                Text("Deleting removes your memberships and every workspace where you're the only member. Team workspaces keep their history, and another member becomes admin if you were the only one.")
            }
            Section {
                Link("Privacy Policy", destination: Backend.shared.config.site.appendingPathComponent("privacy/"))
                Link("Terms of Use", destination: Backend.shared.config.site.appendingPathComponent("terms/"))
                Link("Support", destination: Backend.shared.config.site.appendingPathComponent("support/"))
            }
        }
        .confirmationDialog("Delete your HQ account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete account", role: .destructive) {
                Task {
                    var code: String?
                    if Backend.shared.session?.signedInWithApple == true { code = await AppleReauthorization().authorizationCode() }
                    do { try await HQClient().deleteAccount(appleAuthorizationCode: code); model.signOut() }
                    catch { self.error = error.localizedDescription }
                }
            }
        } message: { Text("This can't be undone.") }
        .navigationTitle("Settings")
        .task {
            paused = (try? await HQClient().health())?.paused
            members = (try? await HQClient().members()) ?? []
        }
    }
}

/// First run (no workspace yet) or "New workspace": create one for a repo, or join with an invite.
struct WorkspaceSetupView: View {
    var first: Bool
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var repo = ""
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                TextField("Name, e.g. Acme", text: $name)
                TextField("owner/repo on GitHub", text: $repo).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button(busy ? "Creating…" : "Create workspace") {
                    Task {
                        busy = true; defer { busy = false }
                        do { let w = try await HQClient().createWorkspace(name: name, repo: repo); model.select(w.id); await model.load() }
                        catch { self.error = error.localizedDescription }
                    }
                }.disabled(busy || name.isEmpty || repo.isEmpty)
            } header: { Text("Create") } footer: { Text("A workspace is one repository and the people who work on it. HQ is built for a monorepo: one .hq/ at the root and one per project.") }
            Section {
                TextField("Invite code (hqi_…)", text: $code).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button("Join") { Task { await model.join(code.components(separatedBy: "/").last ?? code); error = model.error } }.disabled(code.isEmpty)
            } header: { Text("Or join a team") } footer: { Text("Paste the invite link or code a workspace admin sent you.") }
            if let error { Section { Text(error).foregroundStyle(.red) } }
            if first { Section { Button("Sign out", role: .destructive) { model.signOut() } } }
        }
        .navigationTitle(first ? "Set up HQ" : "New workspace")
    }
}
