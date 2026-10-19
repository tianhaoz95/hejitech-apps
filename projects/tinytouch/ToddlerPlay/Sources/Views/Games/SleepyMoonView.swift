import SwiftUI

struct TwinkleStar: Identifiable {
    let id = UUID()
    let x: CGFloat
    let y: CGFloat
    let size: CGFloat
    var opacity: Double
}

struct SleepyMoonView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var moonScale: CGFloat = 1.0
    @State private var moonGlow: Double = 0.5
    @State private var stars: [TwinkleStar] = []
    @State private var zOffset: CGFloat = 0.0
    @State private var timer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Deep midnight gradient
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.05, blue: 0.18),
                        Color(red: 0.02, green: 0.02, blue: 0.08)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                // Twinkling stars
                ForEach(stars) { star in
                    StarShape(points: 4, smoothness: 0.35)
                        .fill(Color.white)
                        .frame(width: star.size, height: star.size)
                        .opacity(star.opacity)
                        .position(x: star.x, y: star.y)
                }
                
                VStack(spacing: 8) {
                    Spacer(minLength: 20)
                    
                    // Sleepy Crescent Moon
                    ZStack {
                        // Halo glow
                        Circle()
                            .fill(Color.yellow.opacity(moonGlow * 0.35))
                            .frame(width: 140, height: 140)
                            .blur(radius: 16)
                        
                        CrescentMoonShape(progress: 0.58)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color(red: 1.0, green: 0.95, blue: 0.5),
                                        Color(red: 1.0, green: 0.85, blue: 0.3)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 110, height: 110)
                            .shadow(color: .yellow.opacity(0.4), radius: 8)
                            .scaleEffect(moonScale)
                            .animation(.spring(response: 0.4, dampingFraction: 0.6), value: moonScale)
                        
                        // Sleeping face on moon
                        VStack(spacing: 2) {
                            // Sleeping eyes
                            HStack(spacing: 10) {
                                Text("⌒")
                                    .font(.system(size: 16, weight: .bold))
                                Text("⌒")
                                    .font(.system(size: 16, weight: .bold))
                            }
                            .foregroundColor(Color(red: 0.45, green: 0.3, blue: 0.1))
                            
                            // Rosy cheeks and smile
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(Color(red: 1.0, green: 0.45, blue: 0.5).opacity(0.6))
                                    .frame(width: 8, height: 6)
                                Text("◡")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color(red: 0.45, green: 0.3, blue: 0.1))
                                Circle()
                                    .fill(Color(red: 1.0, green: 0.45, blue: 0.5).opacity(0.6))
                                    .frame(width: 8, height: 6)
                            }
                        }
                        .offset(x: 18, y: 4)
                        
                        // Floating "z z Z"
                        Text("z z Z")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(.yellow.opacity(0.85))
                            .offset(x: 48, y: -45 - zOffset)
                            .opacity(Double(1.0 - (zOffset / 40.0)))
                    }
                    .contentShape(Circle())
                    .onTapGesture {
                        sootheMoon(in: geo.size)
                    }
                    
                    // Soothing caption
                    Text("Time to rest ✨")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.9, green: 0.9, blue: 1.0))
                    
                    Text("Goodnight little star")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.gray)
                    
                    Spacer(minLength: 6)
                }
            }
            .contentShape(Rectangle())
            .onAppear {
                seedStars(in: geo.size)
                SoundManager.shared.startLullaby()
            }
            .onReceive(timer) { _ in
                twinkleStars()
                zOffset += 0.8
                if zOffset > 40 {
                    zOffset = 0
                }
            }
        }
    }
    
    private func seedStars(in size: CGSize) {
        stars = (0..<16).map { _ in
            TwinkleStar(
                x: CGFloat.random(in: 10...(size.width - 10)),
                y: CGFloat.random(in: 10...(size.height - 10)),
                size: CGFloat.random(in: 4...9),
                opacity: Double.random(in: 0.3...0.9)
            )
        }
    }
    
    private func twinkleStars() {
        for i in stars.indices {
            stars[i].opacity = Double.random(in: 0.2...0.95)
        }
    }
    
    private func sootheMoon(in size: CGSize) {
        appState.registerTouch()
        HapticsManager.shared.playGentlePulse()
        SoundManager.shared.playBoing()
        
        moonScale = 1.18
        moonGlow = 0.9
        
        if appState.voiceEnabled {
            SoundManager.shared.speak("Goodnight, sweet dreams.")
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            moonScale = 1.0
            moonGlow = 0.5
        }
    }
}
