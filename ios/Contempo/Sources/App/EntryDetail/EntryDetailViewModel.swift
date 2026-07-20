import ContempoCore
import ContempoFirestore
import Foundation
import Observation

@Observable
@MainActor
final class EntryDetailViewModel {
    private let entryRepository = ServiceLocator.entryRepository
    private let entryId: String

    var entry: Entry?
    var isLoading = true
    var isDeleting = false
    var deleteError: String?

    init(entryId: String) {
        self.entryId = entryId
        Task {
            entry = try? await entryRepository.getEntry(entryId: entryId)
            isLoading = false
        }
    }

    func delete(onDeleted: @escaping () -> Void) {
        isDeleting = true
        deleteError = nil
        Task {
            do {
                try await entryRepository.deleteEntry(entryId: entryId)
                onDeleted()
            } catch {
                isDeleting = false
                deleteError = error.localizedDescription
            }
        }
    }

    func dismissDeleteError() {
        deleteError = nil
    }
}
