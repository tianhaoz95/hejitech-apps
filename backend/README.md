# backend/

Firebase project root for Contempo (Firestore, Auth, Storage, and the Genkit
Cloud Functions). This directory *is* what `firebase` CLI commands operate
on — run them from here, not the repo root.

## First-time setup

1. **Local dev, no real project needed yet:**
   ```bash
   cd backend/functions && npm install
   cd ..
   firebase emulators:start --project demo-contempo
   ```
   `demo-<anything>` is a Firebase "demo project" — the emulators run fully
   offline against it, no real Firebase project or billing account required.
   Use this until the real project exists. Emulator UI: http://localhost:4000

2. **Once you've created the real Firebase project** (Section 8 of
   `reports/mvp-scope-v0.html` — this is happening in parallel):
   ```bash
   firebase login
   firebase use --add          # pick your project, alias it "default"
   ```
   This overwrites the placeholder in `.firebaserc`.

3. **Gemini API key for parseEntryFlow** (only needed to actually call the
   cloud model, not to start the emulators):
   ```bash
   # local dev: export it, Genkit's dev UI picks it up
   export GOOGLE_GENAI_API_KEY=your-key-here
   npx genkit start -- npm --prefix functions run build:watch

   # deployed: store it as a real secret instead
   firebase functions:secrets:set GOOGLE_GENAI_API_KEY
   ```

## Layout

```
backend/
├── firebase.json          — emulator ports, functions source dir, rules paths
├── .firebaserc             — project alias (placeholder until real project exists)
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── functions/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── genkit.ts        — the shared `ai` instance + model reference
        ├── schemas.ts        — Zod schemas shared by both flows
        ├── index.ts          — Cloud Functions entry point (onCallGenkit wrappers)
        └── flows/
            ├── parseEntry.ts  — cloud fallback for entry parsing (see file comment
            │                    for why it avoids Genkit's tools+JSON-schema conflict)
            └── flagRisk.ts    — deterministic contemporaneity/vagueness heuristics,
                                 no LLM call
```

## Data model (Firestore)

Deliberately nested under a single owner for MVP — no household/team sharing
yet (that's fast-follow, see the MVP scope report Section 5.1), so
`firestore.rules` is just "you can only touch your own subtree":

```
users/{uid}
users/{uid}/properties/{propertyId}
users/{uid}/entries/{entryId}
users/{uid}/corrections/{correctionId}   — the correction-feedback pipeline;
                                            append-only in spirit (see Section 8
                                            of the MVP report on why this gets
                                            captured from day one even unused)
```

## Known gaps, on purpose

- No `functions:config` or `.env` committed — secrets are per-developer.
- `google-services.json` for the Android app isn't here — it's platform
  config, lives in `android/app/`, and isn't committed (see that directory's
  `.gitignore`).
- SMS/Twilio isn't wired up anywhere in this backend yet — deferred out of
  MVP (Section 5.1 of the scope report).
