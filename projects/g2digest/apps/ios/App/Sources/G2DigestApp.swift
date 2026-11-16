import SwiftUI

@main
struct G2DigestApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            ReaderGate(signedIn: appModel.isSignedIn, invite: { NavigationStack { PairingSheet(appModel: appModel) } }) {
                MainView(appModel: appModel)
            }
        }
    }
}
