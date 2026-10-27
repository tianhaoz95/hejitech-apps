import Foundation
import HeadwayKit
import Observation
import WatchConnectivity
import WatchKit

/// Apple Watch state manager for Headway.
/// Keeps the departure board synced with the iPhone and provides standalone refresh when online.
@MainActor @Observable
final class WatchModel: NSObject, WCSessionDelegate {
    var board: Board?
    var tracked: TrackedWithProgress?
    var hasCommute: Bool = false
    var stations: [Station] = []
    var expressPreference: ExpressPreference = .all
    var loading: Bool = false
    var error: String? = nil
    var session: AuthSession? = nil

    private var backend: Backend

    static var config: BackendConfig {
        #if DEBUG
        .local
        #else
        .production
        #endif
    }

    override init() {
        self.backend = Backend(config: Self.config)
        super.init()

        // Load cached state from disk for instantaneous watch wake
        if let cachedData = UserDefaults.standard.data(forKey: "watch_cached_state"),
           let state = WatchSyncState.decode(from: cachedData) {
            apply(state: state, persist: false)
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    private func apply(state: WatchSyncState, persist: Bool = true) {
        self.session = state.session
        self.board = state.board
        self.tracked = state.tracked
        self.hasCommute = state.hasCommute
        if !state.stations.isEmpty { self.stations = state.stations }
        self.expressPreference = state.expressPreference
        self.error = nil

        self.backend = Backend(config: Self.config, session: state.session)

        if persist, let data = state.encode() {
            UserDefaults.standard.set(data, forKey: "watch_cached_state")
        }
    }

    // MARK: - Actions

    func refresh() async {
        loading = true
        defer { loading = false }

        // If phone is reachable, ask it to refresh and sync back
        if WCSession.isSupported(), WCSession.default.isReachable {
            WCSession.default.sendMessage([WatchMessage.kind: WatchMessage.kindRefresh], replyHandler: nil)
        }

        // Direct Worker call fallback if we have a session or public board
        do {
            if session != nil {
                let r = try await backend.myBoard(
                    from: board?.from.id,
                    to: board?.to.id,
                    express: expressPreference
                )
                self.board = r.board
                self.hasCommute = r.hasCommute
                self.tracked = r.tracked
                self.error = nil

                let state = WatchSyncState(
                    session: self.session,
                    board: self.board,
                    tracked: self.tracked,
                    hasCommute: self.hasCommute,
                    stations: self.stations,
                    expressPreference: self.expressPreference
                )
                if let data = state.encode() {
                    UserDefaults.standard.set(data, forKey: "watch_cached_state")
                }
            }
        } catch {
            // If offline, preserve the cached board
            if self.board == nil {
                self.error = error.localizedDescription
            }
        }
    }

    func flip() async {
        WKInterfaceDevice.current().play(.click)
        guard let b = board else { return }

        // Send flip request to phone
        if WCSession.isSupported(), WCSession.default.isReachable {
            WCSession.default.sendMessage([WatchMessage.kind: WatchMessage.kindFlip], replyHandler: nil)
        }

        // Also fetch directly
        let newFrom = b.to.id
        let newTo = b.from.id
        loading = true
        defer { loading = false }
        do {
            let r = try await backend.myBoard(from: newFrom, to: newTo, express: expressPreference)
            self.board = r.board
            self.tracked = r.tracked
            self.error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func track(_ train: BoardTrain) async {
        WKInterfaceDevice.current().play(.success)
        guard let b = board else { return }

        let payload: [String: Any] = [
            WatchMessage.kind: WatchMessage.kindTrack,
            WatchMessage.tripId: train.tripId,
            WatchMessage.serviceDate: train.serviceDate,
            WatchMessage.fromStation: b.from.id,
            WatchMessage.toStation: b.to.id
        ]

        if WCSession.isSupported(), WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil)
        }

        if session != nil {
            try? await backend.track(Tracked(
                tripId: train.tripId,
                serviceDate: train.serviceDate,
                from: b.from.id,
                to: b.to.id
            ))
            await refresh()
        }
    }

    func untrack() async {
        WKInterfaceDevice.current().play(.click)

        if WCSession.isSupported(), WCSession.default.isReachable {
            WCSession.default.sendMessage([WatchMessage.kind: WatchMessage.kindUntrack], replyHandler: nil)
        }

        self.tracked = nil
        if session != nil {
            try? await backend.untrack()
            await refresh()
        }
    }

    func setExpressPreference(_ pref: ExpressPreference) async {
        self.expressPreference = pref
        if WCSession.isSupported(), WCSession.default.isReachable {
            WCSession.default.sendMessage([
                WatchMessage.kind: WatchMessage.kindFilterExpress,
                WatchMessage.expressPref: pref.rawValue
            ], replyHandler: nil)
        }
        await refresh()
    }

    func cycleExpressPreference() async {
        WKInterfaceDevice.current().play(.click)
        let next: ExpressPreference
        switch expressPreference {
        case .all: next = .preferExpress
        case .preferExpress: next = .expressOnly
        case .expressOnly: next = .all
        }
        await setExpressPreference(next)
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let data = session.receivedApplicationContext[WatchMessage.stateData] as? Data,
           let state = WatchSyncState.decode(from: data) {
            Task { @MainActor in self.apply(state: state) }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        if let data = applicationContext[WatchMessage.stateData] as? Data,
           let state = WatchSyncState.decode(from: data) {
            Task { @MainActor in self.apply(state: state) }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let data = message[WatchMessage.stateData] as? Data,
           let state = WatchSyncState.decode(from: data) {
            Task { @MainActor in self.apply(state: state) }
        }
    }
}
