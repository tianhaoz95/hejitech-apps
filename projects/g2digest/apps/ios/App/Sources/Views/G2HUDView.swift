import SwiftUI
import G2DigestKit

public struct G2HUDView: View {
    @ObservedObject var appModel: AppModel
    @ObservedObject var player = AudioPlayerService.shared

    @State private var dragOffset: CGFloat = 0
    @State private var simulatedTapNotice: String?

    private let hudGreen = Color(red: 0.0, green: 0.95, blue: 0.45)

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        if let bundle = appModel.currentBundle, !bundle.cards.isEmpty {
            let total = bundle.cards.count
            let currentIdx = min(appModel.currentCardIndex, total - 1)
            let card = bundle.cards[currentIdx]
            let isPlaying = player.isPlaying && player.currentCard?.slug == card.slug
            let frame = HUDFormatter.format(card: card, index: currentIdx, total: total, isPlayingAudio: isPlaying)

            VStack(spacing: 16) {
                // HUD Mode Status Banner
                HStack {
                    Circle()
                        .fill(hudGreen)
                        .frame(width: 8, height: 8)
                    Text("EVEN G2 GLASSES SIMULATOR")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(hudGreen.opacity(0.8))
                    Spacer()
                    Text("510px HUD")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(hudGreen.opacity(0.6))
                }
                .padding(.horizontal, 20)
                .padding(.top, 10)

                // Virtual Glasses Display Screen
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.black)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(hudGreen.opacity(0.3), lineWidth: 1.5)
                        )

                    HStack(spacing: 12) {
                        // Card Text Frame
                        VStack(alignment: .leading, spacing: 6) {
                            Text("┌────────────────────────────┐")
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .foregroundStyle(hudGreen.opacity(0.5))

                            ForEach(0..<frame.lines.count, id: \.self) { i in
                                let line = frame.lines[i]
                                Text(line.isEmpty ? " " : line)
                                    .font(.system(size: 13, weight: i == 0 ? .bold : .medium, design: .monospaced))
                                    .foregroundStyle(hudGreen)
                                    .lineLimit(1)
                            }

                            Spacer(minLength: 4)

                            Text("├────────────────────────────┤")
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .foregroundStyle(hudGreen.opacity(0.5))

                            Text(frame.footer)
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(hudGreen)
                                .lineLimit(1)

                            Text("└────────────────────────────┘")
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .foregroundStyle(hudGreen.opacity(0.5))
                        }
                        .padding(.vertical, 16)
                        .padding(.leading, 16)

                        Spacer()

                        // Position Dots on right edge
                        VStack(spacing: 8) {
                            ForEach(0..<total, id: \.self) { i in
                                Circle()
                                    .fill(i == currentIdx ? hudGreen : hudGreen.opacity(0.25))
                                    .frame(width: 6, height: 6)
                            }
                        }
                        .padding(.trailing, 16)
                    }
                }
                .frame(maxHeight: 330)
                .padding(.horizontal, 16)
                .gesture(
                    DragGesture()
                        .onEnded { value in
                            if value.translation.height < -40 {
                                triggerHaptic()
                                appModel.nextCard()
                            } else if value.translation.height > 40 {
                                triggerHaptic()
                                appModel.prevCard()
                            }
                        }
                )

                // Flash notice when tapping
                if let notice = simulatedTapNotice {
                    Text(notice)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.black)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(hudGreen)
                        .clipShape(Capsule())
                        .transition(.opacity)
                }

                Spacer()

                // Simulated R1 Ring Controller Pad
                VStack(spacing: 12) {
                    Text("SIMULATED R1 RING GESTURES")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(.secondary)

                    HStack(spacing: 12) {
                        // Swipe Up (Next)
                        Button {
                            triggerHaptic()
                            appModel.nextCard()
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: "arrow.up")
                                    .font(.headline)
                                Text("Swipe Up\nNext")
                                    .font(.caption2.bold())
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity, minHeight: 70)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Swipe Down (Prev)
                        Button {
                            triggerHaptic()
                            appModel.prevCard()
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: "arrow.down")
                                    .font(.headline)
                                Text("Swipe Down\nPrev")
                                    .font(.caption2.bold())
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity, minHeight: 70)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Tap (Glance)
                        Button {
                            triggerHaptic()
                            flashNotice("TAP: GLANCE")
                            if card.glance != nil {
                                player.play(card: card, mode: .glance)
                            } else {
                                flashNotice("NO GLANCE AUDIO")
                            }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: "hand.tap.fill")
                                    .font(.headline)
                                Text("Tap\nGlance")
                                    .font(.caption2.bold())
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity, minHeight: 70)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Tap & Hold (Deep Dive)
                        Button {
                            triggerHaptic()
                            flashNotice("HOLD: DEEP DIVE")
                            if card.deepDive != nil {
                                player.play(card: card, mode: .deepDive)
                            } else {
                                flashNotice("NO DEEP DIVE")
                            }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: "hand.point.up.left.and.text.fill")
                                    .font(.headline)
                                Text("Hold\nDeep Dive")
                                    .font(.caption2.bold())
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity, minHeight: 70)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
        } else {
            ContentUnavailableView(
                "Glasses HUD Inactive",
                systemImage: "eyeglasses",
                description: Text("Load an edition to preview on G2 glasses.")
            )
        }
    }

    private func triggerHaptic() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    private func flashNotice(_ msg: String) {
        withAnimation {
            simulatedTapNotice = msg
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation {
                if simulatedTapNotice == msg {
                    simulatedTapNotice = nil
                }
            }
        }
    }
}
