// The local model's sanity check (§9.3) over any OpenAI-compatible endpoint (Ollama, vLLM,
// llama.cpp). Temperature 0, JSON only, a fixed executor-owned prompt; a timeout, an HTTP error or
// unparseable output is a failure, never a bypass.
import {
  parseSanity, parseStrategyFit, SANITY_SCHEMA, SANITY_SYSTEM_PROMPT, sanityUserMessage, STRATEGY_FIT_SCHEMA, STRATEGY_FIT_SYSTEM_PROMPT, strategyFitMessage,
  type SanityInput, type SanityVerdict, type StrategyFit,
} from "@tradeboard/core";
import type { Config } from "./config.ts";

export interface SanityChecker {
  id: string;
  check(input: SanityInput): Promise<SanityVerdict & { raw?: string; error?: string }>;
  /** Advisory only: does the plan fit the user's strategy? null when the model can't say. */
  strategyFit?(strategy: string, plan: Parameters<typeof strategyFitMessage>[1]): Promise<StrategyFit | null>;
}

export function openAiChecker(cfg: Config["model"], f: typeof fetch = fetch): SanityChecker {
  const url = `${cfg.base_url.replace(/\/$/, "")}/chat/completions`;
  return {
    id: cfg.model,
    async check(input) {
      const body = {
        model: cfg.model,
        temperature: 0,
        seed: 0,
        max_tokens: cfg.max_tokens ?? 2048,
        ...(cfg.reasoning_effort ? { reasoning_effort: cfg.reasoning_effort } : {}),
        messages: [{ role: "system", content: SANITY_SYSTEM_PROMPT }, { role: "user", content: sanityUserMessage(input) }],
        response_format: { type: "json_schema", json_schema: { name: "sanity_verdict", strict: true, schema: SANITY_SCHEMA } },
      };
      let text = "";
      try {
        const res = await f(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : {}) },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(cfg.timeout_ms),
        });
        if (!res.ok) return { verdict: "fail", reasons: [`model endpoint returned HTTP ${res.status}`], error: "http" };
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        text = j.choices?.[0]?.message?.content ?? "";
      } catch (e) {
        const timeout = (e as Error).name === "TimeoutError";
        return { verdict: "fail", reasons: [timeout ? `model didn't answer within ${cfg.timeout_ms / 1000} s` : `model unreachable: ${(e as Error).message}`], error: timeout ? "timeout" : "unreachable" };
      }
      const v = parseSanity(text);
      if (!v) return { verdict: "fail", reasons: ["model output wasn't the required JSON"], raw: text.slice(0, 500), error: "unparseable" };
      return { ...v, raw: text.slice(0, 500) };
    },
    async strategyFit(strategy, plan) {
      try {
        const res = await f(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : {}) },
          body: JSON.stringify({
            model: cfg.model, temperature: 0, seed: 0, max_tokens: cfg.max_tokens ?? 2048, ...(cfg.reasoning_effort ? { reasoning_effort: cfg.reasoning_effort } : {}),
            messages: [{ role: "system", content: STRATEGY_FIT_SYSTEM_PROMPT }, { role: "user", content: strategyFitMessage(strategy, plan) }],
            response_format: { type: "json_schema", json_schema: { name: "strategy_fit", strict: true, schema: STRATEGY_FIT_SCHEMA } },
          }),
          signal: AbortSignal.timeout(cfg.timeout_ms),
        });
        if (!res.ok) return null;
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return parseStrategyFit(j.choices?.[0]?.message?.content ?? "");
      } catch {
        return null;
      }
    },
  };
}
