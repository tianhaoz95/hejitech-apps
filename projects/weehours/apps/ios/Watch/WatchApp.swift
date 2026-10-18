import AVFoundation
import SwiftUI
import WatchConnectivity
import WatchKit

/// The watch is an input and output surface: typed taps go to the phone as messages, voice is
/// recorded here and transcribed and decided on the phone. The status line comes back as
/// application context.
@main
struct WeeHoursWatchApp: App {
    @StateObject private var link = PhoneLink()
    var body: some Scene {
        WindowGroup { WatchHome().environmentObject(link) }
    }
}

@MainActor
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    struct Child: Identifiable, Equatable {
        let id: String
        let name: String
        let line: String
        let openFeed: String
        let sleeping: Bool
    }

    @Published var line = "Open the iPhone app"
    @Published var openFeed = ""
    @Published var sleeping = false
    /// The household's children shown on the iPhone; the watch logs for `child`.
    @Published var children: [Child] = []
    @Published var child = UserDefaults.standard.string(forKey: "child") ?? "" {
        didSet { UserDefaults.standard.set(child, forKey: "child"); applyChild() }
    }
    @Published var confirmation: String?
    @Published var lastId: String?
    @Published var recording = false
    private var recorder: AVAudioRecorder?
    private var startedAt = Date()

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func send(_ message: [String: Any]) {
        var message = message
        if !child.isEmpty { message["baby"] = child }
        guard WCSession.default.isReachable else {
            confirmation = "iPhone not reachable"
            WKInterfaceDevice.current().play(.failure)
            return
        }
        WCSession.default.sendMessage(message) { reply in
            Task { @MainActor in
                if let e = reply["error"] as? String { self.confirmation = e; return }
                self.confirmation = (reply["label"] as? String).map { "✓ \($0)" }
                self.lastId = reply["id"] as? String
                if let l = reply["line"] as? String { self.line = l }
                WKInterfaceDevice.current().play(.success)
            }
        } errorHandler: { error in
            Task { @MainActor in self.confirmation = error.localizedDescription }
        }
    }

    func toggleRecording() {
        if recording {
            recorder?.stop()
            recording = false
            if let url = recorder?.url {
                WCSession.default.transferFile(url, metadata: ["capturedAt": startedAt.timeIntervalSince1970, "baby": child])
                confirmation = "Captured ✓ · your iPhone will log it"
                WKInterfaceDevice.current().play(.click)
            }
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("watch-\(UUID().uuidString).wav")
        let settings: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16_000, AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 16]
        do {
            try AVAudioSession.sharedInstance().setCategory(.record)
            try AVAudioSession.sharedInstance().setActive(true)
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.record()
            startedAt = Date()
            recording = true
            WKInterfaceDevice.current().play(.start)
        } catch {
            confirmation = "Mic unavailable"
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let ctx = session.receivedApplicationContext
        Task { @MainActor in self.apply(ctx) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
        Task { @MainActor in self.apply(ctx) }
    }

    private func apply(_ ctx: [String: Any]) {
        if let l = ctx["line"] as? String { line = l }
        openFeed = ctx["openFeed"] as? String ?? ""
        sleeping = ctx["sleeping"] as? Bool ?? false
        children = (ctx["children"] as? [[String: Any]] ?? []).compactMap { c in
            guard let id = c["id"] as? String, let name = c["name"] as? String else { return nil }
            return Child(id: id, name: name, line: c["line"] as? String ?? "", openFeed: c["openFeed"] as? String ?? "", sleeping: c["sleeping"] as? Bool ?? false)
        }
        if !children.contains(where: { $0.id == child }) { child = (ctx["target"] as? String).flatMap { t in children.first { $0.id == t }?.id } ?? children.first?.id ?? "" }
        applyChild()
    }

    /// Shows the chosen child's line and state.
    private func applyChild() {
        guard let c = children.first(where: { $0.id == child }) else { return }
        line = c.line
        openFeed = c.openFeed
        sleeping = c.sleeping
    }
}

struct WatchHome: View {
    @EnvironmentObject var link: PhoneLink
    @State private var diaper = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if link.children.count > 1 {
                    Picker("Child", selection: $link.child) {
                        ForEach(link.children) { Text($0.name).tag($0.id) }
                    }
                    .pickerStyle(.navigationLink)
                }
                Text(link.line).font(.headline).fixedSize(horizontal: false, vertical: true)
                if let c = link.confirmation { Text(c).font(.caption2).foregroundStyle(.green) }
                Button { link.toggleRecording() } label: {
                    Label(link.recording ? "Stop" : "Speak", systemImage: link.recording ? "stop.circle.fill" : "mic.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(link.recording ? .red : .orange)
                Button { link.send(["action": "toggleFeed"]) } label: {
                    Label(link.openFeed.isEmpty ? "Start feed" : "Finish feed", systemImage: "drop.fill").frame(maxWidth: .infinity)
                }
                if link.openFeed == "breast" {
                    Button { link.send(["action": "switchSide"]) } label: { Label("Switch side", systemImage: "arrow.left.arrow.right") }
                }
                Button { diaper = true } label: { Label("Diaper", systemImage: "humidity.fill").frame(maxWidth: .infinity) }
                Button { link.send(["action": "toggleSleep"]) } label: {
                    Label(link.sleeping ? "Woke up" : "Asleep", systemImage: link.sleeping ? "sun.max.fill" : "moon.zzz.fill").frame(maxWidth: .infinity)
                }
                if let id = link.lastId {
                    Button("Undo last") { link.send(["action": "undo", "id": id]); link.lastId = nil }.font(.caption)
                }
            }
        }
        .confirmationDialog("Diaper", isPresented: $diaper) {
            ForEach(["wet", "dirty", "both", "dry"], id: \.self) { k in
                Button(k.capitalized) { link.send(["action": "diaper", "kind": k]) }
            }
        }
    }
}
