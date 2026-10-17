import ContempoCore
import ContempoData
import SwiftUI
import UIKit

struct ConfirmScreen: View {
    let params: ConfirmParams
    let onSaved: () -> Void

    @State private var viewModel: ConfirmViewModel
    @Environment(\.contempoPalette) private var palette
    @Environment(\.dismiss) private var dismiss
    /// Drives the "save or discard?" confirmation shown by the custom back
    /// button below — only when `viewModel.hasUnsavedChanges` is true;
    /// tapping back with no edits made just dismisses immediately.
    @State private var showUnsavedChangesConfirm = false
    /// Non-nil while the delete confirmation for a long-pressed property chip is showing — see the `.onLongPressGesture` in the Property section.
    @State private var propertyPendingDeletion: Property?

    init(params: ConfirmParams, onSaved: @escaping () -> Void) {
        self.params = params
        self.onSaved = onSaved
        _viewModel = State(initialValue: ConfirmViewModel(params: params))
    }

    var body: some View {
        Form {
            if let photoData = params.photoData, let uiImage = UIImage(data: photoData) {
                Section {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 200)
                        .clipped()
                        .listRowInsets(EdgeInsets())
                }
            }

            // Only a photo capture ever shows this — the vision model's
            // odometer-vs-work classification (see
            // CaptureViewModel.processCapturedPhoto) is a one-tap-correctable
            // suggestion, not a silent hard commit. Flipping it re-runs the
            // *other* AgentClient photo call against the same held photo
            // (see ConfirmViewModel.onTripModeToggled).
            if params.captureSource == .photo {
                Section {
                    HStack {
                        Text("This is an odometer reading")
                        Spacer()
                        if viewModel.isReclassifying {
                            ProgressView()
                        } else {
                            Toggle("", isOn: Binding(
                                get: { viewModel.isTripMode },
                                set: { viewModel.onTripModeToggled($0) }
                            ))
                            .labelsHidden()
                        }
                    }
                }
            }

            if viewModel.isTripMode {
                // A trip has no property/task/duration/category/date to
                // review here — MileageTripCoordinator.handleStartTrip/
                // handleEndTrip owns those (property/task stay blank,
                // activityDate is "now"), and the odometer reading is the
                // only thing this screen lets the user correct before it's
                // committed.
                Section("Odometer reading") {
                    TextField("Odometer reading", text: Binding(
                        get: { viewModel.odometerReading },
                        set: { newValue in
                            if newValue.isEmpty || newValue.range(of: #"^\d*\.?\d*$"#, options: .regularExpression) != nil {
                                viewModel.odometerReading = newValue
                            }
                        }
                    ))
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage).foregroundStyle(palette.danger)
                }

                Section {
                    Button {
                        viewModel.confirm { onSaved(); dismiss() }
                    } label: {
                        if viewModel.isSaving {
                            ProgressView()
                        } else {
                            Text(params.tripIsEndingExistingTrip ? "End Trip" : "Start Trip").bold()
                        }
                    }
                    .disabled(viewModel.isSaving)
                }
            } else {
                Section("Property") {
                    if viewModel.isAddingNewProperty {
                        VStack(alignment: .leading, spacing: 8) {
                            AddressAutoCompleteField(
                                placeholder: "New property address",
                                text: $viewModel.newPropertyName
                            )
                            HStack {
                                Spacer()
                                Button("Cancel") { viewModel.onCancelAddNewProperty() }
                                    .buttonStyle(.bordered)
                                Button("Add") { viewModel.onConfirmNewProperty() }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                    } else {
                        propertyChipsRow
                        AddressAutoCompleteField(
                            placeholder: "Property name or address",
                            text: $viewModel.property
                        )
                    }
                }

                Section("Role") {
                    if viewModel.isAddingNewRole {
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("Role name", text: $viewModel.newRoleName)
                            HStack {
                                Spacer()
                                Button("Cancel") { viewModel.onCancelAddNewRole() }
                                    .buttonStyle(.bordered)
                                Button("Add") { viewModel.onConfirmNewRole() }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                    } else {
                        Picker("Role", selection: Binding(
                            get: { viewModel.selectedRoleId },
                            set: { viewModel.onRoleSelected($0) }
                        )) {
                            Text("Me").tag(String?.none)
                            ForEach(viewModel.roles) { role in
                                Text(role.name).tag(role.id)
                            }
                        }
                        Button("+ New role") { viewModel.onAddNewRoleClicked() }
                    }
                    Text("Only your own hours (Me) count toward the 100-hour/500-hour progress on the Dashboard. Rename or delete roles in Settings.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }

                Section("Task") {
                    TextEditor(text: $viewModel.task)
                        .frame(minHeight: 80)
                    taskDictationButtons
                }

                Section("Duration (minutes)") {
                    TextField("Minutes", text: Binding(
                        get: { viewModel.durationMinutes },
                        set: { newValue in
                            if newValue.allSatisfy(\.isNumber) { viewModel.durationMinutes = newValue }
                        }
                    ))
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
                }

                Section("When") {
                    DatePicker("Activity date & time", selection: $viewModel.activityDate)
                        .datePickerStyle(.compact)
                }

                Section("Category") {
                    if viewModel.isAddingNewCategory {
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("Category name", text: $viewModel.newCategoryName)
                            HStack {
                                Spacer()
                                Button("Cancel") { viewModel.onCancelAddNewCategory() }
                                    .buttonStyle(.bordered)
                                Button("Add") { viewModel.onConfirmNewCategory() }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                    } else {
                        // Picker on its own row — available regardless of
                        // whether a category is already set (an already-
                        // confirmed entry reaching this screen for editing
                        // always arrives with a real one, not just fresh
                        // captures).
                        Picker("Category", selection: Binding(
                            get: { viewModel.category },
                            set: { viewModel.onCategoryChanged($0) }
                        )) {
                            ForEach(EntryCategory.allCases, id: \.self) { category in
                                Text(category.firestoreValue.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .tag(category.firestoreValue)
                            }
                            ForEach(viewModel.categories) { category in
                                Text(category.name).tag(category.name)
                            }
                        }
                        // A full labeled row, not a bare icon — confirmed
                        // live: an icon-only button here was too small to
                        // tap reliably and didn't explain what it did. The
                        // button is a correctable suggestion, not a silent
                        // commit: it just fills the picker above, which
                        // stays fully editable afterward (see
                        // ConfirmViewModel.detectCategory's doc comment).
                        if viewModel.isDetectingCategory {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Detecting…")
                                    .font(ContempoFont.labelSmall())
                                    .foregroundStyle(palette.inkSoft)
                            }
                        } else {
                            Button {
                                viewModel.detectCategory()
                            } label: {
                                Label("Auto-detect category with AI", systemImage: "sparkles")
                            }
                            .buttonStyle(.bordered)
                            .tint(palette.pine)
                        }
                        Button("+ New category") { viewModel.onAddNewCategoryClicked() }
                        if let categoryDetectError = viewModel.categoryDetectError {
                            Text(categoryDetectError)
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(palette.danger)
                        }
                    }
                }

                Section("Miles (optional)") {
                    TextField("Miles", text: Binding(
                        get: { viewModel.miles },
                        set: { newValue in
                            if newValue.isEmpty || newValue.range(of: #"^\d*\.?\d*$"#, options: .regularExpression) != nil {
                                viewModel.miles = newValue
                            }
                        }
                    ))
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                }

                Text("Parsed \(params.captureSource == .manual ? "manually" : "via \(params.captureSource.firestoreValue)") — reviewed here before saving.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage).foregroundStyle(palette.danger)
                }

                Section {
                    if viewModel.isIncomplete {
                        Button {
                            viewModel.saveForLater { onSaved(); dismiss() }
                        } label: {
                            if viewModel.isSavingForLater {
                                ProgressView()
                            } else {
                                Text("Complete Later")
                            }
                        }
                        .disabled(viewModel.isSaving || viewModel.isSavingForLater)
                    }

                    Button {
                        viewModel.confirm { onSaved(); dismiss() }
                    } label: {
                        if viewModel.isSaving {
                            ProgressView()
                        } else {
                            Text("Confirm").bold()
                        }
                    }
                    .disabled(viewModel.isSaving || viewModel.isSavingForLater)
                }
            }
        }
        // The Form's default interactive dismiss-on-scroll is enough for
        // most of this screen, but the numeric-keypad fields (Duration,
        // Miles, Odometer reading) have no Return/Done key of their own,
        // and the trip/odometer branch is short enough that there may not
        // be anything to scroll — this Done key is always reachable
        // regardless. hideKeyboard() (not a single @FocusState) since this
        // screen has many independent fields, not one to track.
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done", action: hideKeyboard)
                    .font(ContempoFont.labelLarge().weight(.semibold))
            }
        }
        .navigationTitle("Confirm Entry")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        // Custom back button so an unsaved edit gets a save/discard prompt
        // instead of silently vanishing — confirmed live as a real gap: a
        // stray tap on the system back button lost whatever the user had
        // just typed. Also blocks the edge-swipe-back gesture while dirty
        // (interactiveDismissDisabled applies to pushed views, not just
        // sheets), so that path can't bypass the same prompt.
        .navigationBarBackButtonHidden(true)
        .interactiveDismissDisabled(viewModel.hasUnsavedChanges)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    if viewModel.hasUnsavedChanges {
                        showUnsavedChangesConfirm = true
                    } else {
                        dismiss()
                    }
                } label: {
                    Image(systemName: "chevron.backward")
                }
            }
        }
        // A centered .alert, not .confirmationDialog — confirmed live:
        // confirmationDialog renders as a popover anchored to the toolbar
        // button that presented it (with a pointer arrow) rather than a
        // proper modal alert, which read as broken/out of place here.
        .alert(
            "You have unsaved changes",
            isPresented: $showUnsavedChangesConfirm
        ) {
            Button("Save Changes") {
                // saveForLater only handles the regular entry shape, not a
                // trip's odometer save — trip mode always goes through
                // confirm() (-> saveTrip), same as the primary button below.
                if !viewModel.isTripMode && viewModel.isIncomplete {
                    viewModel.saveForLater { onSaved(); dismiss() }
                } else {
                    viewModel.confirm { onSaved(); dismiss() }
                }
            }
            Button("Discard Changes", role: .destructive) { dismiss() }
            Button("Cancel", role: .cancel) {}
        }
        .alert(
            "Delete \"\(propertyPendingDeletion?.name ?? "")\"?",
            isPresented: Binding(
                get: { propertyPendingDeletion != nil },
                set: { if !$0 { propertyPendingDeletion = nil } }
            )
        ) {
            Button("Delete", role: .destructive) {
                if let property = propertyPendingDeletion {
                    viewModel.deleteProperty(property)
                }
                propertyPendingDeletion = nil
            }
            Button("Cancel", role: .cancel) { propertyPendingDeletion = nil }
        } message: {
            Text("This removes it from your saved properties. Entries already logged against it aren't affected.")
        }
    }

    // Pulled out of `body` for the same reason as `taskDictationButtons`
    // below — inlined directly in the Property Section, this pushed the
    // surrounding Form's single expression past what the Swift type-checker
    // can resolve in reasonable time. The long-press-to-delete gesture
    // (confirmed via `propertyPendingDeletion`, see the alert below) adds
    // exactly the kind of extra modifier chain that trips this.
    @ViewBuilder
    private var propertyChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack {
                ForEach(viewModel.properties) { property in
                    let name = property.name
                    Button(name) { viewModel.onPropertySelected(property) }
                        .buttonStyle(.bordered)
                        .tint(viewModel.property == name ? palette.pine : palette.hairlineStrong)
                        // Long-press to delete a saved property — confirmed
                        // here rather than deleting on the press itself,
                        // since this list has no undo and a stray
                        // long-press is easy to trigger while scrolling.
                        .onLongPressGesture {
                            propertyPendingDeletion = property
                        }
                }
                Button("+ New") { viewModel.onAddNewPropertyClicked() }
                    .buttonStyle(.bordered)
            }
        }
    }

    // Two buttons, not one, doing two different things: "Dictate" records
    // new speech and inserts the raw Whisper transcript; "AI rewrite"
    // copy-edits the text *already in the field* (typos, punctuation,
    // phrasing) via agentClient.cleanupTranscript — it doesn't record
    // anything. Confirmed live this was a real bug, not just a naming
    // nitpick: "AI rewrite" used to also start a fresh recording and clean
    // up only that, so tapping it while editing an already-populated entry
    // silently did nothing to the visible text. A spinner replaces both
    // while transcribing/rewriting so there's nothing tappable mid-request.
    // Bordered (not .plain) with real spacing and a text label on each, not
    // just an icon — confirmed live: two icon-only .plain buttons sitting
    // right next to each other led to real mis-taps. Mirrors Android's
    // ConfirmScreen.kt equivalent.
    //
    // Pulled out of `body` into its own property, not inlined in the "Task"
    // Section — inlined here, this pushed the surrounding Form's single
    // expression past what the Swift type-checker can resolve in reasonable
    // time ("the compiler is unable to type-check this expression...",
    // confirmed live, reported against an unrelated line elsewhere in the
    // same Form — a known Swift/SwiftUI quirk where the error location
    // inside one huge expression tree isn't necessarily where the actual
    // complexity is). Splitting into a separately-type-checked property
    // fixes it.
    @ViewBuilder
    private var taskDictationButtons: some View {
        if viewModel.isTranscribingTask {
            HStack(spacing: 8) {
                ProgressView()
                Text("Transcribing…")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkSoft)
            }
        } else if viewModel.isRewritingTask {
            HStack(spacing: 8) {
                ProgressView()
                Text("Rewriting…")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkSoft)
            }
        } else {
            HStack(spacing: 16) {
                Button {
                    Task {
                        if viewModel.isRecordingTask {
                            await viewModel.stopRecordingTask()
                        } else {
                            await viewModel.startRecordingTask()
                        }
                    }
                } label: {
                    Label(viewModel.isRecordingTask ? "Stop" : "Dictate", systemImage: viewModel.isRecordingTask ? "stop.fill" : "mic")
                }
                .buttonStyle(.bordered)
                .tint(viewModel.isRecordingTask ? palette.danger : palette.inkSoft)

                Button {
                    Task { await viewModel.rewriteTask() }
                } label: {
                    Label("AI rewrite", systemImage: "sparkles")
                }
                .buttonStyle(.bordered)
                .tint(palette.pine)
                .disabled(viewModel.isRecordingTask || viewModel.task.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }
}
