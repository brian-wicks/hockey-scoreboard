require("dotenv").config();

const isWindows = process.platform === "win32";
const appScript = isWindows ? "cmd.exe" : "./node_modules/.bin/tsx";
const appArgs = isWindows ? "/c .\\node_modules\\.bin\\tsx.cmd server.ts" : "server.ts";
const name = `hockey-scoreboard-${process.env.NODE_ENV || "development"}`;

// Deploy target (SSH user/host and filesystem path) comes from the environment
// rather than being hardcoded here, since this file is committed — set these in
// your local, gitignored .env (loaded above) before running
// `npm run deploy:stage`/`deploy:prod`.
const deployUser = process.env.DEPLOY_USER || "CHANGEME_deploy_user";
const deployHost = process.env.DEPLOY_HOST || "CHANGEME_deploy_host";
const deployBasePath = process.env.DEPLOY_BASE_PATH || `/home/${deployUser}/hockey-scoreboard`;
const deployRepo = process.env.DEPLOY_REPO || "https://github.com/CHANGEME/hockey-scoreboard.git";

module.exports = {
  apps: [
    {
      name: name,
      cwd: ".",
      script: appScript,
      args: appArgs,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "development",
        PORT: 3696,
        VITE_BASE_URL: "http://localhost:3696",
      },
      env_staging: {
        NODE_ENV: "staging",
        PORT: 3697,
        VITE_BASE_URL: "https://stage-scoreboard.brianwicks.co.uk",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3696,
        VITE_BASE_URL: "https://scoreboard.brianwicks.co.uk",
      },
    },
  ],

  deploy: {
    staging: {
      user: deployUser,
      host: deployHost,
      key: "id_rsa",
      ref: "origin/main",
      repo: deployRepo,
      path: `${deployBasePath}/stage`,
      env: {
        NODE_ENV: "staging",
        PORT: 3697,
        VITE_BASE_URL: "https://stage-scoreboard.brianwicks.co.uk",
      },
      "post-deploy":
        "npm ci && npm run build && pm2 startOrReload ecosystem.config.cjs --env staging",
    },
    production: {
      user: deployUser,
      host: [deployHost],
      ref: "origin/main",
      repo: deployRepo,
      path: `${deployBasePath}/prod`,
      env: {
        NODE_ENV: "production",
        PORT: 3696,
        VITE_BASE_URL: "https://scoreboard.brianwicks.co.uk",
      },
      "post-deploy":
        "npm ci && npm run build && pm2 startOrReload ecosystem.config.cjs --env production",
    },
  },
};
