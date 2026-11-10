import AuthenticationServices
import SwiftUI
import TradeboardKit

public struct SignInView: View {
    @Environment(AppModel.self) private var model
    @State private var email = "owner@example.com"
    @State private var password = "tradeboard-dev"
    @State private var totpCode = ""
    @State private var showDevSignIn = false
    @State private var emailSheet = false

    public init() {}

    public var body: some View {
        @Bindable var model = model
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Brand Mark & Titles
                VStack(spacing: 12) {
                    Image("TradeboardMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 88, height: 88)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)

                    Text("Trading Plan Board")
                        .font(.title.bold())

                    Text("AI agents debate, only you approve. Execution stays with your dedicated Robinhood account.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                Spacer()

                // State-driven interactive area
                switch model.authPhase {
                case .totpRequired(_, let enroll, let secret, let otpauth):
                    totpVerificationView(enroll: enroll, secret: secret, otpauth: otpauth)
                default:
                    primarySignInActions
                }

                if let err = model.error {
                    Text(err)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                }

                Spacer()
            }
            .padding(24)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $emailSheet) { EmailSignInSheet() }
            .task {
                #if DEBUG
                // `-emailSheet` opens the email sheet; `-reviewSignIn` signs in through the App Review
                // path (local: review@example.com / tradeboard-review-dev) for screenshots without taps.
                if ProcessInfo.processInfo.arguments.contains("-emailSheet") { emailSheet = true }
                if ProcessInfo.processInfo.arguments.contains("-reviewSignIn") { _ = await model.signInWithEmailAccount("review@example.com", "tradeboard-review-dev") }
                #endif
            }
        }
    }

    // MARK: - Sign-In Buttons

    private var primarySignInActions: some View {
        VStack(spacing: 14) {
            SignInWithAppleButton(.continue) { request in
                request.requestedScopes = [.email]
            } onCompletion: { result in
                Task { await model.signInWithApple(result) }
            }
            .signInWithAppleButtonStyle(.whiteOutline)
            .frame(height: 50)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Button { emailSheet = true } label: {
                Text("Sign in with email")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("email-signin")

            #if DEBUG
            VStack(spacing: 10) {
                Button {
                    showDevSignIn.toggle()
                } label: {
                    HStack {
                        Image(systemName: "hammer.fill")
                        Text(showDevSignIn ? "Hide Dev Login" : "Developer / Seed Login")
                    }
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)

                if showDevSignIn {
                    VStack(spacing: 8) {
                        TextField("Email", text: $email)
                            .textContentType(.username)
                            .textInputAutocapitalization(.never)
                            .textFieldStyle(.roundedBorder)

                        SecureField("Password", text: $password)
                            .textFieldStyle(.roundedBorder)

                        Button("Sign in with Seed Account") {
                            Task { await model.signInWithEmail(email, password) }
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.regular)
                    }
                    .padding()
                    .background(Color.secondary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            #endif

            Text("Accounts are verified with a 2-factor authenticator before any orders can be viewed or approved.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.top, 8)
        }
    }

    // MARK: - TOTP Verification View

    private func totpVerificationView(enroll: Bool, secret: String?, otpauth: String?) -> some View {
        VStack(spacing: 18) {
            VStack(spacing: 6) {
                Text(enroll ? "Enroll Authenticator" : "Two-Factor Code")
                    .font(.headline)

                Text(enroll
                     ? "Scan this setup key or tap below to add Tradeboard to your authenticator app (1Password, Google Authenticator, iOS Passwords)."
                     : "Enter the current 6-digit code from your authenticator app.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if enroll, let secret {
                VStack(spacing: 8) {
                    Text(secret)
                        .font(.system(.subheadline, design: .monospaced).bold())
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(Color.secondary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    if let uri = otpauth, let url = URL(string: uri) {
                        Link(destination: url) {
                            Label("Open in Authenticator", systemImage: "arrow.up.forward.app")
                                .font(.footnote.weight(.semibold))
                        }
                    }
                }
            }

            HStack {
                TextField("000000", text: $totpCode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .multilineTextAlignment(.center)
                    .font(.system(size: 28, weight: .bold, design: .monospaced))
                    .frame(width: 180, height: 50)
                    .background(Color.secondary.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            Button {
                Task { await model.verifyTOTP(code: totpCode) }
            } label: {
                if model.isLoading {
                    ProgressView().tint(.white)
                } else {
                    Text("Verify & Continue")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(totpCode.count < 6 || model.isLoading)

            Button("Back to sign-in") {
                Task { await model.signOut() }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

/// Email sign-in for accounts Tradeboard hands out, such as App Review's demo account. People sign up
/// with Apple and a two-factor code; there's no email sign-up or password reset.
struct EmailSignInSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @FocusState private var focus: Field?
    private enum Field { case email, password }

    private var canSubmit: Bool { !busy && !email.isEmpty && !password.isEmpty }

    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.secondary)
                        .frame(width: 30, height: 30)
                        .background(.quaternary, in: Circle())
                }
                .accessibilityLabel("Close")
            }

            VStack(spacing: 6) {
                Text("Sign in with email").font(.title2.bold())
                Text("For accounts Tradeboard gave you. New here? Continue with Apple.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: 0) {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focus, equals: .email)
                    .onSubmit { focus = .password }
                    .padding(14)
                Divider().padding(.leading, 14)
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($focus, equals: .password)
                    .onSubmit { submit() }
                    .padding(14)
            }
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            if let e = model.error {
                Label(e, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: submit) {
                ZStack {
                    Text("Sign in").opacity(busy ? 0 : 1)
                    if busy { ProgressView() }
                }
                .frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!canSubmit)

            Spacer(minLength: 0)
        }
        .padding(24)
        .presentationDetents([.medium])
        .presentationCornerRadius(28)
        .presentationBackground(Color(uiColor: .systemBackground))
        .onAppear {
            model.error = nil
            focus = .email
        }
    }

    private func submit() {
        guard canSubmit else { return }
        busy = true
        Task {
            if await model.signInWithEmailAccount(email, password) { dismiss() }
            busy = false
        }
    }
}
