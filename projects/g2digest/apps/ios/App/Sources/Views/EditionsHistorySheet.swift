import SwiftUI
import G2DigestKit

public struct EditionsHistorySheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        NavigationStack {
            List {
                Section("Available Editions") {
                    if appModel.editions.isEmpty {
                        Text(appModel.hasAccess
                             ? (appModel.isLoading ? "Loading…" : "No editions yet. Pull down to check again.")
                             : "Sign in to see your editions.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(appModel.editions) { ed in
                            Button {
                                Task {
                                    await appModel.loadEdition(date: ed.date)
                                    dismiss()
                                }
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(ed.title)
                                            .font(.headline)
                                            .foregroundStyle(.primary)

                                        Text(ed.date)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                    }

                                    Spacer()

                                    if appModel.currentBundle?.date == ed.date {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(Color.accentColor)
                                    }
                                }
                            }
                        }
                    }
                }

                if let err = appModel.errorMessage {
                    Section { Text(err).font(.footnote).foregroundStyle(.red) }
                }

                Section("Demo / Offline") {
                    Button {
                        appModel.currentBundle = TourBuilder.makeTour(reason: .pair)
                        appModel.currentCardIndex = 0
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Interactive Tour")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text("7-card built-in walkthrough")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if TourBuilder.isTour(appModel.currentBundle) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
            }
            .refreshable { await appModel.refreshAll() }
            .navigationTitle("Editions Archive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
