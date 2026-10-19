import SwiftUI
import Combine

/// A toddler-proof parental lock button requiring a continuous 3-second press to activate.
/// Toddlers cannot perform a steady 3-second hold on a small corner target,
/// ensuring they cannot accidentally exit the game or open system menus.
struct ParentShieldButton: View {
    @EnvironmentObject var appState: AppState
    
    @State private var isPressing = false
    @State private var progress: CGFloat = 0.0
    @State private var holdTimer: AnyCancellable?
    @State private var showHint = false
    
    private var requiredHoldDuration: Double { appState.lockHoldDuration }
    private let tickInterval: Double = 0.05
    
    var body: some View {
        ZStack {
            // Background subtle ring
            Circle()
                .stroke(Color.white.opacity(0.15), lineWidth: 3)
                .frame(width: 32, height: 32)
            
            // Charging progress ring
            Circle()
                .trim(from: 0.0, to: progress)
                .stroke(
                    AngularGradient(
                        colors: [.yellow, .orange, .pink, .yellow],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .frame(width: 32, height: 32)
                .animation(.linear(duration: tickInterval), value: progress)
            
            // Icon
            Image(systemName: isPressing ? "lock.fill" : "lock")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(isPressing ? .yellow : .white.opacity(0.4))
                .scaleEffect(isPressing ? 1.15 : 1.0)
                .animation(.easeInOut(duration: 0.2), value: isPressing)
        }
        .contentShape(Rectangle().inset(by: -8)) // comfortable touch target for adult thumb
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressing {
                        startHold()
                    }
                }
                .onEnded { _ in
                    cancelHold()
                }
        )
        .overlay(
            Group {
                if showHint {
                    Text(String(format: "Hold %.0fs", requiredHoldDuration))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.yellow)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.black.opacity(0.85)))
                        .offset(y: 26)
                        .transition(.opacity.combined(with: .scale))
                }
            }
        )
    }
    
    private func startHold() {
        isPressing = true
        progress = 0.0
        
        var elapsed: Double = 0.0
        var lastHapticTick: Double = 0.0
        
        holdTimer = Timer.publish(every: tickInterval, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                elapsed += tickInterval
                progress = min(1.0, CGFloat(elapsed / requiredHoldDuration))
                
                // Play rhythmic haptic ticks every 0.5s
                if elapsed - lastHapticTick >= 0.5 {
                    HapticsManager.shared.playProgressTick()
                    lastHapticTick = elapsed
                }
                
                if elapsed >= requiredHoldDuration {
                    // Success!
                    completeHold()
                }
            }
    }
    
    private func cancelHold() {
        holdTimer?.cancel()
        holdTimer = nil
        
        if isPressing && progress < 1.0 {
            // Briefly show hint if pressed and released early
            if progress > 0.1 {
                withAnimation {
                    showHint = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation {
                        showHint = false
                    }
                }
            }
        }
        
        isPressing = false
        progress = 0.0
    }
    
    private func completeHold() {
        holdTimer?.cancel()
        holdTimer = nil
        isPressing = false
        progress = 0.0
        appState.onParentUnlocked()
    }
}
