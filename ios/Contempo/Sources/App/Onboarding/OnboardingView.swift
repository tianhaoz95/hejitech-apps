import ContempoCore
import SwiftUI

private enum OnboardingStep: Int, CaseIterable {
    case welcome, captureMode, quickCapture, done
}

/// First-launch walkthrough — shown once per device (gated by
/// `ServiceLocator.onboardingStore`, see RootView) regardless of sign-in
/// state, ahead of both `SignInScreen` and `MainTabView`. Walks through the
/// two settings worth deciding before the user starts logging hours: default
/// capture mode (voice-first vs typing) and Quick Capture. Visually mirrors
/// `HelpWalkthroughSheet`'s sequential-card chrome (progress dots, Skip,
/// Back/Next) but full-screen, since this is the very first thing shown, not
/// an overlay on already-visible content — and two of its four steps are
/// interactive settings, not just static explanation.
struct OnboardingView: View {
    @Environment(\.contempoPalette) private var palette
    @State private var step: OnboardingStep = .welcome
    private let captureModeStore = ServiceLocator.captureModeStore
    private let quickCaptureStore = ServiceLocator.quickCaptureSettingsStore

    private var isLastStep: Bool { step == .done }

    var body: some View {
        VStack(spacing: 0) {
            header
            Spacer(minLength: 24)
            ScrollView {
                content
            }
            Spacer(minLength: 24)
            footer
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.paper)
    }

    private var header: some View {
        HStack {
            HStack(spacing: 8) {
                ForEach(OnboardingStep.allCases, id: \.self) { s in
                    Capsule()
                        .fill(s == step ? palette.pine : palette.hairline)
                        .frame(width: s == step ? 18 : 8, height: 8)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: step)
                }
            }
            Spacer()
            if !isLastStep {
                Button("Skip") { finish() }
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.inkSoft)
                    .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .welcome: welcomeStep
        case .captureMode: captureModeStep
        case .quickCapture: quickCaptureStep
        case .done: doneStep
        }
    }

    private var welcomeStep: some View {
        VStack(spacing: 20) {
            iconBadge("hand.wave.fill")
            Text("Welcome to Contempo")
                .font(ContempoFont.headlineMedium())
                .foregroundStyle(palette.ink)
                .multilineTextAlignment(.center)
            Text("Let's set up a couple of things so logging your hours feels natural from the start — this takes a few seconds, and you can change any of it later in Settings.")
                .font(ContempoFont.bodyLarge())
                .foregroundStyle(palette.inkSoft)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private var captureModeStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("How do you want to log hours?")
                .font(ContempoFont.titleLarge())
                .foregroundStyle(palette.ink)
            // Same wording as Settings' "Capture" section, so this reads as
            // the same setting when the user later finds it there.
            Text("Which mode the Capture tab opens in. You can still switch modes for the current session from the toggle at the top of Capture.")
                .font(ContempoFont.bodyMedium())
                .foregroundStyle(palette.inkSoft)

            onboardingOptionCard(
                icon: "mic.fill",
                title: "Voice-first",
                description: "Tap the mic and describe your work out loud — fastest for logging hands-free.",
                isSelected: captureModeStore.defaultMode == .audioFirst
            ) {
                captureModeStore.setDefaultMode(.audioFirst)
            }

            onboardingOptionCard(
                icon: "keyboard",
                title: "Typing",
                description: "Type your entry instead — better when talking out loud isn't practical.",
                isSelected: captureModeStore.defaultMode == .typing
            ) {
                captureModeStore.setDefaultMode(.typing)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var quickCaptureStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Capture")
                .font(ContempoFont.titleLarge())
                .foregroundStyle(palette.ink)

            // Same copy as Settings' "About Quick Capture" sheet, so this
            // reads as the same explanation, not a shorter/different one.
            Text("Quick Capture lets you record multiple voice notes in rapid succession without waiting for on-device transcription or AI structuring.")
                .font(ContempoFont.bodyMedium())
                .foregroundStyle(palette.inkSoft)

            VStack(alignment: .leading, spacing: 12) {
                Label("Recorded notes are saved locally to disk instantly.", systemImage: "bolt.fill")
                Label("Notes are uploaded in the background to your queue.", systemImage: "arrow.clockwise.icloud")
                Label("On-device AI transcribes and converts notes into entries asynchronously.", systemImage: "sparkles")
            }
            .font(ContempoFont.bodySmall())
            .foregroundStyle(palette.inkSoft)

            Divider().padding(.vertical, 4)

            HStack {
                Text("Enable Quick Capture")
                    .font(ContempoFont.bodyLarge())
                    .foregroundStyle(palette.ink)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { quickCaptureStore.enabled },
                    set: { quickCaptureStore.setEnabled($0) }
                ))
                .labelsHidden()
                .tint(palette.pine)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: ContempoRadius.large, style: .continuous)
                    .fill(palette.surfaceContainer)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var doneStep: some View {
        VStack(spacing: 20) {
            iconBadge("checkmark.seal.fill")
            Text("You're all set")
                .font(ContempoFont.headlineMedium())
                .foregroundStyle(palette.ink)
                .multilineTextAlignment(.center)
            Text("You can change either of these — and everything else — anytime from Settings.")
                .font(ContempoFont.bodyLarge())
                .foregroundStyle(palette.inkSoft)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private func iconBadge(_ systemName: String) -> some View {
        ZStack {
            Circle().fill(palette.pineTint).frame(width: 88, height: 88)
            Image(systemName: systemName)
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(palette.pine)
        }
    }

    @ViewBuilder
    private func onboardingOptionCard(
        icon: String,
        title: String,
        description: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(isSelected ? palette.pine : palette.inkSoft)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(ContempoFont.titleMedium())
                        .foregroundStyle(palette.ink)
                    Text(description)
                        .font(ContempoFont.bodySmall())
                        .foregroundStyle(palette.inkSoft)
                }
                Spacer(minLength: 0)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? palette.pine : palette.hairlineStrong)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: ContempoRadius.large, style: .continuous)
                    .fill(isSelected ? palette.pineTint : palette.surfaceContainer)
            )
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.large, style: .continuous)
                    .strokeBorder(isSelected ? palette.pine : palette.hairline, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var footer: some View {
        HStack {
            if step != .welcome {
                Button("Back") {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        step = OnboardingStep(rawValue: step.rawValue - 1) ?? .welcome
                    }
                }
                .font(ContempoFont.labelLarge())
                .buttonStyle(.bordered)
                .tint(palette.inkSoft)
            } else {
                Spacer().frame(height: 1)
            }

            Spacer()

            Button {
                if isLastStep {
                    finish()
                } else {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        step = OnboardingStep(rawValue: step.rawValue + 1) ?? .done
                    }
                }
            } label: {
                Text(isLastStep ? "Get Started" : "Next")
                    .font(ContempoFont.labelLarge())
                    .bold()
                    .frame(minWidth: 100)
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)
        }
    }

    private func finish() {
        ServiceLocator.onboardingStore.setCompleted(true)
    }
}
