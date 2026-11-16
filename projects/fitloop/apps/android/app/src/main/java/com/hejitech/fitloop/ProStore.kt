package com.hejitech.fitloop

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import com.hejitech.fitloop.core.Backend
import com.hejitech.fitloop.core.PlayPurchaseUpload
import com.hejitech.fitloop.core.ProStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * FitLoop Pro on Android (docs/decisions.md "FitLoop Pro on every platform"): one answer per account from the
 * Worker (GET /api/pro: App Store, Google Play and web purchases, and grants), and Play Billing to buy
 * it here. Purchases go to the account (POST /api/play/purchases), which checks them with Google and
 * acknowledges them; owned purchases are sent again at every check, so renewals and restores need
 * nothing else. The last answer is kept on the phone so Pro keeps working offline.
 */
class ProStore(context: Context, private val backend: () -> Backend) : PurchasesUpdatedListener {
    companion object {
        const val ANNUAL = "pro_annual"
        const val LIFETIME = "pro_lifetime"
        private const val PREFS = "fitloop_pro"
        private const val KEY_PRO_UNTIL = "pro_until_ms"
    }

    data class Offers(val annual: ProductDetails? = null, val lifetime: ProductDetails? = null) {
        /** The yearly plan's free-week offer when Play still offers it to this account, else its base plan. */
        val annualOffer: ProductDetails.SubscriptionOfferDetails?
            get() = annual?.subscriptionOfferDetails?.let { offers ->
                offers.firstOrNull { o -> o.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L } } ?: offers.firstOrNull { it.offerId == null }
            }
        val trial: Boolean get() = annualOffer?.pricingPhases?.pricingPhaseList?.any { it.priceAmountMicros == 0L } == true
        /** The yearly plan's price (its last, recurring phase). */
        val annualPrice: String? get() = annualOffer?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice
        val lifetimePrice: String? get() = lifetime?.oneTimePurchaseOfferDetails?.formattedPrice
    }

    private val app = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private val _status = MutableStateFlow<ProStatus?>(null)
    val status: StateFlow<ProStatus?> = _status.asStateFlow()
    private val _offers = MutableStateFlow(Offers())
    val offers: StateFlow<Offers> = _offers.asStateFlow()
    private val _checked = MutableStateFlow(false)
    /** False until the first answer (or the cached one): the gate waits instead of flashing the paywall. */
    val checked: StateFlow<Boolean> = _checked.asStateFlow()
    private val _offersLoaded = MutableStateFlow(false)
    /** True once Google Play answered (or couldn't be reached): the paywall stops waiting for prices. */
    val offersLoaded: StateFlow<Boolean> = _offersLoaded.asStateFlow()
    private val _busy = MutableStateFlow<String?>(null)
    val busy: StateFlow<String?> = _busy.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    /** Pro now: the account's answer, or the cached one while offline. */
    val cachedPro: Boolean get() = prefs.getLong(KEY_PRO_UNTIL, 0L) > System.currentTimeMillis()

    private val billing: BillingClient = BillingClient.newBuilder(app)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private suspend fun connect(): Boolean {
        if (billing.isReady) return true
        return suspendCancellableCoroutine { cont ->
            billing.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (cont.isActive) cont.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                }
                override fun onBillingServiceDisconnected() {
                    if (cont.isActive) cont.resume(false)
                }
            })
        }
    }

    /** After sign-in, at launch and when the app comes back: products, owned purchases, the account's answer. */
    suspend fun refresh() {
        _error.value = null
        val client = backend()
        if (connect()) {
            runCatching { loadOffers() }
            val owned = ownedPurchases()
            if (owned.isNotEmpty()) runCatching { remember(client.uploadPlayPurchases(owned)) }
        }
        _offersLoaded.value = true
        runCatching { client.pro() }
            .onSuccess { remember(it) }
            .onFailure { if (_status.value == null) _error.value = "Couldn't check your account for FitLoop Pro. Check your connection and try again." }
        _checked.value = true
    }

    /** Signing out forgets the cached answer (Pro belongs to the account). */
    fun forget() {
        prefs.edit().remove(KEY_PRO_UNTIL).apply()
        _status.value = null
        _checked.value = false
    }

    private fun remember(s: ProStatus) {
        _status.value = s
        val until = when {
            !s.pro -> 0L
            s.until == null -> Long.MAX_VALUE
            else -> runCatching { java.time.Instant.parse(s.until).toEpochMilli() }.getOrDefault(System.currentTimeMillis() + 86_400_000L)
        }
        prefs.edit().putLong(KEY_PRO_UNTIL, until).apply()
    }

    private suspend fun loadOffers() {
        fun params(id: String, type: String) = QueryProductDetailsParams.newBuilder().setProductList(
            listOf(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build())
        ).build()
        val annual = billing.queryProductDetails(params(ANNUAL, BillingClient.ProductType.SUBS)).productDetailsList?.firstOrNull()
        val lifetime = billing.queryProductDetails(params(LIFETIME, BillingClient.ProductType.INAPP)).productDetailsList?.firstOrNull()
        _offers.value = Offers(annual, lifetime)
    }

    private suspend fun ownedPurchases(): List<PlayPurchaseUpload> {
        val out = mutableListOf<PlayPurchaseUpload>()
        for (type in listOf(BillingClient.ProductType.SUBS, BillingClient.ProductType.INAPP)) {
            val r = billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build())
            for (p in r.purchasesList) if (p.purchaseState == Purchase.PurchaseState.PURCHASED) {
                p.products.firstOrNull()?.let { out += PlayPurchaseUpload(it, p.purchaseToken) }
            }
        }
        return out
    }

    /** Opens Google Play's purchase sheet for the yearly plan or lifetime, tied to the signed-in account. */
    fun buy(activity: Activity, product: String) {
        val o = _offers.value
        val details = (if (product == ANNUAL) o.annual else o.lifetime) ?: return
        val userId = backend().session?.userId
        val item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).apply {
            if (product == ANNUAL) o.annualOffer?.offerToken?.let { setOfferToken(it) }
        }.build()
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(item)).apply {
            if (userId != null) setObfuscatedAccountId(userId)
        }.build()
        _busy.value = product
        _error.value = null
        val result = billing.launchBillingFlow(activity, params)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            _busy.value = null
            _error.value = "Google Play couldn't start the purchase (${result.debugMessage.ifBlank { result.responseCode.toString() }})."
        }
    }

    /** Restore: whatever this Google account owns goes to the signed-in account. */
    fun restore() {
        _busy.value = "restore"
        scope.launch {
            refresh()
            if (_status.value?.pro != true) _error.value = "No FitLoop Pro purchase was found for this Google account or ${_status.value?.email ?: "this account"}."
            _busy.value = null
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> scope.launch {
                val done = purchases.orEmpty().filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                    .mapNotNull { p -> p.products.firstOrNull()?.let { PlayPurchaseUpload(it, p.purchaseToken) } }
                if (purchases.orEmpty().any { it.purchaseState == Purchase.PurchaseState.PENDING }) {
                    _error.value = "The purchase is waiting for approval. FitLoop unlocks as soon as it's approved."
                }
                if (done.isNotEmpty()) {
                    runCatching { remember(backend().uploadPlayPurchases(done)) }
                        .onFailure { _error.value = "Bought. Linking it to your account didn't work yet: it will on the next launch." }
                }
                _busy.value = null
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> _busy.value = null
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> { _busy.value = null; restore() }
            else -> {
                _busy.value = null
                _error.value = "Google Play: ${result.debugMessage.ifBlank { "the purchase didn't go through (${result.responseCode})" }}"
            }
        }
    }
}
