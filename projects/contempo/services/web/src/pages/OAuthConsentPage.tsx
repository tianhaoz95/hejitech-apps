import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function OAuthConsentPage() {
  const [params] = useSearchParams();
  const handle = params.get("handle") ?? "";
  const client = params.get("client") ?? "An AI assistant";
  const domain = params.get("domain");
  const errorParam = params.get("error");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(errorParam);

  async function decide(decision: "approve" | "deny") {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ handle, decision }),
      });
      const out = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!res.ok) {
        setError(out.error ?? "Authorization failed.");
        setBusy(false);
        return;
      }
      if (out.redirectTo) {
        window.location.href = out.redirectTo;
        return;
      }
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: "4rem auto", padding: "1.5rem" }}>
      <div className="chart-card">
        <h1 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Connect {client} to Contempo</h1>
        {domain && <p style={{ fontSize: "0.85rem", color: "var(--ink-faint)" }}>{domain}</p>}
        <p style={{ color: "var(--ink-soft)", marginTop: "0.75rem" }}>
          This assistant is requesting MCP access to read your participation hours, properties, and audit risks, and to log new entries on your behalf.
        </p>
        {error && <p style={{ color: "var(--danger, #b3261e)", fontSize: "0.85rem", marginTop: "0.75rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button type="button" className="btn btn-primary" disabled={busy || !handle} onClick={() => decide("approve")}>
            {busy ? "Working…" : "Approve"}
          </button>
          <button type="button" className="btn" disabled={busy || !handle} onClick={() => decide("deny")}>
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
