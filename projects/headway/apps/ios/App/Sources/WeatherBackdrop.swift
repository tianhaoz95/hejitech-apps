import HeadwayKit
import SwiftUI

// The weather on the Trains tab: a small "from → to" chip in the board's header, and an animated
// backdrop behind the whole board in the ride's weather (core's `rideTheme`: the more eventful end).

/// The condition's symbol in colors that read on light and dark backgrounds (multicolor clouds are white).
struct WeatherIcon: View {
    let hour: WeatherHour
    private let cloud = Color.gray
    var body: some View {
        Image(systemName: hour.symbol)
            .symbolRenderingMode(.palette)
            .foregroundStyle(colors.0, colors.1, colors.2)
            .accessibilityHidden(true)
    }

    private var colors: (Color, Color, Color) {
        switch hour.cond {
        case .clear, .mostlyClear: hour.day ? (.yellow, .yellow, .yellow) : (.indigo, .indigo, .indigo)
        case .partlyCloudy: (cloud, hour.day ? .yellow : .indigo, .yellow)
        case .haze: (hour.day ? .yellow : .indigo, cloud, cloud)
        case .drizzle, .rain, .showers: (cloud, .blue, .blue)
        case .thunder: (cloud, .yellow, .blue)
        case .snow: (cloud, .cyan, .cyan)
        case .cloudy, .fog, .smoke, .wind: (cloud, cloud, cloud)
        }
    }
}

/// In the board's header: the departure station's weather now → the destination's when the next train arrives.
struct BoardWeatherChip: View {
    let board: Board
    let weather: BoardWeather

    var body: some View {
        HStack(spacing: 5) {
            end(weather.from)
            Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold)).foregroundStyle(.tertiary)
            end(weather.to)
        }
        .font(.caption.weight(.semibold).monospacedDigit())
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(.regularMaterial, in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    @ViewBuilder private func end(_ h: WeatherHour?) -> some View {
        if let h {
            HStack(spacing: 3) {
                WeatherIcon(hour: h)
                Text("\(h.tempF)°").foregroundStyle(.primary).lineLimit(1)
            }
        } else {
            Text("–").foregroundStyle(.tertiary)
        }
    }

    private var label: String {
        var parts: [String] = []
        if let f = weather.from { parts.append("\(board.from.name) now: \(f.tempF) degrees, \(f.words)") }
        if let t = weather.to {
            let when = weather.toAt.map { " at \(Clock.time($0))" } ?? ""
            parts.append("\(board.to.name)\(when): \(t.tempF) degrees, \(t.words)\(t.cond.isWet ? ", \(t.pop) percent chance of rain" : "")")
        }
        return "Weather. " + parts.joined(separator: ". ")
    }
}

// MARK: - Animated backdrop

/// The board's backdrop: a sky in the ride's weather, gently moving (still with Reduce Motion).
/// Pastel in light mode and deep in dark mode, so the board's text keeps its contrast.
struct WeatherBackdrop: View {
    let theme: WeatherTheme
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { ctx in
            let t = reduceMotion ? 12 : ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 100_000)
            Canvas { g, size in
                WeatherPainter(theme: theme, dark: scheme == .dark, t: t, size: size).paint(&g)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }
}

/// Draws one frame. Particles come from a fixed seed so they don't jump between frames.
private struct WeatherPainter {
    let theme: WeatherTheme
    let dark: Bool
    let t: Double
    let size: CGSize

    func paint(_ g: inout GraphicsContext) {
        sky(&g)
        switch theme {
        case .clearDay: sun(&g, strong: true)
        case .clearNight: stars(&g, count: 70); moon(&g)
        case .partlyDay: sun(&g, strong: false); clouds(&g, count: 4, alpha: 0.75, high: true)
        case .partlyNight: stars(&g, count: 40); moon(&g); clouds(&g, count: 3, alpha: 0.5, high: true)
        case .cloudy: clouds(&g, count: 7, alpha: 0.8, high: false)
        case .fog: mist(&g)
        case .rain: clouds(&g, count: 5, alpha: 0.7, high: true); rain(&g, count: 110, speed: 1)
        case .storm: clouds(&g, count: 6, alpha: 0.85, high: true); rain(&g, count: 160, speed: 1.35); lightning(&g)
        case .snow: clouds(&g, count: 4, alpha: 0.6, high: true); snow(&g, count: 80)
        }
    }

    // MARK: sky

    private var skyColors: [Color] {
        switch (theme, dark) {
        case (.clearDay, false): [rgb(0x8EC9F5), rgb(0xD7EEFC), rgb(0xF4F8FB)]
        case (.clearDay, true): [rgb(0x0E3A66), rgb(0x16304D), rgb(0x0B0F17)]
        case (.partlyDay, false): [rgb(0xA6CDEB), rgb(0xDCEBF6), rgb(0xF2F5F8)]
        case (.partlyDay, true): [rgb(0x1A3654), rgb(0x16263A), rgb(0x0B0F17)]
        case (.clearNight, false), (.partlyNight, false): [rgb(0xB9B6E3), rgb(0xDCDBF0), rgb(0xF2F2F7)]
        case (.clearNight, true), (.partlyNight, true): [rgb(0x0B1030), rgb(0x0A0F24), rgb(0x05070F)]
        case (.cloudy, false): [rgb(0xA9B4C1), rgb(0xD3DAE2), rgb(0xF0F2F5)]
        case (.cloudy, true): [rgb(0x2A3038), rgb(0x1A1E24), rgb(0x0C0D10)]
        case (.fog, false): [rgb(0xD5D8DC), rgb(0xE6E8EA), rgb(0xF2F2F3)]
        case (.fog, true): [rgb(0x30343A), rgb(0x22252A), rgb(0x0F1012)]
        case (.rain, false): [rgb(0x9FAFC2), rgb(0xCDD6E0), rgb(0xEEF1F5)]
        case (.rain, true): [rgb(0x1E2B3B), rgb(0x141C27), rgb(0x090C11)]
        case (.storm, false): [rgb(0x7F8A9C), rgb(0xB9C0CB), rgb(0xE9EBEF)]
        case (.storm, true): [rgb(0x161B26), rgb(0x10141C), rgb(0x07080B)]
        case (.snow, false): [rgb(0xC9D9EA), rgb(0xE6EEF6), rgb(0xF6F8FB)]
        case (.snow, true): [rgb(0x22324A), rgb(0x18222F), rgb(0x0B0F15)]
        }
    }

    private func sky(_ g: inout GraphicsContext) {
        g.fill(Path(CGRect(origin: .zero, size: size)),
               with: .linearGradient(Gradient(colors: skyColors), startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height * 0.75)))
    }

    // MARK: sun, moon, stars

    private func sun(_ g: inout GraphicsContext, strong: Bool) {
        // Peeking in from the top-left corner: the toolbar sits top-right.
        let c = CGPoint(x: size.width * 0.04, y: size.height * 0.015)
        let pulse = 1 + 0.04 * sin(t * 0.8)
        let glow = (strong ? 230.0 : 170.0) * pulse
        let warm = dark ? Color(red: 1, green: 0.75, blue: 0.35) : Color(red: 1, green: 0.85, blue: 0.4)
        g.fill(Path(ellipseIn: CGRect(x: c.x - glow, y: c.y - glow, width: glow * 2, height: glow * 2)),
               with: .radialGradient(Gradient(colors: [warm.opacity(dark ? 0.35 : 0.55), warm.opacity(0)]), center: c, startRadius: 0, endRadius: glow))
        // Slowly turning rays.
        var rays = g
        rays.translateBy(x: c.x, y: c.y)
        rays.rotate(by: .radians(t * 0.05))
        for i in 0..<12 {
            var p = Path()
            let a = Double(i) / 12 * 2 * .pi
            p.move(to: CGPoint(x: cos(a - 0.05) * 40, y: sin(a - 0.05) * 40))
            p.addLine(to: CGPoint(x: cos(a) * glow * 1.6, y: sin(a) * glow * 1.6))
            p.addLine(to: CGPoint(x: cos(a + 0.05) * 40, y: sin(a + 0.05) * 40))
            rays.fill(p, with: .color(warm.opacity(dark ? 0.06 : 0.12)))
        }
        let r = 44.0
        g.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(warm.opacity(dark ? 0.8 : 0.95)))
    }

    private func moon(_ g: inout GraphicsContext) {
        let c = CGPoint(x: size.width * 0.07, y: size.height * 0.035)
        let r = 22.0
        let tone = dark ? Color(white: 0.92) : Color(red: 0.55, green: 0.55, blue: 0.75)
        g.fill(Path(ellipseIn: CGRect(x: c.x - r * 3, y: c.y - r * 3, width: r * 6, height: r * 6)),
               with: .radialGradient(Gradient(colors: [tone.opacity(0.18), tone.opacity(0)]), center: c, startRadius: 0, endRadius: r * 3))
        let disc = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
        let crescent = disc.subtracting(Path(ellipseIn: CGRect(x: c.x - r * 0.45, y: c.y - r * 1.25, width: r * 2, height: r * 2)))
        g.fill(crescent, with: .color(tone.opacity(0.9)))
    }

    private func stars(_ g: inout GraphicsContext, count: Int) {
        var rng = Seeded(7)
        let tone = dark ? Color.white : Color(red: 0.35, green: 0.35, blue: 0.6)
        for _ in 0..<count {
            let x = rng.next() * size.width, y = rng.next() * size.height * 0.55
            let phase = rng.next() * 6.28, r = 0.6 + rng.next() * 1.4, rate = 0.8 + rng.next() * 1.5
            let a = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * rate + phase))
            g.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(tone.opacity(a * (dark ? 0.9 : 0.6))))
        }
    }

    // MARK: clouds and mist

    private func clouds(_ g: inout GraphicsContext, count: Int, alpha: Double, high: Bool) {
        var rng = Seeded(11)
        let tone: Color = switch theme {
        case .storm: dark ? Color(white: 0.22) : Color(white: 0.55)
        case .rain: dark ? Color(white: 0.28) : Color(white: 0.7)
        default: dark ? Color(white: 0.32) : Color.white
        }
        var layer = g
        layer.addFilter(.blur(radius: 18))
        for i in 0..<count {
            let w = size.width * (0.45 + rng.next() * 0.45)
            let h = w * (0.28 + rng.next() * 0.12)
            let speed = 6 + rng.next() * 10
            let span = size.width + w * 2
            let x = (rng.next() * span + t * speed).truncatingRemainder(dividingBy: span) - w
            let band = high ? 0.32 : 0.7
            let y = size.height * (rng.next() * band) - h * 0.3 + Double(i % 2) * 20
            layer.fill(cloudPath(x: x, y: y, w: w, h: h), with: .color(tone.opacity(alpha * (0.6 + rng.next() * 0.4))))
        }
    }

    private func cloudPath(x: Double, y: Double, w: Double, h: Double) -> Path {
        var p = Path()
        p.addEllipse(in: CGRect(x: x, y: y + h * 0.35, width: w, height: h * 0.65))
        p.addEllipse(in: CGRect(x: x + w * 0.15, y: y + h * 0.05, width: w * 0.4, height: h * 0.75))
        p.addEllipse(in: CGRect(x: x + w * 0.42, y: y, width: w * 0.42, height: h * 0.8))
        return p
    }

    private func mist(_ g: inout GraphicsContext) {
        var rng = Seeded(23)
        var layer = g
        layer.addFilter(.blur(radius: 28))
        let tone = dark ? Color(white: 0.45) : Color.white
        for i in 0..<9 {
            let h = 60 + rng.next() * 90
            let y = Double(i) / 9 * size.height * 0.95 + rng.next() * 30
            let w = size.width * (1.1 + rng.next() * 0.8)
            let speed = (4 + rng.next() * 8) * (i % 2 == 0 ? 1 : -1)
            let span = size.width + w
            var x = (t * speed + rng.next() * span).truncatingRemainder(dividingBy: span)
            if x < 0 { x += span }
            x -= w
            layer.fill(Path(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerRadius: h / 2),
                       with: .color(tone.opacity((dark ? 0.16 : 0.5) + 0.1 * sin(t * 0.3 + Double(i)))))
        }
    }

    // MARK: rain, lightning, snow

    private func rain(_ g: inout GraphicsContext, count: Int, speed: Double) {
        var rng = Seeded(31)
        let tone = dark ? Color(red: 0.6, green: 0.72, blue: 0.9) : Color(red: 0.3, green: 0.42, blue: 0.62)
        let slant = 0.18
        for _ in 0..<count {
            let len = 14 + rng.next() * 16
            let v = (520 + rng.next() * 260) * speed
            let x0 = rng.next() * (size.width + 80)
            let span = size.height + len
            let y = (rng.next() * span + t * v).truncatingRemainder(dividingBy: span) - len
            let x = x0 - y * slant
            var p = Path()
            p.move(to: CGPoint(x: x, y: y))
            p.addLine(to: CGPoint(x: x - len * slant, y: y + len))
            g.stroke(p, with: .color(tone.opacity((dark ? 0.55 : 0.4) * (0.5 + rng.next() * 0.5))), style: StrokeStyle(lineWidth: dark ? 1.4 : 1.2, lineCap: .round))
        }
    }

    private func lightning(_ g: inout GraphicsContext) {
        // A flash every ~7 s: two quick pulses.
        let cycle = t.truncatingRemainder(dividingBy: 7.3)
        let flash = max(0, 1 - abs(cycle - 0.1) / 0.08) + 0.6 * max(0, 1 - abs(cycle - 0.32) / 0.07)
        guard flash > 0 else { return }
        g.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color.white.opacity(flash * (dark ? 0.22 : 0.35))))
    }

    private func snow(_ g: inout GraphicsContext, count: Int) {
        var rng = Seeded(41)
        let tone = dark ? Color.white : Color(red: 0.6, green: 0.7, blue: 0.82)
        for _ in 0..<count {
            let r = 1.5 + rng.next() * 2.5
            let v = 25 + rng.next() * 40
            let span = size.height + 10
            let y = (rng.next() * span + t * v).truncatingRemainder(dividingBy: span) - 5
            let sway = 0.5 + rng.next(), phase = rng.next() * 6
            let x = rng.next() * size.width + sin(t * sway + phase) * 14
            g.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(tone.opacity(0.75)))
        }
    }

    private func rgb(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// A tiny deterministic generator: the same particles every frame.
private struct Seeded {
    var state: UInt64
    init(_ seed: UInt64) { state = seed &* 0x9E3779B97F4A7C15 }
    mutating func next() -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Double((state >> 33) & 0xFFFFFF) / Double(0xFFFFFF)
    }
}
