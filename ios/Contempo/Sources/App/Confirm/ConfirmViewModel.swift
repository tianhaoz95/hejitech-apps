import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import Foundation
import Observation

/// A stalled Firestore stream (e.g. a network hiccup) leaves the write never
/// completing — without a bound here, `isSaving`/`isSavingForLater` would
/// stay true forever with no way for the user to retry.
private let saveTimeoutSeconds: UInt64 = 10

/// Thrown by `saveTrip` when `handleEndTrip` unexpectedly finds nothing open
/// — surfaced via `error.localizedDescription` in `confirm`'s catch block,
/// same as every other save failure.
private struct ConfirmSaveError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

@Observable
@MainActor
final class ConfirmViewModel {
    private let entryRepository = ServiceLocator.entryRepository
    private let mileageTripCoordinator = ServiceLocator.mileageTripCoordinator
    private let agentClient = ServiceLocator.agentClient
    private let photoData: Data?
    private let captureSource: CaptureSource

    // Preserved so recordCorrection can diff "what the AI said" vs "what the
    // user actually confirmed" — the correction-feedback pipeline.
    private let aiOriginalProperty: String
    private let aiOriginalTask: String
    private let aiOriginalDurationMinutes: Int
    private let aiOriginalMiles: Double
    private let aiOriginalActivityDate: Date?
    private let aiOriginalIsTripMode: Bool
    private let aiOriginalOdometerReading: Double?
    /// "Where the user was when they captured this," threaded in from
    /// `CaptureViewModel`'s freshly-captured location (nil for a photo/text/
    /// voice capture that couldn't get a fix, or when resuming an existing
    /// entry via EntryDetail rather than a fresh capture). `save()` prefers
    /// this over the existing entry's own value — see there for why.
    private let initialCaptureLat: Double?
    private let initialCaptureLng: Double?

    private var existingEntryTask: Task<Entry?, Never>!
    private let resolvedEntryId: String

    var property = ""
    /// Re-runs `CategoryClassifier` on every edit when nothing has
    /// classified this entry yet (still `.other`, and the user hasn't
    /// manually picked a category) — see `CategoryClassifier`'s doc comment
    /// for why this only fills the gap for capture paths that skip the LLM
    /// rather than ever overriding a real LLM-inferred category.
    var task = "" {
        didSet {
            guard !categoryManuallySet, category == EntryCategory.other.firestoreValue else { return }
            if let suggested = CategoryClassifier.classify(task) {
                category = suggested.firestoreValue
            }
        }
    }
    var durationMinutes = ""
    /// A raw category value — either one of `EntryCategory`'s built-in
    /// `firestoreValue`s, or a free-form name from the user's own
    /// `users/{uid}/categories` roster (see `CustomCategory`, added in place the
    /// same way roles are — `onAddNewCategoryClicked`/`onConfirmNewCategory`
    /// below). Not typed as `EntryCategory` itself since that enum can't
    /// represent a custom value without silently collapsing it to `.other`
    /// (see `EntryCategory.init(firestoreValue:)`) — use
    /// `EntryCategory.displayName(for:)` to render this for display.
    var category: String = EntryCategory.other.firestoreValue
    var categoryManuallySet = false
    var categories: [CustomCategory] = []
    var isAddingNewCategory = false
    var newCategoryName = ""
    /// See `detectCategory()` — on-device auto-detect, available regardless
    /// of whether a category is already set (editing an existing entry
    /// always has one).
    var isDetectingCategory = false
    var categoryDetectError: String?
    var miles = ""
    var activityDate: Date
    var properties: [Property] = []
    var isAddingNewProperty = false
    var newPropertyName = ""
    var roles: [ParticipantRole] = []
    /// nil = "Me" (the owner) — the implicit default for every entry.
    var selectedRoleId: String?
    var isAddingNewRole = false
    var newRoleName = ""
    var isSaving = false
    var isSavingForLater = false
    var savedSuccessfully = false
    var errorMessage: String?

    /// Whether this photo was classified (or, after a toggle, corrected) as
    /// an odometer reading rather than work evidence — see
    /// `CaptureViewModel.processCapturedPhoto` and `onTripModeToggled`.
    /// Swaps ConfirmScreen's usual work-entry fields for a single
    /// odometer-reading field and routes `confirm` through `saveTrip`
    /// instead of the normal entry save.
    var isTripMode: Bool
    var odometerReading = ""
    /// True while a toggle is re-running the other AgentClient photo call against the held photo — see `onTripModeToggled`.
    var isReclassifying = false

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
        aiOriginalIsTripMode = params.isTripCapture
        aiOriginalOdometerReading = params.odometerReading
        initialCaptureLat = params.captureLat
        initialCaptureLng = params.captureLng

        property = params.property
        task = params.task
        durationMinutes = params.durationMinutes > 0 ? String(params.durationMinutes) : ""
        category = params.category.isEmpty ? EntryCategory.other.firestoreValue : params.category
        miles = params.miles > 0 ? Self.cleanString(params.miles) : ""
        activityDate = aiOriginalActivityDate ?? Date()
        isTripMode = params.isTripCapture
        odometerReading = params.odometerReading.map { Self.cleanString($0) } ?? ""

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

        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeCategories() }
            )
            do {
                for try await categories in stream {
                    guard let self else { return }
                    self.categories = categories
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

    func onCategoryChanged(_ value: String) {
        category = value
        categoryManuallySet = true
    }

    /// On-device auto-detect for the category picker — deliberately
    /// available regardless of what's already selected there (including
    /// when editing an already-confirmed entry, which always arrives with a
    /// real category, not just fresh captures) since it's a correctable
    /// suggestion, not a silent commit: the result just overwrites
    /// `category` the same way `onCategoryChanged` would, marking it
    /// manually set so `task`'s didSet auto-suggest won't later stomp on it.
    func detectCategory() {
        isDetectingCategory = true
        categoryDetectError = nil
        Task {
            switch await agentClient.suggestCategory(propertyName: property, task: task) {
            case .success(let detected, _):
                isDetectingCategory = false
                category = detected.firestoreValue
                categoryManuallySet = true
            case .failure(let message):
                isDetectingCategory = false
                categoryDetectError = message
            }
        }
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

    /// Lets a role be created without leaving Confirm for Settings — mirrors
    /// `onAddNewPropertyClicked`/`onConfirmNewProperty` above. Renaming/
    /// deleting a role still only happens in Settings; this is create-only.
    func onAddNewRoleClicked() {
        isAddingNewRole = true
        newRoleName = ""
    }

    func onCancelAddNewRole() {
        isAddingNewRole = false
        newRoleName = ""
    }

    func onConfirmNewRole() {
        let name = newRoleName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            let created = try? await entryRepository.createRole(name: name)
            selectedRoleId = created?.id ?? selectedRoleId
            isAddingNewRole = false
            newRoleName = ""
        }
    }

    /// Lets a category be created without leaving Confirm — mirrors
    /// `onAddNewRoleClicked`/`onConfirmNewRole` above exactly. Create-only,
    /// same as roles; there's no rename/delete UI for a category roster
    /// (only the "built-in" `EntryCategory` entries are more than a name,
    /// and even those aren't renameable).
    func onAddNewCategoryClicked() {
        isAddingNewCategory = true
        newCategoryName = ""
    }

    func onCancelAddNewCategory() {
        isAddingNewCategory = false
        newCategoryName = ""
    }

    func onConfirmNewCategory() {
        let name = newCategoryName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            let created = try? await entryRepository.createCategory(name: name)
            category = created?.name ?? name
            categoryManuallySet = true
            isAddingNewCategory = false
            newCategoryName = ""
        }
    }

    /// Flips between the two photo-capture shapes when the vision model's
    /// classification (see `AgentClient.classifyPhotoIntent`) looks wrong to
    /// the user — a one-tap fix instead of forcing a retake. Re-runs the
    /// *other* existing AgentClient photo method against the already-held
    /// photo (no new prompt) so the just-toggled-to fields are populated,
    /// not left blank.
    func onTripModeToggled(_ newValue: Bool) {
        guard newValue != isTripMode else { return }
        isTripMode = newValue
        isReclassifying = true
        Task {
            guard let photoData else {
                // No photo to re-run against — shouldn't happen (a photo
                // capture always carries photoData), but leave the
                // just-toggled-to fields blank/editable rather than getting stuck.
                isReclassifying = false
                return
            }
            if newValue {
                if case .success(let miles, _) = await agentClient.readOdometerFromPhoto(imageData: photoData) {
                    odometerReading = Self.cleanString(miles)
                }
            } else {
                if case .success(let result) = await agentClient.draftEntryFromPhoto(imageData: photoData, knownProperties: properties.map(\.name)) {
                    property = result.draft.property ?? ""
                    task = result.draft.task ?? ""
                    durationMinutes = result.draft.durationMinutes.map(String.init) ?? ""
                    category = result.draft.category ?? EntryCategory.other.firestoreValue
                }
            }
            isReclassifying = false
        }
    }

    func confirm(onSaved: @escaping () -> Void) {
        if isTripMode {
            guard let reading = Double(odometerReading), reading > 0 else {
                errorMessage = "Enter the odometer reading before continuing."
                return
            }
            isSaving = true
            errorMessage = nil
            Task {
                do {
                    try await withTimeout(seconds: saveTimeoutSeconds) { [self] in
                        try await saveTrip(reading: reading)
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
            return
        }

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
            category: category,
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
            captureLat: initialCaptureLat ?? existing?.captureLat,
            captureLng: initialCaptureLng ?? existing?.captureLng,
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

    /// Saves a photo-classified trip start/end — see `confirm`'s isTripMode
    /// branch. Re-derives open/close authoritatively at save time via
    /// `findOpenEntry` (not any state captured back when Confirm first
    /// opened, which may now be stale), same reasoning as the old
    /// `CaptureViewModel.logOdometerPhoto` had. `handleStartTrip` is safe to
    /// call even if a trip unexpectedly turns out to already be open — it
    /// auto-abandons the previous one rather than erroring.
    private func saveTrip(reading: Double) async throws {
        let openTrip = try await entryRepository.findOpenEntry(isTrip: true)
        let savedEntryId: String
        if openTrip == nil {
            let result = try await mileageTripCoordinator.handleStartTrip(
                property: nil,
                task: nil,
                category: nil,
                source: captureSource,
                startedAt: Timestamp(date: Date()),
                captureMethod: "photo",
                odometerStart: reading
            )
            guard case .started(let entryId) = result else {
                throw ConfirmSaveError(message: "Couldn't start the trip — try again.")
            }
            savedEntryId = entryId
        } else {
            guard let result = try await mileageTripCoordinator.handleEndTrip(
                endedAt: Timestamp(date: Date()),
                captureMethod: "photo",
                odometerEnd: reading
            ), case .ended(let entryId, _) = result else {
                throw ConfirmSaveError(message: "Couldn't close the trip — try again.")
            }
            savedEntryId = entryId
        }

        // Best-effort, same reasoning as save() below — the audit record is
        // the odometer reading itself, the photo is supporting evidence on
        // top of it.
        if let photoData {
            _ = try? await entryRepository.attachPhoto(entryId: savedEntryId, imageData: photoData)
        }

        if let aiOriginalOdometerReading, aiOriginalOdometerReading != reading {
            try? await entryRepository.recordCorrection(entryId: savedEntryId, fieldName: "odometerReading", aiValue: String(aiOriginalOdometerReading), finalValue: String(reading))
        }
        if aiOriginalIsTripMode != isTripMode {
            try? await entryRepository.recordCorrection(
                entryId: savedEntryId,
                fieldName: "photoIntent",
                aiValue: aiOriginalIsTripMode ? "odometer" : "work",
                finalValue: isTripMode ? "odometer" : "work"
            )
        }
    }

    /// "12.0" reads worse than "12" in a text field the user might not even touch.
    private static func cleanString(_ value: Double) -> String {
        value == value.rounded(.towardZero) && value == Double(Int(value)) ? String(Int(value)) : String(value)
    }
}
