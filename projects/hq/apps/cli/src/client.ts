// HTTP client for HQ's API, used by `hq` commands and the runner.
export class HqClient {
  readonly url: string;
  private readonly token: string;
  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, "");
    this.token = token;
  }

  static fromEnv(): HqClient {
    const url = process.env.HQ_URL;
    const token = process.env.HQ_TOKEN;
    if (!url || !token) throw new Error("set HQ_URL and HQ_TOKEN (a runner token from the portal's Settings, or the owner token)");
    return new HqClient(url, token);
  }

  async call<T = any>(method: string, path: string, body?: unknown, raw?: { data: Uint8Array; type: string }): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };
    let payload: string | Uint8Array | undefined;
    if (raw) {
      headers["Content-Type"] = raw.type;
      payload = raw.data;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    // One retry on a network error: a kept-alive connection can be closed while a verb or agent runs.
    let res: Response;
    try {
      res = await fetch(this.url + path, { method, headers, body: payload });
    } catch {
      await new Promise((r) => setTimeout(r, 500));
      res = await fetch(this.url + path, { method, headers, body: payload });
    }
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    if (!res.ok) {
      const details = Array.isArray(data?.details) ? `\n  - ${data.details.join("\n  - ")}` : "";
      throw new Error(`${method} ${path}: ${res.status} ${data?.error ?? text.slice(0, 200)}${details}`);
    }
    return data as T;
  }
}
