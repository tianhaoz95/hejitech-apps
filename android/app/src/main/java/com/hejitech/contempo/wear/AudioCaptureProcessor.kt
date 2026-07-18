package com.hejitech.contempo.wear

import android.util.Log
import com.hejitech.contempo.agent.EntryDraft
import com.hejitech.contempo.agent.ParseOutcome
import com.hejitech.contempo.agent.TimerIntent
import com.hejitech.contempo.agent.TimerIntentClassifier
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.audio.WavAudio
import com.hejitech.core.data.PendingAudioCapture
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryStatus
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.storage.storage
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.tasks.await

private const val TAG = "ContempoAudioProcessor"

/** Generous enough for a several-minute WAV recording. */
private const val MAX_AUDIO_BYTES = 50_000_000L

/**
 * Drains AudioCaptureQueue — audio recorded on a device that can't
 * transcribe/parse it itself (currently only the watch; the phone's own
 * live capture, see CaptureViewModel, already does this in-process and
 * never goes through this queue). For each pending capture: downloads the
 * WAV from Storage, runs it through the exact same on-device Whisper +
 * parse pipeline the phone's own capture uses, resolves start/stop timer
 * intent the same way the phone's CaptureViewModel does, and saves a real
 * Entry — with `activityDate` anchored to when the recording actually
 * happened (not now), and `captureLat`/`captureLng`/`audioUrl` carried over
 * from the queue entry. The queue doc is removed once an item is fully
 * processed (success or "nothing usable"); the audio file in Storage itself
 * is never deleted. One failing item is skipped, not fatal to the rest of
 * the backlog — it's retried on the next pass since its queue doc is left
 * in place.
 *
 * Invoked on phone app start and periodically (see MainActivity's
 * resumed-loop and PendingAudioProcessWorker) — there's no live connection
 * to wait on anymore, so this just drains whatever's currently queued.
 */
object AudioCaptureProcessor {
    suspend fun processPendingCaptures() {
        val pending = runCatching { ServiceLocator.audioCaptureQueue.listPending() }
            .getOrElse { e -> Log.e(TAG, "failed to list pending captures", e); return }
        pending.forEach { capture -> processOne(capture) }
    }

    private suspend fun processOne(capture: PendingAudioCapture) {
        val storageRef = Firebase.storage.reference.child(capture.storagePath)
        val wavBytes = runCatching { storageRef.getBytes(MAX_AUDIO_BYTES).await() }.getOrNull()
        if (wavBytes == null) {
            Log.e(TAG, "failed to download ${capture.storagePath} — leaving queued for retry")
            return
        }

        val samples = WavAudio.decode(wavBytes)
        val rawText = runCatching { ServiceLocator.whisperTranscriber.transcribe(samples) }.getOrDefault("")
        if (rawText.isBlank()) {
            // Nothing usable — matches the phone's own live-capture behavior
            // for a blank transcription. The audio itself stays in Storage
            // forever regardless; only the queue bookkeeping is done here.
            Log.d(TAG, "blank transcription for ${capture.id}")
            removeFromQueue(capture.id)
            return
        }

        val audioUrl = runCatching { storageRef.downloadUrl.await().toString() }.getOrDefault("")
        val knownProperties = runCatching {
            ServiceLocator.entryRepository.observeProperties().first().map { it.name }
        }.getOrDefault(emptyList())

        when (val outcome = ServiceLocator.agentClient.parseEntry(rawText, knownProperties)) {
            is ParseOutcome.Success -> saveFromDraft(outcome.result.draft, rawText, capture, audioUrl)
            is ParseOutcome.Failure -> saveFallback(rawText, capture, audioUrl)
        }
        removeFromQueue(capture.id)
    }

    private suspend fun saveFromDraft(draft: EntryDraft, rawText: String, capture: PendingAudioCapture, audioUrl: String) {
        // Same deterministic-first, LLM-eventType-fallback resolution as the
        // phone's own CaptureViewModel.parseAndProceed — see
        // TimerIntentClassifier's kdoc for why.
        val intent = TimerIntentClassifier.classify(rawText) ?: when (draft.eventType) {
            "start" -> TimerIntent.START
            "stop" -> TimerIntent.STOP
            else -> null
        }
        if (intent == TimerIntent.START) {
            ServiceLocator.timerEntryCoordinator.handleStart(
                property = draft.property,
                task = draft.task,
                category = draft.category,
                source = CaptureSource.VOICE,
                startedAt = capture.capturedAt,
            )
            return
        }
        if (intent == TimerIntent.STOP) {
            val stopped = ServiceLocator.timerEntryCoordinator.handleStop(
                draft.property, draft.task, capture.capturedAt, capture.lat, capture.lng,
            )
            if (stopped != null) return
            // Nothing was open to close — fall through and save as a normal entry below.
        }

        val duration = draft.durationMinutes ?: 0
        val isComplete = !draft.property.isNullOrBlank() && !draft.task.isNullOrBlank() && duration > 0
        val entry = Entry(
            propertyName = draft.property.orEmpty(),
            task = draft.task?.takeIf { it.isNotBlank() } ?: rawText,
            durationMinutes = duration,
            category = draft.category?.let { EntryCategory.fromFirestoreValue(it).firestoreValue }
                ?: EntryCategory.OTHER.firestoreValue,
            status = (if (isComplete) EntryStatus.CONFIRMED else EntryStatus.PENDING_REVIEW).firestoreValue,
            source = CaptureSource.VOICE.firestoreValue,
            activityDate = capture.capturedAt,
            loggedAt = Timestamp.now(),
            confirmedAt = if (isComplete) Timestamp.now() else null,
            miles = draft.miles ?: 0.0,
            captureLat = capture.lat,
            captureLng = capture.lng,
            audioUrl = audioUrl,
        )
        ServiceLocator.entryRepository.createEntry(entry)
    }

    /** Transcription worked but structuring didn't — still worth saving as pending_review rather than losing what was said. */
    private suspend fun saveFallback(rawText: String, capture: PendingAudioCapture, audioUrl: String) {
        val entry = Entry(
            task = rawText,
            status = EntryStatus.PENDING_REVIEW.firestoreValue,
            source = CaptureSource.VOICE.firestoreValue,
            activityDate = capture.capturedAt,
            loggedAt = Timestamp.now(),
            captureLat = capture.lat,
            captureLng = capture.lng,
            audioUrl = audioUrl,
        )
        ServiceLocator.entryRepository.createEntry(entry)
    }

    private suspend fun removeFromQueue(captureId: String) {
        runCatching { ServiceLocator.audioCaptureQueue.remove(captureId) }
            .onFailure { e -> Log.e(TAG, "failed to remove queue doc $captureId", e) }
    }
}
