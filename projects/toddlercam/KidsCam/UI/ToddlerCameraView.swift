import SwiftUI

public struct ToddlerCameraView: View {
    @ObservedObject var cameraManager = DualCameraManager.shared
    @ObservedObject var guidedManager = GuidedAccessManager.shared
    @ObservedObject var watchConn = WatchConnectivityManager.shared

    @State private var showParentGate = false
    @State private var pendingParentDestination: ParentDestination? = nil
    @State private var isParentGateUnlocked = false
    @State private var showGuidedAccessDirectly = false
    @State private var showParentHub = false
    @State private var showGallery = false

    // Cheerful touch pops and touch sounds when tapping anywhere that is not a button
    @State private var touchPops: [TouchBubble] = []
    private let touchSounds: [SoundType] = [.quack, .woof, .meow, .giggle, .boing, .horn, .pop]
    @State private var touchSoundIndex: Int = 0

    enum ParentDestination {
        case hub
        case guidedAccess
        case gallery
    }

    public init() {}

    public var body: some View {
        GeometryReader { geo in
            ZStack {
                // 1. Dual Camera Feeds (PiP) - Edge-to-Edge Fullscreen
                DualCameraPreviewView(onBackgroundTouch: { location in
                    handleNonButtonTouch(at: location)
                })
                .ignoresSafeArea()

                // Animated cheerful sparkles/pops when touching anywhere on screen
                ForEach(touchPops) { pop in
                    Text(pop.symbol)
                        .font(.system(size: 40))
                        .position(x: pop.x, y: pop.y)
                        .transition(.scale.combined(with: .opacity))
                        .allowsHitTesting(false)
                }

                // 2. Main Toddler Controls
                VStack(spacing: 0) {
                    // Top Header Bar cleanly positioned below notch / Dynamic Island
                    VStack(alignment: .leading, spacing: 6) {
                        topHeaderBar
                            .padding(.horizontal, 16)

                        if cameraManager.isDemoMode {
                            HStack(spacing: 5) {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.yellow)
                                Text("DEMO MODE • AI-Generated (Not a real person)")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.black.opacity(0.72))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
                            )
                            .padding(.horizontal, 16)
                        }
                    }
                    .padding(.top, max(geo.safeAreaInsets.top, 48) + 4)

                    Spacer()

                    // Bottom Toddler Control Bar
                    ToddlerControlBar(
                        onOpenGallery: {
                            promptParentGate(for: .gallery)
                        },
                        onOpenParentZone: {
                            promptParentGate(for: .hub)
                        },
                        onBackgroundTouch: { _ in
                            handleNonButtonTouch(at: CGPoint(x: geo.size.width / 2, y: geo.size.height - 70))
                        }
                    )
                    .padding(.bottom, max(geo.safeAreaInsets.bottom, 12))
                }
                .frame(width: geo.size.width, height: geo.size.height)

                // 3. Toddler Lock Screen (Protects screen from unintentional taps)
                if cameraManager.isToddlerLocked {
                    ToddlerLockOverlay()
                }

                // 4. Parental Gate Challenge
                if showParentGate {
                    ParentGateView(
                        isUnlocked: $isParentGateUnlocked,
                        onUnlocked: {
                            showParentGate = false
                            handleParentUnlock()
                        },
                        onCancel: {
                            showParentGate = false
                            pendingParentDestination = nil
                        }
                    )
                    .transition(.opacity)
                }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showParentHub) {
            ParentHubView()
        }
        .sheet(isPresented: $showGuidedAccessDirectly) {
            GuidedAccessGuideView()
        }
        .sheet(isPresented: $showGallery) {
            PhotoGalleryView()
        }
        .statusBar(hidden: true)
        .onAppear {
            cameraManager.startSession()
        }
        .onDisappear {
            cameraManager.stopSession()
        }
    }

    // MARK: - Top Header Bar
    private var topHeaderBar: some View {
        HStack(spacing: 10) {
            // Guided Access Quick Status Badge / Setup Shortcut Button
            Button(action: {
                SoundEffectManager.shared.play(.pop)
                promptParentGate(for: .guidedAccess)
            }) {
                HStack(spacing: 6) {
                    Image(systemName: guidedManager.isGuidedAccessActive ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(guidedManager.isGuidedAccessActive ? .green : .orange)

                    Text(guidedManager.isGuidedAccessActive ? "Guided Access ON" : "Guided Access")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Color.black.opacity(0.55))
                .cornerRadius(18)
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(guidedManager.isGuidedAccessActive ? Color.green.opacity(0.6) : Color.orange.opacity(0.6), lineWidth: 1.5)
                )
            }

            Spacer()

            // Video Recording Indicator Badge
            if cameraManager.isRecordingVideo {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                    Text("REC \(formatDuration(cameraManager.videoRecordingDuration))")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.black.opacity(0.65))
                .cornerRadius(14)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.red, lineWidth: 1.5)
                )

                Spacer()
            }

            // Watch Connection Indicator
            if watchConn.isReachable {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 7, height: 7)
                    Image(systemName: "applewatch")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color.black.opacity(0.55))
                .cornerRadius(14)
            }

            // Lock Screen Button
            Button(action: {
                cameraManager.toggleToddlerLock()
            }) {
                HStack(spacing: 4) {
                    Image(systemName: cameraManager.isToddlerLocked ? "lock.fill" : "lock.open.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(cameraManager.isToddlerLocked ? .yellow : .white)
                    Text(cameraManager.isToddlerLocked ? "Locked" : "Lock")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.black.opacity(0.55))
                .cornerRadius(16)
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Parent Gate Handling
    private func promptParentGate(for destination: ParentDestination) {
        pendingParentDestination = destination
        showParentGate = true
    }

    private func handleParentUnlock() {
        guard let dest = pendingParentDestination else { return }
        pendingParentDestination = nil
        switch dest {
        case .hub:
            showParentHub = true
        case .guidedAccess:
            showGuidedAccessDirectly = true
        case .gallery:
            showGallery = true
        }
    }

    // MARK: - Touch Anywhere Sound & Pops
    private func handleNonButtonTouch(at location: CGPoint) {
        guard !cameraManager.isToddlerLocked else { return }

        let sound = touchSounds[touchSoundIndex % touchSounds.count]
        touchSoundIndex += 1
        SoundEffectManager.shared.play(sound, haptic: true)

        let symbol = ["🫧", "⭐", "🎉", "🎈", "✨", "🐥", "🍭"].randomElement() ?? "⭐"
        let color: Color = [.yellow, .pink, .green, .orange, .cyan, .purple].randomElement() ?? .yellow
        let pop = TouchBubble(x: location.x, y: location.y, symbol: symbol, color: color)
        touchPops.append(pop)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            touchPops.removeAll(where: { $0.id == pop.id })
        }
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        let mins = total / 60
        let secs = total % 60
        return String(format: "%02d:%02d", mins, secs)
    }
}
