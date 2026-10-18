import Foundation
import SQLite3

/// Local, offline-first storage. Events and captures are stored as JSON rows; everything else is
/// derived in memory (a year of logging is ~10k small rows). `synced = 0` rows form the outbox.
public protocol LogStore: Sendable {
    func append(_ event: LogEvent) throws
    func upsertRemote(_ events: [LogEvent]) throws
    func events() throws -> [LogEvent]
    func unsyncedEvents() throws -> [LogEvent]
    func markSynced(_ ids: [UUID]) throws

    func saveCapture(_ capture: Capture, synced: Bool) throws
    func captures() throws -> [Capture]
    func unsyncedCaptures() throws -> [Capture]

    func value(_ key: String) throws -> String?
    func setValue(_ value: String?, for key: String) throws
    func deleteAll() throws

    /// Moves a local-only log into a real household before its first upload: rewrites the
    /// household, child (`baby` maps each local child to one in the target household) and local
    /// caregiver id on rows that have never been synced. Rows that left the device are never
    /// touched, so the shared log stays append-only.
    func rehome(household: UUID, baby: (UUID) -> UUID, caregiver: (from: UUID, to: UUID)) throws
}

public final class SQLiteLogStore: LogStore, @unchecked Sendable {
    private var db: OpaquePointer?
    private let lock = NSLock()

    public convenience init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try self.init(path: url.path)
    }

    public init(path: String) throws {
        guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            throw StoreError.open(path)
        }
        try exec("PRAGMA journal_mode=WAL;")
        try exec("PRAGMA busy_timeout=3000;")
        try exec("""
            CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, json TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS captures (id TEXT PRIMARY KEY, json TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
            """)
    }

    public static func inMemory() throws -> SQLiteLogStore {
        try SQLiteLogStore(path: ":memory:")
    }

    deinit { sqlite3_close(db) }

    public enum StoreError: Error { case open(String), sql(String) }

    private func exec(_ sql: String) throws {
        var err: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &err) != SQLITE_OK {
            let msg = err.map { String(cString: $0) } ?? "?"
            sqlite3_free(err)
            throw StoreError.sql(msg)
        }
    }

    private func run(_ sql: String, _ binds: [String?], row: ((OpaquePointer) -> Void)? = nil) throws {
        lock.lock(); defer { lock.unlock() }
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.sql(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (i, b) in binds.enumerated() {
            if let b { sqlite3_bind_text(stmt, Int32(i + 1), b, -1, transient) } else { sqlite3_bind_null(stmt, Int32(i + 1)) }
        }
        while true {
            let rc = sqlite3_step(stmt)
            if rc == SQLITE_ROW { row?(stmt!) } else if rc == SQLITE_DONE { break } else {
                throw StoreError.sql(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    private func json<T: Encodable>(_ v: T) throws -> String { String(decoding: try LogCoding.encoder.encode(v), as: UTF8.self) }

    private func decodeRows<T: Decodable>(_ sql: String, _ type: T.Type) throws -> [T] {
        var out: [T] = []
        var bad = 0
        try run(sql, []) { stmt in
            let text = String(cString: sqlite3_column_text(stmt, 0))
            if let v = try? LogCoding.decoder.decode(T.self, from: Data(text.utf8)) { out.append(v) } else { bad += 1 }
        }
        return out
    }

    public func append(_ event: LogEvent) throws {
        // INSERT OR IGNORE: the log is append-only, a known id is never overwritten
        try run("INSERT OR IGNORE INTO events (id, json, synced) VALUES (?, ?, 0)", [event.id.uuidString, try json(event)])
    }

    public func upsertRemote(_ events: [LogEvent]) throws {
        for e in events {
            try run("INSERT INTO events (id, json, synced) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET synced = 1",
                    [e.id.uuidString, try json(e)])
        }
    }

    public func events() throws -> [LogEvent] { try decodeRows("SELECT json FROM events", LogEvent.self) }
    public func unsyncedEvents() throws -> [LogEvent] { try decodeRows("SELECT json FROM events WHERE synced = 0", LogEvent.self) }

    public func markSynced(_ ids: [UUID]) throws {
        for id in ids { try run("UPDATE events SET synced = 1 WHERE id = ?", [id.uuidString]) }
    }

    public func saveCapture(_ capture: Capture, synced: Bool) throws {
        try run("INSERT INTO captures (id, json, synced) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, synced = excluded.synced",
                [capture.id.uuidString, try json(capture), synced ? "1" : "0"])
    }

    public func captures() throws -> [Capture] { try decodeRows("SELECT json FROM captures", Capture.self) }
    public func unsyncedCaptures() throws -> [Capture] { try decodeRows("SELECT json FROM captures WHERE synced = 0", Capture.self) }

    public func value(_ key: String) throws -> String? {
        var v: String?
        try run("SELECT value FROM kv WHERE key = ?", [key]) { stmt in
            if let c = sqlite3_column_text(stmt, 0) { v = String(cString: c) }
        }
        return v
    }

    public func setValue(_ value: String?, for key: String) throws {
        try run("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value])
    }

    public func rehome(household: UUID, baby: (UUID) -> UUID, caregiver: (from: UUID, to: UUID)) throws {
        func swap(_ id: UUID) -> UUID { id == caregiver.from ? caregiver.to : id }
        for var e in try unsyncedEvents() {
            e.householdId = household
            e.babyId = baby(e.babyId)
            e.loggedBy = swap(e.loggedBy)
            if e.string("caregiver") == caregiver.from.uuidString { e.fields["caregiver"] = .string(caregiver.to.uuidString) }
            try run("UPDATE events SET json = ? WHERE id = ? AND synced = 0", [try json(e), e.id.uuidString])
        }
        for var c in try unsyncedCaptures() {
            c.householdId = household
            c.babyId = c.babyId.map(baby)
            c.loggedBy = swap(c.loggedBy)
            if let p = c.processedBy { c.processedBy = swap(p) }
            try saveCapture(c, synced: false)
        }
    }

    public func deleteAll() throws {
        lock.lock(); defer { lock.unlock() }
        try exec("DELETE FROM events; DELETE FROM captures; DELETE FROM kv;")
    }
}
