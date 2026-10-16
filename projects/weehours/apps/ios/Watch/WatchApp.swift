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
    @Published var line = "Open the iPhone app"
    @Published var openFeed = ""
    @Published var sleeping = false
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
                WCSession.default.transferFile(url, metadata: ["capturedAt": startedAt.timeIntervalSince1970])
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
    }
}

struct WatchHome: View {
    @EnvironmentObject var link: PhoneLink
    @State private var diaper = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
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
