import ContempoCore
import ContempoFirestore
import UIKit
import Observation

@Observable
@MainActor
final class FeedbackViewModel {
    private let entryRepository = ServiceLocator.entryRepository

    var description: String = ""
    var isSubmitting = false
    var submitError: String?

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
