import ContempoCore
import SwiftUI
import UIKit

struct ConfirmScreen: View {
    let params: ConfirmParams
    let onSaved: () -> Void

    @State private var viewModel: ConfirmViewModel
    @Environment(\.contempoPalette) private var palette
    @Environment(\.dismiss) private var dismiss

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
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(viewModel.properties) { property in
                                    let name = property.name
                                    Button(name) { viewModel.onPropertySelected(property) }
                                        .buttonStyle(.bordered)
                                        .tint(viewModel.property == name ? palette.pine : palette.hairlineStrong)
                                }
                                Button("+ New") { viewModel.onAddNewPropertyClicked() }
                                    .buttonStyle(.bordered)
                            }
                        }
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
                        // Picker + on-device auto-detect button side by side —
                        // available regardless of whether a category is already
                        // set (an already-confirmed entry reaching this screen
                        // for editing always arrives with a real one, not just
                        // fresh captures). The button is a correctable
                        // suggestion, not a silent commit: it just fills the
                        // picker, which stays fully editable afterward (see
                        // ConfirmViewModel.detectCategory's doc comment).
                        HStack {
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
                            if viewModel.isDetectingCategory {
                                ProgressView()
                            } else {
                                Button {
                                    viewModel.detectCategory()
                                } label: {
                                    Image(systemName: "sparkles")
                                }
                                .buttonStyle(.plain)
                                .tint(palette.pine)
                                .accessibilityLabel("Auto-detect category with on-device AI")
                            }
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
    }
}
