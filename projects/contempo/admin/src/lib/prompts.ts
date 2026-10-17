import type { AppFeedbackReport, AnonymousFeedback } from "./feedback";

export type FeedbackSelection =
  | { type: "app"; report: AppFeedbackReport }
  | { type: "anonymous"; item: AnonymousFeedback };

function appFeedbackDetailLines(report: AppFeedbackReport): string[] {
  const lines: string[] = [];
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
  return lines;
}

function anonymousFeedbackDetailLines(item: AnonymousFeedback): string[] {
  const lines: string[] = [];
  lines.push(`Submitted: ${item.createdAt.toLocaleString()}${item.email ? ` by ${item.email}` : " (no email left)"}`);
  lines.push("");
  lines.push("Feedback:");
  lines.push(`"${item.message}"`);
  lines.push("");
  lines.push(
    "This submission has no reproduction screenshot or screen context, unlike in-app 'shake to report' reports — " +
      "use your best judgement about where in the app it applies (android/, ios/, web/) and follow this repo's CLAUDE.md conventions.",
  );
  return lines;
}

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
  lines.push(...appFeedbackDetailLines(report));
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
  lines.push(...anonymousFeedbackDetailLines(item));
  return lines.join("\n");
}

/**
 * Composes a batch of selected feedback items (mix of in-app reports and
 * anonymous submissions) into a single prompt listing every task, so one
 * coding-agent session can work through all of them in a single pass instead
 * of the human copy-pasting one prompt per item.
 */
export function buildCombinedFeedbackPrompt(selection: FeedbackSelection[]): string {
  const appItems = selection.filter((s): s is Extract<FeedbackSelection, { type: "app" }> => s.type === "app");
  const anonItems = selection.filter((s): s is Extract<FeedbackSelection, { type: "anonymous" }> => s.type === "anonymous");

  const lines: string[] = [];
  lines.push(
    `I'm triaging ${selection.length} feedback items for Contempo (an iOS/Android STR material-participation hour tracker) as one batch. ` +
      "Work through every task below in a single pass — investigate each, ground it in the actual source, and either implement a fix or write a concrete plan for it — without stopping to check in with me between tasks unless you hit a genuine blocker only I can resolve.",
  );
  lines.push("");
  lines.push(
    `This batch has ${appItems.length} in-app report(s) and ${anonItems.length} anonymous submission(s), listed below as Task 1..${selection.length}.`,
  );
  lines.push(
    "Both platforms ship in parity (see CLAUDE.md) — a UI bug reported from one platform's screenshot usually needs the equivalent fix on the other platform too. " +
      "If two tasks below turn out to touch the same area of the app, feel free to fix them together, but still address every task.",
  );
  if (appItems.length > 0) {
    lines.push("");
    lines.push(
      `To see all the in-app screenshots up front: cd backend/scripts && node fetch-feedback.js --status ${appItems[0].report.status} --limit 50 ` +
        "(prints a manifest with a local file path for every matching report's screenshot).",
    );
  }

  selection.forEach((sel, i) => {
    lines.push("");
    lines.push("=".repeat(60));
    lines.push(`Task ${i + 1} of ${selection.length} — ${sel.type === "app" ? "in-app report" : "anonymous submission"}`);
    lines.push("=".repeat(60));
    lines.push(...(sel.type === "app" ? appFeedbackDetailLines(sel.report) : anonymousFeedbackDetailLines(sel.item)));
  });

  if (appItems.length > 0) {
    lines.push("");
    lines.push("=".repeat(60));
    lines.push(
      "Once you're done with all tasks above (each fixed, or a concrete plan written for it if you're not implementing directly), mark every in-app report resolved:",
    );
    appItems.forEach((s) => lines.push(`node backend/scripts/fetch-feedback.js --mark-resolved ${s.report.docPath}`));
  }

  return lines.join("\n");
}
