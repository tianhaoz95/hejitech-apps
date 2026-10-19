import Foundation
import AVFoundation
import UIKit

public enum SoundType: String, CaseIterable, Identifiable {
    case shutter = "shutter"
    case woof = "woof"
    case meow = "meow"
    case quack = "quack"
    case giggle = "giggle"
    case boing = "boing"
    case horn = "horn"
    case pop = "pop"

    public var id: String { rawValue }

    public var emoji: String {
        switch self {
        case .shutter: return "📸"
        case .woof: return "🐶"
        case .meow: return "🐱"
        case .quack: return "🦆"
        case .giggle: return "👶"
        case .boing: return "🎪"
        case .horn: return "🎺"
        case .pop: return "🫧"
        }
    }

    public var title: String {
        switch self {
        case .shutter: return "Shutter"
        case .woof: return "Puppy Bark"
        case .meow: return "Kitty Meow"
        case .quack: return "Duck Quack"
        case .giggle: return "Baby Giggle"
        case .boing: return "Spring Boing"
        case .horn: return "Clown Horn"
        case .pop: return "Bubble Pop"
        }
    }
}

public final class SoundEffectManager: ObservableObject {
    public static let shared = SoundEffectManager()

    private var players: [String: AVAudioPlayer] = [:]
    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notificationFeedback = UINotificationFeedbackGenerator()

    @Published public var isMuted: Bool = false

    public init() {
        setupAudioSession()
        preloadSounds()
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
        notificationFeedback.prepare()
    }

    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("[SoundEffectManager] Audio session error: \(error)")
        }
    }

    private func preloadSounds() {
        for sound in SoundType.allCases {
            guard let url = Bundle.main.url(forResource: sound.rawValue, withExtension: "wav") else {
                continue
            }
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.prepareToPlay()
                players[sound.rawValue] = player
            } catch {
                print("[SoundEffectManager] Failed to load sound \(sound.rawValue): \(error)")
            }
        }
    }

    public func play(_ sound: SoundType, haptic: Bool = true) {
        guard !isMuted else { return }

        if let player = players[sound.rawValue] {
            if player.isPlaying {
                player.currentTime = 0
            }
            player.play()
        } else if let url = Bundle.main.url(forResource: sound.rawValue, withExtension: "wav") {
            if let freshPlayer = try? AVAudioPlayer(contentsOf: url) {
                players[sound.rawValue] = freshPlayer
                freshPlayer.play()
            }
        }

        if haptic {
            switch sound {
            case .shutter:
                impactHeavy.impactOccurred()
            case .pop:
                impactLight.impactOccurred()
            default:
                impactMedium.impactOccurred()
            }
        }
    }

    public func triggerHapticSuccess() {
        notificationFeedback.notificationOccurred(.success)
    }
}
