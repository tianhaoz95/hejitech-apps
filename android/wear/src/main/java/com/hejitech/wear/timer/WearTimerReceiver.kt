package com.hejitech.wear.timer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import com.hejitech.wear.capture.PendingCaptureSyncWorker
import com.hejitech.wear.data.WearServiceLocator

class WearTimerReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_COMPLETE_WORK_TIMER) {
            val timerStore = WearWorkTimerStore(context)
            val completed = timerStore.stopAndCompleteTimer()

            val notificationManager = WearTimerNotificationManager(context)
            notificationManager.cancelNotification()

            if (completed != null) {
                val pendingStore = WearServiceLocator.pendingCaptureStore
                val appContext = WearServiceLocator.appContext

                // Save empty wav placeholder for timed work session metadata
                val dummyWav = ByteArray(44)
                pendingStore.save(dummyWav, null, null)

                // Enqueue expedited background upload to sync with Firestore
                val request = OneTimeWorkRequestBuilder<PendingCaptureSyncWorker>()
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .build()
                WorkManager.getInstance(appContext)
                    .enqueueUniqueWork("pending-capture-upload-now", ExistingWorkPolicy.APPEND_OR_REPLACE, request)

                Toast.makeText(
                    context,
                    "Work Logged — ${completed.durationMinutes} min confirmed!",
                    Toast.LENGTH_SHORT,
                ).show()
            }
        }
    }

    companion object {
        const val ACTION_COMPLETE_WORK_TIMER = "com.hejitech.wear.ACTION_COMPLETE_WORK_TIMER"
    }
}
