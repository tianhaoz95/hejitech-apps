import type { AppFeedbackReport, AnonymousFeedback } from "./feedback";

/**
 * Builds a paste-into-your-local-coding-agent prompt from one in-app
 * ("shake to report") feedback report — same methodology as
 * .claude/skills/triage-feedback/SKILL.md (ground in real source, check
 * both platforms, mark resolved when done), just packaged as one static
 * block of text instead of an interactive skill run, since the point here
 * is "click a button on the admin site, paste the result into a separate
 * local agent session."
 */
export function buildAppFeedbackPrompt(report: AppFeedbackReport): string {
  const lines: string[] = [];
  lines.push(
    "I'm triaging in-app feedback for Contempo (an iOS/Android STR material-participation hour tracker). " +
      "Investigate this report and either implement a fix or write a concrete plan.",
  );
  lines.push("");
  lines.push(`Report: ${report.docPath}`);
  lines.push(`Screen: ${report.screenName}`);
  lines.push(`App version: ${report.appVersion} (build ${report.buildNumber})`);
  lines.push(`Device: ${report.deviceModel}, OS ${report.osVersion}, locale ${report.locale}`);
  lines.push(`Submitted: ${report.createdAt.toLocaleString()}`);
  lines.push("");
  lines.push('Description (from the user):');
  lines.push(`"${report.description}"`);
  if (report.region) {
    lines.push("");
    lines.push(
      `The user boxed a region of the screenshot: x=${report.region.x.toFixed(2)}, y=${report.region.y.toFixed(2)}, ` +
        `w=${report.region.w.toFixed(2)}, h=${report.region.h.toFixed(2)} (fractions of image width/height) — that's ` +
        "the part of the screen that matters; the rest of the screenshot is just context.",
    );
  }
  lines.push("");
  lines.push("Ground this in the actual source before proposing anything — don't plan from the description alone:");
  lines.push(`- Android: android/app/src/main/java/com/hejitech/contempo/ui/${report.screenName.toLowerCase()}/`);
  lines.push(`- iOS: ios/Contempo/Sources/App/${report.screenName}/`);
  lines.push(
    "Both platforms ship in parity (see CLAUDE.md) — a UI bug reported from one platform's screenshot usually needs the equivalent fix on the other platform too.",
  );
  lines.push("");
  lines.push(
    `To see the actual screenshot, fetch it via: cd backend/scripts && node fetch-feedback.js --status ${report.status} --limit 50 ` +
      "(prints a manifest with a local file path for every pending/matching report's screenshot, including this one).",
  );
  lines.push("");
  lines.push("Once you're done (fix shipped, or a concrete plan written if you're not implementing directly), mark this report:");
  lines.push(`node backend/scripts/fetch-feedback.js --mark-resolved ${report.docPath}`);
  return lines.join("\n");
}

/** Same idea as buildAppFeedbackPrompt, for the anonymous login-free feedback/ site's submissions — much less context available, so the prompt says so. */
export function buildAnonymousFeedbackPrompt(item: AnonymousFeedback): string {
  const lines: string[] = [];
  lines.push(
    "I'm triaging user feedback for Contempo (an iOS/Android STR material-participation hour tracker). " +
      "This came in anonymously through the login-free feedback form — evaluate whether it's worth acting on, and if so, implement it or write a concrete plan.",
  );
  lines.push("");
  lines.push(`Submitted: ${item.createdAt.toLocaleString()}${item.email ? ` by ${item.email}` : " (no email left)"}`);
  lines.push("");
  lines.push("Feedback:");
  lines.push(`"${item.message}"`);
  lines.push("");
  lines.push(
    "This submission has no reproduction screenshot or screen context, unlike in-app 'shake to report' reports — " +
      "use your best judgement about where in the app it applies (android/, ios/, web/) and follow this repo's CLAUDE.md conventions.",
  );
  return lines.join("\n");
}
