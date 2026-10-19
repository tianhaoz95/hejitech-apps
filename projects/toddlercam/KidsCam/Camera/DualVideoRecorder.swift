import Foundation
import AVFoundation
import UIKit
import Photos

public final class DualVideoRecorder: NSObject {
    public static let shared = DualVideoRecorder()

    public private(set) var isRecording = false
    public private(set) var recordingDuration: TimeInterval = 0

    private var assetWriter: AVAssetWriter?
    private var videoWriterInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var currentVideoURL: URL?

    private var recordingTimer: Timer?
    private var frameCount: Int64 = 0
    private let frameRate: Int32 = 30
    private let recordingQueue = DispatchQueue(label: "com.hejitech.kidscam.videoRecorderQueue")

    public var onDurationUpdate: ((TimeInterval) -> Void)?
    public var onRecordingFinished: ((Result<URL, Error>) -> Void)?

    private override init() {
        super.init()
    }

    public func startRecording(
        videoSize: CGSize = CGSize(width: 720, height: 960),
        onDurationUpdate: @escaping (TimeInterval) -> Void,
        completion: @escaping (Result<URL, Error>) -> Void
    ) {
        guard !isRecording else { return }

        let tempFilename = "DualVideo_\(Int(Date().timeIntervalSince1970))_\(UUID().uuidString.prefix(8)).mp4"
        let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent(tempFilename)

        // Remove old file if it exists
        try? FileManager.default.removeItem(at: outputURL)

        do {
            let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

            let videoSettings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: Int(videoSize.width),
                AVVideoHeightKey: Int(videoSize.height),
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: 2_500_000,
                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
                ]
            ]

            let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
            input.expectsMediaDataInRealTime = true

            let sourceAttrs: [String: Any] = [
                kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
                kCVPixelBufferWidthKey as String: Int(videoSize.width),
                kCVPixelBufferHeightKey as String: Int(videoSize.height)
            ]
            let adaptor = AVAssetWriterInputPixelBufferAdaptor(
                assetWriterInput: input,
                sourcePixelBufferAttributes: sourceAttrs
            )

            guard writer.canAdd(input) else {
                completion(.failure(NSError(domain: "DualVideoRecorder", code: -1, userInfo: [NSLocalizedDescriptionKey: "Cannot add video input to asset writer."])))
                return
            }
            writer.add(input)

            guard writer.startWriting() else {
                completion(.failure(writer.error ?? NSError(domain: "DualVideoRecorder", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to start writing."])))
                return
            }

            writer.startSession(atSourceTime: .zero)

            self.assetWriter = writer
            self.videoWriterInput = input
            self.pixelBufferAdaptor = adaptor
            self.currentVideoURL = outputURL
            self.frameCount = 0
            self.recordingDuration = 0
            self.isRecording = true
            self.onDurationUpdate = onDurationUpdate
            self.onRecordingFinished = completion

            // Append initial frame immediately
            self.appendCompositeFrame(at: .zero, videoSize: videoSize)
            self.frameCount = 1

            // Start 30fps compositing timer on main run loop
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.recordingTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / Double(self.frameRate), repeats: true) { [weak self] _ in
                    self?.recordFrame(videoSize: videoSize)
                }
            }
        } catch {
            completion(.failure(error))
        }
    }

    private func recordFrame(videoSize: CGSize) {
        guard isRecording else { return }

        recordingDuration += (1.0 / Double(frameRate))
        onDurationUpdate?(recordingDuration)

        let presentationTime = CMTime(value: frameCount, timescale: frameRate)
        frameCount += 1

        appendCompositeFrame(at: presentationTime, videoSize: videoSize)
    }

    private func appendCompositeFrame(at presentationTime: CMTime, videoSize: CGSize) {
        recordingQueue.async { [weak self] in
            guard let self = self, let input = self.videoWriterInput, let adaptor = self.pixelBufferAdaptor, input.isReadyForMoreMediaData else {
                return
            }

            let frames = DualCameraManager.shared.getCurrentFrames()
            let primaryPos = DualCameraManager.shared.isDemoMode
                ? (DualCameraManager.shared.demoBabyIsPrimary ? .front : .back)
                : DualCameraManager.shared.primaryPosition

            let composite = DualPhotoRenderer.composeDualPhoto(
                backImage: frames.back,
                frontImage: frames.front,
                primaryPosition: primaryPos,
                filter: FaceTrackingManager.shared.activeFilter
            )

            if let pixelBuffer = DualPhotoRenderer.pixelBuffer(from: composite, size: videoSize) {
                _ = adaptor.append(pixelBuffer, withPresentationTime: presentationTime)
            }
        }
    }

    public func stopRecording() {
        guard isRecording else { return }
        isRecording = false

        recordingTimer?.invalidate()
        recordingTimer = nil

        recordingQueue.async { [weak self] in
            guard let self = self, let writer = self.assetWriter, let input = self.videoWriterInput else { return }
            input.markAsFinished()

            writer.finishWriting { [weak self] in
                guard let self = self, let url = self.currentVideoURL else { return }

                if writer.status == .failed {
                    DispatchQueue.main.async {
                        self.onRecordingFinished?(.failure(writer.error ?? NSError(domain: "DualVideoRecorder", code: -3, userInfo: nil)))
                    }
                    return
                }

                self.saveVideoToPhotoLibrary(videoURL: url)

                DispatchQueue.main.async {
                    self.onRecordingFinished?(.success(url))
                }
            }
        }
    }

    private func saveVideoToPhotoLibrary(videoURL: URL) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { return }
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: videoURL)
                request?.creationDate = Date()
            }, completionHandler: { success, error in
                if let error = error {
                    print("[DualVideoRecorder] PhotoLibrary save error: \(error)")
                }
            })
        }
    }
}
