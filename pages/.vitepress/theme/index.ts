import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import HeroDock from "./HeroDock.vue";
import HeroSearch from "./HeroSearch.vue";
import NotFound from "./NotFound.vue";
import "./custom.css";

/** The deployed commit (pages.yml builds with GITHUB_SHA), for FeedbackKit's fix verification. */
declare const __PAGES_BUILD__: string;

/**
 * FeedbackKit on every page: an app's docs send feedback to that app's FeedbackKit project; the
 * rest of the site (home, monorepo guide, apps without their own project) to "HEJI Apps".
 */
const FEEDBACK: Record<string, { projectKey: string; color: string }> = {
  waypack: { projectKey: "pk_88dcc559540fd5cea57354c41dc455fcfd13", color: "#1D6FE0" },
  weehours: { projectKey: "pk_bdbb442ad21b2c2b2a6d63bdbd8621aa1b79", color: "#6d5bd0" },
  voxbrief: { projectKey: "pk_ffa7308d843fd670a9bbd1d67ad0ebf54597", color: "#1D4ED8" },
  meowtrix: { projectKey: "pk_a2157c1fc7c01f948094c73935cf997f5c0e", color: "#7c3aed" },
};
const SITE = { projectKey: "pk_8bd53e754628a1a3f02030e7f03393ff0dc9", color: "#2f5bea" };
const ENDPOINT = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback";

export default {
  extends: DefaultTheme,
  // The home hero gets a search field and the app dock under its tagline; missing pages get NotFound.
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "home-hero-actions-after": () => [h(HeroSearch), h(HeroDock)],
      "not-found": () => h(NotFound),
    }),
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;
    let current = "";
    const route = async (path: string) => {
      const segment = path.replace(/^\/hejitech-apps\//, "/").split("/")[1] ?? "";
      const section = segment in FEEDBACK ? segment : "site";
      const cfg = FEEDBACK[section] ?? SITE;
      const { FeedbackKit } = await import("feedbackkit-web");
      if (current !== section) {
        FeedbackKit.configure({ projectKey: cfg.projectKey, endpoint: ENDPOINT, appVersion: "docs", appBuild: __PAGES_BUILD__ });
        FeedbackKit.theme = { primaryColorHex: cfg.color };
        if (!current) {
          FeedbackKit.showFloatingTriggerButton();
          FeedbackKit.enableKeyboardShortcut();
          FeedbackKit.enableFixVerification();
        }
        current = section;
      }
      FeedbackKit.currentScreen = `Docs - ${path.replace(/^\/hejitech-apps/, "") || "/"}`;
    };
    void route(window.location.pathname);
    const previous = router.onAfterRouteChange;
    router.onAfterRouteChange = (to) => {
      previous?.(to);
      void route(to);
    };
  },
} satisfies Theme;
