import Foundation
import AVFoundation
import CoreGraphics
import CoreMedia

func createVideo(outputPath: String, isFront: Bool, duration: Double = 6.0, fps: Int32 = 30) {
    let url = URL(fileURLWithPath: outputPath)
    try? FileManager.default.removeItem(at: url)

    let width = 720
    let height = 960
    let size = CGSize(width: width, height: height)

    guard let writer = try? AVAssetWriter(outputURL: url, fileType: .mp4) else {
        print("Failed to create writer for \(outputPath)")
        return
    }

    let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height
    ]

    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.expectsMediaDataInRealTime = false

    let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ]

    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
    writer.add(input)
    writer.startWriting()
    writer.startSession(atSourceTime: .zero)

    let totalFrames = Int(duration * Double(fps))
    let colorSpace = CGColorSpaceCreateDeviceRGB()

    for i in 0..<totalFrames {
        while !input.isReadyForMoreMediaData {
            Thread.sleep(forTimeInterval: 0.005)
        }

        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, adaptor.pixelBufferPool!, &pixelBuffer)
        guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
            continue
        }

        CVPixelBufferLockBaseAddress(buffer, [])
        let base = CVPixelBufferGetBaseAddress(buffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)

        let ctx = CGContext(
            data: base,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
        )!

        let t = Double(i) / Double(fps)
        let phase = t * 2.0 * .pi / duration

        if isFront {
            // Toddler Selfie Camera Feed
            // Background warm nursery wall with slight handheld camera drift
            let driftX = sin(t * 1.5) * 8.0
            let driftY = cos(t * 1.2) * 6.0

            ctx.setFillColor(CGColor(red: 0.98, green: 0.92, blue: 0.94, alpha: 1.0))
            ctx.fill(CGRect(origin: .zero, size: size))

            // Soft wall gradient
            let gradColors = [
                CGColor(red: 0.95, green: 0.88, blue: 0.92, alpha: 1.0),
                CGColor(red: 0.90, green: 0.92, blue: 0.98, alpha: 1.0)
            ] as CFArray
            if let grad = CGGradient(colorsSpace: colorSpace, colors: gradColors, locations: [0.0, 1.0]) {
                ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: height), end: CGPoint(x: width, y: 0), options: [])
            }

            // Toddler face (moving with breathing and head tilt)
            let headTilt = sin(phase) * 6.0
            let headBounce = abs(sin(phase * 2.0)) * 10.0
            let centerX = CGFloat(width) / 2.0 + CGFloat(driftX)
            let centerY = CGFloat(height) / 2.0 + 40.0 - CGFloat(headBounce)

            ctx.saveGState()
            ctx.translateBy(x: centerX, y: centerY)
            ctx.rotate(by: CGFloat(headTilt * .pi / 180.0))

            // Baby body/shoulders
            ctx.setFillColor(CGColor(red: 0.35, green: 0.65, blue: 0.95, alpha: 1.0))
            ctx.fillEllipse(in: CGRect(x: -240, y: -440, width: 480, height: 350))

            // Baby head
            ctx.setFillColor(CGColor(red: 1.0, green: 0.88, blue: 0.80, alpha: 1.0))
            ctx.fillEllipse(in: CGRect(x: -180, y: -200, width: 360, height: 400))

            // Baby hair
            ctx.setFillColor(CGColor(red: 0.55, green: 0.35, blue: 0.2, alpha: 1.0))
            ctx.fillEllipse(in: CGRect(x: -120, y: 120, width: 100, height: 80))
            ctx.fillEllipse(in: CGRect(x: -40, y: 140, width: 110, height: 90))
            ctx.fillEllipse(in: CGRect(x: 50, y: 120, width: 90, height: 80))

            // Rosy cheeks
            ctx.setFillColor(CGColor(red: 1.0, green: 0.6, blue: 0.65, alpha: 0.45))
            ctx.fillEllipse(in: CGRect(x: -160, y: -50, width: 70, height: 40))
            ctx.fillEllipse(in: CGRect(x: 90, y: -50, width: 70, height: 40))

            // Blinking eyes
            let blinkPhase = fmod(t, 2.5)
            let isBlinking = blinkPhase < 0.15
            if isBlinking {
                // Closed eye lines
                ctx.setStrokeColor(CGColor(red: 0.2, green: 0.15, blue: 0.1, alpha: 1.0))
                ctx.setLineWidth(6)
                ctx.beginPath()
                ctx.addArc(center: CGPoint(x: -70, y: 10), radius: 20, startAngle: 0, endAngle: .pi, clockwise: false)
                ctx.strokePath()
                ctx.beginPath()
                ctx.addArc(center: CGPoint(x: 70, y: 10), radius: 20, startAngle: 0, endAngle: .pi, clockwise: false)
                ctx.strokePath()
            } else {
                // Big shiny eyes looking around
                let eyeShiftX = sin(t * 2.0) * 8.0
                ctx.setFillColor(CGColor(red: 0.15, green: 0.2, blue: 0.3, alpha: 1.0))
                ctx.fillEllipse(in: CGRect(x: -95, y: -10, width: 50, height: 60))
                ctx.fillEllipse(in: CGRect(x: 45, y: -10, width: 50, height: 60))
                // Eye highlights
                ctx.setFillColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0))
                ctx.fillEllipse(in: CGRect(x: -85 + eyeShiftX, y: 15, width: 18, height: 18))
                ctx.fillEllipse(in: CGRect(x: 55 + eyeShiftX, y: 15, width: 18, height: 18))
            }

            // Smiling mouth
            ctx.setStrokeColor(CGColor(red: 0.9, green: 0.35, blue: 0.4, alpha: 1.0))
            ctx.setLineWidth(8)
            ctx.setLineCap(.round)
            ctx.beginPath()
            let smileRadius: CGFloat = 38.0 + CGFloat(sin(t * 3.0)) * 4.0
            ctx.addArc(center: CGPoint(x: 0, y: -70), radius: smileRadius, startAngle: 0.15 * .pi, endAngle: 0.85 * .pi, clockwise: false)
            ctx.strokePath()

            ctx.restoreGState()

        } else {
            // Rear Camera Feed (Living Room / Playroom scene with handheld camera motion)
            let panX = sin(phase * 0.8) * 35.0
            let panY = cos(phase * 0.6) * 15.0

            // Sunny room background
            ctx.setFillColor(CGColor(red: 0.96, green: 0.94, blue: 0.88, alpha: 1.0))
            ctx.fill(CGRect(origin: .zero, size: size))

            // Window in background
            let winX = 140.0 + panX * 0.5
            let winY = CGFloat(height) - 450.0 + panY * 0.5
            ctx.setFillColor(CGColor(red: 0.75, green: 0.90, blue: 0.98, alpha: 1.0))
            ctx.fill(CGRect(x: winX, y: winY, width: 220, height: 280))
            // Window frame
            ctx.setStrokeColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0))
            ctx.setLineWidth(14)
            ctx.stroke(CGRect(x: winX, y: winY, width: 220, height: 280))

            // Hardwood floor
            let floorY = 280.0 + panY
            ctx.setFillColor(CGColor(red: 0.80, green: 0.65, blue: 0.50, alpha: 1.0))
            ctx.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: floorY))

            // Toy train on floor (moving back and forth)
            let trainX = 220.0 + sin(t * 1.8) * 120.0 + panX
            let trainY = 120.0 + panY
            ctx.setFillColor(CGColor(red: 0.95, green: 0.35, blue: 0.35, alpha: 1.0))
            ctx.fill(CGRect(x: trainX, y: trainY, width: 140, height: 90))
            ctx.setFillColor(CGColor(red: 0.25, green: 0.65, blue: 0.90, alpha: 1.0))
            ctx.fill(CGRect(x: trainX + 90, y: trainY + 40, width: 70, height: 90))
            // Train wheels
            ctx.setFillColor(CGColor(red: 0.2, green: 0.2, blue: 0.2, alpha: 1.0))
            ctx.fillEllipse(in: CGRect(x: trainX + 15, y: trainY - 20, width: 40, height: 40))
            ctx.fillEllipse(in: CGRect(x: trainX + 85, y: trainY - 20, width: 40, height: 40))
            ctx.fillEllipse(in: CGRect(x: trainX + 130, y: trainY - 20, width: 40, height: 40))

            // Bouncing colorful ball
            let ballX = 520.0 + panX
            let ballHeight = abs(sin(t * 4.0)) * 140.0
            let ballY = 80.0 + ballHeight + panY
            ctx.setFillColor(CGColor(red: 1.0, green: 0.75, blue: 0.15, alpha: 1.0))
            ctx.fillEllipse(in: CGRect(x: ballX, y: ballY, width: 90, height: 90))
            // Ball stripe
            ctx.setStrokeColor(CGColor(red: 0.25, green: 0.80, blue: 0.70, alpha: 1.0))
            ctx.setLineWidth(14)
            ctx.strokeEllipse(in: CGRect(x: ballX + 10, y: ballY + 10, width: 70, height: 70))
        }

        // Live camera HUD overlay (Live 30fps indicator)
        let hudRect = CGRect(x: 20, y: height - 65, width: 140, height: 36)
        ctx.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 0.5))
        ctx.fill(hudRect)

        CVPixelBufferUnlockBaseAddress(buffer, [])
        let frameTime = CMTime(value: Int64(i), timescale: fps)
        adaptor.append(buffer, withPresentationTime: frameTime)
    }

    input.markAsFinished()
    let sem = DispatchSemaphore(value: 0)
    writer.finishWriting {
        print("Generated video: \(outputPath)")
        sem.signal()
    }
    sem.wait()
}

let resDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "KidsCam/Resources"
createVideo(outputPath: "\(resDir)/front_video.mp4", isFront: true)
createVideo(outputPath: "\(resDir)/rear_video.mp4", isFront: false)
print("Both videos created successfully!")
