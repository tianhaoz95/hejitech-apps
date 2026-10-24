import LogCore
import SwiftUI

/// The cards on Now, in the order this phone shows them. Each phone keeps its own order
/// (`NowLayout.key`, a comma list of raw values); the arrange button in Now's toolbar turns the
/// cards into rows to drag, right on Now.
enum NowSection: String, CaseIterable, Identifiable {
    case rhythm, shiftNote, status, photos, partner, shiftDigest, milkStash, review, needsDetails, actions

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rhythm: "Today vs yesterday"
        case .shiftNote: "Shift note"
        case .status: "Status"
        case .photos: "Photos of what's going on"
        case .partner: "What others are doing"
        case .shiftDigest: "Shift summary"
        case .milkStash: "Milk stash"
        case .review: "To review"
        case .needsDetails: "Needs details"
        case .actions: "Log buttons"
        }
    }

    /// When the card is there at all, for the ones that come and go.
    var note: String? {
        switch self {
        case .shiftNote: "When someone leaves a note"
        case .photos: "While a feed, nap or activity is going"
        case .partner: "When another caregiver is busy"
        case .shiftDigest: "When a shift ends"
        case .review: "When a capture or duplicate needs a look"
        case .needsDetails: "After a watch entry without details"
        default: nil
        }
    }

    var icon: String {
        switch self {
        case .rhythm: "chart.bar.xaxis"
        case .shiftNote: "note.text"
        case .status: "clock"
        case .photos: "camera"
        case .partner: "person.2"
        case .shiftDigest: "list.bullet.clipboard"
        case .milkStash: "refrigerator"
        case .review: "exclamationmark.bubble"
        case .needsDetails: "questionmark.circle"
        case .actions: "square.grid.2x2"
        }
    }
}

enum NowLayout {
    static let key = "nowSectionOrder"

    /// The stored order, with sections it doesn't name (added in a later version) put back right
    /// after the section they follow by default.
    static func order(_ stored: String) -> [NowSection] {
        var order: [NowSection] = []
        for raw in stored.split(separator: ",") {
            if let s = NowSection(rawValue: String(raw)), !order.contains(s) { order.append(s) }
        }
        let all = NowSection.allCases
        for (i, s) in all.enumerated() where !order.contains(s) {
            let before = all[..<i].last { order.contains($0) }
            let at = before.flatMap { order.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
            order.insert(s, at: at)
        }
        return order
    }

    static func encode(_ order: [NowSection]) -> String {
        order == NowSection.allCases ? "" : order.map(\.rawValue).joined(separator: ",")
    }

    /// Moves within the sections listed (`shown`); the others keep their slots.
    static func move(_ order: [NowSection], shown: [NowSection], from: IndexSet, to: Int) -> [NowSection] {
        var moved = shown
        moved.move(fromOffsets: from, toOffset: to)
        var next = moved.makeIterator()
        return order.map { shown.contains($0) ? next.next()! : $0 }
    }

    /// The cards this household can have, so arranging doesn't list a milk stash nobody keeps.
    static func available(_ s: NowSection, household h: Household, localOnly: Bool, rhythm: Bool) -> Bool {
        switch s {
        case .rhythm: rhythm
        case .milkStash: h.enabled.contains("pumping") && h.trackMilkStash
        case .partner: !localOnly   // other caregivers' heads-ups need a shared household
        default: true
        }
    }
}

/// Now while arranging: one row per card, dragged into place. Done (in the toolbar) goes back.
struct ArrangeNowList: View {
    @Binding var stored: String
    let shown: [NowSection]

    var body: some View {
        let order = NowLayout.order(stored)
        List {
            Section {
                ForEach(shown) { s in
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.title)
                            if let note = s.note { Text(note).font(.caption).foregroundStyle(.secondary) }
                        }
                    } icon: { Image(systemName: s.icon).foregroundStyle(Theme.sleep) }
                        .padding(.vertical, 6)
                        .accessibilityIdentifier("arrange-\(s.rawValue)")
                }
                .onMove { from, to in
                    withAnimation { stored = NowLayout.encode(NowLayout.move(order, shown: shown, from: from, to: to)) }
                }
            } header: {
                Text("Drag to reorder")
            } footer: {
                Text("Cards that come and go take their place when they appear. The order is kept on this phone.")
            }
            if !stored.isEmpty {
                Section {
                    Button("Reset to default order") { withAnimation { stored = "" } }
                        .accessibilityIdentifier("arrangeReset")
                }
            }
        }
        .environment(\.editMode, .constant(.active))
    }
}
