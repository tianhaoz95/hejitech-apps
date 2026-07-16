package com.hejitech.contempo.data

import android.content.Context
import com.hejitech.contempo.agent.AgentClient
import com.hejitech.contempo.agent.AudioRecorder
import com.hejitech.contempo.agent.LiteRtLlm
import com.hejitech.contempo.agent.OnDeviceLlm
import com.hejitech.contempo.agent.WhisperTranscriber
import com.hejitech.contempo.auth.AuthManager
import com.hejitech.core.data.EntryRepository
import com.hejitech.core.data.FirestoreEntryRepository
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.google.firebase.functions.functions
import com.google.firebase.storage.storage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Manual service locator instead of Hilt/Dagger — deliberate for MVP:
 * fewer moving parts, faster to read for a one-person team, easy to swap
 * for real DI later once the app has enough screens/tests to justify it.
 * Don't grow this into a general-purpose framework; if it starts hurting,
 * that's the signal to adopt Hilt, not to build more plumbing here.
 */
object ServiceLocator {
    lateinit var entryRepository: EntryRepository
        private set
    lateinit var agentClient: AgentClient
        private set
    lateinit var authManager: AuthManager
        private set
    lateinit var aiSettingsStore: AiSettingsStore
        private set
    lateinit var onDeviceLlm: OnDeviceLlm
        private set
    lateinit var audioRecorder: AudioRecorder
        private set
    lateinit var whisperTranscriber: WhisperTranscriber
        private set

    // Process-lifetime scope for cross-screen background work (currently
    // just OnDeviceLlm's status/download tracking) — same lifetime as the
    // other singletons here, never cancelled short of process death.
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    fun initialize(context: Context) {
        val auth = Firebase.auth
        entryRepository = FirestoreEntryRepository(Firebase.firestore, auth, Firebase.storage)
        aiSettingsStore = AiSettingsStore(context)
        // LiteRtLlm (Gemma 4 E2B via LiteRT-LM) is the active OnDeviceLlm —
        // see OnDeviceLlm's kdoc for why this replaced Gemini Nano/AICore
        // (GeminiNanoLlm, kept but unused). Swapping back, or to a future
        // runtime, means changing only this line.
        onDeviceLlm = LiteRtLlm(context, aiSettingsStore, appScope)
        agentClient = AgentClient(
            onDeviceLlm = onDeviceLlm,
            functions = Firebase.functions,
            inferencePreference = { aiSettingsStore.preference.value },
        )
        authManager = AuthManager(context.applicationContext)
        audioRecorder = AudioRecorder(context.applicationContext)
        whisperTranscriber = WhisperTranscriber(context.applicationContext)
    }
}
