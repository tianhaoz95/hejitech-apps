// node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFile, checkWorkflow } from "./check_isolation.mjs";

const backends = {
  waypack: { schema: "public", bucket: "waypack" },
  weehours: { schema: "weehours", bucket: "weehours" },
  foo: { schema: "foo", bucket: "foo" },
  ondevice: { schema: "", bucket: "" }, // BACKEND=none
};
const found = (path, text, project = "foo") => checkFile(path, text, project, backends);
const ok = (path, text, project) => assert.deepEqual(found(path, text, project), []);
const bad = (path, text, pattern, project) => {
  const f = found(path, text, project);
  assert.ok(f.some((p) => pattern.test(p)), `expected ${pattern} in ${JSON.stringify(f)}`);
};

test("own schema, bucket and paths pass", () => {
  ok("projects/foo/src/a.ts", `
    import { x } from "@foo/core";
    import y from "../../packages/core/src/y.ts";
    createClient(url, key, { db: { schema: "foo" } });
    fetch(url + "/storage/v1/object/foo/a.wav", { headers: { "Accept-Profile": "foo" } });
    // Mentioning Waypack or Wee Hours by name in prose is fine.
  `);
});

test("paths and packages of another project fail", () => {
  bad("projects/foo/src/a.ts", `import { derive } from "@weehours/core";`, /@weehours\//);
  bad("projects/foo/README.md", "see projects/waypack/docs/DEPLOY.md", /projects\/waypack/);
  bad("projects/foo/apps/web/src/a.ts", `import x from "../../../../weehours/packages/core/src/core.ts";`, /relative path into projects\/weehours/);
  ok("projects/foo/apps/web/src/a.ts", `import x from "../../../packages/core/src/core.ts";`);
});

test("another project's schema or bucket in Supabase calls fails", () => {
  bad("projects/foo/a.ts", `createClient(u, k, { db: { schema: "weehours" } })`, /weehours's schema or bucket/);
  bad("projects/foo/a.ts", `headers: { "Accept-Profile": "weehours" }`, /schema or bucket/);
  bad("projects/foo/a.ts", `supabase.schema("weehours").from("events")`, /schema or bucket/);
  bad("projects/foo/a.ts", `supabase.storage.from("waypack").list()`, /waypack's schema or bucket/);
  bad("projects/foo/a.sh", `curl "$S/storage/v1/object/public/waypack/x.png"`, /waypack's schema or bucket/);
});

test("workflows use only their own CI names or the Apple team / Even Hub ones", () => {
  assert.deepEqual(checkWorkflow("${{ secrets.FOO_TOKEN }} ${{ vars.FOO_SUPABASE_URL }} ${{ secrets.ASC_KEY_ID }} ${{ secrets.GITHUB_TOKEN }} ${{ secrets.EVENHUB_EMAIL }}", "foo"), []);
  assert.equal(checkWorkflow("${{ vars.SUPABASE_URL }}", "foo").length, 1);
  assert.equal(checkWorkflow("${{ secrets.WEEHOURS_TOKEN }}", "foo").length, 1);
  assert.deepEqual(checkWorkflow("${{ secrets.SPARKLE_PRIVATE_KEY }}", "waypack"), [], "grandfathered");
});

test("a project without a backend claims no schema or bucket", () => {
  ok("projects/foo/a.ts", `fetch(url + "/storage/v1/object/foo/a.wav", { headers: { "Accept-Profile": "foo" } })`);
  bad("projects/foo/README.md", "see projects/ondevice/README.md", /projects\/ondevice/);
});
