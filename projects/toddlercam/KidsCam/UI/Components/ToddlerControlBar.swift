import SwiftUI

public struct ToddlerControlBar: View {
    @ObservedObject var cameraManager = DualCameraManager.shared
    let onOpenGallery: () -> Void
    let onOpenParentZone: () -> Void
    var onBackgroundTouch: ((CGPoint) -> Void)? = nil

    @State private var isPressingShutter: Bool = false

    public init(
        onOpenGallery: @escaping () -> Void,
        onOpenParentZone: @escaping () -> Void,
        onBackgroundTouch: ((CGPoint) -> Void)? = nil
    ) {
        self.onOpenGallery = onOpenGallery
        self.onOpenParentZone = onOpenParentZone
        self.onBackgroundTouch = onBackgroundTouch
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Mode Switcher Pill (Photo / Video)
            HStack(spacing: 6) {
                Button(action: {
                    cameraManager.setCaptureMode(.photo)
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("PHOTO")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(cameraManager.captureMode == .photo ? .black : .white.opacity(0.85))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(
                        cameraManager.captureMode == .photo ?
                        LinearGradient(colors: [Color.yellow, Color.orange], startPoint: .top, endPoint: .bottom) :
                        LinearGradient(colors: [Color.clear, Color.clear], startPoint: .top, endPoint: .bottom)
                    )
                    .cornerRadius(16)
                }

                Button(action: {
                    cameraManager.setCaptureMode(.video)
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "video.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("VIDEO")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(cameraManager.captureMode == .video ? .white : .white.opacity(0.85))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(
                        cameraManager.captureMode == .video ?
                        LinearGradient(colors: [Color.red, Color(red: 0.85, green: 0.1, blue: 0.15)], startPoint: .top, endPoint: .bottom) :
                        LinearGradient(colors: [Color.clear, Color.clear], startPoint: .top, endPoint: .bottom)
                    )
                    .cornerRadius(16)
                }
            }
            .padding(3)
            .background(Color.black.opacity(0.50))
            .cornerRadius(18)
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
            )

            // Main Row: Gallery, Giant Shutter, Parent Zone
            HStack(alignment: .center) {
                // Left Group: Gallery Thumbnail
                HStack {
                    Button(action: {
                        SoundEffectManager.shared.play(.pop)
                        onOpenGallery()
                    }) {
                        ZStack {
                            if let latest = cameraManager.latestPhoto {
                                Image(uiImage: latest.compositeImage)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 52, height: 52)
                                    .clipShape(RoundedRectangle(cornerRadius: 16))
                                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white, lineWidth: 3))

                                if cameraManager.latestVideoURL != nil {
                                    VStack {
                                        Spacer()
                                        HStack {
                                            Spacer()
                                            Image(systemName: "video.fill")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundColor(.white)
                                                .padding(4)
                                                .background(Color.red)
                                                .clipShape(Circle())
                                                .offset(x: 4, y: 4)
                                        }
                                    }
                                }
                            } else {
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(Color.white.opacity(0.25))
                                    .frame(width: 52, height: 52)
                                    .overlay(
                                        Image(systemName: "photo.on.rectangle.angled")
                                            .font(.system(size: 22))
                                            .foregroundColor(.white)
                                    )
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Center: GIANT Shutter / Record Button
                Button(action: {
                    if cameraManager.captureMode == .video {
                        cameraManager.toggleVideoRecording()
                    } else {
                        cameraManager.capturePhoto()
                    }
                }) {
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 84, height: 84)
                            .shadow(color: Color.black.opacity(0.3), radius: 10, x: 0, y: 5)

                        if cameraManager.captureMode == .video {
                            if cameraManager.isRecordingVideo {
                                // Recording state: pulsing red ring with stop square
                                Circle()
                                    .stroke(Color.red, lineWidth: 5)
                                    .frame(width: 80, height: 80)

                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color.red)
                                    .frame(width: 32, height: 32)
                            } else {
                                // Idle video state: big red record circle
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: [Color.red, Color(red: 0.85, green: 0.1, blue: 0.15)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 70, height: 70)

                                Image(systemName: "video.fill")
                                    .font(.system(size: 30, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        } else {
                            // Photo state: sunny warm gradient circle
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color(red: 1.0, green: 0.35, blue: 0.38), Color(red: 1.0, green: 0.6, blue: 0.2)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 70, height: 70)

                            Image(systemName: "camera.fill")
                                .font(.system(size: 30, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    .scaleEffect(isPressingShutter ? 0.92 : 1.0)
                }
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in isPressingShutter = true }
                        .onEnded { _ in isPressingShutter = false }
                )

                // Right Group: Parent Zone Button
                HStack {
                    Button(action: {
                        SoundEffectManager.shared.play(.pop)
                        onOpenParentZone()
                    }) {
                        VStack(spacing: 2) {
                            Image(systemName: "gearshape.fill")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(.white)
                            Text("Parents")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                        }
                        .frame(width: 54, height: 54)
                        .background(Color.orange.opacity(0.85))
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white.opacity(0.8), lineWidth: 2))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color.black.opacity(0.55))
        )
        .onTapGesture { location in
            onBackgroundTouch?(location)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
    }
}
