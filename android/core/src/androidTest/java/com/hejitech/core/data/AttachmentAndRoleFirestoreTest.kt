package com.hejitech.core.data

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hejitech.core.model.Entry
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Integration tests for this session's new Attachment/Role Firestore-backed
 * features, against the real emulator — same convention as
 * FirestoreEntryRepositoryTest (not mocked, requires the emulator suite
 * running and adb-reversed, see scripts/run-android-with-emulators.sh).
 *
 * Zero prior coverage existed for Attachment or Role before this suite.
 */
@RunWith(AndroidJUnit4::class)
class AttachmentAndRoleFirestoreTest {

    private val repository = FirestoreEntryRepository(
        FirebaseEmulatorTestEnv.firestore,
        FirebaseEmulatorTestEnv.auth,
        FirebaseEmulatorTestEnv.storage,
    )

    @Before
    fun setUp() = runBlocking {
        FirebaseEmulatorTestEnv.clearFirestoreEmulatorData()
        FirebaseEmulatorTestEnv.signIn()
    }

    private fun tempFileUri(contents: String): Uri {
        val file = File.createTempFile("attachment-test", ".txt")
        file.writeText(contents)
        return Uri.fromFile(file)
    }

    @Test
    fun uploadAttachment_thenListAttachments_roundTripsExactly() = runBlocking {
        val entryId = repository.createEntry(Entry(task = "Attachment host entry"))
        val uri = tempFileUri("evidence contents")

        val uploaded = repository.uploadAttachment(
            entryId = entryId,
            localUri = uri,
            fileName = "evidence.txt",
            contentType = "text/plain",
            onProgress = {},
        )

        assertEquals("evidence.txt", uploaded.fileName)
        assertEquals("text/plain", uploaded.contentType)
        assertTrue("A freshly-uploaded attachment should have no note yet", uploaded.note.isEmpty())

        val listed = repository.listAttachments(entryId)
        assertEquals(1, listed.size)
        assertEquals(uploaded.id, listed.first().id)
        assertEquals("evidence.txt", listed.first().fileName)

        repository.deleteEntry(entryId)
    }

    @Test
    fun updateAttachmentNote_persistsAndDoesNotDisturbOtherFields() = runBlocking {
        val entryId = repository.createEntry(Entry(task = "Attachment note host entry"))
        val uri = tempFileUri("receipt contents")
        val uploaded = repository.uploadAttachment(
            entryId = entryId,
            localUri = uri,
            fileName = "receipt.pdf",
            contentType = "application/pdf",
            onProgress = {},
        )

        repository.updateAttachmentNote(entryId, uploaded.id, "Home Depot receipt for supplies")

        val listed = repository.listAttachments(entryId)
        val updated = listed.first { it.id == uploaded.id }
        assertEquals("Home Depot receipt for supplies", updated.note)
        // Everything else on the doc must be untouched by a note-only update.
        assertEquals(uploaded.fileName, updated.fileName)
        assertEquals(uploaded.contentType, updated.contentType)
        assertEquals(uploaded.storagePath, updated.storagePath)
        assertEquals(uploaded.downloadURL, updated.downloadURL)

        repository.deleteEntry(entryId)
    }

    @Test
    fun deleteAttachment_removesItFromListAttachments() = runBlocking {
        val entryId = repository.createEntry(Entry(task = "Attachment delete host entry"))
        val uri = tempFileUri("to be deleted")
        val uploaded = repository.uploadAttachment(
            entryId = entryId,
            localUri = uri,
            fileName = "delete-me.txt",
            contentType = "text/plain",
            onProgress = {},
        )
        assertEquals(1, repository.listAttachments(entryId).size)

        repository.deleteAttachment(entryId, uploaded)

        assertTrue(repository.listAttachments(entryId).isEmpty())

        repository.deleteEntry(entryId)
    }

    @Test
    fun createRole_renameRole_deleteRole_roundTripThroughObserveRoles() = runBlocking {
        val created = repository.createRole("Cleaner")
        assertEquals("Cleaner", created.name)

        val afterCreate = repository.observeRoles().first()
        assertTrue(afterCreate.any { it.id == created.id && it.name == "Cleaner" })

        repository.renameRole(created.id, "Cleaning Crew")
        val afterRename = repository.observeRoles().first()
        assertTrue(afterRename.any { it.id == created.id && it.name == "Cleaning Crew" })

        repository.deleteRole(created.id)
        val afterDelete = repository.observeRoles().first()
        assertFalse(afterDelete.any { it.id == created.id })
    }

    @Test
    fun entry_withNoRole_isOwnerHours_defaultsTrue() = runBlocking {
        val id = repository.createEntry(Entry(task = "My own hours"))

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertTrue("An entry with no role should count as the owner's own hours", fetched!!.isOwnerHours)
        assertEquals("", fetched.roleId)
        assertEquals("", fetched.roleName)

        repository.deleteEntry(id)
    }

    @Test
    fun entry_withRoleTagged_isOwnerHours_isFalse_andRoundTrips() = runBlocking {
        val role = repository.createRole("Property Manager")
        val id = repository.createEntry(Entry(task = "Property manager's hours", roleId = role.id, roleName = role.name))

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertFalse("An entry tagged with a role must not count as the owner's own hours", fetched!!.isOwnerHours)
        assertEquals(role.id, fetched.roleId)
        assertEquals("Property Manager", fetched.roleName)

        repository.deleteEntry(id)
        repository.deleteRole(role.id)
    }

    /**
     * Regression guard for the exact class of bug found this session on
     * iOS's Codable side (Entry.roleId/roleName had to be Optional there
     * because Codable synthesis doesn't apply defaults for missing keys).
     * Android's Firestore POJO mapper is documented (Entry.kt's kdoc) to
     * apply constructor defaults for missing fields instead — this proves
     * that's actually true for roleId/roleName specifically, not just
     * assumed by analogy with photoUrls/mileageCaptureMethod.
     */
    @Test
    fun entry_writtenBeforeRoleFieldsExisted_stillDecodesWithOwnerDefaults() = runBlocking {
        val id = repository.newEntryId()
        // Write a document manually with the roleId/roleName keys entirely
        // absent, simulating a real entry from before this feature shipped.
        // Every field isValidEntry requires non-optionally, so this write
        // passes rules validation — roleId/roleName are the two deliberately
        // absent, simulating a real entry from before that field existed.
        val legacyDoc = mapOf(
            "propertyId" to "",
            "propertyName" to "123 Ocean Ave",
            "task" to "Legacy entry pre-dating roles",
            "durationMinutes" to 30,
            "category" to "other",
            "status" to "confirmed",
            "source" to "manual",
            "activityDate" to com.google.firebase.Timestamp.now(),
            "loggedAt" to com.google.firebase.Timestamp.now(),
            "isVague" to false,
            "isBackfilled" to false,
            "daysLate" to 0,
            "riskReasons" to emptyList<String>(),
            "photoUrls" to emptyList<String>(),
            "inProgress" to false,
            "isTrip" to false,
            "mileageCaptureMethod" to "",
            "miles" to 0.0,
            "audioUrl" to "",
        )
        FirebaseEmulatorTestEnv.firestore
            .collection("users")
            .document(FirebaseEmulatorTestEnv.auth.currentUser!!.uid)
            .collection("entries")
            .document(id)
            .set(legacyDoc)
            .let { com.google.android.gms.tasks.Tasks.await(it) }

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertTrue(fetched!!.isOwnerHours)
        assertEquals("", fetched.roleId)
        assertEquals("", fetched.roleName)

        repository.deleteEntry(id)
    }
}
