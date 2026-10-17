import ContempoCore
import SwiftUI

@main
struct ContempoApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    // Google sign-in through Supabase returns to com.hejitech.contempoapp://login-callback.
                    ContempoBackend.client.handle(url)
                }
        }
    }
}
