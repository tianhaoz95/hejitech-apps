import ContempoCore
import SwiftUI

private struct WalkthroughStep: Identifiable {
    let id = UUID()
    let iconName: String
    let title: String
    let body: String
}

private let walkthroughSteps: [WalkthroughStep] = [
    WalkthroughStep(
        iconName: "mic.fill",
        title: "Say what you did",
        body: "Tap the mic and describe your work — Contempo turns it into a structured, timestamped entry. Photos and typed notes work too."
    ),
    WalkthroughStep(
        iconName: "chart.line.uptrend.xyaxis",
        title: "Watch your hours add up",
        body: "See your logged hours track toward the 100/500-hour STR tests or the REPS 750-hour threshold, broken down by property."
    ),
    WalkthroughStep(
        iconName: "sparkles",
        title: "Ask your logbook anything",
        body: "Ask questions about your entries or material participation rules and get answers grounded in your own records."
    ),
    WalkthroughStep(
        iconName: "gearshape.fill",
        title: "Set up your properties",
        body: "Add properties, pick a capture language, and manage your account here."
    )
]

/// Feature Walkthrough Sheet for iOS matching Android's `HelpWalkthroughDialog`.
/// Displays a sequential 4-step card tutorial explaining Capture, Dashboard, Chat, and Settings.
struct HelpWalkthroughSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette
    @State private var currentStep = 0

    private var isLastStep: Bool {
        currentStep == walkthroughSteps.count - 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header with dot indicators & Skip button
            HStack {
                HStack(spacing: 8) {
                    ForEach(0..<walkthroughSteps.count, id: \.self) { index in
                        Capsule()
                            .fill(index == currentStep ? palette.pine : palette.hairline)
                            .frame(width: index == currentStep ? 18 : 8, height: 8)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStep)
                    }
                }

                Spacer()

                Button("Skip") {
                    dismiss()
                }
                .font(ContempoFont.labelLarge())
                .foregroundStyle(palette.inkSoft)
                .buttonStyle(.plain)
            }

            Spacer().frame(height: 8)

            let step = walkthroughSteps[currentStep]

            ZStack {
                Circle()
                    .fill(palette.pineTint)
                    .frame(width: 72, height: 72)

                Image(systemName: step.iconName)
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(palette.pine)
            }

            Text(step.title)
                .font(ContempoFont.titleLarge())
                .foregroundStyle(palette.ink)

            Text(step.body)
                .font(ContempoFont.bodyLarge())
                .foregroundStyle(palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()

            // Navigation buttons
            HStack {
                if currentStep > 0 {
                    Button("Back") {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            currentStep -= 1
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
                        dismiss()
                    } else {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            currentStep += 1
                        }
                    }
                } label: {
                    Text(isLastStep ? "Got it" : "Next")
                        .font(ContempoFont.labelLarge())
                        .bold()
                        .frame(minWidth: 80)
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.pine)
            }
        }
        .padding(28)
        .background(palette.paper)
        .presentationDetents([.height(420)])
        .presentationCornerRadius(ContempoRadius.large)
    }
}
