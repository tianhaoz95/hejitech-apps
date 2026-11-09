import SwiftUI
import TradeboardKit

public struct ExecutorsView: View {
    @Environment(AppModel.self) private var model

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Local Execution Engine", systemImage: "cpu.fill")
                            .font(.headline)
                        Text("Executors poll your board outbound over HTTPS. Only the local executor holds the Robinhood MCP credential and local model.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                let execs = model.board?.executors ?? []
                if execs.isEmpty {
                    Section {
                        Text("No executors registered yet. Install tradeboard-executor on your host machine to execute approved trades.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section("Connected Hosts") {
                        ForEach(execs) { ex in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Circle()
                                        .fill(ex.online ? Color.green : Color.secondary)
                                        .frame(width: 10, height: 10)

                                    Text(ex.label ?? ex.executor_id)
                                        .font(.headline)

                                    Spacer()

                                    Text(ex.online ? "ONLINE" : "OFFLINE")
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background((ex.online ? Color.green : Color.secondary).opacity(0.15))
                                        .foregroundStyle(ex.online ? .green : .secondary)
                                        .clipShape(Capsule())
                                }

                                if let model = ex.model_name {
                                    Label("Model: \(model)", systemImage: "brain")
                                        .font(.caption.monospaced())
                                        .foregroundStyle(.secondary)
                                }

                                if let account = ex.robinhood_account {
                                    Label("Robinhood: \(account)", systemImage: "banknote")
                                        .font(.caption.monospaced())
                                        .foregroundStyle(.secondary)
                                }

                                if let hb = ex.last_heartbeat_at {
                                    Label("Last Heartbeat: \(hb.prefix(16).replacingOccurrences(of: "T", with: " "))", systemImage: "clock")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Executors")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable {
                await model.refresh()
            }
        }
    }
}
