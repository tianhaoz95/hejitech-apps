import CoreImage.CIFilterBuiltins
import SwiftUI
import TradeboardKit
import UIKit

/// Settings → Robinhood on This iPhone: the preview of the phone connecting to Robinhood itself.
struct RobinhoodView: View {
    @State private var link = RobinhoodLink.shared
    @State private var copied = false

    var body: some View {
        List {
            if link.handoff == nil {
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
                Picker("Sign in", selection: $link.redirect) {
                    ForEach(RobinhoodRedirect.allCases) { r in
                        Text(r.title).tag(r)
                    }
                }
                .disabled(link.busy)
                Text(link.redirectURI(link.redirect))
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            } header: {
                Text("Where to sign in")
            } footer: {
                Text(link.redirect == .computer
                     ? "Robinhood only lets you connect from a computer's browser. You'll get a link to open on your Mac or PC; sign in there and this iPhone finishes by itself. The one-time code passes through your board for a few seconds and is useless without a secret that never leaves this iPhone."
                     : "Robinhood's sign-in page refuses phones (\"Use your desktop web browser\"); these options are kept for diagnostics.")
            }

            }

            if let h = link.handoff {
                Section {
                    VStack(spacing: 14) {
                        Text("On your computer, open")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(h.link)
                            .font(.callout.monospaced().weight(.semibold))
                            .multilineTextAlignment(.center)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("handoff-link")
                        if let qr = Self.qr(h.link) {
                            Image(uiImage: qr)
                                .interpolation(.none)
                                .resizable()
                                .frame(width: 180, height: 180)
                                .accessibilityLabel("QR code for the sign-in link")
                        }
                        HStack(spacing: 12) {
                            if let u = URL(string: h.link) {
                                ShareLink(item: u) { Label("Share", systemImage: "square.and.arrow.up") }
                                    .buttonStyle(.bordered)
                            }
                            Button {
                                UIPasteboard.general.string = h.link
                                copied = true
                            } label: {
                                Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                            }
                            .buttonStyle(.bordered)
                        }
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Waiting for you to sign in on the computer…")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Text("Code \(h.short) · expires \(h.expiresAt.formatted(date: .omitted, time: .shortened))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Button("Cancel", role: .cancel) { link.cancelHandoff() }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                } header: {
                    Text("Sign in on your computer")
                } footer: {
                    Text("Share sends the link to your Mac with AirDrop. Keep Tradeboard open on this iPhone until it says you're signed in.")
                }
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
                    Text("Signed in \(at.formatted(date: .abbreviated, time: .shortened)) (\(link.stored.redirect?.title ?? "?")).")
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
        #if DEBUG
        .task {
            // Screenshots of the waiting screen without a real sign-in: `-robinhoodHandoffPreview`.
            if ProcessInfo.processInfo.arguments.contains("-robinhoodHandoffPreview"), link.handoff == nil {
                link.handoff = RobinhoodHandoff(link: "https://tradeboard.hejitech.workers.dev/rh/K7QM-2XDP", short: "K7QM-2XDP", expiresAt: Date().addingTimeInterval(600))
            }
        }
        #endif
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: link.log.count) { _, _ in copied = false }
    }

    static func qr(_ text: String) -> UIImage? {
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let img = f.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let cg = CIContext().createCGImage(img, from: img.extent) else { return nil }
        return UIImage(cgImage: cg)
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
