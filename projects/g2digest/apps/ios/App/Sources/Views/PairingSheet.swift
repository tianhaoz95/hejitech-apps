import AuthenticationServices
import SwiftUI
import G2DigestKit

/// Sign in (Apple or Google, the same account as the web app) or, without an account on this
/// phone, pair it with a 6-digit code from the web app's Pair page (editions only).
public struct PairingSheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.webAuthenticationSession) private var webAuth
    @Environment(\.colorScheme) private var colorScheme

    @State private var code: String = ""
    @State private var isRedeeming: Bool = false
    @State private var errorMessage: String?
    @State private var showCode = false
    #if DEBUG
    @State private var seedEmail = "reader@example.com"
    @State private var seedPassword = "g2digest-dev"
    #endif

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    Image(systemName: "eyeglasses")
                        .font(.system(size: 54))
                        .foregroundStyle(Color.accentColor)
                        .padding(.top, 20)

                    VStack(spacing: 8) {
                        Text("Sign in to G2 Digest")
                            .font(.title2.bold())
                        Text("Use the account you use on the web: your brief, every edition, your glasses and assistants.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    VStack(spacing: 12) {
                        SignInWithAppleButton(.continue) { request in
                            request.requestedScopes = [.email]
                        } onCompletion: { result in
                            Task { await appModel.signInWithApple(result) }
                        }
                        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                        .frame(height: 50)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Button {
                            Task { await appModel.signInWithGoogle(using: webAuth) }
                        } label: {
                            Label("Continue with Google", systemImage: "globe")
                                .font(.body.weight(.semibold))
                                .frame(maxWidth: .infinity, minHeight: 36)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .accessibilityIdentifier("google-signin")

                        if let err = appModel.errorMessage, !showCode {
                            Text(err)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.center)
                        }

                        #if DEBUG
                        if AuthConfig.forServer(URL(string: UserDefaults.standard.string(forKey: "g2digest_server_url") ?? "") ?? AppModel.defaultServerURL) == .local {
                            VStack(spacing: 8) {
                                TextField("Email", text: $seedEmail).textInputAutocapitalization(.never)
                                SecureField("Password", text: $seedPassword)
                                Button("Sign in (local seed)") {
                                    Task { await appModel.signInWithSeed(email: seedEmail, password: seedPassword) }
                                }
                            }
                            .textFieldStyle(.roundedBorder)
                        }
                        #endif
                    }
                    .padding(.horizontal, 24)

                    Divider().padding(.horizontal, 24)

                    if appModel.isPaired {
                        VStack(spacing: 10) {
                            Label("This iPhone is paired with a code", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text("A paired iPhone reads editions only. Sign in to see your brief and manage your glasses here too.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                            Button("Unpair This iPhone", role: .destructive) { appModel.unpair() }
                        }
                        .padding(.horizontal, 24)
                    } else {
                        DisclosureGroup("Pair with a code instead", isExpanded: $showCode) {
                            pairWithCode.padding(.top, 12)
                        }
                        .padding(.horizontal, 24)
                    }
                }
                .padding(.bottom, 24)
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onChange(of: appModel.isSignedIn) { signedIn in
                if signedIn { dismiss() }
            }
        }
    }

    private var pairWithCode: some View {
        VStack(spacing: 12) {
            Text("No account on this phone? Open Pair in the G2 Digest web app and type its 6-digit code. A paired iPhone reads your editions only.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            TextField("123456", text: $code)
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .multilineTextAlignment(.center)
                .keyboardType(.numberPad)
                .padding(12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .onChange(of: code) { newValue in
                    let filtered = String(newValue.filter { $0.isNumber }.prefix(6))
                    if filtered != newValue { code = filtered }
                }

            if let err = errorMessage {
                Text(err)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task {
                    isRedeeming = true
                    errorMessage = nil
                    let ok = await appModel.redeemCode(code)
                    isRedeeming = false
                    if ok { dismiss() } else { errorMessage = appModel.errorMessage ?? "Invalid code" }
                }
            } label: {
                Group {
                    if isRedeeming { ProgressView() } else { Text("Pair iPhone").fontWeight(.bold) }
                }
                .frame(maxWidth: .infinity, minHeight: 30)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(code.count != 6 || isRedeeming)
        }
    }
}
