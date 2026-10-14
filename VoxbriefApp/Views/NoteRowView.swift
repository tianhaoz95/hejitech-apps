import SwiftUI

public struct NoteRowView: View {
    public let note: VoiceNote

    public init(note: VoiceNote) {
        self.note = note
    }

    public var body: some View {
        HStack(spacing: 12) {
            if let colorName = note.colorTag, let color = colorForName(colorName) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(color)
                    .frame(width: 4)
                    .padding(.vertical, 2)
            }

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .center, spacing: 6) {
                    if note.isPinned {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.accentColor)
                    }

                    if note.isLocked {
                        Image(systemName: "lock.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Text(note.isLocked ? "Protected Note" : note.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    Spacer(minLength: 8)

                    statusIndicator

                    if note.isFavorite {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                    }
                }

                if !note.isLocked && !note.summary.isEmpty {
                    Text(note.summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                // Row metadata chips
                HStack(spacing: 8) {
                    if note.duration > 0 {
                        Label(note.duration.formattedDuration, systemImage: "waveform")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    if note.wordCount > 0 {
                        Text(note.formattedReadingTime)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }

                    if !note.actionItems.isEmpty {
                        let progress = note.actionItemsProgress
                        HStack(spacing: 3) {
                            Image(systemName: progress.completed == progress.total ? "checkmark.circle.fill" : "checklist")
                                .font(.system(size: 10))
                                .foregroundStyle(progress.completed == progress.total ? .green : .secondary)
                            Text("\(progress.completed)/\(progress.total)")
                                .font(.caption2)
                                .foregroundStyle(progress.completed == progress.total ? .green : .secondary)
                        }
                    }

                    Spacer()

                    Text(note.createdAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
    }

    private func colorForName(_ name: String) -> Color? {
        switch name.lowercased() {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        case "orange": return .orange
        case "pink": return .pink
        case "teal": return .teal
        case "indigo": return .indigo
        case "red": return .red
        default: return nil
        }
    }

    private var shortProcessingLabel: String {
        switch note.status {
        case .syncing: return "Syncing"
        case .transcribingASR: return "Transcribing"
        case .cleaningLLM: return "Cleaning up"
        default: return "Processing"
        }
    }

    @ViewBuilder
    private var statusIndicator: some View {
        if note.status.isProcessing {
            HStack(spacing: 4) {
                ProgressView()
                    .scaleEffect(0.6)
                Text(shortProcessingLabel)
                    .lineLimit(1)
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        } else if note.status == .failed {
            Label("Failed", systemImage: "exclamationmark.circle.fill")
                .foregroundStyle(.red)
                .labelStyle(.titleAndIcon)
                .font(.caption2)
        } else if note.cleanupEngine == CleanupEngineLabel.ruleBased {
            Label("Basic Cleanup", systemImage: "exclamationmark.circle.fill")
                .foregroundStyle(.orange)
                .labelStyle(.titleAndIcon)
                .font(.caption2)
        }
    }
}
