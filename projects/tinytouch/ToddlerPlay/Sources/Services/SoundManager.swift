import Foundation
import AVFoundation

/// Low-latency audio playback engine for sound effects, chimes, animal noises, and speech.
final class SoundManager: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    static let shared = SoundManager()
    
    @Published var isSoundEnabled: Bool = true {
        didSet {
            if !isSoundEnabled {
                stopLullaby()
            }
        }
    }
    
    @Published var isVoiceEnabled: Bool = true
    @Published var volume: Float = 0.8
    
    private var players: [String: [AVAudioPlayer]] = [:]
    private var lullabyPlayer: AVAudioPlayer?
    private let speechSynthesizer = AVSpeechSynthesizer()
    private let queue = DispatchQueue(label: "com.tinytouch.sound", qos: .userInteractive)
    
    override private init() {
        super.init()
        speechSynthesizer.delegate = self
        setupAudioSession()
        preloadSounds()
    }
    
    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.duckOthers, .mixWithOthers])
            try session.setActive(true)
        } catch {
            print("Audio session configuration error: \(error)")
        }
    }
    
    /// Preloads sound files into memory for zero-latency instant response on tap
    private func preloadSounds() {
        let soundNames = [
            "bubble_pop", "boing", "sparkle", "quack", "woof",
            "meow", "moo", "ribbit", "unlock",
            "chime_c4", "chime_d4", "chime_e4", "chime_g4", "chime_a4", "chime_c5"
        ]
        
        for name in soundNames {
            if let url = Bundle.main.url(forResource: name, withExtension: "wav") {
                var pool: [AVAudioPlayer] = []
                for _ in 0..<3 { // 3-player pool for rapid polyphonic tapping
                    if let player = try? AVAudioPlayer(contentsOf: url) {
                        player.prepareToPlay()
                        player.volume = volume
                        pool.append(player)
                    }
                }
                players[name] = pool
            }
        }
    }
    
    /// Plays a designated sound effect by name
    func playSound(_ name: String) {
        guard isSoundEnabled else { return }
        
        queue.async { [weak self] in
            guard let self = self else { return }
            guard let pool = self.players[name], !pool.isEmpty else {
                // Fallback: try loading directly
                if let url = Bundle.main.url(forResource: name, withExtension: "wav"),
                   let directPlayer = try? AVAudioPlayer(contentsOf: url) {
                    directPlayer.volume = self.volume
                    directPlayer.play()
                }
                return
            }
            
            // Find an idle player or pick the one with lowest progress
            let player = pool.first(where: { !$0.isPlaying }) ?? pool[0]
            player.currentTime = 0
            player.volume = self.volume
            player.play()
        }
    }
    
    // MARK: - Specific Convenient Audio Triggers
    
    func playPop() {
        playSound("bubble_pop")
    }
    
    func playBoing() {
        playSound("boing")
    }
    
    func playSparkle() {
        playSound("sparkle")
    }
    
    func playPentatonicChime(index: Int) {
        let notes = ["chime_c4", "chime_d4", "chime_e4", "chime_g4", "chime_a4", "chime_c5"]
        let safeIndex = max(0, min(notes.count - 1, index))
        playSound(notes[safeIndex])
    }
    
    func playAnimalSound(_ name: String) {
        switch name.lowercased() {
        case "dog", "puppy": playSound("woof")
        case "cat", "kitty": playSound("meow")
        case "duck", "duckling": playSound("quack")
        case "cow": playSound("moo")
        case "frog": playSound("ribbit")
        default: playSound("boing")
        }
    }
    
    func playUnlockChime() {
        playSound("unlock")
    }
    
    // MARK: - Lullaby Music Box Loop
    
    func startLullaby() {
        guard isSoundEnabled else { return }
        if let url = Bundle.main.url(forResource: "lullaby", withExtension: "wav") {
            do {
                lullabyPlayer = try AVAudioPlayer(contentsOf: url)
                lullabyPlayer?.numberOfLoops = -1 // loop infinitely
                lullabyPlayer?.volume = volume * 0.7
                lullabyPlayer?.play()
            } catch {
                print("Could not start lullaby: \(error)")
            }
        }
    }
    
    func stopLullaby() {
        lullabyPlayer?.stop()
        lullabyPlayer = nil
    }
    
    // MARK: - Speech Prompts (Voice)
    
    func speak(_ text: String) {
        guard isVoiceEnabled, isSoundEnabled else { return }
        
        // Stop ongoing speech
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.42 // Gentle, slower speed for toddlers
        utterance.pitchMultiplier = 1.25 // Warm, friendly child-friendly pitch
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        speechSynthesizer.speak(utterance)
    }
}
