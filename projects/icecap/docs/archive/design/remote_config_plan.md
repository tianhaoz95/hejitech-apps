# Plan: Remote Config for AI Assistant

This plan outlines the integration of Firebase Remote Config into the Icecap extension to allow dynamic updates of the Gemini AI model ID.

## Phase 1: Infrastructure Setup (Remote Config as Code)
1. **Update `firebase.json`**: Add the `remoteconfig` field pointing to a template file.
2. **Create `firebase/remoteconfig.json`**: Define the `gemini_model_id` parameter with a default value of `gemini-3.1-flash-lite`.

## Phase 2: Extension Implementation
1. **Initialize Remote Config in `apps/extension/src/core/firebase.ts`**:
    - Import `getRemoteConfig` and `fetchAndActivate`.
    - Set local default values.
    - Export the `remoteConfig` instance.
2. **Integrate into `apps/extension/src/sidepanel.tsx`**:
    - Replace hardcoded model strings with `getString(remoteConfig, "gemini_model_id")`.

## Phase 3: Validation & Deployment Instructions
- Provide the CLI command to deploy the configuration: `firebase deploy --only remoteconfig`.

---

### Implementation Details:

#### 1. `firebase.json`
```json
{
  "remoteconfig": {
    "template": "firebase/remoteconfig.json"
  },
  ...
}
```

#### 2. `firebase/remoteconfig.json`
```json
{
  "parameters": {
    "gemini_model_id": {
      "defaultValue": {
        "value": "gemini-3.1-flash-lite"
      },
      "description": "The model ID for the Gemini AI assistant (e.g., gemini-1.5-flash, gemini-3.1-flash-lite).",
      "valueType": "STRING"
    }
  }
}
```

#### 3. `apps/extension/src/core/firebase.ts`
Initialize and fetch/activate the config.

#### 4. `apps/extension/src/sidepanel.tsx`
Consume the config value.
