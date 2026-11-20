import SwiftUI

/// The Pipeline tab's timeline: an overview of the whole run (step N of M, how far, time left)
/// over every step the note goes through, in order. The step running now has an animated bar of
/// its pieces or parts with the time left at its pace; done steps show how long they took; a
/// paused step (the app was closed) shows where it stopped.
struct PipelineTimelineView: View {
    let steps: [PipelineTimelineStep]

    private var currentIndex: Int? {
        steps.firstIndex { $0.state == .active || $0.state == .paused || $0.state == .failed }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            PipelineOverviewCard(steps: steps, currentIndex: currentIndex)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    PipelineTimelineRow(step: step, number: index + 1, isLast: index == steps.count - 1)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: steps)
    }
}

// MARK: - Overview

private struct PipelineOverviewCard: View {
    let steps: [PipelineTimelineStep]
    let currentIndex: Int?

    private var current: PipelineTimelineStep? { currentIndex.map { steps[$0] } }

    private var overall: Double {
        guard !steps.isEmpty else { return 0 }
        return steps.map(\.fraction).reduce(0, +) / Double(steps.count)
    }

    private var tint: Color {
        switch current?.state {
        case .paused: return .orange
        case .failed: return .red
        case .active: return .accentColor
        default: return steps.allSatisfy { $0.state == .done } ? .green : .secondary
        }
    }

    private var headline: String {
        switch current?.state {
        case .active: return "Processing"
        case .paused: return "Paused"
        case .failed: return "Stopped"
        default: return steps.allSatisfy { $0.state == .done } ? "Ready" : "Waiting"
        }
    }

    private var subtitle: String {
        if let currentIndex, let current {
            return "Step \(currentIndex + 1) of \(steps.count) · \(current.title)"
        }
        let total = steps.compactMap(\.seconds).reduce(0, +)
        if total > 0 { return "\(steps.count) steps in \(PipelineTimeFormat.duration(total))" }
        return "\(steps.count) steps"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(headline)
                        .font(.headline)
                        .foregroundStyle(tint)
                        .contentTransition(.opacity)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .contentTransition(.opacity)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(Int((overall * 100).rounded()))%")
                        .font(.title3.weight(.bold).monospacedDigit())
                        .contentTransition(.numericText())
                    if let current, current.state == .active, let progress = current.progress {
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            if let left = progress.secondsLeft(at: context.date) {
                                Text(PipelineTimeFormat.left(left))
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            SegmentedStepsBar(steps: steps)
        }
        .padding(16)
        .background(
            LinearGradient(colors: [tint.opacity(0.14), tint.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .accessibilityElement(children: .combine)
    }
}

/// One segment per step, each filled as far as that step has got.
private struct SegmentedStepsBar: View {
    let steps: [PipelineTimelineStep]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(steps) { step in
                PipelineProgressBar(
                    fraction: step.state == .active && step.progress?.fraction == nil ? nil : step.fraction,
                    tint: PipelineTimelineRow.tint(for: step.state),
                    isAnimating: step.state == .active,
                    height: 6
                )
            }
        }
    }
}

// MARK: - Row

private struct PipelineTimelineRow: View {
    let step: PipelineTimelineStep
    let number: Int
    let isLast: Bool

    static func tint(for state: PipelineTimelineStep.State) -> Color {
        switch state {
        case .done: return .green
        case .active: return .accentColor
        case .paused: return .orange
        case .failed: return .red
        case .pending: return .secondary
        }
    }

    private var isCurrent: Bool { step.state == .active || step.state == .paused }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            StepNode(step: step, number: number)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(step.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(step.state == .pending ? .secondary : .primary)
                    Spacer(minLength: 8)
                    trailingLabel
                }
                Text(step.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                if isCurrent {
                    StepProgressDetail(step: step)
                        .padding(.top, 6)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(.top, 4)
            .padding(.bottom, isLast ? 16 : 20)
        }
        .background(alignment: .topLeading) {
            if !isLast {
                ConnectorLine(filled: step.state == .done, flowing: step.state == .active)
                    .frame(width: 2)
                    .padding(.top, 34)
                    .padding(.leading, 14)
                    .padding(.bottom, 2)
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var trailingLabel: some View {
        switch step.state {
        case .done:
            if let seconds = step.seconds {
                Text(PipelineTimeFormat.duration(seconds))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        case .paused:
            Text("Paused").font(.caption.weight(.semibold)).foregroundStyle(.orange)
        case .failed:
            Text("Didn't finish").font(.caption.weight(.semibold)).foregroundStyle(.red)
        case .active, .pending:
            EmptyView()
        }
    }
}

private struct StepNode: View {
    let step: PipelineTimelineStep
    let number: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let tint = PipelineTimelineRow.tint(for: step.state)
        ZStack {
            Circle()
                .fill(step.state == .pending ? Color.appTertiaryFill : tint)
                .frame(width: 30, height: 30)
            if step.state == .active, !reduceMotion {
                TimelineView(.animation) { context in
                    let turn = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.4) / 1.4
                    Circle()
                        .trim(from: 0, to: 0.3)
                        .stroke(tint.opacity(0.55), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                        .frame(width: 38, height: 38)
                        .rotationEffect(.degrees(turn * 360))
                }
            }
            Group {
                switch step.state {
                case .done: Image(systemName: "checkmark")
                case .active: Image(systemName: step.icon).symbolEffect(.pulse, options: .repeating, isActive: !reduceMotion)
                case .paused: Image(systemName: "pause.fill")
                case .failed: Image(systemName: "exclamationmark")
                case .pending: Image(systemName: step.icon)
                }
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(step.state == .pending ? Color.secondary : Color.white)
        }
        .frame(width: 30, height: 30)
    }
}

/// The line from one step's node to the next: green once the step is done, with a pulse
/// running down it while the step above works.
private struct ConnectorLine: View {
    let filled: Bool
    let flowing: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                Capsule().fill(filled ? Color.green.opacity(0.8) : Color.appTertiaryFill)
                if flowing, !reduceMotion {
                    TimelineView(.animation) { context in
                        let phase = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.6) / 1.6
                        Capsule()
                            .fill(LinearGradient(colors: [Color.accentColor.opacity(0), Color.accentColor, Color.accentColor.opacity(0)], startPoint: .top, endPoint: .bottom))
                            .frame(height: max(12, proxy.size.height * 0.4))
                            .offset(y: (proxy.size.height * 1.4) * phase - proxy.size.height * 0.4)
                    }
                    .clipShape(Capsule())
                }
            }
        }
    }
}

/// The running step's bar with its count and time: "Part 4 of 10" and "About 2 min left" (or
/// the time it has been running, until a part has finished and there's a pace).
private struct StepProgressDetail: View {
    let step: PipelineTimelineStep

    private var isRunning: Bool { step.state == .active }

    private var countText: String? {
        guard let progress = step.progress, progress.total > 1 else { return nil }
        if isRunning {
            let current = min(progress.done + 1, progress.total)
            return "\(step.unit.capitalized) \(current) of \(progress.total)"
        }
        return "\(progress.done) of \(progress.total) \(step.unit)s done"
    }

    var body: some View {
        let tint = PipelineTimelineRow.tint(for: step.state)
        VStack(alignment: .leading, spacing: 6) {
            PipelineProgressBar(
                fraction: (step.progress?.total ?? 0) > 1 ? step.progress?.fraction : nil,
                tint: tint,
                isAnimating: isRunning,
                height: 8
            )
            HStack {
                if let countText {
                    Text(countText)
                        .contentTransition(.numericText())
                }
                Spacer(minLength: 8)
                if isRunning {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text(timeText(at: context.date))
                    }
                }
            }
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            if !isRunning {
                Text("Finished \(step.unit)s are saved. It continues from here when Voxbrief is open.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func timeText(at now: Date) -> String {
        guard let progress = step.progress else { return "Working…" }
        if let left = progress.secondsLeft(at: now) { return PipelineTimeFormat.left(left) }
        if let started = progress.startedAt {
            return "\(PipelineTimeFormat.clock(max(0, now.timeIntervalSince(started)))) elapsed"
        }
        return "Working…"
    }
}

// MARK: - Bar

/// A rounded progress bar: filled to `fraction` with a soft gradient and, while
/// `isAnimating`, a highlight sweeping across the fill; with no fraction (a step that can't
/// count its parts) a segment glides back and forth.
struct PipelineProgressBar: View {
    let fraction: Double?
    let tint: Color
    let isAnimating: Bool
    var height: CGFloat = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(Color.appTertiaryFill)
                if let fraction {
                    let fill = fraction > 0 ? max(height, width * fraction) : 0
                    Capsule()
                        .fill(LinearGradient(colors: [tint.opacity(0.7), tint], startPoint: .leading, endPoint: .trailing))
                        .frame(width: fill)
                        .overlay {
                            if isAnimating, !reduceMotion, fill > 0 {
                                shimmer(width: fill)
                            }
                        }
                        .clipShape(Capsule())
                } else if isAnimating {
                    if reduceMotion {
                        Capsule().fill(tint.opacity(0.5))
                    } else {
                        TimelineView(.animation) { context in
                            let t = context.date.timeIntervalSinceReferenceDate
                            let phase = (sin(t * .pi / 0.9) + 1) / 2
                            let segment = width * 0.32
                            Capsule()
                                .fill(LinearGradient(colors: [tint.opacity(0.55), tint], startPoint: .leading, endPoint: .trailing))
                                .frame(width: segment)
                                .offset(x: (width - segment) * phase)
                        }
                    }
                }
            }
            .animation(.spring(response: 0.6, dampingFraction: 0.85), value: fraction)
        }
        .frame(height: height)
        .clipShape(Capsule())
        .accessibilityElement()
        .accessibilityValue(fraction.map { "\(Int($0 * 100)) percent" } ?? (isAnimating ? "In progress" : ""))
    }

    private func shimmer(width: CGFloat) -> some View {
        TimelineView(.animation) { context in
            let phase = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.8) / 1.8
            let band = max(24, width * 0.35)
            LinearGradient(colors: [.white.opacity(0), .white.opacity(0.45), .white.opacity(0)], startPoint: .leading, endPoint: .trailing)
                .frame(width: band)
                .offset(x: (width + band) * phase - band)
                .frame(width: width, alignment: .leading)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Time

enum PipelineTimeFormat {
    /// "12.4 s", "48 s", "3 min 05 s".
    static func duration(_ seconds: Double) -> String {
        if seconds < 10 { return String(format: "%.1f s", seconds) }
        if seconds < 60 { return String(format: "%.0f s", seconds) }
        let total = Int(seconds.rounded())
        return String(format: "%d min %02d s", total / 60, total % 60)
    }

    /// "0:42", "12:05".
    static func clock(_ seconds: Double) -> String {
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    /// "Almost done", "About 40 s left", "About 3 min left".
    static func left(_ seconds: Double) -> String {
        if seconds < 5 { return "Almost done" }
        if seconds < 60 { return "About \(max(5, Int((seconds / 5).rounded()) * 5)) s left" }
        let minutes = Int((seconds / 60).rounded())
        return minutes >= 60
            ? "About \(minutes / 60) h \(minutes % 60) min left"
            : "About \(max(1, minutes)) min left"
    }
}
