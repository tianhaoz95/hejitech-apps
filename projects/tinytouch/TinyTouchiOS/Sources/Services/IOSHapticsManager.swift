import UIKit

/// Haptics interface for the iPhone companion app.
final class IOSHapticsManager {
    static let shared = IOSHapticsManager()
    
    var isEnabled: Bool = true
    
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let notification = UINotificationFeedbackGenerator()
    
    private init() {
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()
        notification.prepare()
    }
    
    func playTap() {
        guard isEnabled else { return }
        lightImpact.impactOccurred()
    }
    
    func playPop() {
        guard isEnabled else { return }
        mediumImpact.impactOccurred()
    }
    
    func playSuccess() {
        guard isEnabled else { return }
        notification.notificationOccurred(.success)
    }
}
