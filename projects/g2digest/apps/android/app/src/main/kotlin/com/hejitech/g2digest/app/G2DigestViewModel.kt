package com.hejitech.g2digest.app

import android.app.Application
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.g2digest.core.AgentToken
import com.hejitech.g2digest.core.AuthSession
import com.hejitech.g2digest.core.BookmarkItem
import com.hejitech.g2digest.core.BuildRunItem
import com.hejitech.g2digest.core.CardInput
import com.hejitech.g2digest.core.EditionResponse
import com.hejitech.g2digest.core.EditionSummary
import com.hejitech.g2digest.core.FeedLinks
import com.hejitech.g2digest.core.G2DigestApiClient
import com.hejitech.g2digest.core.PairedDevice
import com.hejitech.g2digest.core.PairingCode
import com.hejitech.g2digest.core.ProStatus
import com.hejitech.g2digest.core.SearchHitItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ReaderMode(val label: String) { CARDS("Cards"), EDITION("Edition"), HUD("Glasses") }
enum class AppTab(val label: String) { READ("Read"), ARCHIVE("Archive"), AGENTS("Agents"), SETTINGS("Settings") }

data class UiState(
    val signedIn: Boolean = false,
    val paired: Boolean = false,
    val email: String? = null,
    val pro: ProStatus? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val statusBanner: String? = null,
    val tab: AppTab = AppTab.READ,
    val readerMode: ReaderMode = ReaderMode.CARDS,
    val edition: EditionResponse? = null,
    val cardIndex: Int = 0,
    val editions: List<EditionSummary> = emptyList(),
    val bookmarks: List<BookmarkItem> = emptyList(),
    val searchHits: List<SearchHitItem> = emptyList(),
    val buildRuns: List<BuildRunItem> = emptyList(),
    val devices: List<PairedDevice> = emptyList(),
    val tokens: List<AgentToken> = emptyList(),
    val pairingCode: PairingCode? = null,
    val feedLinks: FeedLinks? = null,
    val shareUrl: String? = null,
    val playingTitle: String? = null,
    val isPlaying: Boolean = false,
    val showWhatsNew: Boolean = false,
    val useLocalStack: Boolean = false,
)

class G2DigestViewModel(app: Application) : AndroidViewModel(app) {
    companion object {
        const val CURRENT_VERSION = "0.6.0"
    }

    private val store = SessionStore(app)
    private var session: AuthSession? = store.loadSession()
    private var deviceToken: String? = store.loadDeviceToken()
    private var mediaPlayer: MediaPlayer? = null
    private var audioQueue: List<Pair<CardInput, String>> = emptyList()
    private var queuePos: Int = 0

    private val _ui = MutableStateFlow(
        UiState(
            signedIn = session != null,
            paired = !deviceToken.isNullOrBlank(),
            email = session?.email,
            showWhatsNew = store.lastSeenWhatsNew() != CURRENT_VERSION,
            useLocalStack = store.useLocalStack(),
        ),
    )
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private fun api(): G2DigestApiClient {
        val local = store.useLocalStack()
        return G2DigestApiClient(
            baseUrl = if (local) "http://127.0.0.1:8790" else G2DigestApiClient.PROD_BASE_URL,
            supabaseUrl = if (local) "http://127.0.0.1:55421" else G2DigestApiClient.PROD_SUPABASE_URL,
            supabaseAnonKey = if (local) {
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
            } else {
                G2DigestApiClient.PROD_SUPABASE_ANON_KEY
            },
            bearerProvider = { session?.accessToken ?: deviceToken },
        )
    }

    init {
        if (session != null || !deviceToken.isNullOrBlank()) refreshAll()
    }

    fun dismissWhatsNew() {
        store.markWhatsNewSeen(CURRENT_VERSION)
        _ui.update { it.copy(showWhatsNew = false) }
    }

    fun selectTab(tab: AppTab) = _ui.update { it.copy(tab = tab) }
    fun selectReaderMode(mode: ReaderMode) = _ui.update { it.copy(readerMode = mode) }
    fun selectCard(index: Int) = _ui.update { it.copy(cardIndex = index.coerceAtLeast(0)) }

    fun toggleLocalStack(local: Boolean) {
        store.setUseLocalStack(local)
        _ui.update { it.copy(useLocalStack = local) }
    }

    fun startGoogleSignIn(): String {
        val (verifier, challenge) = G2DigestApiClient.generatePkce()
        store.savePkceVerifier(verifier)
        return api().googleAuthUrl(challenge)
    }

    fun handleAuthCallback(uri: Uri) {
        val code = uri.getQueryParameter("code") ?: return
        val verifier = store.loadPkceVerifier() ?: return
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            runCatching { api().exchangePkceCode(code, verifier) }
                .onSuccess { s ->
                    session = s
                    store.saveSession(s)
                    store.savePkceVerifier(null)
                    _ui.update { it.copy(signedIn = true, email = s.email, loading = false) }
                    refreshAll()
                }
                .onFailure { e -> _ui.update { it.copy(loading = false, error = e.message) } }
        }
    }

    fun signInSeedLocal() {
        if (!BuildConfig.DEBUG) return
        store.setUseLocalStack(true)
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null, useLocalStack = true) }
            runCatching { api().signInWithPassword("reader@example.com", "g2digest-dev") }
                .onSuccess { s ->
                    session = s
                    store.saveSession(s)
                    _ui.update { it.copy(signedIn = true, email = s.email, loading = false) }
                    refreshAll()
                }
                .onFailure { e -> _ui.update { it.copy(loading = false, error = e.message) } }
        }
    }

    fun pairWithCode(code: String) {
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            runCatching { api().redeemPairingCode(code) }
                .onSuccess { res ->
                    deviceToken = res.deviceToken
                    store.saveDeviceToken(res.deviceToken)
                    _ui.update { it.copy(paired = true, loading = false) }
                    refreshAll()
                }
                .onFailure { e -> _ui.update { it.copy(loading = false, error = e.message) } }
        }
    }

    fun signOut() {
        stopAudio()
        session = null
        deviceToken = null
        store.saveSession(null)
        store.saveDeviceToken(null)
        _ui.update { UiState(useLocalStack = store.useLocalStack()) }
    }

    fun refreshAll() {
        val client = api()
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            runCatching {
                val list = client.fetchEditions()
                val latest = if (list.isNotEmpty()) client.fetchEdition(list.first().date) else null
                val bookmarks = if (session != null) runCatching { client.fetchBookmarks() }.getOrDefault(emptyList()) else emptyList()
                val runs = if (session != null) runCatching { client.fetchBuildRuns() }.getOrDefault(emptyList()) else emptyList()
                val devices = if (session != null) runCatching { client.fetchDevices() }.getOrDefault(emptyList()) else emptyList()
                val tokens = if (session != null) runCatching { client.fetchTokens() }.getOrDefault(emptyList()) else emptyList()
                val pro = if (session != null) runCatching { client.fetchProStatus() }.getOrNull() else null
                _ui.update {
                    it.copy(
                        loading = false,
                        editions = list,
                        edition = latest,
                        cardIndex = 0,
                        bookmarks = bookmarks,
                        buildRuns = runs,
                        devices = devices,
                        tokens = tokens,
                        pro = pro,
                    )
                }
            }.onFailure { e -> _ui.update { it.copy(loading = false, error = e.message) } }
        }
    }

    fun loadEdition(date: String) {
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            runCatching { api().fetchEdition(date) }
                .onSuccess { ed -> _ui.update { it.copy(loading = false, edition = ed, cardIndex = 0, tab = AppTab.READ) } }
                .onFailure { e -> _ui.update { it.copy(loading = false, error = e.message) } }
        }
    }

    fun search(query: String) {
        if (query.isBlank() || session == null) {
            _ui.update { it.copy(searchHits = emptyList()) }
            return
        }
        viewModelScope.launch {
            runCatching { api().searchEditions(query) }
                .onSuccess { hits -> _ui.update { it.copy(searchHits = hits) } }
        }
    }

    fun bookmarkCurrentCard() {
        val ed = _ui.value.edition ?: return
        val card = ed.bundle.cards.getOrNull(_ui.value.cardIndex) ?: return
        val sec = card.sectionId?.let { id -> ed.bundle.edition.sections.firstOrNull { it.sectionId == id }?.title }
        viewModelScope.launch {
            runCatching {
                api().addBookmark(BookmarkItem(ed.date, card.slug, card.title, sec, card.body, card.sourceUrl))
                _ui.update { it.copy(statusBanner = "Bookmarked \"${card.title}\"") }
                if (session != null) _ui.update { it.copy(bookmarks = api().fetchBookmarks()) }
            }.onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    fun createShareLink() {
        val ed = _ui.value.edition ?: return
        viewModelScope.launch {
            runCatching { api().createShareLink(ed.date, ed.title) }
                .onSuccess { res -> _ui.update { it.copy(shareUrl = res.url, statusBanner = "Share link ready") } }
                .onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    fun generatePairingCode() {
        viewModelScope.launch {
            runCatching { api().createPairingCode() }
                .onSuccess { code -> _ui.update { it.copy(pairingCode = code) } }
                .onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    fun createPodcastFeed() {
        viewModelScope.launch {
            runCatching { api().createFeed() }
                .onSuccess { links -> _ui.update { it.copy(feedLinks = links) } }
                .onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    fun playAll(deepDive: Boolean) {
        val ed = _ui.value.edition ?: return
        val tracks = ed.bundle.cards.mapNotNull { c ->
            val path = if (deepDive) c.deepDive?.audioPath else c.glance?.audioPath
            val url = path?.let { ed.audio[it] }
            if (url != null) c to url else null
        }
        if (tracks.isEmpty()) return
        audioQueue = tracks
        queuePos = 0
        playTrackAt(0)
    }

    private fun playTrackAt(idx: Int) {
        val pair = audioQueue.getOrNull(idx) ?: return stopAudio()
        val (card, url) = pair
        stopPlayerOnly()
        val mp = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build(),
            )
            setDataSource(url)
            setOnPreparedListener { it.start() }
            setOnCompletionListener {
                if (queuePos + 1 < audioQueue.size) {
                    queuePos += 1
                    playTrackAt(queuePos)
                } else {
                    stopAudio()
                }
            }
            prepareAsync()
        }
        mediaPlayer = mp
        val cardIdx = _ui.value.edition?.bundle?.cards?.indexOfFirst { it.slug == card.slug } ?: _ui.value.cardIndex
        _ui.update { it.copy(playingTitle = card.title, isPlaying = true, cardIndex = cardIdx.coerceAtLeast(0)) }
    }

    private fun stopPlayerOnly() {
        runCatching { mediaPlayer?.stop() }
        runCatching { mediaPlayer?.release() }
        mediaPlayer = null
    }

    fun stopAudio() {
        stopPlayerOnly()
        audioQueue = emptyList()
        queuePos = 0
        _ui.update { it.copy(playingTitle = null, isPlaying = false) }
    }

    override fun onCleared() {
        stopAudio()
        super.onCleared()
    }
}
