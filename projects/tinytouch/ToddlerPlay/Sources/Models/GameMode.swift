import SwiftUI

/// Toddler play modes tailored for 18-month-old developmental stages
enum GameMode: String, CaseIterable, Identifiable, Codable {
    case bubbles = "bubbles"
    case animals = "animals"
    case soundGarden = "soundGarden"
    case sparkles = "sparkles"
    case lullaby = "lullaby"
    
    var id: String { rawValue }
    
    /// Robust initializer accepting lowercase, camelCase, TitleCase, or legacy values (e.g. "Xylophone")
    init?(rawValue: String) {
        let normalized = rawValue.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "_", with: "")
        switch normalized {
        case "bubbles", "bubble", "bubblepop":
            self = .bubbles
        case "animals", "animal", "animalfriends":
            self = .animals
        case "soundgarden", "sound", "xylophone", "chimes":
            self = .soundGarden
        case "sparkles", "sparkle", "magicsparkles":
            self = .sparkles
        case "lullaby", "lullabies", "sleepymoon", "sleep":
            self = .lullaby
        default:
            return nil
        }
    }
    
    init?(from string: String) {
        self.init(rawValue: string)
    }
    
    var title: String {
        switch self {
        case .bubbles: return "Bubble Pop"
        case .animals: return "Animal Friends"
        case .soundGarden: return "Sound Garden"
        case .sparkles: return "Magic Sparkles"
        case .lullaby: return "Sleepy Lullaby"
        }
    }
    
    var systemIcon: String {
        switch self {
        case .bubbles: return "bubbles.and.sparkles.fill"
        case .animals: return "pawprint.fill"
        case .soundGarden: return "pianokeys.inverse"
        case .sparkles: return "sparkles"
        case .lullaby: return "moon.stars.fill"
        }
    }
    
    var themeColor: Color {
        switch self {
        case .bubbles: return Color(red: 0.3, green: 0.8, blue: 0.95)
        case .animals: return Color(red: 1.0, green: 0.6, blue: 0.2)
        case .soundGarden: return Color(red: 0.4, green: 0.9, blue: 0.5)
        case .sparkles: return Color(red: 0.85, green: 0.45, blue: 1.0)
        case .lullaby: return Color(red: 0.6, green: 0.7, blue: 1.0)
        }
    }
    
    var developmentalFocus: String {
        switch self {
        case .bubbles: return "Motor coordination & cause-and-effect"
        case .animals: return "Speech recognition & animal sounds"
        case .soundGarden: return "Auditory harmony & rhythm exploration"
        case .sparkles: return "Free sensory exploration & visual tracking"
        case .lullaby: return "Calm sensory wind-down & soothing transition"
        }
    }
    
    var coPlayPrompt: String {
        switch self {
        case .bubbles: return "Can you find the yellow star bubble?"
        case .animals: return "What sound does the duck make? Quack quack!"
        case .soundGarden: return "Let's tap the colors and play music!"
        case .sparkles: return "Draw a big rainbow swirl with your finger!"
        case .lullaby: return "Shh, let's say goodnight to the sleepy moon."
        }
    }
}
