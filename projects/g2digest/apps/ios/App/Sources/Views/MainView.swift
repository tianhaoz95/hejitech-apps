import SwiftUI
import G2DigestKit

public struct MainView: View {
    @StateObject private var appModel = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                VStack(spacing: 0) {
                    // Mode Picker Header
                    Picker("Reader Mode", selection: $appModel.viewMode) {
                        ForEach(ReaderViewMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.vertical, 8)

                    // Content View based on selected mode
                    if appModel.viewMode == .native {
                        NativeReaderView(appModel: appModel)
                    } else {
                        G2HUDView(appModel: appModel)
                    }
                }

                // Floating Audio Player Bar
                AudioPlayerBarView()
            }
            .navigationTitle(appModel.currentBundle?.edition.title ?? "G2 Digest")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        appModel.showHistorySheet = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                            Text(appModel.currentBundle?.date ?? "Today")
                                .font(.footnote.bold())
                        }
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        if appModel.userBrief != nil {
                            Button {
                                appModel.showBriefSheet = true
                            } label: {
                                Image(systemName: "doc.text")
                            }
                        }

                        Button {
                            if appModel.hasAccess {
                                appModel.showSettingsSheet = true
                            } else {
                                appModel.showPairingSheet = true
                            }
                        } label: {
                            if appModel.hasAccess {
                                Image(systemName: "gearshape")
                            } else {
                                Text("Sign In").fontWeight(.semibold)
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $appModel.showPairingSheet) {
                PairingSheet(appModel: appModel)
            }
            .sheet(isPresented: $appModel.showHistorySheet) {
                EditionsHistorySheet(appModel: appModel)
            }
            .sheet(isPresented: $appModel.showBriefSheet) {
                BriefSheet(appModel: appModel)
            }
            .sheet(isPresented: $appModel.showSettingsSheet) {
                SettingsSheet(appModel: appModel)
            }
            .sheet(isPresented: $appModel.showWhatsNewSheet) {
                WhatsNewView()
            }
            .onChange(of: scenePhase) { phase in
                // Back from the background: pick up editions published meanwhile.
                if phase == .active { Task { await appModel.refreshAll() } }
            }
            .task {
                await appModel.refreshAll()
                checkWhatsNew()
                #if DEBUG
                // Screenshots without taps: `-card N` opens card N (0-based); `-showHistory`,
                // `-showBrief`, `-showSettings` open those sheets once the edition has loaded.
                let args = ProcessInfo.processInfo.arguments
                // `-seedSignIn` signs in as the local seed account (reader@example.com) first.
                if args.contains("-seedSignIn") && !appModel.isSignedIn {
                    await appModel.signInWithSeed(email: "reader@example.com", password: "g2digest-dev")
                }
                if let i = args.firstIndex(of: "-card"), i + 1 < args.count, let n = Int(args[i + 1]),
                   n < (appModel.currentBundle?.cards.count ?? 0) { appModel.currentCardIndex = n }
                if args.contains("-showHistory") { appModel.showHistorySheet = true }
                if args.contains("-showBrief") { appModel.showBriefSheet = true }
                if args.contains("-showSettings") { appModel.showSettingsSheet = true }
                if args.contains("-showSignIn") { appModel.showPairingSheet = true }
                #endif
            }
        }
    }

    private func checkWhatsNew() {
        let lastSeen = UserDefaults.standard.string(forKey: WhatsNewView.lastSeenVersionKey)
        if lastSeen != WhatsNewView.currentVersion {
            appModel.showWhatsNewSheet = true
        }
    }
}
