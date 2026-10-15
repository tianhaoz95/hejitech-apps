import CoreImage.CIFilterBuiltins
import LogCore
import StoreKit
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @State private var draft = Household()
    @State private var invite: String?
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NavigationLink { PaywallView() } label: {
                        HStack {
                            Label("Subscription", systemImage: "star.circle.fill")
                            Spacer()
                            Text(Self.describe(model.entitlement?.access(now: Date()))).foregroundStyle(.secondary)
                        }
                    }
                }
                Section("Baby") {
                    TextField("Name", text: $draft.babyName)
                    DatePicker("Born", selection: Binding(get: { draft.birthDate ?? Date() }, set: { draft.birthDate = $0 }), displayedComponents: .date)
                }
                Section("Tracking") {
                    ForEach(EventRegistry.shared.categories, id: \.id) { c in
                        Toggle(c.label, isOn: Binding(get: { draft.categories.contains(c.id) }, set: { on in
                            draft.categories.removeAll { $0 == c.id }
                            if on { draft.categories.append(c.id) }
                        }))
                    }
                    Picker("Quick feed starts", selection: $draft.defaultFeed) {
                        Text("Bottle").tag("bottle")
                        Text("Breastfeeding").tag("breast")
                    }
                    Stepper("Bottle size \(Int(draft.bottleMl)) ml", value: $draft.bottleMl, in: 30...360, step: 10)
                }
                Section {
                    IntervalPicker(title: "Feed every", minutes: $draft.reminders.feedEveryMinutes)
                    IntervalPicker(title: "Diaper check every", minutes: $draft.reminders.diaperEveryMinutes)
                    Stepper("Sound after \(draft.reminders.overdueMarginMinutes) min overdue", value: $draft.reminders.overdueMarginMinutes, in: 5...90, step: 5)
                    if let suggestion = ReminderPlanner.suggestedFeedInterval(log: model.log, now: Date()) {
                        Button("Use your last 3 days: every \(StatusSnapshot.duration(Double(suggestion) * 60))") {
                            draft.reminders.feedEveryMinutes = suggestion
                        }
                    }
                } header: { Text("Reminders") } footer: {
                    Text("Use your pediatrician's guidance. Reminders go to whoever is on duty, as a tap on the wrist first and a sound only when overdue.")
                }
                Section {
                    Button("Save changes") { Task { await model.save(draft) } }.disabled(draft == model.household)
                }
                Section("Household") {
                    ForEach(model.household.caregivers) { c in Label(c.name, systemImage: c.id == model.me ? "person.fill" : "person") }
                    Button("Invite a caregiver") { Task { invite = await model.invite() } }
                    if let invite {
                        VStack(spacing: 8) {
                            QRCode(text: "weehours://join/\(invite)").frame(width: 160, height: 160)
                            Text(invite).font(.title2.monospaced().bold())
                            Text("Enter this code in the app on their phone. Valid for 7 days.").font(.caption).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                Section("Voice") {
                    Picker("Decision model", selection: Binding(get: { model.decisionBackend }, set: { model.decisionBackend = $0 })) {
                        ForEach(DecisionBackend.allCases) { Text($0.rawValue).tag($0) }
                    }
                    ModelDownloadRow()
                    if model.decisionBackend == .devServer {
                        TextField("llama-server URL", text: $model.devServer).textInputAutocapitalization(.never)
                    }
                }
                Section {
                    NavigationLink { AgentsView() } label: { Label("AI agents (MCP)", systemImage: "sparkles") }
                    if let url = model.exportCSV() {
                        ShareLink(item: url) { Label("Export CSV", systemImage: "square.and.arrow.up") }
                    }
                } footer: {
                    Text("The app records facts. Ask the assistant you already use to analyze them through MCP.")
                }
                Section("Account") {
                    if let email = model.email { LabeledContent("Signed in", value: email) }
                    if let last = model.lastSync { LabeledContent("Last sync", value: last.formatted(date: .omitted, time: .standard)) }
                    if let e = model.syncError { Text("Offline: \(e)").font(.caption).foregroundStyle(.orange) }
                    Button("Sync now") { Task { await model.syncNow() } }
                    Button("Sign out") { model.signOut() }
                    Button("Delete all household data", role: .destructive) { confirmDelete = true }
                }
            }
            .navigationTitle("Settings")
            .onAppear { draft = model.household }
            .confirmationDialog("Delete every entry, capture and token for this household? This cannot be undone.", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) { Task { await model.deleteAllData() } }
            }
        }
    }

    static func describe(_ access: Entitlement.Access?) -> String {
        switch access {
        case .trial(let d): return "Trial · \(d) days left"
        case .subscribed(let p, _): return p.rawValue.capitalized
        case .lifetime: return "Lifetime"
        case .expired: return "Expired"
        case nil: return "…"
        }
    }
}

struct IntervalPicker: View {
    let title: String
    @Binding var minutes: Int?

    var body: some View {
        Picker(title, selection: $minutes) {
            Text("Off").tag(Int?.none)
            ForEach([90, 120, 150, 180, 210, 240, 300, 360], id: \.self) { m in
                Text(StatusSnapshot.duration(Double(m) * 60)).tag(Int?.some(m))
            }
        }
    }
}

struct ModelDownloadRow: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var models: ModelManager

    init() { models = ModelManagerHolder.shared }

    var body: some View {
        if models.isBundled {
            Label("Laya included with the app", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
        } else if models.isDownloaded {
            Label("Laya on this iPhone (449 MB)", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
        } else if models.progress != nil {
            HStack { ProgressView(); Text("Downloading Laya…") }
        } else {
            Button("Download Laya (449 MB, Wi-Fi)") {
                Task { await model.models.download(); await model.rebuildInterpreter() }
            }
            if let e = models.error { Text(e).font(.caption).foregroundStyle(.red) }
        }
    }
}

@MainActor
enum ModelManagerHolder {
    static var shared = ModelManager()
}

struct QRCode: View {
    let text: String
    var body: some View {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        let image = filter.outputImage.flatMap { CIContext().createCGImage($0.transformed(by: .init(scaleX: 8, y: 8)), from: $0.transformed(by: .init(scaleX: 8, y: 8)).extent) }
        return Group {
            if let image { Image(decorative: image, scale: 1).interpolation(.none).resizable().scaledToFit() } else { Color.clear }
        }
    }
}

// MARK: - Agents

struct AgentsView: View {
    @EnvironmentObject var model: AppModel
    @State private var name = "My assistant"
    @State private var write = false
    @State private var created: String?

    var body: some View {
        Form {
            Section {
                LabeledContent("Server URL") { Text(model.mcpURL).font(.caption.monospaced()).textSelection(.enabled) }
                Text("Agents that support OAuth sign in with the same account as this app. For others, create a token below.")
                    .font(.footnote).foregroundStyle(.secondary)
            } header: { Text("MCP server") }
            Section("New token") {
                TextField("Name", text: $name)
                Toggle("Allow logging (write)", isOn: $write)
                Button("Create token") { Task { created = await model.createToken(name: name, write: write) } }
                if let created {
                    Text(created).font(.caption.monospaced()).textSelection(.enabled)
                    Text("Copy it now; it is shown once.").font(.caption).foregroundStyle(.orange)
                }
            }
            Section("Tokens") {
                ForEach(model.tokens) { t in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(t.name)
                            Text("\(t.scope) · \(t.lastUsedAt.map { "used \($0.formatted(.relative(presentation: .named)))" } ?? "never used")")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if t.revokedAt == nil {
                            Button("Revoke", role: .destructive) { Task { await model.revoke(t) } }.buttonStyle(.borderless)
                        } else {
                            Text("revoked").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("AI agents")
        .task { await model.loadTokens() }
    }
}

// MARK: - Paywall (StoreKit 2, local .storekit configuration in development)

struct PaywallView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Wee Hours Plus").font(.largeTitle.bold())
                Text(SettingsView.describe(model.entitlement?.access(now: Date()))).foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 8) {
                    Label("Voice logging with the on-device model", systemImage: "mic.fill")
                    Label("Apple Watch and Even G2 glasses + ring", systemImage: "applewatch")
                    Label("Reminders for whoever is on duty", systemImage: "bell.fill")
                    Label("Your AI assistant over MCP", systemImage: "sparkles")
                    Label("One purchase covers both parents", systemImage: "person.2.fill")
                }
                .font(.subheadline)
                Text("Tap logging is always free, so you never lose access to your log.").font(.footnote).foregroundStyle(.secondary)
                ForEach(model.billing.products, id: \.id) { p in
                    Button { Task { await model.buy(p) } } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(p.displayName).font(.headline)
                                Text(p.description).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(p.displayPrice).font(.headline)
                        }
                        .padding()
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("buy-\(p.id)")
                }
                if model.billing.products.isEmpty {
                    // Dummy store: used when StoreKit has no products (simulator launched outside
                    // Xcode, CI). Same entitlement path as a real purchase.
                    ForEach(DummyStore.plans, id: \.plan) { item in
                        Button { Task { await model.buyDummy(item.plan) } } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(item.name).font(.headline)
                                    Text(item.detail).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(item.price).font(.headline)
                            }
                            .padding()
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("buy-\(item.plan.rawValue)")
                    }
                    Text("Dummy store · no money moves. Run from Xcode to use the StoreKit test configuration.").font(.caption).foregroundStyle(.secondary)
                }
                Button("Restore purchases") { Task { await model.restorePurchases() } }
            }
            .padding()
        }
        .task { await model.billing.load() }
    }
}

enum DummyStore {
    struct Item { let plan: Plan; let name: String; let detail: String; let price: String; let days: Int? }
    static let plans = [
        Item(plan: .monthly, name: "Monthly", detail: "Voice, watch, glasses, reminders and agents.", price: "$4.99", days: 30),
        Item(plan: .yearly, name: "Yearly", detail: "Everything in Plus, billed yearly.", price: "$39.99", days: 365),
        Item(plan: .lifetime, name: "Lifetime", detail: "Everything, forever. One purchase for the household.", price: "$79.99", days: nil),
    ]
}
