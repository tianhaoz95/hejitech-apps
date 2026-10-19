import SwiftUI
import AVFoundation

public struct DualCameraPreviewView: View {
    @ObservedObject var cameraManager = DualCameraManager.shared
    public var onBackgroundTouch: ((CGPoint) -> Void)? = nil

    public init(onBackgroundTouch: ((CGPoint) -> Void)? = nil) {
        self.onBackgroundTouch = onBackgroundTouch
    }

    public var body: some View {
        GeometryReader { geo in
            ZStack {
                if cameraManager.permissionStatus == .denied {
                    permissionDeniedView
                } else {
                    pipLayout(geo: geo)
                }

                // White flash overlay when capturing
                if cameraManager.showFlashAnimation {
                    Color.white
                        .ignoresSafeArea()
                        .transition(.opacity)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
    }

    // MARK: - Permission Denied View
    private var permissionDeniedView: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)

            VStack(spacing: 20) {
                Image(systemName: "camera.badge.ellipsis")
                    .font(.system(size: 64))
                    .foregroundColor(.yellow)

                Text("Camera Access Needed")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundColor(.white)

                Text("ToddlerCam needs camera permission so your toddler can explore photography with dual-camera view.")
                    .font(.system(size: 15, weight: .regular, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.horizontal, 32)

                Button(action: {
                    cameraManager.openSystemSettings()
                }) {
                    HStack {
                        Image(systemName: "gear")
                        Text("Enable Camera in Settings")
                    }
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 14)
                    .background(Color.blue)
                    .cornerRadius(16)
                }
                .padding(.top, 10)
            }
            .padding(24)
        }
    }

    // MARK: - Picture-in-Picture Layout
    @ViewBuilder
    private func pipLayout(geo: GeometryProxy) -> some View {
        let screenSize = geo.size
        let pipWidth: CGFloat = screenSize.width * 0.35
        let pipHeight: CGFloat = pipWidth * 1.33
        let secondaryPos: ActiveCameraPosition = (cameraManager.primaryPosition == .back) ? .front : .back
        let topOffset: CGFloat = max(geo.safeAreaInsets.top, 48) + 90

        ZStack {
            // Main Fullscreen Feed - Fills 100% of the display edge-to-edge
            cameraFeed(position: cameraManager.primaryPosition, isPrimary: true, targetSize: screenSize)
                .frame(width: screenSize.width, height: screenSize.height)
                .contentShape(Rectangle())
                .onTapGesture { location in
                    onBackgroundTouch?(location)
                }
                .clipped()

            // Floating Secondary PiP Feed
            VStack {
                HStack {
                    Spacer()
                    ZStack {
                        cameraFeed(position: secondaryPos, isPrimary: false, targetSize: CGSize(width: pipWidth, height: pipHeight))
                            .frame(width: pipWidth, height: pipHeight)
                            .cornerRadius(24)
                            .overlay(
                                RoundedRectangle(cornerRadius: 24)
                                    .stroke(Color.yellow, lineWidth: 4)
                            )
                            .shadow(color: Color.black.opacity(0.35), radius: 10, x: 0, y: 5)
                            .onTapGesture {
                                cameraManager.swapCameras()
                            }

                        // Swap icon hint badge in bottom-right corner of PiP
                        VStack {
                            Spacer()
                            HStack {
                                Spacer()
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(7)
                                    .background(Color.black.opacity(0.65))
                                    .clipShape(Circle())
                                    .padding(8)
                            }
                        }
                    }
                    .frame(width: pipWidth, height: pipHeight)
                    .padding(.trailing, 16)
                    .padding(.top, topOffset)
                }
                Spacer()
            }
        }
        .frame(width: screenSize.width, height: screenSize.height)
    }

    // MARK: - Camera Feed (Demo Mode, Physical Hardware, or Simulator Stream)
    @ViewBuilder
    private func cameraFeed(position: ActiveCameraPosition, isPrimary: Bool, targetSize: CGSize) -> some View {
        let isBaby = cameraManager.isDemoMode ? (isPrimary == cameraManager.demoBabyIsPrimary) : (position == .front)

        ZStack {
            if cameraManager.isDemoMode {
                if isBaby {
                    demoBabyFeed(targetSize: targetSize)
                } else {
                    demoNatureFeed(targetSize: targetSize)
                }
            } else if cameraManager.hasPhysicalCameras {
                if position == .back, let layer = cameraManager.backPreviewLayer {
                    CaptureVideoPreview(previewLayer: layer)
                        .frame(width: targetSize.width, height: targetSize.height)
                } else if position == .front, let layer = cameraManager.frontPreviewLayer {
                    CaptureVideoPreview(previewLayer: layer)
                        .frame(width: targetSize.width, height: targetSize.height)
                } else {
                    simulatorOrFallbackFeed(position: position, targetSize: targetSize)
                }
            } else {
                simulatorOrFallbackFeed(position: position, targetSize: targetSize)
            }

            // Face Tracking Emoji Mask (Native Apple Vision Framework)
            // Follows whichever view hosts the baby / front face
            if isBaby {
                FaceTrackingEmojiOverlayView(isPrimary: isPrimary)
                    .frame(width: targetSize.width, height: targetSize.height)
            }
        }
    }

    @ViewBuilder
    private func demoBabyFeed(targetSize: CGSize) -> some View {
        let img = cameraManager.demoBabyFrame ?? DualPhotoRenderer.renderBabyMockImage()
        let isLarge = targetSize.width > 300
        ZStack(alignment: .bottom) {
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: targetSize.width, height: targetSize.height)
                .clipped()


            if !isLarge {
                // Compact badge inside PiP window
                HStack(spacing: 3) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 8, weight: .bold))
                    Text("AI-Generated")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(Color.black.opacity(0.70))
                .cornerRadius(6)
                .padding(.bottom, 6)
            }
        }
    }

    @ViewBuilder
    private func demoNatureFeed(targetSize: CGSize) -> some View {
        let img = cameraManager.demoNatureFrame ?? DualPhotoRenderer.renderNatureParkMockImage()
        Image(uiImage: img)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: targetSize.width, height: targetSize.height)
            .clipped()
    }

    @ViewBuilder
    private func simulatorOrFallbackFeed(position: ActiveCameraPosition, targetSize: CGSize) -> some View {
        if position == .front, let img = cameraManager.simulatedFrontFrame {
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: targetSize.width, height: targetSize.height)
                .clipped()
        } else if position == .back, let img = cameraManager.simulatedRearFrame {
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: targetSize.width, height: targetSize.height)
                .clipped()
        } else if position == .front, let player = cameraManager.frontPlayer {
            LooperVideoPlayerView(player: player)
                .frame(width: targetSize.width, height: targetSize.height)
                .clipped()
        } else if position == .back, let player = cameraManager.rearPlayer {
            LooperVideoPlayerView(player: player)
                .frame(width: targetSize.width, height: targetSize.height)
                .clipped()
        } else {
            Color.black
                .frame(width: targetSize.width, height: targetSize.height)
        }
    }
}

// MARK: - Real Video Player UIViewRepresentable
public struct LooperVideoPlayerView: UIViewRepresentable {
    public let player: AVPlayer

    public init(player: AVPlayer) {
        self.player = player
    }

    public func makeUIView(context: Context) -> PlayerUIView {
        let view = PlayerUIView()
        view.player = player
        return view
    }

    public func updateUIView(_ uiView: PlayerUIView, context: Context) {
        uiView.player = player
    }
}

public final class PlayerUIView: UIView {
    public override static var layerClass: AnyClass {
        return AVPlayerLayer.self
    }

    public var playerLayer: AVPlayerLayer {
        return layer as! AVPlayerLayer
    }

    public var player: AVPlayer? {
        get { playerLayer.player }
        set {
            playerLayer.player = newValue
            playerLayer.videoGravity = .resizeAspectFill
        }
    }
}

// MARK: - Hardware Capture Video Preview
public struct CaptureVideoPreview: UIViewRepresentable {
    public let previewLayer: AVCaptureVideoPreviewLayer

    public init(previewLayer: AVCaptureVideoPreviewLayer) {
        self.previewLayer = previewLayer
    }

    public func makeUIView(context: Context) -> PreviewUIView {
        let view = PreviewUIView()
        view.previewLayer = previewLayer
        return view
    }

    public func updateUIView(_ uiView: PreviewUIView, context: Context) {
        uiView.updateLayerFrame()
    }
}

public final class PreviewUIView: UIView {
    public var previewLayer: AVCaptureVideoPreviewLayer? {
        didSet {
            oldValue?.removeFromSuperlayer()
            if let layer = previewLayer {
                layer.videoGravity = .resizeAspectFill
                self.layer.addSublayer(layer)
                setNeedsLayout()
            }
        }
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        updateLayerFrame()
    }

    public func updateLayerFrame() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        previewLayer?.frame = self.bounds
        CATransaction.commit()
    }
}
