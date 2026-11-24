import ContempoCore
import SwiftUI

struct WhatsNewItem: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let detail: String
}

struct WhatsNewRelease: Identifiable {
    let version: String
    let headline: String
    let items: [WhatsNewItem]
    var id: String { version }
}

enum WhatsNewCatalog {
    static let releases: [WhatsNewRelease] = [
        WhatsNewRelease(
            version: "3.4.0",
            headline: "MCP assistant access, unified Pro, Apple Speech & richer Shortcuts",
            items: [
                WhatsNewItem(
                    icon: "sparkles",
                    title: "Connect AI assistants via MCP",
                    detail: "Query your 100h / 500h / 750h progress, check IRS audit risks, and log entries from Claude or ChatGPT using OAuth 2.1."
                ),
                WhatsNewItem(
                    icon: "checkmark.seal.fill",
                    title: "Unified Contempo Pro",
                    detail: "Subscribe or unlock Lifetime right in the app with StoreKit 2 — one account unlocks iPhone, Android, Web, and MCP."
                ),
                WhatsNewItem(
                    icon: "waveform",
                    title: "Apple Speech option (iOS 26+)",
                    detail: "Switch voice capture to on-device Apple Speech in Settings for fast, zero-download transcription with automatic Whisper fallback."
                ),
                WhatsNewItem(
                    icon: "mic.badge.plus",
                    title: "Smarter Siri & Shortcuts",
                    detail: "Ask \"Check hours in Contempo\" for live progress toward your tax test, with property autocomplete."
                ),
                WhatsNewItem(
                    icon: "bell.badge",
                    title: "14-day contemporaneity nudges",
                    detail: "Get a gentle reminder before unconfirmed drafts cross the IRS 14-day backfill window."
                ),
            ]
        ),
    ]
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        NavigationStack {
            List {
                ForEach(WhatsNewCatalog.releases) { release in
                    Section("Version \(release.version) — \(release.headline)") {
                        ForEach(release.items) { item in
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: item.icon)
                                    .foregroundStyle(palette.pine)
                                    .frame(width: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title).font(ContempoFont.titleMedium())
                                    Text(item.detail)
                                        .font(ContempoFont.labelSmall())
                                        .foregroundStyle(palette.inkFaint)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
            .navigationTitle("What's New")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
