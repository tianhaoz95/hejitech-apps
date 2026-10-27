// The Polymath site's Worker: Vite-built static pages (./dist), API (/api/*),
// and the MCP server at /mcp guarded by OAuth 2.1 and personal access tokens (plt_...).
import { OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { handleApi } from "./api.ts";
import { handleMcp, type Caller } from "./mcp.ts";
import { admin, json, PREFIX, resolveAgent, supabaseUser, type Env as BaseEnv } from "./store.ts";

export interface Env extends BaseEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

interface Props {
  userId: string;
  via: "oauth" | "token";
}

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const props = ctx.props;
    if (!props?.userId) return new Response("Unauthorized", { status: 401 });
    const caller: Caller = { userId: props.userId, via: props.via };
    return handleMcp(req, caller, admin(env));
  },
};

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // API endpoints
    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, env);
    }

    // Direct personal access token auth for /mcp
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const auth = req.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ") && auth.slice(7).startsWith(PREFIX)) {
        const agent = await resolveAgent(env, auth.slice(7));
        if (agent) {
          const caller: Caller = { userId: agent.userId, via: "token" };
          return handleMcp(req, caller, admin(env));
        }
      }
    }

    // Static assets fallback
    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }

    return new Response("Not found", { status: 404 });
  },
};
