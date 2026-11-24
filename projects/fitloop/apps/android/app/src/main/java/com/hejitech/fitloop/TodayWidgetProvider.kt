package com.hejitech.fitloop

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.hejitech.fitloop.core.Day
import com.hejitech.fitloop.core.TodayResponse
import kotlin.math.roundToInt

/** Stores today's lightweight summary for the Home Screen Today widget. */
object TodayWidgetStore {
    private const val PREFS = "fitloop_widget"

    fun save(context: Context, today: TodayResponse?) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (today == null || today.state.date != Day.today()) {
            if (today == null) prefs.edit().clear().apply()
            TodayWidgetProvider.updateAll(context)
            return
        }
        val s = today.state
        val nextWorkout = s.workouts.firstOrNull { it.status == "todo" || it.status == "in_progress" }
        val nextTitle = nextWorkout?.workout?.title
            ?: s.meals.firstOrNull { it.status == "todo" }?.meal?.name
        val workoutsDone = s.workouts.count { it.status == "done" }
        val mealsDone = s.meals.count { it.status == "done" }
        prefs.edit()
            .putString("date", s.date)
            .putString("title", s.day?.title.orEmpty())
            .putInt("pct", (s.completion * 100).roundToInt().coerceIn(0, 100))
            .putInt("w_done", workoutsDone)
            .putInt("w_total", s.workouts.size)
            .putInt("m_done", mealsDone)
            .putInt("m_total", s.meals.size)
            .putString("next", nextTitle)
            .putBoolean("has_next_workout", nextWorkout != null)
            .apply()
        TodayWidgetProvider.updateAll(context)
    }
}

/** Home Screen widget showing today's workout & meal progress and what's up next. */
class TodayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) manager.updateAppWidget(id, buildViews(context))
    }

    companion object {
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val views = buildViews(context)
            for (id in ids) manager.updateAppWidget(id, views)
        }

        private fun buildViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences("fitloop_widget", Context.MODE_PRIVATE)
            val isToday = prefs.getString("date", null) == Day.today()
            val views = RemoteViews(context.packageName, R.layout.widget_today)
            val openWorkout = isToday && prefs.getBoolean("has_next_workout", false)

            if (isToday) {
                val title = prefs.getString("title", "").orEmpty().ifEmpty { "Today" }
                val pct = prefs.getInt("pct", 0)
                val wDone = prefs.getInt("w_done", 0)
                val wTotal = prefs.getInt("w_total", 0)
                val mDone = prefs.getInt("m_done", 0)
                val mTotal = prefs.getInt("m_total", 0)
                val next = prefs.getString("next", null)

                views.setTextViewText(R.id.widget_title, title)
                views.setTextViewText(R.id.widget_pct, "$pct%")
                views.setProgressBar(R.id.widget_progress, 100, pct, false)
                views.setTextViewText(R.id.widget_counts, "Workouts $wDone/$wTotal · Meals $mDone/$mTotal")
                views.setTextViewText(R.id.widget_next, if (next != null) "Up next: $next" else "All done for today")
            } else {
                views.setTextViewText(R.id.widget_title, "FitLoop")
                views.setTextViewText(R.id.widget_pct, "")
                views.setProgressBar(R.id.widget_progress, 100, 0, false)
                views.setTextViewText(R.id.widget_counts, "Today's workouts & meals")
                views.setTextViewText(R.id.widget_next, "Tap to refresh today's plan")
            }

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("fromWidget", true)
                if (openWorkout) putExtra("openWorkout", true)
            }
            val pi = PendingIntent.getActivity(
                context, 9201, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pi)
            return views
        }
    }
}
