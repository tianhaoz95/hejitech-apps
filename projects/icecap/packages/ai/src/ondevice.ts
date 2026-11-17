// Chrome's built-in model (Gemini Nano through the Prompt API: the global `LanguageModel`), the only
// model Icecap uses. Everything runs on the user's machine: no prompt or listing leaves the browser,
// there is no AI quota and nothing to pay for per request. Where the model can't run (another
// browser, too little disk or memory), the AI features say so and the rest of Icecap works as usual.

/** What the browser can do: `downloadable`/`downloading` = it can, after a one-time model download. */
export type OnDeviceStatus = "available" | "downloadable" | "downloading" | "unavailable";

interface LanguageModelParams { defaultTopK: number; maxTopK: number; defaultTemperature: number; maxTemperature: number }
interface LanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal; responseConstraint?: object }): Promise<string>;
  promptStreaming(input: string, options?: { signal?: AbortSignal }): AsyncIterable<string> & ReadableStream<string>;
  destroy(): void;
}
interface LanguageModelStatic {
  availability(options?: object): Promise<OnDeviceStatus>;
  params?(): Promise<LanguageModelParams>;
  create(options?: object): Promise<LanguageModelSession>;
}

const LANGUAGES = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };

function api(): LanguageModelStatic | null {
  const g = globalThis as { LanguageModel?: LanguageModelStatic };
  return g.LanguageModel ?? null;
}

/** Whether the on-device model can run here. Never throws. */
export async function onDeviceStatus(): Promise<OnDeviceStatus> {
  const lm = api();
  if (!lm) return "unavailable";
  try {
    return await lm.availability(LANGUAGES);
  } catch {
    return "unavailable";
  }
}

export class OnDeviceUnavailable extends Error {
  constructor() {
    super("On-device AI isn't available in this browser. Icecap's AI runs on Chrome's built-in model (Chrome 138 or later on a desktop with enough free disk space).");
  }
}

export interface AskOptions {
  /** A system prompt for the session. */
  system?: string;
  temperature?: number;
  signal?: AbortSignal;
  /** 0–1 while the model downloads (first use only). */
  onDownload?: (fraction: number) => void;
}

async function session(o: AskOptions): Promise<LanguageModelSession> {
  const lm = api();
  if (!lm || (await onDeviceStatus()) === "unavailable") throw new OnDeviceUnavailable();
  const params = await lm.params?.().catch(() => null);
  return lm.create({
    ...LANGUAGES,
    ...(o.temperature !== undefined && params ? { temperature: Math.min(o.temperature, params.maxTemperature), topK: params.defaultTopK } : {}),
    ...(o.system ? { initialPrompts: [{ role: "system", content: o.system }] } : {}),
    signal: o.signal,
    monitor(m: EventTarget) {
      m.addEventListener("downloadprogress", (e) => o.onDownload?.((e as Event & { loaded: number }).loaded));
    },
  });
}

/** One answer from the on-device model. */
export async function ask(prompt: string, o: AskOptions = {}): Promise<string> {
  const s = await session(o);
  try {
    return await s.prompt(prompt, { signal: o.signal });
  } finally {
    s.destroy();
  }
}

/** A JSON answer that follows `schema` (the Prompt API constrains the output to it). */
export async function askJson<T>(prompt: string, schema: object, o: AskOptions = {}): Promise<T> {
  const s = await session(o);
  try {
    const text = await s.prompt(prompt, { signal: o.signal, responseConstraint: schema });
    return JSON.parse(text) as T;
  } finally {
    s.destroy();
  }
}
