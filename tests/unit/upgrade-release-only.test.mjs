import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-upgrade-release-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, "repo");
  const bin = path.join(dir, "bin");
  const bundle = path.join(dir, "bundle");
  for (const name of [repo, bin, bundle]) fs.mkdirSync(name);
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Release test",
    GIT_AUTHOR_EMAIL: "release-test@example.com",
    GIT_COMMITTER_NAME: "Release test",
    GIT_COMMITTER_EMAIL: "release-test@example.com",
    OMNIROUTE_GITHUB_REPOSITORY: "Example/OmniRoute",
    OMNIROUTE_DEPLOY_BRANCH: "to/main",
    PATH: `${bin}:${process.env.PATH}`,
    FIXTURE_DIR: dir,
    FAIL_HEALTH: options.failHealth ? "1" : "0",
    FAIL_START: options.failStart ? "1" : "0",
    FAIL_DOWNLOAD: options.failDownload ? "1" : "0",
  };
  function run(command, args, cwd = repo) {
    const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout}`);
    return result.stdout.trim();
  }
  const git = (...args) => run("git", args);
  run("git", ["init", "--bare", path.join(dir, "origin.git")], dir);
  git("init", "--initial-branch=to/main");
  git("config", "core.autocrlf", "false");
  fs.mkdirSync(path.join(repo, "scripts"));
  fs.copyFileSync(
    path.join(root, "scripts/install-prebuilt.sh"),
    path.join(repo, "scripts/install-prebuilt.sh")
  );
  fs.writeFileSync(path.join(repo, ".gitignore"), "dist/\n.env\nupgrade.sh\n");
  fs.writeFileSync(path.join(repo, "ecosystem.config.cjs"), "module.exports = {};\n");
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ version: "3.8.50" }));
  git("add", ".");
  git("commit", "-m", "release fixture");
  const releaseCommit = git("rev-parse", "HEAD");
  const sha = releaseCommit.slice(0, 7);
  const tag = `prebuilt-3.8.50-${sha}`;
  git("tag", tag);
  fs.writeFileSync(path.join(repo, "unreleased.txt"), "not released\n");
  git("add", ".");
  git("commit", "-m", "unreleased branch tip");
  const originalCommit = git("rev-parse", "HEAD");
  if (options.badTag) git("tag", "-f", tag, originalCommit);
  git("remote", "add", "origin", path.join(dir, "origin.git"));
  git("push", "origin", "to/main", "--tags");
  const release = {
    draft: false,
    prerelease: false,
    published_at: "2026-09-24T08:00:00Z",
    tag_name: tag,
    assets: [
      {
        name: `omniroute-prebuilt-3.8.50-${sha}.tar.gz`,
        state: "uploaded",
        browser_download_url: `https://github.com/Example/OmniRoute/releases/download/${tag}/omniroute-prebuilt-3.8.50-${sha}.tar.gz`,
      },
    ],
    ...options.release,
  };
  fs.writeFileSync(path.join(dir, "release.json"), JSON.stringify(release));
  fs.writeFileSync(path.join(bundle, "server.js"), "// bundle fixture\n");
  fs.writeFileSync(path.join(bundle, "BUILD_SHA"), options.badSha ? "deadbee\n" : `${sha}\n`);
  fs.writeFileSync(
    path.join(bundle, "package.json"),
    JSON.stringify({ version: options.badVersion ? "3.8.49" : "3.8.50" })
  );
  run("tar", ["-czf", path.join(dir, "bundle.tar.gz"), "-C", bundle, "."], dir);
  fs.mkdirSync(path.join(repo, "dist"));
  fs.writeFileSync(path.join(repo, "dist/BUILD_SHA"), "previous-build\n");
  fs.writeFileSync(path.join(repo, "dist/package.json"), JSON.stringify({ version: "3.8.50" }));
  fs.writeFileSync(path.join(repo, ".env"), "PORT=21001\nDASHBOARD_PORT=21002\n");
  fs.copyFileSync(path.join(root, "upgrade.sh.example"), path.join(repo, "upgrade.sh"));
  const shim = (name, content) => fs.writeFileSync(path.join(bin, name), content, { mode: 0o755 });
  shim(
    "curl",
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const dir = process.env.FIXTURE_DIR;
const url = args.find(a => /^https?:/.test(a));
fs.appendFileSync(path.join(dir, "curl.log"), url + "\\n");
if (url.includes("/api/monitoring/health")) {
  console.log(JSON.stringify({status: process.env.FAIL_HEALTH === "1" ? "unhealthy" : "healthy"}));
} else {
  if (url.includes("/download/") && process.env.FAIL_DOWNLOAD === "1") process.exit(22);
  const source = path.join(dir, url.includes("api.github.com") ? "release.json" : "bundle.tar.gz");
  const index = args.indexOf("-o");
  if (index >= 0) fs.copyFileSync(source, args[index + 1]);
  else process.stdout.write(fs.readFileSync(source));
}
`
  );
  shim(
    "pm2",
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const dir = process.env.FIXTURE_DIR;
const args = process.argv.slice(2);
fs.appendFileSync(path.join(dir, "pm2.log"), args.join(" ") + "\\n");
if (args[0] === "start" && process.env.FAIL_START === "1") {
  const marker = path.join(dir, "start-failed");
  if (!fs.existsSync(marker)) { fs.writeFileSync(marker, "1"); process.exit(1); }
}
`
  );
  shim("sleep", "#!/bin/sh\nexit 0\n");
  return {
    repo,
    dir,
    git,
    sha,
    tag,
    releaseCommit,
    originalCommit,
    upgrade: (shell = "bash") =>
      spawnSync(shell, ["upgrade.sh"], { cwd: repo, env, encoding: "utf8", timeout: 15000 }),
  };
}

function unchanged(f) {
  assert.equal(f.git("rev-parse", "HEAD"), f.originalCommit);
  assert.equal(f.git("branch", "--show-current"), "to/main");
  assert.equal(
    fs.readFileSync(path.join(f.repo, "dist/BUILD_SHA"), "utf8").trim(),
    "previous-build"
  );
}

test("upgrade follows the published tag, never the newer branch tip", (t) => {
  const f = fixture(t);
  const result = f.upgrade();
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(f.git("rev-parse", "HEAD"), f.releaseCommit);
  assert.equal(f.git("branch", "--show-current"), "");
  assert.equal(fs.readFileSync(path.join(f.repo, "dist/BUILD_SHA"), "utf8").trim(), f.sha);
  assert.ok(result.stdout.includes(f.tag));
  assert.ok(!fs.existsSync(path.join(f.repo, "unreleased.txt")));
  assert.ok(
    fs
      .readFileSync(path.join(f.dir, "curl.log"), "utf8")
      .includes("http://127.0.0.1:21002/api/monitoring/health")
  );
});

test("upgrade also works when invoked with sh", (t) => {
  const f = fixture(t);
  const result = f.upgrade("sh");
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(f.git("rev-parse", "HEAD"), f.releaseCommit);
});

for (const [name, options] of [
  ["missing artifact", { release: { assets: [] } }],
  ["draft", { release: { draft: true } }],
  ["prerelease", { release: { prerelease: true } }],
  ["unversioned tag", { release: { tag_name: "to/main" } }],
  ["unpublished release", { release: { published_at: null } }],
  ["download failure", { failDownload: true }],
  ["tag/asset SHA mismatch", { badTag: true }],
  ["wrong bundle SHA", { badSha: true }],
  ["wrong bundle version", { badVersion: true }],
]) {
  test(`upgrade rejects ${name} without changing source or stopping the old server`, (t) => {
    const f = fixture(t, options);
    const result = f.upgrade();
    assert.notEqual(result.status, 0, result.stdout);
    unchanged(f);
    assert.ok(!fs.existsSync(path.join(f.dir, "pm2.log")));
  });
}

for (const [name, options] of [
  ["startup", { failStart: true }],
  ["health", { failHealth: true }],
]) {
  test(`upgrade restores the previous bundle and checkout after ${name} failure`, (t) => {
    const f = fixture(t, options);
    const result = f.upgrade();
    assert.notEqual(result.status, 0, result.stdout);
    unchanged(f);
    const calls = fs.readFileSync(path.join(f.dir, "pm2.log"), "utf8");
    assert.equal(calls.match(/^start /gm)?.length, 2, "restart the old bundle on rollback");
  });
}

test("upgrade refuses to discard tracked local edits", (t) => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.repo, "ecosystem.config.cjs"), "// local edit\n");
  assert.notEqual(f.upgrade().status, 0);
  unchanged(f);
  assert.ok(
    fs.readFileSync(path.join(f.repo, "ecosystem.config.cjs"), "utf8").includes("local edit")
  );
  assert.ok(!fs.existsSync(path.join(f.dir, "pm2.log")));
});
