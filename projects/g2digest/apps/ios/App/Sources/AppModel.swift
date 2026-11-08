import Foundation
import SwiftUI
import G2DigestKit

public enum ReaderViewMode: String, CaseIterable, Identifiable {
    case native = "Native"
    case hud = "G2 Glasses HUD"

    public var id: String { rawValue }
}

@MainActor
public final class AppModel: ObservableObject {
    public static let defaultServerURL = URL(string: "https://g2digest.hejitech.workers.dev")!

    @Published public var currentBundle: BundleData?
    @Published public var signedAudioMap: [String: SignedAudioEntry] = [:]
    @Published public var currentCardIndex: Int = 0
    @Published public var viewMode: ReaderViewMode = .native {
        didSet {
            UserDefaults.standard.set(viewMode.rawValue, forKey: "g2digest_view_mode")
        }
    }
    @Published public var editions: [EditionSummary] = []
    @Published public var isPaired: Bool = false
    @Published public var isOffline: Bool = false
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String?
    @Published public var showPairingSheet: Bool = false
    @Published public var showHistorySheet: Bool = false
    @Published public var showBriefSheet: Bool = false
    @Published public var showSettingsSheet: Bool = false
    @Published public var showWhatsNewSheet: Bool = false
    @Published public var userBrief: Brief?

    private var api: G2DigestAPI
    private let tokenKey = "g2digest_device_token"
    private let serverURLKey = "g2digest_server_url"

    public init() {
        let savedURL = UserDefaults.standard.string(forKey: serverURLKey)
            .flatMap { URL(string: $0) } ?? Self.defaultServerURL
        let savedToken = UserDefaults.standard.string(forKey: tokenKey)

        self.api = G2DigestAPI(baseURL: savedURL, token: savedToken)
        self.isPaired = (savedToken != nil && !savedToken!.isEmpty)

        if let savedMode = UserDefaults.standard.string(forKey: "g2digest_view_mode"),
           let mode = ReaderViewMode(rawValue: savedMode) {
            self.viewMode = mode
        }

        // Load built-in tour immediately as initial state
        self.currentBundle = TourBuilder.makeTour(reason: isPaired ? .waiting : .pair)
    }

    public var currentCard: CardInput? {
        guard let bundle = currentBundle,
              currentCardIndex >= 0 && currentCardIndex < bundle.cards.count else {
            return nil
        }
        return bundle.cards[currentCardIndex]
    }

    public func updateServerURL(_ newURL: URL) {
        UserDefaults.standard.set(newURL.absoluteString, forKey: serverURLKey)
        let token = UserDefaults.standard.string(forKey: tokenKey)
        self.api = G2DigestAPI(baseURL: newURL, token: token)
        Task {
            await refreshAll()
        }
    }

    public func saveToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
        self.isPaired = true
        Task {
            await api.setToken(token)
            await refreshAll()
        }
    }

    public func unpair() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        self.isPaired = false
        self.editions = []
        self.signedAudioMap = [:]
        self.userBrief = nil
        Task {
            await api.setToken(nil)
        }
        self.currentBundle = TourBuilder.makeTour(reason: .pair)
        self.currentCardIndex = 0
    }

    public func nextCard() {
        guard let bundle = currentBundle else { return }
        if currentCardIndex + 1 < bundle.cards.count {
            currentCardIndex += 1
        }
    }

    public func prevCard() {
        if currentCardIndex > 0 {
            currentCardIndex -= 1
        }
    }

    public func goToCard(index: Int) {
        guard let bundle = currentBundle else { return }
        if index >= 0 && index < bundle.cards.count {
            currentCardIndex = index
        }
    }

    public func refreshAll() async {
        isLoading = true
        errorMessage = nil

        do {
            if isPaired {
                let status = try await api.fetchDeviceStatus()
                self.isPaired = status.paired

                async let editionsTask = api.fetchEditions()
                async let latestTask = api.fetchEdition(date: "latest")
                async let briefTask = api.fetchBrief()

                let (edList, latestRes, brief) = try await (editionsTask, latestTask, briefTask)
                self.editions = edList
                self.currentBundle = latestRes.bundle
                self.signedAudioMap = latestRes.audio ?? [:]
                AudioPlayerService.shared.updateSignedAudioMap(self.signedAudioMap)
                self.userBrief = brief
                self.currentCardIndex = 0
                self.isOffline = false
            } else {
                self.currentBundle = TourBuilder.makeTour(reason: .pair)
                self.currentCardIndex = 0
            }
        } catch {
            print("Refresh failed: \(error)")
            self.isOffline = true
            if currentBundle == nil {
                self.currentBundle = TourBuilder.makeTour(reason: .offline)
                self.currentCardIndex = 0
            }
        }

        isLoading = false
    }

    public func loadEdition(date: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let res = try await api.fetchEdition(date: date)
            self.currentBundle = res.bundle
            self.signedAudioMap = res.audio ?? [:]
            AudioPlayerService.shared.updateSignedAudioMap(self.signedAudioMap)
            self.currentCardIndex = 0
        } catch {
            self.errorMessage = "Failed to load edition for \(date): \(error.localizedDescription)"
        }

        isLoading = false
    }

    public func redeemCode(_ code: String) async -> Bool {
        isLoading = true
        errorMessage = nil

        do {
            let result = try await api.redeemPairingCode(code: code)
            saveToken(result.deviceToken)
            isLoading = false
            return true
        } catch {
            self.errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }
}
