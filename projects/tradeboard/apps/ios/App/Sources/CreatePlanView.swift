import SwiftUI
import TradeboardKit

public struct CreatePlanView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var ticker = ""
    @State private var side = "buy"
    @State private var orderType = "limit"
    @State private var quantityMode = "shares" // "shares" or "dollars"
    @State private var sharesText = "1"
    @State private var dollarsText = "100"
    @State private var limitPriceText = ""
    @State private var thesis = ""
    @State private var evidence = ""
    @State private var risks = ""
    @State private var invalidation = ""
    @State private var fitWithStrategy = ""
    @State private var validUntil = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                Section("Ticket Details") {
                    TextField("Title (e.g. NVDA pull-back long)", text: $title)

                    TextField("Ticker Symbol (e.g. AAPL)", text: $ticker)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()

                    Picker("Action", selection: $side) {
                        Text("Buy").tag("buy")
                    }

                    Picker("Order Type", selection: $orderType) {
                        Text("Limit").tag("limit")
                        Text("Market").tag("market")
                    }

                    Picker("Quantity By", selection: $quantityMode) {
                        Text("Shares").tag("shares")
                        Text("Dollars").tag("dollars")
                    }
                    .pickerStyle(.segmented)

                    if quantityMode == "shares" {
                        TextField("Number of Shares", text: $sharesText)
                            .keyboardType(.decimalPad)
                    } else {
                        TextField("Dollar Amount ($)", text: $dollarsText)
                            .keyboardType(.decimalPad)
                    }

                    if orderType == "limit" {
                        TextField("Limit Price ($)", text: $limitPriceText)
                            .keyboardType(.decimalPad)
                    }

                    DatePicker("Valid Until", selection: $validUntil, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                }

                Section("Investment Thesis") {
                    TextField("Primary rationale and thesis", text: $thesis, axis: .vertical)
                        .lineLimit(3...6)

                    TextField("Evidence and catalysts (optional)", text: $evidence, axis: .vertical)
                        .lineLimit(2...4)

                    TextField("Risks and dissenting viewpoints", text: $risks, axis: .vertical)
                        .lineLimit(2...4)

                    TextField("Invalidation conditions", text: $invalidation, axis: .vertical)
                        .lineLimit(2...4)

                    TextField("Fit with trading strategy", text: $fitWithStrategy, axis: .vertical)
                        .lineLimit(2...4)
                }

                if let err = errorMessage {
                    Section {
                        Text(err)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("New Trade Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        submitPlan()
                    }
                    .disabled(ticker.trimmingCharacters(in: .whitespaces).isEmpty || thesis.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                }
            }
        }
    }

    private func submitPlan() {
        isSubmitting = true
        errorMessage = nil

        let cleanTicker = ticker.trimmingCharacters(in: .whitespaces).uppercased()
        let cleanTitle = title.trimmingCharacters(in: .whitespaces).isEmpty ? "\(cleanTicker) Trade Plan" : title.trimmingCharacters(in: .whitespaces)
        let shares = quantityMode == "shares" ? Double(sharesText) : nil
        let dollars = quantityMode == "dollars" ? Double(dollarsText) : nil
        let limitPrice = orderType == "limit" ? Double(limitPriceText) : nil

        Task {
            do {
                _ = try await model.backend.createPlan(
                    title: cleanTitle,
                    ticker: cleanTicker,
                    side: side,
                    orderType: orderType,
                    shares: shares,
                    dollars: dollars,
                    limitPrice: limitPrice,
                    thesis: thesis,
                    evidence: evidence,
                    risks: risks,
                    invalidation: invalidation,
                    fitWithStrategy: fitWithStrategy,
                    validUntil: ISO8601DateFormatter().string(from: validUntil)
                )
                await model.refresh()
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isSubmitting = false
                }
            }
        }
    }
}
