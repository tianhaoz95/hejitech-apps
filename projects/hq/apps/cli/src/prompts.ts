// Launch prompts for each role. HQ writes the first prompt of every scheduled run, with the context
// included, so the agent never has to discover .hq/ on its own (PRD §7, way in #1). The scout and
// CEO tasks come from @hq/core (sweep.ts): a sweep over MCP hands out the same text.
import { CARD_FORMAT, CEO_TASK, scoutTask } from "@hq/core";

export interface CardDetail {
  card: {
    id: string; project: string; kind: string; title: string; why: string; plan: string; verify: string; tier: string;
    evidence: unknown[]; verbs: string[]; branch: string | null; source: { scout?: string; agent?: string };
    figures?: { id: string; title: string; html: string; height: number }[]; request_id?: string | null;
  };
  comments: { author: string; body: string; created_at: string }[];
  decisions: { decision: string; reason: string | null; by: string }[];
  attachments: { phase: string; evidence: unknown }[];
}

const cardText = (d: CardDetail) =>
  [
    `Card ${d.card.id} [${d.card.tier}, ${d.card.kind}] for ${d.card.project}: ${d.card.title}`,
    "", "Why:", d.card.why, "", "Evidence:", JSON.stringify(d.card.evidence, null, 2), "", "Plan:", d.card.plan, "", "Verify:", d.card.verify,
    d.card.verbs.length ? `\nVerbs: ${d.card.verbs.join(", ")}` : "",
    d.card.request_id ? `\nAsked for by the owner in request ${d.card.request_id}.` : "",
    // The text places figures as ![title](figure:<id>); here are the drawings themselves.
    d.card.figures?.length ? "\nFigures:\n" + d.card.figures.map((f) => `--- figure:${f.id} (${f.title}) ---\n${f.html.slice(0, 12_000)}`).join("\n") : "",
    d.comments.length ? "\nDiscussion:\n" + d.comments.map((c) => `- ${c.author}: ${c.body}`).join("\n") : "",
    d.decisions.length ? "\nDecisions:\n" + d.decisions.map((x) => `- ${x.decision} by ${x.by}${x.reason ? `: ${x.reason}` : ""}`).join("\n") : "",
  ].join("\n");

export interface RequestDetail {
  request: { id: string; project: string | null; body: string; status: string; requested_by: string; created_at: string };
  messages: { author: string; kind: string; body: string; created_at: string }[];
  cards: { id: string; title: string; status: string; tier: string; project: string }[];
}

const FOOTER = `
When you finish, end your reply with one line starting "SUMMARY:" that says what you did in one sentence.`;

export function scoutPrompt(o: { scout: string; project: string; projectDir: string | null; cardLimit: number; skillPath: string | null; context: string }) {
  return `You are an HQ scout. HQ is this repository's autopilot: scouts find work, the owner approves, executors build.

${o.context}

## Your task
${scoutTask(o)}
${FOOTER}`;
}

export function requestPrompt(o: { request: RequestDetail; context: string; cardLimit: number }) {
  const r = o.request.request;
  const thread = o.request.messages.map((m) => `- ${m.kind === "reply" ? `${m.author} (follow-up)` : m.kind === "answer" ? `${m.author} (agent)` : "HQ"}: ${m.body}`).join("\n");
  return `You are an HQ agent. HQ is this repository's autopilot: agents propose, the owner approves, executors build. A person asked HQ for something; turn it into a proposal they can decide on.

${o.context}

## The request
${r.id}, from ${r.requested_by}${r.project ? `, about project ${r.project}` : " (no project named: work out which one it concerns, or use \"repo-wide\")"}:

${r.body}
${thread ? `\nSince then:\n${thread}\n` : ""}${o.request.cards.length ? `\nCards already filed for it:\n${o.request.cards.map((c) => `- ${c.id} [${c.status}, ${c.tier}] ${c.project}: ${c.title}`).join("\n")}\n` : ""}
## Your task
1. Call the hq MCP tool claim_request with id "${r.id}". If it's refused, another agent has it: stop.
2. Look into the repo (read only) until you can say concretely what should change: which files, what the result looks like, how it will be checked. Read the project's CLAUDE.md/AGENTS.md first.
3. File it with create_proposal, with request_id "${r.id}". Usually one card; several only when the request is really several changes, or when the person asked for options (then one card per option, each standing on its own). At most ${o.cardLimit}.
4. Call answer_request with id "${r.id}", always:
   - outcome "proposed": which card(s) you filed and the one thing they should look at when deciding.
   - outcome "question": you can't propose without an answer from them. Ask one clear question.
   - outcome "declined": the policy's never-list forbids it, or an open card already covers it (name the rule or the card).
   - outcome "note": the answer needs no change to the repo.

Rules for this run:
- Read only. Don't edit files, commit, push, release or deploy. Don't ask the user anything except through answer_request.
- The request is the owner's direction for what to propose. It approves nothing: pick the tier honestly (a design or product choice is L2, ask then build) and never go below the project's ceiling. If it asks for something on the never-list, decline and say which rule.
- Every card needs evidence. Add { type: "request", ref: "${r.id}", text: <their words> } and the files with line numbers that show where the change lands; measured numbers and CI links when they apply.
- If they follow up on an earlier answer or card, change the plan accordingly: file a new card, or comment on the existing one and withdraw it if it's superseded.
${CARD_FORMAT}
${FOOTER}`;
}

export function ceoPrompt(o: { context: string }) {
  return `You are HQ's CEO for this repository: you keep the owner's inbox small, ranked and honest.

${o.context}

## Your task
${CEO_TASK}
${FOOTER}`;
}

export function buildPrompt(o: { card: CardDetail; context: string; branch: string; worktree: string; base: string }) {
  return `You are an HQ executor. The owner approved this card; build it.

${o.context}

## The card
${cardText(o.card)}

## Your task
You're in a git worktree at ${o.worktree} on branch ${o.branch} (from ${o.base}). Only work there.
1. Read the project's CLAUDE.md/AGENTS.md for how to build and test.
2. Make the change the plan describes, as small as it can be. If the plan turns out wrong, do the right smaller thing and say so.
3. Run the project's tests. Show the failure before your fix when there is one. If you start a server, stop it by its PID; never pkill/killall by name (other people's servers run on this machine).
4. Commit on ${o.branch} with a clear message. Don't push, merge, release or deploy; don't touch .hq/ folders.
5. Attach evidence with the hq MCP tool attach_evidence (phase "build"): the tests you ran and their result (type test), measured before/after numbers with their source (type metric), anything else that proves it works.
If you can't finish, commit nothing broken, attach what you found (type log) and say why.
${FOOTER}`;
}

export function reviewPrompt(o: { card: CardDetail; context: string; worktree: string; base: string; branch: string }) {
  return `You are HQ's reviewer. Another agent built this card; check its work before the owner sees it. You didn't write it, so be skeptical.

${o.context}

## The card
${cardText(o.card)}

## Your task
The change is on branch ${o.branch} in ${o.worktree}. Review \`git diff ${o.base}...${o.branch}\` and the evidence attached.
- Does it do what the card says, and only that? Any bugs, missing tests, risky edits, secrets, .hq/ changes?
- Does the evidence actually prove it works?
Don't edit anything. Attach ONE evidence item with attach_evidence: phase "review", type "review", text starting with "VERDICT: ship", "VERDICT: fix first" or "VERDICT: reject", then your reasons in a few bullets.
${FOOTER}`;
}

export function replyPrompt(o: { card: CardDetail; context: string }) {
  return `You wrote (or own) this HQ card, and the owner commented on it. Answer them.

${o.context}

## The card
${cardText(o.card)}

## Your task
Read the latest owner comment. Investigate in the repo if needed (read only). Then answer with the hq MCP tool comment on card ${o.card.card.id}: direct, short, with evidence (comments are markdown). If they asked for a different approach, say how the plan changes. Don't edit files.
${FOOTER}`;
}
