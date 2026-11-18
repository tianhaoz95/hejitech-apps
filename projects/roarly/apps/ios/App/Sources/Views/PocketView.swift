import SwiftUI
import UIKit

/// Pocket mode (Pro): the screen goes black and ignores touches while Roarly keeps listening, so the
/// iPhone can lie face down or go in a pocket. Brightness drops to the minimum, the proximity
/// sensor turns the display off in a pocket, and edge swipes need a second swipe. Unlocking takes two
/// steps a pocket can't do by accident: a tap shows a dim moon, then hold the moon for 2 seconds.
struct PocketView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var hintVisible = false
    @State private var hintTask: Task<Void, Never>?
    @State private var holding = false
    @State private var savedBrightness: CGFloat?

    var body: some View {
        ZStack {
            Color.black
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { showHint() }
                .accessibilityIdentifier("pocket")

            if hintVisible {
                VStack(spacing: 18) {
                    Spacer()
                    Text("Still listening").font(Theme.label(15)).foregroundStyle(Theme.ink)
                    Image(systemName: "moon.fill")
                        .font(.system(size: 54))
                        .foregroundStyle(Theme.lantern)
                        .scaleEffect(holding ? 1.25 : 1)
                        .animation(.easeInOut(duration: 2), value: holding)
                        .frame(width: 120, height: 120)
                        .contentShape(Circle())
                        .onLongPressGesture(minimumDuration: 2) {
                            model.exitPocket()
                        } onPressingChanged: { pressing in
                            holding = pressing
                            if pressing { hintTask?.cancel() } else { scheduleHide() }
                        }
                        .accessibilityLabel("Hold to unlock")
                        .accessibilityAddTraits(.isButton)
                        .accessibilityAction { model.exitPocket() }
                        .accessibilityIdentifier("pocket-unlock")
                    Text("Hold the moon to unlock").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Spacer()
                }
                .transition(.opacity)
            }
        }
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .defersSystemGestures(on: .all)
        .preferredColorScheme(.dark)
        .onAppear { dim() }
        .onDisappear { restore() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { dim() } else { restore() }
        }
        .onChange(of: model.isListening) { _, listening in
            if !listening { model.exitPocket() }
        }
    }

    private func showHint() {
        withAnimation(.easeOut(duration: 0.3)) { hintVisible = true }
        setBrightness(max(0.12, (savedBrightness ?? 0.5) * 0.3))
        scheduleHide()
    }

    private func scheduleHide() {
        hintTask?.cancel()
        hintTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.6)) { hintVisible = false }
            setBrightness(0)
        }
    }

    private func dim() {
        if savedBrightness == nil { savedBrightness = Self.screen?.brightness }
        setBrightness(0)
        UIDevice.current.isProximityMonitoringEnabled = true
        log("pocket mode on")
    }

    private func restore() {
        hintTask?.cancel()
        UIDevice.current.isProximityMonitoringEnabled = false
        if let b = savedBrightness { setBrightness(b) }
        savedBrightness = nil
    }

    private func setBrightness(_ value: CGFloat) {
        Self.screen?.brightness = value
    }

    private static var screen: UIScreen? {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen }.first
    }
}
