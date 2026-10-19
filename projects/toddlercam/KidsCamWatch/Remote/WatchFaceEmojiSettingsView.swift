import SwiftUI

public struct WatchFaceEmojiSettingsView: View {
    @ObservedObject var sessionManager = WatchSessionManager.shared

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                // Header / Active Status Banner
                VStack(spacing: 2) {
                    Text("Face Tracking Masks")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    Text("Tracks toddler's face via Apple Vision")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 4)

                // Clear / Off Option Button
                Button(action: {
                    sessionManager.setFaceEmojiFilter(nil)
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(sessionManager.activeFaceEmoji == "none" ? .green : .secondary)

                        Text("No Mask (Clean Face)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(.white)

                        Spacer()

                        if sessionManager.activeFaceEmoji == "none" {
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.green)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(sessionManager.activeFaceEmoji == "none" ? Color.green.opacity(0.2) : Color.white.opacity(0.1))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(sessionManager.activeFaceEmoji == "none" ? Color.green : Color.clear, lineWidth: 1.5)
                    )
                }
                .buttonStyle(PlainButtonStyle())

                // Grid of Emojis
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(FaceEmojiType.allCases) { filter in
                        let isSelected = (sessionManager.activeFaceEmoji == filter.rawValue)

                        Button(action: {
                            sessionManager.setFaceEmojiFilter(filter)
                        }) {
                            VStack(spacing: 4) {
                                Text(filter.emoji)
                                    .font(.system(size: 28))

                                Text(filter.displayName)
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(isSelected ? Color.blue.opacity(0.35) : Color.white.opacity(0.1))
                            .cornerRadius(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(isSelected ? Color.blue : Color.white.opacity(0.15), lineWidth: isSelected ? 2 : 1)
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 12)
        }
        .navigationTitle("Face Masks")
    }
}
