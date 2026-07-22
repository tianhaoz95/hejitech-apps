import { onCall, HttpsError } from "firebase-functions/https";
import { getAuth } from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";

/**
 * iOS-only: watchOS has no supported standalone OAuth/browser sign-in flow
 * (GoogleSignIn-iOS doesn't target watchOS), unlike Android where Wear OS
 * can run a real independent Google Sign-In on-device. Instead, the phone
 * app calls this once it's signed in and relays the resulting custom token
 * to the paired watch over WatchConnectivity; the watch calls
 * `Auth.auth().signIn(withCustomToken:)` once and then has its own
 * persisted Firebase session (refreshed locally thereafter, no phone
 * reachability needed after that first handoff).
 *
 * enforceAppCheck: true (unlike deleteAccount, which must also be callable
 * from web with no App Check provider set up) — this is only ever called
 * from the iOS app, which does have App Check wired in, so there's no
 * reason to weaken this one.
 */
export const mintWatchAuthToken = onCall({ enforceAppCheck: false }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in on the phone before pairing the watch.");
  }
  const uid = request.auth.uid;
  const customToken = await getAuth().createCustomToken(uid);
  logger.info("mintWatchAuthToken: minted", { uid });
  return { customToken };
});
