import SwiftUI

public struct WatchFaceStudioView: View {
    @ObservedObject var watchManager = WatchFaceManager.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var showSyncConfirmation = false

    private let colorChoices: [(String, Color, UIColor)] = [
        ("White", .white, .white),
        ("Gold", Color(red: 1.0, green: 0.84, blue: 0.0), UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 1.0)),
        ("Coral", Color(red: 1.0, green: 0.45, blue: 0.45), UIColor(red: 1.0, green: 0.45, blue: 0.45, alpha: 1.0)),
        ("Cyan", Color(red: 0.3, green: 0.85, blue: 0.95), UIColor(red: 0.3, green: 0.85, blue: 0.95, alpha: 1.0)),
        ("Lime", Color(red: 0.6, green: 0.95, blue: 0.4), UIColor(red: 0.6, green: 0.95, blue: 0.4, alpha: 1.0)),
        ("Lilac", Color(red: 0.85, green: 0.7, blue: 1.0), UIColor(red: 0.85, green: 0.7, blue: 1.0, alpha: 1.0))
    ]

    public init(initialTab: Int = 0) {}

    public var body: some View {
        NavigationView {
            ScrollView {
                complicationsSettingsView
            }
            .navigationTitle("Watch Complications")
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

    // MARK: - Complications Settings
    private var complicationsSettingsView: some View {
        VStack(spacing: 20) {
            // Quick launcher hero card
            VStack(spacing: 12) {
                Image(systemName: "applewatch.side.right")
                    .font(.system(size: 42))
                    .foregroundColor(.blue)

                Text("Watch Face Remote Shortcut")
                    .font(.system(size: 20, weight: .bold, design: .rounded))

                Text("Add the ToddlerCam complication to any Apple Watch face to take photos or make animal sounds with a single tap on your wrist!")
                    .font(.system(size: 14, weight: .regular, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 10)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(20)
            .padding(.horizontal, 20)

            // Complication Action Selector
            VStack(alignment: .leading, spacing: 14) {
                Text("Select Default Complication Action")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .padding(.horizontal, 20)

                ForEach(WatchComplicationStyle.allCases) { style in
                    Button(action: {
                        SoundEffectManager.shared.play(.pop)
                        watchManager.selectedComplication = style
                        watchManager.syncComplicationSettingsToWatch()
                        showSyncConfirmation = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            showSyncConfirmation = false
                        }
                    }) {
                        HStack(spacing: 16) {
                            Image(systemName: style.iconName)
                                .font(.system(size: 24))
                                .foregroundColor(watchManager.selectedComplication == style ? .white : .blue)
                                .frame(width: 40, height: 40)
                                .background(
                                    Circle().fill(watchManager.selectedComplication == style ? Color.blue : Color.blue.opacity(0.12))
                                )

                            VStack(alignment: .leading, spacing: 2) {
                                Text(style.rawValue)
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(.primary)

                                Text(complicationDescription(style))
                                    .font(.system(size: 13, weight: .regular, design: .rounded))
                                    .foregroundColor(.secondary)
                            }

                            Spacer()

                            if watchManager.selectedComplication == style {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                    .font(.system(size: 22))
                            }
                        }
                        .padding(14)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(watchManager.selectedComplication == style ? Color.blue : Color.clear, lineWidth: 2)
                        )
                        .padding(.horizontal, 20)
                    }
                }
            }

            // Complication Accent Color Theme
            VStack(alignment: .leading, spacing: 12) {
                Text("Complication Tint Color")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .padding(.horizontal, 20)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(colorChoices, id: \.0) { choice in
                            Button(action: {
                                SoundEffectManager.shared.play(.pop)
                                watchManager.selectedComplicationColor = choice.2
                                watchManager.syncComplicationSettingsToWatch()
                            }) {
                                VStack(spacing: 6) {
                                    Circle()
                                        .fill(choice.1)
                                        .frame(width: 38, height: 38)
                                        .overlay(
                                            Circle()
                                                .stroke(watchManager.selectedComplicationColor == choice.2 ? Color.blue : Color.secondary.opacity(0.3), lineWidth: 3)
                                        )
                                    Text(choice.0)
                                        .font(.system(size: 12, weight: .medium, design: .rounded))
                                        .foregroundColor(.primary)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }

            if showSyncConfirmation {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Synced to Apple Watch!")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(.green)
                }
                .transition(.opacity)
            }

            // Open Apple Watch App Button
            Button(action: {
                SoundEffectManager.shared.play(.pop)
                watchManager.openAppleWatchApp()
            }) {
                HStack {
                    Image(systemName: "applewatch")
                        .font(.system(size: 20, weight: .bold))
                    Text("Open Watch App on iPhone")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.blue)
                .cornerRadius(18)
                .padding(.horizontal, 20)
            }

            // How to add complication tutorial
            howToAddComplicationCard
                .padding(.horizontal, 20)

            Spacer(minLength: 30)
        }
        .padding(.vertical, 16)
    }

    private func complicationDescription(_ style: WatchComplicationStyle) -> String {
        switch style {
        case .quickShutter: return "One-tap trigger to capture photo immediately"
        case .animalSound: return "Instantly play puppy/duck sound to grab kid's gaze"
        case .cameraRemote: return "Launch full ToddlerCam Remote on your watch"
        case .liveStatus: return "Show ToddlerCam connection & battery status"
        }
    }

    // MARK: - How to Add Complication Card
    private var howToAddComplicationCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(.blue)
                Text("How to Add to Your Watch Face")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("1. Firmly press and hold your Apple Watch face display.")
                Text("2. Tap 'Edit' and swipe over to the Complications screen.")
                Text("3. Tap any complication slot and scroll to find 'ToddlerCam'.")
                Text("4. Press the Digital Crown to save and enjoy quick remote control!")
            }
            .font(.system(size: 13, weight: .regular, design: .rounded))
            .foregroundColor(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(18)
    }
}
