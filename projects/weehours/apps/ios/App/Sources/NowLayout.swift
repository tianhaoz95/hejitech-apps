import LogCore
import SwiftUI

/// The cards on Now. With the log buttons (`QuickTiles`) they make up Now's items (`NowItem`), in
/// the order this phone shows them: each phone keeps its own order (`NowLayout.key`, a comma list
/// of raw values). The arrange button in Now's toolbar makes everything jiggle so cards and buttons
/// can each be dragged into place, like widgets and apps on the Home Screen (`NowCards`).
enum NowSection: String, CaseIterable, Identifiable {
    case rhythm, shiftNote, status, photos, partner, shiftDigest, milkStash, review, needsDetails

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
        }
    }
}

/// One thing on Now: a card, full width, or a log button, two to a row (`NowFlow`).
enum NowItem: Hashable, Identifiable {
    case section(NowSection)
    case tile(String)

    init?(raw: String) {
        if raw.hasPrefix("tile.") { self = .tile(String(raw.dropFirst(5))) }
        else if let s = NowSection(rawValue: raw) { self = .section(s) }
        else { return nil }
    }

    var raw: String {
        switch self {
        case .section(let s): s.rawValue
        case .tile(let key): "tile.\(key)"
        }
    }

    var id: String { raw }
    var isTile: Bool { if case .tile = self { true } else { false } }

    var title: String {
        switch self {
        case .section(let s): s.title
        case .tile(let key): QuickTiles.title(key)
        }
    }

    var note: String? {
        switch self {
        case .section(let s): s.note
        case .tile(let key): QuickTiles.note(key)
        }
    }

    var icon: String {
        switch self {
        case .section(let s): s.icon
        case .tile(let key): QuickTiles.icon(key)
        }
    }
}

enum NowLayout {
    static let key = "nowSectionOrder"

    /// The cards, then the buttons this household has (`QuickTiles.available`).
    static func defaults(tiles: [String]) -> [NowItem] {
        NowSection.allCases.map(NowItem.section) + tiles.map(NowItem.tile)
    }

    /// The stored order, with items it doesn't name (added in a later version, or a category just
    /// turned on) put back right after the item they follow by default. Buttons it names that the
    /// household doesn't have now keep their place for when it does. Orders saved before the
    /// buttons moved one by one name them all as `actions`: they stay together there.
    static func order(_ stored: String, tiles: [String]) -> [NowItem] {
        var order: [NowItem] = []
        for raw in stored.split(separator: ",").map(String.init) {
            if raw == "actions" {
                order += tiles.map(NowItem.tile).filter { !order.contains($0) }
            } else if let item = NowItem(raw: raw), !order.contains(item) {
                order.append(item)
            }
        }
        let all = defaults(tiles: tiles)
        for (i, item) in all.enumerated() where !order.contains(item) {
            let before = all[..<i].last { order.contains($0) }
            let at = before.flatMap { order.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
            order.insert(item, at: at)
        }
        return order
    }

    static func encode(_ order: [NowItem], tiles: [String]) -> String {
        order == defaults(tiles: tiles) ? "" : order.map(\.raw).joined(separator: ",")
    }

    /// Moves within the items listed (`shown`); the others keep their slots.
    static func move(_ order: [NowItem], shown: [NowItem], from: IndexSet, to: Int) -> [NowItem] {
        var moved = shown
        moved.move(fromOffsets: from, toOffset: to)
        return place(order, shown: shown, as: moved)
    }

    /// `order` with the items listed (`shown`) rearranged as `arranged`; the others keep their slots.
    static func place(_ order: [NowItem], shown: [NowItem], as arranged: [NowItem]) -> [NowItem] {
        guard Set(arranged) == Set(shown), arranged.count == shown.count else { return order }
        var next = arranged.makeIterator()
        return order.map { shown.contains($0) ? next.next()! : $0 }
    }

    /// What this household can have, so arranging doesn't list a milk stash nobody keeps.
    static func available(_ item: NowItem, tiles: [String], household h: Household, localOnly: Bool, rhythm: Bool) -> Bool {
        switch item {
        case .tile(let key): tiles.contains(key)
        case .section(.rhythm): rhythm
        case .section(.milkStash): h.enabled.contains("pumping") && h.trackMilkStash
        case .section(.partner): !localOnly   // other caregivers' heads-ups need a shared household
        case .section: true
        }
    }
}

struct NowTileKey: LayoutValueKey {
    static let defaultValue = false
}

extension View {
    /// Marks a log button for `NowFlow`, which puts two to a row.
    func nowTile(_ on: Bool = true) -> some View { layoutValue(key: NowTileKey.self, value: on) }
}

/// Now's column: cards full width, log buttons two to a row, like apps between widgets on the
/// Home Screen. Views with no height (a card that isn't there right now) take no room.
struct NowFlow: Layout {
    var spacing: CGFloat = 16
    var tileSpacing: CGFloat = 12

    private struct Row {
        var items: [(index: Int, size: CGSize)]
        let tiles: Bool
        var height: CGFloat
    }

    private func rows(_ width: CGFloat, _ subviews: Subviews) -> [Row] {
        let half = (width - tileSpacing) / 2
        var rows: [Row] = []
        var open = false   // the last row is a button with room beside it
        for (i, v) in subviews.enumerated() {
            let tile = v[NowTileKey.self]
            let size = v.sizeThatFits(ProposedViewSize(width: tile ? half : width, height: nil))
            guard size.height >= 1 else { continue }
            if tile, open {
                rows[rows.count - 1].items.append((i, size))
                rows[rows.count - 1].height = max(rows[rows.count - 1].height, size.height)
                open = false
            } else {
                rows.append(Row(items: [(i, size)], tiles: tile, height: size.height))
                open = tile
            }
        }
        return rows
    }

    private func gap(_ a: Row, _ b: Row) -> CGFloat { a.tiles && b.tiles ? tileSpacing : spacing }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.replacingUnspecifiedDimensions().width
        let rows = rows(width, subviews)
        var height: CGFloat = 0
        for (n, r) in rows.enumerated() { height += r.height + (n > 0 ? gap(rows[n - 1], r) : 0) }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let half = (bounds.width - tileSpacing) / 2
        let rows = rows(bounds.width, subviews)
        let placed = Set(rows.flatMap { $0.items.map(\.index) })
        for (i, v) in subviews.enumerated() where !placed.contains(i) {
            v.place(at: bounds.origin, proposal: ProposedViewSize(width: bounds.width, height: 0))
        }
        var y = bounds.minY
        for (n, r) in rows.enumerated() {
            if n > 0 { y += gap(rows[n - 1], r) }
            for (k, item) in r.items.enumerated() {
                let x = bounds.minX + (r.tiles ? CGFloat(k) * (half + tileSpacing) : 0)
                subviews[item.index].place(at: CGPoint(x: x, y: y + (r.height - item.size.height) / 2),
                                           proposal: ProposedViewSize(width: r.tiles ? half : bounds.width, height: item.size.height))
            }
            y += r.height
        }
    }
}

/// Now's cards and buttons. While arranging they jiggle like apps on the Home Screen: hold one for
/// a moment and drag it, the others slide out of the way, and dragging near the top or bottom edge
/// scrolls. A quick swipe still scrolls. Items that come and go show as a placeholder while
/// arranging, so they can be placed too. Everything is measured in global coordinates, so the
/// lifted item keeps to the finger while the list scrolls under it.
struct NowCards<Card: View>: View {
    /// Every item in this phone's order, including ones not shown.
    let order: [NowItem]
    let shown: [NowItem]
    let arranging: Bool
    let save: ([NowItem]) -> Void
    @ViewBuilder let card: (NowItem) -> Card

    private struct Lift {
        let item: NowItem
        let grab: CGPoint   // finger minus the item's corner, when lifted
        var finger: CGPoint
        var order: [NowItem]
    }

    @State private var lift: Lift?
    @State private var swapped = Date.distantPast
    @State private var frames: [NowItem: CGRect] = [:]
    @State private var empty: Set<NowItem> = []
    @State private var position = ScrollPosition(edge: .top)
    @State private var scroll = ScrollGeometry?.none
    @State private var viewport = CGRect.zero
    @State private var autoscroll: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let order = lift?.order ?? shown
        ScrollView {
            NowFlow {
                if arranging {
                    Label("Hold a card or button, then drag it into place", systemImage: "hand.draw")
                        .font(.footnote).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
                // Outside arranging the cards go in bare: `NowFlow` skips the ones that aren't
                // there right now, and a button can be two (Finish bottle, Start bottle).
                ForEach(order) { item in
                    if arranging { cell(item) } else { card(item) }
                }
            }
            .padding()
        }
        .scrollPosition($position)
        .scrollDisabled(lift != nil)
        .onScrollGeometryChange(for: ScrollGeometry.self) { $0 } action: { _, g in scroll = g }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { viewport = $0 }
        .onChange(of: arranging) { _, on in if !on { drop() } }
        .sensoryFeedback(.selection, trigger: lift?.order)
        .sensoryFeedback(.impact(weight: .medium), trigger: lift?.item) { $1 != nil }
    }

    @ViewBuilder private func cell(_ item: NowItem) -> some View {
        let lifted = lift?.item == item
        ZStack(alignment: .top) {
            VStack(spacing: 0) { card(item) }
                .frame(maxWidth: .infinity)
                .onGeometryChange(for: Bool.self) { $0.size.height < 1 } action: { e in
                    if e { empty.insert(item) } else { empty.remove(item) }
                }
            if arranging, empty.contains(item) { Placeholder(item: item) }
        }
        .allowsHitTesting(!arranging)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { f in
            if arranging { frames[item] = f }
        }
        .modifier(Jiggle(on: arranging && !lifted && lift == nil && !reduceMotion, degrees: item.isTile ? 1.2 : 0.5, seed: item.raw.hashValue))
        .scaleEffect(lifted ? (item.isTile ? 1.08 : 1.03) : 1)
        .shadow(color: .black.opacity(lifted ? 0.25 : 0), radius: 16, y: 8)
        .offset(lifted ? offset(of: item) : .zero)
        .zIndex(lifted ? 1 : 0)
        .contentShape(RoundedRectangle(cornerRadius: 18))
        // UIKit's long press, not a SwiftUI drag: any SwiftUI drag on a card keeps the list from
        // scrolling on iOS 18+, while this one gives way to the scroll view's pan until it fires.
        .gesture(HoldToDrag(enabled: arranging) { phase, at in hold(item, phase, at) })
        .animation(.snappy(duration: 0.25), value: lifted)
        .modifier(Arranging(on: arranging, item: item) { by in nudge(item, by: by) })
        .nowTile(item.isTile)
    }

    /// The lifted item follows the finger, wherever its slot is now; a card only up and down.
    private func offset(of item: NowItem) -> CGSize {
        guard let lift, let f = frames[item] else { return .zero }
        return CGSize(width: item.isTile ? lift.finger.x - lift.grab.x - f.minX : 0, height: lift.finger.y - lift.grab.y - f.minY)
    }

    private func hold(_ item: NowItem, _ phase: HoldToDrag.Phase, _ at: CGPoint) {
        switch phase {
        case .lift:
            guard lift == nil, let f = frames[item] else { return }
            lift = Lift(item: item, grab: CGPoint(x: at.x - f.minX, y: at.y - f.minY), finger: at, order: shown)
            startAutoscroll()
        case .move:
            guard lift?.item == item else { return }
            lift?.finger = at
            reorder()
        case .drop:
            drop()
        }
    }

    /// Puts the lifted item where its middle is, in reading order: past a neighbour's middle (a
    /// button beside it: across its middle), they swap. Once they've swapped, the next swap waits a
    /// moment, so a row closing up under the finger doesn't send the item straight back.
    private func reorder() {
        guard var l = lift, let f = frames[l.item], Date().timeIntervalSince(swapped) > 0.25 else { return }
        let p = CGPoint(x: (l.item.isTile ? l.finger.x - l.grab.x : f.minX) + f.width / 2, y: l.finger.y - l.grab.y + f.height / 2)
        let others = l.order.filter { $0 != l.item }
        let at = others.filter { o in
            guard let r = frames[o] else { return false }
            if p.y > r.maxY { return true }
            if p.y < r.minY { return false }
            return o.isTile && l.item.isTile ? p.x > r.midX : p.y > r.midY
        }.count
        var next = others
        next.insert(l.item, at: at)
        guard next != l.order else { return }
        l.order = next
        swapped = Date()
        withAnimation(.snappy(duration: 0.3)) { lift = l }
    }

    private func drop() {
        autoscroll?.cancel()
        autoscroll = nil
        guard let l = lift else { return }
        withAnimation(.snappy(duration: 0.3)) {
            save(NowLayout.place(order, shown: shown, as: l.order))
            lift = nil
        }
    }

    /// Near the top or bottom edge, the list scrolls, faster the closer the finger gets.
    private func startAutoscroll() {
        autoscroll?.cancel()
        autoscroll = Task { @MainActor in
            while !Task.isCancelled, let l = lift {
                try? await Task.sleep(for: .milliseconds(16))
                guard let g = scroll else { continue }
                let edge: CGFloat = 90, finger = l.finger.y
                let top = viewport.minY + g.contentInsets.top, bottom = viewport.maxY - g.contentInsets.bottom
                let speed = finger < top + edge ? -(top + edge - finger) / edge * 14
                    : finger > bottom - edge ? (finger - (bottom - edge)) / edge * 14 : 0
                guard speed != 0 else { continue }
                let y = g.contentOffset.y + g.contentInsets.top
                let maxY = max(0, g.contentSize.height + g.contentInsets.top + g.contentInsets.bottom - g.containerSize.height)
                let to = min(max(y + speed, 0), maxY)
                guard to != y else { continue }
                position.scrollTo(y: to)
                reorder()
            }
        }
    }

    /// VoiceOver: Move up / Move down, one item at a time.
    private func nudge(_ item: NowItem, by: Int) {
        guard let i = shown.firstIndex(of: item), shown.indices.contains(i + by) else { return }
        withAnimation(.snappy) {
            save(NowLayout.move(order, shown: shown, from: [i], to: by > 0 ? i + 2 : i - 1))
        }
    }
}

/// Hold for a moment, then drag; reports the finger in global coordinates.
private struct HoldToDrag: UIGestureRecognizerRepresentable {
    enum Phase { case lift, move, drop }
    let enabled: Bool
    let changed: (Phase, CGPoint) -> Void

    func makeUIGestureRecognizer(context: Context) -> UILongPressGestureRecognizer {
        let g = UILongPressGestureRecognizer()
        g.minimumPressDuration = 0.2
        return g
    }

    func updateUIGestureRecognizer(_ g: UILongPressGestureRecognizer, context: Context) {
        g.isEnabled = enabled
    }

    func handleUIGestureRecognizerAction(_ g: UILongPressGestureRecognizer, context: Context) {
        let at = context.converter.location(in: .global)
        switch g.state {
        case .began: changed(.lift, at)
        case .changed: changed(.move, at)
        case .ended, .cancelled, .failed: changed(.drop, at)
        default: break
        }
    }
}

/// A card or button that isn't there right now, so it can still be placed while arranging.
private struct Placeholder: View {
    let item: NowItem

    var body: some View {
        Group {
            if item.isTile {
                VStack(alignment: .leading, spacing: 6) {
                    Image(systemName: item.icon).font(.title2).foregroundStyle(Theme.sleep)
                    Text(item.title).font(.headline)
                    if let note = item.note { Text(note).font(.caption).foregroundStyle(.secondary) }
                }
                .padding()
                .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
            } else {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title).font(.subheadline.weight(.semibold))
                        if let note = item.note { Text(note).font(.caption).foregroundStyle(.secondary) }
                    }
                } icon: { Image(systemName: item.icon).foregroundStyle(Theme.sleep) }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(Theme.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
    }
}

/// The Home Screen wobble, a little out of step from item to item.
private struct Jiggle: ViewModifier {
    let on: Bool
    let degrees: Double
    let seed: Int
    @State private var tilt = false

    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(on ? (tilt ? degrees : -degrees) : 0))
            .onChange(of: on, initial: true) { _, on in
                guard on else { tilt = false; return }
                let delay = Double(abs(seed) % 7) * 0.02
                withAnimation(.easeInOut(duration: 0.14).repeatForever(autoreverses: true).delay(delay)) { tilt = true }
            }
    }
}

/// While arranging, each item is one element with its name and Move up / Move down actions.
private struct Arranging: ViewModifier {
    let on: Bool
    let item: NowItem
    let nudge: (Int) -> Void

    func body(content: Content) -> some View {
        if on {
            content
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(item.title)
                .accessibilityHint("Hold, then drag to move it")
                .accessibilityAction(named: "Move up") { nudge(-1) }
                .accessibilityAction(named: "Move down") { nudge(1) }
                .accessibilityIdentifier("arrange-\(item.raw)")
        } else {
            content
        }
    }
}
