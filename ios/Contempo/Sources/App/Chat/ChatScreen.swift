import ContempoCore
import ContempoFirestore
import PhotosUI
import SwiftUI

struct ChatScreen: View {
    @State private var viewModel = ChatViewModel()
    @Environment(\.contempoPalette) private var palette
    @State private var showClearConfirm = false
    @State private var photoPickerItem: PhotosPickerItem?
    @State private var copiedMessageId: UUID?

    var body: some View {
        VStack(spacing: 0) {
            // Top AI Status Banner
            HStack(spacing: 8) {
                Circle()
                    .fill(palette.pine)
                    .frame(width: 8, height: 8)
                Text("STR AUDIT & TAX COPILOT")
                    .font(ContempoFont.labelSmall())
                    .tracking(ContempoFont.labelSmallTracking)
                    .foregroundStyle(palette.pine)
                Spacer()
                Text(aiPreferenceLabel)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(palette.surfaceContainerHigh, in: Capsule())
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(palette.paper)
            .overlay(
                Rectangle()
                    .fill(palette.hairline)
                    .frame(height: 1),
                alignment: .bottom
            )

            // Main Chat Stream
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if viewModel.messages.isEmpty && viewModel.streamingText == nil {
                            HeroEmptyStateView(
                                onSelectPrompt: { prompt in
                                    withAnimation(.easeOut(duration: 0.2)) {
                                        viewModel.sendPrompt(prompt)
                                    }
                                }
                            )
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        } else {
                            ForEach(viewModel.messages) { message in
                                ChatBubbleView(
                                    message: message,
                                    isCopied: copiedMessageId == message.id,
                                    onCopy: { copyMessageText(message) }
                                )
                                .id(message.id)
                            }
                        }

                        // Thinking / Analyzing Indicator
                        if viewModel.isSending && viewModel.streamingText == nil {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(palette.pineTint)
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Image(systemName: "sparkles")
                                            .font(.system(size: 14))
                                            .foregroundStyle(palette.pine)
                                    )
                                HStack(spacing: 8) {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("Analyzing IRS regulations & STR logs…")
                                        .font(ContempoFont.bodyMedium())
                                        .foregroundStyle(palette.inkSoft)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .background(palette.paperRaised)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(palette.hairline, lineWidth: 1)
                                )
                            }
                            .padding(.horizontal, 16)
                            .transition(.opacity)
                        }

                        // Streaming Token Response
                        if let streamingText = viewModel.streamingText {
                            HStack(alignment: .top, spacing: 10) {
                                Circle()
                                    .fill(palette.pineTint)
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Image(systemName: "sparkles")
                                            .font(.system(size: 14))
                                            .foregroundStyle(palette.pine)
                                    )
                                VStack(alignment: .leading, spacing: 6) {
                                    BulletAwareText(streamingText, font: ContempoFont.bodyLarge())
                                        .foregroundStyle(palette.ink)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 12)
                                        .background(palette.paperRaised)
                                        .clipShape(RoundedRectangle(cornerRadius: 16))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16)
                                                .stroke(palette.hairline, lineWidth: 1)
                                        )

                                    HStack(spacing: 4) {
                                        ProgressView()
                                            .controlSize(.mini)
                                        Text("\(viewModel.streamingChunkCount) tokens generated")
                                            .font(ContempoFont.labelSmall())
                                            .foregroundStyle(palette.inkFaint)
                                    }
                                    .padding(.leading, 4)
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                    }
                    .padding(.vertical, 16)
                }
                .onChange(of: viewModel.messages.count) {
                    if let last = viewModel.messages.last {
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            // Error Message Banner
            if let errorMessage = viewModel.errorMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(palette.danger)
                    Text(errorMessage)
                        .font(ContempoFont.bodySmall())
                        .foregroundStyle(palette.danger)
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(palette.dangerTint)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
            }

            // Recording / Transcribing Indicator Bar
            if viewModel.isRecording {
                HStack(spacing: 12) {
                    RecordingIndicator("LISTENING")

                    Spacer()

                    Button {
                        Task { await viewModel.stopRecordingAndSend() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "square.fill")
                                .font(.system(size: 10))
                            Text("Stop & Ask")
                                .font(ContempoFont.labelSmall())
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(palette.pine, in: Capsule())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(palette.paperRaised)
                .overlay(
                    Rectangle()
                        .fill(palette.hairline)
                        .frame(height: 1),
                    alignment: .top
                )
            } else if viewModel.isTranscribing {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Transcribing voice…")
                        .font(ContempoFont.bodyMedium())
                        .foregroundStyle(palette.pine)
                }
                .padding(.vertical, 8)
            }

            // Floating Attached Image Preview
            if let imageData = viewModel.pendingImageData, let uiImage = UIImage(data: imageData) {
                HStack(spacing: 10) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
                        .overlay(
                            RoundedRectangle(cornerRadius: ContempoRadius.small)
                                .stroke(palette.hairline, lineWidth: 1)
                        )
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Photo Attached")
                            .font(ContempoFont.labelLarge())
                            .foregroundStyle(palette.ink)
                        Text("Will be analyzed with your question")
                            .font(ContempoFont.bodySmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                    Spacer()
                    Button {
                        viewModel.removeAttachedImage()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(palette.inkFaint)
                    }
                }
                .padding(10)
                .background(palette.paperRaised)
                .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                .overlay(
                    RoundedRectangle(cornerRadius: ContempoRadius.medium)
                        .stroke(palette.hairline, lineWidth: 1)
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
            }

            // Attached Entries Row
            if !viewModel.pendingEntries.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.pendingEntries) { entry in
                            HStack(spacing: 6) {
                                Text(entry.propertyName.isEmpty ? (entry.task.isEmpty ? "Untitled" : entry.task) : entry.propertyName)
                                    .font(ContempoFont.labelSmall())
                                    .foregroundStyle(palette.ink)
                                    .lineLimit(1)
                                Button {
                                    viewModel.removeAttachedEntry(entry)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 13))
                                        .foregroundStyle(palette.inkFaint)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(palette.pineTint, in: Capsule())
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.bottom, 6)
            }

            // Input Bar Container
            HStack(spacing: 10) {
                Button {
                    viewModel.openEntryPicker()
                } label: {
                    Image(systemName: "at")
                        .font(.system(size: 18))
                        .foregroundStyle(palette.pine)
                        .frame(width: 38, height: 38)
                        .background(palette.pineTint, in: Circle())
                }

                PhotosPicker(selection: $photoPickerItem, matching: .images) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 18))
                        .foregroundStyle(palette.pine)
                        .frame(width: 38, height: 38)
                        .background(palette.pineTint, in: Circle())
                }

                Button {
                    Task { await viewModel.startRecording() }
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(palette.pine)
                        .frame(width: 38, height: 38)
                        .background(palette.pineTint, in: Circle())
                }

                TextField("Ask about STR tax rules or hours…", text: $viewModel.inputText, axis: .vertical)
                    .font(ContempoFont.bodyLarge())
                    .foregroundStyle(palette.ink)
                    .lineLimit(1...5)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(palette.surfaceContainerLow)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(palette.hairline, lineWidth: 1)
                    )
                    .disabled(viewModel.isRecording || viewModel.isTranscribing)

                Button {
                    viewModel.send()
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(
                            viewModel.canSend ? palette.pine : palette.inkFaint.opacity(0.4),
                            in: Circle()
                        )
                }
                .disabled(!viewModel.canSend)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(palette.paperRaised)
            .overlay(
                Rectangle()
                    .fill(palette.hairline)
                    .frame(height: 1),
                alignment: .top
            )

            // Legal Disclaimer Footer
            Text("Educational logging tool. Consult a CPA for official tax advice.")
                .font(ContempoFont.bodySmall())
                .foregroundStyle(palette.inkFaint)
                .padding(.vertical, 4)
                .padding(.horizontal, 16)
        }
        .background(palette.paper.ignoresSafeArea())
        .navigationTitle("Copilot")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !viewModel.messages.isEmpty {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showClearConfirm = true
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 15))
                            .foregroundStyle(palette.inkSoft)
                    }
                }
            }
        }
        .confirmationDialog("Clear chat history?", isPresented: $showClearConfirm, titleVisibility: .visible) {
            Button("Clear Chat History", role: .destructive) {
                withAnimation { viewModel.clearHistory() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .onChange(of: photoPickerItem) { _, newValue in
            Task {
                if let newValue, let data = try? await newValue.loadTransferable(type: Data.self) {
                    viewModel.attachImage(data)
                }
                photoPickerItem = nil
            }
        }
        .sheet(isPresented: $viewModel.showEntryPicker) {
            EntryPickerSheet(entries: viewModel.availableEntries) { entry in
                viewModel.attachEntry(entry)
            }
        }
    }

    private func copyMessageText(_ message: ChatMessage) {
        UIPasteboard.general.string = message.text
        copiedMessageId = message.id
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if copiedMessageId == message.id {
                copiedMessageId = nil
            }
        }
    }

    private var aiPreferenceLabel: String {
        switch viewModel.currentAiAvailability {
        case .ready:
            return "AI Online"
        case .checking:
            return "Checking AI…"
        case .downloading:
            return "Model Downloading"
        case .unavailable:
            return "AI Unavailable"
        case .failed:
            return "AI Error"
        }
    }
}

// MARK: - Hero Empty State & Starter Prompts

private struct HeroEmptyStateView: View {
    let onSelectPrompt: (String) -> Void
    @Environment(\.contempoPalette) private var palette

    private let starters: [(icon: String, title: String, subtitle: String, prompt: String)] = [
        (
            "lightbulb.fill",
            "100-Hour Material Participation Test",
            "What direct management tasks count under Treasury Reg § 1.469-5T?",
            "What activities count toward the 100-hour material participation test for my short-term rental?"
        ),
        (
            "car.fill",
            "Travel Time & Mileage Rules",
            "Can I log property visits, guest runs, and supply trips?",
            "Can I count travel time and property visits toward my STR material participation hours?"
        ),
        (
            "shield.checkmark.fill",
            "IRS Audit Proof & Evidence",
            "What documentation does an auditor expect to see?",
            "What proof does the IRS demand in a short-term rental material participation audit?"
        ),
        (
            "clock.badge.checkmark.fill",
            "Contemporaneous Logging",
            "Why post-hoc reconstructions fail IRS audits.",
            "Why do contemporaneous logs matter so much for STR material participation?"
        )
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Hero Header Card
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(palette.pineTint)
                        .frame(width: 44, height: 44)
                        .overlay(
                            Image(systemName: "sparkles")
                                .font(.system(size: 20))
                                .foregroundStyle(palette.pine)
                        )
                    VStack(alignment: .leading, spacing: 2) {
                        Text("STR Audit Assistant")
                            .font(ContempoFont.titleLarge())
                            .foregroundStyle(palette.ink)
                        Text("Grounded in IRS Section 469 regulations")
                            .font(ContempoFont.bodySmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                }

                Text("Ask questions about the 100-hour or 500-hour material participation tests, travel logging rules, contemporaneous record requirements, or how to prepare your CPA export.")
                    .font(ContempoFont.bodyMedium())
                    .foregroundStyle(palette.inkSoft)
                    .lineSpacing(3)
            }
            .padding(16)
            .background(palette.paperRaised)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.large)
                    .stroke(palette.hairline, lineWidth: 1)
            )

            // Starter Questions Section
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow("POPULAR STR TAX QUESTIONS")

                VStack(spacing: 10) {
                    ForEach(starters, id: \.title) { starter in
                        Button {
                            onSelectPrompt(starter.prompt)
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: starter.icon)
                                    .font(.system(size: 16))
                                    .foregroundStyle(palette.pine)
                                    .frame(width: 28, height: 28)
                                    .background(palette.pineTint, in: Circle())

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(starter.title)
                                        .font(ContempoFont.labelLarge())
                                        .foregroundStyle(palette.ink)
                                        .multilineTextAlignment(.leading)
                                    Text(starter.subtitle)
                                        .font(ContempoFont.bodySmall())
                                        .foregroundStyle(palette.inkFaint)
                                        .multilineTextAlignment(.leading)
                                        .lineLimit(2)
                                }

                                Spacer(minLength: 0)

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(palette.inkFaint)
                                    .padding(.top, 4)
                            }
                            .padding(12)
                            .background(palette.paperRaised)
                            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                            .overlay(
                                RoundedRectangle(cornerRadius: ContempoRadius.medium)
                                    .stroke(palette.hairline, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
    }
}

// MARK: - Entry Picker Sheet

/// Lets the host attach one or more specific logged entries as context for
/// an entry-specific question — the "@" affordance next to photo/mic.
/// Selecting an entry dismisses the sheet (ChatViewModel.attachEntry), same
/// one-tap-and-done feel as picking a role/property elsewhere in the app;
/// tap "@" again to attach another.
private struct EntryPickerSheet: View {
    let entries: [Entry]
    let onSelect: (Entry) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        NavigationStack {
            Group {
                if entries.isEmpty {
                    Text("No entries yet.")
                        .font(ContempoFont.bodyMedium())
                        .foregroundStyle(palette.inkFaint)
                } else {
                    List(entries) { entry in
                        Button {
                            onSelect(entry)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.propertyName.isEmpty ? "Untitled" : entry.propertyName)
                                    .font(ContempoFont.labelLarge())
                                    .foregroundStyle(palette.ink)
                                Text(entry.task.isEmpty ? "—" : entry.task)
                                    .font(ContempoFont.bodySmall())
                                    .foregroundStyle(palette.inkFaint)
                                    .lineLimit(1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Attach an entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Message Bubble Component

private struct ChatBubbleView: View {
    let message: ChatMessage
    let isCopied: Bool
    let onCopy: () -> Void
    @Environment(\.contempoPalette) private var palette

    var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if isUser { Spacer(minLength: 40) }

            if !isUser {
                Circle()
                    .fill(palette.pineTint)
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "sparkles")
                            .font(.system(size: 14))
                            .foregroundStyle(palette.pine)
                    )
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 6) {
                // Attached Image Rendering
                if let imageData = message.imageData, let uiImage = UIImage(data: imageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 180)
                        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                        .overlay(
                            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                                .stroke(palette.hairline, lineWidth: 1)
                        )
                }

                // Message Content Text
                if !message.text.isEmpty {
                    if isUser {
                        Text(message.text)
                            .font(ContempoFont.bodyLarge())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(palette.pine)
                            .clipShape(
                                UnevenRoundedRectangle(
                                    cornerRadii: RectangleCornerRadii(
                                        topLeading: 16,
                                        bottomLeading: 16,
                                        bottomTrailing: 4,
                                        topTrailing: 16
                                    )
                                )
                            )
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            BulletAwareText(message.text, font: ContempoFont.bodyLarge())
                                .foregroundStyle(palette.ink)

                            HStack {
                                Button(action: onCopy) {
                                    HStack(spacing: 4) {
                                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 11))
                                        Text(isCopied ? "Copied" : "Copy")
                                            .font(ContempoFont.labelSmall())
                                    }
                                    .foregroundStyle(isCopied ? palette.pine : palette.inkFaint)
                                }
                                .buttonStyle(.plain)

                                Spacer()
                            }
                            .padding(.top, 4)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(palette.paperRaised)
                        .clipShape(
                            UnevenRoundedRectangle(
                                cornerRadii: RectangleCornerRadii(
                                    topLeading: 4,
                                    bottomLeading: 16,
                                    bottomTrailing: 16,
                                    topTrailing: 16
                                )
                            )
                        )
                        .overlay(
                            UnevenRoundedRectangle(
                                cornerRadii: RectangleCornerRadii(
                                    topLeading: 4,
                                    bottomLeading: 16,
                                    bottomTrailing: 16,
                                    topTrailing: 16
                                )
                            )
                            .stroke(palette.hairline, lineWidth: 1)
                        )
                    }
                }
            }

            if !isUser { Spacer(minLength: 40) }
        }
        .padding(.horizontal, 16)
    }
}
