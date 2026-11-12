// Who may do what in a workspace (PRD §10). A workspace is one repository and its members; runners
// and agents act through workspace tokens. The Worker checks these before every write.

export const MEMBER_ROLES = ["admin", "approver", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type TokenRole = "runner" | "agent";
export type Role = MemberRole | TokenRole;

export type Action =
  | "read"
  | "comment"
  | "propose" // create cards (agents; members too, for a manual card)
  | "decide" // approve or reject
  | "set_status" // ship, build again, retry
  | "run_verb" // request a verb (the tier check still applies)
  | "run_l3_verb" // start an L3 verb (releases): humans only
  | "start_run" // start a scout, the CEO or health now
  | "rank" // the CEO's ranking
  | "attach" // attach evidence
  | "claim" // claim and finish runs, report health
  | "sync" // upload the .hq/ policy
  | "pause" // the kill switch
  | "tokens"
  | "members"
  | "connect_agent" // approve an OAuth MCP client
  | "audit"
  | "request" // ask HQ for something (an on-demand request), follow up on it, close it
  | "answer_request"; // claim and answer a request (agents and runners)

const ALLOWED: Record<Role, readonly Action[]> = {
  admin: ["read", "comment", "propose", "decide", "set_status", "run_verb", "run_l3_verb", "start_run", "attach", "sync", "pause", "tokens", "members", "connect_agent", "audit", "request"],
  approver: ["read", "comment", "propose", "decide", "set_status", "run_verb", "run_l3_verb", "start_run", "attach", "connect_agent", "request"],
  viewer: ["read", "comment"],
  runner: ["read", "comment", "propose", "attach", "claim", "sync", "run_verb", "answer_request"],
  agent: ["read", "comment", "propose", "attach", "run_verb", "rank", "answer_request"],
};

export const can = (role: Role, action: Action): boolean => ALLOWED[role].includes(action);
export const isMember = (role: Role): role is MemberRole => (MEMBER_ROLES as readonly string[]).includes(role);
