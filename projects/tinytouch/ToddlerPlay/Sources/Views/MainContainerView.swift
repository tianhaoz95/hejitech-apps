import SwiftUI

/// Root container view for TinyTouch. Provides edge-to-edge touch interception,
/// the Parent Shield 3-second hold gate, co-play guidance, and mode switching.
struct MainContainerView: View {
    @StateObject private var appState = AppState()
    @Environment(\.scenePhase) private var scenePhase
    
    @State private var showCoPlayToast = true
    
    var body: some View {
        ZStack {
            // Background base
            Color.black.ignoresSafeArea()
            
            // 1. Active Toddler Play Canvas
            Group {
                switch appState.currentMode {
                case .bubbles:
                    BubblePopView()
                case .animals:
                    AnimalFriendsView()
                case .soundGarden:
                    SoundGardenView()
                case .sparkles:
                    SparkleCanvasView()
                case .lullaby:
                    SleepyMoonView()
                }
            }
            .transition(.opacity)
            
            // 2. Parent Co-Play Guidance Banner (temporary prompt for caregiver)
            if showCoPlayToast {
                VStack {
                    Spacer()
                    HStack(spacing: 6) {
                        Image(systemName: "figure.2.and.child.holdinghands")
                            .font(.system(size: 11))
                            .foregroundColor(.yellow)
                        Text(appState.currentMode.coPlayPrompt)
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundColor(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Color.black.opacity(0.85))
                            .overlay(Capsule().stroke(Color.white.opacity(0.2), lineWidth: 1))
                    )
                    .padding(.bottom, 8)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .zIndex(5)
            }
            
            // 3. Parent Lock Shield & Timer Indicator (Top Bar)
            VStack {
                HStack(alignment: .center, spacing: 6) {
                    // The 3-second hold Parent Shield (in top-left)
                    ParentShieldButton()
                    
                    // Subtle timer display if active (next to shield, safely away from clock)
                    if appState.isTimerActive {
                        HStack(spacing: 3) {
                            Image(systemName: "timer")
                                .font(.system(size: 8))
                            Text(appState.formattedRemainingTime)
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                        }
                        .foregroundColor(.orange)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.8))
                                .overlay(Capsule().stroke(Color.orange.opacity(0.4), lineWidth: 1))
                        )
                    }
                    
                    Spacer()
                }
                .padding(.horizontal, 8)
                .padding(.top, 4)
                
                Spacer()
            }
            .zIndex(10)
        }
        .environmentObject(appState)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .ignoresSafeArea()
        .sheet(isPresented: $appState.isParentMenuOpen) {
            ParentDashboardView()
                .environmentObject(appState)
        }
        .onChange(of: appState.currentMode) { _, _ in
            presentCoPlayToast()
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                SessionKeeper.shared.startSession()
                if appState.currentMode == .lullaby {
                    SoundManager.shared.startLullaby()
                }
            }
        }
        .onAppear {
            presentCoPlayToast()
        }
    }
    
    private func presentCoPlayToast() {
        withAnimation(.easeIn(duration: 0.3)) {
            showCoPlayToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
            withAnimation(.easeOut(duration: 0.5)) {
                showCoPlayToast = false
            }
        }
    }
}
