import SwiftUI

/// A conversation's turns as chat bubbles (the Transcript tab): each turn is a bubble, sides
/// alternate whenever the speaker changes (consecutive turns always have different speakers),
/// and each speaker keeps one color and a name above their bubbles. Tapping a name renames that
/// speaker; tapping the time plays from there.
struct ConversationBubblesView: View {
    let turns: [SpeakerTurn]
    let name: (Int) -> String
    let onRename: (Int) -> Void
    var onSeek: ((TimeInterval) -> Void)?

    static let palette: [Color] = [.blue, .orange, .green, .purple, .pink, .teal, .indigo, .brown]

    static func color(for speaker: Int) -> Color {
        palette[speaker % palette.count]
    }

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(turns.enumerated()), id: \.element.id) { index, turn in
                bubble(turn, leading: index.isMultiple(of: 2))
            }
        }
    }

    private func bubble(_ turn: SpeakerTurn, leading: Bool) -> some View {
        let color = Self.color(for: turn.speaker)
        return HStack(alignment: .top, spacing: 0) {
            if !leading { Spacer(minLength: 36) }
            VStack(alignment: leading ? .leading : .trailing, spacing: 4) {
                HStack(spacing: 8) {
                    Button {
                        onRename(turn.speaker)
                    } label: {
                        HStack(spacing: 4) {
                            Circle().fill(color).frame(width: 7, height: 7)
                            Text(name(turn.speaker))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(color)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Renames this speaker")

                    if let onSeek {
                        Button {
                            onSeek(turn.start)
                        } label: {
                            Text(turn.start.formattedDuration)
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Play from \(turn.start.formattedDuration)")
                    }
                }

                Text(turn.text)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .textSelection(.enabled)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(color.opacity(0.25), lineWidth: 0.5)
                    )
            }
            .frame(maxWidth: .infinity, alignment: leading ? .leading : .trailing)
            if leading { Spacer(minLength: 36) }
        }
    }
}

#Preview {
    ConversationBubblesView(
        turns: [
            SpeakerTurn(speaker: 0, start: 0, text: "Hi, how have you been feeling since the last visit?"),
            SpeakerTurn(speaker: 1, start: 4, text: "Mostly okay, but the itching at night has been getting worse."),
            SpeakerTurn(speaker: 0, start: 9, text: "The main test for that is the bile acid level. It takes about a week to come back."),
            SpeakerTurn(speaker: 2, start: 15, text: "Can we keep track of the baby's heart during that week?")
        ],
        name: { "Speaker \($0 + 1)" },
        onRename: { _ in }
    )
    .padding()
}
