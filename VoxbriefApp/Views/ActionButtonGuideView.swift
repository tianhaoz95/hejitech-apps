import SwiftUI
#if canImport(FeedbackKit)
import FeedbackKit
#endif

public struct ActionButtonGuideView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var didTestTrigger = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    heroCard
                    stepsCard
                    controlsExposedCard
                    actionButtonsSection
                    compatibilityNoteCard
                }
                .padding()
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Action Button Setup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .trackFeedbackScreen("ActionButtonGuide")
        }
    }

    // MARK: - Hero Header Card

    private var heroCard: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.accentColor.opacity(0.12))
                    .frame(width: 80, height: 80)

                Image(systemName: "button.programmable")
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
            }

            VStack(spacing: 6) {
                Text("iPhone Action Button")
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)

                Text("One press to record. Speak your mind instantly from anywhere.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .padding(.horizontal, 16)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Step-by-Step Instructions

    private var stepsCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("How to Configure in iOS")
                .font(.headline)
                .foregroundStyle(.primary)

            stepRow(
                number: "1",
                icon: "gearshape.fill",
                tint: .gray,
                title: "Open iPhone Settings",
                detail: "Go to iPhone Settings and select the \"Action Button\" menu."
            )

            stepRow(
                number: "2",
                icon: "slider.horizontal.3",
                tint: .blue,
                title: "Select Controls or Shortcut",
                detail: "On iOS 18+, swipe to \"Controls\". On iOS 17, swipe to \"Shortcut\"."
            )

            stepRow(
                number: "3",
                icon: "mic.fill",
                tint: .red,
                title: "Choose Voxbrief > Start Capture",
                detail: "Pick \"Start Capture\" from Voxbrief's list of controls."
            )

            stepRow(
                number: "4",
                icon: "sparkles",
                tint: .green,
                title: "Capture from Anywhere",
                detail: "Press and hold the Action Button on the side of your iPhone anytime to capture your thoughts."
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func stepRow(number: String, icon: String, tint: Color, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle()
                    .fill(tint.opacity(0.15))
                    .frame(width: 32, height: 32)
                Text(number)
                    .font(.subheadline.bold())
                    .foregroundStyle(tint)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Image(systemName: icon)
                        .font(.caption.bold())
                        .foregroundStyle(tint)
                    Text(title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                }

                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Controls Exposed

    private var controlsExposedCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Exposed iOS Controls")
                .font(.headline)
                .foregroundStyle(.primary)

            controlItemRow(
                icon: "mic.fill",
                tint: .red,
                title: "Start Capture",
                description: "Immediately launches Voxbrief and begins recording. Perfect for the Action Button."
            )

            Divider()

            controlItemRow(
                icon: "waveform.badge.plus",
                tint: .blue,
                title: "Quick Memo",
                description: "Opens Voxbrief ready for quick memo dictation."
            )

            Divider()

            controlItemRow(
                icon: "waveform",
                tint: .purple,
                title: "Open Voxbrief",
                description: "Quickly jumps directly into your voice notes vault."
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func controlItemRow(icon: String, tint: Color, title: String, description: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 28)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.primary)

                Text(description)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtonsSection: some View {
        VStack(spacing: 12) {
            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                HStack {
                    Image(systemName: "gearshape")
                    Text("Open iPhone Settings")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentColor)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button {
                testTriggerAction()
            } label: {
                HStack {
                    Image(systemName: "play.circle.fill")
                    Text(didTestTrigger ? "Trigger Fired! Opening Record…" : "Test Capture Trigger")
                }
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.accentColor.opacity(0.12))
                .foregroundColor(.accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private func testTriggerAction() {
        didTestTrigger = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                NotificationCenter.default.post(
                    name: .voxbriefNavigate,
                    object: nil,
                    userInfo: ["screen": "record", "source": "action_button_test"]
                )
            }
        }
    }

    // MARK: - Compatibility Note

    private var compatibilityNoteCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text("The Action Button is available on iPhone 15 Pro, iPhone 15 Pro Max, and iPhone 16 series. On iOS 18+, Voxbrief controls can also be added to Control Center and Lock Screen.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 4)
    }
}
