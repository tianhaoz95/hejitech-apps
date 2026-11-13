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
//   asc.mjs upload-screenshots <bundle id> <display type> <png…>  # replace the editable version's
//                                                               # en-US set (APP_IPHONE_67, APP_IPAD_PRO_3GEN_129…)
//   asc.mjs upload-creative <bundle id> <header|search> <png>  # iOS 27+ product page header (3840x1646)
//                                                               # or search results asset (3:2) through the
//                                                               # Asset Library, placed on the editable version's en-US
//
// Exit codes: 0 ok, 1 API error, 2 usage, 3 the app record doesn't exist yet.
import { createHash, createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
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
      // Creating the tester with the group attached works even before the app has a build, and for
      // an email Apple already knows from another app. Linking that existing record to the group
      // (relationships/betaTesters) is refused with 409 "Tester(s) cannot be assigned" until then.
      {
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
  } else if (cmd === "upload-screenshots") {
    // Replaces the screenshots of one display type in the editable version's en-US localization:
    // reserve each file, PUT its bytes to the upload operations Apple returns, commit with the MD5,
    // then wait for Apple to finish processing (COMPLETE, or FAILED with its errors).
    const [id, displayType, ...files] = args;
    if (!id || !displayType || !files.length) die("usage: asc.mjs upload-screenshots <bundle id> <display type> <png…>");
    const app = await findApp(id);
    if (!app) die(`no app record for ${id} yet (SKILL.md step 2)`, 3);
    const versions = (await asc("GET", `v1/apps/${app.id}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED,METADATA_REJECTED`)).data;
    if (!versions.length) die(`no editable App Store version for ${id}`, 3);
    const loc = (await asc("GET", `v1/appStoreVersions/${versions[0].id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === "en-US");
    if (!loc) die("no en-US localization on the editable version");
    const sets = (await asc("GET", `v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data;
    let set = sets.find((x) => x.attributes.screenshotDisplayType === displayType);
    if (set) {
      for (const shot of (await asc("GET", `v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data) await asc("DELETE", `v1/appScreenshots/${shot.id}`);
    } else {
      set = (await asc("POST", "v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: displayType },
        relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } })).data;
    }
    const ids = [];
    for (const f of files) {
      const bytes = readFileSync(f);
      const shot = (await asc("POST", "v1/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: basename(f), fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } } })).data;
      for (const op of shot.attributes.uploadOperations) {
        const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
        const put = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
        if (!put.ok) die(`upload of ${f} failed: ${put.status} ${await put.text()}`, 1);
      }
      await asc("PATCH", `v1/appScreenshots/${shot.id}`, { data: { type: "appScreenshots", id: shot.id,
        attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") } } });
      ids.push([shot.id, basename(f)]);
    }
    for (const [sid, name] of ids) {
      let state = "";
      for (let i = 0; i < 60; i++) {
        const a = (await asc("GET", `v1/appScreenshots/${sid}`)).data.attributes.assetDeliveryState;
        state = a?.state ?? "";
        if (state === "COMPLETE") break;
        if (state === "FAILED") die(`${name}: FAILED ${JSON.stringify(a.errors)}`, 1);
        await new Promise((r) => setTimeout(r, 5000));
      }
      console.log(`== ${displayType} ${name}: ${state}`);
    }
  } else if (cmd === "upload-creative") {
    // Uploads an image to the app's Asset Library (category CREATIVE_ASSETS), waits for Apple to process
    // it, then places it on the editable version's en-US localization as the product page header or the
    // search results asset, replacing what was placed there. Reviewed with the version.
    const [id, kind, file] = args;
    const placementType = { header: "PRODUCT_PAGE_HEADER_ASSET", search: "APP_STORE_SEARCH_RESULTS_ASSET" }[kind];
    if (!id || !placementType || !file) die("usage: asc.mjs upload-creative <bundle id> <header|search> <png>");
    const app = await findApp(id);
    if (!app) die(`no app record for ${id} yet (SKILL.md step 2)`, 3);
    const versions = (await asc("GET", `v1/apps/${app.id}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED,METADATA_REJECTED`)).data;
    if (!versions.length) die(`no editable App Store version for ${id}`, 3);
    const loc = (await asc("GET", `v1/appStoreVersions/${versions[0].id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === "en-US");
    if (!loc) die("no en-US localization on the editable version");
    const lib = (await asc("GET", `v1/apps/${app.id}/assetLibrary`)).data;
    const bytes = readFileSync(file);
    const img = (await asc("POST", "v1/appAssetLibraryImages", { data: { type: "appAssetLibraryImages",
      attributes: { fileName: basename(file), fileSize: bytes.length, category: "CREATIVE_ASSETS", referenceName: `${kind} ${basename(file)} ${new Date().toISOString().slice(0, 10)}` },
      relationships: { assetLibrary: { data: { type: "appAssetLibraries", id: lib.id } } } } })).data;
    for (const op of img.attributes.uploadOperations) {
      const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
      const put = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
      if (!put.ok) die(`upload of ${file} failed: ${put.status} ${await put.text()}`, 1);
    }
    await asc("PATCH", `v1/appAssetLibraryImages/${img.id}`, { data: { type: "appAssetLibraryImages", id: img.id, attributes: { uploaded: true } } });
    let a = {};
    for (let i = 0; i < 90; i++) {
      a = (await asc("GET", `v1/appAssetLibraryImages/${img.id}`)).data.attributes;
      if (a.state === "PREPARE_FOR_SUBMISSION") break;
      if (a.state === "FAILED") die(`${basename(file)}: FAILED ${JSON.stringify(a.stateDetails ?? a)}`, 1);
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (a.state !== "PREPARE_FOR_SUBMISSION") die(`${basename(file)}: still ${a.state} after 7.5 min`, 1);
    for (const p of (await asc("GET", `v1/appStoreVersionLocalizations/${loc.id}/placements?limit=50`)).data)
      if (p.attributes.placementType === placementType) await asc("DELETE", `v1/appAssetLibraryPlacements/${p.id}`);
    const placed = (await asc("POST", "v1/appAssetLibraryPlacements", { data: { type: "appAssetLibraryPlacements",
      attributes: { placementType, placementGroup: "DEFAULT_PROFILE" },
      relationships: { image: { data: { type: "appAssetLibraryImages", id: img.id } },
        appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } })).data;
    console.log(`== ${placementType} ${basename(file)} (${a.imageAsset?.width}x${a.imageAsset?.height}): placed, ${placed.attributes.state}`);
  } else {
    die("usage: asc.mjs <GET|POST|PATCH|DELETE> <path> [body] | status <bundle id> | register-bundle <id> <name> | invite-tester <bundle id> <email> [group] | upload-screenshots <bundle id> <display type> <png…> | upload-creative <bundle id> <header|search> <png>");
  }
} catch (e) {
  die(e.message, 1);
}
