// Security-rules test suite for ../firestore.rules — runs against the
// Firestore emulator via @firebase/rules-unit-testing, never a real project.
// See README.md for how to run this.
//
// This did not exist before this session despite CLAUDE.md claiming rules
// are "tested against the emulator via @firebase/rules-unit-testing before
// each rules deploy" — every rule in this file up to and including the
// roles/attachments/note-update additions had been hand-deployed with zero
// automated verification. Coverage here is deliberately focused on the
// highest-risk boundaries (cross-user isolation, and the two rules added
// this session — isValidNoteUpdate and the roles collection — rather than
// exhaustively re-testing every field on isValidEntry.

import { readFileSync } from 'node:fs';
import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';

const OWNER_UID = 'owner-user';
const OTHER_UID = 'other-user';

let testEnv;

function validEntryFields(overrides = {}) {
  return {
    propertyId: '',
    propertyName: '123 Ocean Ave',
    task: 'Cleaned unit',
    durationMinutes: 45,
    category: 'turnover',
    status: 'confirmed',
    source: 'manual',
    activityDate: Timestamp.now(),
    loggedAt: Timestamp.now(),
    isVague: false,
    isBackfilled: false,
    daysLate: 0,
    riskReasons: [],
    photoUrls: [],
    inProgress: false,
    isTrip: false,
    mileageCaptureMethod: '',
    miles: 0,
    audioUrl: '',
    ...overrides,
  };
}

function validAppFeedbackFields(overrides = {}) {
  return {
    description: 'Button overlaps the status text',
    screenshotPath: `users/${OWNER_UID}/appFeedback/report-1/screenshot.jpg`,
    appVersion: '1.2.3',
    buildNumber: '64',
    osVersion: '18.0',
    deviceModel: 'iPhone 15',
    screenName: 'Capture',
    locale: 'en-US',
    status: 'pending',
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

function validAttachmentFields(overrides = {}) {
  return {
    fileName: 'receipt.pdf',
    contentType: 'application/pdf',
    fileSize: 12345,
    storagePath: 'users/owner-user/entries/entry-1/attachments/receipt.pdf',
    downloadURL: 'https://example.com/receipt.pdf',
    uploadedAt: Timestamp.now(),
    note: '',
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-contempo-rules-test',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('cross-user isolation', () => {
  it('owner can read their own entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1`), validEntryFields());
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDoc(doc(ownerDb, `users/${OWNER_UID}/entries/entry-1`)));
  });

  it('a different signed-in user cannot read another user\'s entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1`), validEntryFields());
    });
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(otherDb, `users/${OWNER_UID}/entries/entry-1`)));
  });

  it('an unauthenticated request cannot read anyone\'s entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1`), validEntryFields());
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, `users/${OWNER_UID}/entries/entry-1`)));
  });

  it('a different signed-in user cannot write into another user\'s roles collection', async () => {
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(doc(otherDb, `users/${OWNER_UID}/roles/role-1`), {
      name: 'Cleaner',
      createdAt: Timestamp.now(),
    }));
  });
});

describe('roles collection (isValidRole)', () => {
  it('owner can create a role with a valid name', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(ownerDb, `users/${OWNER_UID}/roles/role-1`), {
      name: 'Cleaner',
      createdAt: Timestamp.now(),
    }));
  });

  it('rejects a role with an empty name', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(ownerDb, `users/${OWNER_UID}/roles/role-1`), {
      name: '',
      createdAt: Timestamp.now(),
    }));
  });

  it('rejects a role name longer than 100 characters', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(ownerDb, `users/${OWNER_UID}/roles/role-1`), {
      name: 'x'.repeat(101),
      createdAt: Timestamp.now(),
    }));
  });

  it('owner can rename (update) an existing role', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/roles/role-1`), {
        name: 'Cleaner',
        createdAt: Timestamp.now(),
      });
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(ownerDb, `users/${OWNER_UID}/roles/role-1`), { name: 'Cleaning Crew' }));
  });

  it('owner can delete a role', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/roles/role-1`), {
        name: 'Cleaner',
        createdAt: Timestamp.now(),
      });
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(deleteDoc(doc(ownerDb, `users/${OWNER_UID}/roles/role-1`)));
  });
});

describe('entries: roleId/roleName (isValidEntry)', () => {
  it('accepts an entry with no roleId/roleName at all (the "me" default)', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(ownerDb, `users/${OWNER_UID}/entries/entry-1`), validEntryFields()));
  });

  it('accepts an entry with a valid roleId/roleName', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(ownerDb, `users/${OWNER_UID}/entries/entry-1`), validEntryFields({
      roleId: 'role-1',
      roleName: 'Cleaner',
    })));
  });

  it('rejects an entry where roleId is the wrong type', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(ownerDb, `users/${OWNER_UID}/entries/entry-1`), validEntryFields({
      roleId: 12345,
    })));
  });
});

describe('attachments (isValidAttachment + isValidNoteUpdate)', () => {
  it('owner can create a valid attachment', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(
      doc(ownerDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`),
      validAttachmentFields(),
    ));
  });

  it('rejects an attachment over the 100MB size cap', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(
      doc(ownerDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`),
      validAttachmentFields({ fileSize: 104857601 }),
    ));
  });

  it('rejects an attachment missing the note field entirely', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const { note, ...withoutNote } = validAttachmentFields();
    await assertFails(setDoc(doc(ownerDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`), withoutNote));
  });

  it('owner can update JUST the note field on an existing attachment', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1/attachments/att-1`), validAttachmentFields());
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(
      doc(ownerDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`),
      { note: 'Home Depot receipt for supplies' },
    ));
  });

  /**
   * The load-bearing security property isValidNoteUpdate exists for: a note
   * update must not be usable to swap in a different storagePath/downloadURL
   * under the same doc id — that would let someone silently repoint an
   * attachment at different file content while keeping its original
   * upload timestamp/audit trail.
   */
  it('rejects an update that changes storagePath alongside the note', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1/attachments/att-1`), validAttachmentFields());
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(
      doc(ownerDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`),
      { note: 'legit-looking note', storagePath: 'users/owner-user/entries/entry-1/attachments/swapped-file.pdf' },
    ));
  });

  it('rejects an update that changes downloadURL alongside the note', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1/attachments/att-1`), validAttachmentFields());
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(
      doc(ownerDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`),
      { note: 'legit-looking note', downloadURL: 'https://example.com/different-file.pdf' },
    ));
  });

  it('a different signed-in user cannot update another user\'s attachment note', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/entries/entry-1/attachments/att-1`), validAttachmentFields());
    });
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(updateDoc(
      doc(otherDb, `users/${OWNER_UID}/entries/entry-1/attachments/att-1`),
      { note: 'not yours to edit' },
    ));
  });
});

// Backs the admin/ site's Feedback tab — isAdmin()/isValidAdminStatusUpdate
// in firestore.rules. ADMIN_UID's token carries the same admin:true custom
// claim backend/scripts/set-admin-claim.js sets for real via the Admin SDK.
describe('admin access (isAdmin / isValidAdminStatusUpdate)', () => {
  const ADMIN_UID = 'admin-user';

  it('a non-admin cannot read another user\'s appFeedback', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/appFeedback/report-1`), validAppFeedbackFields());
    });
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(otherDb, `users/${OWNER_UID}/appFeedback/report-1`)));
  });

  it('an admin can read another user\'s appFeedback', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/appFeedback/report-1`), validAppFeedbackFields());
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, `users/${OWNER_UID}/appFeedback/report-1`)));
  });

  it('an admin can read the anonymous top-level feedback collection', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'feedback/fb-1'), { message: 'Please add dark mode', createdAt: Timestamp.now() });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'feedback/fb-1')));
  });

  it('a non-admin still cannot read the anonymous feedback collection', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'feedback/fb-1'), { message: 'Please add dark mode', createdAt: Timestamp.now() });
    });
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(otherDb, 'feedback/fb-1')));
  });

  it('an admin can mark an appFeedback report triaged', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/appFeedback/report-1`), validAppFeedbackFields());
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).firestore();
    await assertSucceeds(updateDoc(
      doc(adminDb, `users/${OWNER_UID}/appFeedback/report-1`),
      { status: 'triaged', triagedAt: Timestamp.now() },
    ));
  });

  it('an admin status update cannot smuggle in changes to other fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/appFeedback/report-1`), validAppFeedbackFields());
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { admin: true }).firestore();
    await assertFails(updateDoc(
      doc(adminDb, `users/${OWNER_UID}/appFeedback/report-1`),
      { status: 'triaged', description: 'rewritten by admin' },
    ));
  });

  it('the owner (non-admin) still cannot update their own appFeedback status', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/appFeedback/report-1`), validAppFeedbackFields());
    });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(
      doc(ownerDb, `users/${OWNER_UID}/appFeedback/report-1`),
      { status: 'triaged' },
    ));
  });
});
