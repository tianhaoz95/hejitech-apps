import ContempoCore
import SwiftUI

struct WatchCaptureScreen: View {
    @State private var viewModel = WatchCaptureViewModel()
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("\(viewModel.confirmedHours.formatted(.number.precision(.fractionLength(1)))) / \(MaterialParticipationTest.thresholdHours) hrs")
                    .font(ContempoFont.titleMedium())

                Button {
                    Task {
                        if viewModel.isRecording {
                            await viewModel.stopRecordingAndSend()
                        } else {
                            await viewModel.startRecording()
                        }
                    }
                } label: {
                    Image(systemName: viewModel.isRecording ? "waveform" : "mic.fill")
                        .font(.system(size: 32))
                        .frame(width: 64, height: 64)
                        .contempoGlass(tint: viewModel.isRecording ? palette.pine : nil, in: Circle())
                        .overlay(Circle().stroke(palette.pine, lineWidth: viewModel.isRecording ? 2 : 0))
                        .foregroundStyle(palette.pine)
                        .scaleEffect(viewModel.isRecording ? 1 + CGFloat(viewModel.recordingAmplitude) * 0.3 : 1)
                        .animation(.easeOut(duration: 0.1), value: viewModel.recordingAmplitude)
                }
                .buttonStyle(.plain)

                Text(viewModel.isRecording ? "Listening…" : "Tap to capture")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                if let lastSavedSummary = viewModel.lastSavedSummary {
                    Text(lastSavedSummary)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                }
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.danger)
                }

                if viewModel.pendingCount > 0 {
                    Button {
                        viewModel.uploadPendingNow()
                    } label: {
                        if viewModel.isUploadingPending {
                            ProgressView()
                        } else {
                            Text("\(viewModel.pendingCount) pending — upload now")
                        }
                    }
                    .font(ContempoFont.labelSmall())
                }

                if viewModel.uploadedTodayCount > 0 {
                    Text("\(viewModel.uploadedTodayCount) uploaded today")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
            }
            .padding()
        }
    }
}
