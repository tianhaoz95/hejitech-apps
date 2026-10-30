// What the board and the executor say to each other (§7.2). The executor reaches the board only
// through these endpoints, with its own `tbx_…` credential; agent tokens and the owner's session are
// refused there, and this credential is refused everywhere else.
import type { OrderTicket } from "./ticket.ts";
import type { Policy } from "./policy.ts";
import type { ReasonCode, Status } from "./plan.ts";

export type ReceiptMode = "dry_run" | "live" | "manual";
export type ReceiptOutcome = "executed" | "simulated" | "rejected" | "failed" | "proposed";
export type ApprovalsMode = "A" | "B";

export interface BoardControl {
  paused: boolean;
  killed: boolean;
  /** The owner's switch. Live needs this off AND the live gate AND the executor's own local opt-in. */
  dry_run: boolean;
  live_gate_complete: boolean;
  /** §12.2: until a first small live limit order is verified by read-back. */
  live_trial_pending: boolean;
  approvals_mode: ApprovalsMode | null;
  /** The masked account the owner confirmed ("••••1234"); the full number never reaches the board. */
  confirmed_account_mask: string | null;
}

export interface ExecPlan {
  plan_id: string;
  title: string;
  status: Status;
  ticker: string;
  order: OrderTicket;
  thesis: string;
  evidence: string;
  risks_and_dissent: string;
  invalidation: string;
  fit_with_strategy: string;
  /** The strategy version the plan was last written against (null: the user had none). */
  strategy_version: number | null;
  valid_from: string | null;
  valid_until: string;
  quote_price: number | null;
  quote_at: string | null;
  quote_source: string | null;
  current_version: number;
  updated_at: string;
  is_demo: boolean;
  open_human_questions: number;
  approval: { approval_id: string; version: number; approved_at: string; expires_at: string } | null;
  claim: { claim_id: string; executor_id: string; expires_at: string; idempotency_key: string } | null;
  /** Set on recovery items: an attempt reached `executing` and its claim expired. */
  attempt_started_at?: string | null;
}

export interface PollResponse {
  now: string;
  control: BoardControl;
  policy: { policy_version: number; policy: Policy };
  /** The user's adopted strategy, for the executor's optional advisory fit note. Never a gate. */
  strategy: { version: number; body: string } | null;
  plans: ExecPlan[];
  recovery: ExecPlan[];
}

export interface ClaimResponse {
  claim_id: string;
  expires_at: string;
  plan: ExecPlan;
}

export interface ReceiptInput {
  claim_id: string | null;
  plan_id: string;
  version: number;
  executor_id: string;
  mode: ReceiptMode;
  outcome: ReceiptOutcome;
  reason_code: ReasonCode | null;
  reason_text: string;
  robinhood_order_id: string | null;
  filled_quantity: number | null;
  filled_price: number | null;
  policy_snapshot_id: number | null;
  details?: Record<string, unknown>;
}

export interface ExecutorHeartbeat {
  executor_id: string;
  mode: "dry_run" | "live";
  paused: boolean;
  dry_run: boolean;
  policy_version: number | null;
  local_model_id: string | null;
  model_check_enabled: boolean;
  /** The executor's own config allows live (owner opt-in on the machine). */
  local_live_allowed: boolean;
  robinhood_connected: boolean;
  /** "on" | "off" | "unknown": Robinhood's trade-approvals setting as read from the account. */
  trade_approvals: "on" | "off" | "unknown";
  account_mask: string | null;
  account_matches: boolean | null;
  last_error: string | null;
  version: string;
}

export interface TodaySummary {
  market_date: string;
  /** Receipts today that count toward max_open_plans_per_day (executed + simulated + proposed). */
  orders: number;
  live_fills: { ticker: string; filled_quantity: number; filled_price: number }[];
}

/** Deterministic idempotency key for one plan version (§9.1 step 3), also the Robinhood ref_id. */
export async function idempotencyKey(planId: string, version: number): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tradeboard:${planId}:v${version}`)));
  // Shape as a UUID (version 5 style bits) since Robinhood's ref_id is a UUID.
  d[6] = (d[6] & 0x0f) | 0x50;
  d[8] = (d[8] & 0x3f) | 0x80;
  const h = [...d.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** "••••1234". */
export function maskAccount(acct: string): string {
  return `••••${acct.slice(-4)}`;
}
