import SwiftUI
import UIKit

/// Text to paste into an agent's chat so it finds an artifact and knows what to do with it.
/// Folio's MCP tools take an artifact's link, slug or id (`parseArtifactRef`), and the link also
/// opens for a person, so every prompt names the artifact by title and link.
enum AgentCopy: CaseIterable, Identifiable {
    case link, title, slug, improve, comments, suggestions

    var id: Self { self }

    var label: String {
        switch self {
        case .link: return "Copy link"
        case .title: return "Copy title"
        case .slug: return "Copy ID"
        case .improve: return "Ask to improve it"
        case .comments: return "Ask to work through the comments"
        case .suggestions: return "Ask to review the suggestions"
        }
    }

    var icon: String {
        switch self {
        case .link: return "link"
        case .title: return "textformat"
        case .slug: return "number"
        case .improve: return "wand.and.stars"
        case .comments: return "bubble.left.and.bubble.right"
        case .suggestions: return "checkmark.bubble"
        }
    }

    var copied: String {
        switch self {
        case .link: return "Link copied"
        case .title: return "Title copied"
        case .slug: return "ID copied"
        default: return "Copied: paste it to your agent"
        }
    }

    var isPrompt: Bool { [.improve, .comments, .suggestions].contains(self) }

    func text(title: String, slug: String, url: URL) -> String {
        let ref = "the Folio artifact \"\(title)\" (\(url.absoluteString))"
        switch self {
        case .link: return url.absoluteString
        case .title: return title
        case .slug: return slug
        case .improve:
            return "Open \(ref) and improve it. Save your changes as a new version and tell me what you changed."
        case .comments:
            return "Read the open comments on \(ref). Make the changes they ask for, reply to each comment with what you did, and resolve the ones you've addressed."
        case .suggestions:
            return "Review the open suggestions on \(ref). Accept the ones that make it better, and reject the others with a short reason."
        }
    }
}

/// The copy actions as menu items: the link, title and ID, then prompts for an agent. Prompts that
/// would have nothing to work on (no open comments or suggestions) are left out.
struct AgentCopyItems: View {
    let slug: String
    let title: String
    var comments = 0
    var suggestions = 0
    @Environment(AppModel.self) private var model

    var body: some View {
        Section {
            ForEach([AgentCopy.link, .title, .slug]) { item in button(item) }
        }
        Section("For your agent") {
            button(.improve)
            if comments > 0 { button(.comments) }
            if suggestions > 0 { button(.suggestions) }
        }
    }

    private func button(_ item: AgentCopy) -> some View {
        Button {
            UIPasteboard.general.string = item.text(title: title, slug: slug, url: model.api.webURL(slug))
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            model.flash(item.copied)
        } label: { Label(item.label, systemImage: item.icon) }
    }
}
