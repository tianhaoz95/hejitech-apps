import AVFoundation
import LogCore
import SwiftUI
import WatchConnectivity
import WatchKit

/// The watch is an input and output surface: typed taps and tilts go to the phone as messages,
/// voice is recorded here and transcribed and decided on the phone. The status line comes back as
/// application context.
@main
struct WeeHoursWatchApp: App {
    @StateObject private var link = PhoneLink()
    var body: some Scene {
        WindowGroup {
            WatchRoot().environmentObject(link)
        }
    }
}

/// Buttons or tilt mode: the iPhone's Settings → Apple Watch picks the one it opens in, and each
/// has a button to switch to the other until the app is next launched.
struct WatchRoot: View {
    @EnvironmentObject var link: PhoneLink
    @State private var tilt: Bool?

    var body: some View {
        NavigationStack {
            if tilt ?? (link.startMode == "tilt") {
                TiltModeView { tilt = false }
            } else {
                WatchHome { tilt = true }
            }
        }
        // a complication: open already recording (tap Stop to send it to the phone)
        .onOpenURL { url in
            if url.host == "record", !link.recording { tilt = false; link.toggleRecording() }
        }
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

    struct Pinned: Identifiable, Equatable {
        let id: String
        let label: String
        let icon: String
        let runningId: String
    }

    @Published var line = "Open the iPhone app"
    @Published var openFeed = ""
    @Published var sleeping = false
    /// The household's children shown on the iPhone; the watch logs for `child` (or `"all"`).
    @Published var children: [Child] = []
    @Published var pinned: [Pinned] = []
    /// Tilt mode's four directions, as the iPhone lays them out.
    @Published var compass: [TiltCompass.Slot] = PhoneLink.defaultCompass

    /// Until the iPhone says otherwise (or for an iPhone app from before tilt mode).
    static let defaultCompass = [
        TiltCompass.Slot(direction: .north, action: "feed", label: "Feed", icon: "drop.fill"),
        TiltCompass.Slot(direction: .east, action: "diaper", label: "Diaper", icon: "humidity.fill"),
        TiltCompass.Slot(direction: .south, action: "sleep", label: "Sleep", icon: "moon.zzz.fill"),
    ]
    /// "buttons" or "tilt"; kept so the app opens in the right one before the iPhone answers.
    @Published var startMode = UserDefaults.standard.string(forKey: "startMode") ?? "buttons" {
        didSet { UserDefaults.standard.set(startMode, forKey: "startMode") }
    }
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

    /// Sends an action to the phone; `done` hears whether it was logged (`confirmation` says what).
    func send(_ message: [String: Any], done: ((Bool) -> Void)? = nil) {
        var message = message
        if !child.isEmpty { message["baby"] = child }
        guard WCSession.default.isReachable else {
            confirmation = "iPhone not reachable"
            WKInterfaceDevice.current().play(.failure)
            done?(false)
            return
        }
        WCSession.default.sendMessage(message) { reply in
            Task { @MainActor in
                if let e = reply["error"] as? String { self.confirmation = e; done?(false); return }
                self.confirmation = (reply["label"] as? String).map { "✓ \($0)" }
                self.lastId = reply["id"] as? String
                if let l = reply["line"] as? String { self.line = l }
                WKInterfaceDevice.current().play(.success)
                done?(true)
            }
        } errorHandler: { error in
            Task { @MainActor in self.confirmation = error.localizedDescription; done?(false) }
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
        pinned = (ctx["pinned"] as? [[String: Any]] ?? []).compactMap { p in
            guard let id = p["id"] as? String, let label = p["label"] as? String else { return nil }
            return Pinned(id: id, label: label, icon: p["icon"] as? String ?? "circle.fill",
                          runningId: p["runningId"] as? String ?? "")
        }
        if let m = ctx["startMode"] as? String, m != startMode { startMode = m }
        compass = (ctx["compass"] as? [[String: Any]])?.compactMap(TiltCompass.Slot.init(context:))
            ?? Self.defaultCompass + pinned.prefix(1).map { TiltCompass.Slot(direction: .west, action: "care", type: $0.id, label: $0.label, icon: $0.icon, runningId: $0.runningId) }
        if child != "all", !children.contains(where: { $0.id == child }) {
            child = (ctx["target"] as? String).flatMap { t in t == "all" ? "all" : children.first { $0.id == t }?.id } ?? children.first?.id ?? ""
        }
        applyChild()
    }

    /// Shows the chosen child's line and state (or combined state when "all" is selected).
    private func applyChild() {
        if child == "all", children.count > 1 {
            line = children.map { "\($0.name): \($0.line.components(separatedBy: " · ").first ?? $0.line)" }.joined(separator: " · ")
            openFeed = children.first(where: { !$0.openFeed.isEmpty })?.openFeed ?? ""
            sleeping = children.allSatisfy(\.sleeping)
            return
        }
        guard let c = children.first(where: { $0.id == child }) else { return }
        line = c.line
        openFeed = c.openFeed
        sleeping = c.sleeping
    }
}

struct WatchHome: View {
    @EnvironmentObject var link: PhoneLink
    let switchToTilt: () -> Void
    @State private var diaper = false
    @State private var finishingBottle = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if link.children.count > 1 {
                    Picker("Child", selection: $link.child) {
                        ForEach(link.children) { Text($0.name).tag($0.id) }
                        Text(link.children.count == 2 ? "Both" : "All").tag("all")
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
                Button {
                    if link.openFeed == "bottle" {
                        finishingBottle = true
                    } else {
                        link.send(["action": "toggleFeed"])
                    }
                } label: {
                    Label(link.openFeed.isEmpty ? "Start feed" : (link.openFeed == "bottle" ? "Finish bottle" : "Finish feed"),
                          systemImage: "drop.fill").frame(maxWidth: .infinity)
                }
                if link.openFeed == "breast" {
                    Button { link.send(["action": "switchSide"]) } label: { Label("Switch side", systemImage: "arrow.left.arrow.right") }
                }
                Button { diaper = true } label: { Label("Diaper", systemImage: "humidity.fill").frame(maxWidth: .infinity) }
                Button { link.send(["action": "toggleSleep"]) } label: {
                    Label(link.sleeping ? "Woke up" : "Asleep", systemImage: link.sleeping ? "sun.max.fill" : "moon.zzz.fill").frame(maxWidth: .infinity)
                }
                ForEach(link.pinned) { item in
                    Button {
                        var msg: [String: Any] = ["action": "care", "type": item.id]
                        if !item.runningId.isEmpty { msg["runningId"] = item.runningId }
                        link.send(msg)
                    } label: {
                        Label(item.label, systemImage: item.icon)
                            .frame(maxWidth: .infinity)
                    }
                }
                if let id = link.lastId {
                    Button("Undo last") { link.send(["action": "undo", "id": id]); link.lastId = nil }.font(.caption)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: switchToTilt) { Image(systemName: "gyroscope") }
                    .accessibilityLabel("Tilt mode")
            }
        }
        .confirmationDialog("Diaper", isPresented: $diaper) {
            ForEach(["wet", "dirty", "both", "dry"], id: \.self) { k in
                Button(k.capitalized) { link.send(["action": "diaper", "kind": k]) }
            }
        }
        .confirmationDialog("How much did they drink?", isPresented: $finishingBottle) {
            ForEach([(0.25, "¼"), (0.5, "½"), (0.75, "¾"), (1.0, "All")], id: \.0) { f, label in
                Button(label) { link.send(["action": "toggleFeed", "fraction": f]) }
            }
        }
    }
}
