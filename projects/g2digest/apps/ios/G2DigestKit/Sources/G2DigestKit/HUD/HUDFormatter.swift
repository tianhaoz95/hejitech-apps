import Foundation

public struct HUDFrame: Hashable, Sendable {
    public let cardSlug: String
    public let lines: [String]
    public let positionDots: String
    public let footer: String

    public init(cardSlug: String, lines: [String], positionDots: String, footer: String) {
        self.cardSlug = cardSlug
        self.lines = lines
        self.positionDots = positionDots
        self.footer = footer
    }
}

public struct HUDFormatter: Sendable {
    public static let maxLinesPerFrame = 9
    public static let maxCharsPerLine = 28

    /// Wraps text to fit monospace columns (maxCharsPerLine)
    public static func wrap(text: String, limit: Int = maxCharsPerLine) -> [String] {
        let words = text.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        var lines: [String] = []
        var currentLine = ""

        for word in words {
            if currentLine.isEmpty {
                currentLine = word
            } else if currentLine.count + 1 + word.count <= limit {
                currentLine += " " + word
            } else {
                lines.append(currentLine)
                currentLine = word
            }
        }
        if !currentLine.isEmpty {
            lines.append(currentLine)
        }
        return lines
    }

    /// Generates position dots for the right edge of the G2 display (e.g. "● ○ ○ ○")
    public static func makePositionDots(current: Int, total: Int) -> String {
        guard total > 0 else { return "" }
        var dots = [String]()
        for i in 0..<total {
            dots.append(i == current ? "●" : "○")
        }
        return dots.joined(separator: " ")
    }

    /// Formats a card into a HUDFrame
    public static func format(card: CardInput, index: Int, total: Int, isPlayingAudio: Bool = false) -> HUDFrame {
        var contentLines = [String]()

        // Title line
        let titleUpper = card.title.uppercased()
        let wrappedTitle = wrap(text: titleUpper)
        contentLines.append(contentsOf: wrappedTitle)

        // Key number / metric if present
        if let keyNumber = card.keyNumber, !keyNumber.isEmpty {
            contentLines.append("► \(keyNumber)")
        }

        if let metrics = card.metrics, !metrics.isEmpty {
            for m in metrics.prefix(2) {
                contentLines.append("\(m.label): \(m.value)")
            }
        }

        // Body lines
        let wrappedBody = wrap(text: card.body)
        for line in wrappedBody {
            if contentLines.count < maxLinesPerFrame - 1 {
                contentLines.append(line)
            }
        }

        // Pad to maxLinesPerFrame
        while contentLines.count < maxLinesPerFrame {
            contentLines.append("")
        }

        let dots = makePositionDots(current: index, total: total)
        let footer: String
        if isPlayingAudio {
            footer = "► AUDIO PLAYING • TAP PAUSE"
        } else if card.glance != nil || card.deepDive != nil {
            footer = "TAP: GLANCE • HOLD: DEEP DIVE"
        } else {
            footer = "\(index + 1)/\(total) • SWIPE NEXT"
        }

        return HUDFrame(
            cardSlug: card.slug,
            lines: Array(contentLines.prefix(maxLinesPerFrame)),
            positionDots: dots,
            footer: footer
        )
    }
}
