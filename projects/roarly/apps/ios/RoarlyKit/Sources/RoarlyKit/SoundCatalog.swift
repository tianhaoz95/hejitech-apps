import Foundation

/// One sound the storyteller can summon. Its names and noises in each language live in
/// `Lexicons/<language>.json`, keyed by `id`.
public struct Cue: Identifiable, Hashable, Codable, Sendable {
    public enum Kind: String, Codable, Sendable {
        /// Plays once (a roar, a knock).
        case oneShot
        /// Loops under the story until the story stops it (rain, the sea, crickets).
        case ambient
    }

    public enum Category: String, Codable, CaseIterable, Sendable {
        case wild, farm, small, weather, places, things, magic

        public var title: String {
            switch self {
            case .wild: return "Wild animals"
            case .farm: return "Farm friends"
            case .small: return "Little critters"
            case .weather: return "Weather"
            case .places: return "Places"
            case .things: return "Things that go"
            case .magic: return "Magic & silly"
            }
        }
    }

    public let id: String
    public let name: String
    public let emoji: String
    public let kind: Kind
    public let category: Category
    /// 0…1: how startling the sound is. Bedtime mode keeps loud ones quieter.
    public let loudness: Double
    /// In the free starter set.
    public let isFree: Bool
    /// Bundled audio file names (without extension); one is picked at random so repeats vary.
    public let files: [String]

    public init(
        id: String, name: String, emoji: String, kind: Kind = .oneShot, category: Category, loudness: Double = 0.5, isFree: Bool = false,
        files: [String]? = nil
    ) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.kind = kind
        self.category = category
        self.loudness = loudness
        self.isFree = isFree
        self.files = files ?? [id]
    }
}

public enum SoundCatalog {
    public static let all: [Cue] = [
        // Wild animals
        Cue(id: "lion", name: "Lion", emoji: "🦁", category: .wild, loudness: 0.9, isFree: true, files: ["lion", "lion_2"]),
        Cue(id: "tiger", name: "Tiger", emoji: "🐯", category: .wild, loudness: 0.9, isFree: true, files: ["tiger", "tiger_2"]),
        Cue(id: "bear", name: "Bear", emoji: "🐻", category: .wild, loudness: 0.8, isFree: true),
        Cue(id: "wolf", name: "Wolf", emoji: "🐺", category: .wild, loudness: 0.7),
        Cue(id: "elephant", name: "Elephant", emoji: "🐘", category: .wild, loudness: 0.8),
        Cue(id: "monkey", name: "Monkey", emoji: "🐒", category: .wild, loudness: 0.6),
        Cue(id: "dinosaur", name: "Dinosaur", emoji: "🦖", category: .wild, loudness: 1.0),
        Cue(id: "dragon", name: "Dragon", emoji: "🐉", category: .magic, loudness: 0.9),
        Cue(id: "snake", name: "Snake", emoji: "🐍", category: .small, loudness: 0.3),
        Cue(id: "whale", name: "Whale", emoji: "🐋", category: .wild, loudness: 0.4),

        // Farm
        Cue(id: "dog", name: "Dog", emoji: "🐶", category: .farm, loudness: 0.6, isFree: true, files: ["dog", "dog_2"]),
        Cue(id: "cat", name: "Cat", emoji: "🐱", category: .farm, loudness: 0.3, isFree: true, files: ["cat", "cat_2"]),
        Cue(id: "cow", name: "Cow", emoji: "🐮", category: .farm, loudness: 0.6, isFree: true),
        Cue(id: "horse", name: "Horse", emoji: "🐴", category: .farm, loudness: 0.6),
        Cue(id: "sheep", name: "Sheep", emoji: "🐑", category: .farm, loudness: 0.4),

        // Little critters
        Cue(id: "owl", name: "Owl", emoji: "🦉", category: .small, loudness: 0.3, isFree: true),
        Cue(id: "frog", name: "Frog", emoji: "🐸", category: .small, loudness: 0.3, files: ["frog", "frog_2"]),
        Cue(id: "bee", name: "Bee", emoji: "🐝", category: .small, loudness: 0.3),
        Cue(id: "bird", name: "Bird", emoji: "🐦", category: .small, loudness: 0.3),
        Cue(id: "seagull", name: "Seagull", emoji: "🕊️", category: .small, loudness: 0.5),

        // Weather (ambient beds and big moments)
        Cue(id: "rain", name: "Rain", emoji: "🌧️", kind: .ambient, category: .weather, loudness: 0.4, isFree: true),
        Cue(id: "thunder", name: "Thunder", emoji: "⛈️", category: .weather, loudness: 1.0, isFree: true),
        Cue(id: "wind", name: "Wind", emoji: "🌬️", kind: .ambient, category: .weather, loudness: 0.4),

        // Places (ambient)
        Cue(id: "ocean", name: "Ocean", emoji: "🌊", kind: .ambient, category: .places, loudness: 0.4, isFree: true),
        Cue(id: "forest", name: "Forest", emoji: "🌲", kind: .ambient, category: .places,
            loudness: 0.3),
        Cue(id: "night", name: "Night", emoji: "🌙", kind: .ambient, category: .places, loudness: 0.2),
        Cue(id: "fire", name: "Campfire", emoji: "🔥", kind: .ambient, category: .places, loudness: 0.3),
        Cue(id: "river", name: "River", emoji: "🏞️", kind: .ambient, category: .places, loudness: 0.3),

        // Things
        Cue(id: "knock", name: "Knock knock", emoji: "🚪", category: .things, loudness: 0.5, isFree: true),
        Cue(id: "doorbell", name: "Doorbell", emoji: "🔔", category: .things, loudness: 0.5),
        Cue(id: "bell", name: "Bell", emoji: "🛎️", category: .things, loudness: 0.4),
        Cue(id: "clock", name: "Clock", emoji: "⏰", category: .things, loudness: 0.3),
        Cue(id: "train", name: "Train", emoji: "🚂", category: .things, loudness: 0.7),
        Cue(id: "car", name: "Car", emoji: "🚗", category: .things, loudness: 0.6),
        Cue(id: "boat", name: "Boat", emoji: "🚢", category: .things, loudness: 0.6),
        Cue(id: "airplane", name: "Airplane", emoji: "✈️", category: .things, loudness: 0.6),
        Cue(id: "rocket", name: "Rocket", emoji: "🚀", category: .things, loudness: 0.9),

        // Magic & silly
        Cue(id: "magic", name: "Magic", emoji: "✨", category: .magic, loudness: 0.4, isFree: true, files: ["magic", "magic_2"]),
        Cue(id: "splash", name: "Splash", emoji: "💦", category: .magic, loudness: 0.5),
        Cue(id: "footsteps", name: "Footsteps", emoji: "👣", category: .magic, loudness: 0.4),
        Cue(id: "snore", name: "Snore", emoji: "😴", category: .magic, loudness: 0.3),
        Cue(id: "giggle", name: "Giggle", emoji: "😆", category: .magic, loudness: 0.4),
        Cue(id: "whoosh", name: "Whoosh", emoji: "💨", category: .magic, loudness: 0.4),
        Cue(id: "pop", name: "Pop", emoji: "🎈", category: .magic, loudness: 0.4),
        Cue(id: "boing", name: "Boing", emoji: "🦘", category: .magic, loudness: 0.4),
    ]

    public static let byID: [String: Cue] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    public static func cue(_ id: String) -> Cue? { byID[id] }

    public static var freeCues: [Cue] { all.filter(\.isFree) }

    /// Every file the app must bundle.
    public static var allFiles: [String] { all.flatMap(\.files) }
}
