import Foundation
import SwiftUI

/// Coordinates launch requests from App Intents (Siri, Shortcuts app, Action Button, etc.)
/// and URL schemes, both on cold start and when running in the background.
final class TinyTouchLaunchRequest: ObservableObject {
    static let shared = TinyTouchLaunchRequest()
    
    private let lock = NSLock()
    private var _pendingMode: GameMode?
    
    @Published var requestedMode: GameMode?
    
    private init() {}
    
    /// Consume any pending launch mode thread-safely (for AppState.init)
    func consumePendingMode() -> GameMode? {
        lock.lock()
        defer { lock.unlock() }
        let mode = _pendingMode
        _pendingMode = nil
        return mode
    }
    
    /// Called when an AppIntent or URL requests launching or switching modes
    func requestLaunch(mode: GameMode? = nil) {
        if let mode = mode {
            lock.lock()
            _pendingMode = mode
            lock.unlock()
        }
        
        SessionKeeper.shared.startSession()
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let mode = mode {
                self.requestedMode = mode
            }
            if let appState = WatchConnectivityManager.shared.appState {
                if let mode = mode {
                    appState.chooseMode(mode)
                }
                appState.isParentMenuOpen = false
                appState.isParentGuideOpen = false
                appState.startSession()
            }
        }
    }
}
