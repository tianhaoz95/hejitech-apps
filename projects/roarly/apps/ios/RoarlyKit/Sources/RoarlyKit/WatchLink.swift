import Foundation

/// The messages between the iPhone and the watch (WatchConnectivity dictionaries).
public enum WatchLink {
    public static let kind = "k"

    public enum Kind: String, Sendable {
        /// phone → watch: listening state, mode, active ambients, suggestions, output.
        case state
        /// phone → watch: play this sound on the watch speaker.
        case play
        /// phone → watch: start/stop a loop on the watch speaker.
        case ambient
        /// phone → watch: stop everything on the watch.
        case stopAll
        /// watch → phone: the parent tapped this cue.
        case tap
        /// watch → phone: start or stop listening.
        case toggleListening
        /// watch → phone: send state now (the watch app just opened).
        case hello
    }

    public struct State: Codable, Equatable, Sendable {
        public var listening: Bool
        public var mode: StoryMode
        public var soundsOnWatch: Bool
        public var ambients: [String]
        public var suggestions: [String]
        public var recent: [String]
        public var isPro: Bool

        public init(listening: Bool = false, mode: StoryMode = .bedtime, soundsOnWatch: Bool = false, ambients: [String] = [], suggestions: [String] = [], recent: [String] = [], isPro: Bool = false) {
            self.listening = listening
            self.mode = mode
            self.soundsOnWatch = soundsOnWatch
            self.ambients = ambients
            self.suggestions = suggestions
            self.recent = recent
            self.isPro = isPro
        }
    }

    public static func message(_ kind: Kind, _ fields: [String: Any] = [:]) -> [String: Any] {
        var m = fields
        m[Self.kind] = kind.rawValue
        return m
    }

    public static func kind(of message: [String: Any]) -> Kind? {
        (message[Self.kind] as? String).flatMap(Kind.init(rawValue:))
    }

    public static func encode(_ state: State) -> [String: Any] {
        let data = (try? JSONEncoder().encode(state)) ?? Data()
        return message(.state, ["s": data])
    }

    public static func decodeState(_ message: [String: Any]) -> State? {
        guard let data = message["s"] as? Data else { return nil }
        return try? JSONDecoder().decode(State.self, from: data)
    }
}
