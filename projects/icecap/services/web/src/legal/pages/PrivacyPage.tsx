import type { ReactNode } from "react"

const EFFECTIVE_DATE = "November 17, 2026"

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 prose prose-gray">
      <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-10">Effective: {EFFECTIVE_DATE}</p>

      <Section title="1. Introduction">
        HEJI TECHNOLOGY LLC ("we," "us," "our") operates the Icecap Chrome extension and web dashboard (the
        "Service") that helps real estate investors analyze property listings. This Privacy Policy explains
        how we collect, use, and protect your information.
      </Section>

      <Section title="2. Information We Collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account Data:</strong> When you sign in with Google, we receive your name, email address,
            and profile photo. Sign-in is a HEJI TECH account (Supabase Auth) shared with other HEJI TECH apps you use.
          </li>
          <li>
            <strong>Property Analyses:</strong> Financial calculations and property data you create are stored
            in our database (Supabase), where row-level security lets only your account read or change them.
          </li>
          <li>
            <strong>Scraped Listing Data:</strong> The Chrome extension scrapes property data (price, address,
            taxes, HOA) from listing pages <strong>only when you explicitly click "Analyze Active Listing."</strong>{" "}
            No automatic scraping occurs.
          </li>
          <li>
            <strong>Payment Data:</strong> Billing is handled by Stripe. We do not store credit card numbers.
            We receive subscription status events via Stripe webhooks.
          </li>
          <li>
            <strong>AI Analysis:</strong> Deal summaries and the co-pilot run on Chrome's built-in on-device model.
            Your listings, deals and questions are processed on your computer and are never sent to us or to an AI provider.
          </li>
          <li>
            <strong>Waitlist:</strong> If you join the waitlist, we keep your email address (and name, if given) to tell
            you when your spot is ready.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul className="list-disc pl-5 space-y-2">
          <li>To provide and improve the Service.</li>
          <li>To check whether your account has Icecap Pro.</li>
          <li>To send in-app notifications about trial expiry and billing.</li>
        </ul>
      </Section>

      <Section title="4. Data Sharing">
        We do not sell your personal data. We share data only with:
        <ul className="list-disc pl-5 mt-2 space-y-2">
          <li><strong>Supabase:</strong> Sign-in and the database that stores your account's deals and settings.</li>
          <li><strong>Cloudflare:</strong> Hosting of this website and its API.</li>
          <li><strong>Stripe:</strong> Payment processing.</li>
          <li><strong>Google:</strong> Sign in with Google, and the waitlist page's ad conversion measurement.</li>
        </ul>
      </Section>

      <Section title="5. Data Retention & Deletion">
        You can delete all of your Icecap data (saved deals and settings) at any time from Settings in the
        Icecap dashboard; it is removed immediately. Your HEJI TECH sign-in is shared with our other apps, so it
        stays; email us to delete it too. We retain billing records as required by law.
      </Section>

      <Section title="6. Chrome Extension Permissions">
        The Icecap extension requests:
        <ul className="list-disc pl-5 mt-2 space-y-2">
          <li><strong>activeTab:</strong> To read the current listing page when you click "Analyze."</li>
          <li><strong>sidePanel:</strong> To display the Icecap side panel UI.</li>
          <li><strong>storage:</strong> To persist your default loan assumptions locally.</li>
          <li><strong>identity:</strong> To sign in with Google.</li>
          <li><strong>host permissions (redfin.com, zillow.com, realtor.com):</strong> To read listings and show map badges on those sites only.</li>
        </ul>
        No browsing history or personal data is transmitted without your explicit action.
      </Section>

      <Section title="7. Security">
        All data is encrypted in transit (TLS) and at rest. Row-level security ensures each user can only
        read and write their own data, and admin pages are limited to a short list of HEJI TECH accounts.
      </Section>

      <Section title="8. Children">
        The Service is not directed at children under 13. We do not knowingly collect data from children.
      </Section>

      <Section title="9. Contact">
        Questions? Email us at <a href="mailto:info@hejitechllc.com" className="text-blue-600">info@hejitechllc.com</a>.
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
