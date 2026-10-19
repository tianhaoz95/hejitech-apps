import SwiftUI

struct BubbleItem: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var color: Color
    var shapeName: String // "star", "heart", "circle", "face"
    var speed: CGFloat
    var wobbleOffset: CGFloat = 0.0
}

struct PopBurst: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var color: Color
    var scale: CGFloat = 0.1
    var opacity: Double = 1.0
}

struct BubblePopView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var bubbles: [BubbleItem] = []
    @State private var bursts: [PopBurst] = []
    @State private var crownBubbleSize: CGFloat = 0.0
    @State private var timer = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()
    
    private let bubbleColors: [Color] = [
        Color(red: 0.3, green: 0.85, blue: 0.95), // Cyan
        Color(red: 1.0, green: 0.45, blue: 0.65), // Pink
        Color(red: 1.0, green: 0.85, blue: 0.25), // Yellow
        Color(red: 0.4, green: 0.9, blue: 0.5),  // Lime Green
        Color(red: 0.75, green: 0.5, blue: 1.0),  // Lavender
        Color(red: 1.0, green: 0.6, blue: 0.25)   // Orange
    ]
    
    private let shapes = ["star", "heart", "circle", "face"]
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Background deep OLED black with subtle gentle glow
                Color.black.ignoresSafeArea()
                
                // Floating bubbles
                ForEach(bubbles) { b in
                    ZStack {
                        BubbleView(color: b.color, size: b.size)
                        
                        // Icon inside bubble
                        shapeInside(b.shapeName, color: b.color, size: b.size)
                    }
                    .position(x: b.x + b.wobbleOffset, y: b.y)
                }
                
                // Giant Crown Bubble (if being inflated by crown)
                if crownBubbleSize > 10 {
                    ZStack {
                        BubbleView(color: .orange, size: crownBubbleSize)
                        StarShape()
                            .fill(Color.yellow)
                            .frame(width: crownBubbleSize * 0.4, height: crownBubbleSize * 0.4)
                    }
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)
                    .transition(.scale)
                }
                
                // Pop Bursts (Confetti rings)
                ForEach(bursts) { burst in
                    ZStack {
                        Circle()
                            .stroke(burst.color, lineWidth: 3)
                            .frame(width: 50 * burst.scale, height: 50 * burst.scale)
                            .opacity(burst.opacity)
                        
                        ForEach(0..<6) { i in
                            StarShape()
                                .fill(burst.color)
                                .frame(width: 8, height: 8)
                                .offset(
                                    x: cos(Double(i) * .pi / 3) * 28 * Double(burst.scale),
                                    y: sin(Double(i) * .pi / 3) * 28 * Double(burst.scale)
                                )
                                .opacity(burst.opacity)
                        }
                    }
                    .position(x: burst.x, y: burst.y)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onEnded { value in
                        handleTouch(at: value.location, in: geo.size)
                    }
            )
            .focusable()
            .digitalCrownRotation(
                $crownBubbleSize,
                from: 0.0,
                through: 160.0,
                by: 5.0,
                sensitivity: .medium,
                isContinuous: false,
                isHapticFeedbackEnabled: true
            )
            .onChange(of: crownBubbleSize) { _, newSize in
                if newSize >= 155 {
                    // Giant pop!
                    popGiantBubble(in: geo.size)
                } else if newSize > 10 {
                    HapticsManager.shared.playCrownTick()
                }
            }
            .onAppear {
                if bubbles.isEmpty {
                    seedBubbles(in: geo.size)
                }
            }
            .onReceive(timer) { _ in
                updateBubbles(in: geo.size)
            }
        }
    }
    
    @ViewBuilder
    private func shapeInside(_ shape: String, color: Color, size: CGFloat) -> some View {
        let innerSize = size * 0.42
        switch shape {
        case "star":
            StarShape()
                .fill(Color.white.opacity(0.85))
                .frame(width: innerSize, height: innerSize)
        case "heart":
            HeartShape()
                .fill(Color.white.opacity(0.85))
                .frame(width: innerSize, height: innerSize)
        case "face":
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.85))
                    .frame(width: innerSize, height: innerSize)
                HStack(spacing: innerSize * 0.2) {
                    Circle().fill(Color.black).frame(width: innerSize * 0.15)
                    Circle().fill(Color.black).frame(width: innerSize * 0.15)
                }
                .offset(y: -innerSize * 0.08)
            }
        default:
            Circle()
                .fill(Color.white.opacity(0.85))
                .frame(width: innerSize * 0.8, height: innerSize * 0.8)
        }
    }
    
    private func seedBubbles(in size: CGSize) {
        let count = appState.lowStimulation ? 4 : 7
        for _ in 0..<count {
            spawnBubble(in: size, randomY: true)
        }
    }
    
    private func spawnBubble(in size: CGSize, randomY: Bool = false) {
        let bubbleSize = CGFloat.random(in: 44...68)
        let x = CGFloat.random(in: bubbleSize/2...(size.width - bubbleSize/2))
        let y = randomY ? CGFloat.random(in: 40...(size.height - 40)) : (size.height + bubbleSize)
        let color = bubbleColors.randomElement() ?? .cyan
        let shape = shapes.randomElement() ?? "star"
        let speed = appState.lowStimulation ? CGFloat.random(in: 0.6...1.2) : CGFloat.random(in: 1.0...2.2)
        
        bubbles.append(BubbleItem(x: x, y: y, size: bubbleSize, color: color, shapeName: shape, speed: speed))
    }
    
    private func updateBubbles(in size: CGSize) {
        for i in bubbles.indices {
            bubbles[i].y -= bubbles[i].speed
            bubbles[i].wobbleOffset = sin(bubbles[i].y * 0.05) * 6.0
        }
        
        // Remove bubbles that floated off top and re-spawn at bottom
        bubbles.removeAll { $0.y < -$0.size }
        let targetCount = appState.lowStimulation ? 4 : 7
        while bubbles.count < targetCount {
            spawnBubble(in: size, randomY: false)
        }
        
        // Update bursts
        for i in bursts.indices {
            bursts[i].scale += 0.15
            bursts[i].opacity -= 0.12
        }
        bursts.removeAll { $0.opacity <= 0 }
    }
    
    private func handleTouch(at point: CGPoint, in size: CGSize) {
        appState.registerTouch()
        
        // Check if a bubble was tapped
        if let index = bubbles.firstIndex(where: { b in
            let dist = hypot(b.x + b.wobbleOffset - point.x, b.y - point.y)
            return dist <= (b.size * 0.6)
        }) {
            // Popped a bubble!
            let popped = bubbles.remove(at: index)
            HapticsManager.shared.playPop()
            SoundManager.shared.playPop()
            
            // Add burst
            bursts.append(PopBurst(x: popped.x + popped.wobbleOffset, y: popped.y, color: popped.color))
            
            // Optional voice prompt
            if appState.voiceEnabled && Bool.random() {
                SoundManager.shared.speak("Pop!")
            }
            
            // Spawn replacement
            spawnBubble(in: size, randomY: false)
        } else {
            // Tapped empty space -> spawn a new bubble right under finger!
            HapticsManager.shared.playTap()
            SoundManager.shared.playBoing()
            let newBubble = BubbleItem(
                x: point.x,
                y: point.y,
                size: CGFloat.random(in: 46...64),
                color: bubbleColors.randomElement() ?? .yellow,
                shapeName: shapes.randomElement() ?? "star",
                speed: 1.2
            )
            bubbles.append(newBubble)
        }
    }
    
    private func popGiantBubble(in size: CGSize) {
        crownBubbleSize = 0.0
        HapticsManager.shared.playBounce()
        SoundManager.shared.playSparkle()
        SoundManager.shared.playPop()
        
        // Giant burst at center
        for _ in 0..<3 {
            bursts.append(PopBurst(x: size.width / 2, y: size.height / 2, color: bubbleColors.randomElement() ?? .orange))
        }
    }
}
