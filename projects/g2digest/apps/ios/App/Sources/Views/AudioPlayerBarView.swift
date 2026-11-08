import SwiftUI
import G2DigestKit

public struct AudioPlayerBarView: View {
    @ObservedObject var player = AudioPlayerService.shared

    public init() {}

    public var body: some View {
        if let card = player.currentCard {
            VStack(spacing: 8) {
                // Top row: Mode badge, Title, Speed, Play/Pause, Close
                HStack(spacing: 12) {
                    // Mode icon
                    Image(systemName: player.currentMode == .glance ? "play.circle.fill" : "headphones.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Color.accentColor)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(player.currentMode.displayTitle.uppercased())
                                .font(.caption2.bold())
                                .foregroundStyle(Color.accentColor)

                            Text("•")
                                .font(.caption2)
                                .foregroundStyle(.secondary)

                            Text(timeFormatted(player.currentTime) + " / " + timeFormatted(player.duration))
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }

                        Text(card.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                    }

                    Spacer()

                    // Playback speed button
                    Button {
                        player.cyclePlaybackRate()
                    } label: {
                        Text(String(format: "%.2gx", player.playbackRate))
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(Capsule())
                    }

                    // Play / Pause toggle
                    Button {
                        player.togglePlayPause()
                    } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.title3)
                            .frame(width: 36, height: 36)
                            .background(Color.accentColor)
                            .foregroundStyle(Color.black)
                            .clipShape(Circle())
                    }

                    // Stop / Dismiss
                    Button {
                        player.stop()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                            .padding(6)
                    }
                }

                // Scrubber slider
                if player.duration > 0 {
                    Slider(
                        value: Binding(
                            get: { player.currentTime },
                            set: { player.seek(to: $0) }
                        ),
                        in: 0...max(player.duration, 1)
                    )
                    .tint(Color.accentColor)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(.secondarySystemBackground))
                    .shadow(color: Color.black.opacity(0.12), radius: 10, y: 4)
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 6)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private func timeFormatted(_ totalSeconds: Double) -> String {
        let seconds = Int(totalSeconds)
        let mins = seconds / 60
        let rem = seconds % 60
        return String(format: "%d:%02d", mins, rem)
    }
}
