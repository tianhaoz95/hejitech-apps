import ActivityKit
import Foundation

/// Live Activity state for active G2 Digest audio briefings on the Lock Screen and Dynamic Island.
public struct G2DigestAudioAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var cardTitle: String
        public var modeLabel: String
        public var isPlaying: Bool
        public var progress: Double
        public var cardPosition: String

        public init(cardTitle: String, modeLabel: String, isPlaying: Bool, progress: Double, cardPosition: String) {
            self.cardTitle = cardTitle
            self.modeLabel = modeLabel
            self.isPlaying = isPlaying
            self.progress = progress
            self.cardPosition = cardPosition
        }
    }

    public var editionTitle: String
    public var editionDate: String

    public init(editionTitle: String, editionDate: String) {
        self.editionTitle = editionTitle
        self.editionDate = editionDate
    }
}
