const path = require("node:path");
const fs = require("node:fs");

const projectRoot = __dirname;

// Parse the repo-root .env into a plain KEY=VALUE map WITHOUT invoking a shell.
// Values are taken literally up to the end of the line; surrounding quotes are
// stripped. This is the only safe way to load secrets containing `&`, `!`, `^`,
// `#`, `$`, etc. (sourcing .env with `set -a; . ./.env` would let bash evaluate
// those metacharacters). Comments and blank lines are ignored.
function parseEnvFile(envPath) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(envPath, "utf8");
  } catch {
    return out;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    value = value.replace(/^(['"])(.*)\1$/, "$2");
    if (key) out[key] = value;
  }
  return out;
}

function readEnvValue(name) {
  return parseEnvFile(path.join(projectRoot, ".env"))[name];
}

const port =
  process.env.OMNIROUTE_PORT ||
  process.env.PORT ||
  readEnvValue("OMNIROUTE_PORT") ||
  readEnvValue("PORT") ||
  "20128";
const dashboardPort =
  process.env.OMNIROUTE_DASHBOARD_PORT ||
  process.env.DASHBOARD_PORT ||
  readEnvValue("OMNIROUTE_DASHBOARD_PORT") ||
  readEnvValue("DASHBOARD_PORT") ||
  port;
const apiPort =
  process.env.OMNIROUTE_API_PORT ||
  process.env.API_PORT ||
  readEnvValue("OMNIROUTE_API_PORT") ||
  readEnvValue("API_PORT") ||
  port;

// Carry the full .env into the PM2 process env. The Next standalone server
// (dist/server-ws.mjs) does not load .env on its own — only the CLI does — so
// without this, DATA_DIR / JWT_SECRET / API_KEY_SECRET never reach the process
// and the app falls back to ~/.omniroute with freshly generated secrets.
// Process-env values win over .env (first-wins), matching the CLI loader.
const fileEnv = parseEnvFile(path.join(projectRoot, ".env"));
const processEnv = {};
for (const [k, v] of Object.entries(fileEnv)) {
  if (process.env[k] === undefined) {
    processEnv[k] = v;
  }
}

module.exports = {
  apps: [
    {
      name: "omniroute",
      cwd: path.join(projectRoot, "dist"),
      script: fs.existsSync(path.join(projectRoot, "dist", "server-ws.mjs"))
        ? path.join(projectRoot, "dist", "server-ws.mjs")
        : path.join(projectRoot, "dist", "server.js"),
      interpreter: "node",
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        PORT: port,
        DASHBOARD_PORT: dashboardPort,
        API_PORT: apiPort,
        OMNIROUTE_SERVER_HOST: "0.0.0.0",
        OMNIROUTE_NO_UPDATE_NOTIFIER: "1",
        ...processEnv,
      },
    },
  ],
};
