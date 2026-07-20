import SwiftUI

public extension View {
    /// Liquid Glass where available (iOS/watchOS 26+), falling back to a
    /// plain translucent material on earlier OS versions. Used deliberately
    /// on the capture button and live-status banners — the two places this
    /// app reaches for a custom glass treatment rather than relying on
    /// system chrome (tab bars, nav bars) to pick Liquid Glass up for free.
    @ViewBuilder
    func contempoGlass<S: Shape>(tint: Color? = nil, in shape: S) -> some View {
        if #available(iOS 26.0, watchOS 26.0, macOS 26.0, *) {
            self.glassEffect(tint.map { Glass.regular.tint($0) } ?? .regular, in: shape)
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }
}

/// The landing page's `.eyebrow` element: a short leading rule + a small
/// uppercase mono label in pine, sitting above a section/screen title.
public struct Eyebrow: View {
    private let text: String

    public init(_ text: String) {
        self.text = text
    }

    public var body: some View {
        EyebrowBody(text: text)
    }

    private struct EyebrowBody: View {
        let text: String
        @Environment(\.contempoPalette) private var palette

        var body: some View {
            HStack(spacing: 8) {
                Rectangle()
                    .fill(palette.pine)
                    .frame(width: 20, height: 1)
                Text(text.uppercased())
                    .font(ContempoFont.labelSmall())
                    .tracking(ContempoFont.labelSmallTracking)
                    .foregroundStyle(palette.pine)
            }
        }
    }
}

/// The landing page's `.rec-pill` — a pulsing dot + a small mono label, used
/// there for the recording-indicator mockup. Reused for Capture's real
/// listening state: a danger-colored pulsing dot (0.8s ease-in-out, full to
/// ~35% opacity, reversing) next to uppercase mono text, on a tinted pill
/// background.
public struct RecordingIndicator: View {
    private let text: String
    @Environment(\.contempoPalette) private var palette
    @State private var dotOpacity: Double = 1

    public init(_ text: String) {
        self.text = text
    }

    public var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(palette.danger)
                .frame(width: 6, height: 6)
                .opacity(dotOpacity)
            Text(text.uppercased())
                .font(ContempoFont.labelSmall())
                .tracking(ContempoFont.labelSmallTracking)
                .foregroundStyle(palette.danger)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(palette.dangerTint, in: Capsule())
        .onAppear {
            withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: true)) {
                dotOpacity = 0.35
            }
        }
    }
}

/// The landing page's `.mock-card`/`.feature-card` treatment: a flat surface
/// with a hairline border rather than a translucent tonal-tint elevation
/// look — `tonalElevation = 0` matters on Android for the same reason this
/// has no shadow here.
public struct ContempoCard<Content: View>: View {
    private let content: Content
    @Environment(\.contempoPalette) private var palette

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .background(palette.paperRaised)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.large)
                    .stroke(palette.hairline, lineWidth: 1)
            )
    }
}

/// Renders the parse prompt's only allowed markdown construct — lines
/// starting with "- " — as an actual bullet list; anything else (the common
/// single-task case) is just a plain paragraph. Hand-rolled rather than a
/// markdown library since bullets are the only formatting AgentClient's
/// prompt ever produces.
public struct BulletAwareText: View {
    private let text: String
    private let font: Font

    public init(_ text: String, font: Font = ContempoFont.bodyLarge()) {
        self.text = text
        self.font = font
    }

    public var body: some View {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        if lines.contains(where: { $0.trimmingCharacters(in: .whitespaces).hasPrefix("- ") }) {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    let trimmed = line.trimmingCharacters(in: .whitespaces)
                    if trimmed.hasPrefix("- ") {
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                            Text(trimmed.dropFirst(2))
                        }
                        .font(font)
                    } else if !trimmed.isEmpty {
                        Text(trimmed).font(font)
                    }
                }
            }
        } else {
            Text(text).font(font)
        }
    }
}
