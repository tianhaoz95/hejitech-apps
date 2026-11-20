import CryptoKit
import Foundation

/// What a note's processing has finished so far, saved as it goes so an interrupted run (the
/// app closed, killed or crashed) picks up where it stopped instead of starting over: each
/// transcribed piece of a watch recording, and each answer a Stage 2 model gave. One small JSON
/// file per note, deleted once the note is ready or failed.
///
/// Model answers are keyed by engine, prompts and token budget, so a resumed run reuses an
/// answer only for exactly the same call; every Stage 2 step that works in parts (long memos,
/// conversation reports, turn batches, the brief's parts) skips its finished parts without
/// knowing about this. A call cut off mid-answer saved nothing and runs again. A user's Re-run
/// starts fresh (the pipeline deletes the note's checkpoint first).
/// How far the step a note is on has got, in its own pieces or parts ("Cleaning up", part 4 of
/// 10), for the Pipeline tab's progress bar. `total` 0: the step can't count its parts (one
/// recording transcribed whole).
public struct ChunkProgress: Codable, Equatable, Sendable {
    public var step: String
    public var done: Int
    public var total: Int

    public init(step: String, done: Int, total: Int) {
        self.step = step
        self.done = done
        self.total = total
    }

    public var fraction: Double? {
        total > 0 ? min(1, Double(done) / Double(total)) : nil
    }
}

final class ProcessingCheckpoint: @unchecked Sendable {
    /// The checkpoint of the note being processed in this task, read by
    /// `LLMCopywriterService.StageTwoEngine`. Nil outside the pipeline (tests, a Re-run).
    @TaskLocal static var current: ProcessingCheckpoint?
    /// False inside a step's own fallback (a conversation part redone as a light cleanup), so
    /// its inner parts don't replace the step's count.
    @TaskLocal static var reportsProgress = true

    struct PieceTranscript: Codable, Equatable {
        /// Empty for a piece with no speech in it.
        var transcript: String
        /// Times from the start of the piece, not the recording.
        var segments: [TranscriptTimingSegment]
    }

    private struct Stored: Codable {
        var pieces: [String: PieceTranscript] = [:]
        var answers: [String: String] = [:]
        var progress: ChunkProgress?
    }

    let noteId: UUID
    let fileURL: URL
    private let lock = NSLock()
    private var stored: Stored
    /// Told every progress update (the pipeline publishes it for the note's view).
    var onProgress: (@Sendable (ChunkProgress) -> Void)?

    init(noteId: UUID, directory: URL) {
        self.noteId = noteId
        self.fileURL = directory.appendingPathComponent("\(noteId.uuidString).json")
        stored = (try? Data(contentsOf: fileURL)).flatMap { try? JSONDecoder().decode(Stored.self, from: $0) } ?? Stored()
    }

    /// Application Support/Checkpoints.
    static var defaultDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Checkpoints", isDirectory: true)
    }

    // MARK: Pieces

    func piece(_ name: String) -> PieceTranscript? {
        lock.withLock { stored.pieces[name] }
    }

    func record(piece name: String, _ transcript: PieceTranscript) {
        lock.withLock {
            stored.pieces[name] = transcript
            save()
        }
    }

    // MARK: Progress

    /// The last progress saved, so a note interrupted at part 4 of 10 shows that until it resumes.
    var progress: ChunkProgress? {
        lock.withLock { stored.progress }
    }

    func report(_ progress: ChunkProgress) {
        lock.withLock {
            guard stored.progress != progress else { return }
            stored.progress = progress
            save()
        }
        onProgress?(progress)
    }

    /// Reports for the note being processed in this task, if any.
    static func report(step: String, done: Int, total: Int) {
        guard reportsProgress, let current else { return }
        current.report(ChunkProgress(step: step, done: done, total: total))
    }

    // MARK: Model answers

    func answer(for key: String) -> String? {
        lock.withLock { stored.answers[key] }
    }

    func record(answer: String, for key: String) {
        lock.withLock {
            stored.answers[key] = answer
            save()
        }
    }

    var answerCount: Int { lock.withLock { stored.answers.count } }

    static func key(engine: String, system: String, user: String, maxTokens: Int) -> String {
        let digest = SHA256.hash(data: Data([engine, system, user, String(maxTokens)].joined(separator: "\u{0}").utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: Files

    func remove() {
        lock.withLock {
            stored = Stored()
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    /// Deletes the checkpoints of notes no longer being processed (finished, or deleted).
    static func prune(in directory: URL, keeping noteIds: Set<UUID>) {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.pathExtension == "json" {
            guard let id = UUID(uuidString: file.deletingPathExtension().lastPathComponent), !noteIds.contains(id) else { continue }
            try? FileManager.default.removeItem(at: file)
        }
    }

    /// Caller holds `lock`.
    private func save() {
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(stored).write(to: fileURL, options: .atomic)
        } catch {
            print("[ProcessingCheckpoint] Couldn't save the checkpoint for note \(noteId): \(error)")
        }
    }
}
