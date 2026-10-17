import { onCall, HttpsError } from "firebase-functions/https";
import { auth as authV1 } from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";

/**
 * Wipes everything under users/{uid} — Firestore's entries/properties/
 * corrections/audioCaptures subcollections (recursiveDelete handles the
 * whole subtree in one call, including corrections docs a normal client
 * could never delete itself, since the Admin SDK bypasses firestore.rules
 * entirely) and every Storage object under users/{uid}/ (photos, audio).
 * Does NOT touch the Auth account itself — see deleteAccount below, which
 * calls this then deletes the Auth user as a separate, final step.
 */
async function deleteUserData(uid: string): Promise<void> {
  const firestore = getFirestore();
  await firestore.recursiveDelete(firestore.collection("users").doc(uid));

  const bucket = getStorage().bucket();
  // Resolves with zero deletions if nothing matches — not an error case.
  await bucket.deleteFiles({ prefix: `users/${uid}/` });
}

/**
 * Callable from both the Android app (Settings) and the web app (Settings) —
 * the two in-app/web-accessible deletion paths Google Play's account
 * deletion policy requires. Deletes the *caller's own* data only (uid comes
 * from the verified auth token, never a client-supplied parameter, so one
 * user can never delete another's account), then the Auth account itself.
 *
 * Deleting via the Admin SDK here — rather than the client SDK's
 * currentUser.delete() — deliberately sidesteps Firebase Auth's client-side
 * "requires a recent sign-in" restriction, which would otherwise force a
 * re-authentication step before every deletion.
 *
 * enforceAppCheck is deliberately false here, unlike parseEntry/flagRisk/
 * askAgent: this function must be callable from the web app too (see
 * web/src/pages/SettingsPage.tsx), and web has no App Check provider
 * registered yet (that needs a reCAPTCHA site key set up in the Firebase
 * console, a separate piece of work) — enforcing it here would silently
 * break every real web deletion request. Firebase Auth is the actual
 * authorization boundary for this endpoint regardless: request.auth.uid is
 * what scopes deletion to the caller's own account, and App Check's job
 * (proving the request came from a legitimate app binary, not a bot) isn't
 * the load-bearing protection for a destructive action a user takes on
 * their own data. Revisit once web App Check is set up.
 */
export const deleteAccount = onCall({ enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before deleting your account.");
  }
  const uid = request.auth.uid;

  await deleteUserData(uid);
  await getAuth().deleteUser(uid);

  logger.info("deleteAccount: completed", { uid });
  return { success: true };
});

/**
 * Safety net, not the primary path: cleans up Firestore/Storage data if a
 * user's Auth account is ever deleted some other way (directly in the
 * Firebase console, a future admin tool, etc.) — deleteAccount above already
 * does this cleanup itself as part of the normal flow, so this mostly
 * matters for deletions that don't go through it. Uses the legacy v1 trigger
 * API (firebase-functions/v1) since v2's equivalent (beforeUserDeleted) is a
 * blocking function that requires manually enabling Identity Platform
 * blocking triggers in the console — this non-blocking v1 onDelete needs no
 * extra setup beyond a normal `firebase deploy`.
 */
export const cleanupDeletedUserData = authV1.user().onDelete(async (user) => {
  await deleteUserData(user.uid);
  logger.info("cleanupDeletedUserData: completed", { uid: user.uid });
});
