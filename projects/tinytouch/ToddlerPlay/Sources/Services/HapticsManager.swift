import Foundation
import WatchKit

/// High-level sensory haptics interface using the Apple Watch Taptic Engine.
/// Provides immediate, gentle physical feedback to toddlers for every touch action.
final class HapticsManager {
    static let shared = HapticsManager()
    
    var isEnabled: Bool = true
    
    private init() {}
    
    /// Immediate light tactile click for button presses and screen taps
    func playTap() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.click)
    }
    
    /// Cheerful tactile pop when popping bubbles
    func playPop() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.directionUp)
    }
    
    /// Springy bounce sensation for animal touches
    func playBounce() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.notification)
    }
    
    /// Subtle tick when the Digital Crown is rotated
    func playCrownTick() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.click)
    }
    
    /// Rewarding success pulse when parent unlocks the shield
    func playSuccess() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.success)
    }
    
    /// Rhythm tick while holding down the Parent Shield
    func playProgressTick() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.click)
    }
    
    /// Gentle soothing pulse for lullaby mode
    func playGentlePulse() {
        guard isEnabled else { return }
        WKInterfaceDevice.current().play(.directionDown)
    }
}
