// Icecap's one Worker: every web page (./dist, built by Vite) and the API the extension and the web
// app use. The Supabase project is shared by every HEJI app, so there are no Edge Functions: server
// code with the service key runs here.
//
//   /api/*            api.ts
//   /stripe/webhook   Stripe events for Icecap Pro (billing.ts)
//   /app/*, /admin/*  the dashboard's and admin's React apps (deep links get their index.html)
//   /joined           the home page after a waitlist sign-up (ad conversion URL)
//   everything else   static assets; unknown paths go home
import { handleApi, CORS } from "./api.ts";
import { handleStripeWebhook } from "./billing.ts";
import { admin, json, type Env } from "./store.ts";

/** Single-page apps under a prefix: their deep links are served the app's index.html. */
const SPAS = ["/app", "/admin"];

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path.startsWith("/api/")) return await handleApi(req, env, admin(env));
      if (path === "/stripe/webhook" && req.method === "POST") return await handleStripeWebhook(env, admin(env), req);
    } catch (e) {
      console.error(path, e);
      return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500, path.startsWith("/api/") ? CORS : {});
    }

    const spa = SPAS.find((p) => path === p || path.startsWith(`${p}/`));
    if (spa) return env.ASSETS.fetch(new Request(new URL(`${spa}/`, url), req));
    if (path === "/joined" || path === "/joined/") return env.ASSETS.fetch(new Request(new URL("/", url), req));
    const asset = await env.ASSETS.fetch(req);
    if (asset.status !== 404) return asset;
    return Response.redirect(new URL("/", url).toString(), 302);
  },
} satisfies ExportedHandler<Env>;
