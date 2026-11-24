package com.hejitech.g2digest.app

import android.app.Application
import android.media.AudioAttributes
import android.media.MediaMetadata
import android.media.MediaPlayer
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.g2digest.core.AgentToken
import com.hejitech.g2digest.core.AuthSession
import com.hejitech.g2digest.core.BookmarkItem
import com.hejitech.g2digest.core.Brief
import com.hejitech.g2digest.core.BriefIssue
import com.hejitech.g2digest.core.BriefSection
import com.hejitech.g2digest.core.BriefValidator
import com.hejitech.g2digest.core.BuildRunItem
import com.hejitech.g2digest.core.CardInput
import com.hejitech.g2digest.core.EditionResponse
import com.hejitech.g2digest.core.EditionSummary
import com.hejitech.g2digest.core.FeedLinks
import com.hejitech.g2digest.core.G2DigestApiClient
import com.hejitech.g2digest.core.OnboardingStatus
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
enum class AppTab(val label: String) { READ("Read"), BRIEF("Brief"), ARCHIVE("Archive"), AGENTS("Agents"), SETTINGS("Settings") }

data class UiState(
    val signedIn: Boolean = false,
    val paired: Boolean = false,
    val email: String? = null,
    val pro: ProStatus? = null,
    val loading: Boolean = false,
    val isOffline: Boolean = false,
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
    val onboarding: OnboardingStatus? = null,
    val brief: Brief? = null,
    val briefVersion: Int = 0,
    val briefDirty: Boolean = false,
    val briefIssues: List<BriefIssue> = emptyList(),
    val devices: List<PairedDevice> = emptyList(),
    val tokens: List<AgentToken> = emptyList(),
    val createdAgentToken: String? = null,
    val pairingCode: PairingCode? = null,
    val feedLinks: FeedLinks? = null,
    val shareUrl: String? = null,
    val playingTitle: String? = null,
    val isPlaying: Boolean = false,
    val playbackRate: Float = 1.0f,
    val fcmRegistered: Boolean = false,
    val showWhatsNew: Boolean = false,
    val useLocalStack: Boolean = false,
)

class G2DigestViewModel(app: Application) : AndroidViewModel(app) {
    companion object {
        const val CURRENT_VERSION = "0.6.0"
        val RATES = listOf(1.0f, 1.25f, 1.5f, 1.75f)
    }

    private val store = SessionStore(app)
    private val offline = OfflineCache(app)
    private var session: AuthSession? = store.loadSession()
    private var deviceToken: String? = store.loadDeviceToken()
    private var mediaPlayer: MediaPlayer? = null
    private var audioQueue: List<Triple<CardInput, String, String>> = emptyList() // (card, audioPath, signedUrl)
    private var queuePos: Int = 0

    private val mediaSession = MediaSession(app, "G2DigestAudio").apply {
        setCallback(object : MediaSession.Callback() {
            override fun onPlay() { togglePlayPause() }
            override fun onPause() { togglePlayPause() }
            override fun onSkipToNext() { nextAudio() }
            override fun onSkipToPrevious() { prevAudio() }
            override fun onStop() { stopAudio() }
        })
        isActive = true
    }

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
        offline.clearAll()
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
                if (latest != null) launch { offline.saveEdition(latest) }
                val bookmarks = if (session != null) runCatching { client.fetchBookmarks() }.getOrDefault(emptyList()) else emptyList()
                val runs = if (session != null) runCatching { client.fetchBuildRuns() }.getOrDefault(emptyList()) else emptyList()
                val onboarding = if (session != null) runCatching { client.fetchOnboardingStatus() }.getOrNull() else null
                val briefRes = if (session != null) runCatching { client.fetchBrief() }.getOrNull() else null
                val devices = if (session != null) runCatching { client.fetchDevices() }.getOrDefault(emptyList()) else emptyList()
                val tokens = if (session != null) runCatching { client.fetchTokens() }.getOrDefault(emptyList()) else emptyList()
                val pro = if (session != null) runCatching { client.fetchProStatus() }.getOrNull() else null
                _ui.update {
                    it.copy(
                        loading = false,
                        isOffline = false,
                        editions = list,
                        edition = latest,
                        cardIndex = 0,
                        bookmarks = bookmarks,
                        buildRuns = runs,
                        onboarding = onboarding,
                        brief = briefRes?.brief ?: it.brief,
                        briefVersion = briefRes?.briefVersion ?: it.briefVersion,
                        briefDirty = false,
                        briefIssues = briefRes?.brief?.let(BriefValidator::checkBrief) ?: emptyList(),
                        devices = devices,
                        tokens = tokens,
                        pro = pro,
                    )
                }
            }.onFailure { e ->
                val cached = offline.loadLatestEdition()
                if (cached != null) {
                    _ui.update { it.copy(loading = false, isOffline = true, edition = cached, error = null, statusBanner = "Showing offline cached edition (${cached.date})") }
                } else {
                    _ui.update { it.copy(loading = false, error = e.message) }
                }
            }
        }
    }

    fun loadEdition(date: String) {
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            runCatching { api().fetchEdition(date) }
                .onSuccess { ed ->
                    launch { offline.saveEdition(ed) }
                    _ui.update { it.copy(loading = false, isOffline = false, edition = ed, cardIndex = 0, tab = AppTab.READ) }
                }
                .onFailure { e ->
                    val cached = offline.loadEdition(date)
                    if (cached != null) {
                        _ui.update { it.copy(loading = false, isOffline = true, edition = cached, cardIndex = 0, tab = AppTab.READ) }
                    } else {
                        _ui.update { it.copy(loading = false, error = e.message) }
                    }
                }
        }
    }

    // ------------------------------------------------------------ Brief editor

    fun updateBrief(transform: (Brief) -> Brief) {
        val current = _ui.value.brief ?: return
        val next = transform(current)
        _ui.update { it.copy(brief = next, briefDirty = true, briefIssues = BriefValidator.checkBrief(next)) }
    }

    fun addBriefSection() {
        updateBrief { b ->
            var n = b.sections.size + 1
            while (b.sections.any { it.id == "section-$n" }) n++
            b.copy(
                sections = b.sections + BriefSection(
                    id = "section-$n",
                    title = "Section $n",
                    template = "status",
                    maxCards = 2,
                    instructions = "Summarize notable updates for this section.",
                ),
            )
        }
    }

    fun removeBriefSection(index: Int) {
        updateBrief { b ->
            if (index !in b.sections.indices) b else b.copy(sections = b.sections.filterIndexed { i, _ -> i != index })
        }
    }

    fun moveBriefSection(index: Int, delta: Int) {
        updateBrief { b ->
            val target = index + delta
            if (index !in b.sections.indices || target !in b.sections.indices) return@updateBrief b
            val list = b.sections.toMutableList()
            val item = list.removeAt(index)
            list.add(target, item)
            b.copy(sections = list)
        }
    }

    fun saveBrief() {
        val b = _ui.value.brief ?: return
        val issues = BriefValidator.checkBrief(b)
        if (issues.isNotEmpty()) {
            _ui.update { it.copy(briefIssues = issues) }
            return
        }
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, error = null) }
            runCatching { api().saveBrief(b, _ui.value.briefVersion) }
                .onSuccess { res ->
                    _ui.update {
                        it.copy(
                            loading = false,
                            brief = res.brief,
                            briefVersion = res.briefVersion,
                            briefDirty = false,
                            briefIssues = emptyList(),
                            statusBanner = "Brief saved (v${res.briefVersion})",
                        )
                    }
                }
                .onFailure { e -> _ui.update { it.copy(loading = false, error = e.message) } }
        }
    }

    // ------------------------------------------------------------ Agent tokens & FCM push

    fun createAgentToken(name: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            runCatching { api().createToken(name.trim()) }
                .onSuccess { tok ->
                    val list = runCatching { api().fetchTokens() }.getOrDefault(_ui.value.tokens)
                    _ui.update { it.copy(createdAgentToken = tok, tokens = list, statusBanner = "Agent token created (copy it now)") }
                }
                .onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    fun revokeAgentToken(id: String) {
        viewModelScope.launch {
            runCatching { api().revokeToken(id) }
                .onSuccess {
                    val list = runCatching { api().fetchTokens() }.getOrDefault(emptyList())
                    _ui.update { it.copy(tokens = list, statusBanner = "Agent token revoked") }
                }
                .onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    fun registerFcmToken(token: String) {
        if (session == null || token.length < 20) return
        viewModelScope.launch {
            runCatching { api().registerFcmToken(token) }
                .onSuccess { _ui.update { it.copy(fcmRegistered = true, statusBanner = "Push notifications enabled") } }
                .onFailure { e -> _ui.update { it.copy(error = e.message) } }
        }
    }

    // ------------------------------------------------------------ Archive, bookmarks, sharing

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

    // ------------------------------------------------------------ Audio player + MediaSession

    fun playAll(deepDive: Boolean) {
        val ed = _ui.value.edition ?: return
        val tracks = ed.bundle.cards.mapNotNull { c ->
            val path = if (deepDive) c.deepDive?.audioPath else c.glance?.audioPath
            val url = path?.let { ed.audio[it] } ?: ""
            if (path != null && (offline.localAudioFile(path) != null || url.isNotBlank())) Triple(c, path, url) else null
        }
        if (tracks.isEmpty()) return
        audioQueue = tracks
        queuePos = 0
        playTrackAt(0)
    }

    fun togglePlayPause() {
        val mp = mediaPlayer ?: return
        if (mp.isPlaying) {
            mp.pause()
            _ui.update { it.copy(isPlaying = false) }
            updateMediaSession(playing = false, title = _ui.value.playingTitle ?: "")
        } else {
            mp.start()
            _ui.update { it.copy(isPlaying = true) }
            updateMediaSession(playing = true, title = _ui.value.playingTitle ?: "")
        }
    }

    fun nextAudio() {
        if (queuePos + 1 < audioQueue.size) {
            queuePos += 1
            playTrackAt(queuePos)
        }
    }

    fun prevAudio() {
        if (queuePos > 0) {
            queuePos -= 1
            playTrackAt(queuePos)
        }
    }

    fun cyclePlaybackRate() {
        val cur = _ui.value.playbackRate
        val next = RATES[(RATES.indexOf(cur) + 1) % RATES.size]
        _ui.update { it.copy(playbackRate = next) }
        runCatching {
            mediaPlayer?.let { mp ->
                mp.playbackParams = mp.playbackParams.setSpeed(next)
            }
        }
    }

    private fun playTrackAt(idx: Int) {
        val triple = audioQueue.getOrNull(idx) ?: return stopAudio()
        val (card, audioPath, signedUrl) = triple
        stopPlayerOnly()
        val localFile = offline.localAudioFile(audioPath)
        val source = localFile?.absolutePath ?: signedUrl
        val rate = _ui.value.playbackRate
        val mp = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build(),
            )
            setDataSource(source)
            setOnPreparedListener {
                runCatching { it.playbackParams = it.playbackParams.setSpeed(rate) }
                it.start()
            }
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
        updateMediaSession(playing = true, title = card.title)
    }

    private fun updateMediaSession(playing: Boolean, title: String) {
        mediaSession.setMetadata(
            MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, _ui.value.edition?.title ?: "G2 Digest")
                .build(),
        )
        val state = if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
        val actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or
            PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_STOP
        mediaSession.setPlaybackState(
            PlaybackState.Builder()
                .setActions(actions)
                .setState(state, mediaPlayer?.currentPosition?.toLong() ?: 0L, _ui.value.playbackRate)
                .build(),
        )
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
        mediaSession.setPlaybackState(
            PlaybackState.Builder().setState(PlaybackState.STATE_STOPPED, 0L, 1.0f).build(),
        )
    }

    override fun onCleared() {
        stopAudio()
        mediaSession.release()
        super.onCleared()
    }
}
