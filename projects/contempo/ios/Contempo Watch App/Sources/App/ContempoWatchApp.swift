import ContempoCore
import SwiftUI
import WatchKit

/// Background-refresh task id — the fallback sync attempt for whenever the
/// watch had no connectivity right after a recording (the immediate
/// foregrounded attempt in `WatchCaptureViewModel.stopRecordingAndSend`
/// already covers the common case). watchOS's `WKApplicationRefreshBackgroundTask`
/// equivalent of Android Wear's periodic `PendingCaptureSyncWorker`.
let pendingUploadBackgroundTaskId = "com.hejitech.contempoapp.watchkitapp.pending-upload"
private let backgroundRefreshIntervalSeconds: TimeInterval = 15 * 60

@main
struct ContempoWatchApp: App {
    init() {
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .onAppear { scheduleNextBackgroundRefresh() }
        }
        .backgroundTask(.appRefresh(pendingUploadBackgroundTaskId)) {
            await PendingCaptureSyncer.syncAll()
            scheduleNextBackgroundRefresh()
        }
    }
}

func scheduleNextBackgroundRefresh() {
    let preferredDate = Date().addingTimeInterval(backgroundRefreshIntervalSeconds)
    WKApplication.shared().scheduleBackgroundRefresh(withPreferredDate: preferredDate, userInfo: nil) { _ in }
}
