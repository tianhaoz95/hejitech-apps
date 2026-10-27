package com.hejitech.weehours

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.weehours.core.AccessToken
import com.hejitech.weehours.core.AuthSession
import com.hejitech.weehours.core.Baby
import com.hejitech.weehours.core.BackendConfig
import com.hejitech.weehours.core.CSVExport
import com.hejitech.weehours.core.DerivedLog
import com.hejitech.weehours.core.DoctorVisitPack
import com.hejitech.weehours.core.Entitlement
import com.hejitech.weehours.core.EntryPhoto
import com.hejitech.weehours.core.FieldValue
import com.hejitech.weehours.core.GlassesPairingCode
import com.hejitech.weehours.core.Household
import com.hejitech.weehours.core.InputKind
import com.hejitech.weehours.core.KeywordDecisionModel
import com.hejitech.weehours.core.LogCoding
import com.hejitech.weehours.core.LogEvent
import com.hejitech.weehours.core.LogService
import com.hejitech.weehours.core.MilkStash
import com.hejitech.weehours.core.PartnerActivity
import com.hejitech.weehours.core.PresenceChannel
import com.hejitech.weehours.core.Provenance
import com.hejitech.weehours.core.SQLiteLogStore
import com.hejitech.weehours.core.ShiftSummary
import com.hejitech.weehours.core.SolidsSummary
import com.hejitech.weehours.core.StatusSnapshot
import com.hejitech.weehours.core.SupabaseClient
import com.hejitech.weehours.core.Surface
import com.hejitech.weehours.core.SystemOneHTTPModel
import com.hejitech.weehours.core.TiltCompass
import com.hejitech.weehours.core.VoiceInterpreter
import com.hejitech.weehours.core.uuidString
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

enum class AppPhase {
    READY,
    ONBOARDING
}

enum class MainTab {
    NOW,
    TIMELINE,
    SETTINGS
}

enum class TimelineDensity(val label: String) {
    GRID("24h Grid"),
    CARDS("Cards"),
    AUDIT("Audit Log")
}

class AppModel(application: Application) : AndroidViewModel(application) {
    private val appContext: Context = application.applicationContext
    private val prefs = appContext.getSharedPreferences("weehours_prefs", Context.MODE_PRIVATE)

    val store: SQLiteLogStore
    val supabase: SupabaseClient
    val service: LogService
    val voice: VoiceService
    val reminders: ReminderScheduler
    private var presence: PresenceChannel? = null

    private val _revision = MutableStateFlow(0L)
    val revision: StateFlow<Long> = _revision.asStateFlow()

    private val _nowTick = MutableStateFlow(Date())
    val nowTick: StateFlow<Date> = _nowTick.asStateFlow()

    private val _phase = MutableStateFlow(AppPhase.READY)
    val phase: StateFlow<AppPhase> = _phase.asStateFlow()

    private val _currentTab = MutableStateFlow(MainTab.NOW)
    val currentTab: StateFlow<MainTab> = _currentTab.asStateFlow()

    private val _selectedBabyIds = MutableStateFlow<Set<UUID>>(emptySet())
    val selectedBabyIds: StateFlow<Set<UUID>> = _selectedBabyIds.asStateFlow()

    private val _listeningSheetOpen = MutableStateFlow(false)
    val listeningSheetOpen: StateFlow<Boolean> = _listeningSheetOpen.asStateFlow()

    private val _reviewSheetOpen = MutableStateFlow(false)
    val reviewSheetOpen: StateFlow<Boolean> = _reviewSheetOpen.asStateFlow()

    private val _nightHudOverride = MutableStateFlow<Boolean?>(null)
    val nightHudOverride: StateFlow<Boolean?> = _nightHudOverride.asStateFlow()

    private val _thumbZone = MutableStateFlow(prefs.getBoolean("thumb_zone", true))
    val thumbZone: StateFlow<Boolean> = _thumbZone.asStateFlow()

    private val _useFluidOz = MutableStateFlow(prefs.getBoolean("use_fl_oz", false))
    val useFluidOz: StateFlow<Boolean> = _useFluidOz.asStateFlow()

    private val _quickCapture = MutableStateFlow(prefs.getBoolean("quick_capture", false))
    val quickCapture: StateFlow<Boolean> = _quickCapture.asStateFlow()

    private val _speechLocale = MutableStateFlow(prefs.getString("speech_locale", "auto") ?: "auto")
    val speechLocale: StateFlow<String> = _speechLocale.asStateFlow()

    private val _layaEndpoint = MutableStateFlow(prefs.getString("laya_endpoint", "") ?: "")
    val layaEndpoint: StateFlow<String> = _layaEndpoint.asStateFlow()

    private val _timelineDensity = MutableStateFlow(
        TimelineDensity.entries.firstOrNull { it.name == prefs.getString("timeline_density", "CARDS") }
            ?: TimelineDensity.CARDS
    )
    val timelineDensity: StateFlow<TimelineDensity> = _timelineDensity.asStateFlow()

    private val _nowLayout = MutableStateFlow(NowLayout.decode(prefs.getString("now_layout", null)))
    val nowLayout: StateFlow<NowLayout> = _nowLayout.asStateFlow()

    private val _watchPinnedCategories = MutableStateFlow(
        (prefs.getString("watch_pinned", "bath,tummy_time,medicine,temperature") ?: "")
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
    )
    val watchPinnedCategories: StateFlow<List<String>> = _watchPinnedCategories.asStateFlow()

    private val _watchCompassSlots = MutableStateFlow<Map<String, CompassSlot>>(
        CompassSlot.decodeOverrides(prefs.getString("watch_compass", null))
    )
    val watchCompassSlots: StateFlow<Map<String, CompassSlot>> = _watchCompassSlots.asStateFlow()

    private val _partnerActivity = MutableStateFlow<PartnerActivity?>(null)
    val partnerActivity: StateFlow<PartnerActivity?> = _partnerActivity.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

    private val _lastLoggedEvent = MutableStateFlow<LogEvent?>(null)
    val lastLoggedEvent: StateFlow<LogEvent?> = _lastLoggedEvent.asStateFlow()

    private val _entitlement = MutableStateFlow<Entitlement?>(null)
    val entitlement: StateFlow<Entitlement?> = _entitlement.asStateFlow()

    private val _accessTokens = MutableStateFlow<List<AccessToken>>(emptyList())
    val accessTokens: StateFlow<List<AccessToken>> = _accessTokens.asStateFlow()

    private val _glassesCode = MutableStateFlow<GlassesPairingCode?>(null)
    val glassesCode: StateFlow<GlassesPairingCode?> = _glassesCode.asStateFlow()

    private val _inviteCode = MutableStateFlow<String?>(null)
    val inviteCode: StateFlow<String?> = _inviteCode.asStateFlow()

    private val _caregiverPass = MutableStateFlow<String?>(null)
    val caregiverPass: StateFlow<String?> = _caregiverPass.asStateFlow()

    private val _syncInProgress = MutableStateFlow(false)
    val syncInProgress: StateFlow<Boolean> = _syncInProgress.asStateFlow()

    private val _showWhatsNew = MutableStateFlow(false)
    val showWhatsNew: StateFlow<Boolean> = _showWhatsNew.asStateFlow()

    private var timerJob: Job? = null

    companion object {
        const val CURRENT_VERSION = "0.13.2"
    }

    init {
        supabase = SupabaseClient(
            config = BackendConfig.production,
            initialSession = loadSavedSession()
        )
        supabase.onSessionUpdated = { persistSession(it) }

        val (openedStore, openedService) = CoreBridge.openStoreAndService(appContext, backend = supabase)
        store = openedStore
        service = openedService
        service.setInterpreter(buildInterpreter(_layaEndpoint.value))

        reminders = ReminderScheduler(appContext)
        voice = VoiceService(appContext) { transcript, audioPath, captureId ->
            handleVoiceTranscript(transcript, audioPath, captureId)
        }
        voice.preferredLocale = _speechLocale.value

        val onboarded = prefs.getBoolean("onboarded", false) || store.events().isNotEmpty()
        _phase.value = if (onboarded) AppPhase.READY else AppPhase.ONBOARDING
        _selectedBabyIds.value = setOf(service.household.babyId)

        val seenVersion = prefs.getString("seen_whats_new", null)
        if (onboarded && seenVersion != CURRENT_VERSION) {
            _showWhatsNew.value = true
        }

        WearBridge.onExternalActionApplied = {
            viewModelScope.launch {
                service.reloadHousehold()
                bumpRevision()
            }
        }

        timerJob = viewModelScope.launch {
            while (isActive) {
                delay(1_000L)
                _nowTick.value = Date()
            }
        }

        if (supabase.isAuthenticated) {
            connectPresence()
            syncNow()
        } else {
            refreshAllSurfaces()
        }
    }

    private fun buildInterpreter(endpoint: String): VoiceInterpreter =
        if (endpoint.isNotBlank()) {
            VoiceInterpreter(model = SystemOneHTTPModel(endpoint = endpoint.trim()))
        } else {
            VoiceInterpreter(model = KeywordDecisionModel())
        }

    fun markOnboardingDone() {
        prefs.edit().putBoolean("onboarded", true).putString("seen_whats_new", CURRENT_VERSION).apply()
        _phase.value = AppPhase.READY
        _selectedBabyIds.value = setOf(service.household.babyId)
        refreshAllSurfaces()
    }

    fun dismissWhatsNew() {
        prefs.edit().putString("seen_whats_new", CURRENT_VERSION).apply()
        _showWhatsNew.value = false
    }

    fun openWhatsNew() {
        _showWhatsNew.value = true
    }

    fun selectTab(tab: MainTab) {
        _currentTab.value = tab
    }

    fun clearToast() {
        _toastMessage.value = null
    }

    private fun showToast(message: String, event: LogEvent? = null) {
        _toastMessage.value = message
        _lastLoggedEvent.value = event
    }

    fun toggleNightHud() {
        val current = _nightHudOverride.value ?: false
        _nightHudOverride.value = !current
    }

    fun setNightHud(enabled: Boolean?) {
        _nightHudOverride.value = enabled
    }

    fun setThumbZone(enabled: Boolean) {
        prefs.edit().putBoolean("thumb_zone", enabled).apply()
        _thumbZone.value = enabled
    }

    fun setUseFluidOz(enabled: Boolean) {
        prefs.edit().putBoolean("use_fl_oz", enabled).apply()
        _useFluidOz.value = enabled
    }

    fun setQuickCapture(enabled: Boolean) {
        prefs.edit().putBoolean("quick_capture", enabled).apply()
        _quickCapture.value = enabled
    }

    fun setSpeechLocale(locale: String) {
        prefs.edit().putString("speech_locale", locale).apply()
        _speechLocale.value = locale
        voice.preferredLocale = locale
    }

    fun setLayaEndpoint(url: String) {
        prefs.edit().putString("laya_endpoint", url.trim()).apply()
        _layaEndpoint.value = url.trim()
        service.setInterpreter(buildInterpreter(url.trim()))
    }

    fun setTimelineDensity(density: TimelineDensity) {
        prefs.edit().putString("timeline_density", density.name).apply()
        _timelineDensity.value = density
    }

    fun updateNowLayout(layout: NowLayout) {
        prefs.edit().putString("now_layout", layout.encode()).apply()
        _nowLayout.value = layout
    }

    fun updateWatchPinned(categories: List<String>) {
        prefs.edit().putString("watch_pinned", categories.joinToString(",")).apply()
        _watchPinnedCategories.value = categories
        refreshAllSurfaces()
    }

    fun updateWatchCompassSlot(direction: TiltCompass.Direction, slot: CompassSlot) {
        val updated = _watchCompassSlots.value.toMutableMap()
        updated[direction.rawValue] = slot
        prefs.edit().putString("watch_compass", CompassSlot.encodeOverrides(updated)).apply()
        _watchCompassSlots.value = updated
        refreshAllSurfaces()
    }

    // ---- Child selection ----
    val household: Household
        get() = service.household

    val activeBabies: List<Baby>
        get() = household.active

    val shownBabies: List<Baby>
        get() {
            val active = activeBabies
            val selected = _selectedBabyIds.value
            val filtered = active.filter { it.id in selected }
            return if (filtered.isEmpty()) active.take(1) else filtered
        }

    val primaryBaby: Baby
        get() = shownBabies.firstOrNull() ?: household.firstBaby

    fun selectOnlyBaby(babyId: UUID) {
        _selectedBabyIds.value = setOf(babyId)
        refreshAllSurfaces()
    }

    fun selectAllBabies() {
        _selectedBabyIds.value = activeBabies.map { it.id }.toSet()
        refreshAllSurfaces()
    }

    fun toggleBabySelection(babyId: UUID) {
        val current = _selectedBabyIds.value.toMutableSet()
        if (current.contains(babyId) && current.size > 1) {
            current.remove(babyId)
        } else {
            current.add(babyId)
        }
        _selectedBabyIds.value = current
        refreshAllSurfaces()
    }

    // ---- Derived state helpers ----
    fun derived(babyId: UUID? = primaryBaby.id): DerivedLog =
        service.derived(baby = babyId)

    fun status(babyId: UUID = primaryBaby.id, now: Date = _nowTick.value): StatusSnapshot =
        service.status(baby = babyId, now = now)

    fun statusLine(babyId: UUID = primaryBaby.id, now: Date = _nowTick.value): String {
        val baby = household.baby(babyId)
        return status(babyId, now).line(now = now, expecting = baby?.isExpected == true)
    }

    fun formatVolume(ml: Double): String {
        return if (_useFluidOz.value) {
            val oz = ml / 29.5735
            String.format(Locale.US, "%.1f oz", oz)
        } else {
            "${ml.roundToInt()} ml"
        }
    }

    private fun bumpRevision(lastEvent: LogEvent? = null) {
        _revision.value += 1L
        refreshAllSurfaces(lastEvent)
        if (lastEvent != null && supabase.isAuthenticated) {
            viewModelScope.launch {
                try {
                    val nowSec = System.currentTimeMillis() / 1000.0
                    presence?.send(
                        event = "activity",
                        payload = kotlinx.serialization.json.buildJsonObject {
                            put("caregiver", kotlinx.serialization.json.JsonPrimitive(service.me.toString()))
                            put("kind", kotlinx.serialization.json.JsonPrimitive(lastEvent.type))
                            put("at", kotlinx.serialization.json.JsonPrimitive(nowSec))
                            put("until", kotlinx.serialization.json.JsonPrimitive(nowSec + 15.0))
                            put(
                                "babies",
                                kotlinx.serialization.json.JsonArray(
                                    listOf(kotlinx.serialization.json.JsonPrimitive(lastEvent.babyId.toString()))
                                )
                            )
                        }
                    )
                } catch (_: Exception) {
                }
                syncNow()
            }
        }
    }

    private fun refreshAllSurfaces(lastEvent: LogEvent? = null) {
        try {
            reminders.syncNotifications(service)
            Widgets.refreshAll(appContext)
            WearBridge.pushContext(
                context = appContext,
                service = service,
                selectedBabyId = primaryBaby.id,
                pinnedCategories = _watchPinnedCategories.value,
                compassSlots = _watchCompassSlots.value,
                lastEvent = lastEvent
            )
        } catch (_: Exception) {
        }
    }

    // ---- Quick Logging Actions ----
    fun quickBottle(ml: Double? = null, babyId: UUID = primaryBaby.id) {
        val e = service.quickBottle(ml = ml, baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast("Logged ${service.describe(e)}", e)
        bumpRevision(e)
    }

    fun toggleFeed(babyId: UUID = primaryBaby.id) {
        val e = service.toggleFeed(baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast(service.describe(e), e)
        bumpRevision(e)
    }

    fun finishBottle(fraction: Double? = null, consumedMl: Double? = null, contents: String? = null, babyId: UUID = primaryBaby.id) {
        val e = service.finishBottle(
            consumedFraction = fraction,
            consumedMl = consumedMl,
            contents = contents,
            baby = babyId,
            surface = Surface.PHONE
        )
        voice.hapticConfirm()
        showToast("Finished bottle · ${service.describe(e)}", e)
        bumpRevision(e)
    }

    fun startNursing(side: String, babyId: UUID = primaryBaby.id) {
        val e = service.startNursing(side = side, baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast("Started nursing ($side)", e)
        bumpRevision(e)
    }

    fun switchNursingSide(babyId: UUID = primaryBaby.id) {
        val e = service.switchNursingSide(baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast(service.describe(e), e)
        bumpRevision(e)
    }

    fun finishNursing(babyId: UUID = primaryBaby.id) {
        val e = service.finishNursing(baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast("Finished nursing", e)
        bumpRevision(e)
    }

    fun logSolids(foods: List<String>, reaction: String? = null, amount: String? = null, note: String? = null, babyId: UUID = primaryBaby.id) {
        val e = service.logSolids(
            foods = foods,
            reaction = reaction,
            amount = amount,
            note = note,
            baby = babyId,
            surface = Surface.PHONE
        )
        voice.hapticConfirm()
        showToast("Logged solids: ${foods.joinToString(", ")}", e)
        bumpRevision(e)
    }

    fun logDiaper(
        kind: String,
        stoolColor: String? = null,
        rash: Boolean = false,
        blowout: Boolean = false,
        note: String? = null,
        needsDetails: Boolean = false,
        babyId: UUID = primaryBaby.id
    ) {
        val e = service.logDiaper(
            kind = kind,
            stoolColor = stoolColor,
            rash = rash,
            blowout = blowout,
            note = note,
            baby = babyId,
            surface = Surface.PHONE,
            needsDetails = needsDetails
        )
        voice.hapticConfirm()
        showToast("Logged $kind diaper", e)
        bumpRevision(e)
    }

    fun toggleSleep(babyId: UUID = primaryBaby.id) {
        val e = service.toggleSleep(baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast(service.describe(e), e)
        bumpRevision(e)
    }

    fun logPump(
        leftMl: Double? = null,
        rightMl: Double? = null,
        totalMl: Double? = null,
        durationMinutes: Double? = null,
        storage: String? = null,
        babyId: UUID = primaryBaby.id
    ) {
        val e = service.logPump(
            leftMl = leftMl,
            rightMl = rightMl,
            totalMl = totalMl,
            durationMinutes = durationMinutes,
            storage = storage,
            baby = babyId,
            surface = Surface.PHONE
        )
        voice.hapticConfirm()
        showToast("Logged pumping · ${service.describe(e)}", e)
        bumpRevision(e)
    }

    fun logGrowth(weightKg: Double? = null, lengthCm: Double? = null, headCm: Double? = null, note: String? = null, babyId: UUID = primaryBaby.id) {
        val e = service.logGrowth(
            weightKg = weightKg,
            lengthCm = lengthCm,
            headCm = headCm,
            note = note,
            baby = babyId,
            surface = Surface.PHONE
        )
        voice.hapticConfirm()
        showToast("Logged growth measurement", e)
        bumpRevision(e)
    }

    fun logCare(
        category: String,
        fields: Map<String, FieldValue> = emptyMap(),
        babyId: UUID = primaryBaby.id
    ) {
        val e = service.logCare(
            category = category,
            fields = fields,
            baby = babyId,
            surface = Surface.PHONE
        )
        voice.hapticConfirm()
        showToast("Logged ${service.describe(e)}", e)
        bumpRevision(e)
    }

    fun startTimedActivity(category: String, babyId: UUID = primaryBaby.id) {
        val e = service.startTimedActivity(category = category, baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast("Started ${category.replace('_', ' ')}", e)
        bumpRevision(e)
    }

    fun stopTimedActivity(category: String, note: String? = null, babyId: UUID = primaryBaby.id) {
        val e = service.stopTimedActivity(category = category, note = note, baby = babyId, surface = Surface.PHONE)
        if (e != null) {
            voice.hapticConfirm()
            showToast("Finished ${service.describe(e)}", e)
            bumpRevision(e)
        }
    }

    fun logMovement(strength: String? = null, note: String? = null, babyId: UUID = primaryBaby.id) {
        val e = service.logMovement(strength = strength, note = note, baby = babyId, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast("Logged fetal movement", e)
        bumpRevision(e)
    }

    fun logKickSession(kicks: Int, durationMinutes: Int, startedAt: Date? = null, babyId: UUID = primaryBaby.id) {
        val e = service.logKickSession(
            kicks = kicks,
            durationMinutes = durationMinutes,
            startedAt = startedAt,
            baby = babyId,
            surface = Surface.PHONE
        )
        voice.hapticConfirm()
        showToast("Logged $kicks kicks in ${durationMinutes}m", e)
        bumpRevision(e)
    }

    fun toggleDuty(caregiverId: UUID?) {
        val e = service.setOnDuty(caregiver = caregiverId, surface = Surface.PHONE)
        voice.hapticConfirm()
        val name = household.caregiverName(caregiverId)
        showToast("On duty: $name", e)
        bumpRevision(e)
    }

    fun saveShiftNote(text: String) {
        val e = service.setShiftNote(text = text, surface = Surface.PHONE)
        voice.hapticConfirm()
        showToast(if (text.isBlank()) "Cleared shift note" else "Updated shift note", e)
        bumpRevision(e)
    }

    fun undoEvent(eventId: UUID) {
        val e = service.undo(id = eventId, surface = Surface.PHONE)
        voice.hapticTick()
        showToast("Undid entry", e)
        bumpRevision(e)
    }

    fun undoGroup(eventId: UUID) {
        val undone = service.undoGroup(id = eventId, surface = Surface.PHONE)
        if (undone.isNotEmpty()) {
            voice.hapticTick()
            showToast("Undid ${undone.size} entries")
            bumpRevision()
        }
    }

    fun editEvent(
        original: LogEvent,
        newType: String = original.type,
        newOccurredAt: Date = original.occurredAt,
        newFields: Map<String, FieldValue> = original.fields,
        newBabyId: UUID = original.babyId
    ) {
        val e = if (newType != original.type) {
            service.log(
                type = newType,
                fields = newFields,
                occurredAt = newOccurredAt,
                provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP),
                supersedes = original.id,
                sessionId = original.sessionId,
                baby = newBabyId
            )
        } else {
            service.edit(
                id = original.id,
                fields = newFields,
                occurredAt = newOccurredAt,
                baby = newBabyId,
                surface = Surface.PHONE
            )
        }
        voice.hapticConfirm()
        showToast("Saved changes", e)
        bumpRevision(e)
    }

    fun fillEventDetails(original: LogEvent, updatedType: String = original.type, extraFields: Map<String, FieldValue>) {
        val merged = original.fields.toMutableMap()
        merged.remove(LogEvent.NEEDS_DETAILS)
        merged.putAll(extraFields)
        editEvent(
            original = original,
            newType = updatedType,
            newOccurredAt = original.occurredAt,
            newFields = merged,
            newBabyId = original.babyId
        )
    }

    fun resolveDuplicate(flagOriginal: UUID, flagDuplicate: UUID, merge: Boolean) {
        service.resolveDuplicate(
            original = flagOriginal,
            duplicate = flagDuplicate,
            merge = merge,
            surface = Surface.PHONE
        )
        showToast(if (merge) "Merged duplicate" else "Kept both entries")
        bumpRevision()
    }

    fun resolveCaptureCandidate(captureId: UUID, index: Int) {
        val events = service.resolveCapture(id = captureId, candidate = index)
        if (events.isNotEmpty()) {
            voice.hapticConfirm()
            showToast("Confirmed: ${service.describe(events.first())}", events.first())
            bumpRevision(events.first())
        }
    }

    fun dismissCapture(captureId: UUID) {
        service.dismissCapture(captureId)
        bumpRevision()
    }

    fun openReviewSheet() {
        _reviewSheetOpen.value = true
    }

    fun closeReviewSheet() {
        _reviewSheetOpen.value = false
    }

    // ---- Voice Capture ----
    fun startVoiceCapture() {
        _listeningSheetOpen.value = true
        voice.startListening()
    }

    fun closeListeningSheet() {
        voice.cancelListening()
        _listeningSheetOpen.value = false
    }

    private fun handleVoiceTranscript(transcript: String, audioPath: String?, captureId: UUID) {
        _listeningSheetOpen.value = false
        viewModelScope.launch {
            val targetBabies = shownBabies.map { it.id }
            val result = service.processVoice(
                transcript = transcript,
                spoken = transcript,
                surface = Surface.PHONE,
                captureId = captureId,
                babies = targetBabies,
                quickCapture = _quickCapture.value
            )
            if (audioPath != null) {
                val updatedCap = result.capture.copy(audioPath = audioPath)
                store.saveCapture(updatedCap, synced = false)
            }
            if (result.events.isNotEmpty()) {
                val summary = result.events.joinToString(", ") { service.describe(it) }
                showToast("Logged: $summary", result.events.first())
                bumpRevision(result.events.first())
            } else {
                showToast("Voice note saved for review")
                _reviewSheetOpen.value = true
                bumpRevision()
            }
        }
    }

    // ---- Photos ----
    fun attachPhotoFromUri(entryId: UUID, uri: Uri, caption: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val targetEvent = store.events().firstOrNull { it.id == entryId } ?: return@launch
                val photosDir = File(appContext.filesDir, "entry-photos").apply { mkdirs() }
                val photoId = UUID.randomUUID()
                val fileName = "${photoId.uuidString()}.jpg"
                val destFile = File(photosDir, fileName)

                var takenAt = Date()
                appContext.contentResolver.openInputStream(uri)?.use { exifStream ->
                    try {
                        val exif = ExifInterface(exifStream)
                        val dt = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)
                            ?: exif.getAttribute(ExifInterface.TAG_DATETIME)
                        if (!dt.isNullOrBlank()) {
                            val fmt = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US)
                            fmt.parse(dt)?.let { takenAt = it }
                        }
                    } catch (_: Exception) {
                    }
                }

                val rawBytes = appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@launch
                val original = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size) ?: return@launch
                val maxEdge = max(original.width, original.height)
                val scaled = if (maxEdge > 2048) {
                    val ratio = 2048f / maxEdge.toFloat()
                    Bitmap.createScaledBitmap(
                        original,
                        (original.width * ratio).roundToInt().coerceAtLeast(1),
                        (original.height * ratio).roundToInt().coerceAtLeast(1),
                        true
                    )
                } else {
                    original
                }

                val out = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, 82, out)
                val jpegBytes = out.toByteArray()
                FileOutputStream(destFile).use { it.write(jpegBytes) }

                val e = service.attachPhoto(
                    id = photoId,
                    to = targetEvent,
                    width = scaled.width,
                    height = scaled.height,
                    takenAt = takenAt,
                    surface = Surface.PHONE
                )

                if (supabase.isAuthenticated) {
                    try {
                        val storageKey = "${household.id.toString().lowercase(Locale.US)}/${EntryPhoto.path(photoId)}"
                        supabase.uploadPhoto(storageKey, jpegBytes)
                    } catch (_: Exception) {
                    }
                }

                withContext(Dispatchers.Main) {
                    showToast("Photo attached", e)
                    bumpRevision(e)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    showToast("Could not attach photo: ${e.localizedMessage ?: "error"}")
                }
            }
        }
    }

    fun localPhotoFile(photo: EntryPhoto): File {
        val photosDir = File(appContext.filesDir, "entry-photos").apply { mkdirs() }
        return File(photosDir, "${photo.id.uuidString()}.jpg")
    }

    fun deletePhoto(photoEventId: UUID) {
        val e = service.undo(id = photoEventId, surface = Surface.PHONE)
        showToast("Removed photo", e)
        bumpRevision(e)
    }

    // ---- Household & Children ----
    fun saveHousehold(updated: Household) {
        service.persistHousehold(updated)
        bumpRevision()
        if (supabase.isAuthenticated) {
            viewModelScope.launch {
                try {
                    supabase.saveSettings(updated)
                } catch (_: Exception) {
                }
            }
        }
    }

    fun saveBaby(baby: Baby) {
        val current = household
        val existingIdx = current.babies.indexOfFirst { it.id == baby.id }
        val newBabies = if (existingIdx >= 0) {
            current.babies.toMutableList().apply { set(existingIdx, baby) }
        } else {
            current.babies + baby.copy(position = current.babies.size)
        }
        val next = current.copy(babies = newBabies).apply { trackMovementsIfExpecting() }
        saveHousehold(next)
        if (_selectedBabyIds.value.isEmpty()) {
            _selectedBabyIds.value = setOf(baby.id)
        }
    }

    fun deleteBaby(babyId: UUID) {
        val current = household
        if (current.babies.size <= 1) return
        val nextBabies = current.babies.filter { it.id != babyId }
        val next = current.copy(babies = nextBabies)
        saveHousehold(next)
        _selectedBabyIds.value = setOf(next.babyId)
    }

    // ---- Auth, Sync, Caregiver Pass, Glasses, MCP ----
    private fun loadSavedSession(): AuthSession? {
        val raw = prefs.getString("supabase_session", null) ?: return null
        return try {
            LogCoding.json.decodeFromString(AuthSession.serializer(), raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun persistSession(session: AuthSession?) {
        if (session == null) {
            prefs.edit().remove("supabase_session").apply()
        } else {
            val raw = LogCoding.json.encodeToString(AuthSession.serializer(), session)
            prefs.edit().putString("supabase_session", raw).apply()
        }
    }

    fun signInWithEmail(email: String, password: String, isSignUp: Boolean, displayName: String) {
        viewModelScope.launch {
            try {
                if (isSignUp) {
                    supabase.signUp(email.trim(), password)
                } else {
                    supabase.signIn(email.trim(), password)
                }
                persistSession(supabase.session)
                onAuthenticated(displayName.ifBlank { email.substringBefore("@") })
            } catch (e: Exception) {
                showToast("Sign-in failed: ${e.localizedMessage ?: "check credentials"}")
            }
        }
    }

    fun beginGoogleOAuth(): Uri {
        val (url, verifier) = supabase.oauthStart(provider = "google", redirect = "weehours://auth")
        prefs.edit().putString("pkce_verifier", verifier).apply()
        return Uri.parse(url)
    }

    fun handleDeepLink(uri: Uri) {
        when (uri.host) {
            "listen", "voice" -> {
                _currentTab.value = MainTab.NOW
                startVoiceCapture()
            }
            "now" -> {
                _currentTab.value = MainTab.NOW
            }
            "auth" -> {
                val code = uri.getQueryParameter("code")
                val verifier = prefs.getString("pkce_verifier", null)
                if (!code.isNullOrBlank() && !verifier.isNullOrBlank()) {
                    viewModelScope.launch {
                        try {
                            supabase.exchangeCode(code, verifier)
                            persistSession(supabase.session)
                            onAuthenticated("Caregiver")
                        } catch (e: Exception) {
                            showToast("OAuth failed: ${e.localizedMessage}")
                        }
                    }
                }
            }
            "pass" -> {
                val token = uri.getQueryParameter("token") ?: uri.lastPathSegment
                if (!token.isNullOrBlank()) {
                    redeemCaregiverPass(token, "Caregiver")
                }
            }
        }
    }

    private suspend fun onAuthenticated(caregiverName: String) {
        try {
            val existing = supabase.myHousehold()
            if (existing != null) {
                store.rehome(
                    household = existing.id,
                    baby = { existing.babyId },
                    caregiver = service.me to (supabase.currentUserId ?: service.me)
                )
                service.persistHousehold(existing)
            } else {
                supabase.createHousehold(h = service.household, displayName = caregiverName)
            }
            connectPresence()
            syncNow()
            markOnboardingDone()
            showToast("Signed in & synced household")
        } catch (e: Exception) {
            showToast("Signed in locally (${e.localizedMessage ?: "offline"})")
        }
    }

    fun signOut() {
        presence?.disconnect()
        presence = null
        supabase.signOut()
        persistSession(null)
        showToast("Signed out")
        bumpRevision()
    }

    fun joinByInviteCode(code: String, caregiverName: String) {
        viewModelScope.launch {
            try {
                supabase.joinHousehold(code = code.trim(), displayName = caregiverName.ifBlank { "Partner" })
                val joined = supabase.myHousehold()
                if (joined != null) {
                    service.persistHousehold(joined)
                    _selectedBabyIds.value = setOf(joined.babyId)
                }
                syncNow()
                markOnboardingDone()
                showToast("Joined household!")
            } catch (e: Exception) {
                showToast("Could not join household: ${e.localizedMessage}")
            }
        }
    }

    fun generateInviteCode() {
        viewModelScope.launch {
            try {
                val code = supabase.createInvite()
                _inviteCode.value = code
            } catch (_: Exception) {
                val fallback = UUID.randomUUID().uuidString().take(6).uppercase(Locale.US)
                _inviteCode.value = fallback
            }
        }
    }

    fun generateCaregiverPass() {
        viewModelScope.launch {
            try {
                val code = supabase.createInvite()
                _caregiverPass.value = code
            } catch (_: Exception) {
                _caregiverPass.value = UUID.randomUUID().uuidString().take(8).uppercase(Locale.US)
            }
        }
    }

    fun redeemCaregiverPass(token: String, displayName: String) {
        joinByInviteCode(token, displayName)
    }

    fun generateGlassesPairingCode() {
        viewModelScope.launch {
            try {
                val code = supabase.requestGlassesPairingCode()
                if (code != null) {
                    _glassesCode.value = code
                    return@launch
                }
            } catch (_: Exception) {
            }
            val randomSix = (100000..999999).random().toString()
            _glassesCode.value = GlassesPairingCode(
                code = randomSix,
                createdAt = Date(),
                expiresAt = Date(System.currentTimeMillis() + 10 * 60_000L)
            )
        }
    }

    fun refreshAccessTokens() {
        if (!supabase.isAuthenticated) return
        viewModelScope.launch {
            try {
                _accessTokens.value = supabase.accessTokens()
            } catch (_: Exception) {
            }
        }
    }

    fun mintAccessToken(name: String, onMinted: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val raw = supabase.createAccessToken(name = name.ifBlank { "Claude / MCP" }, scope = "read_write")
                refreshAccessTokens()
                onMinted(raw)
            } catch (_: Exception) {
                val localToken = "wh_pat_${UUID.randomUUID().uuidString().take(24)}"
                val item = AccessToken(
                    id = UUID.randomUUID(),
                    name = name.ifBlank { "Claude / MCP" },
                    scope = "read_write",
                    createdAt = Date()
                )
                _accessTokens.value = _accessTokens.value + item
                onMinted(localToken)
            }
        }
    }

    fun revokeAccessToken(id: UUID) {
        viewModelScope.launch {
            try {
                supabase.revokeAccessToken(id)
            } catch (_: Exception) {
            }
            _accessTokens.value = _accessTokens.value.filter { it.id != id }
        }
    }

    fun syncNow() {
        if (_syncInProgress.value) return
        viewModelScope.launch {
            _syncInProgress.value = true
            try {
                if (supabase.isAuthenticated) {
                    service.sync()
                    service.processRemoteCaptures()
                    try {
                        _entitlement.value = supabase.fetchEntitlement()
                    } catch (_: Exception) {
                    }
                    val allPhotos = service.derived(baby = null).allPhotos
                    for (p in allPhotos) {
                        val f = localPhotoFile(p)
                        if (!f.exists()) {
                            try {
                                val bytes = supabase.downloadPhoto(p.storageKey)
                                f.writeBytes(bytes)
                            } catch (_: Exception) {
                            }
                        }
                    }
                }
                bumpRevision()
            } catch (_: Exception) {
            } finally {
                _syncInProgress.value = false
            }
        }
    }

    private fun connectPresence() {
        presence?.disconnect()
        val ch = PresenceChannel().apply {
            onActivity = { act ->
                _partnerActivity.value = act
            }
            onChanged = {
                syncNow()
            }
        }
        ch.connect(
            household = household.id,
            url = supabase.config.url,
            anonKey = supabase.config.anonKey,
            token = supabase.session?.accessToken
        )
        presence = ch
    }

    // ---- Analytics & Export Helpers ----
    fun shiftSummary(now: Date = _nowTick.value): ShiftSummary? =
        service.derived(baby = primaryBaby.id).shiftSummary(now = now, household = household)

    fun milkStash(now: Date = _nowTick.value): MilkStash =
        service.derived(baby = null).milkStash(household = household, now = now)

    fun solidsSummary(): SolidsSummary =
        service.derived(baby = primaryBaby.id).solidsSummary()

    fun doctorVisitPack(now: Date = _nowTick.value): DoctorVisitPack =
        service.derived(baby = primaryBaby.id).doctorVisitPack(household = household, now = now)

    fun exportCsvFile(): File {
        val log = service.derived(baby = null)
        val csvText = CSVExport.csv(log = log, household = household)
        val outFile = File(appContext.cacheDir, "weehours-export.csv")
        outFile.writeText(csvText)
        return outFile
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
        presence?.disconnect()
        voice.shutdown()
        store.close()
    }
}
