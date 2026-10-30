// The board's executor endpoints (§7.2). The executor accepts plans from these responses only: never
// stdin, files, email or any other channel (§5.2.3).
import type { ClaimResponse, ExecutorHeartbeat, PollResponse, ReceiptInput, TodaySummary, BoardControl } from "@tradeboard/core";

export class BoardError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface Board {
  poll(): Promise<PollResponse>;
  claim(planId: string, idempotencyKey: string | null, recovery?: boolean): Promise<ClaimResponse>;
  step(claimId: string, to: "validated" | "executing"): Promise<void>;
  release(claimId: string, note: string): Promise<void>;
  receipt(r: ReceiptInput): Promise<{ receipt_id: string; status: string; duplicate?: boolean }>;
  heartbeat(h: ExecutorHeartbeat): Promise<{ control: BoardControl }>;
  today(): Promise<TodaySummary>;
  note(text: string, opts?: { planId?: string; action?: "auto_pause" }): Promise<void>;
}

export function boardClient(baseUrl: string, token: string, f: typeof fetch = fetch): Board {
  const base = baseUrl.replace(/\/$/, "");
  async function call<T>(path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await f(`${base}/api/executor${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new BoardError(0, "unreachable", `board unreachable: ${(e as Error).message}`);
    }
    const json = (await res.json().catch(() => ({}))) as T & { error_code?: string; message?: string };
    if (!res.ok) throw new BoardError(res.status, json.error_code ?? "error", json.message ?? `HTTP ${res.status}`);
    return json;
  }
  return {
    poll: () => call("/poll", {}),
    claim: (plan_id, idempotency_key, recovery = false) => call("/claim", { plan_id, idempotency_key, recovery }),
    step: async (claim_id, to) => { await call("/step", { claim_id, to }); },
    release: async (claim_id, note) => { await call("/release", { claim_id, note }); },
    receipt: (r) => call("/receipt", r),
    heartbeat: (h) => call("/heartbeat", h),
    today: () => call("/today"),
    note: async (text, opts = {}) => { await call("/note", { text, plan_id: opts.planId, action: opts.action }); },
  };
}
