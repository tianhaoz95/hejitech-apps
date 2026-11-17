import SwiftUI
import TradeboardKit
import UIKit

/// Settings → Robinhood on This iPhone: the preview of the phone connecting to Robinhood itself.
struct RobinhoodView: View {
    @State private var link = RobinhoodLink.shared
    @State private var copied = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Preview: connection test only", systemImage: "testtube.2")
                        .font(.headline)
                    Text("Sign in to Robinhood's official MCP from this iPhone and read your accounts, the trade-approval setting and a quote. Nothing here places, cancels or changes anything, and nothing is sent to your board. Orders still go through your executor.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section {
                Picker("Redirect", selection: $link.redirect) {
                    ForEach(RobinhoodRedirect.allCases) { r in
                        Text(r.title).tag(r)
                    }
                }
                .disabled(link.busy)
                Text(link.redirect.uri)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            } header: {
                Text("Sign-in return address")
            } footer: {
                Text("Where Robinhood's sign-in sends you back. If one fails, try another and copy the diagnostics.")
            }

            Section {
                Button {
                    Task { await link.signIn() }
                } label: {
                    HStack {
                        Label(link.signedIn ? "Sign In to Robinhood Again" : "Sign In to Robinhood", systemImage: "person.badge.key")
                        Spacer()
                        if link.busy { ProgressView() }
                    }
                }
                .disabled(link.busy)
                .accessibilityIdentifier("robinhood-sign-in")

                if link.signedIn {
                    Button {
                        Task { await link.runCheck() }
                    } label: {
                        Label("Run Read-Only Check", systemImage: "checklist")
                    }
                    .disabled(link.busy)

                    Button(role: .destructive) {
                        link.signOut()
                    } label: {
                        Label("Sign Out of Robinhood on This iPhone", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    .disabled(link.busy)
                }
            } footer: {
                if let at = link.stored.signedInAt {
                    Text("Signed in \(at.formatted(date: .abbreviated, time: .shortened)) with \(link.stored.redirect?.title ?? "?").")
                }
            }

            if let e = link.error {
                Section {
                    Label(e, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            if let c = link.check {
                Section("Read-only check · \(c.at.formatted(date: .omitted, time: .shortened))") {
                    row("MCP tools offered", "\(c.toolCount)")
                    row("Accounts", c.accounts.isEmpty ? "none" : c.accounts.map { $0.masked + ($0.agenticAllowed ? " ✓" : "") }.joined(separator: ", "))
                    if let m = c.chosenMask { row("Account checked", m) }
                    if let a = c.approvals { row("Trade approvals", a) }
                    row("\(c.quoteSymbol) quote", c.quote.map { String(format: "$%.2f", $0) } ?? "—")
                    if c.problems.isEmpty {
                        Label("Everything read cleanly.", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                    } else {
                        ForEach(c.problems, id: \.self) { p in
                            Label(p, systemImage: "exclamationmark.circle")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }

            if !link.log.isEmpty {
                Section {
                    ForEach(Array(link.log.enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    Button {
                        UIPasteboard.general.string = link.diagnostics
                        copied = true
                    } label: {
                        Label(copied ? "Copied" : "Copy Diagnostics", systemImage: copied ? "checkmark" : "doc.on.doc")
                    }
                } header: {
                    Text("Steps")
                } footer: {
                    Text("Diagnostics never include tokens, codes or full account numbers.")
                }
            }
        }
        .navigationTitle("Robinhood on This iPhone")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: link.log.count) { _, _ in copied = false }
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k)
            Spacer()
            Text(v)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }
}
