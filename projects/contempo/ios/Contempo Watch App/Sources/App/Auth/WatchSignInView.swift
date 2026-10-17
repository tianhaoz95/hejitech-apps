import ContempoCore
import SwiftUI

/// Sign-In / Pairing screen presented on watchOS when the watch is unauthenticated.
/// Prompts the user to open Contempo on their iPhone to complete authentication & pairing.
struct WatchSignInView: View {
    @State private var authManager = WatchAuthManager.shared
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(palette.pineTint)
                        .frame(width: 52, height: 52)

                    Image(systemName: "iphone.and.arrow.forward")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(palette.pine)
                }

                Text("Sign In Required")
                    .font(ContempoFont.titleMedium())
                    .foregroundStyle(palette.ink)
                    .multilineTextAlignment(.center)

                Text("Open Contempo on your iPhone to sign in and pair your watch.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkSoft)
                    .multilineTextAlignment(.center)

                Spacer().frame(height: 4)

                if let statusMessage = authManager.statusMessage {
                    Text(statusMessage)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.brass)
                        .multilineTextAlignment(.center)
                } else {
                    HStack(spacing: 6) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Waiting for phone…")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                }

                Button {
                    authManager.requestTokenFromPhone()
                } label: {
                    Text("Pair / Check status")
                        .font(ContempoFont.labelSmall())
                }
                .buttonStyle(.bordered)
                .tint(palette.pine)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
    }
}
