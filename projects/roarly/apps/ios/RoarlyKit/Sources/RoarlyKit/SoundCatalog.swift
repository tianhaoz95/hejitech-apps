import Foundation

/// One sound the storyteller can summon.
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
    /// Words and phrases that bring the cue to mind ("lion", "lioness"). Matched on normalized
    /// tokens, so "lions" and "lion's" count; multi-word phrases match in order.
    public let triggers: [String]
    /// Words that say the sound is happening ("roared", "growled"): a mention plus one of these is
    /// as sure as the listener gets.
    public let soundWords: [String]
    /// 0…1: how startling the sound is. Bedtime mode keeps loud ones quieter.
    public let loudness: Double
    /// In the free starter set.
    public let isFree: Bool
    /// Bundled audio file names (without extension); one is picked at random so repeats vary.
    public let files: [String]

    public init(
        id: String, name: String, emoji: String, kind: Kind = .oneShot, category: Category,
        triggers: [String], soundWords: [String] = [], loudness: Double = 0.5, isFree: Bool = false,
        files: [String]? = nil
    ) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.kind = kind
        self.category = category
        self.triggers = triggers
        self.soundWords = soundWords
        self.loudness = loudness
        self.isFree = isFree
        self.files = files ?? [id]
    }
}

public enum SoundCatalog {
    public static let all: [Cue] = [
        // Wild animals
        Cue(id: "lion", name: "Lion", emoji: "🦁", category: .wild,
            triggers: ["lion", "lioness", "king of the jungle"],
            soundWords: ["roar", "roared", "roaring", "roars", "growl", "growled", "growling"], loudness: 0.9, isFree: true, files: ["lion", "lion_2"]),
        Cue(id: "tiger", name: "Tiger", emoji: "🐯", category: .wild,
            triggers: ["tiger", "tigress"],
            soundWords: ["roar", "roared", "roaring", "growl", "growled", "growling", "snarl", "snarled"], loudness: 0.9, isFree: true, files: ["tiger", "tiger_2"]),
        Cue(id: "bear", name: "Bear", emoji: "🐻", category: .wild,
            triggers: ["bear", "grizzly", "grizzly bear"],
            soundWords: ["growl", "growled", "growling", "roar", "roared", "grumble", "grumbled"], loudness: 0.8, isFree: true),
        Cue(id: "wolf", name: "Wolf", emoji: "🐺", category: .wild,
            triggers: ["wolf", "wolves", "big bad wolf"],
            soundWords: ["howl", "howled", "howling", "awoo"], loudness: 0.7),
        Cue(id: "elephant", name: "Elephant", emoji: "🐘", category: .wild,
            triggers: ["elephant"],
            soundWords: ["trumpet", "trumpeted", "trumpeting"], loudness: 0.8),
        Cue(id: "monkey", name: "Monkey", emoji: "🐒", category: .wild,
            triggers: ["monkey", "chimp", "chimpanzee", "ape", "gorilla"],
            soundWords: ["ooh ooh", "chattered", "screeched"], loudness: 0.6),
        Cue(id: "dinosaur", name: "Dinosaur", emoji: "🦖", category: .wild,
            triggers: ["dinosaur", "t rex", "trex", "tyrannosaurus", "dino"],
            soundWords: ["roar", "roared", "roaring", "stomp", "stomped", "stomping"], loudness: 1.0),
        Cue(id: "dragon", name: "Dragon", emoji: "🐉", category: .magic,
            triggers: ["dragon"],
            soundWords: ["roar", "roared", "roaring", "breathed fire", "fire breathing"], loudness: 0.9),
        Cue(id: "snake", name: "Snake", emoji: "🐍", category: .small,
            triggers: ["snake", "serpent", "python", "cobra"],
            soundWords: ["hiss", "hissed", "hissing", "sss"], loudness: 0.3),
        Cue(id: "whale", name: "Whale", emoji: "🐋", category: .wild,
            triggers: ["whale"],
            soundWords: ["sang", "singing", "song"], loudness: 0.4),

        // Farm
        Cue(id: "dog", name: "Dog", emoji: "🐶", category: .farm,
            triggers: ["dog", "puppy", "doggy", "doggie", "pup"],
            soundWords: ["bark", "barked", "barking", "woof", "ruff", "arf"], loudness: 0.6, isFree: true, files: ["dog", "dog_2"]),
        Cue(id: "cat", name: "Cat", emoji: "🐱", category: .farm,
            triggers: ["cat", "kitty", "kitten", "kitty cat"],
            soundWords: ["meow", "meowed", "mew", "purr", "purred"], loudness: 0.3, isFree: true, files: ["cat", "cat_2"]),
        Cue(id: "cow", name: "Cow", emoji: "🐮", category: .farm,
            triggers: ["cow", "calf", "cattle"],
            soundWords: ["moo", "mooed", "mooing"], loudness: 0.6, isFree: true),
        Cue(id: "horse", name: "Horse", emoji: "🐴", category: .farm,
            triggers: ["horse", "pony", "stallion"],
            soundWords: ["neigh", "neighed", "whinny", "whinnied", "galloped", "gallop"], loudness: 0.6),
        Cue(id: "sheep", name: "Sheep", emoji: "🐑", category: .farm,
            triggers: ["sheep", "lamb"],
            soundWords: ["baa", "baaed", "bleat", "bleated"], loudness: 0.4),

        // Little critters
        Cue(id: "owl", name: "Owl", emoji: "🦉", category: .small,
            triggers: ["owl"],
            soundWords: ["hoot", "hooted", "hooting", "who who"], loudness: 0.3, isFree: true),
        Cue(id: "frog", name: "Frog", emoji: "🐸", category: .small,
            triggers: ["frog", "toad"],
            soundWords: ["ribbit", "croak", "croaked", "croaking"], loudness: 0.3, files: ["frog", "frog_2"]),
        Cue(id: "bee", name: "Bee", emoji: "🐝", category: .small,
            triggers: ["bee", "bumblebee", "honeybee"],
            soundWords: ["buzz", "buzzed", "buzzing"], loudness: 0.3),
        Cue(id: "bird", name: "Bird", emoji: "🐦", category: .small,
            triggers: ["bird", "birdie", "robin", "sparrow", "songbird"],
            soundWords: ["chirp", "chirped", "tweet", "tweeted", "sang", "singing"], loudness: 0.3),
        Cue(id: "seagull", name: "Seagull", emoji: "🕊️", category: .small,
            triggers: ["seagull", "gull"],
            soundWords: ["squawk", "squawked"], loudness: 0.5),

        // Weather (ambient beds and big moments)
        Cue(id: "rain", name: "Rain", emoji: "🌧️", kind: .ambient, category: .weather,
            triggers: ["rain", "raining", "rainy", "rainstorm", "pouring", "drizzle", "drizzling", "raindrops"],
            soundWords: ["started to rain", "began to rain", "started raining", "pitter patter"], loudness: 0.4, isFree: true),
        Cue(id: "thunder", name: "Thunder", emoji: "⛈️", category: .weather,
            triggers: ["thunder", "thunderstorm", "lightning"],
            soundWords: ["boom", "rumble", "rumbled", "crash", "crashed", "clap"], loudness: 1.0, isFree: true),
        Cue(id: "wind", name: "Wind", emoji: "🌬️", kind: .ambient, category: .weather,
            triggers: ["wind", "windy", "breeze", "blizzard", "gust"],
            soundWords: ["blew", "blowing", "howled", "whooshed", "whistled"], loudness: 0.4),

        // Places (ambient)
        Cue(id: "ocean", name: "Ocean", emoji: "🌊", kind: .ambient, category: .places,
            triggers: ["ocean", "sea", "seaside", "beach", "waves", "shore"],
            soundWords: ["splashing waves", "crashing waves"], loudness: 0.4, isFree: true),
        Cue(id: "forest", name: "Forest", emoji: "🌲", kind: .ambient, category: .places,
            triggers: ["forest", "woods", "jungle", "meadow"],
            loudness: 0.3),
        Cue(id: "night", name: "Night", emoji: "🌙", kind: .ambient, category: .places,
            triggers: ["crickets", "nighttime", "night time", "middle of the night", "moonlight", "starry night"],
            soundWords: ["chirping crickets"], loudness: 0.2),
        Cue(id: "fire", name: "Campfire", emoji: "🔥", kind: .ambient, category: .places,
            triggers: ["campfire", "fireplace", "bonfire", "fire"],
            soundWords: ["crackled", "crackling"], loudness: 0.3),
        Cue(id: "river", name: "River", emoji: "🏞️", kind: .ambient, category: .places,
            triggers: ["river", "stream", "brook", "creek", "waterfall"],
            soundWords: ["babbling", "trickling", "flowing"], loudness: 0.3),

        // Things
        Cue(id: "knock", name: "Knock knock", emoji: "🚪", category: .things,
            triggers: ["knock knock", "knocked", "knocking", "knock on the door", "knocks"],
            soundWords: ["knock knock", "knocked", "knocking"], loudness: 0.5, isFree: true),
        Cue(id: "doorbell", name: "Doorbell", emoji: "🔔", category: .things,
            triggers: ["doorbell", "door bell"],
            soundWords: ["ding dong", "rang", "rings"], loudness: 0.5),
        Cue(id: "bell", name: "Bell", emoji: "🛎️", category: .things,
            triggers: ["bell", "bells", "jingle"],
            soundWords: ["rang", "ringing", "ding", "jingled"], loudness: 0.4),
        Cue(id: "clock", name: "Clock", emoji: "⏰", category: .things,
            triggers: ["clock", "tick tock", "midnight"],
            soundWords: ["tick tock", "ticking", "chimed", "struck"], loudness: 0.3),
        Cue(id: "train", name: "Train", emoji: "🚂", category: .things,
            triggers: ["train", "choo choo", "locomotive", "railway"],
            soundWords: ["choo choo", "whistle", "whistled", "chugged"], loudness: 0.7),
        Cue(id: "car", name: "Car", emoji: "🚗", category: .things,
            triggers: ["car", "truck", "taxi", "bus"],
            soundWords: ["honk", "honked", "beep beep", "vroom", "zoomed"], loudness: 0.6),
        Cue(id: "boat", name: "Boat", emoji: "🚢", category: .things,
            triggers: ["boat", "ship", "pirate ship", "sailboat", "ferry"],
            soundWords: ["horn", "toot"], loudness: 0.6),
        Cue(id: "airplane", name: "Airplane", emoji: "✈️", category: .things,
            triggers: ["airplane", "aeroplane", "plane", "jet"],
            soundWords: ["flew", "took off", "zoom"], loudness: 0.6),
        Cue(id: "rocket", name: "Rocket", emoji: "🚀", category: .things,
            triggers: ["rocket", "spaceship", "blast off", "liftoff"],
            soundWords: ["blast off", "blasted off", "launched", "lift off"], loudness: 0.9),

        // Magic & silly
        Cue(id: "magic", name: "Magic", emoji: "✨", category: .magic,
            triggers: ["magic", "magical", "wand", "spell", "abracadabra", "fairy", "wizard", "witch", "sparkle", "sparkles"],
            soundWords: ["poof", "abracadabra", "bibbidi bobbidi", "sparkled", "waved her wand", "waved his wand", "cast a spell"], loudness: 0.4, isFree: true, files: ["magic", "magic_2"]),
        Cue(id: "splash", name: "Splash", emoji: "💦", category: .magic,
            triggers: ["splash", "splashed", "puddle", "jumped in the water", "fell in the water", "dove in"],
            soundWords: ["splash", "splashed", "splashing", "kersplash"], loudness: 0.5),
        Cue(id: "footsteps", name: "Footsteps", emoji: "👣", category: .magic,
            triggers: ["footsteps", "tiptoe", "tiptoed", "tip toe", "stomped", "stomping", "creeping"],
            soundWords: ["stomp", "stomped", "tiptoed"], loudness: 0.4),
        Cue(id: "snore", name: "Snore", emoji: "😴", category: .magic,
            triggers: ["snore", "snored", "snoring", "fast asleep", "fell asleep"],
            soundWords: ["snore", "snored", "snoring", "zzz"], loudness: 0.3),
        Cue(id: "giggle", name: "Giggle", emoji: "😆", category: .magic,
            triggers: ["giggle", "giggled", "giggling", "tickle", "tickled", "laughed", "laughing"],
            soundWords: ["giggle", "giggled", "hee hee", "ha ha"], loudness: 0.4),
        Cue(id: "whoosh", name: "Whoosh", emoji: "💨", category: .magic,
            triggers: ["whoosh", "swoosh", "zoomed away", "flew away", "flew off", "zip"],
            soundWords: ["whoosh", "whooshed", "swoosh", "swooshed"], loudness: 0.4),
        Cue(id: "pop", name: "Pop", emoji: "🎈", category: .magic,
            triggers: ["balloon", "bubble", "bubbles", "popcorn"],
            soundWords: ["pop", "popped", "popping"], loudness: 0.4),
        Cue(id: "boing", name: "Boing", emoji: "🦘", category: .magic,
            triggers: ["kangaroo", "trampoline", "bounce", "bounced", "bouncing", "boing"],
            soundWords: ["boing", "bounced", "bouncing", "hopped"], loudness: 0.4),
    ]

    public static let byID: [String: Cue] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    public static func cue(_ id: String) -> Cue? { byID[id] }

    public static var freeCues: [Cue] { all.filter(\.isFree) }

    /// Every file the app must bundle.
    public static var allFiles: [String] { all.flatMap(\.files) }
}
