import SwiftUI

/// Roarly's look: a storybook at night. Deep indigo sky, a warm lantern glow, serif type.
enum Theme {
    static let sky = Color(red: 0.07, green: 0.07, blue: 0.20)
    static let skyDeep = Color(red: 0.03, green: 0.03, blue: 0.11)
    static let lantern = Color(red: 1.0, green: 0.78, blue: 0.34)
    static let ember = Color(red: 0.98, green: 0.52, blue: 0.30)
    static let moon = Color(red: 0.93, green: 0.91, blue: 0.85)
    static let ink = Color(red: 0.70, green: 0.70, blue: 0.85)
    static let card = Color.white.opacity(0.07)
    static let cardStroke = Color.white.opacity(0.10)

    static func title(_ size: CGFloat = 28) -> Font { .system(size: size, weight: .bold, design: .serif) }
    static func body(_ size: CGFloat = 17) -> Font { .system(size: size, weight: .regular, design: .serif) }
    static func label(_ size: CGFloat = 15) -> Font { .system(size: size, weight: .semibold, design: .rounded) }
}

/// The night sky behind every screen, with a few still stars.
struct NightSky: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.sky, Theme.skyDeep], startPoint: .top, endPoint: .bottom)
            Canvas { context, size in
                var rng = SeededRandom(seed: 7)
                for _ in 0..<70 {
                    let x = rng.next() * size.width
                    let y = rng.next() * size.height * 0.75
                    let r = 0.6 + rng.next() * 1.4
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r, height: r)), with: .color(.white.opacity(0.15 + rng.next() * 0.45)))
                }
            }
        }
        .ignoresSafeArea()
    }
}

struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) { state = seed &* 6364136223846793005 &+ 1442695040888963407 }
    mutating func next() -> CGFloat {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return CGFloat((state >> 33) % 10_000) / 10_000
    }
}

struct StoryCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.cardStroke))
    }
}

struct LanternButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.label(17))
            .foregroundStyle(Theme.skyDeep)
            .padding(.vertical, 15)
            .frame(maxWidth: .infinity)
            .background(Theme.lantern, in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}
