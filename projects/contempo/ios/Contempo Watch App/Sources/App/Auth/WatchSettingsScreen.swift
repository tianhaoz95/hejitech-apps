import ContempoCore
import SwiftUI

/// Sign-out lives on its own page now (see RootView's TabView), separate
/// from WatchCaptureScreen — confirmed live: with both on one page, the
/// mostly-decorative "Sign Out" row sat right below capture's actual
/// controls with no visual separation strong enough to prevent mis-taps.
/// Mirrors the phone app's Settings screen (SettingsScreen.swift) showing
/// the signed-in email above the sign-out action.
struct WatchSettingsScreen: View {
    @Environment(\.contempoPalette) private var palette

    private var email: String { ContempoBackend.email ?? "" }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 32))
                    .foregroundStyle(palette.inkFaint)

                if !email.isEmpty {
                    Text(email)
                        .font(ContempoFont.bodySmall())
                        .foregroundStyle(palette.inkFaint)
                        .multilineTextAlignment(.center)
                }

                Button(role: .destructive) {
                    WatchAuthManager.shared.signOut()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                        Text("Sign Out")
                    }
                    .font(ContempoFont.labelLarge())
                    .bold()
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(palette.danger)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
        .navigationTitle("Settings")
    }
}
