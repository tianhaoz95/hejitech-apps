#!/usr/bin/env node
// App Store Connect API client for the heji-app-store-connect skill. No dependencies.
// Credentials: ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH, or the FA_ASC_KEY_ID / FA_ASC_ISSUER_ID /
// FA_KEY_LOCATION variables the shell profile sets (~/.config/heji/machine-env.zsh).
//
//   asc.mjs GET  'v1/apps?filter[bundleId]=com.hejitech.x'      # any call; prints the JSON
//   asc.mjs POST v1/bundleIds body.json                         # body from a file, or - for stdin
//   asc.mjs PATCH v1/appInfoLocalizations/<id> body.json
//   asc.mjs status <bundle id>              # bundle id, app record, versions, builds, tester groups
//   asc.mjs register-bundle <bundle id> <name>                  # idempotent
//   asc.mjs invite-tester <bundle id> <email> [group name]      # internal group (default "Team"),
//                                                               # add the tester, send the invite
//
// Exit codes: 0 ok, 1 API error, 2 usage, 3 the app record doesn't exist yet.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const env = process.env;
const KEY_ID = env.ASC_KEY_ID || env.FA_ASC_KEY_ID;
const ISSUER = env.ASC_ISSUER_ID || env.FA_ASC_ISSUER_ID;
const KEY_PATH =
  env.ASC_KEY_PATH || env.FA_KEY_LOCATION || (KEY_ID && `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`);
const die = (msg, code = 2) => {
  console.error(`!! ${msg}`);
  process.exit(code);
};
if (!KEY_ID || !ISSUER) die("set ASC_KEY_ID + ASC_ISSUER_ID (or source ~/.config/heji/machine-env.zsh for FA_ASC_*)");

const b64url = (b) => Buffer.from(b).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const sig = createSign("SHA256")
    .update(`${head}.${body}`)
    .sign({ key: readFileSync(KEY_PATH), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}
const token = jwt();

export async function asc(method, path, body) {
  const url = `https://api.appstoreconnect.apple.com/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path}: ${res.status} ${text.slice(0, 600)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

const findApp = async (bundleId) =>
  (await asc("GET", `v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`)).data.find(
    (a) => a.attributes.bundleId === bundleId,
  );
const findBundle = async (bundleId) =>
  (await asc("GET", `v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}`)).data.find(
    (b) => b.attributes.identifier === bundleId,
  );

const [cmd, ...args] = process.argv.slice(2);
try {
  if (["GET", "POST", "PATCH", "DELETE"].includes(cmd)) {
    const [path, file] = args;
    if (!path) die("usage: asc.mjs <METHOD> <path> [body.json|-]");
    const body = file ? JSON.parse(readFileSync(file === "-" ? 0 : file, "utf8")) : undefined;
    console.log(JSON.stringify(await asc(cmd, path, body), null, 2));
  } else if (cmd === "register-bundle") {
    const [id, name] = args;
    if (!id || !name) die("usage: asc.mjs register-bundle <bundle id> <name>");
    const have = await findBundle(id);
    if (have) console.log(`== ${id} already registered (${have.id})`);
    else {
      const r = await asc("POST", "v1/bundleIds", {
        data: { type: "bundleIds", attributes: { identifier: id, name, platform: "IOS" } },
      });
      console.log(`== registered ${id} (${r.data.id})`);
    }
  } else if (cmd === "status") {
    const [id] = args;
    if (!id) die("usage: asc.mjs status <bundle id>");
    const bundle = await findBundle(id);
    console.log(`bundle id:  ${bundle ? `registered (${bundle.id})` : "not registered"}`);
    const app = await findApp(id);
    if (!app) {
      console.log("app record: none (create it in App Store Connect: SKILL.md step 2)");
      process.exit(3);
    }
    console.log(`app record: ${app.attributes.name} (${app.id}), SKU ${app.attributes.sku}`);
    const versions = (await asc("GET", `v1/apps/${app.id}/appStoreVersions?limit=10`)).data;
    for (const v of versions)
      console.log(`version:    ${v.attributes.platform} ${v.attributes.versionString} ${v.attributes.appStoreState}`);
    const builds = (await asc("GET", `v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`)).data;
    for (const b of builds)
      console.log(`build:      ${b.attributes.version} ${b.attributes.processingState} ${b.attributes.uploadedDate}`);
    const groups = (await asc("GET", `v1/apps/${app.id}/betaGroups?limit=50`)).data;
    for (const g of groups) {
      const testers = (await asc("GET", `v1/betaGroups/${g.id}/betaTesters?limit=200`)).data;
      console.log(
        `group:      ${g.attributes.name} (${g.attributes.isInternalGroup ? "internal" : "external"}): ` +
          (testers.map((t) => t.attributes.email).join(", ") || "no testers"),
      );
    }
  } else if (cmd === "invite-tester") {
    const [id, email, groupName = "Team"] = args;
    if (!id || !email) die("usage: asc.mjs invite-tester <bundle id> <email> [group name]");
    const app = await findApp(id);
    if (!app) die(`no app record for ${id} yet (SKILL.md step 2)`, 3);
    const groups = (await asc("GET", `v1/apps/${app.id}/betaGroups?limit=50`)).data;
    let group = groups.find((g) => g.attributes.name === groupName);
    if (!group) {
      // Internal: team members only, every build available at once, no Beta App Review.
      group = (
        await asc("POST", "v1/betaGroups", {
          data: {
            type: "betaGroups",
            attributes: { name: groupName, isInternalGroup: true, hasAccessToAllBuilds: true },
            relationships: { app: { data: { type: "apps", id: app.id } } },
          },
        })
      ).data;
      console.log(`== created internal group "${groupName}" (${group.id})`);
    }
    const inGroup = (await asc("GET", `v1/betaGroups/${group.id}/betaTesters?limit=200`)).data;
    let tester = inGroup.find((t) => t.attributes.email?.toLowerCase() === email.toLowerCase());
    if (tester) console.log(`== ${email} is already in "${groupName}"`);
    else {
      const known = (await asc("GET", `v1/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=1`)).data[0];
      if (known) {
        await asc("POST", `v1/betaGroups/${group.id}/relationships/betaTesters`, {
          data: [{ type: "betaTesters", id: known.id }],
        });
        tester = known;
      } else {
        tester = (
          await asc("POST", "v1/betaTesters", {
            data: {
              type: "betaTesters",
              attributes: { email },
              relationships: { betaGroups: { data: [{ type: "betaGroups", id: group.id }] } },
            },
          })
        ).data;
      }
      console.log(`== added ${email} to "${groupName}"`);
    }
    try {
      await asc("POST", "v1/betaTesterInvitations", {
        data: {
          type: "betaTesterInvitations",
          relationships: {
            app: { data: { type: "apps", id: app.id } },
            betaTester: { data: { type: "betaTesters", id: tester.id } },
          },
        },
      });
      console.log(`== invitation sent to ${email}`);
    } catch (e) {
      // Apple refuses an invitation before the app has a processed build, or when one is pending.
      console.log(`== invitation not sent yet (${e.status}): rerun after the first build is processed`);
      console.log(`   ${e.message.split("\n")[0].slice(0, 300)}`);
    }
  } else {
    die("usage: asc.mjs <GET|POST|PATCH|DELETE> <path> [body] | status <bundle id> | register-bundle <id> <name> | invite-tester <bundle id> <email> [group]");
  }
} catch (e) {
  die(e.message, 1);
}
