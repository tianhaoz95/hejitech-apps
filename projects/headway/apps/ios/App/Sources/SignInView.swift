import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuth
    @State private var email = "rider@example.com"
    @State private var password = ""
    @State private var emailSheet = false

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 22) {
            Spacer()
            Image("HeadwayMark")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .accessibilityHidden(true)
            VStack(spacing: 8) {
                Text("Headway").font(.largeTitle.bold())
                Text("Your next Caltrain on your Even G2, and an alert on your iPhone when it's late, cancelled or almost at your stop.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            VStack(spacing: 12) {
                SignInWithAppleButton(.continue) { $0.requestedScopes = [.email] } onCompletion: { result in
                    Task { await model.signInWithApple(result) }
                }
                .signInWithAppleButtonStyle(.whiteOutline)
                .frame(height: 50)

                Button {
                    Task { await model.signInWithGoogle(using: webAuth) }
                } label: {
                    Label("Continue with Google", systemImage: "globe")
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                #if DEBUG
                if AppModel.config == .local {
                    VStack {
                        TextField("Email", text: $email).textContentType(.username).textInputAutocapitalization(.never)
                        SecureField("Password (headway-dev)", text: $password)
                        Button("Sign in (local seed)") { Task { await model.signInWithEmail(email, password) } }
                    }
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("local-signin")
                }
                #endif

                Button { emailSheet = true } label: {
                    Text("Sign in with email")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("email-signin")

                Text("Your account is shared with other HEJI apps. Headway keeps only your commute, alert choices and devices.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let e = model.error {
                Text(e).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center)
            }
        }
        .padding(24)
        .sheet(isPresented: $emailSheet) { EmailSignInSheet() }
        .task {
            #if DEBUG
            // `-autoSignIn` signs in the local seed rider (screenshots without taps).
            if ProcessInfo.processInfo.arguments.contains("-autoSignIn") { await model.signInWithEmail("rider@example.com", "headway-dev") }
            // `-reviewSignIn` signs in through the App Review path (local: review@example.com / headway-review-dev).
            if ProcessInfo.processInfo.arguments.contains("-emailSheet") { emailSheet = true }
            if ProcessInfo.processInfo.arguments.contains("-reviewSignIn") { _ = await model.signInWithEmailAccount("review@example.com", "headway-review-dev") }
            #endif
        }
    }
}

/// Email sign-in for accounts Headway hands out, such as App Review's demo account. People sign up
/// with Apple or Google; there is no email sign-up or password reset.
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
                Text("For accounts Headway gave you. New here? Continue with Apple or Google.")
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
