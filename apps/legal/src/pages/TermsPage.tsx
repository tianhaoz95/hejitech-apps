import type { ReactNode } from "react"

const EFFECTIVE_DATE = "April 23, 2026"

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
      <p className="text-gray-400 text-sm mb-10">Effective: {EFFECTIVE_DATE}</p>

      <Section title="1. Acceptance">
        By using Icecap (the "Service"), you agree to these Terms. If you do not agree, do not use the
        Service.
      </Section>

      <Section title="2. Eligibility">
        You must be at least 18 years old and legally capable of entering into contracts. The Service is
        currently available in the United States only.
      </Section>

      <Section title="3. Subscriptions">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Pro ($19/month):</strong> Includes a 30-day free trial. Billed monthly via Stripe.</li>
          <li><strong>Pro Max ($49/month):</strong> No trial period.</li>
          <li>Subscriptions renew automatically. Cancel any time in your Stripe billing portal.</li>
          <li>No refunds for partial billing periods.</li>
        </ul>
      </Section>

      <Section title="4. Acceptable Use">
        You agree NOT to:
        <ul className="list-disc pl-5 mt-2 space-y-2">
          <li>Use the Service to violate any listing site's Terms of Service.</li>
          <li>Automate scraping at scale beyond normal human browsing.</li>
          <li>Reverse engineer, decompile, or resell the Service.</li>
          <li>Use AI analysis outputs as the sole basis for investment decisions.</li>
        </ul>
      </Section>

      <Section title="5. Disclaimers">
        <strong>Icecap provides financial calculations as informational tools only.</strong> We are not
        licensed financial advisors. All calculations are based on user-provided inputs and heuristic
        estimates. Do not make investment decisions based solely on Icecap outputs. Always consult a
        licensed professional before investing.
        <br /><br />
        AI-generated content (deal summaries, red flag analysis) may contain errors. Always independently
        verify AI outputs.
      </Section>

      <Section title="6. Scraping Disclaimer">
        The extension scrapes public listing data from Redfin, Zillow, and Realtor.com for your personal
        investment analysis. This scraping is user-triggered and for personal use only. We make no
        guarantees about scraper accuracy after third-party site updates.
      </Section>

      <Section title="7. Limitation of Liability">
        To the maximum extent permitted by law, Icecap is not liable for any indirect, incidental, or
        consequential damages arising from your use of the Service, including investment losses.
      </Section>

      <Section title="8. Changes">
        We may update these Terms. Continued use after notice constitutes acceptance of the new Terms.
      </Section>

      <Section title="9. Contact">
        <a href="mailto:legal@icecap.io" className="text-blue-600">legal@icecap.io</a>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </section>
  )
}
