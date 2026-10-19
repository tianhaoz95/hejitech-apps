import SwiftUI

public struct FaceTrackingEmojiOverlayView: View {
    @ObservedObject var trackingManager = FaceTrackingManager.shared
    let isPrimary: Bool

    public init(isPrimary: Bool = true) {
        self.isPrimary = isPrimary
    }

    public var body: some View {
        GeometryReader { geo in
            if let filter = trackingManager.activeFilter {
                let size = geo.size
                let rawEmojiSize = trackingManager.emojiSize(in: size, for: filter)
                let emojiScale: CGFloat = isPrimary ? 1.0 : 0.85
                let finalSize = rawEmojiSize * emojiScale

                TimelineView(.animation) { timeline in
                    let time = timeline.date.timeIntervalSinceReferenceDate
                    let period: Double = 3.6
                    let angle = (time.truncatingRemainder(dividingBy: period)) / period * (2.0 * .pi)

                    let currentPos = trackingManager.flyingEmojiPosition(angle: angle, in: size)
                    let trailPos1 = trackingManager.flyingEmojiPosition(angle: angle - 0.22, in: size)
                    let trailPos2 = trackingManager.flyingEmojiPosition(angle: angle - 0.44, in: size)

                    // Banking tilt during flight aligned with head roll
                    let bankAngle = Angle(radians: trackingManager.headRoll + cos(angle) * 0.20)

                    ZStack {
                        // Magic flight trail sparkle 2 (faint trail)
                        Text("✨")
                            .font(.system(size: finalSize * 0.36))
                            .position(trailPos2)
                            .opacity(trackingManager.isFaceDetected ? 0.45 : 0.0)

                        // Magic flight trail sparkle 1 (near trail)
                        Text("💫")
                            .font(.system(size: finalSize * 0.46))
                            .position(trailPos1)
                            .opacity(trackingManager.isFaceDetected ? 0.70 : 0.0)

                        // Main flying companion emoji (orbits outside face, leaving face completely clear)
                        Text(filter.emoji)
                            .font(.system(size: finalSize))
                            .rotationEffect(bankAngle)
                            .shadow(color: Color.black.opacity(0.35), radius: isPrimary ? 8 : 4, x: 0, y: 3)
                            .position(currentPos)
                            .opacity(trackingManager.isFaceDetected ? 1.0 : 0.0)
                    }
                    .animation(.easeInOut(duration: 0.25), value: trackingManager.isFaceDetected)
                }
            }
        }
        .allowsHitTesting(false)
    }
}
