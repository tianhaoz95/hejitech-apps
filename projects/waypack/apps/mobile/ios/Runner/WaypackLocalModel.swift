// The offline assistant's downloadable model for iPhones without Apple Intelligence: Qwen3-1.7B
// (int4) on LiteRT-LM, the same file and settings as Android's WaypackLocalModel.kt (DECISIONS #53,
// #68). Same channel protocol as WaypackAssistant.swift, on its own channels so Dart can try Apple's
// model first and fall back to this:
//   waypack/assistant/litert         status | download | generate {id, instructions, prompt, temperature, maxTokens} | cancel {id}
//   waypack/assistant/litert/events  {id, type: text|done|error, ...} and {type: download, bytes?, total?, done?, error?}
import CryptoKit
import Flutter
import Foundation
import LiteRTLM
import UIKit

/// Qwen3's chat template (from the model file) with one change: a message's content may be a list
/// of parts, which is how LiteRT-LM's C API (used by the Swift API) passes it. The original does
/// `'\n' + message.content` and fails with "tried to use + operator on unsupported types string and
/// sequence". Single-turn and no tools, as the assistant uses it.
private let qwen3Template = #"""
  {%- for message in messages %}
  {%- if message.content is string %}{%- set content = message.content %}
  {%- else %}{%- set ns = namespace(text='') %}{%- for part in message.content %}{%- if part.type == 'text' %}{%- set ns.text = ns.text + part.text %}{%- endif %}{%- endfor %}{%- set content = ns.text %}
  {%- endif %}
  {{- '<|im_start|>' + message.role + '\n' + content + '<|im_end|>\n' }}
  {%- endfor %}
  {%- if add_generation_prompt %}{{- '<|im_start|>assistant\n' }}{%- if not enable_thinking|default(true) %}{{- '<think>\n\n</think>\n\n' }}{%- endif %}{%- endif %}
  """#

/// Loads the model once (several seconds) and frees it after a few idle minutes.
private actor ModelHost {
  private var engine: Engine?
  private var idleClose: Task<Void, Never>?
  private var busy = 0

  func conversation(modelPath: String, cacheDir: String, temperature: Double) async throws -> Conversation {
    idleClose?.cancel()
    busy += 1
    do {
      let engine = try await loaded(modelPath: modelPath, cacheDir: cacheDir)
      let sampler = try SamplerConfig(topK: 40, topP: 0.95, temperature: Float(temperature), seed: 0)
      // Qwen3 thinks out loud by default: slow, and the traveler would see it.
      return try await engine.createConversation(
        with: ConversationConfig(
          samplerConfig: sampler, thinkingConfig: ThinkingConfig(enableThinking: false), chatTemplate: qwen3Template))
    } catch {
      finished()
      throw error
    }
  }

  /// The CPU only. On iPhones the GPU (Metal) engine loads but then fails or garbles answers
  /// (LiteRT-LM #2814, #3087, #3913), and the simulator can't create it at all, so it was never
  /// what we tested.
  private func loaded(modelPath: String, cacheDir: String) async throws -> Engine {
    if let engine { return engine }
    let e = Engine(
      engineConfig: try EngineConfig(modelPath: modelPath, backend: .cpu(), maxNumTokens: 4096, cacheDir: cacheDir))
    try await e.initialize()
    engine = e
    return e
  }

  func finished() {
    busy = max(0, busy - 1)
    guard busy == 0 else { return }
    idleClose?.cancel()
    idleClose = Task {
      try? await Task.sleep(nanoseconds: 3 * 60 * 1_000_000_000)
      guard !Task.isCancelled else { return }
      self.closeIfIdle()
    }
  }

  private func closeIfIdle() {
    if busy == 0 { engine = nil }
  }
}

final class WaypackLocalModel: NSObject, FlutterStreamHandler, URLSessionDataDelegate {
  // Pinned to a Hugging Face commit so the file can't change under the hash (Apache 2.0).
  private static let url = URL(
    string:
      "https://huggingface.co/litert-community/Qwen3-1.7B/resolve/73fbc3fe8271c162a603ee66f6e7ed25b6211195/Qwen3-1.7B_dynamic_wi4b32_afp32.litertlm"
  )!
  private static let size: Int64 = 977_184_032
  private static let sha256 = "2eeffef7b51bc3e1225ea69fe7aa5f417397934b56a5b6c20cc068d6fd2c918b"
  private static let fileName = "qwen3-1.7b-int4.litertlm"
  // The model takes ~1.5 GB while answering. 6 GB iPhones (14, 15) report ~5.7 GB; 4 GB ones
  // (11–13, SE) would be stopped by iOS for using too much memory.
  private static let minRAM: UInt64 = 5_000_000_000

  private static var shared: WaypackLocalModel?
  private var sink: FlutterEventSink?
  private let host = ModelHost()
  private var tasks: [String: Task<Void, Never>] = [:]
  private var conversations: [String: Conversation] = [:]

  // Download state, touched on the URLSession delegate queue.
  private var session: URLSession?
  private var out: FileHandle?
  private var have: Int64 = 0
  private var lastReported: Int64 = 0
  /// Why the transfer was stopped on purpose, reported instead of URLSession's "cancelled".
  private var failure: String?
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  static func register(messenger: FlutterBinaryMessenger) {
    let me = WaypackLocalModel()
    shared = me
    FlutterMethodChannel(name: "waypack/assistant/litert", binaryMessenger: messenger)
      .setMethodCallHandler { call, result in me.handle(call, result) }
    FlutterEventChannel(name: "waypack/assistant/litert/events", binaryMessenger: messenger).setStreamHandler(me)
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    sink = nil
    return nil
  }

  private func send(_ event: [String: Any]) {
    DispatchQueue.main.async { self.sink?(event) }
  }

  private var dir: URL {
    let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("models", isDirectory: true)
    if !FileManager.default.fileExists(atPath: d.path) {
      try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
      // Re-downloadable, so it stays out of iCloud backups.
      var v = URLResourceValues()
      v.isExcludedFromBackup = true
      var u = d
      try? u.setResourceValues(v)
    }
    return d
  }
  private var model: URL { dir.appendingPathComponent(Self.fileName) }
  private var partial: URL { dir.appendingPathComponent(Self.fileName + ".part") }

  private func length(_ u: URL) -> Int64 {
    ((try? FileManager.default.attributesOfItem(atPath: u.path))?[.size] as? NSNumber)?.int64Value ?? 0
  }

  private func handle(_ call: FlutterMethodCall, _ result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "status":
      result(status())
    case "download":
      download()
      result(nil)
    case "generate":
      guard let id = args["id"] as? String, let prompt = args["prompt"] as? String else {
        result(FlutterError(code: "bad_args", message: "id and prompt are required", details: nil))
        return
      }
      generate(
        id: id,
        instructions: args["instructions"] as? String ?? "",
        prompt: prompt,
        temperature: args["temperature"] as? Double ?? 0.3,
        maxTokens: args["maxTokens"] as? Int ?? 350)
      result(nil)
    case "cancel":
      if let id = args["id"] as? String {
        try? conversations[id]?.cancel()
        tasks[id]?.cancel()
        tasks[id] = nil
      }
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func status() -> [String: Any] {
    let base: [String: Any] = ["engine": "litert-qwen", "bytes": Self.size]
    if length(model) == Self.size { return base.merging(["state": "available", "tools": false]) { $1 } }
    if session != nil { return base.merging(["state": "downloading"]) { $1 } }
    if ProcessInfo.processInfo.physicalMemory < Self.minRAM {
      return base.merging(["state": "unavailable", "reason": "deviceTooSmall"]) { $1 }
    }
    return base.merging(["state": "downloadable"]) { $1 }
  }

  // MARK: Download — resumable (HTTP Range), verified by SHA-256 before it's used.

  private func download() {
    guard session == nil, length(model) != Self.size else { return }
    if length(partial) > Self.size { try? FileManager.default.removeItem(at: partial) }
    have = length(partial)
    let free =
      (try? dir.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]))?
      .volumeAvailableCapacityForImportantUsage ?? Int64.max
    if free < Self.size - have + 100_000_000 {
      send(["type": "download", "error": "Not enough free space: the model needs about 1.1 GB."])
      return
    }
    if have == Self.size {
      DispatchQueue.global(qos: .userInitiated).async { self.verify() }
      return
    }
    if !FileManager.default.fileExists(atPath: partial.path) {
      FileManager.default.createFile(atPath: partial.path, contents: nil)
    }
    // A little more time if the traveler switches apps; the partial file resumes next time anyway.
    failure = nil
    backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "model-download") { [weak self] in
      guard let self, let s = self.session else { return }
      s.delegateQueue.addOperation {
        self.failure = "The download paused while Waypack was in the background. Tap Download to continue."
        s.invalidateAndCancel()
      }
    }
    let config = URLSessionConfiguration.default
    config.timeoutIntervalForRequest = 30
    let q = OperationQueue()
    q.maxConcurrentOperationCount = 1
    let s = URLSession(configuration: config, delegate: self, delegateQueue: q)
    session = s
    var req = URLRequest(url: Self.url)
    if have > 0 { req.setValue("bytes=\(have)-", forHTTPHeaderField: "Range") }
    s.dataTask(with: req).resume()
  }

  func urlSession(
    _ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    let code = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 || code == 206, let fh = try? FileHandle(forWritingTo: partial) else {
      failure = "HTTP \(code)"
      completionHandler(.cancel)
      return
    }
    if code == 200 {  // the server ignored the range: start over
      try? fh.truncate(atOffset: 0)
      have = 0
    }
    _ = try? fh.seekToEnd()
    out = fh
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    do {
      try out?.write(contentsOf: data)
    } catch {
      failure = "Couldn't save the model: \(error.localizedDescription)"
      dataTask.cancel()
      return
    }
    have += Int64(data.count)
    if have - lastReported >= 4_000_000 {
      lastReported = have
      send(["type": "download", "bytes": have, "total": Self.size])
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    try? out?.close()
    out = nil
    if let error {
      // The partial file stays, so the next try resumes.
      finishDownload(error: failure ?? error.localizedDescription)
    } else {
      verify()
    }
  }

  private func verify() {
    guard length(partial) == Self.size, (try? hash(partial)) == Self.sha256 else {
      try? FileManager.default.removeItem(at: partial)
      finishDownload(error: "the downloaded model was damaged, try again")
      return
    }
    try? FileManager.default.removeItem(at: model)
    do {
      try FileManager.default.moveItem(at: partial, to: model)
    } catch {
      finishDownload(error: error.localizedDescription)
      return
    }
    finishDownload(error: nil)
  }

  private func finishDownload(error: String?) {
    lastReported = 0
    if let error {
      send(["type": "download", "error": error])
    } else {
      send(["type": "download", "done": true, "bytes": Self.size, "total": Self.size])
    }
    // `session` and the background task belong to the main thread, like status() and download().
    DispatchQueue.main.async {
      self.session?.finishTasksAndInvalidate()
      self.session = nil
      if self.backgroundTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.backgroundTask)
        self.backgroundTask = .invalid
      }
    }
  }

  private func hash(_ u: URL) throws -> String {
    let fh = try FileHandle(forReadingFrom: u)
    defer { try? fh.close() }
    var h = SHA256()
    while let chunk = try fh.read(upToCount: 1 << 20), !chunk.isEmpty {
      autoreleasepool { h.update(data: chunk) }
    }
    return h.finalize().map { String(format: "%02x", $0) }.joined()
  }

  // MARK: Answers

  private func generate(id: String, instructions: String, prompt: String, temperature: Double, maxTokens: Int) {
    let modelPath = model.path
    let ready = length(model) == Self.size
    tasks[id] = Task { [weak self] in
      guard let self else { return }
      var text = ""
      var started = false
      do {
        guard ready else { throw NSError(domain: "waypack", code: 1, userInfo: [NSLocalizedDescriptionKey: "model not downloaded"]) }
        let conversation = try await self.host.conversation(
          modelPath: modelPath, cacheDir: NSTemporaryDirectory(), temperature: temperature)
        started = true
        await MainActor.run { self.conversations[id] = conversation }
        // This model's chat template rejects a separate system message, so the instructions go
        // first in the user's turn (as on Android).
        let body = instructions.isEmpty ? prompt : "\(instructions)\n\n\(prompt)"
        for try await chunk in conversation.sendMessageStream(Message(body), maxOutputTokens: maxTokens) {
          if Task.isCancelled { break }
          let piece = chunk.toString
          if piece.isEmpty { continue }
          text += piece
          self.send(["id": id, "type": "text", "text": Self.clean(text)])
        }
        self.send(["id": id, "type": "done", "text": Self.clean(text)])
      } catch is CancellationError {
        self.send(["id": id, "type": "done", "text": Self.clean(text)])
      } catch {
        if Task.isCancelled {
          self.send(["id": id, "type": "done", "text": Self.clean(text)])
        } else {
          NSLog("waypack litert: %@", String(describing: error))
          let d = String(describing: error).lowercased()
          let code =
            d.contains("token") || d.contains("too long") || d.contains("context") ? "context"
            : d.contains("memory") ? "busy"
            : "failed"
          self.send([
            "id": id, "type": "error", "code": code, "message": "The assistant stopped.",
            "detail": String(describing: error),
          ])
        }
      }
      if started { await self.host.finished() }
      await MainActor.run {
        self.conversations[id] = nil
        self.tasks[id] = nil
      }
    }
  }

  /// Drops an empty or unfinished thinking block if the template lets one through.
  private static func clean(_ s: String) -> String {
    var t = s.replacingOccurrences(of: "(?s)<think>.*?(</think>|$)", with: "", options: .regularExpression)
    while let f = t.first, f.isWhitespace { t.removeFirst() }
    return t
  }
}
