import SwiftUI

public struct WatchPhotoReviewView: View {
    @ObservedObject var sessionManager = WatchSessionManager.shared

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let thumb = sessionManager.lastPhotoThumbnail {
                    Image(uiImage: thumb)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .cornerRadius(12)
                        .shadow(radius: 4)

                    Text("📸 Just Captured!")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.green)

                    Text("Dual photo saved directly to phone Photos.")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "photo.badge.arrow.down")
                            .font(.system(size: 36))
                            .foregroundColor(.secondary)

                        Text("No Photo Yet")
                            .font(.system(size: 14, weight: .bold, design: .rounded))

                        Text("Tap the Shutter button on your watch to take a photo on the phone.")
                            .font(.system(size: 11, weight: .regular, design: .rounded))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 20)
                }
            }
            .padding(.horizontal, 8)
        }
        .navigationTitle("Last Photo")
    }
}
