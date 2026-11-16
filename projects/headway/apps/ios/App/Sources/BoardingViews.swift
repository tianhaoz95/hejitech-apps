import StoreKit
import SwiftUI

/// The ticket barrier: Headway opens once the rider holds a pass (bought here, on the account from any
/// platform, or given by email), and the boarding screen until then. `invite` is the sign-in for
/// riders whose pass is on their account.
struct PassGate<Content: View, Invite: View>: View {
    @State private var pro = RiderPass.shared
    @Environment(\.scenePhase) private var scenePhase
    var signedIn: Bool
    @ViewBuilder var invite: () -> Invite
    @ViewBuilder var content: () -> Content

    var body: some View {
        Group {
            if pro.hasPass {
                content()
            } else if pro.wantsSignIn && !signedIn {
                invite()
                    .safeAreaInset(edge: .bottom) {
                        Button("Back to the fares") { pro.wantsSignIn = false }
                            .font(.footnote).padding(.bottom, 8)
                    }
            } else if pro.checked && !pro.checkingAccount {
                BoardingScreen(signedIn: signedIn)
            } else {
                ProgressView().controlSize(.large)
            }
        }
        .task {
            await pro.start()
            if signedIn { await pro.checkAccount() }
        }
        .onChange(of: signedIn) { _, now in
            if now { Task { await pro.checkAccount() } } else { pro.forgetAccountPass() }
        }
        // A grant made while the app was open (or in the background) shows up when it comes back.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, signedIn, !pro.hasPass { Task { await pro.checkAccount() } }
        }
    }
}

/// Headway Pro's boarding screen: the fare shown the way a rider already reads Caltrain, on a station
/// departure board. A sample board says "now boarding", the line's stops are what Pro includes, and the
/// two fares are paper tickets. Always the board's dark palette, whatever the phone's appearance. It
/// states what guideline 3.1.2 asks for: each fare's billed price and period (the free week only when the
/// rider can still get it), renewal and cancellation, Restore, the license and the privacy policy.
struct BoardingScreen: View {
    @State private var pass = RiderPass.shared
    @State private var fare = RiderPass.annualFare
    var signedIn = false
    static let license = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://headway.hejitech.workers.dev/privacy/")!

    /// The station display: phosphor green and amber on near-black.
    private enum Board {
        static let ink = Color(red: 0.24, green: 1.0, blue: 0.48)
        static let amber = Color(red: 1.0, green: 0.74, blue: 0.22)
        static let night = Color(red: 0.03, green: 0.05, blue: 0.04)
        static let panel = Color(red: 0.07, green: 0.10, blue: 0.08)
        static let dim = Color(red: 0.55, green: 0.65, blue: 0.58)
        static func mono(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font { .system(size: size, weight: weight, design: .monospaced) }
    }
    private static let departures: [(String, String, String)] = [
        ("7:42", "SAN FRANCISCO", "ON TIME"),
        ("7:51", "SAN FRANCISCO", "LEAVE NOW"),
        ("8:12", "SAN FRANCISCO", "+8 MIN"),
    ]
    private static let stops: [(String, String)] = [
        ("Live departures", "Every train for your stations, with when to leave"),
        ("Delay alerts", "Late, cancelled, or two stops from yours"),
        ("Watch & widgets", "Live Activities, the Lock Screen, your wrist"),
        ("Family & glasses", "Follow each other's trains; Even G2 in view"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                departureBoard
                VStack(alignment: .leading, spacing: 4) {
                    Text("Never run for a train again.").font(.title2.bold()).foregroundStyle(.white)
                    Text("Headway Pro is your pass for the whole line.").font(.subheadline).foregroundStyle(Board.dim)
                }
                line
                if pass.loadingFares && pass.fares.isEmpty {
                    ProgressView().tint(Board.ink).frame(maxWidth: .infinity)
                }
                HStack(spacing: 10) {
                    if let annual = pass.fares[RiderPass.annualFare] { ticket(annual) }
                    if let lifetime = pass.fares[RiderPass.lifetimeFare] { ticket(lifetime) }
                }
                .fixedSize(horizontal: false, vertical: true)
                if let chosen = pass.fares[fare] { boardButton(chosen) }
                fineprint
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
        }
        .background(Board.night.ignoresSafeArea())
        .environment(\.colorScheme, .dark)
        .disabled(pass.busy != nil && pass.busy != "restore")
    }

    private var departureBoard: some View {
        VStack(spacing: 0) {
            HStack {
                Text("HEADWAY PRO").font(Board.mono(13, .bold)).foregroundStyle(Board.ink)
                Spacer()
                Text("NOW BOARDING").font(Board.mono(13, .bold)).foregroundStyle(Board.amber)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            Rectangle().fill(Board.ink.opacity(0.25)).frame(height: 1)
            ForEach(Self.departures, id: \.0) { time, to, status in
                HStack {
                    Text(time).frame(width: 52, alignment: .leading)
                    Text(to)
                    Spacer()
                    Text(status).foregroundStyle(status == "ON TIME" ? Board.ink : Board.amber)
                }
                .font(Board.mono(14))
                .foregroundStyle(Board.ink.opacity(0.9))
                .padding(.horizontal, 14).padding(.vertical, 7)
            }
            .padding(.vertical, 4)
        }
        .background(Board.panel, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Board.ink.opacity(0.3), lineWidth: 1))
        .accessibilityHidden(true)
    }

    /// What Pro includes, drawn as the stops of a line.
    private var line: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(Self.stops.enumerated()), id: \.offset) { i, stop in
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 0) {
                        Circle().strokeBorder(Board.ink, lineWidth: 3).frame(width: 16, height: 16)
                        if i < Self.stops.count - 1 { Rectangle().fill(Board.ink.opacity(0.6)).frame(width: 3).frame(maxHeight: .infinity) }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stop.0).font(.headline).foregroundStyle(.white)
                        Text(stop.1).font(.footnote).foregroundStyle(Board.dim)
                    }
                    .padding(.bottom, 14)
                }
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func ticket(_ product: Product) -> some View {
        let yearly = product.id == RiderPass.annualFare
        let on = fare == product.id
        return Button { fare = product.id } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(yearly ? "YEARLY PASS" : "LIFETIME PASS").font(Board.mono(12, .bold)).foregroundStyle(on ? Board.ink : Board.dim)
                Text(product.displayPrice).font(Board.mono(26, .bold)).foregroundStyle(.white)
                Text(yearly ? "per year" : "once, for good").font(.caption).foregroundStyle(Board.dim)
                Spacer(minLength: 6)
                // The tear line of a paper ticket.
                Rectangle().stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4])).foregroundStyle(Board.dim.opacity(0.6)).frame(height: 1)
                Text(yearly ? (pass.freeWeekAvailable ? "First 7 days free" : "Renews yearly") : "No renewals")
                    .font(Board.mono(11, .semibold)).foregroundStyle(yearly && pass.freeWeekAvailable ? Board.amber : Board.dim)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(on ? Board.ink.opacity(0.12) : Board.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(on ? Board.ink : Board.dim.opacity(0.3), lineWidth: on ? 2 : 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier(yearly ? "plan-annual" : "plan-lifetime")
    }

    private func boardButton(_ product: Product) -> some View {
        let yearly = product.id == RiderPass.annualFare
        let title = pass.busy == product.id ? "Opening the App Store…"
            : !yearly ? "Buy lifetime pass · \(product.displayPrice)"
            : pass.freeWeekAvailable ? "Board free for 7 days" : "Board · \(product.displayPrice) a year"
        return VStack(spacing: 6) {
            Button { Task { await pass.buy(product.id) } } label: {
                Text(title).font(.headline).foregroundStyle(Board.night)
                    .frame(maxWidth: .infinity).padding(.vertical, 15)
                    .background(Board.ink, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("buy-pro")
            Text(!yearly ? "One payment. No renewals." : pass.freeWeekAvailable ? "Then \(product.displayPrice) every year. Cancel any time." : "Renews every year. Cancel any time.")
                .font(.footnote).foregroundStyle(Board.dim)
        }
    }

    private var fineprint: some View {
        VStack(spacing: 12) {
            if let annual = pass.fares[RiderPass.annualFare] {
                Text("Yearly pass: \(pass.freeWeekAvailable ? "7 days free, then " : "")\(annual.displayPrice) a year, charged to your Apple Account. It renews unless you cancel at least 24 hours before the year ends, in Settings › your name › Subscriptions. The lifetime pass is a single payment.")
                    .font(.caption2).foregroundStyle(Board.dim).multilineTextAlignment(.center)
            }
            if let error = pass.error { Text(error).font(.footnote).foregroundStyle(Board.amber).multilineTextAlignment(.center) }
            if pass.fares.isEmpty && !pass.loadingFares {
                Button("Try Again") { Task { await pass.loadFares() } }.tint(Board.ink)
            }
            if let note = pass.accountNote { Text(note).font(.footnote).foregroundStyle(Board.dim).multilineTextAlignment(.center) }
            HStack(spacing: 18) {
                Button(pass.busy == "restore" ? "Restoring…" : "Restore") { Task { await pass.restore() } }
                    .accessibilityIdentifier("restore-purchases")
                Link("License", destination: Self.license)
                Link("Privacy", destination: Self.privacy)
            }
            .font(.footnote).tint(Board.ink)
            .disabled(pass.busy != nil)
            if !signedIn {
                Button("Pass on your Headway account? Sign in") { pass.wantsSignIn = true }
                    .font(.footnote).tint(Board.ink)
                    .accessibilityIdentifier("invite-sign-in")
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Settings: the rider's pass, Manage Subscription and Restore.
struct PassSettingsSection: View {
    @State private var pro = RiderPass.shared
    @State private var manage = false

    var body: some View {
        Section("Headway Pro") {
            switch pro.ticket {
            case .lifetime:
                Label("Lifetime pass", systemImage: "checkmark.seal.fill")
            case .annual(let expires):
                Label(expires.map { "Annual · renews or ends \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "Yearly pass", systemImage: "checkmark.seal.fill")
                Button("Manage Subscription") { manage = true }
            case nil where pro.hasPass:
                Label("On your Headway account", systemImage: "person.badge.key.fill")
            case nil:
                Label("No pass yet", systemImage: "ticket")
            }
            Button(pro.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await pro.restore() } }
                .disabled(pro.busy != nil)
            if let error = pro.error, pro.ticket == nil {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .manageSubscriptionsSheet(isPresented: $manage)
    }
}
