import RoarlyKit
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var store: ProStore
    @ObservedObject private var watch = PhoneWatchBridge.shared
    @Environment(\.dismiss) private var dismiss
    @State private var showWhatsNew = false
    @State private var showCredits = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Sounds play", selection: $model.automation) {
                        ForEach(Automation.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                } header: {
                    Text("How much Roarly does by itself")
                } footer: {
                    Text(automationFooter)
                }

                Section {
                    Toggle("Smart listening", isOn: $model.smartListening)
                    if model.smartListening && SmallModelDirector.builtInAvailable {
                        Toggle("Use the built-in language model instead (experimental)", isOn: $model.preferBuiltIn)
                    }
                } header: {
                    Text("Understanding the story")
                } footer: {
                    Text("When Roarly isn't sure (\"the lion was quiet\"), it reads the whole sentence again on your iPhone and decides; when it still can't tell, the sound waits for your tap. Engine: \(engineName). Nothing leaves your iPhone.")
                }

                Section {
                    Picker("Play sounds on", selection: $model.output) {
                        ForEach(SoundOutput.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    .disabled(!watch.isWatchAppInstalled || !model.isPro)
                    Toggle("Show my words", isOn: $model.showWords)
                } header: {
                    Text("While you tell the story")
                } footer: {
                    Text(watchFooter)
                }

                Section("Roarly Pro") {
                    if store.isPro {
                        Label("The whole storybook is open. Thank you!", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(Theme.lantern)
                    } else {
                        Text("You're on Roarly Free: \(SoundCatalog.freeCues.count) sounds and as many stories as you like, for good. Pro adds the other \(SoundCatalog.all.count - SoundCatalog.freeCues.count) sounds, your own words and the Apple Watch remote.")
                            .font(Theme.body(14))
                        Button("See what Pro adds") { model.openPaywall(.browse) }
                    }
                    Button("Restore purchases") { Task { await store.restore() } }
                    Link("Manage subscription", destination: URL(string: "https://apps.apple.com/account/subscriptions")!)
                }

                Section("About") {
                    Button("What's new") { showWhatsNew = true }
                    Button("Sound credits") { showCredits = true }
                    Link("Privacy policy", destination: URL(string: "https://tianhaoz95.github.io/hejitech-apps/roarly/privacy.html")!)
                    Link("Help & support", destination: URL(string: "https://tianhaoz95.github.io/hejitech-apps/roarly/support.html")!)
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Text("Roarly listens only while the lantern is lit. Your words are turned into text on your iPhone and forgotten when the story ends. No account, no recordings, nothing sent anywhere.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $showWhatsNew) { WhatsNewView() }
            .sheet(isPresented: $showCredits) { CreditsView() }
        }
    }

    private var engineName: String {
        guard model.smartListening else { return "off" }
        return model.director.engine == .none ? "unavailable, so unsure sounds are offered as taps" : model.director.engine.rawValue
    }

    private var automationFooter: String {
        switch model.automation {
        case .auto: return "Plays whenever a sound fits; offers a tap only when it really isn't sure."
        case .balanced: return "Plays when the story clearly calls for it (\"the lion roared\"); offers a tap when it might."
        case .ask: return "Plays only the sure ones by itself and offers the rest for you to tap."
        }
    }

    private var watchFooter: String {
        if !watch.isPaired { return "Pair an Apple Watch to tap sounds from your wrist." }
        if !watch.isWatchAppInstalled { return "Install Roarly on your Apple Watch from the Watch app to use it as a remote and speaker." }
        if !model.isPro { return "The Apple Watch remote is part of Roarly Pro." }
        return "Open Roarly on your watch to see suggestions there. The watch speaker is quiet: perfect for cuddles."
    }
}

struct CreditsView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(Self.credits)
                    .font(.footnote)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .navigationTitle("Sound credits")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    static var credits: String {
        guard let url = Bundle.main.url(forResource: "CREDITS", withExtension: "txt", subdirectory: "Sounds"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { return "Sounds made for Roarly." }
        return text
    }
}
