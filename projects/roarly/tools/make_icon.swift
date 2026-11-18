// Draws Roarly's app icon (1024x1024 PNG): a lantern-gold moon in a night sky with sound waves
// rolling out of an open storybook. Usage: swift tools/make_icon.swift <out.png>
import AppKit

let size: CGFloat = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

let sky = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [
    CGColor(red: 0.12, green: 0.11, blue: 0.32, alpha: 1), CGColor(red: 0.03, green: 0.03, blue: 0.12, alpha: 1)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(sky, start: CGPoint(x: 0, y: size), end: CGPoint(x: 0, y: 0), options: [])

// Stars.
var seed: UInt64 = 42
func rnd() -> CGFloat { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return CGFloat((seed >> 33) % 10000) / 10000 }
for _ in 0..<40 {
    let r = 3 + rnd() * 6
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.25 + rnd() * 0.5))
    ctx.fillEllipse(in: CGRect(x: rnd() * size, y: 420 + rnd() * 580, width: r, height: r))
}

// Glow + moon.
let center = CGPoint(x: 512, y: 600)
let glow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [
    CGColor(red: 1, green: 0.78, blue: 0.34, alpha: 0.55), CGColor(red: 1, green: 0.78, blue: 0.34, alpha: 0)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: center, startRadius: 120, endCenter: center, endRadius: 470, options: [])
ctx.setFillColor(CGColor(red: 1, green: 0.80, blue: 0.38, alpha: 1))
ctx.fillEllipse(in: CGRect(x: center.x - 200, y: center.y - 200, width: 400, height: 400))

// Sound waves from the book up into the moon.
ctx.setStrokeColor(CGColor(red: 0.07, green: 0.07, blue: 0.22, alpha: 1))
ctx.setLineCap(.round)
for (i, r) in [70.0, 130.0, 190.0].enumerated() {
    ctx.setLineWidth(CGFloat(34 - i * 4))
    ctx.addArc(center: CGPoint(x: 512, y: 420), radius: CGFloat(r), startAngle: .pi * 0.28, endAngle: .pi * 0.72, clockwise: false)
    ctx.strokePath()
}

// Open book.
let book = CGMutablePath()
book.move(to: CGPoint(x: 512, y: 300))
book.addCurve(to: CGPoint(x: 170, y: 330), control1: CGPoint(x: 420, y: 360), control2: CGPoint(x: 260, y: 370))
book.addLine(to: CGPoint(x: 170, y: 170))
book.addCurve(to: CGPoint(x: 512, y: 150), control1: CGPoint(x: 280, y: 210), control2: CGPoint(x: 420, y: 200))
book.addCurve(to: CGPoint(x: 854, y: 170), control1: CGPoint(x: 604, y: 200), control2: CGPoint(x: 744, y: 210))
book.addLine(to: CGPoint(x: 854, y: 330))
book.addCurve(to: CGPoint(x: 512, y: 300), control1: CGPoint(x: 764, y: 370), control2: CGPoint(x: 604, y: 360))
book.closeSubpath()
ctx.setFillColor(CGColor(red: 0.95, green: 0.93, blue: 0.86, alpha: 1))
ctx.addPath(book)
ctx.fillPath()
ctx.setStrokeColor(CGColor(red: 0.75, green: 0.70, blue: 0.62, alpha: 1))
ctx.setLineWidth(10)
ctx.move(to: CGPoint(x: 512, y: 300))
ctx.addLine(to: CGPoint(x: 512, y: 150))
ctx.strokePath()

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
