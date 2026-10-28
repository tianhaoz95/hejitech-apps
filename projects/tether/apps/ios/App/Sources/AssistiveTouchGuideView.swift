import SwiftUI
import UIKit

/// Comprehensive guide and instructions for using a physical Bluetooth or USB-C mouse
/// or trackpad with Tether on iPhone using iOS AssistiveTouch.
@MainActor
public struct AssistiveTouchGuideView: View {
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.22, green: 0.74, blue: 0.97).opacity(0.18))
                                    .frame(width: 48, height: 48)
                                Image(systemName: "computermouse.fill")
                                    .font(.system(size: 24, weight: .semibold))
                                    .foregroundStyle(Color(red: 0.22, green: 0.74, blue: 0.97))
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Physical Mouse & Trackpad")
                                    .font(.headline)
                                Text("Powered by iOS AssistiveTouch")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Text("Connect any Bluetooth or USB-C mouse or trackpad to your iPhone. iOS uses AssistiveTouch to bridge physical pointer devices into Tether's desktop workspace.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("3-Step Quick Setup") {
                    GuideStepRow(
                        step: "1",
                        icon: "cable.connector",
                        title: "Connect Mouse or Trackpad",
                        description: "Pair your Bluetooth mouse (e.g. Magic Mouse, Logitech MX) in iOS Bluetooth Settings, or plug your USB mouse / trackpad into your USB-C dock."
                    )

                    GuideStepRow(
                        step: "2",
                        icon: "hand.point.up.left.fill",
                        title: "Turn ON AssistiveTouch",
                        description: "Go to iOS Settings → Accessibility → Touch → AssistiveTouch and toggle it ON. The iOS circular mouse pointer will immediately appear."
                    )

                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack {
                            Image(systemName: "gearshape.fill")
                            Text("Open iOS Settings")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }

                    GuideStepRow(
                        step: "3",
                        icon: "display",
                        title: "Drive the External Monitor",
                        description: "Move your mouse over Tether's phone controller to control the high-precision cursor on your external monitor. Click to interact, scroll wheel to scroll, and drag to resize."
                    )
                }

                Section("Recommended Tuning for Tether") {
                    SettingTipRow(
                        icon: "eye.slash.fill",
                        title: "Hide Floating Menu Button",
                        settingPath: "AssistiveTouch → Always Show Menu",
                        instruction: "Turn Always Show Menu to OFF. This hides the floating black circular button on your phone while keeping mouse pointer tracking 100% active."
                    )

                    SettingTipRow(
                        icon: "hare.fill",
                        title: "Speed Up Pointer Tracking",
                        settingPath: "AssistiveTouch → Tracking Sensitivity",
                        instruction: "Move the slider towards the Hare (faster). This allows effortless cursor traversal across 4K and ultrawide external displays."
                    )

                    SettingTipRow(
                        icon: "hand.tap.fill",
                        title: "Enable Drag & Touch Gestures",
                        settingPath: "AssistiveTouch → Perform Touch Gestures",
                        instruction: "Ensure Perform Touch Gestures is ON so clicking, dragging pane dividers, and smooth scrolling pass through cleanly."
                    )

                    SettingTipRow(
                        icon: "slider.horizontal.2.square",
                        title: "Customize Mouse Buttons",
                        settingPath: "AssistiveTouch → Pointer Devices → Devices",
                        instruction: "Tap your mouse to customize buttons: Button 1 for Single-Tap, Button 2 (Right-Click) for Long Press / Secondary Click, Button 3 (Wheel) for Spotlight."
                    )
                }

                Section("Mouse Controls & Shortcuts in Tether") {
                    MouseShortcutRow(keys: "Left Click", desc: "Focus web inputs, click buttons, select tabs, activate terminal")
                    MouseShortcutRow(keys: "Click + Drag", desc: "Drag pane split borders to resize windows in real time")
                    MouseShortcutRow(keys: "Scroll Wheel", desc: "Smooth continuous vertical/horizontal scroll in web, terminal, and files")
                    MouseShortcutRow(keys: "⌘K / Ctrl+K", desc: "Open Command Palette without needing to reach for mouse")
                    MouseShortcutRow(keys: "Right Click", desc: "Secondary action or dismiss popup / back")
                }
            }
            .navigationTitle("AssistiveTouch Setup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct GuideStepRow: View {
    let step: String
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.15))
                    .frame(width: 28, height: 28)
                Text(step)
                    .font(.caption.bold())
                    .foregroundStyle(.blue)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: icon)
                        .font(.caption)
                        .foregroundStyle(.blue)
                    Text(title)
                        .font(.subheadline.bold())
                }
                Text(description)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct SettingTipRow: View {
    let icon: String
    let title: String
    let settingPath: String
    let instruction: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.subheadline)
                    .foregroundStyle(.yellow)
                Text(title)
                    .font(.subheadline.bold())
            }
            Text(settingPath)
                .font(.caption2.monospaced())
                .foregroundStyle(.blue)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.blue.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 4))
            Text(instruction)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }
}

private struct MouseShortcutRow: View {
    let keys: String
    let desc: String
    var body: some View {
        HStack {
            Text(keys)
                .font(.caption.monospaced().bold())
            Spacer()
            Text(desc)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
