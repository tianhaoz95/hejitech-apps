package com.hejitech.core.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

private val ACTIVE_SUBSCRIPTION_STATUSES = setOf("active", "trialing", "past_due")

/**
 * users/{uid}/billing/subscription, synced only by the stripeWebhook Cloud
 * Function (backend/functions-billing/) — never client-written, see
 * firestore.rules. Re-subscribes across sign-in/out via an auth state
 * listener, so this is safe to start observing from app launch, before any
 * user is confirmed signed in (unlike FirestoreEntryRepository's observe*
 * methods, which assume a signed-in uid already).
 */
class SubscriptionRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    fun observeHasProEntitlement(): Flow<Boolean> = callbackFlow {
        var docRegistration: ListenerRegistration? = null

        fun subscribeToUser(uid: String?) {
            docRegistration?.remove()
            docRegistration = null
            if (uid == null) {
                trySend(false)
                return
            }
            docRegistration = firestore.collection("users").document(uid)
                .collection("billing").document("subscription")
                .addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        // Fail closed — treat as no entitlement rather than
                        // risk unlocking cloud AI on a permission error.
                        trySend(false)
                        return@addSnapshotListener
                    }
                    trySend(snapshot?.getString("status") in ACTIVE_SUBSCRIPTION_STATUSES)
                }
        }

        val authListener = FirebaseAuth.AuthStateListener { subscribeToUser(it.currentUser?.uid) }
        auth.addAuthStateListener(authListener)
        awaitClose {
            auth.removeAuthStateListener(authListener)
            docRegistration?.remove()
        }
    }
}
