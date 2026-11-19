import FolioKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// "Folio" in the share sheet: whatever another app shares (a web page or link, text, files,
/// photos) becomes a new artifact in the signed-in person's Folio, ready for an agent to pick up.
/// The session comes from the Keychain group it shares with the app.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let model = ShareModel(context: extensionContext)
        let host = UIHostingController(rootView: ShareForm(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
        Task { await model.load() }
    }
}

@MainActor
@Observable
final class ShareModel {
    enum Phase: Equatable { case loading, ready, sending, done(URL), signedOut, failed(String) }

    private let context: NSExtensionContext?
    let api: FolioAPI
    var phase: Phase = .loading
    var title = ""
    var note = ""
    var items: [ShareDraft.Item] = []

    init(context: NSExtensionContext?) {
        self.context = context
        // Follow the app: a Debug build signed in to a local stack shares there too.
        var config = ServerConfig.production
        if let site = SessionVault().load()?.site, let u = URL(string: site), u.scheme == "http", let host = u.host {
            config = .local(host: host)
        }
        api = FolioAPI(auth: SupabaseAuth(config: config))
    }

    var summary: String {
        var parts: [String] = []
        let texts = items.filter { if case .text = $0 { return true } else { return false } }.count
        let links = items.filter { if case .url = $0 { return true } else { return false } }.count
        let files = items.count - texts - links
        if links > 0 { parts.append(links == 1 ? "a link" : "\(links) links") }
        if texts > 0 { parts.append("text") }
        if files > 0 { parts.append(files == 1 ? "a file" : "\(files) files") }
        return parts.joined(separator: ", ")
    }

    func load() async {
        guard await api.auth.current != nil else {
            phase = .signedOut
            return
        }
        let providers = (context?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        let pageTitle = (context?.inputItems as? [NSExtensionItem])?.compactMap { $0.attributedContentText?.string }.first { !$0.isEmpty }
        var out: [ShareDraft.Item] = []
        for p in providers {
            if let item = await Self.item(from: p, title: pageTitle) { out.append(item) }
        }
        // Safari sends a page as both its URL and its title as text: keep the link.
        if out.contains(where: { if case .url = $0 { return true } else { return false } }) {
            out.removeAll { if case .text(let t) = $0 { return t == pageTitle } else { return false } }
        }
        items = out
        guard !items.isEmpty else {
            phase = .failed("There's nothing here Folio can save.")
            return
        }
        title = ShareDraft.suggestedTitle(items)
        phase = .ready
    }

    private static func item(from p: NSItemProvider, title: String?) async -> ShareDraft.Item? {
        do {
            if p.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                if let u = try await p.loadItem(forTypeIdentifier: UTType.fileURL.identifier) as? URL, let data = try? Data(contentsOf: u) {
                    return .file(name: u.lastPathComponent, data: data)
                }
            }
            if p.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                if let u = try await p.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    if u.isFileURL, let data = try? Data(contentsOf: u) { return .file(name: u.lastPathComponent, data: data) }
                    return .url(u, title: title)
                }
            }
            if p.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                let raw = try await p.loadItem(forTypeIdentifier: UTType.image.identifier)
                if let u = raw as? URL, let data = try? Data(contentsOf: u) { return .file(name: u.lastPathComponent, data: data) }
                if let img = raw as? UIImage, let data = img.jpegData(compressionQuality: 0.85) { return .file(name: "photo.jpg", data: data) }
                if let data = raw as? Data { return .file(name: "photo.jpg", data: data) }
            }
            if p.hasItemConformingToTypeIdentifier(UTType.html.identifier) {
                if let s = try await p.loadItem(forTypeIdentifier: UTType.html.identifier) as? String { return .file(name: "page.html", data: Data(s.utf8)) }
            }
            if p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                if let s = try await p.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    if let u = URL(string: s.trimmingCharacters(in: .whitespacesAndNewlines)), ["http", "https"].contains(u.scheme ?? ""), !s.contains(" ") {
                        return .url(u, title: title)
                    }
                    return .text(s)
                }
            }
        } catch {
            return nil
        }
        return nil
    }

    func send() async {
        phase = .sending
        let draft = ShareDraft(items: items, title: title.trimmingCharacters(in: .whitespaces).isEmpty ? nil : title, note: note.trimmingCharacters(in: .whitespacesAndNewlines))
        do {
            let created = try await api.create(title: draft.title, description: draft.note.isEmpty ? "Shared from iPhone" : String(draft.note.prefix(200)), files: draft.files(), message: "Shared from iPhone")
            phase = .done(URL(string: "folio://a/\(created.slug)")!)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            try? await Task.sleep(for: .seconds(1.2))
            finish()
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func finish() { context?.completeRequest(returningItems: nil) }
    func cancel() { context?.cancelRequest(withError: NSError(domain: "com.hejitech.folio.share", code: NSUserCancelledError)) }
}

struct ShareForm: View {
    @Bindable var model: ShareModel

    var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .loading:
                    ProgressView()
                case .signedOut:
                    ContentUnavailableView("Sign in to Folio first", systemImage: "person.crop.circle.badge.questionmark", description: Text("Open the Folio app and sign in, then share again."))
                case .failed(let m) where model.items.isEmpty:
                    ContentUnavailableView("Can't share this", systemImage: "exclamationmark.triangle", description: Text(m))
                case .done:
                    ContentUnavailableView("Saved to Folio", systemImage: "checkmark.circle.fill", description: Text("Ask an agent to pick up \"\(model.title)\"."))
                        .foregroundStyle(.green)
                default:
                    form
                }
            }
            .navigationTitle("New artifact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { model.cancel() } }
                if model.phase == .ready || model.phase == .sending || { if case .failed = model.phase { return !model.items.isEmpty } else { return false } }() {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { Task { await model.send() } }
                            .disabled(model.phase == .sending)
                    }
                }
            }
        }
    }

    private var form: some View {
        Form {
            Section("Title") {
                TextField("Title", text: $model.title)
            }
            Section {
                TextField("A note for your agents (optional)", text: $model.note, axis: .vertical).lineLimit(3...6)
            } footer: {
                Text("Folio saves \(model.summary) as a new private artifact. Ask Claude, Gemini or another connected agent to work on it.")
            }
            if case .failed(let m) = model.phase {
                Section { Label(m, systemImage: "exclamationmark.circle.fill").foregroundStyle(.red) }
            }
            if model.phase == .sending {
                Section { HStack { ProgressView(); Text("Saving…").foregroundStyle(.secondary) } }
            }
        }
    }
}
