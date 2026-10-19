import AppKit
import CoreGraphics

func renderIcon(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return image
    }
    
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let s = size / 1024.0
    
    // Background gradient
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bgColors = [
        CGColor(red: 1.0, green: 0.42, blue: 0.42, alpha: 1.0), // Coral
        CGColor(red: 1.0, green: 0.75, blue: 0.28, alpha: 1.0), // Sunshine Amber
        CGColor(red: 0.27, green: 0.82, blue: 0.71, alpha: 1.0)  // Teal
    ] as CFArray
    let bgLocations: [CGFloat] = [0.0, 0.55, 1.0]
    if let gradient = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: bgLocations) {
        ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: size), end: CGPoint(x: size, y: 0), options: [])
    }
    
    // Cheerful camera body (Rounded rectangle)
    let camRect = CGRect(x: 180 * s, y: 220 * s, width: 664 * s, height: 500 * s)
    let camPath = CGPath(roundedRect: camRect, cornerWidth: 90 * s, cornerHeight: 90 * s, transform: nil)
    
    // Camera top hump / viewfinder top
    let topHumpRect = CGRect(x: 380 * s, y: 700 * s, width: 264 * s, height: 70 * s)
    let topHumpPath = CGPath(roundedRect: topHumpRect, cornerWidth: 35 * s, cornerHeight: 35 * s, transform: nil)
    
    // Drop shadow
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -18 * s), blur: 30 * s, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.25))
    ctx.setFillColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.95))
    ctx.addPath(topHumpPath)
    ctx.fillPath()
    ctx.addPath(camPath)
    ctx.fillPath()
    ctx.restoreGState()
    
    // Fun top shutter button (big red bouncy button)
    let shutterBtnRect = CGRect(x: 230 * s, y: 710 * s, width: 110 * s, height: 40 * s)
    let shutterBtnPath = CGPath(roundedRect: shutterBtnRect, cornerWidth: 15 * s, cornerHeight: 15 * s, transform: nil)
    ctx.setFillColor(CGColor(red: 1.0, green: 0.35, blue: 0.38, alpha: 1.0))
    ctx.addPath(shutterBtnPath)
    ctx.fillPath()
    
    // Fun top flash light (bright yellow)
    let flashRect = CGRect(x: 690 * s, y: 710 * s, width: 80 * s, height: 35 * s)
    let flashPath = CGPath(roundedRect: flashRect, cornerWidth: 12 * s, cornerHeight: 12 * s, transform: nil)
    ctx.setFillColor(CGColor(red: 1.0, green: 0.88, blue: 0.20, alpha: 1.0))
    ctx.addPath(flashPath)
    ctx.fillPath()
    
    // Main big camera lens outer ring (Dual camera 1)
    let outerLensRect = CGRect(x: 312 * s, y: 270 * s, width: 400 * s, height: 400 * s)
    ctx.setFillColor(CGColor(red: 0.18, green: 0.24, blue: 0.38, alpha: 1.0)) // Deep navy
    ctx.fillEllipse(in: outerLensRect)
    
    // Lens middle ring (Cyan ring)
    let midLensRect = CGRect(x: 352 * s, y: 310 * s, width: 320 * s, height: 320 * s)
    ctx.setFillColor(CGColor(red: 0.30, green: 0.78, blue: 0.89, alpha: 1.0))
    ctx.fillEllipse(in: midLensRect)
    
    // Lens inner aperture (Dark lens core)
    let innerLensRect = CGRect(x: 392 * s, y: 350 * s, width: 240 * s, height: 240 * s)
    ctx.setFillColor(CGColor(red: 0.10, green: 0.14, blue: 0.24, alpha: 1.0))
    ctx.fillEllipse(in: innerLensRect)
    
    // Cute smiley face inside main lens (Toddler front camera smile)
    // Eyes
    ctx.setFillColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0))
    ctx.fillEllipse(in: CGRect(x: 445 * s, y: 495 * s, width: 32 * s, height: 40 * s))
    ctx.fillEllipse(in: CGRect(x: 547 * s, y: 495 * s, width: 32 * s, height: 40 * s))
    // Cheerful smile
    ctx.setStrokeColor(CGColor(red: 1.0, green: 0.80, blue: 0.25, alpha: 1.0))
    ctx.setLineWidth(14 * s)
    ctx.setLineCap(.round)
    ctx.beginPath()
    ctx.addArc(center: CGPoint(x: 512 * s, y: 450 * s), radius: 45 * s, startAngle: CGFloat.pi * 1.15, endAngle: CGFloat.pi * 1.85, clockwise: false)
    ctx.strokePath()
    
    // Secondary mini camera bubble in top-left of camera (Dual camera PiP)
    let pipLensRect = CGRect(x: 215 * s, y: 520 * s, width: 130 * s, height: 130 * s)
    ctx.setFillColor(CGColor(red: 1.0, green: 0.88, blue: 0.20, alpha: 1.0)) // Warm yellow badge
    ctx.fillEllipse(in: pipLensRect)
    let pipInner = CGRect(x: 235 * s, y: 540 * s, width: 90 * s, height: 90 * s)
    ctx.setFillColor(CGColor(red: 0.18, green: 0.24, blue: 0.38, alpha: 1.0))
    ctx.fillEllipse(in: pipInner)
    // Mini aperture dot
    ctx.setFillColor(CGColor(red: 0.30, green: 0.78, blue: 0.89, alpha: 1.0))
    ctx.fillEllipse(in: CGRect(x: 265 * s, y: 570 * s, width: 30 * s, height: 30 * s))
    
    // Apple Watch Remote Badge in bottom right!
    let watchBadgeRect = CGRect(x: 640 * s, y: 140 * s, width: 230 * s, height: 230 * s)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -10 * s), blur: 20 * s, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.3))
    ctx.setFillColor(CGColor(red: 0.15, green: 0.20, blue: 0.30, alpha: 0.98)) // Watch body
    let watchPath = CGPath(roundedRect: watchBadgeRect, cornerWidth: 55 * s, cornerHeight: 55 * s, transform: nil)
    ctx.addPath(watchPath)
    ctx.fillPath()
    ctx.restoreGState()
    
    // Watch screen
    let watchScreenRect = CGRect(x: 665 * s, y: 165 * s, width: 180 * s, height: 180 * s)
    let watchScreenPath = CGPath(roundedRect: watchScreenRect, cornerWidth: 38 * s, cornerHeight: 38 * s, transform: nil)
    ctx.setFillColor(CGColor(red: 0.05, green: 0.08, blue: 0.15, alpha: 1.0))
    ctx.addPath(watchScreenPath)
    ctx.fillPath()
    
    // Remote shutter button inside watch screen
    ctx.setFillColor(CGColor(red: 1.0, green: 0.35, blue: 0.38, alpha: 1.0))
    ctx.fillEllipse(in: CGRect(x: 710 * s, y: 210 * s, width: 90 * s, height: 90 * s))
    // Radio signal waves from watch
    ctx.setStrokeColor(CGColor(red: 0.30, green: 0.78, blue: 0.89, alpha: 1.0))
    ctx.setLineWidth(8 * s)
    ctx.beginPath()
    ctx.addArc(center: CGPoint(x: 755 * s, y: 255 * s), radius: 65 * s, startAngle: CGFloat.pi * 0.4, endAngle: CGFloat.pi * 0.9, clockwise: false)
    ctx.strokePath()
    
    // Playful sparkles in background
    func drawSparkle(center: CGPoint, r: CGFloat) {
        ctx.setFillColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.85))
        let path = CGMutablePath()
        path.move(to: CGPoint(x: center.x, y: center.y - r))
        path.addQuadCurve(to: CGPoint(x: center.x + r, y: center.y), control: CGPoint(x: center.x + r*0.2, y: center.y - r*0.2))
        path.addQuadCurve(to: CGPoint(x: center.x, y: center.y + r), control: CGPoint(x: center.x + r*0.2, y: center.y + r*0.2))
        path.addQuadCurve(to: CGPoint(x: center.x - r, y: center.y), control: CGPoint(x: center.x - r*0.2, y: center.y + r*0.2))
        path.addQuadCurve(to: CGPoint(x: center.x, y: center.y - r), control: CGPoint(x: center.x - r*0.2, y: center.y - r*0.2))
        ctx.addPath(path)
        ctx.fillPath()
    }
    
    drawSparkle(center: CGPoint(x: 160 * s, y: 840 * s), r: 40 * s)
    drawSparkle(center: CGPoint(x: 880 * s, y: 800 * s), r: 50 * s)
    drawSparkle(center: CGPoint(x: 130 * s, y: 380 * s), r: 30 * s)
    
    image.unlockFocus()
    return image
}

func savePNG(image: NSImage, path: String) {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        fatalError("Failed to convert image to PNG")
    }
    try! png.write(to: URL(fileURLWithPath: path))
    print("Saved \(path)")
}

let icon1024 = renderIcon(size: 1024)
savePNG(image: icon1024, path: "KidsCam/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png")
savePNG(image: icon1024, path: "KidsCamWatch/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png")
savePNG(image: icon1024, path: "AppStore/AppIcon-1024.png")
print("Icons generated successfully!")
