import HeadwayKit
import SwiftUI

/// The Glasses tab: a pairing code for the Even Hub plugin, paired glasses, and how the R1 works.
struct GlassesView: View {
    @Environment(AppModel.self) private var model
    @State private var code: PairingCode?
    @State private var devices: [PairedDevice] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let code {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(code.code.map(String.init).joined(separator: " "))
                                .font(.system(size: 40, weight: .bold, design: .monospaced))
                                .foregroundStyle(Color.accentColor)
                                .textSelection(.enabled)
                                .accessibilityLabel("Pairing code \(code.code.map(String.init).joined(separator: " "))")
                            Text("Open Headway in the Even app (Even Hub) and type this code. It works once, for ten minutes.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                    Button(code == nil ? "Get a pairing code" : "Get a new code") {
                        Task {
                            do { code = try await model.backend.pairingCode() } catch { self.error = error.localizedDescription }
                        }
                    }
                } header: {
                    Text("Pair your Even G2")
                } footer: {
                    Text("Install Headway from the Even Hub in the Even app first. Paired glasses show your commute and can track a train for your arrival alert.")
                }
                Section("Paired glasses") {
                    if devices.isEmpty { Text("None yet").foregroundStyle(.secondary) }
                    ForEach(devices) { d in
                        VStack(alignment: .leading) {
                            Text(d.label)
                            if let last = d.lastUsedAt { Text("Last seen \(Self.when(last))").font(.caption).foregroundStyle(.secondary) }
                        }
                        .swipeActions {
                            Button("Unpair", role: .destructive) {
                                Task {
                                    try? await model.backend.unpair(d.id)
                                    await load()
                                }
                            }
                        }
                    }
                }
                Section("On the R1 ring") {
                    LabeledContent("Swipe", value: "next trains")
                    LabeledContent("Tap", value: "flip direction")
                    LabeledContent("Hold", value: "track the train")
                    LabeledContent("Double-tap", value: "menu")
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Glasses")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        do { devices = try await model.backend.devices() } catch { self.error = error.localizedDescription }
    }

    static func when(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return iso }
        return d.formatted(.relative(presentation: .named))
    }
}
