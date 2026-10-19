import SwiftUI
import AVKit

public struct PhotoGalleryView: View {
    @ObservedObject var cameraManager = DualCameraManager.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var selectedPhoto: CapturedDualPhoto?
    @State private var isShowingShareSheet = false
    @State private var isShowingVideoShareSheet = false
    @State private var videoToShare: URL?

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                // Latest Video Section
                if let videoURL = cameraManager.latestVideoURL {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Image(systemName: "video.fill")
                                .foregroundColor(.red)
                            Text("Latest Dual Video")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                        }
                        .padding(.horizontal, 20)

                        ZStack(alignment: .bottomTrailing) {
                            VideoPlayer(player: AVPlayer(url: videoURL))
                                .frame(height: 340)
                                .cornerRadius(20)
                                .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 4)

                            Button(action: {
                                videoToShare = videoURL
                                isShowingVideoShareSheet = true
                            }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "square.and.arrow.up")
                                    Text("Share Video")
                                }
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.black.opacity(0.65))
                                .cornerRadius(14)
                            }
                            .padding(14)
                        }
                        .padding(.horizontal, 20)

                        Divider().padding(.vertical, 8)
                    }
                }

                // Latest Photo Section
                if let photo = cameraManager.latestPhoto {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Image(systemName: "camera.fill")
                                .foregroundColor(.orange)
                            Text("Latest Dual Shot")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                        }
                        .padding(.horizontal, 20)

                        ZStack(alignment: .bottomTrailing) {
                            Image(uiImage: photo.compositeImage)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .cornerRadius(20)
                                .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 4)
                                .onTapGesture {
                                    selectedPhoto = photo
                                }

                            Button(action: {
                                isShowingShareSheet = true
                            }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "square.and.arrow.up")
                                    Text("Share")
                                }
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.black.opacity(0.65))
                                .cornerRadius(14)
                            }
                            .padding(14)
                        }
                        .padding(.horizontal, 20)

                        Divider().padding(.vertical, 8)
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Toddler Gallery Tips")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .padding(.horizontal, 20)

                    HStack(spacing: 14) {
                        Image(systemName: "photo.stack.fill")
                            .font(.system(size: 30))
                            .foregroundColor(.orange)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Automatic Camera Roll Save")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                            Text("All photos and videos taken in ToddlerCam are automatically saved in full quality to your iPhone Photos library.")
                                .font(.system(size: 13, weight: .regular, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(16)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(16)
                    .padding(.horizontal, 20)
                }

                Spacer(minLength: 30)
            }
            .navigationTitle("Toddler Memories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                    .font(.system(size: 16, weight: .bold))
                }
            }
            .sheet(isPresented: $isShowingShareSheet) {
                if let photo = cameraManager.latestPhoto {
                    ShareSheet(activityItems: [photo.compositeImage])
                }
            }
            .sheet(isPresented: $isShowingVideoShareSheet) {
                if let url = videoToShare {
                    ShareSheet(activityItems: [url])
                }
            }
        }
    }
}

public struct ShareSheet: UIViewControllerRepresentable {
    public let activityItems: [Any]

    public func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    public func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
