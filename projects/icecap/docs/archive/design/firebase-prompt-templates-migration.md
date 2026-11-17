# Migrating to Firebase Server-Side Prompt Templates

## Background

The extension currently stores AI prompt text in **Firebase Remote Config** so prompts can be updated without shipping a new extension version. This is a stopgap: Firebase's native server-side prompt templates (`getTemplateGenerativeModel`) achieve the same goal but keep the full prompt **server-side** (never sent to the client).

As of Firebase JS SDK v12.12.1, `getTemplateGenerativeModel` is not available for JavaScript/TypeScript — it shipped for Swift and Kotlin only. This document describes exactly what to change once it lands.

Track the release: https://firebase.google.com/support/release-notes/js

---

## What changes

### 1. `apps/extension/src/sidepanel.tsx`

**Before (Remote Config approach):**
```typescript
import { getGenerativeModel } from "firebase/ai"
import { getString } from "firebase/remote-config"
import { LOCAL_TEMPLATES, PROMPT_RC_KEYS, resolveTemplate } from "./core/aiTemplates"

// In handleAnalyze:
const model = getGenerativeModel(ai, { model: getString(remoteConfig, "gemini_model_id") })
const templateText = useEmulator
  ? LOCAL_TEMPLATES.dealSummary
  : getString(remoteConfig, PROMPT_RC_KEYS.dealSummary) || LOCAL_TEMPLATES.dealSummary
const prompt = resolveTemplate(templateText, { address, price, estimatedRent, description })
const result = await model.generateContent(prompt)

// In handleChatSend:
const model = getGenerativeModel(ai, { model: getString(remoteConfig, "gemini_model_id") })
const templateText = useEmulator
  ? LOCAL_TEMPLATES.chatAssistant
  : getString(remoteConfig, PROMPT_RC_KEYS.chatAssistant) || LOCAL_TEMPLATES.chatAssistant
const prompt = resolveTemplate(templateText, { address, price, ..., history, question })
const result = await model.generateContent(prompt)
```

**After (native template approach):**
```typescript
import { getGenerativeModel, getTemplateGenerativeModel } from "firebase/ai"
// getString, PROMPT_RC_KEYS, resolveTemplate imports can be removed once fully migrated

// In handleAnalyze:
if (useEmulator) {
  const model = getGenerativeModel(ai, { model: "gemini-nano" })
  const prompt = resolveTemplate(LOCAL_TEMPLATES.dealSummary, { address, price, estimatedRent, description })
  result = await model.generateContent(prompt)
} else {
  const model = getTemplateGenerativeModel(ai)
  result = await model.generateContent("icecap-deal-summary-v1", { address, price, estimatedRent, description })
}

// In handleChatSend:
if (useEmulator) {
  const model = getGenerativeModel(ai, { model: "gemini-nano" })
  const prompt = resolveTemplate(LOCAL_TEMPLATES.chatAssistant, { address, price, ..., history, question })
  result = await model.generateContent(prompt)
} else {
  const model = getTemplateGenerativeModel(ai)
  result = await model.generateContent("icecap-chat-assistant-v1", { address, price, ..., history, question })
}
```

The template IDs (`icecap-deal-summary-v1`, `icecap-chat-assistant-v1`) are the `id:` values already defined in `firebase/prompts/*.prompt`.

---

### 2. `scripts/upload-prompts.mjs`

The script currently writes prompt text into Remote Config. After migration, it should **also** (or **instead**) call the Firebase AI Logic REST API to create/update the server-side template.

#### Authentication

| Context | How | Status |
|---|---|---|
| CI (GitHub Actions) | `FIREBASE_SERVICE_ACCOUNT` secret → `google-github-actions/auth@v2` sets `GOOGLE_APPLICATION_CREDENTIALS` → ADC generates the token automatically | Already wired in `.github/workflows/deploy-on-release.yml` ✅ |
| Local | `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to a downloaded service account key JSON, read by `google-auth-library` | Need to download key + set env var |

**Do not use `gcloud auth print-access-token`** in the script — gcloud is not a project prerequisite and is not installed on dev machines. Use the `google-auth-library` npm package instead so the same code path works in both CI and local environments:

```javascript
import { GoogleAuth } from "google-auth-library"

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
const accessToken = await auth.getAccessToken()
// Locally: reads GOOGLE_APPLICATION_CREDENTIALS (service account key JSON)
// In CI:   reads GOOGLE_APPLICATION_CREDENTIALS set by google-github-actions/auth@v2
```

#### Local setup (one-time)
1. Go to GCP Console → IAM → Service Accounts → find `icecap-platform-firebase-adminsdk-fbsvc-*`
2. Create a new JSON key and download it (do **not** commit it)
3. Grant the service account the **Firebase AI Logic Admin** role in IAM (the Firebase Admin SDK role alone does not include this)
4. Set the env var in your shell profile:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/icecap-service-account.json"
   ```

#### CI setup (one-time)
Grant **Firebase AI Logic Admin** to the service account in the GCP IAM console. The key itself (`FIREBASE_SERVICE_ACCOUNT` secret) and the auth step are already in place.

#### Script change

Replace the Remote Config write block with a Firebase AI Logic REST call:

```javascript
import { GoogleAuth } from "google-auth-library"

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
const accessToken = await auth.getAccessToken()

for (const { id, description, rawFileContent } of templates) {
  // Try PATCH (update) first, fall back to POST (create)
  const base = `https://firebaseailogic.googleapis.com/v1beta/projects/${project}/locations/global/templates`
  let res = await fetch(`${base}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: description, content: rawFileContent }),
  })
  if (res.status === 404) {
    res = await fetch(`${base}?templateId=${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: description, content: rawFileContent }),
    })
  }
  if (!res.ok) throw new Error(`Failed to upload ${id}: ${res.status} ${await res.text()}`)
}
```

The `content` field is the full `.prompt` file text (frontmatter + body). Firebase parses the Dotprompt format server-side — model, temperature, and input schema all come from the file.

Once templates are server-side, the Remote Config parameters (`prompt_deal_summary`, `prompt_chat_assistant`) are no longer needed and can be removed from `firebase/remoteconfig.json`.

---

### 3. Cleanup after migration

Files/imports that become unused once all clients are on the new SDK:

| Item | Location | Action |
|------|----------|--------|
| `PROMPT_RC_KEYS` | `apps/extension/src/core/aiTemplates.ts` | Delete |
| `resolveTemplate` | `apps/extension/src/core/aiTemplates.ts` | Delete (keep `LOCAL_TEMPLATES` for emulator) |
| `getString` import | `apps/extension/src/sidepanel.tsx` | Remove |
| `prompt_deal_summary` param | `firebase/remoteconfig.json` | Remove |
| `prompt_chat_assistant` param | `firebase/remoteconfig.json` | Remove |
| Remote Config write logic | `scripts/upload-prompts.mjs` | Remove, keep AI Logic REST call |

`LOCAL_TEMPLATES` and the emulator branch stay — the emulator uses `GoogleAIBackend` which doesn't resolve server-side templates.

---

## Why server-side templates are better

| | Remote Config (current) | Server-side templates (target) |
|---|---|---|
| Prompt text visible to client | Yes | No |
| Model / temperature changeable without extension update | No (model still in RC) | Yes (in template frontmatter) |
| Input schema validation | Manual | Automatic (from frontmatter) |
| Firebase Console prompt editor | No | Yes (built-in test runner) |
| Works in JS SDK today | Yes | Not yet |
