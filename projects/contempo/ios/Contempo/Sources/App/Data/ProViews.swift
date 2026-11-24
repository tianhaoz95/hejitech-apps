import ContempoCore
import StoreKit
import SwiftUI

struct ProSettingsSection: View {
    let proStore: ProStore
    @State private var showPaywall = false
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Section("Contempo Pro") {
            if proStore.hasPro {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Contempo Pro Active").font(ContempoFont.titleMedium())
                        Text(statusSubtitle)
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                    Spacer()
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(palette.pine)
                }
                Button("Refresh Pro Status") {
                    Task { await proStore.refresh() }
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Upgrade to Contempo Pro").font(ContempoFont.titleMedium())
                    Text("Unlock PDF Audit Binder exports, unlimited properties, MCP assistant access, and GPS mileage tracking across iPhone, Android, and Web.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
                Button("View Pro Plans") {
                    showPaywall = true
                }
                .foregroundStyle(palette.pine)
            }
        }
        .sheet(isPresented: $showPaywall) {
            ProPaywallSheet(proStore: proStore)
        }
    }

    private var statusSubtitle: String {
        switch proStore.source {
        case "grant": return "Unlocked via Pro invite"
        case "stripe": return "Managed on the web"
        case "play": return "Managed on Google Play"
        case "app_store": return proStore.plan == "lifetime" ? "Lifetime unlock" : "App Store subscription"
        default: return "Active on this account"
        }
    }
}

struct ProPaywallSheet: View {
    let proStore: ProStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Audit-ready logs across every device")
                        .font(ContempoFont.titleLarge())

                    VStack(alignment: .leading, spacing: 10) {
                        featureRow("doc.richtext", "CPA-ready PDF Audit Binder exports")
                        featureRow("house.fill", "Unlimited rental properties")
                        featureRow("sparkles", "MCP server access for Claude & ChatGPT")
                        featureRow("car.fill", "Automatic GPS mileage & arrival tracking")
                        featureRow("iphone.and.arrow.forward", "Unlocks iPhone, Android, and Web with one account")
                    }

                    if proStore.loadingProducts && proStore.products.isEmpty {
                        ProgressView("Loading plans…")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical)
                    } else if proStore.products.isEmpty {
                        VStack(spacing: 8) {
                            Text("Plans are temporarily unavailable.")
                                .font(ContempoFont.bodyLarge())
                                .foregroundStyle(palette.inkSoft)
                            Button("Try Again") {
                                Task { await proStore.loadProducts() }
                            }
                            .buttonStyle(.bordered)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical)
                    } else {
                        VStack(spacing: 12) {
                            if let annual = proStore.annualProduct {
                                planButton(annual, badge: "1-Week Free Trial")
                            }
                            if let lifetime = proStore.lifetimeProduct {
                                planButton(lifetime, badge: "Pay Once")
                            }
                        }
                    }

                    if let err = proStore.errorMessage {
                        Text(err)
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(.red)
                    }

                    HStack(spacing: 16) {
                        Button("Restore Purchases") {
                            Task { await proStore.restorePurchases() }
                        }
                        Spacer()
                        Link("Privacy", destination: URL(string: "https://contempo.hejitech.workers.dev/legal/privacy")!)
                        Link("Terms", destination: URL(string: "https://contempo.hejitech.workers.dev/legal/terms")!)
                    }
                    .font(ContempoFont.labelSmall())

                    Text("Annual subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.")
                        .font(.caption2)
                        .foregroundStyle(palette.inkFaint)
                }
                .padding()
            }
            .navigationTitle("Contempo Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task {
                if proStore.products.isEmpty { await proStore.loadProducts() }
            }
            .onChange(of: proStore.hasPro) { _, isPro in
                if isPro { dismiss() }
            }
        }
    }

    private func featureRow(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(palette.pine)
                .frame(width: 22)
            Text(text).font(ContempoFont.bodyLarge())
        }
    }

    private func planButton(_ product: Product, badge: String) -> some View {
        Button {
            Task { await proStore.purchase(product) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.displayName).font(ContempoFont.titleMedium())
                    Text(badge).font(ContempoFont.labelSmall()).opacity(0.85)
                }
                Spacer()
                Text(product.displayPrice).font(ContempoFont.titleMedium())
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(palette.pine.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(proStore.purchasing)
    }
}
