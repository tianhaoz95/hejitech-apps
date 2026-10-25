import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuth
    @State private var email = "athlete@example.com"
    @State private var password = ""

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 22) {
            Spacer()
            Image("Mark")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .accessibilityHidden(true)
            VStack(spacing: 8) {
                Text("FitLoop").font(.largeTitle.bold())
                Text("The plan your AI agent writes for you, on your iPhone, Apple Watch and Even G2. Check in as you go; your agent reads it back.")
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
                        SecureField("Password (fitloop-dev)", text: $password)
                        Button("Sign in (local seed)") { Task { await model.signInWithEmail(email, password) } }
                    }
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("local-signin")
                }
                #endif

                Text("Your account is shared with other HEJI apps. FitLoop keeps your plans, check-ins, notes for your agent and only the health data you switch on.")
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
        .task {
            #if DEBUG
            // `-autoSignIn` signs in the local seed athlete (screenshots without taps).
            if ProcessInfo.processInfo.arguments.contains("-autoSignIn") { await model.signInWithEmail("athlete@example.com", "fitloop-dev") }
            #endif
        }
    }
}
