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
        case wild, farm, small, weather, places, things, home, magic

        public var title: String {
            switch self {
            case .wild: return "Wild animals"
            case .farm: return "Farm friends"
            case .small: return "Little critters"
            case .weather: return "Weather"
            case .places: return "Places"
            case .things: return "Things that go"
            case .home: return "Around the house"
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
        Cue(id: "dolphin", name: "Dolphin", emoji: "🐬", category: .wild, loudness: 0.4),

        // Farm
        Cue(id: "dog", name: "Dog", emoji: "🐶", category: .farm, loudness: 0.6, isFree: true, files: ["dog", "dog_2"]),
        Cue(id: "cat", name: "Cat", emoji: "🐱", category: .farm, loudness: 0.3, isFree: true, files: ["cat", "cat_2"]),
        Cue(id: "cow", name: "Cow", emoji: "🐮", category: .farm, loudness: 0.6, isFree: true),
        Cue(id: "horse", name: "Horse", emoji: "🐴", category: .farm, loudness: 0.6),
        Cue(id: "sheep", name: "Sheep", emoji: "🐑", category: .farm, loudness: 0.4),
        Cue(id: "pig", name: "Pig", emoji: "🐷", category: .farm, loudness: 0.5, files: ["pig", "pig_2"]),
        Cue(id: "duck", name: "Duck", emoji: "🦆", category: .farm, loudness: 0.4),
        Cue(id: "chicken", name: "Chicken", emoji: "🐔", category: .farm, loudness: 0.4, files: ["chicken", "chicken_2"]),
        Cue(id: "rooster", name: "Rooster", emoji: "🐓", category: .farm, loudness: 0.7),
        Cue(id: "goat", name: "Goat", emoji: "🐐", category: .farm, loudness: 0.5, files: ["goat", "goat_2"]),
        Cue(id: "donkey", name: "Donkey", emoji: "🫏", category: .farm, loudness: 0.7),
        Cue(id: "turkey", name: "Turkey", emoji: "🦃", category: .farm, loudness: 0.5),

        // Little critters
        Cue(id: "owl", name: "Owl", emoji: "🦉", category: .small, loudness: 0.3, isFree: true),
        Cue(id: "frog", name: "Frog", emoji: "🐸", category: .small, loudness: 0.3, files: ["frog", "frog_2"]),
        Cue(id: "bee", name: "Bee", emoji: "🐝", category: .small, loudness: 0.3),
        Cue(id: "bird", name: "Bird", emoji: "🐦", category: .small, loudness: 0.3),
        Cue(id: "seagull", name: "Seagull", emoji: "🕊️", category: .small, loudness: 0.5),
        Cue(id: "mouse", name: "Mouse", emoji: "🐭", category: .small, loudness: 0.2),
        Cue(id: "crow", name: "Crow", emoji: "🐦‍⬛", category: .small, loudness: 0.5),
        Cue(id: "fly", name: "Fly", emoji: "🪰", category: .small, loudness: 0.2),

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
        Cue(id: "farm", name: "Farmyard", emoji: "🌾", kind: .ambient, category: .places, loudness: 0.3),
        Cue(id: "city", name: "City", emoji: "🏙️", kind: .ambient, category: .places, loudness: 0.3),
        Cue(id: "underwater", name: "Underwater", emoji: "🫧", kind: .ambient, category: .places, loudness: 0.3),
        Cue(id: "cave", name: "Cave", emoji: "🪨", kind: .ambient, category: .places, loudness: 0.3),

        // Things
        Cue(id: "knock", name: "Knock knock", emoji: "🚪", category: .things, loudness: 0.5, isFree: true),
        Cue(id: "doorbell", name: "Doorbell", emoji: "🔔", category: .things, loudness: 0.5),
        Cue(id: "bell", name: "Bell", emoji: "🛎️", category: .things, loudness: 0.4),
        Cue(id: "clock", name: "Clock", emoji: "⏰", category: .things, loudness: 0.3),
        Cue(id: "train", name: "Train", emoji: "🚂", category: .things, loudness: 0.7, files: ["train", "train_2"]),
        Cue(id: "car", name: "Car", emoji: "🚗", category: .things, loudness: 0.6, files: ["car", "car_2"]),
        Cue(id: "boat", name: "Boat", emoji: "🚢", category: .things, loudness: 0.6),
        Cue(id: "airplane", name: "Airplane", emoji: "✈️", category: .things, loudness: 0.6),
        Cue(id: "rocket", name: "Rocket", emoji: "🚀", category: .things, loudness: 0.9),
        Cue(id: "tractor", name: "Tractor", emoji: "🚜", category: .things, loudness: 0.6, files: ["tractor", "tractor_2"]),
        Cue(id: "bicycle", name: "Bicycle", emoji: "🚲", category: .things, loudness: 0.4, files: ["bicycle", "bicycle_2"]),
        Cue(id: "truck", name: "Truck", emoji: "🚚", category: .things, loudness: 0.7, files: ["truck", "truck_2"]),
        Cue(id: "motorcycle", name: "Motorcycle", emoji: "🏍️", category: .things, loudness: 0.8),
        Cue(id: "helicopter", name: "Helicopter", emoji: "🚁", category: .things, loudness: 0.7),
        Cue(id: "siren", name: "Siren", emoji: "🚨", category: .things, loudness: 0.9, files: ["siren", "siren_2"]),
        Cue(id: "digger", name: "Digger", emoji: "🚧", category: .things, loudness: 0.5),

        // Around the house
        Cue(id: "creak", name: "Creaky door", emoji: "🏚️", category: .home, loudness: 0.4, files: ["creak", "creak_2"]),
        Cue(id: "slam", name: "Door slam", emoji: "💥", category: .home, loudness: 0.8),
        Cue(id: "phone", name: "Phone", emoji: "☎️", category: .home, loudness: 0.5),
        Cue(id: "munch", name: "Crunch", emoji: "🍎", category: .home, loudness: 0.3, files: ["munch", "munch_2"]),
        Cue(id: "slurp", name: "Gulp", emoji: "🥤", category: .home, loudness: 0.3),
        Cue(id: "sneeze", name: "Achoo", emoji: "🤧", category: .home, loudness: 0.5),
        Cue(id: "yawn", name: "Yawn", emoji: "🥱", category: .home, loudness: 0.2),
        Cue(id: "baby", name: "Baby crying", emoji: "👶", category: .home, loudness: 0.6),
        Cue(id: "kiss", name: "Kiss", emoji: "💋", category: .home, loudness: 0.2),
        Cue(id: "cheer", name: "Hooray", emoji: "👏", category: .home, loudness: 0.7),
        Cue(id: "flush", name: "Flush", emoji: "🚽", category: .home, loudness: 0.5),
        Cue(id: "drum", name: "Drum", emoji: "🥁", category: .home, loudness: 0.7),
        Cue(id: "trumpet", name: "Trumpet", emoji: "🎺", category: .home, loudness: 0.7),
        Cue(id: "whistle", name: "Whistle", emoji: "😗", category: .home, loudness: 0.7),
        Cue(id: "fireworks", name: "Fireworks", emoji: "🎆", category: .home, loudness: 0.9, files: ["fireworks", "fireworks_2"]),

        // Magic & silly
        Cue(id: "magic", name: "Magic", emoji: "✨", category: .magic, loudness: 0.4, isFree: true, files: ["magic", "magic_2"]),
        Cue(id: "splash", name: "Splash", emoji: "💦", category: .magic, loudness: 0.5),
        Cue(id: "footsteps", name: "Footsteps", emoji: "👣", category: .magic, loudness: 0.4),
        Cue(id: "snore", name: "Snore", emoji: "😴", category: .magic, loudness: 0.3),
        Cue(id: "giggle", name: "Giggle", emoji: "😆", category: .magic, loudness: 0.4),
        Cue(id: "whoosh", name: "Whoosh", emoji: "💨", category: .magic, loudness: 0.4),
        Cue(id: "pop", name: "Pop", emoji: "🎈", category: .magic, loudness: 0.4),
        Cue(id: "boing", name: "Boing", emoji: "🦘", category: .magic, loudness: 0.4),
        Cue(id: "ghost", name: "Ghost", emoji: "👻", category: .magic, loudness: 0.5),
        Cue(id: "monster", name: "Monster", emoji: "👹", category: .magic, loudness: 0.8, files: ["monster", "monster_2"]),
        Cue(id: "robot", name: "Robot", emoji: "🤖", category: .magic, loudness: 0.5),
        Cue(id: "laser", name: "Zap", emoji: "⚡️", category: .magic, loudness: 0.5),
        Cue(id: "sword", name: "Sword", emoji: "⚔️", category: .magic, loudness: 0.6, files: ["sword", "sword_2"]),
        Cue(id: "treasure", name: "Treasure", emoji: "💰", category: .magic, loudness: 0.4),
        Cue(id: "witch", name: "Witch", emoji: "🧙‍♀️", category: .magic, loudness: 0.6),
        Cue(id: "giant", name: "Giant", emoji: "🦶", category: .magic, loudness: 0.9),
        Cue(id: "alien", name: "UFO", emoji: "🛸", category: .magic, loudness: 0.5),
    ]

    public static let byID: [String: Cue] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    public static func cue(_ id: String) -> Cue? { byID[id] }

    public static var freeCues: [Cue] { all.filter(\.isFree) }

    /// Every file the app must bundle.
    public static var allFiles: [String] { all.flatMap(\.files) }
}
