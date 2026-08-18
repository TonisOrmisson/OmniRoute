#!/usr/bin/env node
// Validates the committed prebuilt standalone archive.
//
// Checks:
//   1. prebuilt/omniroute-prebuilt.tar.gz exists
//   2. its sha256 matches prebuilt/omniroute-prebuilt.tar.gz.sha256
//   3. it is a valid gzip tarball containing server.js at the root
//
// Run locally and in CI (prebuilt-release.yml) before publishing the archive
// as a GitHub Release asset.

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const archivePath = join(root, "prebuilt", "omniroute-prebuilt.tar.gz");
const shaPath = join(root, "prebuilt", "omniroute-prebuilt.tar.gz.sha256");

function fail(msg) {
  console.error(`[committed-prebuilt] FAIL — ${msg}`);
  process.exit(1);
}

if (!existsSync(archivePath)) {
  fail(`archive not found at ${archivePath}`);
}
if (!existsSync(shaPath)) {
  fail(`sha256 file not found at ${shaPath}`);
}

// 1. sha256 match
const expected = readFileSync(shaPath, "utf8").trim().split(/\s+/)[0];
const actual = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
if (expected !== actual) {
  fail(`sha256 mismatch:\n  expected ${expected}\n  actual   ${actual}`);
}
console.log(`[committed-prebuilt] OK — sha256 matches (${actual.slice(0, 12)}…)`);

// 2. tarball integrity + server.js present
let listing;
try {
  listing = execFileSync("tar", ["-tzf", archivePath], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (err) {
  fail(`tar -tzf failed: ${err.message}`);
}

const entries = listing
  .split(/\r?\n/)
  .filter(Boolean)
  .map((e) => e.replace(/^\.\//, ""));
if (!entries.includes("server.js")) {
  fail(`tarball root has no server.js; entries: ${entries.slice(0, 10).join(", ")}`);
}
console.log(
  `[committed-prebuilt] OK — tarball valid, server.js present (${entries.length} entries)`
);
console.log("[committed-prebuilt] PASS");
