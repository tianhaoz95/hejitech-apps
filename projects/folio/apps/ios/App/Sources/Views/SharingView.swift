import FolioKit
import SwiftUI

/// Who can open the artifact: link visibility, invite links (editor or viewer), people and roles.
struct SharingView: View {
    let slug: String
    let role: Role
    let changed: () -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var sharing: Sharing?
    @State private var newInvite: NewInvite?
    @State private var inviteRole: Role = .editor
    @State private var error: String?
    @State private var busy = false

    private var isOwner: Bool { role == .owner }

    var body: some View {
        NavigationStack {
            Form {
                if let s = sharing {
                    if isOwner {
                        Section {
                            Toggle(isOn: Binding(get: { s.visibility == .link }, set: { setLink($0) })) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Anyone with the link can view")
                                    Text("Signed-out visitors can look; only people you invite can comment or edit.").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            ShareLink(item: model.api.webURL(slug)) { Label("Share the Folio link", systemImage: "square.and.arrow.up") }
                        }
                        Section {
                            Picker("Invite as", selection: $inviteRole) {
                                Text("Editor").tag(Role.editor)
                                Text("Viewer").tag(Role.viewer)
                            }
                            Button {
                                makeInvite()
                            } label: {
                                Label("Make an invite link", systemImage: "link.badge.plus")
                            }
                            .disabled(busy)
                            if let i = newInvite, let url = URL(string: i.url) {
                                ShareLink(item: url, subject: Text("Join me on Folio"), message: Text("Open this to work on the artifact with me in Folio.")) {
                                    Label("Send the \(i.role.label.lowercased()) invite", systemImage: "paperplane")
                                }
                                Button { UIPasteboard.general.url = url; model.flash("Invite link copied") } label: {
                                    Label("Copy invite link", systemImage: "doc.on.doc")
                                }
                            }
                        } header: {
                            Text("Invite people")
                        } footer: {
                            Text("Editors can edit and review suggestions; viewers can read, comment and suggest. Links work for 14 days and for anyone who has them; their agents get the same access.")
                        }
                    }
                    Section("People") {
                        PersonRow(email: s.owner.email ?? "Owner", role: .owner)
                        ForEach(s.members) { m in
                            PersonRow(email: m.email ?? "Someone", role: m.role)
                                .swipeActions {
                                    if isOwner || m.user_id == model.session?.userId {
                                        Button(m.user_id == model.session?.userId ? "Leave" : "Remove", role: .destructive) { remove(m) }
                                    }
                                }
                                .contextMenu {
                                    if isOwner {
                                        Button("Make editor") { setRole(m, .editor) }.disabled(m.role == .editor)
                                        Button("Make viewer") { setRole(m, .viewer) }.disabled(m.role == .viewer)
                                        Button("Remove", role: .destructive) { remove(m) }
                                    }
                                }
                        }
                    }
                    if isOwner && !s.invites.isEmpty {
                        Section("Active invite links") {
                            ForEach(s.invites) { i in
                                HStack {
                                    Text(i.role.label)
                                    Spacer()
                                    if let e = i.expires_at { Text("until \(e.formatted(.dateTime.month().day()))").foregroundStyle(.secondary) }
                                    Text("\(i.uses ?? 0) used").foregroundStyle(.secondary)
                                }
                                .swipeActions { Button("Revoke", role: .destructive) { revoke(i) } }
                            }
                        }
                    }
                } else if let error {
                    Text(error).foregroundStyle(.secondary)
                } else {
                    ProgressView()
                }
            }
            .paperBackground()
            .navigationTitle("Sharing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task { await load() }
        }
    }

    private func load() async {
        do { sharing = try await model.api.sharing(slug) } catch { self.error = error.localizedDescription }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        busy = true
        Task {
            do {
                try await work()
                await load()
                changed()
            } catch { model.flash(error.localizedDescription) }
            busy = false
        }
    }

    private func setLink(_ on: Bool) { run { try await model.api.update(slug, visibility: on ? .link : .private) } }
    private func makeInvite() { run { newInvite = try await model.api.invite(slug, role: inviteRole) } }
    private func revoke(_ i: Invite) { run { try await model.api.revokeInvite(slug, id: i.id) } }
    private func setRole(_ m: Member, _ r: Role) { run { try await model.api.setRole(slug, userId: m.user_id, role: r) } }
    private func remove(_ m: Member) {
        let leaving = m.user_id == model.session?.userId
        run {
            try await model.api.removeMember(slug, userId: m.user_id)
            if leaving {
                await model.refresh()
                model.path = NavigationPath()
                dismiss()
            }
        }
    }
}

private struct PersonRow: View {
    let email: String
    let role: Role

    var body: some View {
        HStack {
            Image(systemName: "person.crop.circle.fill").foregroundStyle(.secondary).font(.title3)
            Text(email).lineLimit(1)
            Spacer()
            Text(role.label).foregroundStyle(.secondary)
        }
    }
}
