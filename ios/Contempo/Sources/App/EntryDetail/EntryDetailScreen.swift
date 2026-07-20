import ContempoCore
import ContempoFirestore
import SwiftUI

struct EntryDetailScreen: View {
    let entryId: String
    @State private var viewModel: EntryDetailViewModel
    @Environment(\.contempoPalette) private var palette
    @Environment(\.dismiss) private var dismiss

    init(entryId: String) {
        self.entryId = entryId
        _viewModel = State(initialValue: EntryDetailViewModel(entryId: entryId))
    }

    var body: some View {
        Group {
            if let entry = viewModel.entry {
                List {
                    Section {
                        HStack {
                            Text(entry.statusEnum == .confirmed ? "Confirmed" : (entry.inProgress ? "In progress" : "Pending"))
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(entry.statusEnum == .confirmed ? palette.pine : palette.brass)
                        }
                    }
                    Section("Task") {
                        BulletAwareText(entry.task)
                    }
                    Section("Details") {
                        LabeledContent("Property", value: entry.propertyName.isEmpty ? "—" : entry.propertyName)
                        LabeledContent("Category", value: entry.categoryEnum.firestoreValue.replacingOccurrences(of: "_", with: " ").capitalized)
                        LabeledContent("Duration", value: "\(entry.durationMinutes) min")
                        LabeledContent("Activity date", value: entry.activityDate.dateValue().formatted())
                        LabeledContent("Logged", value: entry.loggedAt.dateValue().formatted())
                        if let confirmedAt = entry.confirmedAt {
                            LabeledContent("Confirmed", value: confirmedAt.dateValue().formatted())
                        }
                        if entry.miles > 0 {
                            LabeledContent("Miles", value: entry.miles.formatted(.number.precision(.fractionLength(1))))
                        }
                        if !entry.photoUrls.isEmpty {
                            LabeledContent("Photos", value: "\(entry.photoUrls.count)")
                        }
                    }
                    if !entry.rawTranscript.isEmpty {
                        Section("Voice transcript") {
                            Text(entry.rawTranscript).font(ContempoFont.bodyLarge())
                        }
                    }
                }

                NavigationLink(value: confirmRoute(for: entry)) {
                    Text(actionLabel(for: entry)).bold()
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.pine)
                .padding()
            } else if viewModel.isLoading {
                ProgressView()
            } else {
                Text("Entry not found").foregroundStyle(palette.inkFaint)
            }
        }
        .navigationTitle("Entry")
        .toolbar {
            ToolbarItem(placement: .destructiveAction) {
                Button(role: .destructive) {
                    viewModel.delete { dismiss() }
                } label: {
                    Image(systemName: "trash")
                }
                .disabled(viewModel.isDeleting)
            }
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

    private func actionLabel(for entry: Entry) -> String {
        if entry.inProgress { return "Stop timer" }
        if entry.statusEnum == .pendingReview { return "Complete" }
        return "Edit"
    }

    private func confirmRoute(for entry: Entry) -> AppRoute {
        var durationMinutes = entry.durationMinutes
        if entry.inProgress {
            durationMinutes = max(0, Int(Date().timeIntervalSince(entry.activityDate.dateValue()) / 60))
        }
        let params = ConfirmParams(
            property: entry.propertyName,
            task: entry.task,
            durationMinutes: durationMinutes,
            category: entry.category,
            captureSource: entry.sourceEnum,
            miles: entry.miles,
            resolvedActivityDateIso: nil,
            photoData: nil,
            entryId: entry.id ?? "",
            captureLat: entry.captureLat,
            captureLng: entry.captureLng
        )
        return .confirm(params)
    }
}
