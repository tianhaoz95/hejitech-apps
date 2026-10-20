import SwiftUI
#if canImport(FeedbackKit)
import FeedbackKit
#endif

@main
struct VoxbriefApp: App {
    @StateObject private var watchSyncService = WatchSyncService.shared
    @StateObject private var noteRepository = NoteRepository.shared
    @StateObject private var pipeline = NoteProcessingPipeline.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        BackgroundProcessingManager.shared.install()

        #if canImport(FeedbackKit)
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk_ffa7308d843fd670a9bbd1d67ad0ebf54597"
        ))

        FeedbackSettings.setupTriggers()
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(watchSyncService)
                .environmentObject(noteRepository)
                .environmentObject(pipeline)
                .onChange(of: scenePhase) { _, phase in
                    BackgroundProcessingManager.shared.scenePhaseChanged(to: phase)
                }
        }
    }
}

/// Hosts the main note list plus the app-wide chrome (first-run onboarding, appearance,
/// and the Live Activity "Stop & Save" deep link) that only makes sense at the root.
private struct RootView: View {
    @AppStorage("has_completed_onboarding") private var hasCompletedOnboarding = false
    @AppStorage("app_appearance") private var appearance: String = "system"
    @State private var showOnboarding = false

    var body: some View {
        NoteListView()
            .preferredColorScheme(colorScheme)
            .onAppear {
                showOnboarding = !hasCompletedOnboarding
            }
            .fullScreenCover(isPresented: $showOnboarding) {
                OnboardingView {
                    hasCompletedOnboarding = true
                    showOnboarding = false
                }
                .preferredColorScheme(colorScheme)
            }
            .onOpenURL { url in
                handleDeepLink(url)
            }
            .onReceive(VoxbriefDeepLinkInbox.shared.$pending.compactMap { $0 }) { _ in
                guard let url = VoxbriefDeepLinkInbox.shared.take() else { return }
                // On a cold launch from a control this fires during the very first render --
                // wait (as NoteListView.applyLaunchArguments does) until NoteListView is
                // listening for .voxbriefNavigate and can present the record sheet.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    handleDeepLink(url)
                }
            }
    }

    private var colorScheme: ColorScheme? {
        switch appearance {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    private func handleDeepLink(_ url: URL) {
        if url.isFileURL {
            // "Open in Voxbrief" for an audio or video file (CFBundleDocumentTypes).
            Task {
                do {
                    try await AudioImportService.shared.importOpenedFile(url)
                } catch {
                    print("[VoxbriefApp] Import of \(url.lastPathComponent) failed: \(error)")
                }
            }
            return
        }
        guard let host = url.host else { return }
        let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        var params: [String: String] = [:]
        for item in queryItems {
            if let val = item.value {
                params[item.name] = val
            }
        }

        if host == "record" {
            let action = params["action"]
            if action == "stop" {
                RecordingCoordinator.shared.handleStopDeepLink()
            } else if params["source"] == "keyboard" {
                // Opened by VoxbriefKeyboard's record button (see KeyboardView) -- routes to a
                // dedicated flow (KeyboardRecordSheet) that, unlike the normal record sheet, waits
                // for processing to finish and hands the result to the keyboard via
                // KeyboardHandoff instead of just returning to the note list.
                NotificationCenter.default.post(
                    name: .voxbriefNavigate,
                    object: nil,
                    userInfo: ["screen": "keyboardRecord"]
                )
            } else {
                var userInfo: [String: String] = ["screen": "record"]
                if let source = params["source"] {
                    userInfo["source"] = source
                }
                NotificationCenter.default.post(
                    name: .voxbriefNavigate,
                    object: nil,
                    userInfo: userInfo
                )
            }
        } else if host == "navigate" {
            NotificationCenter.default.post(
                name: .voxbriefNavigate,
                object: nil,
                userInfo: params
            )
        }
    }
}

extension Notification.Name {
    public static let voxbriefNavigate = Notification.Name("com.jacksonzhou666.voxbrief.navigate")
}
