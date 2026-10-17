package com.hejitech.wear.data

import android.content.Context
import com.hejitech.wear.auth.WearAuthManager
import com.hejitech.wear.capture.PendingCaptureStore
import com.hejitech.wear.capture.UploadStatsStore
import com.hejitech.wear.capture.WearAudioRecorder
import com.hejitech.core.data.AudioCaptureQueue
import com.hejitech.core.data.EntryRepository
import com.hejitech.core.data.SupabaseEntryRepository

/** Same manual-service-locator approach as app/data/ServiceLocator.kt, trimmed to this module's needs. */
object WearServiceLocator {
    // Application Context so non-Composable call sites (WearCaptureViewModel's
    // location fetch, WorkManager enqueue) don't need to be AndroidViewModels
    // — mirrors ServiceLocator.appContext on the phone side.
    lateinit var appContext: Context
        private set
    lateinit var entryRepository: EntryRepository
        private set
    lateinit var authManager: WearAuthManager
        private set
    lateinit var audioRecorder: WearAudioRecorder
        private set
    lateinit var pendingCaptureStore: PendingCaptureStore
        private set
    lateinit var audioCaptureQueue: AudioCaptureQueue
        private set
    lateinit var uploadStatsStore: UploadStatsStore
        private set

    fun initialize(context: Context) {
        appContext = context.applicationContext
        entryRepository = SupabaseEntryRepository(context.applicationContext)
        authManager = WearAuthManager(context.applicationContext)
        audioRecorder = WearAudioRecorder(context.applicationContext)
        pendingCaptureStore = PendingCaptureStore(context.applicationContext)
        audioCaptureQueue = AudioCaptureQueue()
        uploadStatsStore = UploadStatsStore(context.applicationContext)
    }
}
