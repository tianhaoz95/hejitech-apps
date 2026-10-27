package com.hejitech.weehours.core

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File
import java.util.UUID

interface LogStore {
    fun append(event: LogEvent)
    fun upsertRemote(events: List<LogEvent>)
    fun events(): List<LogEvent>
    fun unsyncedEvents(): List<LogEvent>
    fun markSynced(ids: List<UUID>)

    fun saveCapture(capture: Capture, synced: Boolean)
    fun captures(): List<Capture>
    fun unsyncedCaptures(): List<Capture>

    fun value(key: String): String?
    fun setValue(value: String?, key: String)
    fun deleteAll()

    fun rehome(household: UUID, baby: (UUID) -> UUID, caregiver: Pair<UUID, UUID>)
}

class InMemoryLogStore : LogStore {
    private val lock = Any()
    private data class EventRow(var event: LogEvent, var synced: Boolean)
    private data class CaptureRow(var capture: Capture, var synced: Boolean)
    private val eventMap = LinkedHashMap<UUID, EventRow>()
    private val captureMap = LinkedHashMap<UUID, CaptureRow>()
    private val kvMap = HashMap<String, String?>()

    override fun append(event: LogEvent) = synchronized(lock) {
        if (!eventMap.containsKey(event.id)) {
            eventMap[event.id] = EventRow(event.copy(fields = event.fields.toMap()), synced = false)
        }
    }

    override fun upsertRemote(events: List<LogEvent>) = synchronized(lock) {
        for (e in events) {
            val existing = eventMap[e.id]
            if (existing != null) {
                existing.synced = true
            } else {
                eventMap[e.id] = EventRow(e.copy(fields = e.fields.toMap()), synced = true)
            }
        }
    }

    override fun events(): List<LogEvent> = synchronized(lock) {
        eventMap.values.map { it.event.copy(fields = it.event.fields.toMap()) }
    }

    override fun unsyncedEvents(): List<LogEvent> = synchronized(lock) {
        eventMap.values.filter { !it.synced }.map { it.event.copy(fields = it.event.fields.toMap()) }
    }

    override fun markSynced(ids: List<UUID>) = synchronized(lock) {
        for (id in ids) {
            eventMap[id]?.synced = true
        }
    }

    override fun saveCapture(capture: Capture, synced: Boolean) = synchronized(lock) {
        captureMap[capture.id] = CaptureRow(capture.copy(), synced = synced)
    }

    override fun captures(): List<Capture> = synchronized(lock) {
        captureMap.values.map { it.capture.copy() }
    }

    override fun unsyncedCaptures(): List<Capture> = synchronized(lock) {
        captureMap.values.filter { !it.synced }.map { it.capture.copy() }
    }

    override fun value(key: String): String? = synchronized(lock) {
        kvMap[key]
    }

    override fun setValue(value: String?, key: String): Unit = synchronized(lock) {
        if (value == null) kvMap.remove(key) else kvMap[key] = value
    }

    override fun rehome(household: UUID, baby: (UUID) -> UUID, caregiver: Pair<UUID, UUID>) = synchronized(lock) {
        fun swap(id: UUID): UUID = if (id == caregiver.first) caregiver.second else id
        for (row in eventMap.values) {
            if (!row.synced) {
                val e = row.event
                val newFields = e.fields.toMutableMap()
                if (e.string("caregiver") == caregiver.first.uuidString() || e.string("caregiver") == caregiver.first.toString()) {
                    newFields["caregiver"] = FieldValue.Str(caregiver.second.uuidString())
                }
                row.event = e.copy(
                    householdId = household,
                    babyId = baby(e.babyId),
                    loggedBy = swap(e.loggedBy),
                    fields = newFields
                )
            }
        }
        for (row in captureMap.values) {
            if (!row.synced) {
                val c = row.capture
                row.capture = c.copy(
                    householdId = household,
                    babyId = c.babyId?.let(baby),
                    loggedBy = swap(c.loggedBy),
                    processedBy = c.processedBy?.let(::swap)
                )
            }
        }
    }

    override fun deleteAll() = synchronized(lock) {
        eventMap.clear()
        captureMap.clear()
        kvMap.clear()
    }
}

class SQLiteLogStore(context: Context, dbFile: File) :
    SQLiteOpenHelper(context, dbFile.absolutePath, null, 1), LogStore {

    private val lock = Any()

    init {
        dbFile.parentFile?.mkdirs()
        writableDatabase.enableWriteAheadLogging()
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, json TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);")
        db.execSQL("CREATE TABLE IF NOT EXISTS captures (id TEXT PRIMARY KEY, json TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);")
        db.execSQL("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    override fun append(event: LogEvent) = synchronized(lock) {
        val cv = ContentValues().apply {
            put("id", event.id.uuidString())
            put("json", LogCoding.json.encodeToString(LogEvent.serializer(), event))
            put("synced", 0)
        }
        writableDatabase.insertWithOnConflict("events", null, cv, SQLiteDatabase.CONFLICT_IGNORE)
        Unit
    }

    override fun upsertRemote(events: List<LogEvent>) = synchronized(lock) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (e in events) {
                db.execSQL(
                    "INSERT INTO events (id, json, synced) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET synced = 1",
                    arrayOf<Any>(e.id.uuidString(), LogCoding.json.encodeToString(LogEvent.serializer(), e))
                )
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    override fun events(): List<LogEvent> = synchronized(lock) {
        decodeEvents("SELECT json FROM events")
    }

    override fun unsyncedEvents(): List<LogEvent> = synchronized(lock) {
        decodeEvents("SELECT json FROM events WHERE synced = 0")
    }

    private fun decodeEvents(sql: String): List<LogEvent> {
        val out = mutableListOf<LogEvent>()
        readableDatabase.rawQuery(sql, null).use { cursor ->
            while (cursor.moveToNext()) {
                val text = cursor.getString(0) ?: continue
                try {
                    out.add(LogCoding.json.decodeFromString(LogEvent.serializer(), text))
                } catch (_: Exception) {}
            }
        }
        return out
    }

    override fun markSynced(ids: List<UUID>) = synchronized(lock) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (id in ids) {
                db.execSQL("UPDATE events SET synced = 1 WHERE id = ?", arrayOf<Any>(id.uuidString()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    override fun saveCapture(capture: Capture, synced: Boolean) = synchronized(lock) {
        writableDatabase.execSQL(
            "INSERT INTO captures (id, json, synced) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, synced = excluded.synced",
            arrayOf<Any>(capture.id.uuidString(), LogCoding.json.encodeToString(Capture.serializer(), capture), if (synced) 1 else 0)
        )
    }

    override fun captures(): List<Capture> = synchronized(lock) {
        decodeCaptures("SELECT json FROM captures")
    }

    override fun unsyncedCaptures(): List<Capture> = synchronized(lock) {
        decodeCaptures("SELECT json FROM captures WHERE synced = 0")
    }

    private fun decodeCaptures(sql: String): List<Capture> {
        val out = mutableListOf<Capture>()
        readableDatabase.rawQuery(sql, null).use { cursor ->
            while (cursor.moveToNext()) {
                val text = cursor.getString(0) ?: continue
                try {
                    out.add(LogCoding.json.decodeFromString(Capture.serializer(), text))
                } catch (_: Exception) {}
            }
        }
        return out
    }

    override fun value(key: String): String? = synchronized(lock) {
        readableDatabase.rawQuery("SELECT value FROM kv WHERE key = ?", arrayOf(key)).use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
        }
    }

    override fun setValue(value: String?, key: String) = synchronized(lock) {
        writableDatabase.execSQL(
            "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            arrayOf<Any?>(key, value)
        )
    }

    override fun rehome(household: UUID, baby: (UUID) -> UUID, caregiver: Pair<UUID, UUID>) = synchronized(lock) {
        fun swap(id: UUID): UUID = if (id == caregiver.first) caregiver.second else id
        val unsyncedEv = unsyncedEvents()
        for (ev in unsyncedEv) {
            val newFields = ev.fields.toMutableMap()
            if (ev.string("caregiver") == caregiver.first.uuidString() || ev.string("caregiver") == caregiver.first.toString()) {
                newFields["caregiver"] = FieldValue.Str(caregiver.second.uuidString())
            }
            val updated = ev.copy(
                householdId = household,
                babyId = baby(ev.babyId),
                loggedBy = swap(ev.loggedBy),
                fields = newFields
            )
            writableDatabase.execSQL(
                "UPDATE events SET json = ? WHERE id = ? AND synced = 0",
                arrayOf<Any>(LogCoding.json.encodeToString(LogEvent.serializer(), updated), updated.id.uuidString())
            )
        }
        val unsyncedCap = unsyncedCaptures()
        for (c in unsyncedCap) {
            val updated = c.copy(
                householdId = household,
                babyId = c.babyId?.let(baby),
                loggedBy = swap(c.loggedBy),
                processedBy = c.processedBy?.let(::swap)
            )
            saveCapture(updated, synced = false)
        }
    }

    override fun deleteAll() = synchronized(lock) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.execSQL("DELETE FROM events;")
            db.execSQL("DELETE FROM captures;")
            db.execSQL("DELETE FROM kv;")
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    companion object {
        fun inMemory(): InMemoryLogStore = InMemoryLogStore()
    }
}
