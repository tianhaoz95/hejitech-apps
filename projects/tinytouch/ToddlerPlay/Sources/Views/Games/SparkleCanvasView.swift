import SwiftUI

struct SparkleParticle: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var vx: CGFloat
    var vy: CGFloat
    var color: Color
    var size: CGFloat
    var opacity: Double = 1.0
    var rotation: Double
}

struct SparkleCanvasView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var particles: [SparkleParticle] = []
    @State private var crownAngle: Double = 0.0
    @State private var lastSparkleSoundTime: Date = Date()
    @State private var timer = Timer.publish(every: 0.04, on: .main, in: .common).autoconnect()
    
    private let rainbowColors: [Color] = [
        .red, .orange, .yellow, .green, .cyan, .blue, .purple, .pink
    ]
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()
                
                // Floating particles
                ForEach(particles) { p in
                    StarShape(points: 4, smoothness: 0.3)
                        .fill(p.color)
                        .frame(width: p.size, height: p.size)
                        .rotationEffect(.degrees(p.rotation))
                        .opacity(p.opacity)
                        .shadow(color: p.color.opacity(0.8), radius: 4)
                        .position(x: p.x, y: p.y)
                }
                
                // Gentle hint prompt if screen is quiet
                if particles.isEmpty {
                    VStack(spacing: 6) {
                        Image(systemName: "hand.draw.fill")
                            .font(.system(size: 32))
                            .foregroundColor(.yellow.opacity(0.6))
                        Text("Touch & Draw")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .transition(.opacity)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        handleDrag(at: value.location, in: geo.size)
                    }
            )
            .focusable()
            .digitalCrownRotation(
                $crownAngle,
                from: -720.0,
                through: 720.0,
                by: 15.0,
                sensitivity: .high,
                isContinuous: true,
                isHapticFeedbackEnabled: true
            )
            .onChange(of: crownAngle) { _, newAngle in
                spawnCrownVortex(angle: newAngle, center: CGPoint(x: geo.size.width / 2, y: geo.size.height / 2))
            }
            .onReceive(timer) { _ in
                updateParticles()
            }
        }
    }
    
    private func handleDrag(at point: CGPoint, in size: CGSize) {
        appState.registerTouch()
        
        // Spawn cluster of sparkles
        for _ in 0..<3 {
            let color = rainbowColors.randomElement() ?? .yellow
            let vx = CGFloat.random(in: -2.5...2.5)
            let vy = CGFloat.random(in: -2.5...2.5)
            let particle = SparkleParticle(
                x: point.x + CGFloat.random(in: -8...8),
                y: point.y + CGFloat.random(in: -8...8),
                vx: vx,
                vy: vy,
                color: color,
                size: CGFloat.random(in: 10...22),
                rotation: Double.random(in: 0...360)
            )
            particles.append(particle)
        }
        
        // Throttle sound and haptics so it sounds musical, not overwhelming
        let now = Date()
        if now.timeIntervalSince(lastSparkleSoundTime) > 0.18 {
            lastSparkleSoundTime = now
            HapticsManager.shared.playTap()
            SoundManager.shared.playSparkle()
        }
    }
    
    private func spawnCrownVortex(angle: Double, center: CGPoint) {
        HapticsManager.shared.playCrownTick()
        let rad = angle * .pi / 180.0
        let r: CGFloat = CGFloat.random(in: 20...60)
        let color = rainbowColors.randomElement() ?? .cyan
        let p = SparkleParticle(
            x: center.x + cos(rad) * r,
            y: center.y + sin(rad) * r,
            vx: -sin(rad) * 1.5,
            vy: cos(rad) * 1.5,
            color: color,
            size: CGFloat.random(in: 12...24),
            rotation: angle
        )
        particles.append(p)
    }
    
    private func updateParticles() {
        for i in particles.indices {
            particles[i].x += particles[i].vx
            particles[i].y += particles[i].vy
            particles[i].opacity -= 0.04
            particles[i].rotation += 4.0
            particles[i].size = max(0, particles[i].size - 0.2)
        }
        particles.removeAll { $0.opacity <= 0 || $0.size <= 0 }
        
        // Cap max particles to ensure 60fps performance on watch
        if particles.count > 50 {
            particles.removeFirst(particles.count - 50)
        }
    }
}
