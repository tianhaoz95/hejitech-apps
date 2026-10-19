import SwiftUI

@main
struct KidsCamApp: App {
    @StateObject private var cameraManager = DualCameraManager.shared
    @StateObject private var soundManager = SoundEffectManager.shared
    @StateObject private var watchConnectivity = WatchConnectivityManager.shared
    @StateObject private var guidedAccess = GuidedAccessManager.shared
    @StateObject private var watchFace = WatchFaceManager.shared

    var body: some Scene {
        WindowGroup {
            ToddlerCameraView()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
                .environmentObject(cameraManager)
                .environmentObject(soundManager)
                .environmentObject(watchConnectivity)
                .environmentObject(guidedAccess)
                .environmentObject(watchFace)
        }
    }
}
