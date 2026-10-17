import { Link } from "react-router-dom";
import { PRIVACY_POLICY, TERMS_OF_SERVICE, type LegalDocument } from "../legal/content";

interface LegalPageProps {
  doc: "privacy" | "terms";
}

// Deliberately outside the authenticated <Layout>/<Outlet> shell (see
// App.tsx) — this is the URL that gets submitted to Google Play Console's
// privacy policy field, which Google's review requires to be publicly
// viewable without signing in.
export function LegalPage({ doc }: LegalPageProps) {
  const document: LegalDocument = doc === "privacy" ? PRIVACY_POLICY : TERMS_OF_SERVICE;

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink)" }}>
      <header
        style={{
          padding: "1.5rem",
          borderBottom: "1px solid var(--hairline)",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <strong style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem" }}>Contempo</strong>
        <nav style={{ display: "flex", gap: "1rem", fontSize: "0.9rem" }}>
          <Link to="/legal/privacy" style={{ color: doc === "privacy" ? "var(--pine)" : "var(--ink-soft)" }}>
            Privacy Policy
          </Link>
          <Link to="/legal/terms" style={{ color: doc === "terms" ? "var(--pine)" : "var(--ink-soft)" }}>
            Terms of Service
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
        <h1 style={{ fontSize: "1.9rem", marginBottom: "0.25rem" }}>{document.title}</h1>
        <p style={{ color: "var(--ink-faint)", fontSize: "0.85rem", marginBottom: "2rem" }}>
          {document.effectiveDateNotice}
        </p>

        {document.sections.map((section) => (
          <section key={section.heading} style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>{section.heading}</h2>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} style={{ lineHeight: 1.6, color: "var(--ink-soft)" }}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
