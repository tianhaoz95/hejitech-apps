import SwiftUI
import TradeboardKit

public struct StrategyView: View {
    @Environment(AppModel.self) private var model
    @State private var content = ""
    @State private var isEditing = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Explanatory note
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Guidance For Discussion Agents", systemImage: "sparkles")
                            .font(.headline)
                        Text("Agents read your strategy before proposing or debating trades, and report each plan's fit with it. The strategy guides discussion — hard limits belong in Policy.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.secondary.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    if isEditing {
                        TextEditor(text: $content)
                            .font(.system(.body, design: .monospaced))
                            .frame(minHeight: 300)
                            .padding(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.2)))
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            if let strat = model.strategy?.strategy {
                                HStack {
                                    Text("Version \(strat.version)")
                                        .font(.caption.bold())
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.12))
                                        .clipShape(Capsule())
                                    if let updated = strat.updated_at {
                                        Text("Updated \(updated.prefix(10))")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }

                            Text(content.isEmpty ? "No strategy document written yet. Tap Edit to draft your high-level strategy." : content)
                                .font(.body)
                                .textSelection(.enabled)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.secondary.opacity(0.04))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    if let err = errorMessage {
                        Text(err)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .padding()
            }
            .navigationTitle("Trading Strategy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isEditing {
                        Button("Save") {
                            saveStrategy()
                        }
                        .disabled(isSaving)
                    } else {
                        Button("Edit") {
                            isEditing = true
                        }
                    }
                }
            }
            .task {
                await model.loadStrategy()
                if let s = model.strategy?.strategy {
                    self.content = s.content
                }
            }
        }
    }

    private func saveStrategy() {
        isSaving = true
        errorMessage = nil
        Task {
            let ok = await model.updateStrategy(content: content)
            await MainActor.run {
                self.isSaving = false
                if ok {
                    self.isEditing = false
                } else {
                    self.errorMessage = model.error
                }
            }
        }
    }
}
