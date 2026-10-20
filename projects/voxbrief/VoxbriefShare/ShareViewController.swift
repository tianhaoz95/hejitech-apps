import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// "Voxbrief" in the share sheet for audio and video (a Voice Memos recording, a WhatsApp voice
/// message, a lecture video). The extension only copies the files into the App Group
/// (`SharedImportInbox`); the app transcribes and writes the notes the next time it's opened,
/// since the models can't run inside an extension's memory limit.
final class ShareViewController: UIViewController {
    private let model = ShareModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareView(model: model) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        })
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)

        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        Task { await model.save(providers) }
    }
}

@MainActor
final class ShareModel: ObservableObject {
    enum State: Equatable {
        case saving
        case saved(count: Int)
        case failed(String)
    }

    @Published var state: State = .saving

    func save(_ providers: [NSItemProvider]) async {
        var saved = 0
        var lastError: String?
        for provider in providers {
            guard let type = Self.mediaType(of: provider) else { continue }
            do {
                try await Self.copy(provider, type: type)
                saved += 1
            } catch {
                lastError = error.localizedDescription
            }
        }
        if saved > 0 {
            state = .saved(count: saved)
        } else {
            state = .failed(lastError ?? "There's no audio or video here that Voxbrief can read.")
        }
    }

    /// The provider's first audio or video representation.
    private static func mediaType(of provider: NSItemProvider) -> String? {
        provider.registeredTypeIdentifiers.first { identifier in
            UTType(identifier).map { $0.conforms(to: .audio) || $0.conforms(to: .movie) } ?? false
        }
    }

    /// The file only exists for the duration of the callback, so it's copied there.
    private static func copy(_ provider: NSItemProvider, type: String) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            _ = provider.loadFileRepresentation(forTypeIdentifier: type) { url, error in
                guard let url else {
                    continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
                    return
                }
                do {
                    let name = provider.suggestedName.map { name in
                        url.pathExtension.isEmpty || name.hasSuffix("." + url.pathExtension) ? name : "\(name).\(url.pathExtension)"
                    } ?? url.lastPathComponent
                    try SharedImportInbox.add(url, originalName: name.replacingOccurrences(of: "/", with: "-"))
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}

struct ShareView: View {
    @ObservedObject var model: ShareModel
    let done: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                Spacer()
                switch model.state {
                case .saving:
                    ProgressView()
                    Text("Adding to Voxbrief…")
                        .foregroundStyle(.secondary)
                case .saved(let count):
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.green)
                    Text(count == 1 ? "Added to Voxbrief" : "\(count) recordings added to Voxbrief")
                        .font(.headline)
                    Text("Open Voxbrief and \(count == 1 ? "it" : "they")'ll be transcribed and written up on your iPhone.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                case .failed(let message):
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(.orange)
                    Text("Couldn't add this")
                        .font(.headline)
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                Spacer()
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .navigationTitle("Voxbrief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: done)
                        .disabled(model.state == .saving)
                }
            }
        }
    }
}
