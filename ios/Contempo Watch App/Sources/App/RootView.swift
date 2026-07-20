import ContempoCore
import SwiftUI

struct RootView: View {
    @State private var authManager = WatchAuthManager.shared

    var body: some View {
        Group {
            if authManager.isSignedIn {
                WatchCaptureScreen()
            } else if authManager.isWaitingForPhone {
                VStack(spacing: 8) {
                    ProgressView()
                    Text("Open Contempo on your phone to finish pairing.")
                        .font(ContempoFont.bodyLarge())
                        .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                ProgressView()
            }
        }
        .contempoTheme()
        .onAppear {
            authManager.start()
        }
    }
}
