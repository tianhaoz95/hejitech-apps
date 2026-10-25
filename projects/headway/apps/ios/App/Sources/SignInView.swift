import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuth
    @State private var email = "rider@example.com"
    @State private var password = ""

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
        .task {
            #if DEBUG
            // `-autoSignIn` signs in the local seed rider (screenshots without taps).
            if ProcessInfo.processInfo.arguments.contains("-autoSignIn") { await model.signInWithEmail("rider@example.com", "headway-dev") }
            #endif
        }
    }
}
