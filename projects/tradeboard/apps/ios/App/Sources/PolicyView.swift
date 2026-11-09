import SwiftUI
import TradeboardKit

public struct PolicyView: View {
    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Deterministic Safety Bounds", systemImage: "lock.shield.fill")
                            .font(.headline)
                            .foregroundStyle(.green)
                        Text("Policy rules are enforced at execution time by the deterministic validator in TypeScript on your machine. Neither AI agents nor the model can relax them.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Default Policy Parameters") {
                    policyRow(title: "Per-Order Maximum", value: "$2,000", detail: "Maximum notional amount for any single order")
                    policyRow(title: "Daily Maximum Loss", value: "$500", detail: "Trading halts if cumulative daily loss reaches this limit")
                    policyRow(title: "Max Orders Per Day", value: "5 orders", detail: "Daily limit to prevent rapid churn or runaways")
                    policyRow(title: "Max Price Drift", value: "1.0%", detail: "Re-quoted Robinhood market price cannot drift more than 1%")
                    policyRow(title: "Approval Expiration", value: "Market Close", detail: "Approvals expire at NYSE market close (4:00 PM ET)")
                    policyRow(title: "Order Types", value: "Limit Only", detail: "Market and Stop orders are disabled in the default policy")
                    policyRow(title: "First Live Order Gate", value: "≤ $100 Limit", detail: "The first live trade is required to be small and a limit order")
                }

                Section("Account Isolation") {
                    policyRow(title: "Brokerage Scope", value: "Dedicated MCP", detail: "Orders are strictly restricted to the dedicated agentic Robinhood account")
                    policyRow(title: "Execution Mode", value: "Fail-Closed", detail: "Any validation mismatch, schema failure, or offline state aborts order placement")
                }
            }
            .navigationTitle("Safety Policy")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func policyRow(title: String, value: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(value)
                    .font(.system(.subheadline, design: .monospaced).bold())
                    .foregroundStyle(Color.accentColor)
            }
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
