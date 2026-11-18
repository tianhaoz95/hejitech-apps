import RoarlyKit
import SwiftUI

@main
struct RoarlyApp: App {
    @StateObject private var model: AppModel

    init() {
        DebugFlags.applyEarly()
        _model = StateObject(wrappedValue: AppModel())
    }
    @StateObject private var store = ProStore.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environmentObject(store)
                .preferredColorScheme(.dark)
                .tint(Theme.lantern)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var model: AppModel
    @State private var showWhatsNew = false

    var body: some View {
        Group {
            if model.onboarded || DebugFlags.skipOnboarding {
                StoryView()
            } else {
                OnboardingView()
            }
        }
        .sheet(isPresented: $model.showPaywall) { PaywallView() }
        .fullScreenCover(isPresented: $model.pocketMode) { PocketView() }
        .sheet(isPresented: $showWhatsNew) { WhatsNewView() }
        .task {
            if model.onboarded, WhatsNewView.shouldShowAutomatically { showWhatsNew = true }
            await DebugFlags.runLaunchActions(model)
        }
    }
}
