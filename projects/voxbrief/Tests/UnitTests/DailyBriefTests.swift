import XCTest
@testable import Voxbrief

/// 02: the Daily Brief's item collection, ordering, look-back window and notification text.
final class DailyBriefTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_400_000)

    private func note(_ title: String, items: [String], done: [String] = [], priorities: [String: String] = [:], hoursAgo: Double = 2, archived: Bool = false) -> VoiceNote {
        VoiceNote(
            createdAt: now.addingTimeInterval(-hoursAgo * 3600),
            title: title,
            actionItems: items,
            completedActionItems: done,
            actionItemPriorities: priorities,
            status: .ready,
            isArchived: archived
        )
    }

    func testOpenItemsAcrossNotesHighFirst() {
        let notes = [
            note("Errands", items: ["Pharmacy pickup", "Return the drill"], done: ["Pharmacy pickup"], hoursAgo: 1),
            note("Kitchen", items: ["Get a firm quote"], priorities: ["Get a firm quote": "high"], hoursAgo: 30),
            note("Archived", items: ["Old thing"], archived: true),
        ]
        let brief = DailyBrief.build(notes: notes, since: now.addingTimeInterval(-86_400))
        XCTAssertEqual(brief.openItems.map(\.text), ["Get a firm quote", "Return the drill"])
        XCTAssertEqual(brief.highPriority.count, 1)
        XCTAssertEqual(brief.newNotes.map(\.title), ["Errands"], "archived notes and notes before `since` aren't new")
    }

    func testSinceIsBetweenOneAndSevenDays() {
        let defaults = UserDefaults(suiteName: "DailyBriefTests")!
        defaults.removePersistentDomain(forName: "DailyBriefTests")
        XCTAssertEqual(DailyBrief.sinceDate(now: now, defaults: defaults), now.addingTimeInterval(-86_400))
        DailyBrief.markOpened(now: now.addingTimeInterval(-3 * 86_400), defaults: defaults)
        XCTAssertEqual(DailyBrief.sinceDate(now: now, defaults: defaults), now.addingTimeInterval(-3 * 86_400))
        DailyBrief.markOpened(now: now.addingTimeInterval(-30 * 86_400), defaults: defaults)
        XCTAssertEqual(DailyBrief.sinceDate(now: now, defaults: defaults), now.addingTimeInterval(-7 * 86_400))
    }

    func testNotificationBodyNamesTheTopItem() {
        let brief = DailyBrief.build(notes: [note("Kitchen", items: ["Get a firm quote", "Ask about the sink"], priorities: ["Get a firm quote": "high"])], since: now)
        XCTAssertEqual(DailyBriefNotifier.body(for: brief), "2 open action items, 1 high priority: Get a firm quote")
    }

    func testRecapParsing() {
        XCTAssertEqual(DailyBrief.parseRecap(##"{"recap": "You planned Q4."}"##), "You planned Q4.")
        XCTAssertNil(DailyBrief.parseRecap("no json"))
    }

    @MainActor
    func testToggleActionItemUpdatesChecklist() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("brief-\(UUID()).json")
        let repository = NoteRepository(customStorageURL: url)
        var item = note("Kitchen", items: ["Get a firm quote"])
        item.cleanedNote = "- [ ] Get a firm quote"
        repository.save(item)
        repository.toggleActionItem(id: item.id, item: "Get a firm quote")
        XCTAssertEqual(repository.note(withId: item.id)?.completedActionItems, ["Get a firm quote"])
        XCTAssertEqual(repository.note(withId: item.id)?.cleanedNote, "- [x] Get a firm quote")
    }

    func testWidgetSnapshotListsTheTopItems() {
        let notes = [
            note("Errands", items: ["Pharmacy pickup", "Return the drill", "Buy stamps", "Car wash"], hoursAgo: 1),
            note("Kitchen", items: ["Get a firm quote"], priorities: ["Get a firm quote": "high"], hoursAgo: 30),
        ]
        let snapshot = DailyBrief.snapshot(notes: notes, now: now)
        XCTAssertEqual(snapshot.openCount, 5)
        XCTAssertEqual(snapshot.highCount, 1)
        XCTAssertEqual(snapshot.items.count, DailyBriefSnapshot.maxItems)
        XCTAssertEqual(snapshot.items.first, .init(text: "Get a firm quote", noteTitle: "Kitchen", priority: "high"))
        XCTAssertEqual(snapshot.recentNoteCount, 1)

        let later = DailyBrief.snapshot(notes: notes, now: now.addingTimeInterval(60))
        XCTAssertTrue(snapshot.sameContent(as: later), "only the time changed, so the widget isn't reloaded")
    }
}
