import SwiftUI

public struct TouchBubble: Identifiable {
    public let id = UUID()
    public let x: CGFloat
    public let y: CGFloat
    public let symbol: String
    public let color: Color

    public init(x: CGFloat, y: CGFloat, symbol: String, color: Color) {
        self.x = x
        self.y = y
        self.symbol = symbol
        self.color = color
    }
}

public struct ToddlerLockOverlay: View {
    @ObservedObject var cameraManager = DualCameraManager.shared
    @State private var bubbles: [TouchBubble] = []
    @State private var unlockProgress: CGFloat = 0.0
    @State private var isHoldingUnlock: Bool = false
    @State private var unlockTimer: Timer?

    private let symbols = ["🫧", "⭐", "❤️", "🎈", "🌸", "🦄", "🍭", "🐥", "🎵"]
    private let colors: [Color] = [.pink, .yellow, .green, .orange, .purple, .cyan]

    public init() {}

    public var body: some View {
        ZStack {
            // Touch canvas catching all toddler taps
            Color.black.opacity(0.01)
                .edgesIgnoringSafeArea(.all)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onEnded { value in
                            spawnBubble(at: value.location)
                        }
                )

            // Animated bubbles / stars
            ForEach(bubbles) { bubble in
                Text(bubble.symbol)
                    .font(.system(size: 40))
                    .position(x: bubble.x, y: bubble.y)
                    .transition(.scale.combined(with: .opacity))
            }

            // Top unlock bar for parents
            VStack {
                HStack {
                    Spacer()

                    // Unlock Button (Hold 3 Seconds)
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.3), lineWidth: 5)
                            .frame(width: 60, height: 60)

                        Circle()
                            .trim(from: 0, to: unlockProgress)
                            .stroke(Color.green, lineWidth: 5)
                            .frame(width: 60, height: 60)
                            .rotationEffect(.degrees(-90))

                        Image(systemName: "lock.fill")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .background(Color.black.opacity(0.6))
                    .clipShape(Circle())
                    .padding(.trailing, 20)
                    .padding(.top, 20)
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { _ in
                                startUnlockTimer()
                            }
                            .onEnded { _ in
                                cancelUnlockTimer()
                            }
                    )
                }

                Spacer()

                // Friendly lock hint
                Text("🔒 Tap anywhere for magic bubbles! • Hold lock 3s to exit")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.black.opacity(0.7))
                    .cornerRadius(20)
                    .padding(.bottom, 24)
            }
        }
    }

    private func spawnBubble(at point: CGPoint) {
        SoundEffectManager.shared.play(.pop, haptic: true)
        let sym = symbols.randomElement() ?? "⭐"
        let col = colors.randomElement() ?? .yellow
        let bubble = TouchBubble(x: point.x, y: point.y, symbol: sym, color: col)
        bubbles.append(bubble)

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            bubbles.removeAll(where: { $0.id == bubble.id })
        }
    }

    private func startUnlockTimer() {
        guard !isHoldingUnlock else { return }
        isHoldingUnlock = true
        unlockProgress = 0.0

        let interval = 0.05
        let totalTime = 2.5
        let step = CGFloat(interval / totalTime)

        unlockTimer?.invalidate()
        unlockTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { timer in
            unlockProgress += step
            if unlockProgress >= 1.0 {
                timer.invalidate()
                SoundEffectManager.shared.play(.horn)
                cameraManager.isToddlerLocked = false
                unlockProgress = 0.0
                isHoldingUnlock = false
            }
        }
    }

    private func cancelUnlockTimer() {
        unlockTimer?.invalidate()
        unlockTimer = nil
        isHoldingUnlock = false
        withAnimation(.easeOut(duration: 0.2)) {
            unlockProgress = 0.0
        }
    }
}
