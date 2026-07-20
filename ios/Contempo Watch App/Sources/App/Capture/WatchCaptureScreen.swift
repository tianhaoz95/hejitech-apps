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
                            .frame(width: 72, height: 72)
                            .shadow(color: (viewModel.isRecording ? palette.danger : palette.pine).opacity(0.3), radius: 6, x: 0, y: 3)

                        if viewModel.isRecording {
                            WatchVolumeBars(amplitude: viewModel.recordingAmplitude, color: .white)
                        } else {
                            Image(systemName: "mic.fill")
                                .font(.system(size: 30, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                    }
                }
                .buttonStyle(.plain)

                // Status Message
                Text(viewModel.isRecording ? "Listening…" : "Tap to speak")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

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
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
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
