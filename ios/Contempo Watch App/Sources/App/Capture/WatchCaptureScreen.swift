import ContempoCore
import SwiftUI

struct WatchCaptureScreen: View {
    @State private var viewModel = WatchCaptureViewModel()
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                // Material Participation Progress Header
                Text("\(viewModel.confirmedHours.formatted(.number.precision(.fractionLength(1)))) / \(MaterialParticipationTest.thresholdHours) hrs")
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)

                // Active Running Work Timer View vs Hero Voice Mic
                if viewModel.isTimerRunning {
                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(palette.pine)
                                .frame(width: 6, height: 6)
                            Text("WORK IN PROGRESS")
                                .font(ContempoFont.labelSmall())
                                .tracking(ContempoFont.labelSmallTracking)
                                .foregroundStyle(palette.pine)
                        }

                        Text(formatDuration(viewModel.elapsedSeconds))
                            .font(.system(size: 26, weight: .bold, design: .monospaced))
                            .foregroundStyle(palette.ink)

                        Text(viewModel.timerTask)
                            .font(ContempoFont.bodySmall())
                            .foregroundStyle(palette.inkFaint)
                            .lineLimit(1)

                        Button {
                            withAnimation {
                                viewModel.stopAndCompleteWorkTimer()
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Complete")
                            }
                            .font(ContempoFont.labelLarge())
                            .bold()
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(palette.pine)
                    }
                    .padding(10)
                    .background(palette.paperRaised)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
                    .overlay(
                        RoundedRectangle(cornerRadius: ContempoRadius.large)
                            .stroke(palette.pine, lineWidth: 1.5)
                    )
                } else if viewModel.isTripActive {
                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(palette.pine)
                                .frame(width: 6, height: 6)
                            Text("GPS TRIP ACTIVE")
                                .font(ContempoFont.labelSmall())
                                .tracking(ContempoFont.labelSmallTracking)
                                .foregroundStyle(palette.pine)
                        }

                        Text(formatDuration(viewModel.tripElapsedSeconds))
                            .font(.system(size: 26, weight: .bold, design: .monospaced))
                            .foregroundStyle(palette.ink)

                        Text("Tracking mileage & location")
                            .font(ContempoFont.bodySmall())
                            .foregroundStyle(palette.inkFaint)
                            .lineLimit(1)

                        Button {
                            withAnimation {
                                viewModel.stopGpsTrip()
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Complete Trip")
                            }
                            .font(ContempoFont.labelLarge())
                            .bold()
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(palette.pine)
                    }
                    .padding(10)
                    .background(palette.paperRaised)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
                    .overlay(
                        RoundedRectangle(cornerRadius: ContempoRadius.large)
                            .stroke(palette.pine, lineWidth: 1.5)
                    )
                } else {
                    // Hero Mic Button
                    Button {
                        Task {
                            if viewModel.isRecording {
                                await viewModel.stopRecordingAndSend()
                            } else {
                                await viewModel.startRecording()
                            }
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .fill(viewModel.isRecording ? palette.danger : palette.pine)
                                .frame(width: 68, height: 68)
                                .shadow(color: (viewModel.isRecording ? palette.danger : palette.pine).opacity(0.3), radius: 6, x: 0, y: 3)

                            if viewModel.isRecording {
                                WatchVolumeBars(amplitude: viewModel.recordingAmplitude, color: .white)
                            } else {
                                Image(systemName: "mic.fill")
                                    .font(.system(size: 28, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    // Status Message
                    Text(viewModel.isRecording ? "Listening…" : "Tap mic to speak")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)

                    // Side-by-Side Start Work Timer and Start Trip Buttons
                    HStack(spacing: 6) {
                        Button {
                            withAnimation {
                                viewModel.startWorkTimer(task: "STR General Work")
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "play.circle.fill")
                                Text("Timer")
                            }
                            .font(ContempoFont.labelSmall())
                            .bold()
                        }
                        .buttonStyle(.bordered)
                        .tint(palette.pine)

                        Button {
                            withAnimation {
                                viewModel.startGpsTrip()
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "location.fill")
                                Text("Trip")
                            }
                            .font(ContempoFont.labelSmall())
                            .bold()
                        }
                        .buttonStyle(.bordered)
                        .tint(palette.pine)
                    }
                }

                if let lastSavedSummary = viewModel.lastSavedSummary {
                    Text(lastSavedSummary)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                        .multilineTextAlignment(.center)
                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.danger)
                        .multilineTextAlignment(.center)
                }

                if viewModel.pendingCount > 0 || viewModel.uploadedTodayCount > 0 {
                    Text("\(viewModel.pendingCount) pending · \(viewModel.uploadedTodayCount) today")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }

                if viewModel.pendingCount > 0 {
                    Button {
                        viewModel.uploadPendingNow()
                    } label: {
                        if viewModel.isUploadingPending {
                            ProgressView()
                        } else {
                            Text("Upload now")
                                .font(ContempoFont.labelSmall())
                                .bold()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.brass)
                    .disabled(viewModel.isUploadingPending)
                }

                Divider()

                Button(role: .destructive) {
                    WatchAuthManager.shared.signOut()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                        Text("Sign Out")
                    }
                    .font(ContempoFont.labelSmall())
                }
                .buttonStyle(.plain)
                .foregroundStyle(palette.danger)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
    }

    private func formatDuration(_ totalSeconds: Int) -> String {
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }
}

private struct WatchVolumeBars: View {
    let amplitude: Float
    let color: Color

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(0..<5, id: \.self) { index in
                WatchVolumeBar(amplitude: amplitude, index: index, color: color)
            }
        }
        .frame(height: 28)
    }
}

private struct WatchVolumeBar: View {
    let amplitude: Float
    let index: Int
    let color: Color
    @State private var phase: CGFloat = 0.25

    var body: some View {
        let fraction = min(1.0, max(0.15, phase * (0.45 + CGFloat(amplitude) * 0.75)))
        RoundedRectangle(cornerRadius: 2)
            .fill(color)
            .frame(width: 4, height: 28 * fraction)
            .onAppear {
                let duration = 0.42 + Double(index) * 0.09
                withAnimation(.linear(duration: duration).repeatForever(autoreverses: true)) {
                    phase = 1.0
                }
            }
    }
}
