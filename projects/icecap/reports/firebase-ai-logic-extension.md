# Firebase AI Logic in the Icecap Chrome Extension

How to call Gemini models directly from the extension sidepanel using the Firebase AI Logic SDK, instead of proxying through a Cloud Function.

---

## When to use this vs. the existing Cloud Function

| Use case | Approach |
|---|---|
| Full AI Deal Summary (red flags, recommendation) | Keep using `analyzeProperty` Cloud Function |
| Lightweight, on-demand prompts from the sidepanel | Firebase AI Logic (direct) |
| Anything that needs server-side secrets or quota enforcement | Keep using Cloud Functions |

The Cloud Function is safer for production features because the Gemini API key never leaves the server. Use Firebase AI Logic when you want lower-latency, simpler calls and are willing to configure App Check to protect the key.

---

## Prerequisites

### 1. Enable the Generative Language API in Google Cloud

Go to the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Enable APIs** → search for **Generative Language API** and enable it for your project (`icecap-platform`).

### 2. Enable Firebase AI Logic in the Firebase Console

In the [Firebase Console](https://console.firebase.google.com/) → select `icecap-platform` → **Build** → **AI Logic** → click **Get started**. Choose **Gemini Developer API** (uses an API key, simpler) or **Vertex AI** (uses your Google Cloud project, more enterprise).

### 3. Set up Firebase App Check (required before shipping)

Without App Check, anyone who unpacks the extension can extract the API key and drain your quota.

1. Firebase Console → **App Check** → **Register app**
2. For a Chrome extension, use the **reCAPTCHA v3** or **Debug provider** attestation
3. Enable enforcement for the **Generative Language API**

See the [App Check docs for extensions](https://firebase.google.com/docs/app-check) for the full setup. During local development you can use the **debug token** provider.

---

## Installation

```bash
pnpm --filter @icecap/extension add firebase@latest
```

The `firebase/ai` module ships with Firebase JS SDK v10.13+. The project already uses v11, so no version change is needed — just import from the new subpackage.

---

## Code changes

### Step 1 — Initialize the AI instance in `firebase.ts`

Add the following after the existing Firebase app setup in `apps/extension/src/core/firebase.ts`:

```typescript
import { getAI, GoogleAIBackend } from "firebase/ai"

// Add after the existing `const functions = getFunctions(app)` line:
export const ai = getAI(app, { backend: new GoogleAIBackend() })
```

If you want to use **Vertex AI** instead of the Gemini Developer API, swap the backend:

```typescript
import { getAI, VertexAIBackend } from "firebase/ai"
export const ai = getAI(app, { backend: new VertexAIBackend() })
```

The rest of the code is identical regardless of which backend you choose.

### Step 2 — Call Gemini from the sidepanel

In `apps/extension/src/sidepanel.tsx`, import the AI instance and model factory:

```typescript
import { getGenerativeModel } from "firebase/ai"
import { ai } from "./core/firebase"
```

Create a model and generate content:

```typescript
const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" })

const result = await model.generateContent(
  `You are a real estate investment analyst. Analyze this property:
  Address: ${store.address}
  Price: $${store.price}
  Estimated rent: $${store.estimatedRent}/mo
  Monthly cash flow: $${metrics.rental.monthlyCashFlow}
  Cap rate: ${metrics.rental.capRate}%
  
  Give a 2-sentence summary and list up to 3 red flags.`
)

const text = result.response.text()
```

### Step 3 — Full example handler

Here is a drop-in `handleDirectAI` function alongside the existing `handleAnalyze`:

```typescript
const handleDirectAI = useCallback(async () => {
  if (!store.price) return
  setIsAnalyzing(true)
  try {
    const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" })
    const prompt = `
      Real estate investment analysis:
      Address: ${store.address || "unknown"}
      Purchase price: $${store.price}
      Monthly rent: $${store.estimatedRent}
      Monthly cash flow: $${metrics.rental.monthlyCashFlow}
      Cap rate: ${metrics.rental.capRate}%
      Cash-on-cash return: ${metrics.rental.cocReturn}%

      Provide:
      1. A concise 2-sentence investment summary
      2. Up to 3 specific red flags
      3. One actionable recommendation
    `
    const result = await model.generateContent(prompt)
    setAiSummary(result.response.text())
  } catch (e) {
    console.error("Direct AI failed", e)
    setAiSummary("AI analysis unavailable. Please try again.")
  } finally {
    setIsAnalyzing(false)
  }
}, [store, metrics])
```

---

## Manifest / CSP

No changes needed. The existing `content_security_policy` in `package.json` already permits the required endpoints:

```json
"connect-src": "... https://*.googleapis.com ..."
```

Gemini Developer API calls go to `https://generativelanguage.googleapis.com` and Vertex AI calls go to `https://*.googleapis.com` — both are covered.

---

## Streaming responses

For a better UX (text appears as it's generated), use `generateContentStream` instead:

```typescript
const stream = await model.generateContentStream(prompt)
let accumulated = ""
for await (const chunk of stream.stream) {
  accumulated += chunk.text()
  setAiSummary(accumulated)   // updates the UI incrementally
}
```

---

## Local development without App Check

Add the App Check debug token to your `.env.local`:

```
PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN=your-debug-token-from-firebase-console
```

Then initialize App Check with the debug provider before calling `getAI`:

```typescript
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check"

if (process.env.PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN) {
  // @ts-ignore - debug token global
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN
}

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(process.env.PLASMO_PUBLIC_RECAPTCHA_SITE_KEY!),
  isTokenAutoRefreshEnabled: true,
})
```

---

## Model options

| Model ID | Best for | Notes |
|---|---|---|
| `gemini-2.0-flash` | Default — fast, cheap, capable | Recommended for most extension use cases |
| `gemini-2.0-flash-lite` | Very fast, lowest cost | Good for simple summaries |
| `gemini-2.5-pro` | Complex reasoning | Higher latency, higher cost |

Pass the model ID string to `getGenerativeModel(ai, { model: "..." })`.

---

## References

- [Firebase AI Logic docs](https://firebase.google.com/docs/ai-logic)
- [Firebase AI Logic JS SDK reference](https://firebase.google.com/docs/reference/js/ai)
- [App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Gemini model catalog](https://firebase.google.com/docs/ai-logic/gemini-models)
