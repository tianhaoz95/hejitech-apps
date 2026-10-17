import ContempoCore
import GoogleSignIn
import SwiftUI

@main
struct ContempoApp: App {
    init() {
        FirebaseBootstrap.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
                .task {
                    await ServiceLocator.remoteConfigStore.refresh()
                }
        }
    }
}
