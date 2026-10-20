import CoreMotion
import LogCore
import SwiftUI
import WatchKit

/// Tilt mode: logging with only the arm that wears the watch. Tilting the wrist rolls a ball into
/// one of four actions (laid out on the iPhone, Settings → Apple Watch); holding it there for a
/// second locks it, and a double pinch (or a tap on Log) logs it. Nothing is asked afterwards: a
/// diaper's kind or a bottle's amount waits on the iPhone under Needs details.
struct TiltModeView: View {
    @EnvironmentObject var link: PhoneLink
    @Environment(\.scenePhase) private var scenePhase
    let switchToButtons: () -> Void
    @StateObject private var motion = TiltMotion()
    @State private var stage = Stage.aiming

    enum Stage: Equatable {
        case aiming
        case confirming(TiltCompass.Slot, since: Date)
        case sending(TiltCompass.Slot)
        case done(TiltCompass.Slot, asks: Bool)
        case failed(String)
    }

    /// How long a locked action waits for the pinch before it lets go.
    private static let confirmWindow: TimeInterval = 4

    var body: some View {
        Group {
            switch stage {
            case .aiming:
                CompassView(slots: slots, motion: motion)
            case .confirming(let slot, let since):
                confirm(slot, since: since)
            case .sending(let slot):
                VStack(spacing: 8) {
                    ProgressView()
                    Text(slot.label).font(.headline).foregroundStyle(TiltTheme.color(slot))
                }
            case .done(let slot, let asks):
                done(slot, asks: asks)
            case .failed(let why):
                VStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill").font(.title2).foregroundStyle(.yellow)
                    Text(why).font(.footnote).multilineTextAlignment(.center)
                }
            }
        }
        .navigationTitle(childName)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: switchToButtons) { Image(systemName: "list.bullet") }
                    .accessibilityLabel("Buttons")
            }
        }
        .onAppear {
            motion.available = Set(slots.map(\.direction))
            motion.start()
            debugStage()
        }
        .onDisappear { motion.stop() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                stage = .aiming
                motion.start()   // a raised wrist is a new posture: re-centre
                debugStage()
            } else {
                motion.stop()
            }
        }
        .onChange(of: link.compass) { motion.available = Set(slots.map(\.direction)) }
        .onChange(of: motion.locked) { _, d in
            guard stage == .aiming, let d, let slot = slots.first(where: { $0.direction == d }) else { return }
            WKInterfaceDevice.current().play(.start)
            stage = .confirming(slot, since: Date())
        }
        .onChange(of: motion.pointing) { _, d in
            // tilting toward another action lets go of the locked one
            if case .confirming(let slot, _) = stage, let d, d != slot.direction { cancel() }
        }
        .task(id: stage) {
            #if DEBUG
            if UserDefaults.standard.string(forKey: "tiltStage") != nil { return }
            #endif
            switch stage {
            case .confirming:
                try? await Task.sleep(for: .seconds(Self.confirmWindow))
                if !Task.isCancelled { cancel() }
            case .done, .failed:
                try? await Task.sleep(for: .seconds(3))
                if !Task.isCancelled { resume() }
            default: break
            }
        }
    }

    /// Screenshots without a wrist (the simulator has no motion): `-tiltStage aim|confirm|done`.
    private func debugStage() {
        #if DEBUG
        guard let s = UserDefaults.standard.string(forKey: "tiltStage"), let slot = slots.first else { return }
        switch s {
        case "aim": motion.preview(slot.direction)
        case "confirm": stage = .confirming(slot, since: .distantFuture)
        case "done": stage = .done(TiltCompass.Slot(direction: .east, action: "diaper", label: "Diaper", icon: "humidity.fill"), asks: true)
        default: break
        }
        #endif
    }

    private var childName: String {
        if link.child == "all" { return link.children.count == 2 ? "Both" : "All" }
        return link.children.first { $0.id == link.child }?.name ?? ""
    }

    /// The iPhone's layout with feed and sleep named for what they'll do now.
    private var slots: [TiltCompass.Slot] {
        link.compass.map { s in
            var s = s
            switch s.action {
            case "feed": s.label = link.openFeed.isEmpty ? "Start feed" : (link.openFeed == "bottle" ? "Finish bottle" : "Finish feed")
            case "sleep":
                s.label = link.sleeping ? "Woke up" : "Asleep"
                s.icon = link.sleeping ? "sun.max.fill" : "moon.zzz.fill"
            default: break
            }
            return s
        }
    }

    private func confirm(_ slot: TiltCompass.Slot, since: Date) -> some View {
        let color = TiltTheme.color(slot)
        return VStack(spacing: 6) {
            Image(systemName: slot.icon)
                .font(.title3)
                .foregroundStyle(.black)
                .frame(width: 38, height: 38)
                .background(color, in: Circle())
            Text(slot.label).font(.title3.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
            Button { log(slot) } label: {
                Label("Log", systemImage: "checkmark").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(color)
            .handGestureShortcut(.primaryAction)
            TimelineView(.animation) { t in
                let left = min(1, max(0, 1 - t.date.timeIntervalSince(since) / Self.confirmWindow))
                Capsule().fill(.quaternary)
                    .frame(height: 3)
                    .overlay(alignment: .leading) {
                        GeometryReader { g in Capsule().fill(color).frame(width: g.size.width * left) }
                    }
            }
            .frame(height: 3)
            .padding(.horizontal, 24)
            Text("Double pinch to log\nTilt away to cancel")
                .font(.system(size: 11)).foregroundStyle(.secondary).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func done(_ slot: TiltCompass.Slot, asks: Bool) -> some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(.green)
            Text(link.confirmation?.replacingOccurrences(of: "✓ ", with: "") ?? slot.label)
                .font(.headline).multilineTextAlignment(.center).lineLimit(2)
            if asks {
                Label("Details on your iPhone", systemImage: "iphone")
                    .font(.footnote).foregroundStyle(.yellow)
            }
            if let id = link.lastId {
                Button("Undo") {
                    link.send(["action": "undo", "id": id])
                    link.lastId = nil
                    resume()
                }
                .buttonStyle(.bordered)
                .handGestureShortcut(.primaryAction)
            }
        }
    }

    private func log(_ slot: TiltCompass.Slot) {
        var msg: [String: Any] = ["input": "gesture"]
        switch slot.action {
        case "feed": msg["action"] = "toggleFeed"
        case "sleep": msg["action"] = "toggleSleep"
        case "diaper": msg["action"] = "diaper"
        default:
            msg["action"] = "care"
            msg["type"] = slot.type
            if !slot.runningId.isEmpty { msg["runningId"] = slot.runningId }
        }
        let asks = slot.action == "diaper" || (slot.action == "feed" && link.openFeed == "bottle")
        stage = .sending(slot)
        link.send(msg) { ok in
            if ok {
                stage = .done(slot, asks: asks)
            } else {
                WKInterfaceDevice.current().play(.failure)
                stage = .failed(link.confirmation ?? "Not logged")
            }
        }
    }

    private func cancel() {
        WKInterfaceDevice.current().play(.retry)
        resume()
    }

    /// Back to the compass, centred on wherever the wrist is now.
    private func resume() {
        stage = .aiming
        motion.recentre()
    }
}

/// The four actions on a ring, and a ball that rolls toward the lower edge of the screen.
private struct CompassView: View {
    let slots: [TiltCompass.Slot]
    @ObservedObject var motion: TiltMotion

    var body: some View {
        GeometryReader { g in
            let d = min(g.size.width, g.size.height)
            let r = d / 2
            let aimed = slots.first { $0.direction == motion.aiming }
            let tint = aimed.map(TiltTheme.color) ?? Color.white
            ZStack {
                ForEach(slots, id: \.direction) { s in
                    let color = TiltTheme.color(s)
                    let on = s.direction == motion.aiming
                    arc(s.direction, to: 1).stroke(color.opacity(on ? 0.35 : 0.18), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    if on {
                        arc(s.direction, to: motion.progress).stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    }
                    VStack(spacing: 1) {
                        Image(systemName: s.icon).font(.system(size: d * 0.1, weight: .semibold))
                        Text(s.label).font(.system(size: d * 0.075, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .foregroundStyle(on ? color : color.opacity(0.6))
                    .frame(maxWidth: r * 0.56)
                    .offset(labelOffset(s.direction, r: r))
                }
                Circle()
                    .strokeBorder(.white.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
                    .frame(width: d * 0.2, height: d * 0.2)
                Circle()
                    .fill(RadialGradient(colors: [.white, tint], center: UnitPoint(x: 0.35, y: 0.3), startRadius: 0, endRadius: d * 0.08))
                    .frame(width: d * 0.15, height: d * 0.15)
                    .shadow(color: tint.opacity(0.7), radius: 6)
                    .offset(x: motion.ball.x * r * 0.36, y: -motion.ball.y * r * 0.36)
                    .animation(.interactiveSpring(response: 0.18), value: motion.ball)
            }
            .frame(width: d, height: d)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement()
        .accessibilityLabel(slots.map { "\($0.direction.gesture): \($0.label)" }.joined(separator: ", "))
    }

    /// An 80° arc centred on the direction (SwiftUI's trim starts at 3 o'clock, going clockwise).
    private func arc(_ d: TiltCompass.Direction, to fraction: Double) -> some Shape {
        let centre: Double = [.east: 0, .south: 90, .west: 180, .north: 270][d]!
        return Circle().inset(by: 3).trim(from: 0, to: 80 / 360 * fraction).rotation(.degrees(centre - 40))
    }

    private func labelOffset(_ d: TiltCompass.Direction, r: CGFloat) -> CGSize {
        switch d {
        case .north: return CGSize(width: 0, height: -r * 0.64)
        case .south: return CGSize(width: 0, height: r * 0.64)
        case .east: return CGSize(width: r * 0.6, height: 0)
        case .west: return CGSize(width: -r * 0.6, height: 0)
        }
    }
}

/// Gravity from CoreMotion, relative to the posture when tilt mode started, fed into `TiltLock`.
@MainActor
final class TiltMotion: ObservableObject {
    /// The ball, −1…1 on each axis (1 = 30° of tilt).
    @Published var ball = CGPoint.zero
    @Published var aiming: TiltCompass.Direction?
    @Published var progress: Double = 0
    @Published var locked: TiltCompass.Direction?
    /// Where the wrist points now, ignoring the lock: tilting elsewhere cancels a locked action.
    @Published var pointing: TiltCompass.Direction?
    var available: Set<TiltCompass.Direction> = Set(TiltCompass.Direction.allCases) {
        didSet { lock.available = available }
    }

    private let manager = CMMotionManager()
    private var lock = TiltLock()
    private var neutral: (x: Double, y: Double)?
    private var warmup: [(x: Double, y: Double)] = []

    func start() {
        recentre()
        guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
        manager.deviceMotionUpdateInterval = 1 / 30
        manager.startDeviceMotionUpdates(to: .main) { [weak self] m, _ in
            guard let m else { return }
            MainActor.assumeIsolated { self?.update(m) }
        }
    }

    func stop() { manager.stopDeviceMotionUpdates() }

    #if DEBUG
    /// The ball held in a direction halfway through the dwell, for screenshots.
    func preview(_ d: TiltCompass.Direction) {
        stop()
        aiming = d
        progress = 0.6
        ball = [.north: CGPoint(x: 0, y: 0.8), .east: CGPoint(x: 0.8, y: 0), .south: CGPoint(x: 0, y: -0.8), .west: CGPoint(x: -0.8, y: 0)][d]!
    }
    #endif

    /// The next 0.3 s of readings become the centre.
    func recentre() {
        neutral = nil
        warmup = []
        lock.reset()
        locked = nil
        aiming = nil
        pointing = nil
        progress = 0
        ball = .zero
    }

    private func update(_ m: CMDeviceMotion) {
        // degrees of tilt toward the screen's right and top edges; with the crown on the left the
        // screen is upside down relative to the hardware
        let flip: Double = WKInterfaceDevice.current().crownOrientation == .left ? -1 : 1
        let deg = { (v: Double) in asin(max(-1, min(1, v))) * 180 / .pi }
        let raw = (x: deg(m.gravity.x) * flip, y: deg(m.gravity.y) * flip)
        guard let n = neutral else {
            warmup.append(raw)
            if warmup.count >= 10 {
                neutral = (warmup.map(\.x).reduce(0, +) / 10, warmup.map(\.y).reduce(0, +) / 10)
            }
            return
        }
        let x = raw.x - n.x, y = raw.y - n.y
        let r = m.rotationRate
        let rotation = (r.x * r.x + r.y * r.y + r.z * r.z).squareRoot()
        let now = Date()
        let before = lock.phase
        let justLocked = lock.update(x: x, y: y, rotation: rotation, at: now)
        ball = CGPoint(x: max(-1, min(1, x / 30)), y: max(-1, min(1, y / 30)))
        if case .aiming(let d, _) = lock.phase {
            if aiming != d { WKInterfaceDevice.current().play(.click) }
            aiming = d
        } else if case .locked(let d) = lock.phase {
            aiming = d
        } else {
            aiming = nil
        }
        progress = lock.progress(at: now)
        if let justLocked { locked = justLocked }
        if case .locked = before {
            pointing = TiltLock(available: available).direction(x: x, y: y)
        } else {
            pointing = nil
        }
    }
}

/// The iPhone app's colours (Theme in App.swift), for the watch.
enum TiltTheme {
    static func color(_ s: TiltCompass.Slot) -> Color {
        switch s.action {
        case "feed": Color(red: 0.98, green: 0.70, blue: 0.45)
        case "diaper": Color(red: 0.45, green: 0.75, blue: 0.95)
        case "sleep": Color(red: 0.62, green: 0.58, blue: 0.95)
        default: Color(red: 0.55, green: 0.85, blue: 0.65)
        }
    }
}
