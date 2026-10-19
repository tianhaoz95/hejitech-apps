import Foundation

public enum FaceAnchorPosition: String, Codable {
    case forehead   // Placed above eyebrows / forehead (crown, unicorn, bunny)
    case eyes       // Placed directly across eyes (sunglasses, star eyes)
    case head       // Centered on head/face (animal masks)
}

public enum FaceEmojiType: String, CaseIterable, Identifiable, Codable {
    case crown = "crown"
    case lion = "lion"
    case sunglasses = "sunglasses"
    case kitty = "kitty"
    case puppy = "puppy"
    case unicorn = "unicorn"
    case panda = "panda"
    case bunny = "bunny"
    case starEyes = "starEyes"

    public var id: String { rawValue }

    public var emoji: String {
        switch self {
        case .crown: return "👑"
        case .lion: return "🦁"
        case .sunglasses: return "🕶️"
        case .kitty: return "🐱"
        case .puppy: return "🐶"
        case .unicorn: return "🦄"
        case .panda: return "🐼"
        case .bunny: return "🐰"
        case .starEyes: return "⭐️"
        }
    }

    public var displayName: String {
        switch self {
        case .crown: return "Crown"
        case .lion: return "Lion"
        case .sunglasses: return "Sunglasses"
        case .kitty: return "Kitty"
        case .puppy: return "Puppy"
        case .unicorn: return "Unicorn"
        case .panda: return "Panda"
        case .bunny: return "Bunny"
        case .starEyes: return "Star Eyes"
        }
    }

    public var anchorPosition: FaceAnchorPosition {
        switch self {
        case .crown, .unicorn, .bunny:
            return .forehead
        case .sunglasses, .starEyes:
            return .eyes
        case .lion, .kitty, .puppy, .panda:
            return .head
        }
    }
}
