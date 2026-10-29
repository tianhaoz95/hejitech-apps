import ContempoCore
import SwiftUI

struct SignInScreen: View {
    @State private var viewModel = SignInViewModel()
    @State private var emailSheet = ProcessInfo.processInfo.arguments.contains("-emailSheet")
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(spacing: 0) {
            Eyebrow("Welcome")
                .padding(.bottom, 12)
            Text("Contempo")
                .font(ContempoFont.headlineLarge())
                .tracking(ContempoFont.headlineLargeTracking)
                .padding(.bottom, 8)
            Text("Sign in to start logging contemporaneous work hours.")
                .font(ContempoFont.bodyLarge())
                .foregroundStyle(palette.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.bottom, 32)

            Button(action: viewModel.signIn) {
                HStack(spacing: 12) {
                    if viewModel.isSigningIn {
                        ProgressView()
                            .tint(palette.paperRaised)
                    } else {
                        Image(systemName: "g.circle.fill")
                            .foregroundStyle(.white, palette.pine)
                    }
                    Text("Sign in with Google")
                        .font(ContempoFont.labelLarge())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)
            .disabled(viewModel.isSigningIn)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))

            Button { emailSheet = true } label: {
                Text("Sign in with email")
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.inkSoft)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
            .accessibilityIdentifier("email-signin")

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(ContempoFont.bodyLarge())
                    .foregroundStyle(palette.danger)
                    .padding(.top, 16)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.paper)
        .sheet(isPresented: $emailSheet) { EmailSignInSheet(viewModel: viewModel) }
        .task {
            #if DEBUG
            // `-reviewSignIn <email> <password>` signs in through the App Review path (checks without typing).
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-reviewSignIn"), i + 2 < args.count {
                _ = await viewModel.signIn(email: args[i + 1], password: args[i + 2])
            }
            #endif
        }
    }
}

/// Email sign-in for accounts Contempo hands out, such as App Review's demo account. People sign in
/// with Google; there is no email sign-up or password reset.
struct EmailSignInSheet: View {
    let viewModel: SignInViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @FocusState private var focus: Field?
    private enum Field { case email, password }

    private var canSubmit: Bool { !busy && !email.isEmpty && !password.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Eyebrow("Account")
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(palette.inkSoft)
                        .frame(width: 30, height: 30)
                        .background(palette.surfaceContainerHigh, in: Circle())
                }
                .accessibilityLabel("Close")
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Sign in with email")
                    .font(ContempoFont.headlineMedium())
                    .tracking(ContempoFont.headlineMediumTracking)
                    .foregroundStyle(palette.ink)
                Text("For accounts Contempo gave you. Everyone else signs in with Google.")
                    .font(ContempoFont.bodyMedium())
                    .foregroundStyle(palette.inkSoft)
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
                Rectangle().fill(palette.hairline).frame(height: 1)
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($focus, equals: .password)
                    .onSubmit { submit() }
                    .padding(14)
            }
            .font(ContempoFont.bodyLarge())
            .foregroundStyle(palette.ink)
            .background(palette.paperRaised, in: RoundedRectangle(cornerRadius: ContempoRadius.medium))
            .overlay(RoundedRectangle(cornerRadius: ContempoRadius.medium).stroke(palette.hairlineStrong, lineWidth: 1))

            if let e = viewModel.errorMessage {
                Label(e, systemImage: "exclamationmark.circle.fill")
                    .font(ContempoFont.bodyMedium())
                    .foregroundStyle(palette.danger)
            }

            Button(action: submit) {
                ZStack {
                    Text("Sign in").font(ContempoFont.labelLarge()).opacity(busy ? 0 : 1)
                    if busy { ProgressView().tint(palette.paperRaised) }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
            .disabled(!canSubmit)

            Spacer(minLength: 0)
        }
        .padding(24)
        .presentationDetents([.medium])
        .presentationCornerRadius(24)
        .presentationBackground(palette.paper)
        .onAppear {
            viewModel.errorMessage = nil
            focus = .email
        }
    }

    private func submit() {
        guard canSubmit else { return }
        busy = true
        Task {
            if await viewModel.signIn(email: email, password: password) { dismiss() }
            busy = false
        }
    }
}
