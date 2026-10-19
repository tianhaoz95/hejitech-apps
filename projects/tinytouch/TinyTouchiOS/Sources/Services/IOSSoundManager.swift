import Foundation
import AVFoundation

/// Zero-latency audio player for the iPhone companion app.
/// Allows parents to test and preview all sensory sound effects.
final class IOSSoundManager: ObservableObject {
    static let shared = IOSSoundManager()
    
    @Published var isMuted: Bool = false
    private var players: [String: AVAudioPlayer] = [:]
    
    private init() {
        configureAudioSession()
        preloadSounds()
    }
    
    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Audio session configuration error: \(error)")
        }
    }
    
    private func preloadSounds() {
        let soundNames = [
            "pop_high", "pop_mid", "pop_low",
            "chime_do", "chime_re", "chime_mi", "chime_sol", "chime_la",
            "sparkle_high", "sparkle_low",
            "lullaby_gentle",
            "animal_puppy", "animal_kitten", "animal_duck", "animal_frog", "animal_bear"
        ]
        
        for name in soundNames {
            if let url = Bundle.main.url(forResource: name, withExtension: "wav") {
                do {
                    let player = try AVAudioPlayer(contentsOf: url)
                    player.prepareToPlay()
                    players[name] = player
                } catch {
                    print("Failed to preload \(name): \(error)")
                }
            }
        }
    }
    
    func playSound(_ name: String) {
        guard !isMuted else { return }
        
        if let player = players[name] {
            if player.isPlaying {
                player.currentTime = 0
            }
            player.play()
        } else if let url = Bundle.main.url(forResource: name, withExtension: "wav") {
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                players[name] = player
                player.play()
            } catch {
                print("Failed to play \(name): \(error)")
            }
        }
    }
}
