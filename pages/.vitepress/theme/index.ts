import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./custom.css";

/**
 * FeedbackKit per section: each app's docs send feedback to that app's FeedbackKit project. The
 * widget appears once a visitor opens an app's docs and follows them between sections.
 */
const FEEDBACK: Record<string, { projectKey: string; color: string }> = {
  waypack: { projectKey: "pk_88dcc559540fd5cea57354c41dc455fcfd13", color: "#1D6FE0" },
  weehours: { projectKey: "pk_bdbb442ad21b2c2b2a6d63bdbd8621aa1b79", color: "#6d5bd0" },
  voxbrief: { projectKey: "pk_ffa7308d843fd670a9bbd1d67ad0ebf54597", color: "#1D4ED8" },
};
const ENDPOINT = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback";

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;
    let current = "";
    const route = async (path: string) => {
      const section = path.replace(/^\/hejitech-apps\//, "/").split("/")[1] ?? "";
      const cfg = FEEDBACK[section];
      if (!cfg) return;
      const { FeedbackKit } = await import("feedbackkit-web");
      if (current !== section) {
        FeedbackKit.configure({ projectKey: cfg.projectKey, endpoint: ENDPOINT, appVersion: "docs" });
        FeedbackKit.theme = { primaryColorHex: cfg.color };
        if (!current) {
          FeedbackKit.showFloatingTriggerButton();
          FeedbackKit.enableKeyboardShortcut();
          FeedbackKit.enableFixVerification();
        }
        current = section;
      }
      FeedbackKit.currentScreen = `Docs - ${path.replace(/^\/hejitech-apps/, "")}`;
    };
    void route(window.location.pathname);
    const previous = router.onAfterRouteChange;
    router.onAfterRouteChange = (to) => {
      previous?.(to);
      void route(to);
    };
  },
} satisfies Theme;
