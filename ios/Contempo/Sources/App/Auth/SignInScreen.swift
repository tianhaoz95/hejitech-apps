import ContempoCore
import SwiftUI

struct SignInScreen: View {
    @State private var viewModel = SignInViewModel()
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
    }
}
