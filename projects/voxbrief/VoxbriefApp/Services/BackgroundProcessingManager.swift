import BackgroundTasks
import Combine
import SwiftUI
import UIKit

/// Keeps note processing going after the user leaves the app, and gives model memory back when
/// there's nothing to process.
///
/// - **Continued processing (iOS 26+):** when the app goes to the background with notes still
///   in the pipeline, it submits a `BGContinuedProcessingTask`. The system shows its progress
///   ("Processing voice notes · 2 of 3") and keeps the app running until the queue is empty;
///   where the device supports background GPU, the task asks for it, which is the only state in
///   which `OnDeviceLLMService` generates while backgrounded. Without the GPU grant, Stage 2
///   can't run there: the pipeline leaves the note pending (`NoteProcessingPipeline.
///   isAppInBackground`) and finishes it when the app is back.
/// - **Model residency:** Lite/Flash and WhisperKit are unloaded after the queue has been idle
///   for `idleUnloadDelay`, on a memory warning, and on entering the background with nothing to
///   do, so an idle Voxbrief isn't holding hundreds of megabytes (gigabytes with Flash) and
///   isn't the first app iOS terminates.
@MainActor
final class BackgroundProcessingManager {
    static let shared = BackgroundProcessingManager()

    /// Matches `BGTaskSchedulerPermittedIdentifiers`' `$(PRODUCT_BUNDLE_IDENTIFIER).processing.*`
    /// (project.yml).
    static var taskIdentifier: String {
        (Bundle.main.bundleIdentifier ?? "com.jacksonzhou666.voxbrief.app") + ".processing.queue"
    }

    /// How long the queue stays idle before the models are unloaded. Long enough that recording
    /// a few memos in a row doesn't reload the model for each.
    static let idleUnloadDelay: Duration = .seconds(180)

    /// Settings → Processing: keep the screen from locking while notes are processing, so a long
    /// note's Stage 2 (which needs the app in the foreground) isn't stopped by auto-lock. Off by
    /// default.
    static let keepScreenOnKey = "keep_screen_on_while_processing"

    private let pipeline: NoteProcessingPipeline
    private var cancellables: Set<AnyCancellable> = []
    private var idleUnloadTask: Task<Void, Never>?
    private var didRegister = false
    /// The running `BGContinuedProcessingTask` (typed as `AnyObject` so this file builds for
    /// iOS 17), plus how many notes it started with, for its progress.
    private var continuedTask: AnyObject?
    private var continuedTaskTotal = 0

    private init(pipeline: NoteProcessingPipeline = .shared) {
        self.pipeline = pipeline
    }

    /// Called once at launch.
    func install() {
        VoxbriefNotificationDelegate.shared.install()
        // Not active counts: a generation stopped while leaving the foreground leaves its note
        // pending, to finish when the app is active again (or in a continued-processing task).
        NoteProcessingPipeline.isAppInBackground = {
            UIApplication.shared.applicationState != .active && !OnDeviceLLMService.backgroundGPUGranted
        }

        // MLX may only submit GPU work in the foreground: close the gate as the app starts to
        // leave it, before iOS revokes GPU access (see OnDeviceLLMService.gpuGate).
        // Only once the app is active: launched into the background (or prewarmed, inactive),
        // it may never see willResignActive before iOS takes the GPU.
        OnDeviceLLMService.gpuGate.setForeground(UIApplication.shared.applicationState == .active)
        NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)
            .sink { _ in
                OnDeviceLLMService.gpuGate.setForeground(false)
                // Hold the app in "inactive" (GPU still allowed) until the generation that was
                // running has stopped and its GPU work is done; it stops before its next token.
                // Bounded, so a load that won't finish can't hold the app.
                OnDeviceLLMService.gpuGate.waitUntilIdle(timeout: 2)
            }
            .store(in: &cancellables)
        NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)
            .sink { _ in OnDeviceLLMService.gpuGate.setForeground(false) }
            .store(in: &cancellables)
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                OnDeviceLLMService.gpuGate.setForeground(true)
                self?.pipeline.foregroundReturned()
                self?.resumeStoppedWork()
            }
            .store(in: &cancellables)

        // The continued-processing task shows how far the note in progress has got: the system
        // ends a task that stops reporting progress, and a long note's parts take minutes.
        pipeline.$chunkProgress
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.updateContinuedTaskProgress() }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { [weak self] _ in self?.unloadModels(reason: "memory warning") }
            .store(in: &cancellables)

        pipeline.$activeProcessingCount
            .removeDuplicates()
            .sink { [weak self] count in self?.processingCountChanged(count) }
            .store(in: &cancellables)

        // The Keep Screen On setting can change while a note is processing.
        NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.updateScreenAwake() }
            .store(in: &cancellables)

        // The Daily Brief widget's snapshot follows every note change (ticked items, new notes).
        NoteRepository.shared.$notes
            .debounce(for: .seconds(1), scheduler: RunLoop.main)
            .sink { DailyBrief.publishToWidget(notes: $0) }
            .store(in: &cancellables)

        // Notes left mid-pipeline by a quit or crash: finish them now rather than waiting for the
        // next time the app becomes active.
        Task { await pipeline.resumeInterruptedNotes() }
    }

    func scenePhaseChanged(to phase: ScenePhase) {
        switch phase {
        case .background:
            if hasWork {
                submitContinuedTaskIfPossible()
            } else {
                unloadModels(reason: "background, nothing to process")
            }
        case .inactive:
            // Submitting needs the app still in the foreground; .inactive is the last moment.
            if hasWork { submitContinuedTaskIfPossible() }
        case .active:
            DailyBriefNotifier.reschedule(notes: NoteRepository.shared.notes)
            // "Recorded today" goes stale overnight even when no note changes.
            DailyBrief.publishToWidget(notes: NoteRepository.shared.notes)
            Task { await AudioImportService.shared.importSharedInbox() }
        @unknown default:
            break
        }
    }

    /// Notes whose Stage 2 was stopped while the app was away, picked up again on return.
    private func resumeStoppedWork() {
        guard pipeline.activeProcessingCount == 0, !pipeline.interruptedNotes.isEmpty else { return }
        Task { await pipeline.resumeInterruptedNotes() }
    }

    private var hasWork: Bool {
        pipeline.activeProcessingCount > 0 || !pipeline.interruptedNotes.isEmpty
    }

    private var remainingCount: Int {
        NoteRepository.shared.notes.filter { $0.status.isProcessing }.count
    }

    /// Notes that can still move on in the background (not waiting for the app to be open
    /// because their next step needs the on-device model's GPU).
    private var runnableCount: Int {
        NoteRepository.shared.notes.filter { $0.status.isProcessing && !pipeline.waitingForForeground.contains($0.id) }.count
    }

    private func processingCountChanged(_ count: Int) {
        idleUnloadTask?.cancel()
        idleUnloadTask = nil
        updateScreenAwake()
        if count > 0 {
            updateContinuedTaskProgress()
            return
        }
        if continuedTask != nil {
            // The in-flight note finished; anything left over that isn't running yet (e.g. a note
            // that was pending Stage 2) is picked up before the task ends.
            // Only notes that can move on here: one waiting for the app to be open would be
            // picked up, stopped and deferred again, over and over.
            if runnableCount > 0 {
                updateContinuedTaskProgress()
                Task { await pipeline.resumeInterruptedNotes() }
            } else {
                finishContinuedTask(success: true)
            }
            return
        }
        if UIApplication.shared.applicationState == .background {
            unloadModels(reason: "queue empty in background")
            return
        }
        idleUnloadTask = Task { [weak self] in
            try? await Task.sleep(for: Self.idleUnloadDelay)
            guard !Task.isCancelled else { return }
            self?.unloadModels(reason: "idle")
        }
    }

    /// Disables auto-lock only while the opt-in setting is on and a note is processing, and gives
    /// it back as soon as either stops.
    private func updateScreenAwake() {
        let keepOn = UserDefaults.standard.bool(forKey: Self.keepScreenOnKey) && pipeline.activeProcessingCount > 0
        if UIApplication.shared.isIdleTimerDisabled != keepOn {
            UIApplication.shared.isIdleTimerDisabled = keepOn
        }
    }

    private func unloadModels(reason: String) {
        guard pipeline.activeProcessingCount == 0 || reason == "memory warning" else { return }
        print("[BackgroundProcessingManager] Unloading models (\(reason))")
        OnDeviceLLMService.shared.unloadModels()
        Task { await ASRService.shared.unload() }
        Task { await SpeakerDiarizationService.shared.unload() }
    }

    // MARK: - Continued processing (iOS 26+)

    private func submitContinuedTaskIfPossible() {
        guard #available(iOS 26.0, *), continuedTask == nil else { return }
        registerIfNeeded()
        let total = max(remainingCount, 1)
        let request = BGContinuedProcessingTaskRequest(
            identifier: Self.taskIdentifier,
            title: "Processing voice notes",
            subtitle: Self.subtitle(done: 0, total: total)
        )
        // Run now or not at all: queued for later, the user would no longer connect it to the
        // memo they just recorded, and the app finishes the work at next launch anyway.
        request.strategy = .fail
        // No `.gpu` resource: it needs the Background GPU Access entitlement, which Voxbrief
        // doesn't have (see OnDeviceLLMService.backgroundGPUGranted). In the background the task
        // transcribes and finds speakers; a cleanup on the on-device model waits for the app.
        do {
            try BGTaskScheduler.shared.submit(request)
            continuedTaskTotal = total
        } catch {
            print("[BackgroundProcessingManager] Continued processing not available: \(error)")
        }
    }

    @available(iOS 26.0, *)
    private func registerIfNeeded() {
        guard !didRegister else { return }
        didRegister = BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.taskIdentifier, using: nil) { task in
            guard let task = task as? BGContinuedProcessingTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Task { @MainActor in
                BackgroundProcessingManager.shared.continuedTaskStarted(task)
            }
        }
    }

    @available(iOS 26.0, *)
    private func continuedTaskStarted(_ task: BGContinuedProcessingTask) {
        continuedTask = task
        OnDeviceLLMService.backgroundGPUGranted = false
        task.progress.totalUnitCount = Int64(max(continuedTaskTotal, 1))
        task.expirationHandler = { [weak self] in
            Task { @MainActor in self?.finishContinuedTask(success: false) }
        }
        updateContinuedTaskProgress()
        if pipeline.activeProcessingCount == 0 {
            if runnableCount == 0 {
                finishContinuedTask(success: true)
            } else {
                Task { await pipeline.resumeInterruptedNotes() }
            }
        }
    }

    private func updateContinuedTaskProgress() {
        guard #available(iOS 26.0, *), let task = continuedTask as? BGContinuedProcessingTask else { return }
        let total = max(continuedTaskTotal, remainingCount, 1)
        let done = max(0, total - remainingCount)
        // Per note, 100 units, so the part a note is on moves the bar between notes.
        let partial = pipeline.chunkProgress.values.compactMap(\.fraction).max() ?? 0
        task.progress.totalUnitCount = Int64(total * 100)
        task.progress.completedUnitCount = Int64(min(total * 100, done * 100 + Int(partial * 99)))
        task.updateTitle("Processing voice notes", subtitle: Self.subtitle(done: done, total: total))
    }

    private func finishContinuedTask(success: Bool) {
        OnDeviceLLMService.backgroundGPUGranted = false
        if #available(iOS 26.0, *), let task = continuedTask as? BGContinuedProcessingTask {
            if success, !pipeline.waitingForForeground.isEmpty {
                task.updateTitle("Voice notes waiting", subtitle: "Finishes when you open Voxbrief")
            }
            task.progress.completedUnitCount = task.progress.totalUnitCount
            task.setTaskCompleted(success: success)
        }
        continuedTask = nil
        continuedTaskTotal = 0
        if UIApplication.shared.applicationState == .background {
            unloadModels(reason: "continued task ended")
        }
    }

    private static func subtitle(done: Int, total: Int) -> String {
        total == 1 ? "1 note" : "\(min(done + 1, total)) of \(total) notes"
    }
}
