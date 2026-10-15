import SwiftUI

/// Bespoke Voxbrief "V-Wave" vector brand mark: a left diagonal stroke
/// paired with 4 stepped audio equalizer bars forming a modern flat 'V'.
public struct VWaveMarkView: View {
    public var color: Color

    public init(color: Color = .white) {
        self.color = color
    }

    public var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height

            let stemWidth = w * 0.125
            let barWidth = w * 0.11
            let cornerRadius = barWidth / 2

            ZStack {
                // Left diagonal stem of the 'V'
                Path { path in
                    let start = CGPoint(x: w * 0.27, y: h * 0.28)
                    let end = CGPoint(x: w * 0.44, y: h * 0.72)
                    path.move(to: start)
                    path.addLine(to: end)
                }
                .stroke(color, style: StrokeStyle(lineWidth: stemWidth, lineCap: .round, lineJoin: .round))

                // Right arm: 4 stepped equalizer waveform bars
                Group {
                    // Bar 1 (near vertex)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.16)
                        .position(x: w * 0.53, y: h * 0.65)

                    // Bar 2 (mid)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.30)
                        .position(x: w * 0.61, y: h * 0.53)

                    // Bar 3 (peak voice bar)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.42)
                        .position(x: w * 0.69, y: h * 0.41)

                    // Bar 4 (top-right exit)
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(color)
                        .frame(width: barWidth, height: h * 0.28)
                        .position(x: w * 0.77, y: h * 0.32)
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
        case .large: return 34
        case .inline: return 26
        case .watch: return 18
        }
    }

    private var iconCornerRadius: CGFloat {
        switch size {
        case .large: return 8
        case .inline: return 6
        case .watch: return 4.5
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
                    .frame(width: iconDimension * 0.82, height: iconDimension * 0.82)
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
