import StoreKit
import SwiftUI

/// The locker-room door: FitLoop opens for members (a membership bought here, on the account from any
/// platform, or given by email) and shows the membership screen to everyone else.
struct MembershipGate<Content: View, Invite: View>: View {
    @State private var pro = Membership.shared
    var signedIn: Bool
    @ViewBuilder var invite: () -> Invite
    @ViewBuilder var content: () -> Content

    var body: some View {
        Group {
            if pro.isMember {
                content()
            } else if pro.showSignIn && !signedIn {
                invite()
                    .safeAreaInset(edge: .bottom) {
                        Button("Back to membership") { pro.showSignIn = false }
                            .font(.footnote).padding(.bottom, 8)
                    }
            } else if pro.checked && !pro.lookingUp {
                MembershipScreen(signedIn: signedIn)
            } else {
                ProgressView().controlSize(.large)
            }
        }
        .task {
            await pro.start()
            if signedIn { await pro.lookUpAccount() }
        }
        .onChange(of: signedIn) { _, now in
            if now { Task { await pro.lookUpAccount() } } else { pro.dropAccountMembership() }
        }
    }
}

/// FitLoop's membership screen, written like the first page of a training program: today's session and
/// meals as the coach would hand them over, what membership covers as a checklist, and the two
/// memberships as a segmented choice. It states what guideline 3.1.2 asks for: each option's billed
/// price and period (the trial only when it's still available), renewal and cancellation, Restore, the
/// license and the privacy policy.
struct MembershipScreen: View {
    @State private var membership = Membership.shared
    @State private var choice = Membership.yearlyOption
    var signedIn = false
    static let license = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://fitloop.hejitech.workers.dev/privacy/")!
    private static let session: [(String, String)] = [("figure.strengthtraining.traditional", "Push day"), ("flame.fill", "2,150 kcal"), ("fork.knife", "160 g protein")]
    private static let covers = [
        "Your assistant's program, day by day",
        "Every set with a rest timer and demos",
        "Heart rate from your watch, into Health",
        "Notes your coach reads and answers",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("WEEK 1 · DAY 1").font(.caption.weight(.heavy)).tracking(1.5).foregroundStyle(.tint)
                    Text("Your coach wrote the plan.\nPress play.").font(.system(.largeTitle, design: .rounded).weight(.heavy))
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 8) {
                    ForEach(Self.session, id: \.1) { icon, label in
                        VStack(spacing: 6) {
                            Image(systemName: icon).font(.title3).foregroundStyle(.tint)
                            Text(label).font(.system(.footnote, design: .rounded).weight(.bold))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
                    }
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Membership covers").font(.system(.headline, design: .rounded))
                    ForEach(Self.covers, id: \.self) { line in
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark").font(.caption.weight(.black)).foregroundStyle(.white)
                                .frame(width: 22, height: 22).background(Color.accentColor, in: RoundedRectangle(cornerRadius: 7))
                            Text(line).font(.subheadline)
                        }
                    }
                }
                if membership.loadingOptions && membership.options.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                if !membership.options.isEmpty {
                    Picker("Membership", selection: $choice) {
                        if membership.options[Membership.yearlyOption] != nil { Text("Yearly").tag(Membership.yearlyOption) }
                        if membership.options[Membership.lifetimeOption] != nil { Text("Lifetime").tag(Membership.lifetimeOption) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("membership-choice")
                }
                if let option = membership.options[choice] { summary(option) }
                details
            }
            .padding(24)
        }
        .tint(Color.accentColor)
    }

    private func summary(_ option: Product) -> some View {
        let yearly = option.id == Membership.yearlyOption
        return VStack(spacing: 14) {
            VStack(spacing: 4) {
                Text(option.displayPrice).font(.system(size: 44, weight: .heavy, design: .rounded))
                Text(yearly ? (membership.trialAvailable ? "a year, after 7 free days" : "a year") : "once, yours for good")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Button { Task { await membership.buy(option.id) } } label: {
                Text(membership.busy == option.id ? "Opening the App Store…" : !yearly ? "Become a lifetime member" : membership.trialAvailable ? "Start my free week" : "Start my membership")
                    .font(.system(.headline, design: .rounded)).frame(maxWidth: .infinity).padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large)
            .accessibilityIdentifier("buy-pro")
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Color.accentColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 24))
    }

    private var details: some View {
        VStack(spacing: 10) {
            if let yearly = membership.options[Membership.yearlyOption] {
                Text("Yearly membership: \(membership.trialAvailable ? "free for 7 days, then " : "")\(yearly.displayPrice) per year through your Apple Account, renewing automatically until you turn it off at least 24 hours before the renewal date in your Apple Account settings. Lifetime membership: one payment.")
                    .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            if let error = membership.error { Text(error).font(.footnote).foregroundStyle(.red) }
            if membership.options.isEmpty && !membership.loadingOptions { Button("Try Again") { Task { await membership.loadOptions() } } }
            if let note = membership.accountMessage { Text(note).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center) }
            HStack(spacing: 16) {
                Button(membership.busy == "restore" ? "Restoring…" : "Restore") { Task { await membership.restore() } }
                    .accessibilityIdentifier("restore-purchases")
                Link("License", destination: Self.license)
                Link("Privacy", destination: Self.privacy)
            }
            .font(.footnote).disabled(membership.busy != nil)
            if !signedIn {
                Button("Member on another device? Sign in") { membership.showSignIn = true }
                    .font(.footnote).accessibilityIdentifier("invite-sign-in")
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Settings: the tier, Manage Subscription and Restore.
struct MembershipSection: View {
    @State private var pro = Membership.shared
    @State private var manage = false

    var body: some View {
        Section("FitLoop Pro") {
            switch pro.tier {
            case .lifetime:
                Label("Lifetime member", systemImage: "medal.fill")
            case .annual(let expires):
                Label(expires.map { "Yearly member · renews or ends \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "Yearly member", systemImage: "medal.fill")
                Button("Manage Subscription") { manage = true }
            case nil where pro.isMember:
                Label("Given to your account", systemImage: "gift.fill")
            case nil:
                Label("Not a member yet", systemImage: "person.crop.circle.badge.questionmark")
            }
            Button(pro.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await pro.restore() } }
                .disabled(pro.busy != nil)
            if let error = pro.error, pro.tier == nil {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .manageSubscriptionsSheet(isPresented: $manage)
    }
}
