import Foundation
import UIKit
import CoreGraphics

public final class DualPhotoRenderer {

    public static func composeDualPhoto(
        backImage: UIImage,
        frontImage: UIImage,
        primaryPosition: ActiveCameraPosition,
        filter: FaceEmojiType? = FaceTrackingManager.shared.activeFilter,
        sticker: String? = nil,
        isDemo: Bool = DualCameraManager.shared.isDemoMode
    ) -> UIImage {
        let size = CGSize(width: 1200, height: 1600)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0
        let renderer = UIGraphicsImageRenderer(size: size, format: format)

        return renderer.image { ctx in
            let cg = ctx.cgContext

            let mainImage = (primaryPosition == .back) ? backImage : frontImage
            let pipImage = (primaryPosition == .back) ? frontImage : backImage

            let pipWidth: CGFloat = size.width * 0.30
            let pipHeight: CGFloat = pipWidth * (4.0 / 3.0)
            let pipRect = CGRect(x: size.width - pipWidth - 36, y: 50, width: pipWidth, height: pipHeight)

            // Picture-in-Picture (PiP) Layout with zero stretching
            // 1. Draw main full image using Aspect Fill
            drawImageAspectFill(mainImage, in: CGRect(origin: .zero, size: size), context: cg)

            // 2. Draw PiP overlay in top right using Aspect Fill
            // Shadow & rounded border
            cg.saveGState()
            cg.setShadow(offset: CGSize(width: 0, height: 8), blur: 16, color: UIColor.black.withAlphaComponent(0.35).cgColor)
            let clipPath = UIBezierPath(roundedRect: pipRect, cornerRadius: 28)
            UIColor.white.setStroke()
            clipPath.lineWidth = 10
            clipPath.stroke()
            clipPath.addClip()
            drawImageAspectFill(pipImage, in: pipRect, context: cg)
            cg.restoreGState()

            // Border outline
            let borderPath = UIBezierPath(roundedRect: pipRect, cornerRadius: 28)
            UIColor(red: 1.0, green: 0.85, blue: 0.3, alpha: 1.0).setStroke()
            borderPath.lineWidth = 6
            borderPath.stroke()

            // Draw Vision-tracked face emoji flying around face if active
            if let active = filter {
                let isFrontPrimary = (primaryPosition == .front)
                let targetRect: CGRect = isFrontPrimary ? CGRect(origin: .zero, size: size) : pipRect
                let time = Date().timeIntervalSinceReferenceDate
                let period: Double = 3.6
                let angle = (time.truncatingRemainder(dividingBy: period)) / period * (2.0 * .pi)

                let emojiPt = FaceTrackingManager.shared.flyingEmojiPosition(angle: angle, in: targetRect.size)
                let trailPt1 = FaceTrackingManager.shared.flyingEmojiPosition(angle: angle - 0.22, in: targetRect.size)
                let trailPt2 = FaceTrackingManager.shared.flyingEmojiPosition(angle: angle - 0.44, in: targetRect.size)

                let finalEmojiPt = CGPoint(x: targetRect.origin.x + emojiPt.x, y: targetRect.origin.y + emojiPt.y)
                let finalTrailPt1 = CGPoint(x: targetRect.origin.x + trailPt1.x, y: targetRect.origin.y + trailPt1.y)
                let finalTrailPt2 = CGPoint(x: targetRect.origin.x + trailPt2.x, y: targetRect.origin.y + trailPt2.y)

                let rawSize = FaceTrackingManager.shared.emojiSize(in: targetRect.size, for: active)
                let emojiFontSize = isFrontPrimary ? rawSize : (rawSize * 0.85)

                // Trail sparkles
                let trailFont2 = UIFont.systemFont(ofSize: emojiFontSize * 0.36)
                let trailStr2 = NSString(string: "✨")
                let trailSize2 = trailStr2.size(withAttributes: [.font: trailFont2])
                cg.saveGState()
                cg.setAlpha(0.45)
                trailStr2.draw(at: CGPoint(x: finalTrailPt2.x - trailSize2.width / 2.0, y: finalTrailPt2.y - trailSize2.height / 2.0), withAttributes: [.font: trailFont2])
                cg.restoreGState()

                let trailFont1 = UIFont.systemFont(ofSize: emojiFontSize * 0.46)
                let trailStr1 = NSString(string: "💫")
                let trailSize1 = trailStr1.size(withAttributes: [.font: trailFont1])
                cg.saveGState()
                cg.setAlpha(0.70)
                trailStr1.draw(at: CGPoint(x: finalTrailPt1.x - trailSize1.width / 2.0, y: finalTrailPt1.y - trailSize1.height / 2.0), withAttributes: [.font: trailFont1])
                cg.restoreGState()

                // Main flying companion emoji
                let font = UIFont.systemFont(ofSize: emojiFontSize)
                let attrs: [NSAttributedString.Key: Any] = [.font: font]
                let str = NSString(string: active.emoji)
                let strSize = str.size(withAttributes: attrs)

                let bankAngle = CGFloat(FaceTrackingManager.shared.headRoll + cos(angle) * 0.20)
                cg.saveGState()
                cg.translateBy(x: finalEmojiPt.x, y: finalEmojiPt.y)
                cg.rotate(by: bankAngle)
                let drawOrigin = CGPoint(x: -(strSize.width / 2.0), y: -(strSize.height / 2.0))
                str.draw(at: drawOrigin, withAttributes: attrs)
                cg.restoreGState()
            }

            // Watermark ribbon at bottom
            drawWatermark(size: size, isDemo: isDemo)
        }
    }

    // MARK: - Aspect Ratio Preservation (Zero Distortion)
    public static func drawImageAspectFill(_ image: UIImage, in rect: CGRect, context: CGContext) {
        guard image.size.width > 0 && image.size.height > 0 else { return }

        let targetRatio = rect.width / rect.height
        let imageRatio = image.size.width / image.size.height

        var drawRect = rect
        if imageRatio > targetRatio {
            let scaledWidth = rect.height * imageRatio
            drawRect = CGRect(
                x: rect.origin.x - (scaledWidth - rect.width) * 0.5,
                y: rect.origin.y,
                width: scaledWidth,
                height: rect.height
            )
        } else {
            let scaledHeight = rect.width / imageRatio
            drawRect = CGRect(
                x: rect.origin.x,
                y: rect.origin.y - (scaledHeight - rect.height) * 0.5,
                width: rect.width,
                height: scaledHeight
            )
        }

        context.saveGState()
        context.clip(to: rect)
        image.draw(in: drawRect)
        context.restoreGState()
    }

    public static func pixelBuffer(from image: UIImage, size: CGSize) -> CVPixelBuffer? {
        let attrs = [
            kCVPixelBufferCGImageCompatibilityKey: kCFBooleanTrue,
            kCVPixelBufferCGBitmapContextCompatibilityKey: kCFBooleanTrue
        ] as CFDictionary

        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            Int(size.width),
            Int(size.height),
            kCVPixelFormatType_32ARGB,
            attrs,
            &pixelBuffer
        )
        guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }

        CVPixelBufferLockBaseAddress(buffer, [])
        let pixelData = CVPixelBufferGetBaseAddress(buffer)

        let rgbColorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: pixelData,
            width: Int(size.width),
            height: Int(size.height),
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: rgbColorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
        ) else {
            CVPixelBufferUnlockBaseAddress(buffer, [])
            return nil
        }

        UIGraphicsPushContext(context)
        drawImageAspectFill(image, in: CGRect(origin: .zero, size: size), context: context)
        UIGraphicsPopContext()

        CVPixelBufferUnlockBaseAddress(buffer, [])
        return buffer
    }

    private static func drawWatermark(size: CGSize, isDemo: Bool = false) {
        let ribbonHeight: CGFloat = isDemo ? 104 : 80

        let colors = [UIColor.black.withAlphaComponent(0.65).cgColor, UIColor.clear.cgColor]
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        if let grad = CGGradient(colorsSpace: colorSpace, colors: colors as CFArray, locations: [1.0, 0.0]) {
            guard let ctx = UIGraphicsGetCurrentContext() else { return }
            ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: size.height), end: CGPoint(x: 0, y: size.height - ribbonHeight), options: [])
        }

        let title = "📸 ToddlerCam Dual Shot"
        let font = UIFont.systemFont(ofSize: isDemo ? 24 : 28, weight: .bold)
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor.white
        ]
        let titleStr = NSString(string: title)
        let titleY = isDemo ? (size.height - 74) : (size.height - 55)
        titleStr.draw(at: CGPoint(x: 30, y: titleY), withAttributes: attrs)

        if isDemo {
            let demoTag = "AI-Generated Demonstration • Does not represent a real person"
            let demoAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
                .foregroundColor: UIColor(red: 1.0, green: 0.9, blue: 0.4, alpha: 0.95)
            ]
            let demoStr = NSString(string: demoTag)
            demoStr.draw(at: CGPoint(x: 30, y: size.height - 40), withAttributes: demoAttrs)
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        let dateStr = NSString(string: formatter.string(from: Date()))
        let dateAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 22, weight: .medium),
            .foregroundColor: UIColor(white: 0.9, alpha: 0.9)
        ]
        let dateSize = dateStr.size(withAttributes: dateAttrs)
        dateStr.draw(at: CGPoint(x: size.width - dateSize.width - 30, y: titleY + (isDemo ? 1 : 3)), withAttributes: dateAttrs)
    }

    public static func renderSimulatedBackCamera() -> UIImage {
        let size = CGSize(width: 800, height: 1000)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext
            // Playful room background gradient
            let colors = [
                UIColor(red: 0.96, green: 0.88, blue: 0.72, alpha: 1.0).cgColor,
                UIColor(red: 0.82, green: 0.92, blue: 0.84, alpha: 1.0).cgColor
            ] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0.0, 1.0]) {
                cg.drawLinearGradient(grad, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            }

            // Floor
            let floorRect = CGRect(x: 0, y: 700, width: size.width, height: 300)
            UIColor(red: 0.76, green: 0.62, blue: 0.48, alpha: 1.0).setFill()
            cg.fill(floorRect)

            // Colorful toy blocks
            let block1 = CGRect(x: 120, y: 620, width: 140, height: 140)
            UIColor(red: 1.0, green: 0.35, blue: 0.35, alpha: 1.0).setFill()
            cg.fill(block1)
            let block2 = CGRect(x: 280, y: 650, width: 120, height: 110)
            UIColor(red: 0.25, green: 0.65, blue: 0.95, alpha: 1.0).setFill()
            cg.fill(block2)
            let block3 = CGRect(x: 180, y: 510, width: 110, height: 110)
            UIColor(red: 1.0, green: 0.82, blue: 0.2, alpha: 1.0).setFill()
            cg.fill(block3)

            // Teddy bear toy
            let bearHead = CGRect(x: 500, y: 560, width: 160, height: 140)
            UIColor(red: 0.62, green: 0.42, blue: 0.28, alpha: 1.0).setFill()
            cg.fillEllipse(in: bearHead)
            // Bear ears
            cg.fillEllipse(in: CGRect(x: 480, y: 530, width: 50, height: 50))
            cg.fillEllipse(in: CGRect(x: 630, y: 530, width: 50, height: 50))
            // Bear eyes & nose
            UIColor.black.setFill()
            cg.fillEllipse(in: CGRect(x: 540, y: 600, width: 16, height: 16))
            cg.fillEllipse(in: CGRect(x: 600, y: 600, width: 16, height: 16))
            cg.fillEllipse(in: CGRect(x: 565, y: 630, width: 26, height: 18))

        }
    }

    public static func renderSimulatedFrontCamera(sticker: String? = nil) -> UIImage {
        let size = CGSize(width: 800, height: 1000)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext
            // Cheerful pastel backdrop
            let colors = [
                UIColor(red: 0.72, green: 0.85, blue: 0.98, alpha: 1.0).cgColor,
                UIColor(red: 0.98, green: 0.82, blue: 0.90, alpha: 1.0).cgColor
            ] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0.0, 1.0]) {
                cg.drawLinearGradient(grad, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            }

            // Toddler selfie head
            let headRect = CGRect(x: 220, y: 320, width: 360, height: 420)
            UIColor(red: 1.0, green: 0.86, blue: 0.78, alpha: 1.0).setFill()
            cg.fillEllipse(in: headRect)

            // Rosy cheeks
            UIColor(red: 1.0, green: 0.6, blue: 0.65, alpha: 0.6).setFill()
            cg.fillEllipse(in: CGRect(x: 250, y: 520, width: 70, height: 40))
            cg.fillEllipse(in: CGRect(x: 480, y: 520, width: 70, height: 40))

            // Cheerful big eyes
            UIColor(red: 0.15, green: 0.2, blue: 0.3, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 310, y: 440, width: 44, height: 56))
            cg.fillEllipse(in: CGRect(x: 446, y: 440, width: 44, height: 56))
            // Eye sparkles
            UIColor.white.setFill()
            cg.fillEllipse(in: CGRect(x: 322, y: 448, width: 16, height: 16))
            cg.fillEllipse(in: CGRect(x: 458, y: 448, width: 16, height: 16))

            // Sweet toddler smile
            UIColor(red: 0.9, green: 0.3, blue: 0.35, alpha: 1.0).setStroke()
            let mouthPath = UIBezierPath()
            mouthPath.addArc(withCenter: CGPoint(x: 400, y: 550), radius: 55, startAngle: 0.15 * .pi, endAngle: 0.85 * .pi, clockwise: false)
            mouthPath.lineWidth = 10
            mouthPath.lineCapStyle = .round
            mouthPath.stroke()

            // Baby curls hair
            UIColor(red: 0.45, green: 0.28, blue: 0.15, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 280, y: 270, width: 90, height: 90))
            cg.fillEllipse(in: CGRect(x: 350, y: 250, width: 100, height: 90))
            cg.fillEllipse(in: CGRect(x: 430, y: 270, width: 90, height: 90))
        }
    }

    // MARK: - Demo Mode Feeds (AI-Generated Kid Selfie & Car View)

    /// Helper to reliably load demo images from Asset Catalog, App/Framework Bundle, or repo resources
    public static func loadDemoImage(named name: String, filename: String) -> UIImage? {
        if let img = UIImage(named: name) {
            return img
        }
        if let bundle = Bundle(identifier: "com.hejitech.kidscam"), let img = UIImage(named: name, in: bundle, compatibleWith: nil) {
            return img
        }
        let frameworkBundle = Bundle(for: DualCameraManager.self)
        if let img = UIImage(named: name, in: frameworkBundle, compatibleWith: nil) {
            return img
        }
        if let path = frameworkBundle.path(forResource: filename, ofType: "jpg"), let img = UIImage(contentsOfFile: path) {
            return img
        }
        if let path = Bundle.main.path(forResource: filename, ofType: "jpg"), let img = UIImage(contentsOfFile: path) {
            return img
        }
        let devPaths = [
            "/Users/tianhaoz/GitHub/kids-cam/KidsCam/Resources/" + filename + ".jpg",
            "/Users/tianhaoz/GitHub/kids-cam/KidsCam/Resources/Assets.xcassets/" + name + ".imageset/" + filename + ".jpg"
        ]
        for p in devPaths {
            if FileManager.default.fileExists(atPath: p), let img = UIImage(contentsOfFile: p) {
                return img
            }
        }
        return nil
    }

    /// Renders a realistic AI-generated portrait of a toddler in a car seat for demo mode and store listing screenshots
    public static func renderBabyMockImage(size: CGSize = CGSize(width: 800, height: 1200)) -> UIImage {
        if let baseImage = loadDemoImage(named: "DemoKidSelfie", filename: "demo_kid_selfie") {
            return UIGraphicsImageRenderer(size: size).image { ctx in
                drawImageAspectFill(baseImage, in: CGRect(origin: .zero, size: size), context: ctx.cgContext)
            }
        }
        return renderProceduralBabyMockImage(size: size)
    }

    /// Procedural drawing fallback if bundle image is not available
    public static func renderProceduralBabyMockImage(size: CGSize = CGSize(width: 800, height: 1200)) -> UIImage {
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext

            // 1. Soft, warm sunny portrait bokeh background
            let bgColors = [
                UIColor(red: 1.0, green: 0.95, blue: 0.88, alpha: 1.0).cgColor,
                UIColor(red: 1.0, green: 0.88, blue: 0.82, alpha: 1.0).cgColor,
                UIColor(red: 0.98, green: 0.82, blue: 0.85, alpha: 1.0).cgColor
            ] as CFArray
            if let bgGrad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: bgColors, locations: [0.0, 0.55, 1.0]) {
                cg.drawLinearGradient(bgGrad, start: CGPoint(x: size.width * 0.5, y: 0), end: CGPoint(x: size.width * 0.5, y: size.height), options: [])
            }

            // Warm soft bokeh circles in background
            let bokehList: [(CGPoint, CGFloat, UIColor)] = [
                (CGPoint(x: 140, y: 220), 85, UIColor(red: 1.0, green: 0.92, blue: 0.75, alpha: 0.45)),
                (CGPoint(x: 660, y: 180), 110, UIColor(red: 1.0, green: 0.85, blue: 0.80, alpha: 0.40)),
                (CGPoint(x: 200, y: 520), 70, UIColor(red: 0.85, green: 0.93, blue: 1.0, alpha: 0.35)),
                (CGPoint(x: 640, y: 620), 95, UIColor(red: 1.0, green: 0.90, blue: 0.82, alpha: 0.40)),
                (CGPoint(x: 400, y: 120), 90, UIColor(red: 1.0, green: 0.96, blue: 0.80, alpha: 0.50))
            ]
            for (pt, rad, color) in bokehList {
                color.setFill()
                cg.fillEllipse(in: CGRect(x: pt.x - rad, y: pt.y - rad, width: rad * 2, height: rad * 2))
            }

            // 2. Baby Clothing & Shoulders
            let shirtRect = CGRect(x: 100, y: 720, width: 600, height: 500)
            UIColor(red: 0.32, green: 0.72, blue: 0.86, alpha: 1.0).setFill()
            let shirtPath = UIBezierPath(roundedRect: shirtRect, byRoundingCorners: [.topLeft, .topRight], cornerRadii: CGSize(width: 140, height: 140))
            shirtPath.fill()

            // Baby white collar / bib
            let bibRect = CGRect(x: 250, y: 680, width: 300, height: 220)
            UIColor.white.setFill()
            let bibPath = UIBezierPath(roundedRect: bibRect, cornerRadius: 45)
            bibPath.fill()
            UIColor(red: 0.90, green: 0.90, blue: 0.92, alpha: 1.0).setStroke()
            bibPath.lineWidth = 4
            bibPath.stroke()

            // Cheerful little baby star badge on bib
            let badgeCenter = CGPoint(x: 400, y: 775)
            UIColor(red: 1.0, green: 0.78, blue: 0.20, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: badgeCenter.x - 30, y: badgeCenter.y - 30, width: 60, height: 60))
            let starStr = NSString(string: "⭐")
            starStr.draw(at: CGPoint(x: badgeCenter.x - 17, y: badgeCenter.y - 19), withAttributes: [.font: UIFont.systemFont(ofSize: 34)])

            // 3. Baby Ears
            UIColor(red: 1.0, green: 0.85, blue: 0.78, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 160, y: 430, width: 65, height: 85))
            cg.fillEllipse(in: CGRect(x: 575, y: 430, width: 65, height: 85))
            UIColor(red: 1.0, green: 0.72, blue: 0.70, alpha: 0.6).setFill()
            cg.fillEllipse(in: CGRect(x: 175, y: 445, width: 35, height: 55))
            cg.fillEllipse(in: CGRect(x: 590, y: 445, width: 35, height: 55))

            // 4. Baby Head & Chubby Face
            let headRect = CGRect(x: 190, y: 240, width: 420, height: 490)
            UIColor(red: 1.0, green: 0.87, blue: 0.80, alpha: 1.0).setFill()
            cg.fillEllipse(in: headRect)

            // Chubby Rosy Cheeks
            UIColor(red: 1.0, green: 0.58, blue: 0.64, alpha: 0.55).setFill()
            cg.fillEllipse(in: CGRect(x: 220, y: 485, width: 100, height: 60))
            cg.fillEllipse(in: CGRect(x: 480, y: 485, width: 100, height: 60))

            // 5. Big Bright Expressive Eyes
            // Left Eye
            let leftEyeWhite = CGRect(x: 270, y: 395, width: 66, height: 78)
            UIColor.white.setFill()
            cg.fillEllipse(in: leftEyeWhite)
            UIColor(red: 0.28, green: 0.20, blue: 0.14, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 280, y: 402, width: 52, height: 66))
            UIColor(red: 0.10, green: 0.07, blue: 0.05, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 290, y: 412, width: 32, height: 46))
            UIColor.white.setFill()
            cg.fillEllipse(in: CGRect(x: 288, y: 410, width: 18, height: 18))
            cg.fillEllipse(in: CGRect(x: 312, y: 436, width: 9, height: 9))

            // Right Eye
            let rightEyeWhite = CGRect(x: 464, y: 395, width: 66, height: 78)
            UIColor.white.setFill()
            cg.fillEllipse(in: rightEyeWhite)
            UIColor(red: 0.28, green: 0.20, blue: 0.14, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 468, y: 402, width: 52, height: 66))
            UIColor(red: 0.10, green: 0.07, blue: 0.05, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 478, y: 412, width: 32, height: 46))
            UIColor.white.setFill()
            cg.fillEllipse(in: CGRect(x: 476, y: 410, width: 18, height: 18))
            cg.fillEllipse(in: CGRect(x: 500, y: 436, width: 9, height: 9))

            // Cheerful arched eyebrows
            UIColor(red: 0.52, green: 0.35, blue: 0.22, alpha: 0.7).setStroke()
            let browLeft = UIBezierPath()
            browLeft.addArc(withCenter: CGPoint(x: 300, y: 382), radius: 36, startAngle: 1.15 * .pi, endAngle: 1.85 * .pi, clockwise: true)
            browLeft.lineWidth = 5
            browLeft.lineCapStyle = .round
            browLeft.stroke()

            let browRight = UIBezierPath()
            browRight.addArc(withCenter: CGPoint(x: 500, y: 382), radius: 36, startAngle: 1.15 * .pi, endAngle: 1.85 * .pi, clockwise: true)
            browRight.lineWidth = 5
            browRight.lineCapStyle = .round
            browRight.stroke()

            // 6. Cute Button Nose
            UIColor(red: 0.90, green: 0.65, blue: 0.58, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: 388, y: 495, width: 24, height: 16))

            // 7. Joyous Open Baby Smile
            let mouthPath = UIBezierPath()
            mouthPath.move(to: CGPoint(x: 325, y: 535))
            mouthPath.addCurve(to: CGPoint(x: 475, y: 535), controlPoint1: CGPoint(x: 355, y: 625), controlPoint2: CGPoint(x: 445, y: 625))
            mouthPath.close()

            UIColor(red: 0.78, green: 0.24, blue: 0.32, alpha: 1.0).setFill()
            mouthPath.fill()

            let tonguePath = UIBezierPath()
            tonguePath.move(to: CGPoint(x: 360, y: 580))
            tonguePath.addCurve(to: CGPoint(x: 440, y: 580), controlPoint1: CGPoint(x: 375, y: 555), controlPoint2: CGPoint(x: 425, y: 555))
            tonguePath.addCurve(to: CGPoint(x: 360, y: 580), controlPoint1: CGPoint(x: 430, y: 610), controlPoint2: CGPoint(x: 370, y: 610))
            UIColor(red: 1.0, green: 0.58, blue: 0.68, alpha: 1.0).setFill()
            tonguePath.fill()

            // Tiny cute baby teeth
            UIColor.white.setFill()
            let tooth1 = UIBezierPath(roundedRect: CGRect(x: 388, y: 582, width: 10, height: 12), cornerRadius: 3)
            let tooth2 = UIBezierPath(roundedRect: CGRect(x: 402, y: 582, width: 10, height: 12), cornerRadius: 3)
            tooth1.fill()
            tooth2.fill()

            // Smile stroke outline
            UIColor(red: 0.85, green: 0.35, blue: 0.40, alpha: 1.0).setStroke()
            let smileLip = UIBezierPath()
            smileLip.move(to: CGPoint(x: 320, y: 535))
            smileLip.addCurve(to: CGPoint(x: 480, y: 535), controlPoint1: CGPoint(x: 355, y: 630), controlPoint2: CGPoint(x: 445, y: 630))
            smileLip.lineWidth = 6
            smileLip.lineCapStyle = .round
            smileLip.stroke()

            // 8. Baby Soft Curls Hair
            UIColor(red: 0.48, green: 0.30, blue: 0.18, alpha: 1.0).setFill()
            let hairCurls: [CGRect] = [
                CGRect(x: 230, y: 190, width: 105, height: 95),
                CGRect(x: 310, y: 165, width: 120, height: 100),
                CGRect(x: 405, y: 165, width: 120, height: 100),
                CGRect(x: 485, y: 190, width: 105, height: 95),
                CGRect(x: 180, y: 260, width: 85, height: 85),
                CGRect(x: 545, y: 260, width: 85, height: 85),
                CGRect(x: 365, y: 240, width: 75, height: 60)
            ]
            for curl in hairCurls {
                cg.fillEllipse(in: curl)
            }
            UIColor(red: 0.68, green: 0.48, blue: 0.32, alpha: 0.6).setFill()
            cg.fillEllipse(in: CGRect(x: 330, y: 180, width: 70, height: 35))
            cg.fillEllipse(in: CGRect(x: 420, y: 180, width: 70, height: 35))
        }
    }

    /// Renders the demo car self-view / rear view for the picture-in-picture view
    public static func renderNatureParkMockImage(size: CGSize = CGSize(width: 800, height: 1200)) -> UIImage {
        return renderCarSelfViewMockImage(size: size)
    }

    /// Renders the realistic AI-generated car interior view for PiP in demo mode
    public static func renderCarSelfViewMockImage(size: CGSize = CGSize(width: 800, height: 1200)) -> UIImage {
        if let baseImage = loadDemoImage(named: "DemoCarSelfView", filename: "demo_car_self_view") {
            return UIGraphicsImageRenderer(size: size).image { ctx in
                drawImageAspectFill(baseImage, in: CGRect(origin: .zero, size: size), context: ctx.cgContext)
            }
        }
        return renderProceduralNatureParkMockImage(size: size)
    }

    /// Procedural drawing fallback if bundle image is not available
    public static func renderProceduralNatureParkMockImage(size: CGSize = CGSize(width: 800, height: 1200)) -> UIImage {
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext

            // 1. Sky Gradient (Sapphire Blue to Morning Sun Gold)
            let skyColors = [
                UIColor(red: 0.20, green: 0.50, blue: 0.88, alpha: 1.0).cgColor,
                UIColor(red: 0.45, green: 0.74, blue: 0.96, alpha: 1.0).cgColor,
                UIColor(red: 0.98, green: 0.88, blue: 0.68, alpha: 1.0).cgColor
            ] as CFArray
            if let skyGrad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: skyColors, locations: [0.0, 0.55, 1.0]) {
                cg.drawLinearGradient(skyGrad, start: CGPoint(x: size.width * 0.5, y: 0), end: CGPoint(x: size.width * 0.5, y: 650), options: [])
            }

            // Morning Sun with soft glowing rings
            let sunCenter = CGPoint(x: 620, y: 160)
            UIColor(red: 1.0, green: 0.96, blue: 0.75, alpha: 0.35).setFill()
            cg.fillEllipse(in: CGRect(x: sunCenter.x - 85, y: sunCenter.y - 85, width: 170, height: 170))
            UIColor(red: 1.0, green: 0.92, blue: 0.55, alpha: 0.65).setFill()
            cg.fillEllipse(in: CGRect(x: sunCenter.x - 55, y: sunCenter.y - 55, width: 110, height: 110))
            UIColor(red: 1.0, green: 0.88, blue: 0.30, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: sunCenter.x - 35, y: sunCenter.y - 35, width: 70, height: 70))

            // Fluffy White Clouds
            let drawCloud: (CGPoint, CGFloat) -> Void = { center, scale in
                UIColor(white: 1.0, alpha: 0.90).setFill()
                cg.fillEllipse(in: CGRect(x: center.x - 45 * scale, y: center.y - 20 * scale, width: 90 * scale, height: 40 * scale))
                cg.fillEllipse(in: CGRect(x: center.x - 25 * scale, y: center.y - 35 * scale, width: 60 * scale, height: 50 * scale))
                cg.fillEllipse(in: CGRect(x: center.x + 5 * scale, y: center.y - 28 * scale, width: 50 * scale, height: 45 * scale))
            }
            drawCloud(CGPoint(x: 160, y: 150), 1.2)
            drawCloud(CGPoint(x: 430, y: 110), 0.9)
            drawCloud(CGPoint(x: 280, y: 220), 0.75)

            // Distant Soaring Birds
            let drawBird: (CGPoint) -> Void = { pt in
                UIColor(red: 0.15, green: 0.25, blue: 0.40, alpha: 0.8).setStroke()
                let path = UIBezierPath()
                path.move(to: CGPoint(x: pt.x - 14, y: pt.y + 4))
                path.addQuadCurve(to: CGPoint(x: pt.x, y: pt.y), controlPoint: CGPoint(x: pt.x - 7, y: pt.y - 6))
                path.addQuadCurve(to: CGPoint(x: pt.x + 14, y: pt.y + 4), controlPoint: CGPoint(x: pt.x + 7, y: pt.y - 6))
                path.lineWidth = 2.5
                path.lineCapStyle = .round
                path.stroke()
            }
            drawBird(CGPoint(x: 220, y: 90))
            drawBird(CGPoint(x: 250, y: 80))
            drawBird(CGPoint(x: 275, y: 95))

            // Cheerful Hot Air Balloon in distance
            let balloonCenter = CGPoint(x: 110, y: 290)
            UIColor(red: 0.95, green: 0.32, blue: 0.38, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: balloonCenter.x - 26, y: balloonCenter.y - 34, width: 52, height: 60))
            UIColor(red: 1.0, green: 0.82, blue: 0.25, alpha: 1.0).setFill()
            cg.fillEllipse(in: CGRect(x: balloonCenter.x - 12, y: balloonCenter.y - 34, width: 24, height: 60))
            UIColor(red: 0.55, green: 0.35, blue: 0.20, alpha: 1.0).setFill()
            cg.fill(CGRect(x: balloonCenter.x - 8, y: balloonCenter.y + 32, width: 16, height: 12))

            // 2. Far Mountain Range (State Park Misty Peaks)
            let farMtn = UIBezierPath()
            farMtn.move(to: CGPoint(x: 0, y: 520))
            farMtn.addLine(to: CGPoint(x: 140, y: 380))
            farMtn.addLine(to: CGPoint(x: 270, y: 440))
            farMtn.addLine(to: CGPoint(x: 420, y: 340))
            farMtn.addLine(to: CGPoint(x: 580, y: 430))
            farMtn.addLine(to: CGPoint(x: 720, y: 370))
            farMtn.addLine(to: CGPoint(x: 800, y: 420))
            farMtn.addLine(to: CGPoint(x: 800, y: 700))
            farMtn.addLine(to: CGPoint(x: 0, y: 700))
            farMtn.close()
            UIColor(red: 0.46, green: 0.54, blue: 0.68, alpha: 1.0).setFill()
            farMtn.fill()

            // Snow caps on peaks
            let snow1 = UIBezierPath()
            snow1.move(to: CGPoint(x: 140, y: 380))
            snow1.addLine(to: CGPoint(x: 170, y: 410))
            snow1.addLine(to: CGPoint(x: 140, y: 400))
            snow1.addLine(to: CGPoint(x: 110, y: 410))
            snow1.close()
            UIColor(white: 0.96, alpha: 0.85).setFill()
            snow1.fill()

            let snow2 = UIBezierPath()
            snow2.move(to: CGPoint(x: 420, y: 340))
            snow2.addLine(to: CGPoint(x: 460, y: 380))
            snow2.addLine(to: CGPoint(x: 420, y: 370))
            snow2.addLine(to: CGPoint(x: 380, y: 380))
            snow2.close()
            snow2.fill()

            // 3. Midground Mountains & Evergreen Forest Hills
            let midMtn = UIBezierPath()
            midMtn.move(to: CGPoint(x: 0, y: 560))
            midMtn.addLine(to: CGPoint(x: 200, y: 460))
            midMtn.addLine(to: CGPoint(x: 460, y: 530))
            midMtn.addLine(to: CGPoint(x: 680, y: 450))
            midMtn.addLine(to: CGPoint(x: 800, y: 500))
            midMtn.addLine(to: CGPoint(x: 800, y: 750))
            midMtn.addLine(to: CGPoint(x: 0, y: 750))
            midMtn.close()
            UIColor(red: 0.26, green: 0.44, blue: 0.38, alpha: 1.0).setFill()
            midMtn.fill()

            // 4. Amusement Park Highlights (Ferris Wheel & Roller Coaster)
            let wheelCenter = CGPoint(x: 560, y: 480)
            let wheelRadius: CGFloat = 85

            UIColor(red: 0.85, green: 0.25, blue: 0.30, alpha: 1.0).setStroke()
            let legPath = UIBezierPath()
            legPath.move(to: wheelCenter)
            legPath.addLine(to: CGPoint(x: wheelCenter.x - 55, y: wheelCenter.y + 110))
            legPath.move(to: wheelCenter)
            legPath.addLine(to: CGPoint(x: wheelCenter.x + 55, y: wheelCenter.y + 110))
            legPath.lineWidth = 5
            legPath.stroke()

            UIColor(red: 0.05, green: 0.68, blue: 0.88, alpha: 0.95).setStroke()
            let outerRing = UIBezierPath(ovalIn: CGRect(x: wheelCenter.x - wheelRadius, y: wheelCenter.y - wheelRadius, width: wheelRadius * 2, height: wheelRadius * 2))
            outerRing.lineWidth = 4
            outerRing.stroke()

            let innerRing = UIBezierPath(ovalIn: CGRect(x: wheelCenter.x - wheelRadius * 0.45, y: wheelCenter.y - wheelRadius * 0.45, width: wheelRadius * 0.9, height: wheelRadius * 0.9))
            innerRing.lineWidth = 2.5
            innerRing.stroke()

            let gondolaColors: [UIColor] = [
                UIColor(red: 1.0, green: 0.30, blue: 0.35, alpha: 1.0),
                UIColor(red: 1.0, green: 0.78, blue: 0.15, alpha: 1.0),
                UIColor(red: 0.20, green: 0.80, blue: 0.50, alpha: 1.0),
                UIColor(red: 0.60, green: 0.30, blue: 0.90, alpha: 1.0),
                UIColor(red: 1.0, green: 0.50, blue: 0.10, alpha: 1.0),
                UIColor(red: 0.10, green: 0.65, blue: 0.95, alpha: 1.0)
            ]
            for i in 0..<12 {
                let ang = Double(i) * (.pi / 6.0)
                let spokeEnd = CGPoint(x: wheelCenter.x + CGFloat(cos(ang)) * wheelRadius, y: wheelCenter.y + CGFloat(sin(ang)) * wheelRadius)

                UIColor(white: 1.0, alpha: 0.75).setStroke()
                let spoke = UIBezierPath()
                spoke.move(to: wheelCenter)
                spoke.addLine(to: spokeEnd)
                spoke.lineWidth = 1.5
                spoke.stroke()

                let color = gondolaColors[i % gondolaColors.count]
                color.setFill()
                cg.fillEllipse(in: CGRect(x: spokeEnd.x - 7, y: spokeEnd.y - 7, width: 14, height: 14))
            }

            let coasterPath = UIBezierPath()
            coasterPath.move(to: CGPoint(x: 320, y: 590))
            coasterPath.addCurve(to: CGPoint(x: 440, y: 490), controlPoint1: CGPoint(x: 360, y: 510), controlPoint2: CGPoint(x: 390, y: 470))
            coasterPath.addCurve(to: CGPoint(x: 530, y: 580), controlPoint1: CGPoint(x: 480, y: 510), controlPoint2: CGPoint(x: 490, y: 580))
            coasterPath.addCurve(to: CGPoint(x: 640, y: 530), controlPoint1: CGPoint(x: 570, y: 580), controlPoint2: CGPoint(x: 600, y: 520))
            UIColor(red: 0.95, green: 0.22, blue: 0.28, alpha: 1.0).setStroke()
            coasterPath.lineWidth = 4
            coasterPath.stroke()

            // 5. Dense Evergreen Pine Forest Layers (State Park)
            let drawPine: (CGPoint, CGFloat, UIColor) -> Void = { base, height, color in
                color.setFill()
                let pine = UIBezierPath()
                let halfW = height * 0.38
                pine.move(to: CGPoint(x: base.x, y: base.y - height))
                pine.addLine(to: CGPoint(x: base.x + halfW * 0.6, y: base.y - height * 0.6))
                pine.addLine(to: CGPoint(x: base.x + halfW * 0.3, y: base.y - height * 0.6))
                pine.addLine(to: CGPoint(x: base.x + halfW * 0.85, y: base.y - height * 0.3))
                pine.addLine(to: CGPoint(x: base.x + halfW * 0.45, y: base.y - height * 0.3))
                pine.addLine(to: CGPoint(x: base.x + halfW, y: base.y))
                pine.addLine(to: CGPoint(x: base.x - halfW, y: base.y))
                pine.addLine(to: CGPoint(x: base.x - halfW * 0.45, y: base.y - height * 0.3))
                pine.addLine(to: CGPoint(x: base.x - halfW * 0.85, y: base.y - height * 0.3))
                pine.addLine(to: CGPoint(x: base.x - halfW * 0.3, y: base.y - height * 0.6))
                pine.addLine(to: CGPoint(x: base.x - halfW * 0.6, y: base.y - height * 0.6))
                pine.close()
                pine.fill()
            }

            let darkPine = UIColor(red: 0.12, green: 0.28, blue: 0.18, alpha: 1.0)
            for x in stride(from: CGFloat(20), through: CGFloat(780), by: CGFloat(38)) {
                let h: CGFloat = 80 + CGFloat((Int(x) * 17) % 35)
                drawPine(CGPoint(x: x, y: 660), h, darkPine)
            }

            let midRidge = UIBezierPath()
            midRidge.move(to: CGPoint(x: 0, y: 680))
            midRidge.addCurve(to: CGPoint(x: 450, y: 640), controlPoint1: CGPoint(x: 180, y: 640), controlPoint2: CGPoint(x: 320, y: 670))
            midRidge.addCurve(to: CGPoint(x: 800, y: 690), controlPoint1: CGPoint(x: 580, y: 610), controlPoint2: CGPoint(x: 700, y: 680))
            midRidge.addLine(to: CGPoint(x: 800, y: 900))
            midRidge.addLine(to: CGPoint(x: 0, y: 900))
            midRidge.close()
            UIColor(red: 0.18, green: 0.42, blue: 0.24, alpha: 1.0).setFill()
            midRidge.fill()

            let emeraldPine = UIColor(red: 0.15, green: 0.36, blue: 0.20, alpha: 1.0)
            for x in stride(from: CGFloat(10), through: CGFloat(790), by: CGFloat(42)) {
                let h: CGFloat = 95 + CGFloat((Int(x) * 23) % 40)
                drawPine(CGPoint(x: x, y: 720), h, emeraldPine)
            }

            // 6. State Park Alpine Lake & Water Reflections
            let waterColors = [
                UIColor(red: 0.05, green: 0.52, blue: 0.72, alpha: 1.0).cgColor,
                UIColor(red: 0.12, green: 0.68, blue: 0.82, alpha: 1.0).cgColor,
                UIColor(red: 0.25, green: 0.78, blue: 0.88, alpha: 1.0).cgColor
            ] as CFArray
            if let waterGrad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: waterColors, locations: [0.0, 0.5, 1.0]) {
                cg.drawLinearGradient(waterGrad, start: CGPoint(x: size.width * 0.5, y: 715), end: CGPoint(x: size.width * 0.5, y: 975), options: [])
            }

            UIColor(white: 1.0, alpha: 0.40).setStroke()
            for y in stride(from: CGFloat(735), through: CGFloat(950), by: CGFloat(22)) {
                let ripple = UIBezierPath()
                let startX = CGFloat((Int(y) * 47) % 200) + 40
                let length = 120 + CGFloat((Int(y) * 31) % 180)
                ripple.move(to: CGPoint(x: startX, y: y))
                ripple.addLine(to: CGPoint(x: startX + length, y: y))
                ripple.lineWidth = 2.0
                ripple.stroke()
            }

            // 7. Foreground Lakeshore Grass & Wildflower Meadow
            let meadowPath = UIBezierPath()
            meadowPath.move(to: CGPoint(x: 0, y: 910))
            meadowPath.addCurve(to: CGPoint(x: 400, y: 880), controlPoint1: CGPoint(x: 120, y: 920), controlPoint2: CGPoint(x: 260, y: 870))
            meadowPath.addCurve(to: CGPoint(x: 800, y: 925), controlPoint1: CGPoint(x: 540, y: 890), controlPoint2: CGPoint(x: 680, y: 940))
            meadowPath.addLine(to: CGPoint(x: 800, y: size.height))
            meadowPath.addLine(to: CGPoint(x: 0, y: size.height))
            meadowPath.close()
            UIColor(red: 0.28, green: 0.58, blue: 0.22, alpha: 1.0).setFill()
            meadowPath.fill()

            let flowerColors: [UIColor] = [
                UIColor(red: 1.0, green: 0.35, blue: 0.40, alpha: 1.0),
                UIColor(red: 1.0, green: 0.85, blue: 0.20, alpha: 1.0),
                UIColor(red: 0.90, green: 0.40, blue: 0.90, alpha: 1.0),
                UIColor.white
            ]
            for x in stride(from: CGFloat(30), through: CGFloat(770), by: CGFloat(28)) {
                let y = 925 + CGFloat((Int(x) * 19) % 220)
                let color = flowerColors[Int(x) % flowerColors.count]
                color.setFill()
                cg.fillEllipse(in: CGRect(x: x, y: y, width: 9, height: 9))
            }

            // Wooden Trail Fence (State Park look)
            UIColor(red: 0.58, green: 0.38, blue: 0.22, alpha: 1.0).setFill()
            for x in stride(from: CGFloat(60), through: CGFloat(740), by: CGFloat(140)) {
                let post = UIBezierPath(roundedRect: CGRect(x: x, y: 940, width: 14, height: 80), cornerRadius: 4)
                post.fill()
            }
            UIColor(red: 0.64, green: 0.44, blue: 0.26, alpha: 1.0).setStroke()
            let rail1 = UIBezierPath()
            rail1.move(to: CGPoint(x: 40, y: 960))
            rail1.addLine(to: CGPoint(x: 760, y: 960))
            rail1.lineWidth = 6
            rail1.stroke()

            let rail2 = UIBezierPath()
            rail2.move(to: CGPoint(x: 40, y: 990))
            rail2.addLine(to: CGPoint(x: 760, y: 990))
            rail2.lineWidth = 6
            rail2.stroke()
        }
    }
}
