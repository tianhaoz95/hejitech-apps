import LogCore
import SwiftUI

/// Settings → Even G2 glasses: pair the Wee Hours glasses app (Even Hub) with this household and
/// manage paired glasses. A pairing code is traded on the glasses' page in the Even app for a device
/// token (`glasses:<label>`), so the glasses never see this account's sign-in.
struct GlassesSettingsView: View {
    @EnvironmentObject var model: AppModel
    @State private var pairing: AppModel.GlassesPairing?
    @State private var asking = false
    @State private var justPaired: String?

    private var active: [AccessToken] { model.glasses.filter { $0.revokedAt == nil } }
    private var revoked: [AccessToken] { model.glasses.filter { $0.revokedAt != nil } }

    var body: some View {
        Form {
            if model.localOnly {
                Section {
                    NavigationLink { AttachAccountView() } label: { Label("Sign in to sync and share", systemImage: "person.crop.circle.badge.plus") }
                } footer: {
                    Text("The glasses log into your household's shared log, so they need an account. Signing in uploads everything logged on this iPhone.")
                }
            } else if !model.allows(.glasses) {
                Section {
                    NavigationLink { PaywallView() } label: { Label("See plans", systemImage: "star.circle") }
                } footer: {
                    Text("Your free trial has ended. Glasses are part of every plan; logging on this iPhone keeps working either way.")
                }
            } else {
                pairSection
            }
            if !active.isEmpty || !revoked.isEmpty {
                Section("Paired glasses") {
                    ForEach(active) { t in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(Self.label(t))
                                Text(t.lastUsedAt.map { "last seen \($0.formatted(.relative(presentation: .named)))" } ?? "paired \(t.createdAt.formatted(.relative(presentation: .named)))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Unpair", role: .destructive) { Task { await model.revoke(t) } }
                                .buttonStyle(.borderless)
                        }
                    }
                    ForEach(revoked) { t in
                        HStack {
                            Text(Self.label(t)).foregroundStyle(.secondary)
                            Spacer()
                            Text("unpaired").font(.caption).foregroundStyle(.secondary)
                            Button("Remove") { Task { await model.delete(t) } }.buttonStyle(.borderless)
                        }
                    }
                }
            }
            Section("On the glasses") {
                LabeledContent("Press", value: "Start or finish a feed")
                LabeledContent("Double press", value: "Diaper")
                LabeledContent("Swipe", value: "Sleep, side, child, duty, undo")
                LabeledContent("Hold", value: "Speak an entry")
            }
            Section {
            } footer: {
                Text("Gestures go straight into your household's log. What you say while holding is sent to your household, and a phone with Wee Hours turns it into an entry the next time the app opens, on the phone, never on a server.")
            }
        }
        .navigationTitle("Even G2 glasses")
        .task { await model.loadTokens() }
        .task(id: pairing?.code) { await watchForPairing() }
    }

    @ViewBuilder private var pairSection: some View {
        Section {
            if let justPaired {
                Label("\(justPaired) paired", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
            }
            if let p = pairing {
                SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let left = Int(p.expiresAt.timeIntervalSince(ctx.date))
                    VStack(spacing: 6) {
                        Text(Self.spaced(p.code))
                            .font(.system(size: 44, weight: .semibold, design: .monospaced))
                            .opacity(left > 0 ? 1 : 0.3)
                            .textSelection(.enabled)
                            .accessibilityLabel("Pairing code \(p.code.map(String.init).joined(separator: " "))")
                            .accessibilityIdentifier("glassesCode")
                        Text(left > 0 ? "Expires in \(left / 60):\(String(format: "%02d", left % 60))" : "Expired: get a new code")
                            .font(.footnote).foregroundStyle(left > 0 ? Color.secondary : Color.orange)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
            }
            Button(pairing == nil ? "Get pairing code" : "Get a new code") {
                Task {
                    asking = true
                    justPaired = nil
                    pairing = await model.glassesPairingCode()
                    asking = false
                }
            }
            .disabled(asking)
            .accessibilityIdentifier("glassesGetCode")
        } header: { Text("Pair glasses") } footer: {
            Text("1. In the Even Realities app, install Wee Hours from the Even Hub and open it.\n2. Tap Get pairing code here and type the 6 digits on the glasses' page. The code works once, for ten minutes.\nEach caregiver can pair their own glasses; entries are logged under their name.")
        }
    }

    /// While a code is showing, notice the glasses redeeming it.
    private func watchForPairing() async {
        guard let p = pairing else { return }
        while !Task.isCancelled, pairing == p, p.expiresAt > Date() {
            try? await Task.sleep(for: .seconds(3))
            await model.loadTokens()
            if let t = model.glasses.first(where: { $0.revokedAt == nil && $0.createdAt >= p.createdAt.addingTimeInterval(-30) }) {
                justPaired = Self.label(t)
                pairing = nil
            }
        }
    }

    static func label(_ t: AccessToken) -> String {
        String(t.name.dropFirst("glasses:".count))
    }

    static func spaced(_ code: String) -> String {
        code.count == 6 ? "\(code.prefix(3)) \(code.suffix(3))" : code
    }
}
