package com.hejitech.headway.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mirrors of @headway/core's family.ts and the Worker's /api/family responses.

/** What a member can share. Every kind is off until they turn it on and pick who sees it. */
@Serializable
enum class ShareKind(val value: String, val title: String, val followTitle: String, val detail: String) {
    @SerialName("trip") TRIP("trip", "Trains I track", "Trains they track", "The train you track, wherever you start tracking it: where it is and when you arrive."),
    @SerialName("ride") RIDE("ride", "Rides Headway detects", "Rides Headway detects", "The train Headway is sure you're on (On a train in Settings), even if you don't track it."),
    @SerialName("commute") COMMUTE("commute", "My usual train running late", "Their usual train running late", "Only that your usual morning or evening train is late or cancelled, never your stations or times."),
    @SerialName("status") STATUS("status", "My status", "Their status", "A status you set here, like Running late, for as long as you choose.");

    val isTrain: Boolean get() = this == TRIP || this == RIDE
}

@Serializable
enum class StatusCode(val value: String, val text: String) {
    @SerialName("on_my_way") ON_MY_WAY("on_my_way", "On my way"),
    @SerialName("running_late") RUNNING_LATE("running_late", "Running late"),
    @SerialName("missed_train") MISSED_TRAIN("missed_train", "Missed my train, taking the next"),
    @SerialName("made_it") MADE_IT("made_it", "Made it"),
    @SerialName("home") HOME("home", "Home");

    companion object {
        /** Minutes a status may last (the Worker accepts only these). */
        val DURATIONS = listOf(15, 30, 60, 120, 240)
        const val DEFAULT_DURATION = 30
    }
}

@Serializable
data class FollowPrefs(
    val notify: List<ShareKind> = emptyList(),
    val live: Boolean = false
)

@Serializable
data class FamilyTrain(
    val source: ShareKind,
    @SerialName("trip_id") val tripId: String,
    @SerialName("service_date") val serviceDate: String,
    val train: String,
    val kind: String,
    val to: StationRef,
    val next: NextStop? = null,
    @SerialName("pred_arr") val predArr: Double,
    val arr: Double,
    @SerialName("delay_min") val delayMin: Int? = null,
    @SerialName("stops_left") val stopsLeft: Int = 0,
    val cancelled: Boolean = false,
    val arrived: Boolean = false,
    val live: Boolean = false
)

@Serializable
data class CommuteNews(
    val leg: String,
    val cancelled: Boolean,
    @SerialName("delay_min") val delayMin: Int? = null
)

@Serializable
data class FamilyStatus(
    val code: StatusCode,
    val text: String,
    @SerialName("set_at") val setAt: Double,
    val until: Double
)

@Serializable
data class FamilyMemberView(
    @SerialName("user_id") val userId: String,
    @SerialName("display_name") val displayName: String,
    val role: String,
    val me: Boolean,
    @SerialName("shared_with_me") val sharedWithMe: List<ShareKind> = emptyList(),
    val train: FamilyTrain? = null,
    val commute: CommuteNews? = null,
    val status: FamilyStatus? = null,
    val follow: FollowPrefs = FollowPrefs()
) {
    val isOwner: Boolean get() = role == "owner"
}

@Serializable
data class MyShare(
    val kind: ShareKind,
    val on: Boolean,
    val viewers: List<String> = emptyList(),
    val notified: List<String> = emptyList(),
    val live: List<String> = emptyList()
)

@Serializable
data class FamilyMe(
    @SerialName("display_name") val displayName: String,
    val role: String,
    val shares: List<MyShare> = emptyList(),
    val status: FamilyStatus? = null
)

@Serializable
data class PendingInvite(
    val id: String,
    val email: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class InviteToMe(
    val id: String,
    @SerialName("group_name") val groupName: String,
    @SerialName("from_name") val fromName: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class FamilyGroup(
    val id: String,
    val name: String,
    val owner: Boolean,
    val members: List<FamilyMemberView> = emptyList(),
    @SerialName("pending_invites") val pendingInvites: List<PendingInvite> = emptyList()
)

@Serializable
data class FamilyState(
    val email: String? = null,
    @SerialName("suggested_name") val suggestedName: String = "",
    val max: Int = 8,
    val invites: List<InviteToMe> = emptyList(),
    val group: FamilyGroup? = null,
    val me: FamilyMe? = null
) {
    val others: List<FamilyMemberView> get() = group?.members?.filter { !it.me } ?: emptyList()
    fun nameOf(userId: String): String = group?.members?.firstOrNull { it.userId == userId }?.displayName ?: "Someone"
    fun share(kind: ShareKind): MyShare? = me?.shares?.firstOrNull { it.kind == kind }

    /** Your shares that are on, with who sees each (what an update sends: absent means off). */
    val currentShares: Map<ShareKind, List<String>> get() = me?.shares?.filter { it.on }?.associate { it.kind to it.viewers } ?: emptyMap()

    /** What you follow of each member. */
    val currentFollows: Map<String, FollowPrefs> get() = others.filter { it.follow.notify.isNotEmpty() || it.follow.live }.associate { it.userId to it.follow }
}
