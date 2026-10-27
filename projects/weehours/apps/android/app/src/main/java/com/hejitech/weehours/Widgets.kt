package com.hejitech.weehours

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.hejitech.weehours.core.StatusSnapshot
import java.io.File
import java.util.Date

object Widgets {
    fun refreshAll(context: Context) {
        val appContext = context.applicationContext
        val manager = AppWidgetManager.getInstance(appContext)
        updateStatusWidgets(appContext, manager, manager.getAppWidgetIds(ComponentName(appContext, StatusWidgetProvider::class.java)))
        updateEveryoneWidgets(appContext, manager, manager.getAppWidgetIds(ComponentName(appContext, EveryoneWidgetProvider::class.java)))
        updateSpeakWidgets(appContext, manager, manager.getAppWidgetIds(ComponentName(appContext, SpeakWidgetProvider::class.java)))
    }

    internal fun updateStatusWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
        if (ids.isEmpty()) return
        val dbFile = File(context.filesDir, "weehours.sqlite")
        var title = "Wee Hours"
        var line = "Nothing logged yet"
        if (dbFile.exists()) {
            try {
                val (store, service) = CoreBridge.openStoreAndService(context)
                store.use {
                    val baby = service.household.firstBaby
                    val snap = StatusSnapshot(service.derived(baby = baby.id), now = Date())
                    title = baby.name
                    line = snap.line(now = Date(), expecting = baby.isExpected)
                }
            } catch (_: Exception) {
            }
        }
        val pi = openPendingIntent(context, "weehours://now", 7001)
        for (id in ids) {
            val rv = RemoteViews(context.packageName, R.layout.widget_status).apply {
                setTextViewText(R.id.widget_title, title)
                setTextViewText(R.id.widget_status_line, line)
                setOnClickPendingIntent(R.id.widget_root, pi)
            }
            manager.updateAppWidget(id, rv)
        }
    }

    internal fun updateEveryoneWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
        if (ids.isEmpty()) return
        val dbFile = File(context.filesDir, "weehours.sqlite")
        var title = "Household"
        var lines = "Nothing logged yet"
        if (dbFile.exists()) {
            try {
                val (store, service) = CoreBridge.openStoreAndService(context)
                store.use {
                    val now = Date()
                    title = service.household.name
                    val summaries = service.household.active.map { baby ->
                        val snap = StatusSnapshot(service.derived(baby = baby.id), now = now)
                        "${baby.name}: ${snap.line(now = now, expecting = baby.isExpected)}"
                    }
                    if (summaries.isNotEmpty()) {
                        lines = summaries.joinToString("\n")
                    }
                }
            } catch (_: Exception) {
            }
        }
        val pi = openPendingIntent(context, "weehours://now", 7002)
        for (id in ids) {
            val rv = RemoteViews(context.packageName, R.layout.widget_everyone).apply {
                setTextViewText(R.id.widget_everyone_title, title)
                setTextViewText(R.id.widget_everyone_lines, lines)
                setOnClickPendingIntent(R.id.widget_everyone_root, pi)
            }
            manager.updateAppWidget(id, rv)
        }
    }

    internal fun updateSpeakWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
        if (ids.isEmpty()) return
        val pi = openPendingIntent(context, "weehours://listen", 7003)
        for (id in ids) {
            val rv = RemoteViews(context.packageName, R.layout.widget_speak).apply {
                setOnClickPendingIntent(R.id.widget_speak_root, pi)
            }
            manager.updateAppWidget(id, rv)
        }
    }

    private fun openPendingIntent(context: Context, uriString: String, reqCode: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(uriString)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return PendingIntent.getActivity(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

class StatusWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        Widgets.updateStatusWidgets(context, appWidgetManager, appWidgetIds)
    }
}

class EveryoneWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        Widgets.updateEveryoneWidgets(context, appWidgetManager, appWidgetIds)
    }
}

class SpeakWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        Widgets.updateSpeakWidgets(context, appWidgetManager, appWidgetIds)
    }
}
