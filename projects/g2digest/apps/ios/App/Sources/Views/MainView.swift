import SwiftUI
import G2DigestKit

public struct MainView: View {
    @StateObject private var appModel = AppModel()

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
                            if appModel.isPaired {
                                appModel.showSettingsSheet = true
                            } else {
                                appModel.showPairingSheet = true
                            }
                        } label: {
                            Image(systemName: appModel.isPaired ? "gearshape" : "qrcode")
                                .foregroundStyle(appModel.isPaired ? Color.primary : Color.accentColor)
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
            .task {
                await appModel.refreshAll()
                checkWhatsNew()
                #if DEBUG
                // Screenshots without taps: `-card N` opens card N (0-based); `-showHistory`,
                // `-showBrief`, `-showSettings` open those sheets once the edition has loaded.
                let args = ProcessInfo.processInfo.arguments
                if let i = args.firstIndex(of: "-card"), i + 1 < args.count, let n = Int(args[i + 1]),
                   n < (appModel.currentBundle?.cards.count ?? 0) { appModel.currentCardIndex = n }
                if args.contains("-showHistory") { appModel.showHistorySheet = true }
                if args.contains("-showBrief") { appModel.showBriefSheet = true }
                if args.contains("-showSettings") { appModel.showSettingsSheet = true }
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
