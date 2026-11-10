import Foundation

public enum TourReason: String, Codable, Sendable {
    case pair
    case waiting
    case offline
}

public struct TourBuilder: Sendable {
    public static let tourGuideVersion = "tour-0.1"
    public static let tourTitle = "Welcome to G2 Digest"

    private static func nextInfo(for reason: TourReason) -> (title: String, body: String) {
        switch reason {
        case .pair:
            return ("Sign in", "Tap Sign In and use the account you use on the web, or pair with a code from its Pair page.")
        case .waiting:
            return ("Paired", "Your first edition isn't out yet. Connect an agent from Agents on the web.")
        case .offline:
            return ("Offline", "Nothing fetched yet. Connect your phone, then open G2 Digest again.")
        }
    }

    public static func makeTour(reason: TourReason = .pair, date: String = "Today") -> BundleData {
        let next = nextInfo(for: reason)
        let sections = [
            EditionSection(
                sectionId: "how",
                title: "How it works",
                body: "An agent compiles each edition ahead of time from your brief. Your device only plays it back."
            ),
            EditionSection(
                sectionId: "controls",
                title: "The controls",
                body: "Swipe to move between cards, tap to listen, double-tap to stop or go back."
            ),
            EditionSection(
                sectionId: "next",
                title: "Next step",
                body: next.body
            ),
        ]

        let cards = [
            CardInput(
                slug: "cover",
                kind: .cover,
                title: "G2 Digest",
                body: "Your brief as glanceable cards and audio. Swipe up for a short tour."
            ),
            CardInput(
                slug: "made-ahead",
                kind: .section,
                sectionId: "how",
                template: .note,
                title: "Made before you wake",
                body: "An agent writes each edition from your brief. Your device only plays it back."
            ),
            CardInput(
                slug: "swipe-card",
                kind: .section,
                sectionId: "controls",
                template: .note,
                title: "Swipe to move",
                body: "Up for the next card, down for the previous one. The dots on the right show where you are."
            ),
            CardInput(
                slug: "listen-card",
                kind: .section,
                sectionId: "controls",
                template: .note,
                title: "Tap to listen",
                body: "Tap plays a card's short audio. Tap, then hold, plays its deep dive."
            ),
            CardInput(
                slug: "double-tap-card",
                kind: .section,
                sectionId: "controls",
                template: .note,
                title: "Double-tap to leave",
                body: "Double-tap stops audio. With nothing playing, it asks to exit."
            ),
            CardInput(
                slug: "next-step",
                kind: .section,
                sectionId: "next",
                template: .note,
                title: next.title,
                body: next.body
            ),
            CardInput(
                slug: "end",
                kind: .end,
                title: "End of the tour",
                body: "Swipe down to go back through it."
            ),
        ]

        return BundleData(
            date: date,
            guideVersion: tourGuideVersion,
            briefVersion: 0,
            edition: Edition(title: tourTitle, sections: sections),
            cards: cards
        )
    }

    public static func isTour(_ bundle: BundleData?) -> Bool {
        bundle?.guideVersion == tourGuideVersion
    }
}
