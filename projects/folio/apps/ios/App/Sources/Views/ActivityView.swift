import FolioKit
import SwiftUI

/// What happened across every artifact you can open, newest first.
struct ActivityView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var seenAt = Date.distantPast

    var body: some View {
        NavigationStack {
            List(model.activity) { e in
                Button {
                    dismiss()
                    if let slug = e.artifact?.slug {
                        if let n = e.suggestion_number { model.open(.suggestion(slug, n)) }
                        else if e.kind == "commented" { model.open(.comments(slug)) }
                        else if let v = e.version, e.kind != "created" { model.open(.version(slug, v)) }
                        else { model.open(.artifact(slug)) }
                    }
                } label: {
                    ActivityRow(e: e, unread: e.created_at > seenAt)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
            }
            .paperBackground()
            .listStyle(.plain)
            .overlay {
                if model.activity.isEmpty {
                    ContentUnavailableView("Nothing yet", systemImage: "bell", description: Text("Edits, suggestions and comments on your artifacts show up here."))
                }
            }
            .refreshable { await model.refresh() }
            .navigationTitle("Activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .onAppear {
            seenAt = model.activitySeenAt
            model.markActivitySeen()
        }
    }
}

private struct ActivityRow: View {
    let e: ActivityEvent
    let unread: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.accentColor)
                .frame(width: 28, height: 28)
                .background(Color.accentColor.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    AgentBadge(agent: e.agent)
                    Text(e.created_at, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                    if unread { Circle().fill(Color.accentColor).frame(width: 8, height: 8).accessibilityLabel("New") }
                }
                Text(e.summary).font(.subheadline).lineLimit(3)
                if let a = e.artifact { Text(a.title).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    private var icon: String {
        switch e.kind {
        case "created": return "plus"
        case "suggested", "suggestion_revised": return "text.badge.plus"
        case "suggestion_accepted": return "checkmark"
        case "suggestion_rejected", "suggestion_withdrawn": return "xmark"
        case "commented": return "bubble.left"
        case "comment_resolved": return "checkmark.bubble"
        case "restored": return "clock.arrow.circlepath"
        case "member_joined", "member_removed", "invite": return "person.2"
        case "forked": return "plus.square.on.square"
        default: return "pencil"
        }
    }
}
