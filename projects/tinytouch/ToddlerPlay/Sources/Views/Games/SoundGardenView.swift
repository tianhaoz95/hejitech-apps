import SwiftUI

struct ChimeBar: Identifiable {
    let id: Int
    let noteName: String
    let color: Color
    var isGlowing: Bool = false
}

struct SoundGardenView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var bars: [ChimeBar] = [
        ChimeBar(id: 0, noteName: "Do", color: Color(red: 1.0, green: 0.35, blue: 0.35)), // Red
        ChimeBar(id: 1, noteName: "Re", color: Color(red: 1.0, green: 0.65, blue: 0.25)), // Orange
        ChimeBar(id: 2, noteName: "Mi", color: Color(red: 1.0, green: 0.90, blue: 0.25)), // Yellow
        ChimeBar(id: 3, noteName: "Sol", color: Color(red: 0.35, green: 0.85, blue: 0.45)), // Green
        ChimeBar(id: 4, noteName: "La", color: Color(red: 0.30, green: 0.70, blue: 1.00)), // Blue
        ChimeBar(id: 5, noteName: "Do", color: Color(red: 0.75, green: 0.45, blue: 0.95))  // Purple
    ]
    
    @State private var activeBarIndex: Int? = nil
    @State private var crownGlissando: Double = 0.0
    @State private var lastCrownIndex: Int = -1
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()
                
                HStack(spacing: 5) {
                    ForEach(bars) { bar in
                        let isActive = activeBarIndex == bar.id
                        
                        ZStack(alignment: .bottom) {
                            // Base Bar
                            RoundedRectangle(cornerRadius: 12)
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            bar.color.opacity(isActive ? 1.0 : 0.65),
                                            bar.color.opacity(isActive ? 0.85 : 0.35)
                                        ],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .frame(maxWidth: .infinity)
                                .frame(height: barHeight(for: bar.id, totalHeight: geo.size.height))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.white.opacity(isActive ? 0.9 : 0.25), lineWidth: isActive ? 3 : 1)
                                )
                                .shadow(color: bar.color.opacity(isActive ? 0.9 : 0.2), radius: isActive ? 12 : 2)
                                .scaleEffect(isActive ? 1.06 : 1.0)
                                .animation(.spring(response: 0.2, dampingFraction: 0.5), value: isActive)
                            
                            // Note indicator
                            VStack {
                                if isActive {
                                    Image(systemName: "music.note")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(.white)
                                        .transition(.scale)
                                }
                                Text(bar.noteName)
                                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                                    .foregroundColor(.white)
                                    .padding(.bottom, 12)
                            }
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.top, 46)
                .padding(.bottom, 12)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        handleTouch(at: value.location, in: geo.size)
                    }
                    .onEnded { _ in
                        activeBarIndex = nil
                    }
            )
            .focusable()
            .digitalCrownRotation(
                $crownGlissando,
                from: 0.0,
                through: Double(bars.count - 1),
                by: 0.5,
                sensitivity: .high,
                isContinuous: false,
                isHapticFeedbackEnabled: true
            )
            .onChange(of: crownGlissando) { _, newVal in
                let idx = Int(newVal.rounded())
                if idx >= 0 && idx < bars.count && idx != lastCrownIndex {
                    lastCrownIndex = idx
                    triggerBar(index: idx)
                }
            }
        }
    }
    
    private func barHeight(for index: Int, totalHeight: CGFloat) -> CGFloat {
        // Pentatonic bars step down in height like a real xylophone
        let usableHeight = totalHeight - 44
        let step = usableHeight * 0.04
        return usableHeight - CGFloat(index) * step
    }
    
    private func handleTouch(at point: CGPoint, in size: CGSize) {
        let barWidth = (size.width - 16) / CGFloat(bars.count)
        let index = Int((point.x - 8) / barWidth)
        
        if index >= 0 && index < bars.count {
            if activeBarIndex != index {
                triggerBar(index: index)
            }
        }
    }
    
    private func triggerBar(index: Int) {
        appState.registerTouch()
        activeBarIndex = index
        HapticsManager.shared.playTap()
        SoundManager.shared.playPentatonicChime(index: index)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            if activeBarIndex == index {
                activeBarIndex = nil
            }
        }
    }
}
