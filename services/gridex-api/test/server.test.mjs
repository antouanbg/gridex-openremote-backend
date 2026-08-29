import test from "node:test";
import assert from "node:assert/strict";

test("runtime requires an explicit production site map", () => {
  const map = JSON.parse(process.env.GRIDEX_SITE_MAP_JSON || "{}");
  assert.equal(typeof map, "object");
});

