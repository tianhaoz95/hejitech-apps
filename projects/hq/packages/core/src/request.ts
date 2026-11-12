// On-demand requests: how a person asks HQ for something. A request is not a card: it has no
// evidence, plan or verify step, it's the owner's words. Filing one queues a "request" run for the
// workspace's runner, and any agent connected over MCP also sees it in get_context. The agent that
// takes it claims it (a lease, so two agents don't both answer), looks into the repo, files one or
// more cards with `request_id`, and answers: with the cards, a question, or why it won't. Asking is
// not approving: every card still goes through its tier.

import type { Result } from "./card.ts";

export const REQUEST_STATUSES = [
  "open", // waiting for an agent (also after a follow-up from the owner)
  "claimed", // an agent is working on it; the lease runs out if the agent dies
  "answered", // the agent answered: cards, a question, or a refusal
  "closed", // the owner is done with it
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_OUTCOMES = [
  "proposed", // one or more cards carry this request's id
  "question", // the agent needs something from the owner first
  "declined", // policy forbids it (the never-list), or it is already handled
  "note", // an answer that needed no card
] as const;
export type RequestOutcome = (typeof REQUEST_OUTCOMES)[number];

export const REQUEST_LIMITS = { body: 4000, message: 8000, leaseMinutes: 30, openPerWorkspace: 20, cardsPerRequest: 6 } as const;

/** How much a requested card outranks what scouts found on their own (card.ts defaultPriority). */
export const REQUEST_PRIORITY_BOOST = 40;

export interface RequestMessage {
  id: number;
  author: string;
  /** reply: the owner's follow-up · answer: the agent's · system: HQ's own notes. */
  kind: "reply" | "answer" | "system";
  body: string;
  created_at: string;
}

export interface HqRequest {
  id: string;
  /** null: the agent decides which project (or the whole repo) it concerns. */
  project: string | null;
  body: string;
  status: RequestStatus;
  outcome: RequestOutcome | null;
  requested_by: string;
  claimed_by: string | null;
  claimed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestInput {
  body: string;
  project: string | null;
}

export function validateRequest(input: unknown): Result<RequestInput> {
  if (!input || typeof input !== "object") return { ok: false, errors: ["request must be an object"] };
  const r = input as Record<string, unknown>;
  const errs: string[] = [];
  const body = typeof r.body === "string" ? r.body.trim() : "";
  if (!body) errs.push("body: say what you want HQ to propose");
  else if (body.length > REQUEST_LIMITS.body) errs.push(`body: at most ${REQUEST_LIMITS.body} characters`);
  let project: string | null = null;
  if (r.project !== undefined && r.project !== null && r.project !== "" && r.project !== "repo-wide") {
    if (typeof r.project !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(r.project)) errs.push("project: a project name, or leave it out");
    else project = r.project;
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true, value: { body, project } };
}

/** Can an agent take it now? Open, or claimed with a lease that ran out. */
export function isClaimable(r: Pick<HqRequest, "status" | "claimed_until">, at = new Date()): boolean {
  if (r.status === "open") return true;
  return r.status === "claimed" && (!r.claimed_until || Date.parse(r.claimed_until) <= at.getTime());
}

export const leaseUntil = (at = new Date()): string => new Date(at.getTime() + REQUEST_LIMITS.leaseMinutes * 60_000).toISOString();
