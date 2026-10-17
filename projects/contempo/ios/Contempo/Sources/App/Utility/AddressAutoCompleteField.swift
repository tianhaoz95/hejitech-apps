import MapKit
import SwiftUI

public struct AddressAutoCompleteField: View {
    let placeholder: String
    @Binding var text: String
    let onAddressSelected: ((String) -> Void)?

    @State private var completer = AddressCompleter()
    @State private var showSuggestions: Bool = false
    @State private var isLoading: Bool = false
    @State private var searchTask: Task<Void, Never>? = nil
    @FocusState private var isFocused: Bool

    public init(
        placeholder: String = "Property address",
        text: Binding<String>,
        onAddressSelected: ((String) -> Void)? = nil
    ) {
        self.placeholder = placeholder
        self._text = text
        self.onAddressSelected = onAddressSelected
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                TextField(placeholder, text: $text)
                    .focused($isFocused)
                    .onChange(of: text) { _, newValue in
                        searchTask?.cancel()
                        // Only search while this field itself is focused —
                        // `text` also changes when a caller assigns it from
                        // outside (ConfirmScreen setting it to an
                        // already-known saved property's name when a chip
                        // is tapped), and re-running the geocoder against a
                        // value that's already a resolved address is both
                        // wasted API calls and an unwanted suggestions
                        // popup. A real edit always happens through this
                        // TextField, so it's always focused when it does.
                        guard isFocused, newValue.trimmingCharacters(in: .whitespaces).count >= 3 else {
                            isLoading = false
                            showSuggestions = false
                            return
                        }
                        isLoading = true
                        showSuggestions = true
                        searchTask = Task {
                            // 3 seconds maximum rate limit throttle
                            try? await Task.sleep(nanoseconds: 3_000_000_000)
                            if !Task.isCancelled {
                                completer.query = newValue
                                isLoading = false
                                showSuggestions = !completer.results.isEmpty
                            }
                        }
                    }

                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            if showSuggestions {
                VStack(alignment: .leading, spacing: 0) {
                    if isLoading {
                        HStack(spacing: 8) {
                            ProgressView()
                                .controlSize(.small)
                            Text("Searching address (3s limit)...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal, 8)
                    } else {
                        ForEach(completer.results.prefix(4), id: \.self) { result in
                            Button {
                                completer.resolveAddress(result) { fullAddress in
                                    text = fullAddress
                                    showSuggestions = false
                                    isFocused = false
                                    onAddressSelected?(fullAddress)
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(result.title)
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                        .foregroundColor(.primary)
                                    if !result.subtitle.isEmpty {
                                        Text(result.subtitle)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                .padding(.vertical, 6)
                                .padding(.horizontal, 8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)

                            if result != completer.results.prefix(4).last {
                                Divider()
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .cornerRadius(8)
                .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
            }
        }
    }
}
