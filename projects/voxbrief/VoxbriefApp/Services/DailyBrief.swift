import Foundation
import UserNotifications
import WidgetKit

/// The Daily Brief: every open action item across the user's notes, high priority first, and
/// what they recorded since they last looked. Built from `VoiceNote.actionItems`,
/// `completedActionItems` and `actionItemPriorities` (nothing new is stored on notes).
struct DailyBrief: Equatable {
    struct Item: Identifiable, Equatable {
        let noteId: UUID
        let noteTitle: String
        let noteDate: Date
        let text: String
        /// "high", "medium", "low" or nil, as `VoiceNote.actionItemPriorities` stores it.
        let priority: String?
        var id: String { "\(noteId)|\(text)" }
    }

    let openItems: [Item]
    /// Notes recorded since `since`, newest first.
    let newNotes: [VoiceNote]
    let since: Date

    var highPriority: [Item] { openItems.filter { $0.priority == "high" } }
    var otherItems: [Item] { openItems.filter { $0.priority != "high" } }

    static func build(notes: [VoiceNote], since: Date) -> DailyBrief {
        let visible = notes.filter { !$0.isArchived && !$0.isLocked }
        var items: [Item] = []
        for note in visible where note.status == .ready {
            for text in note.actionItems where !note.completedActionItems.contains(text) {
                items.append(Item(noteId: note.id, noteTitle: note.title, noteDate: note.createdAt, text: text, priority: note.priority(for: text)))
            }
        }
        items.sort { a, b in
            let ra = rank(a.priority), rb = rank(b.priority)
            return ra != rb ? ra < rb : a.noteDate > b.noteDate
        }
        let newNotes = visible
            .filter { $0.createdAt > since }
            .sorted { $0.createdAt > $1.createdAt }
        return DailyBrief(openItems: items, newNotes: newNotes, since: since)
    }

    private static func rank(_ priority: String?) -> Int {
        switch priority {
        case "high": return 0
        case "medium": return 1
        case "low": return 2
        default: return 3
        }
    }

    // MARK: - When the user last looked

    static let lastOpenedKey = "daily_brief_last_opened"

    /// The brief covers notes since it was last opened, but at least the last 24 hours and at
    /// most the last 7 days.
    static func sinceDate(now: Date = Date(), defaults: UserDefaults = .standard) -> Date {
        let dayAgo = now.addingTimeInterval(-86_400)
        guard let last = defaults.object(forKey: lastOpenedKey) as? Date else { return dayAgo }
        return max(min(last, dayAgo), now.addingTimeInterval(-7 * 86_400))
    }

    static func markOpened(now: Date = Date(), defaults: UserDefaults = .standard) {
        defaults.set(now, forKey: lastOpenedKey)
    }

    // MARK: - Recap

    static let recapSystemPrompt = """
    You write a short recap of what the user recorded in their voice notes, from the notes' \
    titles and summaries. Two sentences at most, speaking to the user as "you", naming the \
    main topics. Respond with ONLY one valid JSON object -- no markdown code fences, no \
    commentary -- using exactly this key: "recap" (string).
    """

    static func recapUserPrompt(for notes: [VoiceNote]) -> String {
        notes.prefix(12).map { note in
            note.summary.isEmpty ? "- \(note.title)" : "- \(note.title): \(note.summary)"
        }.joined(separator: "\n")
    }

    private struct RecapJSON: Decodable { var recap: String? }

    static func parseRecap(_ raw: String) -> String? {
        guard let json = LLMCopywriterService.jsonObjectSubstring(in: raw),
              let recap = (try? JSONDecoder().decode(RecapJSON.self, from: Data(json.utf8)))?.recap?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !recap.isEmpty else { return nil }
        return recap
    }

    /// The recap of `notes`, written by the same on-device engine that writes the notes. Cached
    /// per set of notes, so reopening the brief doesn't run the model again.
    @MainActor
    static func recap(for notes: [VoiceNote], defaults: UserDefaults = .standard) async -> (text: String, engine: String)? {
        guard !notes.isEmpty else { return nil }
        let cacheKey = "daily_brief_recap_" + notes.map(\.id.uuidString).sorted().joined().hashValueString
        if let cached = defaults.dictionary(forKey: cacheKey) as? [String: String],
           let text = cached["text"], let engine = cached["engine"] {
            return (text, engine)
        }
        for engine in await LLMCopywriterService.shared.onDeviceEngines() {
            guard let raw = try? await engine.generate(recapSystemPrompt, recapUserPrompt(for: notes), 160),
                  let text = parseRecap(raw) else { continue }
            defaults.set(["text": text, "engine": engine.label], forKey: cacheKey)
            return (text, engine.label)
        }
        return nil
    }
}

private extension String {
    /// A stable short key (Swift's `hashValue` changes between launches).
    var hashValueString: String {
        var hash: UInt64 = 1469598103934665603
        for byte in utf8 { hash = (hash ^ UInt64(byte)) &* 1099511628211 }
        return String(hash, radix: 36)
    }
}

/// The opt-in morning notification for the brief. Local only: the next morning's notification is
/// scheduled with the current counts, and rescheduled whenever the app becomes active or the
/// setting changes, so the numbers are as fresh as the last time Voxbrief was opened.
// MARK: - Widget

extension DailyBrief {
    /// The widget's summary of this brief (`DailyBriefSnapshot`).
    static func snapshot(notes: [VoiceNote], now: Date = Date()) -> DailyBriefSnapshot {
        let brief = build(notes: notes, since: now.addingTimeInterval(-86_400))
        return DailyBriefSnapshot(
            openCount: brief.openItems.count,
            highCount: brief.highPriority.count,
            items: brief.openItems.prefix(DailyBriefSnapshot.maxItems).map {
                DailyBriefSnapshot.Item(text: $0.text, noteTitle: $0.noteTitle, priority: $0.priority)
            },
            recentNoteCount: brief.newNotes.count,
            updatedAt: now
        )
    }

    /// Writes the widget's snapshot and reloads the widget when its content changed. Called
    /// whenever the notes change (`BackgroundProcessingManager`).
    static func publishToWidget(notes: [VoiceNote]) {
        if snapshot(notes: notes).save() {
            WidgetCenter.shared.reloadTimelines(ofKind: DailyBriefSnapshot.widgetKind)
        }
    }
}

enum DailyBriefNotifier {
    static let enabledKey = "daily_brief_notification_enabled"
    static let hourKey = "daily_brief_notification_hour"
    static let minuteKey = "daily_brief_notification_minute"
    static let identifier = "voxbrief.dailyBrief"

    static var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    static var hour: Int { (UserDefaults.standard.object(forKey: hourKey) as? Int) ?? 8 }
    static var minute: Int { (UserDefaults.standard.object(forKey: minuteKey) as? Int) ?? 0 }

    /// Turning it on asks for notification permission; returns whether it ended up on.
    static func setEnabled(_ enabled: Bool, notes: [VoiceNote]) async -> Bool {
        guard enabled else {
            UserDefaults.standard.set(false, forKey: enabledKey)
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
            return false
        }
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
        UserDefaults.standard.set(granted, forKey: enabledKey)
        if granted { reschedule(notes: notes) }
        return granted
    }

    static func setTime(hour: Int, minute: Int, notes: [VoiceNote]) {
        UserDefaults.standard.set(hour, forKey: hourKey)
        UserDefaults.standard.set(minute, forKey: minuteKey)
        reschedule(notes: notes)
    }

    static func reschedule(notes: [VoiceNote], now: Date = Date()) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard isEnabled else { return }

        let brief = DailyBrief.build(notes: notes, since: DailyBrief.sinceDate(now: now))
        let content = UNMutableNotificationContent()
        content.title = "Your Voxbrief"
        content.body = body(for: brief)
        content.sound = .default
        content.userInfo = ["voxbriefScreen": "brief"]

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
    }

    static func body(for brief: DailyBrief) -> String {
        let open = brief.openItems.count
        guard open > 0 else { return "No open action items. Record something new today?" }
        let high = brief.highPriority
        var text = "\(open) open action item\(open == 1 ? "" : "s")"
        if let first = high.first {
            text += ", \(high.count) high priority: \(first.text)"
        } else if let first = brief.openItems.first {
            text += ". Next: \(first.text)"
        }
        return text
    }
}

/// Routes taps on Voxbrief's local notifications (the morning brief opens the brief) and lets
/// them show while the app is open.
final class VoxbriefNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = VoxbriefNotificationDelegate()

    func install() {
        UNUserNotificationCenter.current().delegate = self
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let screen = response.notification.request.content.userInfo["voxbriefScreen"] as? String else { return }
        await MainActor.run {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                NotificationCenter.default.post(name: .voxbriefNavigate, object: nil, userInfo: ["screen": screen])
            }
        }
    }
}
