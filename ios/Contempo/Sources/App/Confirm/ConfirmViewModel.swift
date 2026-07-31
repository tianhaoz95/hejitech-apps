import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import Foundation
import Observation

/// A stalled Firestore stream (e.g. a network hiccup) leaves the write never
/// completing — without a bound here, `isSaving`/`isSavingForLater` would
/// stay true forever with no way for the user to retry.
private let saveTimeoutSeconds: UInt64 = 10

@Observable
@MainActor
final class ConfirmViewModel {
    private let entryRepository = ServiceLocator.entryRepository
    private let photoData: Data?
    private let captureSource: CaptureSource

    // Preserved so recordCorrection can diff "what the AI said" vs "what the
    // user actually confirmed" — the correction-feedback pipeline.
    private let aiOriginalProperty: String
    private let aiOriginalTask: String
    private let aiOriginalDurationMinutes: Int
    private let aiOriginalMiles: Double
    private let aiOriginalActivityDate: Date?

    private var existingEntryTask: Task<Entry?, Never>!
    private let resolvedEntryId: String

    var property = ""
    var task = ""
    var durationMinutes = ""
    var category: EntryCategory = .other
    var miles = ""
    var activityDate: Date
    var properties: [Property] = []
    var isAddingNewProperty = false
    var newPropertyName = ""
    var roles: [ParticipantRole] = []
    /// nil = "Me" (the owner) — the implicit default for every entry.
    var selectedRoleId: String?
    var isSaving = false
    var isSavingForLater = false
    var savedSuccessfully = false
    var errorMessage: String?

    /// Which required fields are still unset — see EntryFieldValidation.
    var missingFields: [String] {
        EntryFieldValidation.missingFields(property: property, task: task, durationMinutes: Int(durationMinutes) ?? 0)
    }

    var isIncomplete: Bool { !missingFields.isEmpty }

    init(params: ConfirmParams) {
        photoData = params.photoData
        captureSource = params.captureSource
        aiOriginalProperty = params.property
        aiOriginalTask = params.task
        aiOriginalDurationMinutes = params.durationMinutes
        aiOriginalMiles = params.miles
        aiOriginalActivityDate = Self.resolveValidatedDate(params.resolvedActivityDateIso)

        property = params.property
        task = params.task
        durationMinutes = params.durationMinutes > 0 ? String(params.durationMinutes) : ""
        category = EntryCategory(firestoreValue: params.category)
        miles = params.miles > 0 ? Self.cleanString(params.miles) : ""
        activityDate = aiOriginalActivityDate ?? Date()

        let entryId = params.entryId
        resolvedEntryId = entryId.isEmpty ? entryRepository.newEntryId() : entryId
        let repository = entryRepository
        if entryId.isEmpty {
            existingEntryTask = Task { nil }
        } else {
            existingEntryTask = Task { try? await repository.getEntry(entryId: entryId) }
        }

        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeProperties() }
            )
            do {
                for try await properties in stream {
                    guard let self else { return }
                    self.properties = properties
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }

        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeRoles() }
            )
            do {
                for try await roles in stream {
                    guard let self else { return }
                    self.roles = roles
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }

        // Resuming an existing (e.g. pending) entry should reflect its
        // actual current role, even though `params` itself carries no role
        // info — a fresh entry's `existingEntryTask` resolves to nil almost
        // immediately, correctly leaving `selectedRoleId` at its "Me" default.
        Task { [weak self] in
            guard let self, let existing = await self.existingEntryTask.value else { return }
            self.selectedRoleId = existing.roleId
        }
    }

    func onRoleSelected(_ roleId: String?) {
        selectedRoleId = roleId
    }

    func onPropertySelected(_ property: Property) {
        self.property = property.name
        isAddingNewProperty = false
    }

    func onAddNewPropertyClicked() {
        isAddingNewProperty = true
        newPropertyName = ""
    }

    func onCancelAddNewProperty() {
        isAddingNewProperty = false
        newPropertyName = ""
    }

    func onConfirmNewProperty() {
        let name = newPropertyName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            let created = try? await entryRepository.createProperty(name: name)
            property = created?.name ?? name
            isAddingNewProperty = false
            newPropertyName = ""
        }
    }

    func confirm(onSaved: @escaping () -> Void) {
        let duration = Int(durationMinutes) ?? 0
        guard !property.trimmingCharacters(in: .whitespaces).isEmpty,
              !task.trimmingCharacters(in: .whitespaces).isEmpty,
              duration > 0 else {
            errorMessage = "Fill in property, task, and a duration greater than zero."
            return
        }

        isSaving = true
        errorMessage = nil
        Task {
            do {
                try await withTimeout(seconds: saveTimeoutSeconds) { [self] in
                    try await save(status: .confirmed, confirmedAt: Timestamp(date: Date()))
                }
                isSaving = false
                savedSuccessfully = true
                onSaved()
            } catch is TimeoutError {
                await resetFirestoreConnection()
                isSaving = false
                errorMessage = "Taking too long to save — check your connection and try again."
            } catch {
                isSaving = false
                errorMessage = error.localizedDescription
            }
        }
    }

    /// No validation — saves whatever's currently filled as pending_review
    /// so the user can finish it later from the Dashboard's pending badge.
    func saveForLater(onSaved: @escaping () -> Void) {
        isSavingForLater = true
        errorMessage = nil
        Task {
            do {
                try await withTimeout(seconds: saveTimeoutSeconds) { [self] in
                    try await save(status: .pendingReview, confirmedAt: nil)
                }
                isSavingForLater = false
                savedSuccessfully = true
                onSaved()
            } catch is TimeoutError {
                await resetFirestoreConnection()
                isSavingForLater = false
                errorMessage = "Taking too long to save — check your connection and try again."
            } catch {
                isSavingForLater = false
                errorMessage = error.localizedDescription
            }
        }
    }

    /// A timed-out write usually means the SDK's underlying gRPC stream is
    /// stuck. The timeout only stops *waiting* on it; toggling the network
    /// forces Firestore to tear down and reopen its connections, so the next
    /// attempt gets a fresh stream instead of queueing behind the same one.
    private func resetFirestoreConnection() async {
        let firestore = Firestore.firestore()
        try? await firestore.disableNetwork()
        try? await firestore.enableNetwork()
    }

    /// Validates the model's resolved-time guess: unparsable -> nil (caller
    /// falls back to now), future-relative-to-device-now -> clamp to now.
    private static func resolveValidatedDate(_ iso: String?) -> Date? {
        guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return nil }
        let now = Date()
        return date > now ? now : date
    }

    private func save(status: EntryStatus, confirmedAt: Timestamp?) async throws {
        let now = Timestamp(date: Date())
        let duration = Int(durationMinutes) ?? 0
        let milesValue = Double(miles) ?? 0
        let existing = await existingEntryTask.value

        let entry = Entry(
            propertyName: property,
            task: task,
            durationMinutes: duration,
            category: category.firestoreValue,
            status: status.firestoreValue,
            source: captureSource.firestoreValue,
            // Resuming a pending entry preserves its original
            // activityDate/loggedAt; a fresh capture uses whatever the user
            // confirmed in the date+time picker.
            activityDate: existing?.activityDate ?? Timestamp(date: activityDate),
            loggedAt: existing?.loggedAt ?? now,
            confirmedAt: confirmedAt,
            photoUrls: existing?.photoUrls ?? [],
            isTrip: existing?.isTrip ?? false,
            mileageCaptureMethod: existing?.mileageCaptureMethod ?? "",
            miles: milesValue,
            odometerStart: existing?.odometerStart,
            odometerEnd: existing?.odometerEnd,
            tripStartLat: existing?.tripStartLat,
            tripStartLng: existing?.tripStartLng,
            tripEndLat: existing?.tripEndLat,
            tripEndLng: existing?.tripEndLng,
            captureLat: existing?.captureLat,
            captureLng: existing?.captureLng,
            audioUrl: existing?.audioUrl ?? "",
            rawTranscript: existing?.rawTranscript ?? "",
            roleId: selectedRoleId,
            roleName: selectedRoleId.flatMap { id in roles.first { $0.id == id }?.name }
        )
        // set()-based (via updateEntry), so re-running this after a
        // timed-out attempt (same resolvedEntryId every time) overwrites the
        // same document instead of risking a duplicate.
        try await entryRepository.updateEntry(entryId: resolvedEntryId, entry: entry)
        let savedEntryId = resolvedEntryId

        // Best-effort: a failed upload shouldn't block the entry itself from
        // saving — the audit record is the text fields, the photo is
        // supporting evidence on top of it.
        if let photoData {
            _ = try? await entryRepository.attachPhoto(entryId: savedEntryId, imageData: photoData)
        }

        if !aiOriginalTask.isEmpty, aiOriginalTask != task {
            try? await entryRepository.recordCorrection(entryId: savedEntryId, fieldName: "task", aiValue: aiOriginalTask, finalValue: task)
        }
        if !aiOriginalProperty.isEmpty, aiOriginalProperty != property {
            try? await entryRepository.recordCorrection(entryId: savedEntryId, fieldName: "property", aiValue: aiOriginalProperty, finalValue: property)
        }
        if aiOriginalDurationMinutes > 0, aiOriginalDurationMinutes != duration {
            try? await entryRepository.recordCorrection(entryId: savedEntryId, fieldName: "durationMinutes", aiValue: String(aiOriginalDurationMinutes), finalValue: String(duration))
        }
        if aiOriginalMiles > 0, aiOriginalMiles != milesValue {
            try? await entryRepository.recordCorrection(entryId: savedEntryId, fieldName: "miles", aiValue: String(aiOriginalMiles), finalValue: String(milesValue))
        }
        if let aiOriginalActivityDate, aiOriginalActivityDate != activityDate {
            let formatter = ISO8601DateFormatter()
            try? await entryRepository.recordCorrection(
                entryId: savedEntryId,
                fieldName: "activityDate",
                aiValue: formatter.string(from: aiOriginalActivityDate),
                finalValue: formatter.string(from: activityDate)
            )
        }
    }

    /// "12.0" reads worse than "12" in a text field the user might not even touch.
    private static func cleanString(_ value: Double) -> String {
        value == value.rounded(.towardZero) && value == Double(Int(value)) ? String(Int(value)) : String(value)
    }
}
