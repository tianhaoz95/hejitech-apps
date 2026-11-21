import FolioKit
import SwiftUI

@main
struct FolioApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .onOpenURL { model.handle(url: $0) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { a in
                    if let u = a.webpageURL { model.handle(url: u) }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("whatsNewSeen") private var whatsNewSeen = ""
    @State private var showWhatsNew = false

    var body: some View {
        Group {
            if model.signedIn {
                HomeView()
                    .task {
                        if model.pushEnabled { await PushRelay.shared.refreshRegistration() }
                        #if DEBUG
                        // `-open <slug>`: straight to an artifact (screenshots, UI checks).
                        let args = ProcessInfo.processInfo.arguments
                        if let i = args.firstIndex(of: "-open"), args.indices.contains(i + 1) { model.open(.artifact(args[i + 1])) }
                        #endif
                        if whatsNewSeen.isEmpty { whatsNewSeen = WhatsNew.currentVersion } else if WhatsNew.shouldShow(seen: whatsNewSeen) { showWhatsNew = true }
                    }
                    .sheet(isPresented: $showWhatsNew, onDismiss: { whatsNewSeen = WhatsNew.currentVersion }) {
                        WhatsNewView()
                    }
            } else {
                SignInView()
            }
        }
        .overlay(alignment: .top) {
            if let t = model.toast {
                Text(t)
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: model.toast)
        .animation(.default, value: model.signedIn)
    }
}
