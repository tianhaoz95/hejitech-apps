import Foundation
import WatchKit

/// SessionKeeper manages WKExtendedRuntimeSession to keep TinyTouch active
/// and prevent the Apple Watch display from sleeping prematurely while a parent
/// is holding a toddler.
final class SessionKeeper: NSObject, ObservableObject, WKExtendedRuntimeSessionDelegate {
    static let shared = SessionKeeper()
    
    @Published var isSessionActive: Bool = false
    private var session: WKExtendedRuntimeSession?
    
    override private init() {
        super.init()
    }
    
    /// Starts an extended runtime session to prevent display sleep and keep app active
    func startSession() {
        guard session == nil || session?.state == .invalid else { return }
        
        let newSession = WKExtendedRuntimeSession()
        newSession.delegate = self
        self.session = newSession
        newSession.start()
    }
    
    /// Stops the extended runtime session
    func stopSession() {
        guard let current = session, current.state == .running else { return }
        current.invalidate()
        session = nil
        isSessionActive = false
    }
    
    // MARK: - WKExtendedRuntimeSessionDelegate
    
    func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
        DispatchQueue.main.async {
            self.isSessionActive = true
        }
    }
    
    func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
        // Prepare to restart if child is still playing
        DispatchQueue.main.async {
            self.session = nil
            self.isSessionActive = false
            self.startSession()
        }
    }
    
    func extendedRuntimeSession(_ extendedRuntimeSession: WKExtendedRuntimeSession, didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason, error: Error?) {
        DispatchQueue.main.async {
            self.session = nil
            self.isSessionActive = false
            print("Session invalidated: reason=\(reason.rawValue), error=\(String(describing: error))")
        }
    }
}
