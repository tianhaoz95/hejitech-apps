import Foundation

/// Hand-copied from `android/app/src/main/java/com/hejitech/contempo/ui/legal/LegalContent.kt`
/// (itself hand-copied from `web/src/legal/content.ts`) — no shared pipeline
/// across platforms at this scale, so keep all three in sync by hand when
/// the legal text changes.
struct LegalSection {
    let heading: String
    let paragraphs: [String]
}

struct LegalDocument {
    let title: String
    let effectiveDateNotice: String
    let draftNotice: String
    let sections: [LegalSection]
}

enum LegalContent {
    static let draftNotice = "This document was drafted from Contempo's actual current implementation, not a generic template — but it has not yet been reviewed by a licensed attorney. Treat it as a working draft, not final legal terms, until that review happens."

    static let privacy = LegalDocument(
        title: "Privacy Policy",
        effectiveDateNotice: "Last updated: draft, pending legal review — see notice below.",
        draftNotice: draftNotice,
        sections: [
            LegalSection(heading: "Who we are", paragraphs: [
                "Contempo is a material-participation hour-tracking app built by Hejitech, designed to help short-term rental hosts and real estate professionals keep contemporaneous records for IRS material participation tests (the 100-hour / 500-hour STR tests, or the 750-hour REPS test).",
                "This policy describes what information Contempo collects, how it's used, and the choices you have. It applies to the Contempo Android app and the Contempo web app.",
            ]),
            LegalSection(heading: "Information we collect", paragraphs: [
                "Account information: when you sign in with Google, we receive your name, email address, and profile photo from your Google account. We don't offer any other sign-in method.",
                "Content you provide: work log entries (property, task description, duration, category, activity date), property names, photos attached as evidence, voice recordings, and mileage/trip data (distance, odometer photos, GPS coordinates for trip start/end). When location is available at the moment you capture an entry, we also store that general capture location.",
                "AI correction data: when you edit a field the AI drafted before confirming it, we log both the AI's original value and your corrected value. This is training signal we may use later to improve parsing accuracy — it isn't shared outside Contempo/Hejitech.",
            ]),
            LegalSection(heading: "How we use your information", paragraphs: [
                "To parse natural-language text or voice entries into structured fields (property, task, duration, category), using either on-device AI or Google's cloud Gemini API depending on your Settings preference (see below).",
                "To compute contemporaneity and vague-entry risk flags (a deterministic check, not an AI model), and to generate your pacing dashboard and CSV/print exports.",
                "To answer legal-question chat messages you choose to send — see the disclaimer in our Terms of Service that this feature is not tax or legal advice.",
                "To improve entry-parsing accuracy over time, using the correction data described above.",
            ]),
            LegalSection(heading: "On-device vs. cloud AI processing", paragraphs: [
                "This app's Settings screen lets you choose how entries get parsed: On-device only, Prefer on-device, or Cloud only.",
                "On-device processing (voice transcription and language-model parsing) happens entirely on your phone — that audio or text is never sent anywhere for this step.",
                "Cloud processing sends the entry's text or audio to Google's Gemini API (via Firebase) so it can be parsed there. If you choose \"On-device only\" and on-device processing isn't available on your phone, parsing falls back to manual entry rather than silently using the cloud.",
            ]),
            LegalSection(heading: "How we store and protect your information", paragraphs: [
                "Your data is stored in Google Firebase / Google Cloud (Firestore database and Firebase Storage, both in a United States region), under a per-account storage path that only your signed-in Google account can access.",
                "Firestore and Storage security rules enforce that access restriction, plus field-level validation on what can be written, and data is encrypted in transit.",
            ]),
            LegalSection(heading: "How we share your information", paragraphs: [
                "We do not sell your personal information, and we don't use third-party advertising or analytics SDKs.",
                "Your data is processed by Google/Firebase and Google's Gemini API as our infrastructure providers, under their own data-processing terms — this is what makes the app function, not sharing for their independent purposes.",
                "CSV or print exports you generate are shared only when and however you choose to share them (e.g. via your phone's share sheet to email a CPA) — Contempo doesn't send them anywhere automatically.",
            ]),
            LegalSection(heading: "Data retention and deletion", paragraphs: [
                "Entries and properties persist until you delete them yourself in the app.",
                "You can permanently delete your account and all associated data at any time from Settings, on Android or on the web — this immediately and irreversibly deletes your Firestore records, Storage photos/audio, and your sign-in account itself. If you'd rather not use the self-service option, you can also contact us at https://contempo-feedback.web.app to request deletion.",
            ]),
            LegalSection(heading: "Children's privacy", paragraphs: [
                "Contempo is intended for adult STR hosts and real estate professionals. It is not directed at children, and we do not knowingly collect information from anyone under 13.",
            ]),
            LegalSection(heading: "Your rights and choices", paragraphs: [
                "You can edit or delete any entry or property at any time, choose your AI inference mode in Settings, export your own data as CSV whenever you like, and delete your full account and data yourself from Settings (see above).",
            ]),
            LegalSection(heading: "International data transfer", paragraphs: [
                "Your data is stored in the United States (Firestore's us-central1 region).",
            ]),
            LegalSection(heading: "Changes to this policy", paragraphs: [
                "If we make material changes to this policy, we'll update the date above and, where appropriate, notify you in the app.",
            ]),
            LegalSection(heading: "Contact us", paragraphs: [
                "Questions about this policy or your data: https://contempo-feedback.web.app.",
            ]),
        ]
    )

    static let terms = LegalDocument(
        title: "Terms of Service",
        effectiveDateNotice: "Last updated: draft, pending legal review — see notice below.",
        draftNotice: draftNotice,
        sections: [
            LegalSection(heading: "Acceptance of terms", paragraphs: [
                "By using Contempo (the Android app or the web app), you agree to these Terms of Service. If you don't agree, please don't use the app.",
            ]),
            LegalSection(heading: "Description of service", paragraphs: [
                "Contempo is a record-keeping tool that helps short-term rental hosts and real estate professionals log hours contemporaneously in support of IRS material participation tests (the 100-hour / 500-hour STR tests, or the 750-hour REPS test).",
            ]),
            LegalSection(heading: "Not tax or legal advice", paragraphs: [
                "Nothing in Contempo — including the AI chat feature that answers general questions — constitutes tax or legal advice. It is not a substitute for a qualified CPA or attorney.",
                "Contempo helps you keep a more complete, timely record of your own hours. It does not guarantee that your records will satisfy the IRS, survive an audit, or qualify you for any particular tax treatment.",
            ]),
            LegalSection(heading: "Eligibility and accounts", paragraphs: [
                "You must be an adult capable of forming a binding contract to use Contempo, and you sign in using a Google account. You're responsible for maintaining the security of that account.",
            ]),
            LegalSection(heading: "Your content and responsibility for accuracy", paragraphs: [
                "You're solely responsible for the accuracy of what you log — Contempo assists with capture and structuring, but it doesn't verify that your entries are true.",
                "You agree not to use Contempo to fabricate, backdate in a misleading way, or otherwise misrepresent records.",
            ]),
            LegalSection(heading: "Subscriptions and billing", paragraphs: [
                "Any paid features are sold only through the Contempo web app, never through an in-app purchase on Android or iOS. As of this writing, billing is not yet live.",
            ]),
            LegalSection(heading: "Acceptable use", paragraphs: [
                "You agree not to use Contempo unlawfully, attempt to breach its security, or interfere with other users' access to the service.",
            ]),
            LegalSection(heading: "Intellectual property", paragraphs: [
                "Hejitech owns Contempo's app, branding, and underlying technology. You retain ownership of the content you log.",
            ]),
            LegalSection(heading: "Disclaimers", paragraphs: [
                "Contempo is provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including fitness for a particular purpose.",
            ]),
            LegalSection(heading: "Limitation of liability", paragraphs: [
                "To the fullest extent permitted by law, Hejitech is not liable for indirect, incidental, or consequential damages arising from your use of Contempo, including any tax, audit, or legal outcome.",
            ]),
            LegalSection(heading: "Termination", paragraphs: [
                "You may stop using Contempo and request account deletion at any time. We may suspend or terminate access for violation of these terms.",
            ]),
            LegalSection(heading: "Governing law", paragraphs: [
                "[Placeholder — governing law and jurisdiction to be finalized by Hejitech with legal counsel before this document is treated as final.]",
            ]),
            LegalSection(heading: "Changes to these terms", paragraphs: [
                "If we make material changes, we'll update the date above and, where appropriate, notify you in the app.",
            ]),
            LegalSection(heading: "Contact us", paragraphs: [
                "Questions about these terms: https://contempo-feedback.web.app.",
            ]),
        ]
    )
}
