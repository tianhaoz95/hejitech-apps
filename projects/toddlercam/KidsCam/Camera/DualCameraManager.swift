import Foundation
import AVFoundation
import UIKit
import Photos
import Combine

public enum CameraCaptureMode: String, CaseIterable, Identifiable {
    case photo = "Photo"
    case video = "Video"

    public var id: String { rawValue }

    public var iconName: String {
        switch self {
        case .photo: return "camera.fill"
        case .video: return "video.fill"
        }
    }
}

public enum ActiveCameraPosition {
    case front
    case back
}

public enum CameraPermissionStatus {
    case notDetermined
    case authorized
    case denied
}

public struct CapturedDualPhoto: Identifiable {
    public let id: UUID
    public let timestamp: Date
    public let compositeImage: UIImage
    public let frontImage: UIImage?
    public let backImage: UIImage?

    public init(id: UUID = UUID(), timestamp: Date = Date(), compositeImage: UIImage, frontImage: UIImage? = nil, backImage: UIImage? = nil) {
        self.id = id
        self.timestamp = timestamp
        self.compositeImage = compositeImage
        self.frontImage = frontImage
        self.backImage = backImage
    }
}

public final class DualCameraManager: NSObject, ObservableObject {
    public static let shared = DualCameraManager()

    // Published states
    @Published public var permissionStatus: CameraPermissionStatus = .notDetermined
    @Published public var isRunning: Bool = false
    @Published public var isMultiCamSupported: Bool = false
    @Published public var captureMode: CameraCaptureMode = .photo
    @Published public var primaryPosition: ActiveCameraPosition = .back
    @Published public var isToddlerLocked: Bool = false
    @Published public var latestPhoto: CapturedDualPhoto?
    @Published public var latestVideoURL: URL?
    @Published public var isCapturing: Bool = false
    @Published public var isRecordingVideo: Bool = false
    @Published public var videoRecordingDuration: TimeInterval = 0
    @Published public var activeSticker: String? = nil
    @Published public var showFlashAnimation: Bool = false

    // MultiCam Session & Layers
    public private(set) var multiCamSession: AVCaptureMultiCamSession?
    public private(set) var backPreviewLayer: AVCaptureVideoPreviewLayer?
    public private(set) var frontPreviewLayer: AVCaptureVideoPreviewLayer?
    @Published public var hasPhysicalCameras: Bool = false

    // Real Video Loopers for live footage playback
    public private(set) var frontPlayer: AVQueuePlayer?
    public private(set) var rearPlayer: AVQueuePlayer?
    private var frontLooper: AVPlayerLooper?
    private var rearLooper: AVPlayerLooper?

    // Simulator Real-Time Live Feed Stream
    @Published public var simulatedFrontFrame: UIImage?
    @Published public var simulatedRearFrame: UIImage?
    private var cancellables = Set<AnyCancellable>()

    // Demo Mode (Screenshot Automation)
    @Published public var isDemoMode: Bool = false {
        didSet {
            if isDemoMode {
                updateDemoFrames()
            }
        }
    }
    @Published public var demoBabyIsPrimary: Bool = true
    @Published public var demoBabyFrame: UIImage?
    @Published public var demoNatureFrame: UIImage?

    private var backPhotoOutput: AVCapturePhotoOutput?
    private var frontPhotoOutput: AVCapturePhotoOutput?
    private var frontVideoOutput: AVCaptureVideoDataOutput?
    private var pendingBackPhoto: UIImage?
    private var pendingFrontPhoto: UIImage?
    private let sessionQueue = DispatchQueue(label: "com.hejitech.kidscam.sessionQueue")

    public override init() {
        super.init()
        let isDemoModeArg = CommandLine.arguments.contains("-demoMode") || ProcessInfo.processInfo.environment["DEMO_MODE"] == "1"
        if isDemoModeArg {
            self.isDemoMode = true
        }
        setupVideoLoopers()
        startVideoPlayback()
        setupSimulatorStreamer()
        checkAndRequestCameraPermission()
    }

    public func updateDemoFrames() {
        let baby = DualPhotoRenderer.renderBabyMockImage()
        let nature = DualPhotoRenderer.renderNatureParkMockImage()
        self.demoBabyFrame = baby
        self.demoNatureFrame = nature
        self.demoBabyIsPrimary = true
        FaceTrackingManager.shared.mockBabyFaceDetection()
    }

    private func setupSimulatorStreamer() {
        SimulatorCameraStreamer.shared.$frontFrame
            .receive(on: DispatchQueue.main)
            .sink { [weak self] img in
                self?.simulatedFrontFrame = img
                if let frame = img {
                    FaceTrackingManager.shared.processUIImage(frame)
                }
            }
            .store(in: &cancellables)

        SimulatorCameraStreamer.shared.$rearFrame
            .receive(on: DispatchQueue.main)
            .sink { [weak self] img in
                self?.simulatedRearFrame = img
            }
            .store(in: &cancellables)

        SimulatorCameraStreamer.shared.startStreaming()
    }

    // MARK: - Camera Permission Handling
    public func checkAndRequestCameraPermission() {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .notDetermined:
            self.permissionStatus = .notDetermined
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    self?.permissionStatus = granted ? .authorized : .denied
                    if granted {
                        self?.setupCameras()
                    }
                }
            }
        case .authorized:
            self.permissionStatus = .authorized
            setupCameras()
        case .denied, .restricted:
            self.permissionStatus = .denied
        @unknown default:
            self.permissionStatus = .denied
        }
    }

    public func openSystemSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
    }

    // MARK: - Camera Hardware Setup
    public func setupCameras() {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [
                .builtInWideAngleCamera,
                .builtInUltraWideCamera,
                .builtInTelephotoCamera,
                .continuityCamera,
                .external
            ],
            mediaType: .video,
            position: .unspecified
        )

        let backCamera = discovery.devices.first(where: { $0.position == .back })
        let frontCamera = discovery.devices.first(where: { $0.position == .front })

        if let back = backCamera, let front = frontCamera, AVCaptureMultiCamSession.isMultiCamSupported {
            self.hasPhysicalCameras = true
            self.isMultiCamSupported = true
            setupMultiCamSession(backCamera: back, frontCamera: front)
        } else if let singleCamera = discovery.devices.first {
            self.hasPhysicalCameras = true
            self.isMultiCamSupported = false
            setupSingleCamSession(camera: singleCamera)
        } else {
            // Real continuous video footage loop
            self.hasPhysicalCameras = false
            self.isMultiCamSupported = false
            self.startVideoPlayback()
        }
    }

    private func setupMultiCamSession(backCamera: AVCaptureDevice, frontCamera: AVCaptureDevice) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            let session = AVCaptureMultiCamSession()
            session.beginConfiguration()

            if let backInput = try? AVCaptureDeviceInput(device: backCamera), session.canAddInput(backInput) {
                session.addInputWithNoConnections(backInput)
                if let backPort = backInput.ports(for: .video, sourceDeviceType: backCamera.deviceType, sourceDevicePosition: .back).first {
                    let layer = AVCaptureVideoPreviewLayer(sessionWithNoConnection: session)
                    layer.videoGravity = .resizeAspectFill
                    let conn = AVCaptureConnection(inputPort: backPort, videoPreviewLayer: layer)
                    if session.canAddConnection(conn) {
                        session.addConnection(conn)
                        conn.videoOrientation = .portrait
                        self.backPreviewLayer = layer
                    }

                    let photoOut = AVCapturePhotoOutput()
                    if session.canAddOutput(photoOut) {
                        session.addOutputWithNoConnections(photoOut)
                        let pConn = AVCaptureConnection(inputPorts: [backPort], output: photoOut)
                        if session.canAddConnection(pConn) {
                            session.addConnection(pConn)
                            pConn.videoOrientation = .portrait
                            self.backPhotoOutput = photoOut
                        }
                    }
                }
            }

            if let frontInput = try? AVCaptureDeviceInput(device: frontCamera), session.canAddInput(frontInput) {
                session.addInputWithNoConnections(frontInput)
                if let frontPort = frontInput.ports(for: .video, sourceDeviceType: frontCamera.deviceType, sourceDevicePosition: .front).first {
                    let layer = AVCaptureVideoPreviewLayer(sessionWithNoConnection: session)
                    layer.videoGravity = .resizeAspectFill
                    let conn = AVCaptureConnection(inputPort: frontPort, videoPreviewLayer: layer)
                    if session.canAddConnection(conn) {
                        session.addConnection(conn)
                        conn.videoOrientation = .portrait
                        if conn.isVideoMirroringSupported {
                            conn.automaticallyAdjustsVideoMirroring = false
                            conn.isVideoMirrored = true
                        }
                        self.frontPreviewLayer = layer
                    }

                    let photoOut = AVCapturePhotoOutput()
                    if session.canAddOutput(photoOut) {
                        session.addOutputWithNoConnections(photoOut)
                        let pConn = AVCaptureConnection(inputPorts: [frontPort], output: photoOut)
                        if session.canAddConnection(pConn) {
                            session.addConnection(pConn)
                            pConn.videoOrientation = .portrait
                            if pConn.isVideoMirroringSupported {
                                pConn.automaticallyAdjustsVideoMirroring = false
                                pConn.isVideoMirrored = true
                            }
                            self.frontPhotoOutput = photoOut
                        }
                    }

                    let videoOut = AVCaptureVideoDataOutput()
                    videoOut.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
                    videoOut.alwaysDiscardsLateVideoFrames = true
                    videoOut.setSampleBufferDelegate(self, queue: self.sessionQueue)
                    if session.canAddOutput(videoOut) {
                        session.addOutputWithNoConnections(videoOut)
                        let vConn = AVCaptureConnection(inputPorts: [frontPort], output: videoOut)
                        if session.canAddConnection(vConn) {
                            session.addConnection(vConn)
                            vConn.videoOrientation = .portrait
                            if vConn.isVideoMirroringSupported {
                                vConn.automaticallyAdjustsVideoMirroring = false
                                vConn.isVideoMirrored = true
                            }
                            self.frontVideoOutput = videoOut
                        }
                    }
                }
            }

            session.commitConfiguration()
            self.multiCamSession = session
            session.startRunning()

            DispatchQueue.main.async {
                self.isRunning = session.isRunning
            }
        }
    }

    private func setupSingleCamSession(camera: AVCaptureDevice) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            let session = AVCaptureSession()
            session.beginConfiguration()

            if let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) {
                session.addInput(input)
            }

            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill

            let photoOut = AVCapturePhotoOutput()
            if session.canAddOutput(photoOut) {
                session.addOutput(photoOut)
                self.backPhotoOutput = photoOut
            }

            session.commitConfiguration()
            session.startRunning()

            DispatchQueue.main.async {
                self.backPreviewLayer = layer
                self.frontPreviewLayer = layer
                self.isRunning = session.isRunning
            }
        }
    }

    // MARK: - Video Loopers Setup for Real Video Footage
    private func setupVideoLoopers() {
        if let frontURL = Bundle.main.url(forResource: "front_video", withExtension: "mp4") {
            let asset = AVURLAsset(url: frontURL)
            let item = AVPlayerItem(asset: asset)
            let queuePlayer = AVQueuePlayer(playerItem: item)
            queuePlayer.actionAtItemEnd = .none
            self.frontLooper = AVPlayerLooper(player: queuePlayer, templateItem: item)
            self.frontPlayer = queuePlayer
            queuePlayer.isMuted = true
            queuePlayer.play()
        }

        if let rearURL = Bundle.main.url(forResource: "rear_video", withExtension: "mp4") {
            let asset = AVURLAsset(url: rearURL)
            let item = AVPlayerItem(asset: asset)
            let queuePlayer = AVQueuePlayer(playerItem: item)
            queuePlayer.actionAtItemEnd = .none
            self.rearLooper = AVPlayerLooper(player: queuePlayer, templateItem: item)
            self.rearPlayer = queuePlayer
            queuePlayer.isMuted = true
            queuePlayer.play()
        }
    }

    public func startSession() {
        if hasPhysicalCameras, let session = multiCamSession, !session.isRunning {
            sessionQueue.async {
                session.startRunning()
                DispatchQueue.main.async {
                    self.isRunning = true
                }
            }
        } else {
            startVideoPlayback()
        }
    }

    public func stopSession() {
        if hasPhysicalCameras, let session = multiCamSession, session.isRunning {
            sessionQueue.async {
                session.stopRunning()
                DispatchQueue.main.async {
                    self.isRunning = false
                }
            }
        } else {
            frontPlayer?.pause()
            rearPlayer?.pause()
            self.isRunning = false
        }
    }

    public func startVideoPlayback() {
        frontPlayer?.play()
        rearPlayer?.play()
        self.isRunning = true
    }

    public func swapCameras() {
        SoundEffectManager.shared.play(.pop)
        if isDemoMode {
            demoBabyIsPrimary.toggle()
        }
        primaryPosition = (primaryPosition == .back) ? .front : .back
    }

    public func toggleToddlerLock() {
        isToddlerLocked.toggle()
        if isToddlerLocked {
            SoundEffectManager.shared.play(.horn)
        } else {
            SoundEffectManager.shared.play(.pop)
        }
    }

    public func getCurrentFrames() -> (back: UIImage, front: UIImage) {
        if isDemoMode {
            let babyImg = demoBabyFrame ?? DualPhotoRenderer.renderBabyMockImage()
            let natureImg = demoNatureFrame ?? DualPhotoRenderer.renderNatureParkMockImage()
            return (back: natureImg, front: babyImg)
        } else {
            let backImg = simulatedRearFrame ?? captureCurrentVideoFrame(from: "rear_video") ?? DualPhotoRenderer.renderSimulatedBackCamera()
            let frontImg = simulatedFrontFrame ?? captureCurrentVideoFrame(from: "front_video") ?? DualPhotoRenderer.renderSimulatedFrontCamera()
            return (back: backImg, front: frontImg)
        }
    }

    // MARK: - Mode Switching
    public func setCaptureMode(_ mode: CameraCaptureMode) {
        guard captureMode != mode else { return }
        captureMode = mode
        SoundEffectManager.shared.play(.pop)
        WatchConnectivityManager.shared.syncStateToWatch()
    }

    public func toggleCaptureMode() {
        captureMode = (captureMode == .photo) ? .video : .photo
        SoundEffectManager.shared.play(.pop)
        WatchConnectivityManager.shared.syncStateToWatch()
    }

    // MARK: - Video Recording Pipeline
    public func startVideoRecording() {
        guard !isRecordingVideo else { return }
        isRecordingVideo = true
        videoRecordingDuration = 0
        SoundEffectManager.shared.play(.boing)
        SoundEffectManager.shared.triggerHapticSuccess()
        WatchConnectivityManager.shared.syncStateToWatch()

        DualVideoRecorder.shared.startRecording(
            videoSize: CGSize(width: 720, height: 960),
            onDurationUpdate: { [weak self] duration in
                DispatchQueue.main.async {
                    self?.videoRecordingDuration = duration
                }
            },
            completion: { [weak self] result in
                guard let self = self else { return }
                self.isRecordingVideo = false
                switch result {
                case .success(let url):
                    self.latestVideoURL = url
                    SoundEffectManager.shared.triggerHapticSuccess()
                case .failure(let error):
                    print("[DualCameraManager] Video recording error: \(error)")
                }
                WatchConnectivityManager.shared.syncStateToWatch()
            }
        )
    }

    public func stopVideoRecording() {
        guard isRecordingVideo else { return }
        isRecordingVideo = false
        SoundEffectManager.shared.play(.pop)
        DualVideoRecorder.shared.stopRecording()
    }

    public func toggleVideoRecording() {
        if isRecordingVideo {
            stopVideoRecording()
        } else {
            startVideoRecording()
        }
    }

    // MARK: - Capture Photo Pipeline
    public func capturePhoto() {
        if captureMode == .video {
            toggleVideoRecording()
            return
        }

        guard !isCapturing else { return }
        isCapturing = true
        showFlashAnimation = true

        SoundEffectManager.shared.play(.shutter)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.showFlashAnimation = false
        }

        if isDemoMode {
            captureFromDemoMode()
        } else if hasPhysicalCameras, isMultiCamSupported, let backOut = backPhotoOutput, let frontOut = frontPhotoOutput {
            let backSettings = AVCapturePhotoSettings()
            let frontSettings = AVCapturePhotoSettings()
            pendingBackPhoto = nil
            pendingFrontPhoto = nil
            backOut.capturePhoto(with: backSettings, delegate: self)
            frontOut.capturePhoto(with: frontSettings, delegate: self)
        } else {
            captureFromVideoFootage()
        }
    }

    private func captureFromDemoMode() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let babyImg = self.demoBabyFrame ?? DualPhotoRenderer.renderBabyMockImage()
            let natureImg = self.demoNatureFrame ?? DualPhotoRenderer.renderNatureParkMockImage()

            let composite = DualPhotoRenderer.composeDualPhoto(
                backImage: natureImg,
                frontImage: babyImg,
                primaryPosition: self.demoBabyIsPrimary ? .front : .back,
                filter: FaceTrackingManager.shared.activeFilter
            )

            let photo = CapturedDualPhoto(
                compositeImage: composite,
                frontImage: babyImg,
                backImage: natureImg
            )
            self.saveToPhotoLibrary(photo: photo)

            DispatchQueue.main.async {
                self.latestPhoto = photo
                self.isCapturing = false
                SoundEffectManager.shared.triggerHapticSuccess()
            }
        }
    }

    private func captureFromVideoFootage() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let backImg = self.simulatedRearFrame ?? self.captureCurrentVideoFrame(from: "rear_video") ?? DualPhotoRenderer.renderSimulatedBackCamera()
            let frontImg = self.simulatedFrontFrame ?? self.captureCurrentVideoFrame(from: "front_video") ?? DualPhotoRenderer.renderSimulatedFrontCamera()

            let composite = DualPhotoRenderer.composeDualPhoto(
                backImage: backImg,
                frontImage: frontImg,
                primaryPosition: self.primaryPosition
            )

            let photo = CapturedDualPhoto(compositeImage: composite, frontImage: frontImg, backImage: backImg)
            self.saveToPhotoLibrary(photo: photo)

            DispatchQueue.main.async {
                self.latestPhoto = photo
                self.isCapturing = false
                SoundEffectManager.shared.triggerHapticSuccess()
            }
        }
    }

    private func captureCurrentVideoFrame(from resource: String) -> UIImage? {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "mp4") else { return nil }
        let asset = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        let time = CMTime(seconds: Double.random(in: 0.5...4.0), preferredTimescale: 600)
        if let cg = try? generator.copyCGImage(at: time, actualTime: nil) {
            return UIImage(cgImage: cg)
        }
        return nil
    }

    private func finishCaptureIfNeeded() {
        guard let back = pendingBackPhoto, let front = pendingFrontPhoto else { return }
        let composite = DualPhotoRenderer.composeDualPhoto(
            backImage: back,
            frontImage: front,
            primaryPosition: self.primaryPosition
        )

        let photo = CapturedDualPhoto(compositeImage: composite, frontImage: front, backImage: back)
        saveToPhotoLibrary(photo: photo)

        DispatchQueue.main.async {
            self.latestPhoto = photo
            self.isCapturing = false
            self.pendingBackPhoto = nil
            self.pendingFrontPhoto = nil
            SoundEffectManager.shared.triggerHapticSuccess()
        }
    }

    private func saveToPhotoLibrary(photo: CapturedDualPhoto) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { return }
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetChangeRequest.creationRequestForAsset(from: photo.compositeImage)
                request.creationDate = photo.timestamp
            }, completionHandler: { success, error in
                if let error = error {
                    print("[DualCameraManager] PhotoLibrary save error: \(error)")
                }
            })
        }
    }
}

extension DualCameraManager: AVCapturePhotoCaptureDelegate {
    public func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else {
            self.isCapturing = false
            return
        }

        if output == self.backPhotoOutput {
            self.pendingBackPhoto = image
        } else if output == self.frontPhotoOutput {
            self.pendingFrontPhoto = image
        }

        finishCaptureIfNeeded()
    }
}

extension DualCameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        FaceTrackingManager.shared.processSampleBuffer(sampleBuffer, orientation: .up)
    }
}
