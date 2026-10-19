import SwiftUI

/// Full screen while the phone listens: a waveform that follows the voice, Done to log, Cancel to
/// throw the audio away. Opens on a tap of the mic button, the Action Button or the Siri shortcut.
struct ListeningView: View {
    /// Whisper reads 30 s at a time; a forgotten recording finishes itself there.
    static let maxDuration: TimeInterval = 30
    @EnvironmentObject var model: AppModel
    @State private var started = Date()
    @State private var meter = Meter()

    var body: some View {
        ZStack {
            Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
            Theme.accent.opacity(0.12).ignoresSafeArea()
            VStack(spacing: 28) {
                Spacer()
                Text("Listening…").font(.largeTitle.bold())
                Text("Say what happened, like “left side, ten minutes” or “wet diaper”.")
                    .font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                SwiftUI.TimelineView(.animation) { context in
                    let elapsed = context.date.timeIntervalSince(started)
                    VStack(spacing: 18) {
                        Waveform(level: meter.next(model.voiceLevel()), time: context.date.timeIntervalSinceReferenceDate)
                            .frame(height: 140)
                        Text(Duration.seconds(elapsed).formatted(.time(pattern: .minuteSecond)))
                            .font(.title3.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    .onChange(of: elapsed >= Self.maxDuration) { _, over in if over { model.stopVoice() } }
                }
                .padding(.horizontal, 24)
                Spacer()
                Button { model.stopVoice() } label: {
                    Image(systemName: "checkmark").font(.system(size: 34, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 88, height: 88)
                        .background(Theme.accent, in: Circle())
                        .shadow(color: Theme.accent.opacity(0.4), radius: 16, y: 6)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Done, log it")
                .accessibilityIdentifier("voiceDone")
                Button("Cancel", role: .cancel) { model.cancelVoice() }
                    .font(.headline).foregroundStyle(.secondary)
                    .accessibilityIdentifier("voiceCancel")
                    .padding(.bottom, 24)
            }
        }
        .onAppear { started = Date() }
    }

    /// Smooths the mic level: rises fast, falls slowly, so the wave breathes instead of flickering.
    final class Meter {
        private var value: Double = 0
        func next(_ level: Float) -> Double {
            let target = Double(level)
            value += (target - value) * (target > value ? 0.5 : 0.12)
            return value
        }
    }
}

/// Bars that ripple with time and swell with the voice level (0…1); a low hum when silent.
private struct Waveform: View {
    let level: Double
    let time: TimeInterval
    private let bars = 36

    var body: some View {
        Canvas { context, size in
            let gap: CGFloat = 4
            let width = (size.width - gap * CGFloat(bars - 1)) / CGFloat(bars)
            for i in 0..<bars {
                let x = Double(i) / Double(bars - 1)
                let envelope = sin(x * .pi)   // taller in the middle
                let ripple = 0.55 + 0.45 * sin(time * 6 + Double(i) * 0.55) * sin(time * 2.3 + Double(i) * 0.2)
                let height = max(width, size.height * (0.06 + 0.94 * level * envelope * ripple))
                let rect = CGRect(x: CGFloat(i) * (width + gap), y: (size.height - height) / 2, width: width, height: height)
                context.fill(Path(roundedRect: rect, cornerRadius: width / 2),
                             with: .color(Theme.accent.opacity(0.55 + 0.45 * envelope)))
            }
        }
        .accessibilityHidden(true)
    }
}
