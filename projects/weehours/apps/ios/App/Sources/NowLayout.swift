import LogCore
import SwiftUI

/// The cards on Now, in the order this phone shows them. Each phone keeps its own order
/// (`NowLayout.key`, a comma list of raw values); the arrange button in Now's toolbar makes the
/// cards jiggle so they can be dragged into place, like apps on the Home Screen (`NowCards`).
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
        return place(order, shown: shown, as: moved)
    }

    /// `order` with the sections listed (`shown`) rearranged as `arranged`; the others keep their slots.
    static func place(_ order: [NowSection], shown: [NowSection], as arranged: [NowSection]) -> [NowSection] {
        guard Set(arranged) == Set(shown), arranged.count == shown.count else { return order }
        var next = arranged.makeIterator()
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


/// Now's cards. While arranging they jiggle like apps on the Home Screen: hold one for a moment and
/// drag it, the others slide out of the way, and dragging near the top or bottom edge scrolls. A
/// quick swipe still scrolls. Cards that come and go show as a placeholder while arranging, so
/// they can be placed too. Everything is measured in global coordinates, so the lifted card keeps
/// to the finger while the list scrolls under it.
struct NowCards<Card: View>: View {
    @Binding var stored: String
    let shown: [NowSection]
    let arranging: Bool
    @ViewBuilder let card: (NowSection) -> Card

    private struct Lift {
        let section: NowSection
        let grab: CGFloat   // finger minus the card's top, when lifted
        var finger: CGFloat
        var order: [NowSection]
    }

    @State private var lift: Lift?
    @State private var frames: [NowSection: CGRect] = [:]
    @State private var empty: Set<NowSection> = []
    @State private var position = ScrollPosition(edge: .top)
    @State private var scroll = ScrollGeometry?.none
    @State private var viewport = CGRect.zero
    @State private var autoscroll: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let order = lift?.order ?? shown
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if arranging {
                    Label("Hold a card, then drag it into place", systemImage: "hand.draw")
                        .font(.footnote).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
                // Outside arranging the cards go in bare: a wrapper around a card that isn't there
                // right now would still take the stack's spacing and leave a gap.
                ForEach(order) { s in
                    if arranging { item(s) } else { card(s) }
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
        .sensoryFeedback(.impact(weight: .medium), trigger: lift?.section) { $1 != nil }
    }

    @ViewBuilder private func item(_ s: NowSection) -> some View {
        let lifted = lift?.section == s
        ZStack(alignment: .top) {
            VStack(spacing: 0) { card(s) }
                .frame(maxWidth: .infinity)
                .onGeometryChange(for: Bool.self) { $0.size.height < 1 } action: { e in
                    if e { empty.insert(s) } else { empty.remove(s) }
                }
            if arranging, empty.contains(s) { Placeholder(section: s) }
        }
        .allowsHitTesting(!arranging)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { f in
            if arranging { frames[s] = f }
        }
        .modifier(Jiggle(on: arranging && !lifted && lift == nil && !reduceMotion, seed: s.rawValue.hashValue))
        .scaleEffect(lifted ? 1.03 : 1)
        .shadow(color: .black.opacity(lifted ? 0.25 : 0), radius: 16, y: 8)
        .offset(y: lifted ? offset(of: s) : 0)
        .zIndex(lifted ? 1 : 0)
        .contentShape(RoundedRectangle(cornerRadius: 18))
        // UIKit's long press, not a SwiftUI drag: any SwiftUI drag on a card keeps the list from
        // scrolling on iOS 18+, while this one gives way to the scroll view's pan until it fires.
        .gesture(HoldToDrag(enabled: arranging) { phase, y in hold(s, phase, y) })
        .animation(.snappy(duration: 0.25), value: lifted)
        .modifier(Arranging(on: arranging, section: s) { by in nudge(s, by: by) })
    }

    /// The lifted card follows the finger, wherever its slot is now.
    private func offset(of s: NowSection) -> CGFloat {
        guard let lift, let f = frames[s] else { return 0 }
        return lift.finger - lift.grab - f.minY
    }

    private func hold(_ s: NowSection, _ phase: HoldToDrag.Phase, _ y: CGFloat) {
        switch phase {
        case .lift:
            guard lift == nil, let f = frames[s] else { return }
            lift = Lift(section: s, grab: y - f.minY, finger: y, order: shown)
            startAutoscroll()
        case .move:
            guard lift?.section == s else { return }
            lift?.finger = y
            reorder()
        case .drop:
            drop()
        }
    }

    /// Puts the lifted card where its middle is: past a neighbour's middle, they swap.
    private func reorder() {
        guard var l = lift, let f = frames[l.section] else { return }
        let middle = l.finger - l.grab + f.height / 2
        let others = l.order.filter { $0 != l.section }
        let at = others.filter { (frames[$0]?.midY ?? .infinity) < middle }.count
        var next = others
        next.insert(l.section, at: at)
        guard next != l.order else { return }
        l.order = next
        withAnimation(.snappy(duration: 0.3)) { lift = l }
    }

    private func drop() {
        autoscroll?.cancel()
        autoscroll = nil
        guard let l = lift else { return }
        withAnimation(.snappy(duration: 0.3)) {
            stored = NowLayout.encode(NowLayout.place(NowLayout.order(stored), shown: shown, as: l.order))
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
                let edge: CGFloat = 90
                let top = viewport.minY + g.contentInsets.top, bottom = viewport.maxY - g.contentInsets.bottom
                let speed = l.finger < top + edge ? -(top + edge - l.finger) / edge * 14
                    : l.finger > bottom - edge ? (l.finger - (bottom - edge)) / edge * 14 : 0
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

    /// VoiceOver: Move up / Move down, one card at a time.
    private func nudge(_ s: NowSection, by: Int) {
        guard let i = shown.firstIndex(of: s), shown.indices.contains(i + by) else { return }
        withAnimation(.snappy) {
            stored = NowLayout.encode(NowLayout.move(NowLayout.order(stored), shown: shown, from: [i], to: by > 0 ? i + 2 : i - 1))
        }
    }
}

/// Hold for a moment, then drag; reports the finger's y in global coordinates.
private struct HoldToDrag: UIGestureRecognizerRepresentable {
    enum Phase { case lift, move, drop }
    let enabled: Bool
    let changed: (Phase, CGFloat) -> Void

    func makeUIGestureRecognizer(context: Context) -> UILongPressGestureRecognizer {
        let g = UILongPressGestureRecognizer()
        g.minimumPressDuration = 0.2
        return g
    }

    func updateUIGestureRecognizer(_ g: UILongPressGestureRecognizer, context: Context) {
        g.isEnabled = enabled
    }

    func handleUIGestureRecognizerAction(_ g: UILongPressGestureRecognizer, context: Context) {
        let y = context.converter.location(in: .global).y
        switch g.state {
        case .began: changed(.lift, y)
        case .changed: changed(.move, y)
        case .ended, .cancelled, .failed: changed(.drop, y)
        default: break
        }
    }
}

/// A card that isn't there right now, so it can still be placed while arranging.
private struct Placeholder: View {
    let section: NowSection

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(section.title).font(.subheadline.weight(.semibold))
                if let note = section.note { Text(note).font(.caption).foregroundStyle(.secondary) }
            }
        } icon: { Image(systemName: section.icon).foregroundStyle(Theme.sleep) }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
    }
}

/// The Home Screen wobble, a little out of step from card to card.
private struct Jiggle: ViewModifier {
    let on: Bool
    let seed: Int
    @State private var tilt = false

    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(on ? (tilt ? 0.5 : -0.5) : 0))
            .onChange(of: on, initial: true) { _, on in
                guard on else { tilt = false; return }
                let delay = Double(abs(seed) % 7) * 0.02
                withAnimation(.easeInOut(duration: 0.14).repeatForever(autoreverses: true).delay(delay)) { tilt = true }
            }
    }
}

/// While arranging, each card is one element with its name and Move up / Move down actions.
private struct Arranging: ViewModifier {
    let on: Bool
    let section: NowSection
    let nudge: (Int) -> Void

    func body(content: Content) -> some View {
        if on {
            content
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(section.title)
                .accessibilityHint("Hold, then drag to move it")
                .accessibilityAction(named: "Move up") { nudge(-1) }
                .accessibilityAction(named: "Move down") { nudge(1) }
                .accessibilityIdentifier("arrange-\(section.rawValue)")
        } else {
            content
        }
    }
}
