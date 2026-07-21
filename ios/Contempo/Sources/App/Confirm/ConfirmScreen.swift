import ContempoCore
import SwiftUI

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
                DatePicker("Activity date", selection: $viewModel.activityDate)
                    .datePickerStyle(.compact)
            }

            Section("Category") {
                Picker("Category", selection: $viewModel.category) {
                    ForEach(EntryCategory.allCases, id: \.self) { category in
                        Text(category.firestoreValue.replacingOccurrences(of: "_", with: " ").capitalized)
                            .tag(category)
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
        .navigationTitle("Confirm Entry")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}
