import SwiftUI

/// Bespoke Voxbrief "V-Wave" vector brand mark: a left diagonal stroke
/// paired with 3 widely-spaced audio equalizer bars forming a modern flat 'V'.
public struct VWaveMarkView: View {
    public var color: Color

    public init(color: Color = .white) {
        self.color = color
    }

    public var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height

            let stemWidth = w * 0.10
            let barWidth = w * 0.08
            let cornerRadius = barWidth / 2

            ZStack {
                // Left diagonal stem of the 'V'
                Path { path in
                    let start = CGPoint(x: w * 0.18, y: h * 0.24)
                    let end = CGPoint(x: w * 0.36, y: h * 0.76)
                    path.move(to: start)
                    path.addLine(to: end)
                }
                .stroke(color, style: StrokeStyle(lineWidth: stemWidth, lineCap: .round, lineJoin: .round))

                // Right arm: 3 widely spaced equalizer waveform bars (1:1 bar to gap ratio)
                Group {
                    // Bar 1 (near vertex)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.20)
                        .position(x: w * 0.52, y: h * 0.63)

                    // Bar 2 (mid voice)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.32)
                        .position(x: w * 0.68, y: h * 0.53)

                    // Bar 3 (peak voice bar)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.44)
                        .position(x: w * 0.84, y: h * 0.44)
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

public struct VoxbriefLogoView: View {
    public enum Size {
        case large
        case inline
        case watch
    }

    public var size: Size

    public init(size: Size = .large) {
        self.size = size
    }

    private var iconDimension: CGFloat {
        switch size {
        case .large: return 36
        case .inline: return 28
        case .watch: return 22
        }
    }

    private var iconCornerRadius: CGFloat {
        switch size {
        case .large: return 8
        case .inline: return 6.5
        case .watch: return 5
        }
    }

    private var fontSize: CGFloat {
        switch size {
        case .large: return 32
        case .inline: return 18
        case .watch: return 14
        }
    }

    private var spacing: CGFloat {
        switch size {
        case .large: return 10
        case .inline: return 7
        case .watch: return 5
        }
    }

    public var body: some View {
        HStack(spacing: spacing) {
            ZStack {
                // Flat Apple Royal Blue squircle background (zero 3D gloss, zero shadows)
                RoundedRectangle(cornerRadius: iconCornerRadius, style: .continuous)
                    .fill(Color(red: 0.055, green: 0.392, blue: 0.965))
                    .frame(width: iconDimension, height: iconDimension)

                VWaveMarkView(color: .white)
                    .frame(width: iconDimension * 0.74, height: iconDimension * 0.74)
            }

            HStack(spacing: 0) {
                Text("Vox")
                    .foregroundStyle(.primary)
                Text("Brief")
                    .foregroundStyle(Color.accentColor)
            }
            .font(.system(size: fontSize, weight: .bold, design: .rounded))
            .tracking(-0.5)
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("VoxBrief")
    }
}
