package com.hejitech.headway.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DirectionsTransit
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.DarkSurface
import com.hejitech.headway.app.ui.theme.StatusAmber
import com.hejitech.headway.app.ui.theme.StatusGreen
import com.hejitech.headway.app.ui.theme.StatusGrey
import com.hejitech.headway.app.ui.theme.StatusRed
import com.hejitech.headway.core.model.*

/**
 * The Family tab: your group, what each member shares with you, what you share and with whom,
 * your status and invites. Everything you share is off until you turn it on and pick who sees it.
 * Notifications about family members come to the iPhone app for now.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilyScreen(viewModel: HeadwayViewModel) {
    val family by viewModel.family.collectAsState()
    val error by viewModel.errorMessage.collectAsState()
    val signedIn = viewModel.apiClient.session != null
    var creating by remember { mutableStateOf(false) }
    var member by remember { mutableStateOf<String?>(null) }
    var share by remember { mutableStateOf<ShareKind?>(null) }
    var confirmLeave by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.loadFamily() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(family?.group?.name ?: "Family", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            val f = family
            if (!signedIn) {
                item { Note("Sign in (Settings) to use family groups.") }
                return@LazyColumn
            }
            if (f == null) {
                item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
                return@LazyColumn
            }

            // Invites to me
            items(f.invites, key = { "inv-${it.id}" }) { inv ->
                SectionCard {
                    Text("${inv.fromName} invited you to “${inv.groupName}”", fontWeight = FontWeight.SemiBold)
                    if (f.group != null) Text("Leave your current group first to join this one.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { viewModel.familyChange { it.acceptInvite(inv.id) } }, enabled = f.group == null) { Text("Join") }
                        OutlinedButton(onClick = { viewModel.familyChange { it.declineInvite(inv.id) } }) { Text("Decline") }
                    }
                    Text("Joining shares nothing yet: you choose what to share, and with whom, afterwards.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                }
            }

            val g = f.group
            if (g == null) {
                item {
                    SectionCard {
                        Text("Family groups", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("Family members can follow each other's trains, hear when someone's usual train is late, and see a status like Running late. Nothing is shared until each person chooses what to share and with whom. Up to ${f.max} people.", style = MaterialTheme.typography.bodyMedium)
                        Button(onClick = { creating = true }) { Text("Create a family group") }
                    }
                }
            } else {
                item { Header("${g.members.size} of ${f.max}") }
                items(g.members, key = { "m-${it.userId}" }) { m ->
                    SectionCard(onClick = if (m.me) null else ({ member = m.userId })) {
                        Row(verticalAlignment = Alignment.Top) {
                            Avatar(m.displayName)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(if (m.me) "${m.displayName} (you)" else m.displayName, fontWeight = FontWeight.SemiBold)
                                if (m.me) Text(if (m.isOwner) "Owner" else "Member", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                                else MemberNews(m)
                            }
                            if (!m.me) Icon(Icons.Default.ChevronRight, contentDescription = null, tint = StatusGrey)
                        }
                    }
                }

                item { Header("What I share") }
                items(f.me?.shares ?: emptyList(), key = { "s-${it.kind}" }) { s ->
                    SectionCard(onClick = { share = s.kind }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(s.kind.title, Modifier.weight(1f))
                            Text(
                                when {
                                    !s.on -> "Off"
                                    s.viewers.isEmpty() -> "No one yet"
                                    else -> s.viewers.joinToString { f.nameOf(it) }
                                },
                                color = StatusGrey, maxLines = 1
                            )
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = StatusGrey)
                        }
                    }
                }
                item { Note("All off until you turn one on and pick who sees it. Your location is never shared.") }

                item { Header("My status") }
                item { StatusCard(f, viewModel) }

                if (g.owner) {
                    item { Header("Invite") }
                    item { InviteCard(f, g, viewModel) }
                }

                item { Header("Names") }
                item { NamesCard(f, g, viewModel) }

                item {
                    OutlinedButton(onClick = { confirmLeave = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusRed)) {
                        Text(if (g.owner) "Delete the group" else "Leave the group")
                    }
                    Note(if (g.owner) "Deleting the group removes everyone from it and tells them. Nothing anyone shared is kept." else "Leaving removes everything you shared at once.")
                }
            }

            f.email?.let { email ->
                item {
                    SectionCard {
                        Text("Your Headway email", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                        Text(email)
                        Text("To be invited to someone's family group, they invite this address.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                    }
                }
            }
            error?.let { item { Text(it, color = StatusRed, style = MaterialTheme.typography.bodySmall) } }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }

    if (creating) CreateDialog(family?.suggestedName ?: "", onDismiss = { creating = false }) { name, me ->
        viewModel.familyChange(done = { if (it) creating = false }) { c -> c.createFamily(name, me) }
    }
    member?.let { id -> family?.others?.firstOrNull { it.userId == id }?.let { m -> MemberDialog(m, family?.group?.owner == true, viewModel) { member = null } } ?: run { member = null } }
    share?.let { kind -> family?.let { ShareDialog(kind, it, viewModel) { share = null } } }
    if (confirmLeave) {
        val owner = family?.group?.owner == true
        AlertDialog(
            onDismissRequest = { confirmLeave = false },
            title = { Text(if (owner) "Delete “${family?.group?.name}” for everyone?" else "Leave “${family?.group?.name}”?") },
            confirmButton = { TextButton(onClick = { confirmLeave = false; viewModel.familyChange { it.leaveFamily() } }) { Text(if (owner) "Delete group" else "Leave", color = StatusRed) } },
            dismissButton = { TextButton(onClick = { confirmLeave = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun SectionCard(onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun Header(text: String) = Text(text, style = MaterialTheme.typography.titleSmall, color = StatusGrey, modifier = Modifier.padding(top = 8.dp))


@Composable
private fun Avatar(name: String) {
    Box(Modifier.size(36.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
        Text(name.take(1).uppercase(), color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold)
    }
}

/** What a member's sharing shows right now. */
@Composable
private fun MemberNews(m: FamilyMemberView) {
    m.train?.let { t ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.DirectionsTransit, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text("${t.train} ${t.kind} to ${t.to.name}", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
        }
        val late = t.delayMin?.takeIf { it >= 2 }?.let { " · $it min late" } ?: ""
        val next = t.next?.let { " · next ${it.short}" } ?: ""
        Text(
            when {
                t.cancelled -> "Cancelled"
                t.arrived -> "Arrived ${Clock.time(t.predArr)}"
                else -> "Arrives ${Clock.time(t.predArr)} (${Clock.until(t.predArr)})$late$next"
            },
            style = MaterialTheme.typography.bodySmall,
            color = when { t.cancelled -> StatusRed; t.arrived -> StatusGreen; (t.delayMin ?: 0) >= 5 -> StatusAmber; else -> StatusGrey }
        )
    }
    m.commute?.let { c ->
        Text(if (c.cancelled) "Usual ${c.leg} train cancelled" else "Usual ${c.leg} train ${c.delayMin ?: 0} min late", color = StatusAmber, style = MaterialTheme.typography.bodyMedium)
    }
    m.status?.let { s -> Text("${s.text} · until ${Clock.time(s.until)}", style = MaterialTheme.typography.bodyMedium) }
    if (m.sharedWithMe.isEmpty()) Text("Shares nothing with you", color = StatusGrey, style = MaterialTheme.typography.bodyMedium)
    else if (m.train == null && m.commute == null && m.status == null) Text("Nothing to share right now", color = StatusGrey, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun MemberDialog(m: FamilyMemberView, owner: Boolean, viewModel: HeadwayViewModel, onDismiss: () -> Unit) {
    var confirmRemove by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(m.displayName) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                MemberNews(m)
                if (m.sharedWithMe.isNotEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    Text("Shares with you: ${m.sharedWithMe.joinToString { it.followTitle.lowercase() }}.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                }
                if (m.sharedWithMe.isEmpty()) {
                    Text("${m.displayName} doesn't share anything with you. When they do, you can choose to be told about it here.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                } else {
                    Text("Tell me about", style = MaterialTheme.typography.titleSmall)
                    m.sharedWithMe.forEach { kind ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(kind.followTitle, Modifier.weight(1f))
                            Switch(checked = m.follow.notify.contains(kind), onCheckedChange = { on ->
                                viewModel.setFollow(m.userId, m.follow.copy(notify = if (on) m.follow.notify + kind else m.follow.notify - kind))
                            })
                        }
                    }
                    Text("Notifications come when ${m.displayName} gets on a train, it's late, cancelled or arrives, when their usual train is late, or they set a status: only for what you turn on.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                }
                if (owner) {
                    if (confirmRemove) {
                        Button(onClick = { viewModel.familyChange(done = { if (it) onDismiss() }) { c -> c.removeMember(m.userId) } }, colors = ButtonDefaults.buttonColors(containerColor = StatusRed)) { Text("Remove ${m.displayName}") }
                    } else {
                        TextButton(onClick = { confirmRemove = true }) { Text("Remove from the group", color = StatusRed) }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } }
    )
}

@Composable
private fun ShareDialog(kind: ShareKind, f: FamilyState, viewModel: HeadwayViewModel, onDismiss: () -> Unit) {
    val s = f.share(kind) ?: return
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(kind.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(kind.detail, style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Share", Modifier.weight(1f))
                    Switch(checked = s.on, onCheckedChange = { on -> viewModel.setShare(kind, on, if (on) s.viewers else emptyList()) })
                }
                if (s.on) {
                    Text("Who sees it", style = MaterialTheme.typography.titleSmall)
                    if (f.others.isEmpty()) Text("No one else is in the group yet.", color = StatusGrey)
                    f.others.forEach { m ->
                        val on = s.viewers.contains(m.userId)
                        Row(
                            Modifier.fillMaxWidth().clickable { viewModel.setShare(kind, true, if (on) s.viewers - m.userId else s.viewers + m.userId) },
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(checked = on, onCheckedChange = null)
                            Text(m.displayName, Modifier.weight(1f))
                            if (s.notified.contains(m.userId)) Icon(Icons.Default.Notifications, contentDescription = "told about it", tint = StatusGrey, modifier = Modifier.size(18.dp))
                        }
                    }
                    Text("A bell: they're told about it. Taking someone off stops that at once.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } }
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StatusCard(f: FamilyState, viewModel: HeadwayViewModel) {
    var minutes by remember { mutableIntStateOf(StatusCode.DEFAULT_DURATION) }
    SectionCard {
        f.me?.status?.let { s ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${s.text} · until ${Clock.time(s.until)}", Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                IconButton(onClick = { viewModel.familyChange { it.clearStatus() } }) { Icon(Icons.Default.Close, contentDescription = "Clear status") }
            }
        }
        Text("For", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusCode.DURATIONS.forEach { m ->
                FilterChip(selected = minutes == m, onClick = { minutes = m }, label = { Text(if (m < 60) "$m min" else if (m == 60) "1 hour" else "${m / 60} hours") })
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusCode.entries.forEach { code ->
                AssistChip(onClick = { viewModel.familyChange { it.setStatus(code, minutes) } }, label = { Text(code.text) })
            }
        }
        val shared = f.share(ShareKind.STATUS)
        Note(if (shared?.on == true && shared.viewers.isNotEmpty()) "Seen by ${shared.viewers.joinToString { f.nameOf(it) }} until it runs out." else "Only seen once you share My status above.")
    }
}

@Composable
private fun InviteCard(f: FamilyState, g: FamilyGroup, viewModel: HeadwayViewModel) {
    var email by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf<String?>(null) }
    val full = g.members.size + g.pendingInvites.size >= f.max
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = email, onValueChange = { email = it }, label = { Text("Email address") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.width(8.dp))
            Button(enabled = !full && email.contains("@"), onClick = {
                val address = email.trim()
                viewModel.familyChange(done = { if (it) { sent = address; email = "" } }) { c -> c.invite(address) }
            }) { Text("Invite") }
        }
        g.pendingInvites.forEach { inv ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(inv.email, Modifier.weight(1f))
                Text("Pending", color = StatusGrey)
                IconButton(onClick = { viewModel.familyChange { it.cancelInvite(inv.id) } }) { Icon(Icons.Default.Close, contentDescription = "Cancel invite") }
            }
        }
        Note(
            when {
                sent != null -> "Invited $sent. They'll see it in Headway's Family tab when they sign in with that address. If it isn't the address they use for Headway, nothing happens."
                full -> "The group is full: ${f.max} people, counting pending invites."
                else -> "Use the address they sign in to Headway with. Invites last 7 days."
            }
        )
    }
}

@Composable
private fun NamesCard(f: FamilyState, g: FamilyGroup, viewModel: HeadwayViewModel) {
    var myName by remember(f.me?.displayName) { mutableStateOf(f.me?.displayName ?: "") }
    var groupName by remember(g.name) { mutableStateOf(g.name) }
    SectionCard {
        OutlinedTextField(value = myName, onValueChange = { myName = it.take(20) }, label = { Text("Your name in the group") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        if (g.owner) OutlinedTextField(value = groupName, onValueChange = { groupName = it.take(40) }, label = { Text("Group name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        val changed = myName.trim() != f.me?.displayName || (g.owner && groupName.trim() != g.name)
        Button(enabled = changed && myName.isNotBlank() && groupName.isNotBlank(), onClick = {
            if (myName.trim() != f.me?.displayName) viewModel.familyChange { it.updateFamily(displayName = myName.trim()) }
            if (g.owner && groupName.trim() != g.name) viewModel.familyChange { it.renameFamily(groupName.trim()) }
        }) { Text("Save names") }
    }
}

@Composable
private fun CreateDialog(suggested: String, onDismiss: () -> Unit, onCreate: (String, String) -> Unit) {
    var name by remember { mutableStateOf("Family") }
    var me by remember { mutableStateOf(suggested) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New family group") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it.take(40) }, label = { Text("Group name") }, singleLine = true)
                OutlinedTextField(value = me, onValueChange = { me = it.take(20) }, label = { Text("Your name in the group") }, singleLine = true)
                Text("You'll be the group's owner: you invite people by email. An account can be in one family group.", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
            }
        },
        confirmButton = { TextButton(enabled = name.isNotBlank() && me.isNotBlank(), onClick = { onCreate(name.trim(), me.trim()) }) { Text("Create") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
