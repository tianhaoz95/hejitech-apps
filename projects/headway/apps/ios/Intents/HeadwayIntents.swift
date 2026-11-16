import AppIntents
import HeadwayKit
import SwiftUI

// Siri, Shortcuts and Spotlight actions for Headway, shared by the iPhone app and the watch app. Each
// target supplies `IntentHost` (App/Sources/IntentHost.swift, Watch/IntentHost.swift): the signed-in
// Worker client and whatever has to happen after a change. What Siri says is `SiriSpeech` (HeadwayKit).
// Never write the word "Apple" in any title, description or phrase here: App Store Connect rejects the
// whole build (ITMS-90626). Say "your watch".

struct HeadwayIntentError: Error, CustomLocalizedStringResourceConvertible {
    let message: String
    var localizedStringResource: LocalizedStringResource { LocalizedStringResource(stringLiteral: message) }

    static let signIn = HeadwayIntentError(message: "Open Headway on your iPhone and sign in first.")
    static let noCommute = HeadwayIntentError(message: "You haven't saved a commute yet. Set one up in Headway's Commute tab, or ask for the next train between two stations.")
    static let pro = HeadwayIntentError(message: "This needs Headway Pro. Open Headway to start your free week.")
}

enum HeadwayIntents {
    static var nowMs: Double { Clock.now().timeIntervalSince1970 * 1000 }

    /// The commute board for the time of day, or the pair asked for. One station given: the other end
    /// of the commute leg that matches.
    static func board(from: String?, to: String?) async throws -> MyBoard {
        try await IntentHost.checkAccess()
        guard let backend = await IntentHost.signedInBackend() else {
            if let from, let to, from != to { return MyBoard(board: try await IntentHost.publicBackend().board(from: from, to: to), hasCommute: false) }
            throw HeadwayIntentError.signIn
        }
        if let from, let to, from != to { return try await backend.myBoard(from: from, to: to) }
        let commute = try await backend.myBoard()
        guard let b = commute.board else {
            if from == nil && to == nil { throw HeadwayIntentError.noCommute }
            throw HeadwayIntentError(message: "Say both stations, like \"next train from Palo Alto to San Francisco\".")
        }
        if from == nil && to == nil { return commute }
        // Only one end given: keep the commute's other end, or flip it when they asked to go where it starts.
        let pair: (String, String) = {
            if let to { return to == b.from.id ? (b.to.id, b.from.id) : (b.from.id, to) }
            let f = from!
            return f == b.to.id ? (b.to.id, b.from.id) : (f, b.to.id)
        }()
        return try await backend.myBoard(from: pair.0, to: pair.1)
    }
}

// MARK: - Next train

struct NextTrainIntent: AppIntent {
    static let title: LocalizedStringResource = "Next Train"
    static let description = IntentDescription("Your next Caltrain with live delays: your commute for the time of day, or between two stations.")
    static let openAppWhenRun = false

    @Parameter(title: "From", description: "Leave empty for your commute.")
    var from: StationEntity?

    @Parameter(title: "To", description: "Leave empty for your commute.")
    var to: StationEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Next train from \(\.$from) to \(\.$to)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let r = try await HeadwayIntents.board(from: from?.id, to: to?.id)
        guard let board = r.board else { throw HeadwayIntentError.noCommute }
        let now = HeadwayIntents.nowMs
        return .result(dialog: IntentDialog(stringLiteral: SiriSpeech.nextTrains(board, now: now)), view: TrainsSnippet(board: board, now: now))
    }
}

// MARK: - Track my train

struct TrackNextTrainIntent: AppIntent {
    static let title: LocalizedStringResource = "Track My Next Train"
    static let description = IntentDescription("Follows the next train you can catch on your commute: you get an alert before your stop and its progress on the Lock Screen.")
    static let openAppWhenRun = false

    @Parameter(title: "To", description: "Leave empty for your commute.")
    var to: StationEntity?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let r = try await HeadwayIntents.board(from: nil, to: to?.id)
        guard let board = r.board else { throw HeadwayIntentError.noCommute }
        guard let train = SiriSpeech.upcoming(board, now: HeadwayIntents.nowMs).first else {
            return .result(dialog: IntentDialog(stringLiteral: "No more trains from \(board.from.name) to \(board.to.name) today."))
        }
        guard let backend = await IntentHost.signedInBackend() else { throw HeadwayIntentError.signIn }
        try await backend.track(Tracked(tripId: train.tripId, serviceDate: train.serviceDate, from: board.from.id, to: board.to.id))
        await IntentHost.didChange()
        return .result(dialog: IntentDialog(stringLiteral: SiriSpeech.startedTracking(train, to: board.to.name)))
    }
}

// MARK: - Where's my train

struct WhereIsMyTrainIntent: AppIntent {
    static let title: LocalizedStringResource = "Where's My Train"
    static let description = IntentDescription("Where the train you're tracking is: its next stop, when it gets to yours, and any delay.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await IntentHost.checkAccess()
        guard let backend = await IntentHost.signedInBackend() else { throw HeadwayIntentError.signIn }
        let r = try await backend.myBoard()
        if let t = r.tracked {
            let fromName = r.board.flatMap { $0.from.id == t.from ? $0.from.name : nil }
            return .result(dialog: IntentDialog(stringLiteral: SiriSpeech.tracked(t, fromName: fromName)))
        }
        return .result(dialog: "You're not tracking a train. Say \"Track my train with Headway\" to follow the next one.")
    }
}

// MARK: - Stop tracking

struct StopTrackingIntent: AppIntent {
    static let title: LocalizedStringResource = "Stop Tracking"
    static let description = IntentDescription("Stops following your train: no arrival alert.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await IntentHost.checkAccess()
        guard let backend = await IntentHost.signedInBackend() else { throw HeadwayIntentError.signIn }
        try await backend.untrack()
        await IntentHost.didChange()
        return .result(dialog: "Stopped tracking your train.")
    }
}

// MARK: - Siri phrases

/// Phrases that work with no setup. Each must name the app (\(.applicationName)), and none may say "Apple".
struct HeadwayShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NextTrainIntent(),
            phrases: [
                "When's my next train in \(.applicationName)",
                "Next train in \(.applicationName)",
                "When is my train in \(.applicationName)",
                "\(.applicationName) next train",
                "Next train to \(\.$to) in \(.applicationName)",
            ],
            shortTitle: "Next Train",
            systemImageName: "tram.fill"
        )
        AppShortcut(
            intent: TrackNextTrainIntent(),
            phrases: [
                "Track my train with \(.applicationName)",
                "Track my next train in \(.applicationName)",
                "\(.applicationName) track my train",
            ],
            shortTitle: "Track My Train",
            systemImageName: "location.fill"
        )
        AppShortcut(
            intent: WhereIsMyTrainIntent(),
            phrases: [
                "Where's my train in \(.applicationName)",
                "Where is my train in \(.applicationName)",
                "\(.applicationName) where's my train",
            ],
            shortTitle: "Where's My Train",
            systemImageName: "tram.circle"
        )
        AppShortcut(
            intent: StopTrackingIntent(),
            phrases: [
                "Stop tracking in \(.applicationName)",
                "Stop tracking my train in \(.applicationName)",
            ],
            shortTitle: "Stop Tracking",
            systemImageName: "xmark.circle"
        )
    }
}

// MARK: - Snippet

/// What Siri shows under its answer: the next three trains.
struct TrainsSnippet: View {
    let board: Board
    let now: Double

    var body: some View {
        let trains = Array(SiriSpeech.upcoming(board, now: now).prefix(3))
        VStack(alignment: .leading, spacing: 8) {
            Text("\(board.from.short) → \(board.to.short)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if trains.isEmpty {
                Text("No more trains today").font(.subheadline)
            }
            ForEach(trains) { t in
                HStack(spacing: 8) {
                    Text(Clock.time(t.predDep)).font(.headline.monospacedDigit())
                    Text("→ \(Clock.time(t.predArr))").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                    Spacer(minLength: 4)
                    Text(status(t)).font(.caption.weight(.semibold)).foregroundStyle(t.status == .late ? .orange : .secondary)
                }
            }
        }
        .padding()
    }

    private func status(_ t: BoardTrain) -> String {
        if t.status == .late, let d = t.delayMin, d > 0 { return "\(t.kindName) · +\(d) min" }
        return t.kindName
    }
}
