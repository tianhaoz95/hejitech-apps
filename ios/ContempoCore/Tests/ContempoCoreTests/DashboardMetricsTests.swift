import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import XCTest

final class DashboardMetricsTests: XCTestCase {
    func testEmptyEntriesProduceZeroedMetrics() {
        let metrics = DashboardMetrics.compute(from: [])
        XCTAssertEqual(metrics.confirmedHours, 0)
        XCTAssertTrue(metrics.otherRoleHours.isEmpty)
        XCTAssertEqual(metrics.pendingCount, 0)
        XCTAssertNil(metrics.openTimerEntry)
        XCTAssertNil(metrics.openTripEntry)
        XCTAssertEqual(metrics.totalMiles, 0)
    }

    /// The load-bearing behavior this session's roles feature depends on:
    /// only entries with no role tagged (the owner's own hours) count toward
    /// confirmedHours — a role-tagged entry must never inflate the 100-hour/
    /// 500-hour progress, even if confirmed.
    func testOnlyOwnerHoursCountTowardConfirmedHours() {
        let ownerEntry = Entry(task: "Cleaned unit", durationMinutes: 120, status: EntryStatus.confirmed.firestoreValue)
        let otherRoleEntry = Entry(
            task: "Cleaner visit",
            durationMinutes: 180,
            status: EntryStatus.confirmed.firestoreValue,
            roleId: "role-1",
            roleName: "Cleaner"
        )

        let metrics = DashboardMetrics.compute(from: [ownerEntry, otherRoleEntry])

        XCTAssertEqual(metrics.confirmedHours, 2.0, accuracy: 0.0001)
        XCTAssertEqual(metrics.otherRoleHours.count, 1)
        XCTAssertEqual(metrics.otherRoleHours.first?.name, "Cleaner")
        XCTAssertEqual(metrics.otherRoleHours.first?.hours ?? -1, 3.0, accuracy: 0.0001)
    }

    /// Pending-review entries (even role-tagged ones) shouldn't leak into
    /// either the owner's confirmedHours or the otherRoleHours breakdown —
    /// both are confirmed-only.
    func testPendingEntriesAreExcludedFromBothBuckets() {
        let pendingOwnerEntry = Entry(task: "Draft", durationMinutes: 60, status: EntryStatus.pendingReview.firestoreValue)
        let pendingOtherEntry = Entry(
            task: "Draft by cleaner",
            durationMinutes: 60,
            status: EntryStatus.pendingReview.firestoreValue,
            roleId: "role-1",
            roleName: "Cleaner"
        )

        let metrics = DashboardMetrics.compute(from: [pendingOwnerEntry, pendingOtherEntry])

        XCTAssertEqual(metrics.confirmedHours, 0)
        XCTAssertTrue(metrics.otherRoleHours.isEmpty)
        XCTAssertEqual(metrics.pendingCount, 2)
    }

    /// Two different confirmed entries under the SAME role must be summed
    /// into one RoleHoursSummary bucket, not two separate entries — this is
    /// what makes the "exceeds any other individual" comparison meaningful
    /// rather than fragmented per-entry.
    func testMultipleEntriesUnderSameRoleAreSummed() {
        let first = Entry(
            task: "Morning cleaning",
            durationMinutes: 60,
            status: EntryStatus.confirmed.firestoreValue,
            roleId: "role-1",
            roleName: "Cleaner"
        )
        let second = Entry(
            task: "Afternoon cleaning",
            durationMinutes: 90,
            status: EntryStatus.confirmed.firestoreValue,
            roleId: "role-1",
            roleName: "Cleaner"
        )

        let metrics = DashboardMetrics.compute(from: [first, second])

        XCTAssertEqual(metrics.otherRoleHours.count, 1)
        XCTAssertEqual(metrics.otherRoleHours.first?.hours ?? -1, 2.5, accuracy: 0.0001)
    }

    func testOpenTimerAndTripAreDetectedAndMutuallyExclusive() {
        let timerEntry = Entry(task: "Ongoing work", inProgress: true, isTrip: false)
        let tripEntry = Entry(task: "Ongoing trip", inProgress: true, isTrip: true)

        let metrics = DashboardMetrics.compute(from: [timerEntry, tripEntry])

        XCTAssertEqual(metrics.openTimerEntry?.task, "Ongoing work")
        XCTAssertEqual(metrics.openTripEntry?.task, "Ongoing trip")
    }

    func testTotalMilesSumsAcrossAllEntriesRegardlessOfStatus() {
        let confirmedTrip = Entry(status: EntryStatus.confirmed.firestoreValue, miles: 12.5)
        let pendingTrip = Entry(status: EntryStatus.pendingReview.firestoreValue, miles: 4.0)

        let metrics = DashboardMetrics.compute(from: [confirmedTrip, pendingTrip])

        XCTAssertEqual(metrics.totalMiles, 16.5, accuracy: 0.0001)
    }
}
