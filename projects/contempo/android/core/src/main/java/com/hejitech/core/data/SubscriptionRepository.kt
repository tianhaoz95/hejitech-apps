package com.hejitech.core.data

import com.hejitech.core.supabase.ContempoBackend
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonPrimitive

private val ACTIVE_SUBSCRIPTION_STATUSES = setOf("active", "trialing", "past_due")

/**
 * Pro entitlement from contempo.subscriptions, written only by the Contempo Worker's Stripe
 * webhook (never client-writable). Subscriptions are bought on the web only; the apps just read.
 */
class SubscriptionRepository {
    @OptIn(ExperimentalCoroutinesApi::class)
    fun observeHasProEntitlement(): Flow<Boolean> =
        ContempoBackend.signedIn.flatMapLatest { signedIn ->
            if (!signedIn) {
                flowOf(false)
            } else {
                ContempoBackend.liveRows("subscriptions", "updated_at", ascending = false) { row ->
                    (row["status"] as? JsonPrimitive)?.content
                }.map { statuses -> statuses.any { it in ACTIVE_SUBSCRIPTION_STATUSES } }
                    // Fail closed: no entitlement rather than unlocking cloud AI on an error.
                    .catch { emit(false) }
            }
        }
}
