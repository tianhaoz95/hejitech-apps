import SwiftUI

public struct GuidedAccessGuideView: View {
    @ObservedObject var guidedManager = GuidedAccessManager.shared
    @Environment(\.presentationMode) var presentationMode

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Current Status Banner
                    statusBanner

                    // Quick Action Button to Settings
                    VStack(spacing: 8) {
                        Button(action: {
                            SoundEffectManager.shared.play(.pop)
                            guidedManager.openGuidedAccessSettings()
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: "arrow.up.forward.app.fill")
                                    .font(.system(size: 18, weight: .bold))
                                Text("Open Settings: Accessibility ➔ Guided Access")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                LinearGradient(
                                    colors: [Color.blue, Color.purple],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(20)
                            .shadow(color: Color.blue.opacity(0.3), radius: 8, x: 0, y: 4)
                        }

                        // Path indicator and Search Tip
                        HStack(spacing: 6) {
                            Image(systemName: "info.circle.fill")
                                .foregroundColor(.blue)
                                .font(.system(size: 13))
                            Text("Opens Settings: Tap **Accessibility** ➔ **Guided Access** (or paste 'Guided Access' into Settings Search)")
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(.horizontal, 4)
                    }
                    .padding(.horizontal, 20)

                    // Why Guided Access is Essential Card
                    whyGuidedAccessCard

                    // 4-Step Visual Guide
                    VStack(alignment: .leading, spacing: 18) {
                        Text("How to Turn It On (One-Time Setup)")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .padding(.horizontal, 20)

                        stepCard(
                            stepNumber: "1",
                            title: "Tap 'Accessibility' in Settings",
                            detail: "In the Settings list, tap Accessibility (with the blue figure icon), then scroll down and tap 'Guided Access'.",
                            icon: "figure.arms.open",
                            iconColor: .blue
                        )

                        stepCard(
                            stepNumber: "2",
                            title: "Tap 'Guided Access'",
                            detail: "Turn the switch ON. Tap 'Passcode Settings' to set a parent PIN or enable Face ID.",
                            icon: "lock.shield.fill",
                            iconColor: .green
                        )

                        stepCard(
                            stepNumber: "3",
                            title: "Turn ON 'Accessibility Shortcut'",
                            detail: "This allows you to quickly start Guided Access anytime with a triple-click.",
                            icon: "hand.point.up.left.and.text.fill",
                            iconColor: .orange
                        )

                        stepCard(
                            stepNumber: "4",
                            title: "Triple-Click to Lock In App!",
                            detail: "Return to ToddlerCam, triple-click the Side/Power button, and tap 'Start' in the top right.",
                            icon: "iphone.radiowaves.left.and.right",
                            iconColor: .pink
                        )
                    }

                    // How to Exit Card
                    howToExitCard

                    Spacer(minLength: 30)
                }
                .padding(.vertical, 20)
            }
            .navigationTitle("Toddler Safe Mode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                    .font(.system(size: 16, weight: .bold))
                }
            }
        }
    }

    // MARK: - Live Status Banner
    private var statusBanner: some View {
        HStack(spacing: 16) {
            Image(systemName: guidedManager.isGuidedAccessActive ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                .font(.system(size: 38))
                .foregroundColor(guidedManager.isGuidedAccessActive ? .green : .orange)

            VStack(alignment: .leading, spacing: 4) {
                Text(guidedManager.isGuidedAccessActive ? "Guided Access is ACTIVE" : "Guided Access is OFF")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)

                Text(
                    guidedManager.isGuidedAccessActive
                    ? "Your toddler is safely locked into ToddlerCam! Swipes and hardware buttons are disabled."
                    : "Turn on Guided Access in Settings so your toddler cannot exit the camera or touch other apps."
                )
                .font(.system(size: 13, weight: .regular, design: .rounded))
                .foregroundColor(.secondary)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(guidedManager.isGuidedAccessActive ? Color.green.opacity(0.12) : Color.orange.opacity(0.12))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(guidedManager.isGuidedAccessActive ? Color.green.opacity(0.4) : Color.orange.opacity(0.4), lineWidth: 1.5)
        )
        .padding(.horizontal, 20)
    }

    // MARK: - Why Guided Access
    private var whyGuidedAccessCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "lightbulb.fill")
                    .foregroundColor(.yellow)
                Text("Why Use Guided Access?")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
            }

            VStack(alignment: .leading, spacing: 6) {
                benefitRow(icon: "nosign", text: "Prevents accidental home gestures & app switching")
                benefitRow(icon: "hand.raised.slash.fill", text: "Disables Notification Center & Control Center")
                benefitRow(icon: "speaker.slash.fill", text: "Stops toddlers from pressing Volume or Power buttons")
                benefitRow(icon: "shield.lefthalf.filled", text: "100% guarantee your toddler stays inside ToddlerCam")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(18)
        .padding(.horizontal, 20)
    }

    private func benefitRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.blue)
                .frame(width: 20)
            Text(text)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Step Card
    private func stepCard(stepNumber: String, title: String, detail: String, icon: String, iconColor: Color) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.18))
                    .frame(width: 44, height: 44)
                Text(stepNumber)
                    .font(.system(size: 20, weight: .heavy, design: .rounded))
                    .foregroundColor(iconColor)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)

                Text(detail)
                    .font(.system(size: 14, weight: .regular, design: .rounded))
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(16)
        .padding(.horizontal, 20)
    }

    // MARK: - How to Exit Card
    private var howToExitCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "key.fill")
                    .foregroundColor(.purple)
                Text("How to Exit When Playtime is Over")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
            }

            Text("Whenever you want your phone back, triple-click the Side/Power button, enter your parent PIN or use Face ID, and tap 'End' in the top-left corner.")
                .font(.system(size: 14, weight: .regular, design: .rounded))
                .foregroundColor(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.purple.opacity(0.1))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.purple.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 20)
    }
}
