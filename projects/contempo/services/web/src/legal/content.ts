// Shared content model for the Privacy Policy and Terms of Service, rendered
// by LegalPage.tsx. There's no cross-platform content pipeline at MVP scale
// (see backend/README.md's "no shared-schema codegen" note for the same
// philosophy applied elsewhere) — android/.../ui/legal/LegalContent.kt is a
// hand-maintained mirror of this same text. Keep both in sync by hand when
// either changes.

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  effectiveDateNotice: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  effectiveDateNotice: "Effective date: August 11, 2026.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        "Contempo is a material-participation hour-tracking app built by Hejitech, designed to help short-term rental hosts and real estate professionals keep contemporaneous records for IRS material participation tests (the 100-hour / 500-hour STR tests, or the 750-hour REPS test).",
        "This policy describes what information Contempo collects, how it's used, and the choices you have. It applies to the Contempo Android app, the Contempo iOS app, and the Contempo web app.",
      ],
    },
    {
      heading: "Information we collect",
      paragraphs: [
        "Account information: when you sign in with Google, we receive your name, email address, and profile photo from your Google account. We don't offer any other sign-in method.",
        "Content you provide: work log entries (property, task description, duration, category, activity date), property names, photos attached as evidence, voice recordings and their transcripts, and mileage/trip data (distance, odometer photos, GPS coordinates for trip start/end). When location is available at the moment you capture an entry, start a work timer, or stop a work timer, we also store that capture/start/stop location.",
        "In-app feedback: if you turn on \"Shake to report\" in Settings, shaking your device captures a screenshot of what you're looking at. We store that screenshot, the area you box on it (if any), the description you write, and structured device/app state (app version, OS version, device model, which screen you were on, and locale) so we can find and fix the issue faster.",
        "Role names: if you tag an entry as done by someone else who works on your property (a co-host, cleaner, or contractor, for example), we store the name you give that role. That's content you choose to enter about a third party, not something we collect independently.",
        "AI correction data: when you edit a field the AI drafted before confirming it, we log both the AI's original value and your corrected value. This is training signal we may use later to improve parsing accuracy — it isn't shared outside Contempo/Hejitech.",
      ],
    },
    {
      heading: "How we use your information",
      paragraphs: [
        "To parse natural-language text or voice entries into structured fields (property, task, duration, category), using an AI model that runs on your phone (see below).",
        "To compute contemporaneity and vague-entry risk flags (a deterministic check, not an AI model), and to generate your pacing dashboard and CSV/print exports.",
        "To answer legal-question chat messages you choose to send — see the disclaimer in our Terms of Service that this feature is not tax or legal advice.",
        "To improve entry-parsing accuracy over time, using the correction data described above.",
      ],
    },
    {
      heading: "On-device AI processing",
      paragraphs: [
        "Entry parsing and the legal-question chat run on your phone, with an AI model that comes with the app (or a larger one you can choose to download). Your voice, text and photos are never sent to an AI service or to our servers for this.",
        "Voice is transcribed on the device too. Only the finished entries you save are stored in your account (see below).",
      ],
    },
    {
      heading: "How we store and protect your information",
      paragraphs: [
        "Your data is stored with Supabase (a Postgres database and file storage, in a United States region), in records and a per-account storage path that only your signed-in account can access.",
        "Database row-level security policies and storage policies enforce that access restriction, plus field-level validation on what can be written, and data is encrypted in transit.",
      ],
    },
    {
      heading: "Diagnostic and crash data",
      paragraphs: [
        "The apps don't include a crash-reporting or performance-monitoring service. Our servers keep standard request logs (time, endpoint, status) for operating and securing the service; they don't include your entry content.",
      ],
    },
    {
      heading: "How we share your information",
      paragraphs: [
        "We do not sell your personal information, and we don't use any third-party advertising networks.",
        "Your data is processed by Supabase and Cloudflare as our infrastructure providers, under their own data-processing terms — this is what makes the app function, not sharing for their independent purposes.",
        "CSV or print exports you generate are shared only when and however you choose to share them (e.g. via your phone's share sheet to email a CPA) — Contempo doesn't send them anywhere automatically.",
      ],
    },
    {
      heading: "Data retention and deletion",
      paragraphs: [
        "Entries and properties persist until you delete them yourself in the app.",
        "You can permanently delete your account and all associated data at any time from Settings, on Android, on iOS, or on this website — this immediately and irreversibly deletes your database records, stored photos/audio, and your sign-in account itself. If you'd rather not use the self-service option, you can also contact us at https://contempo.hejitech.workers.dev/feedback/ to request deletion.",
      ],
    },
    {
      heading: "Children's privacy",
      paragraphs: [
        "Contempo is intended for adult STR hosts and real estate professionals. It is not directed at children, and we do not knowingly collect information from anyone under 13.",
      ],
    },
    {
      heading: "Your rights and choices",
      paragraphs: [
        "You can edit or delete any entry or property at any time, choose your AI inference mode in Settings, export your own data as CSV whenever you like, and delete your full account and data yourself from Settings (see above).",
      ],
    },
    {
      heading: "International data transfer",
      paragraphs: ["Your data is stored in the United States (Supabase's us-west-2 region)."],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If we make material changes to this policy, we'll update the date above and, where appropriate, notify you in the app.",
      ],
    },
    {
      heading: "Contact us",
      paragraphs: ["Questions about this policy or your data: https://contempo.hejitech.workers.dev/feedback/."],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: "Terms of Service",
  effectiveDateNotice: "Effective date: August 11, 2026.",
  sections: [
    {
      heading: "Acceptance of terms",
      paragraphs: [
        "By using Contempo (the Android app, the iOS app, or the web app), you agree to these Terms of Service. If you don't agree, please don't use the app.",
      ],
    },
    {
      heading: "Description of service",
      paragraphs: [
        "Contempo is a record-keeping tool that helps short-term rental hosts and real estate professionals log hours contemporaneously in support of IRS material participation tests (the 100-hour / 500-hour STR tests, or the 750-hour REPS test).",
      ],
    },
    {
      heading: "Not tax or legal advice",
      paragraphs: [
        "Nothing in Contempo — including the AI chat feature that answers general questions — constitutes tax or legal advice. It is not a substitute for a qualified CPA or attorney.",
        "Contempo helps you keep a more complete, timely record of your own hours. It does not guarantee that your records will satisfy the IRS, survive an audit, or qualify you for any particular tax treatment.",
      ],
    },
    {
      heading: "Eligibility and accounts",
      paragraphs: [
        "You must be an adult capable of forming a binding contract to use Contempo, and you sign in using a Google account. You're responsible for maintaining the security of that account.",
      ],
    },
    {
      heading: "Your content and responsibility for accuracy",
      paragraphs: [
        "You're solely responsible for the accuracy of what you log — Contempo assists with capture and structuring, but it doesn't verify that your entries are true.",
        "You agree not to use Contempo to fabricate, backdate in a misleading way, or otherwise misrepresent records.",
      ],
    },
    {
      heading: "Subscriptions and billing",
      paragraphs: [
        "Any paid features are sold only through the Contempo web app, never through an in-app purchase on Android or iOS. As of this writing, billing is not yet live.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "You agree not to use Contempo unlawfully, attempt to breach its security, or interfere with other users' access to the service.",
      ],
    },
    {
      heading: "Intellectual property",
      paragraphs: [
        "Hejitech owns Contempo's app, branding, and underlying technology. You retain ownership of the content you log.",
      ],
    },
    {
      heading: "Disclaimers",
      paragraphs: [
        "Contempo is provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including fitness for a particular purpose.",
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, Hejitech is not liable for indirect, incidental, or consequential damages arising from your use of Contempo, including any tax, audit, or legal outcome.",
      ],
    },
    {
      heading: "Termination",
      paragraphs: [
        "You may stop using Contempo and request account deletion at any time. We may suspend or terminate access for violation of these terms.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These Terms are governed by the laws of the State of California, without regard to its conflict-of-laws principles. Any dispute arising from these Terms or your use of Contempo is subject to the jurisdiction of the state and federal courts located in California.",
      ],
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        "If we make material changes, we'll update the date above and, where appropriate, notify you in the app.",
      ],
    },
    {
      heading: "Contact us",
      paragraphs: ["Questions about these terms: https://contempo.hejitech.workers.dev/feedback/."],
    },
  ],
};
