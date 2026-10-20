import LogCore
import SwiftUI

enum AutoStopVoice {
    static let key = "autoStopVoice"
}

/// Full screen while the phone listens: a waveform that follows the voice, live transcript + parsed
/// field pills, optional silence auto-stop (Settings → Voice), Done to log, Cancel to throw away.
struct ListeningView: View {
    /// Whisper reads 30 s at a time; a forgotten recording finishes itself there.
    static let maxDuration: TimeInterval = 30
    static let silenceAutoStopSeconds: TimeInterval = 1.8
    @EnvironmentObject var model: AppModel
    @AppStorage(AutoStopVoice.key) private var autoStop = false
    @State private var started = Date()
    @State private var meter = Meter()
    @State private var spokeAt: Date?
    @State private var silentSince: Date?

    var body: some View {
        let chips = Parsers.liveChips(in: model.liveTranscript, reference: started)
        ZStack {
            Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
            Theme.accent.opacity(0.12).ignoresSafeArea()
            VStack(spacing: 22) {
                Spacer()
                if autoStop {
                    Label("Auto-logs after pause", systemImage: "waveform.badge.checkmark")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Theme.accent.opacity(0.15), in: Capsule())
                }
                Text("Listening…").font(.largeTitle.bold())
                VStack(spacing: 10) {
                    if model.liveTranscript.isEmpty {
                        if spokeAt != nil {
                            HStack(spacing: 8) {
                                ProgressView().controlSize(.small)
                                Text("Transcribing live…")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(.secondary)
                            }
                        } else {
                            Text("Say what happened, like “left side, ten minutes” or “wet diaper”.")
                                .font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        }
                    } else {
                        Text("“\(model.liveTranscript)”")
                            .font(.title3.weight(.semibold))
                            .multilineTextAlignment(.center)
                            .accessibilityIdentifier("liveTranscript")
                        if !chips.isEmpty {
                            HStack(spacing: 6) {
                                ForEach(chips, id: \.self) { chip in
                                    Text(chip)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Theme.accent)
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(Theme.accent.opacity(0.18), in: Capsule())
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, minHeight: 76)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .padding(.horizontal, 24)
                SwiftUI.TimelineView(.animation) { context in
                    let raw = model.voiceLevel()
                    let smoothed = meter.next(raw)
                    let elapsed = context.date.timeIntervalSince(started)
                    VStack(spacing: 18) {
                        Waveform(level: smoothed, time: context.date.timeIntervalSinceReferenceDate)
                            .frame(height: 140)
                        Text(Duration.seconds(elapsed).formatted(.time(pattern: .minuteSecond)) + (autoStop && spokeAt != nil ? " · pause to log" : ""))
                            .font(.title3.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    .onChange(of: elapsed >= Self.maxDuration) { _, over in if over { model.stopVoice() } }
                    .onChange(of: Int(elapsed * 10)) { _, _ in
                        let now = context.date
                        if raw > 0.20 {
                            if spokeAt == nil { spokeAt = now }
                            silentSince = nil
                        } else if autoStop, let spoke = spokeAt, now.timeIntervalSince(spoke) >= 0.8, raw < 0.08 {
                            if let silent = silentSince {
                                if now.timeIntervalSince(silent) >= Self.silenceAutoStopSeconds {
                                    model.stopVoice()
                                }
                            } else {
                                silentSince = now
                            }
                        }
                    }
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
        .onAppear {
            started = Date()
            spokeAt = nil
            silentSince = nil
        }
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
