import Foundation
import UIKit
import Vision
import CoreMedia
import ImageIO
import Combine

public final class FaceTrackingManager: ObservableObject {
    public static let shared = FaceTrackingManager()

    // MARK: - Published State
    @Published public var activeFilter: FaceEmojiType? = nil
    @Published public var isFaceDetected: Bool = false
    @Published public var normalizedFaceRect: CGRect = CGRect(x: 0.275, y: 0.30, width: 0.45, height: 0.42)
    @Published public var eyesCenterNormalized: CGPoint? = nil
    @Published public var foreheadCenterNormalized: CGPoint? = nil
    @Published public var headRoll: Double = 0.0 // Head tilt in radians
    @Published public var headYaw: Double = 0.0  // Face turn in radians
    @Published public var lastImageSize: CGSize = CGSize(width: 800, height: 1000)

    private let visionQueue = DispatchQueue(label: "com.hejitech.kidscam.visionQueue", qos: .userInteractive)
    private var isProcessingFrame = false

    // Exponential smoothing factor for silky responsive movement without jitter
    private let smoothingAlpha: CGFloat = 0.45

    private init() {}

    // MARK: - Configuration
    public func setActiveFilter(_ filter: FaceEmojiType?) {
        if Thread.isMainThread {
            self.activeFilter = filter
        } else {
            DispatchQueue.main.async {
                self.activeFilter = filter
            }
        }
    }

    public func clearFilter() {
        if Thread.isMainThread {
            self.activeFilter = nil
            self.isFaceDetected = false
        } else {
            DispatchQueue.main.async {
                self.activeFilter = nil
                self.isFaceDetected = false
            }
        }
    }

    // MARK: - Demo Mode / Mock Face Detection
    public func mockBabyFaceDetection() {
        self.isFaceDetected = true
        self.normalizedFaceRect = CGRect(x: 0.356, y: 0.303, width: 0.287, height: 0.215)
        self.eyesCenterNormalized = CGPoint(x: 0.50, y: 0.389)
        self.foreheadCenterNormalized = CGPoint(x: 0.50, y: 0.26)
        self.headRoll = 0.0
        self.headYaw = 0.0
        self.lastImageSize = CGSize(width: 800, height: 1200)
    }

    // MARK: - Frame Processing (CMSampleBuffer)
    public func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, orientation: CGImagePropertyOrientation = .up) {
        guard activeFilter != nil else { return }
        guard !isProcessingFrame else { return }

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        if width > 0 && height > 0 {
            DispatchQueue.main.async {
                self.lastImageSize = CGSize(width: width, height: height)
            }
        }

        isProcessingFrame = true
        visionQueue.async { [weak self] in
            guard let self = self else { return }
            defer { self.isProcessingFrame = false }

            let requestHandler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:])
            self.performFaceTrackingRequests(handler: requestHandler)
        }
    }

    // MARK: - Frame Processing (CGImage / UIImage)
    public func processCGImage(_ cgImage: CGImage, orientation: CGImagePropertyOrientation = .up) {
        guard activeFilter != nil else { return }
        guard !isProcessingFrame else { return }

        let width = cgImage.width
        let height = cgImage.height
        if width > 0 && height > 0 {
            DispatchQueue.main.async {
                self.lastImageSize = CGSize(width: width, height: height)
            }
        }

        isProcessingFrame = true
        visionQueue.async { [weak self] in
            guard let self = self else { return }
            defer { self.isProcessingFrame = false }

            let requestHandler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
            self.performFaceTrackingRequests(handler: requestHandler)
        }
    }

    public func processUIImage(_ image: UIImage) {
        guard activeFilter != nil else { return }

        let cg: CGImage?
        if let direct = image.cgImage {
            cg = direct
        } else if let ci = image.ciImage {
            let ctx = CIContext(options: [CIContextOption.useSoftwareRenderer: false])
            cg = ctx.createCGImage(ci, from: ci.extent)
        } else {
            UIGraphicsBeginImageContextWithOptions(image.size, false, image.scale)
            image.draw(in: CGRect(origin: .zero, size: image.size))
            cg = UIGraphicsGetImageFromCurrentImageContext()?.cgImage
            UIGraphicsEndImageContext()
        }

        guard let validCG = cg else { return }

        let orientation: CGImagePropertyOrientation
        switch image.imageOrientation {
        case .up: orientation = .up
        case .down: orientation = .down
        case .left: orientation = .left
        case .right: orientation = .right
        case .upMirrored: orientation = .upMirrored
        case .downMirrored: orientation = .downMirrored
        case .leftMirrored: orientation = .leftMirrored
        case .rightMirrored: orientation = .rightMirrored
        @unknown default: orientation = .up
        }

        processCGImage(validCG, orientation: orientation)
    }

    // MARK: - Native Apple Vision Detection
    private func performFaceTrackingRequests(handler: VNImageRequestHandler) {
        var faceFound: VNFaceObservation? = nil

        // 1. Primary: Landmarks Detection (Eyes, Contour, Roll)
        let landmarksRequest = VNDetectFaceLandmarksRequest { (req, error) in
            if let results = req.results as? [VNFaceObservation], let face = results.first {
                faceFound = face
            }
        }

        #if targetEnvironment(simulator)
        landmarksRequest.usesCPUOnly = true
        #endif

        do {
            try handler.perform([landmarksRequest])
        } catch {
            // Simulator or hardware fallback
        }

        // 2. Secondary Fallback: Fast Rectangles Detection (Robust on all platforms)
        if faceFound == nil {
            let rectanglesRequest = VNDetectFaceRectanglesRequest { (req, error) in
                if let results = req.results as? [VNFaceObservation], let face = results.first {
                    faceFound = face
                }
            }

            #if targetEnvironment(simulator)
            rectanglesRequest.usesCPUOnly = true
            #endif

            do {
                try handler.perform([rectanglesRequest])
            } catch {
                // Vision error logged
            }
        }

        if let face = faceFound {
            self.updateDetectedFace(face)
        } else {
            DispatchQueue.main.async {
                self.isFaceDetected = false
            }
        }
    }

    // MARK: - Face Observation Handling & Exponential Smoothing
    private func updateDetectedFace(_ face: VNFaceObservation) {
        // Vision coordinates: origin is bottom-left (0,0), size is (1,1)
        // Convert to UIKit/SwiftUI coordinates: origin is top-left (0,0)
        let visionBox = face.boundingBox
        let targetX = visionBox.origin.x
        let targetY = 1.0 - (visionBox.origin.y + visionBox.size.height)
        let targetWidth = visionBox.size.width
        let targetHeight = visionBox.size.height
        let targetRect = CGRect(x: targetX, y: targetY, width: targetWidth, height: targetHeight)

        // Head roll (tilt) & yaw
        let rollVal = face.roll?.doubleValue ?? 0.0 // Tilt in radians
        let yawVal = face.yaw?.doubleValue ?? 0.0

        // Extract landmarks if available (eyes & forehead)
        var eyesCenter: CGPoint? = nil
        var foreheadCenter: CGPoint? = nil

        if let landmarks = face.landmarks {
            if let leftEye = landmarks.leftEye, let rightEye = landmarks.rightEye {
                let leftPoints = leftEye.normalizedPoints
                let rightPoints = rightEye.normalizedPoints
                if !leftPoints.isEmpty && !rightPoints.isEmpty {
                    let avgLeftX = leftPoints.map { $0.x }.reduce(0, +) / CGFloat(leftPoints.count)
                    let avgLeftY = leftPoints.map { $0.y }.reduce(0, +) / CGFloat(leftPoints.count)
                    let avgRightX = rightPoints.map { $0.x }.reduce(0, +) / CGFloat(rightPoints.count)
                    let avgRightY = rightPoints.map { $0.y }.reduce(0, +) / CGFloat(rightPoints.count)

                    let midEyeVisionX = visionBox.origin.x + ((avgLeftX + avgRightX) / 2.0) * visionBox.size.width
                    let midEyeVisionY = visionBox.origin.y + ((avgLeftY + avgRightY) / 2.0) * visionBox.size.height

                    eyesCenter = CGPoint(x: midEyeVisionX, y: 1.0 - midEyeVisionY)
                }
            }

            if let contour = landmarks.faceContour {
                let pts = contour.normalizedPoints
                if !pts.isEmpty {
                    let topContourY = pts.map { $0.y }.max() ?? 1.0
                    let foreheadVisionX = visionBox.origin.x + (visionBox.size.width * 0.5)
                    let foreheadVisionY = visionBox.origin.y + (topContourY * visionBox.size.height)
                    foreheadCenter = CGPoint(x: foreheadVisionX, y: 1.0 - foreheadVisionY)
                }
            }
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isFaceDetected = true

            // Exponential smoothing for smooth tracking without jitter
            let current = self.normalizedFaceRect
            let smoothedX = current.origin.x + (targetRect.origin.x - current.origin.x) * self.smoothingAlpha
            let smoothedY = current.origin.y + (targetRect.origin.y - current.origin.y) * self.smoothingAlpha
            let smoothedW = current.size.width + (targetRect.size.width - current.size.width) * self.smoothingAlpha
            let smoothedH = current.size.height + (targetRect.size.height - current.size.height) * self.smoothingAlpha

            self.normalizedFaceRect = CGRect(x: smoothedX, y: smoothedY, width: smoothedW, height: smoothedH)
            self.eyesCenterNormalized = eyesCenter ?? CGPoint(x: smoothedX + smoothedW * 0.5, y: smoothedY + smoothedH * 0.40)
            self.foreheadCenterNormalized = foreheadCenter ?? CGPoint(x: smoothedX + smoothedW * 0.5, y: smoothedY + smoothedH * 0.12)
            self.headRoll = self.headRoll + (rollVal - self.headRoll) * Double(self.smoothingAlpha)
            self.headYaw = self.headYaw + (yawVal - self.headYaw) * Double(self.smoothingAlpha)
        }
    }

    // MARK: - Exact Aspect-Fill UI Coordinate Conversion
    public func projectNormalizedPoint(
        _ rawPt: CGPoint,
        in containerSize: CGSize,
        imageSize: CGSize? = nil
    ) -> CGPoint {
        guard containerSize.width > 0 && containerSize.height > 0 else { return .zero }
        let frame = imageSize ?? lastImageSize
        guard frame.width > 0 && frame.height > 0 else {
            return CGPoint(x: rawPt.x * containerSize.width, y: rawPt.y * containerSize.height)
        }

        // Exact Aspect-Fill projection from camera pixel coordinates to container view bounds
        let imgAspect = frame.width / frame.height
        let boxAspect = containerSize.width / containerSize.height

        if imgAspect > boxAspect {
            let scale = containerSize.height / frame.height
            let renderedWidth = frame.width * scale
            let xOffset = (containerSize.width - renderedWidth) / 2.0
            return CGPoint(x: xOffset + (rawPt.x * renderedWidth), y: rawPt.y * containerSize.height)
        } else {
            let scale = containerSize.width / frame.width
            let renderedHeight = frame.height * scale
            let yOffset = (containerSize.height - renderedHeight) / 2.0
            return CGPoint(x: rawPt.x * containerSize.width, y: yOffset + (rawPt.y * renderedHeight))
        }
    }

    public func faceCenter(
        in containerSize: CGSize,
        imageSize: CGSize? = nil
    ) -> CGPoint {
        let rawCenter = CGPoint(x: normalizedFaceRect.midX, y: normalizedFaceRect.midY)
        return projectNormalizedPoint(rawCenter, in: containerSize, imageSize: imageSize)
    }

    public func faceDimensions(
        in containerSize: CGSize,
        imageSize: CGSize? = nil
    ) -> CGSize {
        let frame = imageSize ?? lastImageSize
        let renderScale: CGFloat
        if frame.width > 0 && frame.height > 0 {
            renderScale = max(containerSize.width / frame.width, containerSize.height / frame.height)
        } else {
            renderScale = containerSize.width / 400.0
        }

        let w = (normalizedFaceRect.size.width * (frame.width > 0 ? frame.width : containerSize.width)) * renderScale
        let h = (normalizedFaceRect.size.height * (frame.height > 0 ? frame.height : containerSize.height)) * renderScale
        return CGSize(width: max(w, 80), height: max(h, 100))
    }

    public func flyingEmojiPosition(
        angle: Double,
        in containerSize: CGSize,
        imageSize: CGSize? = nil
    ) -> CGPoint {
        let center = faceCenter(in: containerSize, imageSize: imageSize)
        let dims = faceDimensions(in: containerSize, imageSize: imageSize)

        // Orbit radius: strictly outside the face perimeter so the face is never covered
        let baseRadiusX = dims.width * 0.70 + 20
        let baseRadiusY = dims.height * 0.72 + 25

        // Gentle flutter for natural flying motion
        let flutter = sin(angle * 3.0) * 8.0
        let rx = baseRadiusX + flutter
        let ry = baseRadiusY + flutter * 0.8

        let unrotatedX = rx * cos(angle)
        let unrotatedY = ry * sin(angle)

        // Rotate orbit along with head roll
        let cosRoll = cos(headRoll)
        let sinRoll = sin(headRoll)
        let rotX = unrotatedX * cosRoll - unrotatedY * sinRoll
        let rotY = unrotatedX * sinRoll + unrotatedY * cosRoll

        return CGPoint(x: center.x + rotX, y: center.y + rotY)
    }

    public func anchorPoint(
        for anchor: FaceAnchorPosition,
        in containerSize: CGSize,
        imageSize: CGSize? = nil
    ) -> CGPoint {
        guard containerSize.width > 0 && containerSize.height > 0 else { return .zero }
        let rect = normalizedFaceRect

        let rawPt: CGPoint
        switch anchor {
        case .forehead:
            rawPt = foreheadCenterNormalized ?? CGPoint(x: rect.midX, y: rect.origin.y + rect.size.height * 0.12)
        case .eyes:
            rawPt = eyesCenterNormalized ?? CGPoint(x: rect.midX, y: rect.origin.y + rect.size.height * 0.40)
        case .head:
            rawPt = CGPoint(x: rect.midX, y: rect.origin.y + rect.size.height * 0.45)
        }

        return projectNormalizedPoint(rawPt, in: containerSize, imageSize: imageSize)
    }

    public func emojiSize(
        in containerSize: CGSize,
        for filter: FaceEmojiType,
        imageSize: CGSize? = nil
    ) -> CGFloat {
        let frame = imageSize ?? lastImageSize
        let renderScale: CGFloat
        if frame.width > 0 && frame.height > 0 {
            renderScale = max(containerSize.width / frame.width, containerSize.height / frame.height)
        } else {
            renderScale = containerSize.width / 400.0
        }

        let actualFaceWidth = (normalizedFaceRect.size.width * (frame.width > 0 ? frame.width : containerSize.width)) * renderScale

        // Companion emoji flying around face (scaled nicely, never covering the face)
        return max(min(actualFaceWidth * 0.40, 72), 44)
    }
}
