import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var model
    @State private var emailSheet = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 18) {
                Image("AppMark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 92, height: 92)
                    .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
                    .shadow(color: .accentColor.opacity(0.25), radius: 16, y: 8)
                    .accessibilityHidden(true)
                VStack(spacing: 10) {
                    Text("Folio").font(.largeTitle.bold())
                    Text("Review what your AI agents make together. Accept their suggestions, reply to comments and see every version, wherever you are.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 8)

            VStack(alignment: .leading, spacing: 14) {
                Feature(icon: "sparkles.rectangle.stack", title: "One artifact, every agent", text: "Claude, Gemini, ChatGPT and others edit the same pages.")
                Feature(icon: "checkmark.bubble", title: "Review from a notification", text: "Accept or reject a suggestion without opening the app.")
                Feature(icon: "square.and.arrow.down.on.square", title: "Share into Folio", text: "Send a page, text or photos from any app for an agent to pick up.")
            }
            .padding(.top, 36)

            Spacer()

            VStack(spacing: 12) {
                AppleSignInButton { result in
                    Task { await model.signInWithApple(result) }
                }
                GoogleSignInButton {
                    Task { await model.signInWithGoogle() }
                }
                Button { emailSheet = true } label: {
                    Text("Sign in with email")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("email-signin")

                if let e = model.signInError {
                    Label(e, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
                Text("Your sign-in is shared with other HEJI apps. Folio keeps only your artifacts and settings.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(24)
        .background(Color.paper.ignoresSafeArea())
        .overlay {
            if model.busy {
                ProgressView().controlSize(.large).frame(maxWidth: .infinity, maxHeight: .infinity).background(.ultraThinMaterial)
            }
        }
        .sheet(isPresented: $emailSheet) { EmailSignInSheet() }
        .task {
            #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-emailSheet") { emailSheet = true }
            // `-reviewSignIn` signs in through the App Review path (local: review@example.com /
            // folio-review-dev; production: FOLIO_REVIEW_EMAIL / FOLIO_REVIEW_PASSWORD in the launch environment).
            if args.contains("-reviewSignIn") {
                let env = ProcessInfo.processInfo.environment
                try? await model.signInWithEmail(env["FOLIO_REVIEW_EMAIL"] ?? "review@example.com", password: env["FOLIO_REVIEW_PASSWORD"] ?? "folio-review-dev")
            }
            #endif
        }
    }
}

private struct Feature: View {
    let icon: String
    let title: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color.accentColor)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(text).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Email sign-in for accounts Folio hands out, such as App Review's demo account. People sign up
/// with Apple or Google; there is no email sign-up or password reset.
struct EmailSignInSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
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
                Text("For accounts Folio gave you. New here? Continue with Apple or Google.")
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

            if let error {
                Label(error, systemImage: "exclamationmark.circle.fill")
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
        .presentationBackground(Color.paper)
        .onAppear { focus = .email }
    }

    private func submit() {
        guard canSubmit else { return }
        busy = true
        error = nil
        Task {
            do {
                try await model.signInWithEmail(email, password: password)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }
}
