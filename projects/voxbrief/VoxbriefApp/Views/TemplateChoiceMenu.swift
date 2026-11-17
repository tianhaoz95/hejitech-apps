import SwiftUI

extension TemplateChoice {
    /// The choice's name in menus and Settings: "Cleaned Text", "Auto-detect" or the template's
    /// name ("Cleaned Text" again for a template that no longer exists).
    func displayName(in templates: [NoteTemplate]) -> String {
        switch self {
        case .none: return "Cleaned Text"
        case .auto: return "Auto-detect"
        case .template(let id): return templates.first(where: { $0.id == id })?.name ?? "Cleaned Text"
        }
    }

    var iconName: String {
        switch self {
        case .none: return "wand.and.stars"
        case .auto: return "sparkles"
        case .template: return "rectangle.3.group"
        }
    }
}

/// The menu items for picking a `TemplateChoice`: the cleaned text alone, auto-detect, then
/// each template, with a checkmark on `selection`. Used by the record sheet, a note's format
/// chip and Settings' default format.
struct TemplateChoiceMenuItems: View {
    let templates: [NoteTemplate]
    let selection: TemplateChoice?
    var includesNone: Bool = true
    let onSelect: (TemplateChoice) -> Void

    var body: some View {
        if includesNone {
            item(.none, subtitle: "Light cleanup only")
        }
        item(.auto, subtitle: "Pick a template for me")
        Section("Templates") {
            ForEach(templates) { template in
                item(.template(template.id), subtitle: nil)
            }
        }
    }

    private func item(_ choice: TemplateChoice, subtitle: String?) -> some View {
        Button {
            onSelect(choice)
        } label: {
            Label {
                Text(choice.displayName(in: templates))
                if let subtitle { Text(subtitle) }
            } icon: {
                Image(systemName: choice == selection ? "checkmark" : choice.iconName)
            }
        }
    }
}
