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
        NoteProcessingPipeline.isAppInBackground = { UIApplication.shared.applicationState == .background }

        NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { [weak self] _ in self?.unloadModels(reason: "memory warning") }
            .store(in: &cancellables)

        pipeline.$activeProcessingCount
            .removeDuplicates()
            .sink { [weak self] count in self?.processingCountChanged(count) }
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

    private var hasWork: Bool {
        pipeline.activeProcessingCount > 0 || !pipeline.interruptedNotes.isEmpty
    }

    private var remainingCount: Int {
        NoteRepository.shared.notes.filter { $0.status.isProcessing }.count
    }

    private func processingCountChanged(_ count: Int) {
        idleUnloadTask?.cancel()
        idleUnloadTask = nil
        if count > 0 {
            updateContinuedTaskProgress()
            return
        }
        if continuedTask != nil {
            // The in-flight note finished; anything left over that isn't running yet (e.g. a note
            // that was pending Stage 2) is picked up before the task ends.
            if remainingCount > 0 {
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

    private func unloadModels(reason: String) {
        guard pipeline.activeProcessingCount == 0 || reason == "memory warning" else { return }
        print("[BackgroundProcessingManager] Unloading models (\(reason))")
        OnDeviceLLMService.shared.unloadModels()
        Task { await ASRService.shared.unload() }
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
        if BGTaskScheduler.supportedResources.contains(.gpu) {
            request.requiredResources = .gpu
        }
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
        OnDeviceLLMService.backgroundGPUGranted = BGTaskScheduler.supportedResources.contains(.gpu)
        task.progress.totalUnitCount = Int64(max(continuedTaskTotal, 1))
        task.expirationHandler = { [weak self] in
            Task { @MainActor in self?.finishContinuedTask(success: false) }
        }
        updateContinuedTaskProgress()
        if pipeline.activeProcessingCount == 0 {
            if remainingCount == 0 {
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
        task.progress.totalUnitCount = Int64(total)
        task.progress.completedUnitCount = Int64(done)
        task.updateTitle("Processing voice notes", subtitle: Self.subtitle(done: done, total: total))
    }

    private func finishContinuedTask(success: Bool) {
        OnDeviceLLMService.backgroundGPUGranted = false
        if #available(iOS 26.0, *), let task = continuedTask as? BGContinuedProcessingTask {
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
