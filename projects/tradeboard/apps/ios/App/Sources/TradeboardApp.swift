import SwiftUI
import TradeboardKit

@main
struct TradeboardApp: App {
    @State private var model = AppModel.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(.accentColor)
                .task {
                    await model.start()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await model.refresh() }
                    }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var showWhatsNew = false

    var body: some View {
        Group {
            switch model.authPhase {
            case .checking:
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading Tradeboard…")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            case .authenticated:
                BoardView()
            case .unauthenticated, .totpRequired:
                SignInView()
            }
        }
        .task {
            let lastSeen = UserDefaults.standard.string(forKey: WhatsNewView.lastSeenVersionKey)
            if lastSeen != WhatsNewView.currentVersion {
                showWhatsNew = true
            }
        }
        .sheet(isPresented: $showWhatsNew) {
            WhatsNewView()
        }
    }
}
