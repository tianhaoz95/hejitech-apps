// Small helpers shared by the portal pages: DOM building, the owner token, API calls.

type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined | null>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (typeof v === "function") n.addEventListener(k.replace(/^on/, ""), v as EventListener);
    else if (v === true) n.setAttribute(k, "");
    else n.setAttribute(k, String(v));
  }
  const add = (c: Child) => {
    if (c === false || c === null || c === undefined) return;
    if (Array.isArray(c)) c.forEach(add);
    else n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return n;
}

const KEY = "hq.owner-token";
export const token = () => localStorage.getItem(KEY) ?? "";
export const setToken = (t: string) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export class ApiError extends Error {
  constructor(public status: number, message: string, public details: string[] = []) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `HTTP ${res.status}`, (data as { details?: string[] })?.details ?? []);
  return data as T;
}

/** Fetches an auth-protected file and returns an object URL for <img>. */
export async function fileUrl(key: string): Promise<string> {
  const res = await fetch(`/api/files/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`file ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function toast(msg: string, bad = false) {
  const t = el("div", { class: `toast${bad ? " bad" : ""}`, role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

export const spinner = () => el("div", { class: "spinner", "aria-label": "Loading" });
