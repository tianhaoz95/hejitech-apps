import HeadwayKit
import SwiftUI

/// The Family tab: your group, what each member shares with you (their train, their usual train
/// running late, their status), what you share and with whom, invites. Everything you share is off
/// until you turn it on and pick who sees it; you're told about someone only once you follow them.
struct FamilyView: View {
    @Environment(AppModel.self) private var model
    @State private var creating = false
    @State private var confirmLeave = false

    var body: some View {
        NavigationStack {
            List {
                if let f = model.family {
                    InvitesToMeSection(state: f)
                    if let g = f.group {
                        MembersSection(state: f, group: g)
                        MySharesSection(state: f)
                        MyStatusSection(state: f)
                        if g.owner { InviteSection(state: f, group: g) }
                        Section {
                            NavigationLink("Names") { NamesView(state: f, group: g) }
                            Button(g.owner ? "Delete the group" : "Leave the group", role: .destructive) { confirmLeave = true }
                        } footer: {
                            Text(g.owner
                                 ? "Deleting the group removes everyone from it and tells them. Nothing anyone shared is kept."
                                 : "Leaving removes everything you shared at once.")
                        }
                        .confirmationDialog(g.owner ? "Delete “\(g.name)” for everyone?" : "Leave “\(g.name)”?", isPresented: $confirmLeave, titleVisibility: .visible) {
                            Button(g.owner ? "Delete group" : "Leave", role: .destructive) { Task { await model.familyChange { try await $0.leaveFamily() } } }
                        }
                    } else {
                        Section {
                            Button { creating = true } label: { Label("Create a family group", systemImage: "person.2.badge.plus") }
                        } footer: {
                            Text("Family members can follow each other's trains, hear when someone's usual train is late, and see a status like Running late. Nothing is shared until each person chooses what to share and with whom. Up to \(f.max) people.")
                        }
                    }
                    EmailSection(email: f.email)
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
                if let e = model.error { Text(e).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle(model.family?.group?.name ?? "Family")
            .refreshable { await model.loadFamily() }
            .task {
                // Members' trains move: keep the tab current while it's open.
                while !Task.isCancelled {
                    await model.loadFamily()
                    try? await Task.sleep(for: .seconds(30))
                }
            }
            .sheet(isPresented: $creating) { CreateGroupSheet(suggestedName: model.family?.suggestedName ?? "") }
        }
    }
}

// MARK: - invites to me

private struct InvitesToMeSection: View {
    @Environment(AppModel.self) private var model
    let state: FamilyState

    var body: some View {
        if !state.invites.isEmpty {
            Section {
                ForEach(state.invites) { inv in
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(inv.fromName) invited you to “\(inv.groupName)”").font(.headline)
                        if state.group != nil {
                            Text("Leave your current group first to join this one.").font(.footnote).foregroundStyle(.secondary)
                        }
                        HStack {
                            Button("Join") { Task { await model.familyChange { try await $0.acceptInvite(inv.id) } } }
                                .buttonStyle(.borderedProminent)
                                .disabled(state.group != nil)
                            Button("Decline") { Task { await model.familyChange { try await $0.declineInvite(inv.id) } } }
                                .buttonStyle(.bordered)
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Invites")
            } footer: {
                Text("Joining shares nothing yet: you choose what to share, and with whom, afterwards.")
            }
        }
    }
}

// MARK: - members

private struct MembersSection: View {
    let state: FamilyState
    let group: FamilyGroup

    var body: some View {
        Section {
            ForEach(group.members) { m in
                if m.me {
                    HStack {
                        Avatar(name: m.displayName)
                        VStack(alignment: .leading) {
                            Text("\(m.displayName) (you)").font(.headline)
                            Text(m.isOwner ? "Owner" : "Member").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    NavigationLink { MemberDetailView(userId: m.userId) } label: { MemberRow(member: m) }
                }
            }
        } header: {
            Text("\(group.members.count) of \(state.max)")
        } footer: {
            Text("You see what each person shares with you. Tap someone to choose what you're told about.")
        }
    }
}

struct Avatar: View {
    let name: String
    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.headline)
            .foregroundStyle(.white)
            .frame(width: 36, height: 36)
            .background(Circle().fill(Color.accentColor.gradient))
    }
}

private struct MemberRow: View {
    let member: FamilyMemberView

    var body: some View {
        HStack(alignment: .top) {
            Avatar(name: member.displayName)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(member.displayName).font(.headline)
                    if member.isOwner { Text("Owner").font(.caption2).foregroundStyle(.secondary) }
                    if !member.follow.notify.isEmpty { Image(systemName: "bell.fill").font(.caption2).foregroundStyle(.secondary) }
                    if member.follow.live { Image(systemName: "platter.filled.bottom.iphone").font(.caption2).foregroundStyle(.secondary) }
                }
                MemberNews(member: member)
            }
        }
        .padding(.vertical, 2)
    }
}

/// What a member's sharing shows right now, line by line.
struct MemberNews: View {
    let member: FamilyMemberView

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let t = member.train { TrainLine(train: t) }
            if let c = member.commute {
                Label(c.cancelled ? "Usual \(c.leg) train cancelled" : "Usual \(c.leg) train \(c.delayMin ?? 0) min late", systemImage: "clock.badge.exclamationmark")
                    .font(.subheadline).foregroundStyle(.orange)
            }
            if let s = member.status {
                Label("\(s.text) · until \(Clock.time(s.until))", systemImage: s.code.symbol).font(.subheadline)
            }
            if member.sharedWithMe.isEmpty {
                Text("Shares nothing with you").font(.subheadline).foregroundStyle(.secondary)
            } else if member.train == nil && member.commute == nil && member.status == nil {
                Text("Nothing to share right now").font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}

private struct TrainLine: View {
    let train: FamilyTrain

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 1) {
                Text("\(train.train) \(train.kind) to \(train.to.name)").font(.subheadline.weight(.semibold))
                Group {
                    if train.cancelled {
                        Text("Cancelled").foregroundStyle(.red)
                    } else if train.arrived {
                        Text("Arrived \(Clock.time(train.predArr))").foregroundStyle(.green)
                    } else {
                        let late = (train.delayMin ?? 0) >= 2 ? " · \(train.delayMin!) min late" : ""
                        let next = train.next.map { " · next \($0.short)" } ?? ""
                        Text("Arrives \(Clock.time(train.predArr)) (\(Clock.until(train.predArr)))\(late)\(next)")
                            .foregroundStyle((train.delayMin ?? 0) >= 5 ? .orange : .secondary)
                    }
                }
                .font(.footnote)
            }
        } icon: {
            Image(systemName: "tram.fill").font(.subheadline)
        }
    }
}

// MARK: - one member: what you follow

struct MemberDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let userId: String
    @State private var confirmRemove = false

    private var member: FamilyMemberView? { model.family?.others.first { $0.userId == userId } }

    var body: some View {
        List {
            if let m = member {
                Section { MemberNews(member: m) }
                if m.sharedWithMe.isEmpty {
                    Section {
                        Text("\(m.displayName) doesn't share anything with you. When they do, you can choose to be told about it here.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section {
                        ForEach(m.sharedWithMe, id: \.self) { kind in
                            Toggle(isOn: Binding(
                                get: { m.follow.notify.contains(kind) },
                                set: { on in
                                    var p = m.follow
                                    p.notify = on ? p.notify + [kind] : p.notify.filter { $0 != kind }
                                    Task { await model.setFollow(m.userId, p) }
                                }
                            )) {
                                Label(kind.followTitle, systemImage: kind.symbol)
                            }
                        }
                    } header: {
                        Text("Tell me about")
                    } footer: {
                        Text("Notifications come when \(m.displayName) gets on a train, it's late, cancelled or arrives, when their usual train is late, or they set a status: only for what you turn on.")
                    }
                    if m.sharedWithMe.contains(where: \.isTrain) {
                        Section {
                            Toggle(isOn: Binding(get: { m.follow.live }, set: { on in
                                var p = m.follow
                                p.live = on
                                Task { await model.setFollow(m.userId, p) }
                            })) {
                                Label("Their train on my Lock Screen", systemImage: "platter.filled.bottom.iphone")
                            }
                        } footer: {
                            Text("Whenever \(m.displayName) is on a train they share with you, it appears on your Lock Screen and in the Dynamic Island until it arrives.")
                        }
                    }
                }
                if model.family?.group?.owner == true {
                    Section {
                        Button("Remove \(m.displayName) from the group", role: .destructive) { confirmRemove = true }
                    }
                    .confirmationDialog("Remove \(m.displayName)?", isPresented: $confirmRemove, titleVisibility: .visible) {
                        Button("Remove", role: .destructive) {
                            Task { if await model.familyChange({ try await $0.removeMember(m.userId) }) { dismiss() } }
                        }
                    }
                }
            } else {
                Text("Not in your group any more.").foregroundStyle(.secondary)
            }
        }
        .navigationTitle(member?.displayName ?? "Member")
    }
}

extension ShareKind {
    /// How a follower's toggle reads.
    var followTitle: String {
        switch self {
        case .trip: "Trains they track"
        case .ride: "Rides Headway detects"
        case .commute: "Their usual train running late"
        case .status: "Their status"
        }
    }
}

// MARK: - what I share

private struct MySharesSection: View {
    let state: FamilyState

    var body: some View {
        Section {
            ForEach(state.me?.shares ?? []) { share in
                NavigationLink { ShareDetailView(kind: share.kind) } label: {
                    HStack {
                        Label(share.kind.title, systemImage: share.kind.symbol)
                        Spacer()
                        Text(summary(share)).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }
        } header: {
            Text("What I share")
        } footer: {
            Text("All off until you turn one on and pick who sees it. Your location is never shared.")
        }
    }

    private func summary(_ s: MyShare) -> String {
        guard s.on else { return "Off" }
        if s.viewers.isEmpty { return "No one yet" }
        return s.viewers.map { state.name(of: $0) }.joined(separator: ", ")
    }
}

struct ShareDetailView: View {
    @Environment(AppModel.self) private var model
    let kind: ShareKind

    private var share: MyShare? { model.family?.share(kind) }

    var body: some View {
        List {
            Section {
                Toggle(kind.title, isOn: Binding(get: { share?.on ?? false }, set: { on in
                    Task { await model.setShare(kind, on: on, viewers: on ? (share?.viewers ?? []) : []) }
                }))
            } footer: {
                Text(kind.detail)
            }
            if let s = share, s.on {
                Section {
                    let others = model.family?.others ?? []
                    if others.isEmpty { Text("No one else is in the group yet.").foregroundStyle(.secondary) }
                    ForEach(others) { m in
                        Button {
                            let viewers = s.viewers.contains(m.userId) ? s.viewers.filter { $0 != m.userId } : s.viewers + [m.userId]
                            Task { await model.setShare(kind, on: true, viewers: viewers) }
                        } label: {
                            HStack {
                                Image(systemName: s.viewers.contains(m.userId) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(s.viewers.contains(m.userId) ? Color.accentColor : .secondary)
                                Text(m.displayName).foregroundStyle(.primary)
                                Spacer()
                                if s.notified.contains(m.userId) { Image(systemName: "bell.fill").foregroundStyle(.secondary) }
                                if s.live.contains(m.userId) { Image(systemName: "platter.filled.bottom.iphone").foregroundStyle(.secondary) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Who sees it")
                } footer: {
                    Text("A bell: they're told about it. A phone: your train shows on their Lock Screen. Taking someone off stops that at once.")
                }
            }
        }
        .navigationTitle(kind.title)
    }
}

// MARK: - my status

private struct MyStatusSection: View {
    @Environment(AppModel.self) private var model
    let state: FamilyState
    @State private var minutes = StatusCode.defaultDuration

    var body: some View {
        Section {
            if let s = state.me?.status {
                HStack {
                    Label(s.text, systemImage: s.code.symbol)
                    Spacer()
                    Text("until \(Clock.time(s.until))").foregroundStyle(.secondary)
                }
                Button("Clear status") { Task { await model.familyChange { try await $0.clearStatus() } } }
            }
            Picker("For", selection: $minutes) {
                ForEach(StatusCode.durations, id: \.self) { Text(Self.label($0)).tag($0) }
            }
            ForEach(StatusCode.allCases, id: \.self) { code in
                Button { Task { await model.familyChange { try await $0.setStatus(code, minutes: minutes) } } } label: {
                    Label(code.text, systemImage: code.symbol)
                }
            }
        } header: {
            Text("My status")
        } footer: {
            let shared = state.share(.status)
            Text(shared?.on == true && !(shared?.viewers.isEmpty ?? true)
                 ? "Seen by \(shared!.viewers.map { state.name(of: $0) }.joined(separator: ", ")) until it runs out."
                 : "Only seen once you share My status above.")
        }
    }

    static func label(_ m: Int) -> String { m < 60 ? "\(m) min" : m == 60 ? "1 hour" : "\(m / 60) hours" }
}

// MARK: - inviting (owner)

private struct InviteSection: View {
    @Environment(AppModel.self) private var model
    let state: FamilyState
    let group: FamilyGroup
    @State private var email = ""
    @State private var sent: String?

    private var full: Bool { group.members.count + group.pendingInvites.count >= state.max }

    var body: some View {
        Section {
            HStack {
                TextField("Email address", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Invite") {
                    let address = email.trimmingCharacters(in: .whitespaces)
                    Task {
                        if await model.familyChange({ try await $0.invite(email: address) }) {
                            sent = address
                            email = ""
                        }
                    }
                }
                .disabled(full || !email.contains("@"))
            }
            ForEach(group.pendingInvites) { inv in
                HStack {
                    Text(inv.email)
                    Spacer()
                    Text("Pending").foregroundStyle(.secondary)
                }
                .swipeActions {
                    Button("Cancel", role: .destructive) { Task { await model.familyChange { try await $0.cancelInvite(inv.id) } } }
                }
            }
        } header: {
            Text("Invite")
        } footer: {
            if let sent {
                Text("Invited \(sent). They'll see it in Headway's Family tab when they sign in with that address. If it isn't the address they use for Headway, nothing happens: they can find theirs at the bottom of their Family tab.")
            } else if full {
                Text("The group is full: \(state.max) people, counting pending invites.")
            } else {
                Text("Use the address they sign in to Headway with. Invites last 7 days.")
            }
        }
    }
}

// MARK: - names

private struct NamesView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let state: FamilyState
    let group: FamilyGroup
    @State private var myName = ""
    @State private var groupName = ""

    var body: some View {
        Form {
            Section {
                TextField("Your name", text: $myName)
            } header: {
                Text("Your name in the group")
            } footer: {
                Text("What the others see, up to 20 characters.")
            }
            if group.owner {
                Section("Group name") { TextField("Group name", text: $groupName) }
            }
        }
        .navigationTitle("Names")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task {
                        var ok = true
                        let n = myName.trimmingCharacters(in: .whitespaces)
                        if n != state.me?.displayName { ok = await model.familyChange { try await $0.updateFamily(displayName: n) } }
                        let g = groupName.trimmingCharacters(in: .whitespaces)
                        if ok, group.owner, g != group.name { ok = await model.familyChange { try await $0.renameFamily(g) } }
                        if ok { dismiss() }
                    }
                }
                .disabled(myName.trimmingCharacters(in: .whitespaces).isEmpty || myName.count > 20 || (group.owner && groupName.trimmingCharacters(in: .whitespaces).isEmpty))
            }
        }
        .onAppear {
            myName = state.me?.displayName ?? ""
            groupName = group.name
        }
    }
}

// MARK: - creating

private struct CreateGroupSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let suggestedName: String
    @State private var name = "Family"
    @State private var myName = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Group name") { TextField("Group name", text: $name) }
                Section {
                    TextField("Your name", text: $myName)
                } header: {
                    Text("Your name in the group")
                } footer: {
                    Text("You'll be the group's owner: you invite people by email. An account can be in one family group.")
                }
            }
            .navigationTitle("New family group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            if await model.familyChange({ try await $0.createFamily(name: name.trimmingCharacters(in: .whitespaces), displayName: myName.trimmingCharacters(in: .whitespaces)) }) { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || myName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { myName = suggestedName }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - your address

private struct EmailSection: View {
    let email: String?
    var body: some View {
        if let email {
            Section {
                LabeledContent("Your Headway email", value: email)
                    .textSelection(.enabled)
            } footer: {
                Text(email.hasSuffix("privaterelay.appleid.com")
                     ? "You signed in with Apple and hid your email, so this is the address Headway knows. To be invited to a family group, give the owner this address."
                     : "To be invited to someone's family group, they invite this address.")
            }
        }
    }
}
