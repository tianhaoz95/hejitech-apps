// A minimal MCP client (Streamable HTTP, JSON responses) for the scripts here.
export function mcpClient(url, token) {
  let id = 0;
  async function rpc(method, params = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* not JSON (a 401 body) */ }
    return { status: res.status, headers: res.headers, body, text };
  }
  async function tool(name, args = {}) {
    const r = await rpc("tools/call", { name, arguments: args });
    if (r.status !== 200) throw new Error(`${name}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    const result = r.body.result;
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  }
  return { rpc, tool };
}
