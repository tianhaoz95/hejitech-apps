import SwiftUI

// MARK: - Star Shape

struct StarShape: Shape {
    var points: Int = 5
    var smoothness: CGFloat = 0.45
    
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.width / 2, y: rect.height / 2)
        let outerRadius = min(rect.width, rect.height) / 2
        let innerRadius = outerRadius * smoothness
        let totalPoints = points * 2
        let angleStep = (CGFloat.pi * 2) / CGFloat(totalPoints)
        
        for i in 0..<totalPoints {
            let radius = (i % 2 == 0) ? outerRadius : innerRadius
            let angle = CGFloat(i) * angleStep - CGFloat.pi / 2
            let pt = CGPoint(
                x: center.x + cos(angle) * radius,
                y: center.y + sin(angle) * radius
            )
            if i == 0 {
                path.move(to: pt)
            } else {
                path.addLine(to: pt)
            }
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Heart Shape

struct HeartShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        
        path.move(to: CGPoint(x: width * 0.5, y: height * 0.85))
        
        path.addCurve(
            to: CGPoint(x: width * 0.05, y: height * 0.35),
            control1: CGPoint(x: width * 0.2, y: height * 0.7),
            control2: CGPoint(x: width * 0.05, y: height * 0.55)
        )
        
        path.addArc(
            center: CGPoint(x: width * 0.3, y: height * 0.3),
            radius: width * 0.25,
            startAngle: .degrees(180),
            endAngle: .degrees(0),
            clockwise: false
        )
        
        path.addArc(
            center: CGPoint(x: width * 0.7, y: height * 0.3),
            radius: width * 0.25,
            startAngle: .degrees(180),
            endAngle: .degrees(0),
            clockwise: false
        )
        
        path.addCurve(
            to: CGPoint(x: width * 0.5, y: height * 0.85),
            control1: CGPoint(x: width * 0.95, y: height * 0.55),
            control2: CGPoint(x: width * 0.8, y: height * 0.7)
        )
        
        path.closeSubpath()
        return path
    }
}

// MARK: - Crescent Moon Shape

struct CrescentMoonShape: Shape {
    var progress: CGFloat = 0.65
    
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let radius = min(rect.width, rect.height) / 2
        let center = CGPoint(x: rect.width / 2, y: rect.height / 2)
        
        // Outer arc
        path.addArc(
            center: center,
            radius: radius,
            startAngle: .degrees(-90),
            endAngle: .degrees(90),
            clockwise: false
        )
        
        // Inner arc cut
        path.addCurve(
            to: CGPoint(x: center.x, y: center.y - radius),
            control1: CGPoint(x: center.x + radius * (1 - progress), y: center.y + radius * 0.5),
            control2: CGPoint(x: center.x + radius * (1 - progress), y: center.y - radius * 0.5)
        )
        
        path.closeSubpath()
        return path
    }
}

// MARK: - Bubble View

struct BubbleView: View {
    let color: Color
    let size: CGFloat
    
    var body: some View {
        ZStack {
            // Bubble base body
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            color.opacity(0.4),
                            color.opacity(0.8),
                            Color.white.opacity(0.9)
                        ],
                        center: .center,
                        startRadius: size * 0.1,
                        endRadius: size * 0.5
                    )
                )
                .frame(width: size, height: size)
            
            // Outer bright rim
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.9),
                            color.opacity(0.6),
                            Color.white.opacity(0.3)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: max(1.5, size * 0.05)
                )
                .frame(width: size, height: size)
            
            // Specular shiny glint
            Ellipse()
                .fill(Color.white.opacity(0.85))
                .frame(width: size * 0.28, height: size * 0.18)
                .rotationEffect(.degrees(-35))
                .offset(x: -size * 0.22, y: -size * 0.22)
            
            // Secondary small glint
            Circle()
                .fill(Color.white.opacity(0.6))
                .frame(width: size * 0.1, height: size * 0.1)
                .offset(x: size * 0.25, y: size * 0.22)
        }
        .shadow(color: color.opacity(0.4), radius: 4, x: 0, y: 2)
    }
}
