const path = require("node:path");
const fs = require("node:fs");

const projectRoot = __dirname;

function readEnvValue(name) {
  try {
    const line = fs
      .readFileSync(path.join(projectRoot, ".env"), "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));
    if (!line) return undefined;
    return line.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  } catch {
    return undefined;
  }
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
      },
    },
  ],
};
