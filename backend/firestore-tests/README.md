# Firestore rules tests

Security-rules test suite for `../firestore.rules`, using
[`@firebase/rules-unit-testing`](https://firebase.google.com/docs/rules/unit-tests).
Runs entirely against the Firestore emulator — never a real project, no
credentials needed.

This did not exist before 2026-07-25 despite `CLAUDE.md` claiming rules are
"tested against the emulator via `@firebase/rules-unit-testing` before each
rules deploy" — that sentence described an aspiration, not reality. Coverage
here is deliberately focused on the highest-risk boundaries (cross-user
isolation, and the `roles` collection / `isValidNoteUpdate` / attachment
rules added in the same session that added this test suite) rather than
exhaustively re-testing every field constraint on `isValidEntry`.

## Running

Requires the Firestore emulator running (`firebase emulators:start
--project demo-contempo` from `backend/`, or any of the
`scripts/run-*-with-emulators.sh` wrappers, which also start it) on its
default port 8080.

```bash
cd backend/firestore-tests
npm install   # first time only
npm test
```

## Adding a case

Follow the existing `describe`/`it` blocks in `rules.test.mjs`. Use
`testEnv.withSecurityRulesDisabled(...)` to seed fixture data (bypassing
rules entirely, since seeding is not what's under test), then exercise the
real rules via `testEnv.authenticatedContext(uid).firestore()` /
`testEnv.unauthenticatedContext().firestore()` with `assertSucceeds`/
`assertFails`.
