import ContempoCore
import PhotosUI
import SwiftUI

struct ChatScreen: View {
    @State private var viewModel = ChatViewModel()
    @Environment(\.contempoPalette) private var palette
    @State private var showClearConfirm = false
    @State private var photoPickerItem: PhotosPickerItem?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if viewModel.messages.isEmpty && viewModel.streamingText == nil {
                            Text("Ask a question about material participation, contemporaneity, or how Contempo works. This isn't tax or legal advice.")
                                .font(ContempoFont.bodyLarge())
                                .foregroundStyle(palette.inkFaint)
                                .padding()
                        }
                        ForEach(viewModel.messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }
                        if viewModel.isSending && viewModel.streamingText == nil {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Thinking…").font(ContempoFont.labelSmall()).foregroundStyle(palette.inkFaint)
                            }
                            .padding(.horizontal)
                        }
                        if let streamingText = viewModel.streamingText {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(streamingText)
                                    .font(ContempoFont.bodyLarge())
                                    .padding()
                                    .background(palette.paperRaised)
                                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
                                Text("\(viewModel.streamingChunkCount) tokens generated")
                                    .font(ContempoFont.labelSmall())
                                    .foregroundStyle(palette.inkFaint)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal)
                        }
                    }
                    .padding(.vertical)
                }
                .onChange(of: viewModel.messages.count) {
                    if let last = viewModel.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.danger)
                    .padding(.horizontal)
            }

            if let imageData = viewModel.pendingImageData, let uiImage = UIImage(data: imageData) {
                HStack {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
                    Button("Remove") { viewModel.removeAttachedImage() }
                        .font(ContempoFont.labelSmall())
                    Spacer()
                }
                .padding(.horizontal)
            }

            HStack(spacing: 12) {
                if viewModel.isRecording {
                    Button {
                        Task { await viewModel.stopRecordingAndSend() }
                    } label: {
                        Image(systemName: "waveform")
                            .foregroundStyle(palette.pine)
                    }
                } else {
                    PhotosPicker(selection: $photoPickerItem, matching: .images) {
                        Image(systemName: "plus.circle")
                    }
                    Button {
                        Task { await viewModel.startRecording() }
                    } label: {
                        Image(systemName: "mic.fill")
                    }
                }

                TextField("Ask a question", text: $viewModel.inputText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .disabled(viewModel.isRecording || viewModel.isTranscribing)

                Button {
                    viewModel.send()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 28))
                }
                .disabled(!viewModel.canSend)
            }
            .padding()
        }
        .navigationTitle("Chat")
        .toolbar {
            if !viewModel.messages.isEmpty {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showClearConfirm = true
                    } label: {
                        Image(systemName: "trash")
                    }
                }
            }
        }
        .confirmationDialog("Clear chat?", isPresented: $showClearConfirm, titleVisibility: .visible) {
            Button("Clear", role: .destructive) { viewModel.clearHistory() }
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
    }
}

private struct ChatBubble: View {
    let message: ChatMessage
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 6) {
                if let imageData = message.imageData, let uiImage = UIImage(data: imageData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 160)
                        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.small))
                }
                if !message.text.isEmpty {
                    Text(message.text)
                        .font(ContempoFont.bodyLarge())
                }
            }
            .padding()
            .background(message.role == .user ? palette.pine.opacity(0.15) : palette.paperRaised)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
            if message.role == .agent { Spacer(minLength: 40) }
        }
        .padding(.horizontal)
    }
}
