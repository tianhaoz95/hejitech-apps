import ContempoCore
import ContempoFirestore
import UIKit
import Observation

@Observable
@MainActor
final class FeedbackViewModel {
    private let entryRepository = ServiceLocator.entryRepository
    private let audioRecorder = ServiceLocator.audioRecorder
    private let whisperTranscriber = ServiceLocator.whisperTranscriber
    private let captureLanguageStore = ServiceLocator.captureLanguageStore

    var description: String = ""
    var isSubmitting = false
    var submitError: String?

    /// On-device dictation for the description field — same
    /// record-then-transcribe pipeline (AudioRecorder + WhisperTranscriber)
    /// as Confirm's task field. Appends rather than replaces when the field
    /// already has text, same reasoning as ConfirmViewModel.stopRecordingTask.
    var isRecordingDescription = false
    var isTranscribingDescription = false

    func startRecordingDescription() async {
        guard !isRecordingDescription, await audioRecorder.hasPermission() else { return }
        submitError = nil
        do {
            try audioRecorder.start()
            isRecordingDescription = true
        } catch {
            submitError = "Couldn't start recording — try again."
        }
    }

    func stopRecordingDescription() async {
        guard isRecordingDescription else { return }
        isRecordingDescription = false
        isTranscribingDescription = true
        let samples = audioRecorder.stop()
        let rawTranscript = await whisperTranscriber.transcribe(samples: samples, language: captureLanguageStore.selected)
        guard !rawTranscript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            isTranscribingDescription = false
            submitError = "Didn't catch that — try again."
            return
        }
        if description.isEmpty {
            description = rawTranscript
        } else if description.last?.isWhitespace == true {
            description += rawTranscript
        } else {
            description += " " + rawTranscript
        }
        isTranscribingDescription = false
    }

    func submit(image: UIImage, region: FeedbackRegion?, onFinished: @escaping () -> Void) {
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            submitError = "Couldn't prepare the screenshot."
            return
        }
        isSubmitting = true
        submitError = nil

        let bundle = Bundle.main
        let appVersion = bundle.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let buildNumber = bundle.infoDictionary?["CFBundleVersion"] as? String ?? ""
        let screenName = ServiceLocator.currentScreenTracker.screenName
        let description = description

        Task { [weak self] in
            do {
                _ = try await self?.entryRepository.submitFeedback(
                    imageData: imageData,
                    region: region,
                    description: description,
                    screenName: screenName,
                    appVersion: appVersion,
                    buildNumber: buildNumber,
                    osVersion: UIDevice.current.systemVersion,
                    deviceModel: UIDevice.current.model,
                    locale: Locale.current.identifier
                )
                self?.isSubmitting = false
                onFinished()
            } catch {
                self?.isSubmitting = false
                self?.submitError = error.localizedDescription
            }
        }
    }
}
