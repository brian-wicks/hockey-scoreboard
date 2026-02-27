const isWindows = process.platform === "win32";
const appScript = isWindows ? "cmd.exe" : "./node_modules/.bin/tsx";
const appArgs = isWindows ? "/c .\\node_modules\\.bin\\tsx.cmd server.ts" : "server.ts";

module.exports = {
  apps: [
    {
      name: "hockey-scoreboard",
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
      name: "hockey-scoreboard-staging",
      user: "brianw",
      host: "54.38.215.21",
      key: "id_rsa",
      ref: "origin/main",
      repo: "https://github.com/brian-wicks/hockey-scoreboard.git",
      path: "/home/brianw/hockey-scoreboard/stage",
      env: {
        NODE_ENV: "staging",
        PORT: 3697,
        VITE_BASE_URL: "https://stage-scoreboard.brianwicks.co.uk",
      },
      "post-deploy":
        "npm ci && npm run build && pm2 startOrReload ecosystem.config.cjs --env staging",
    },
    production: {
      user: "brianw",
      host: ["54.38.215.21"],
      ref: "origin/main",
      repo: "https://github.com/brian-wicks/hockey-scoreboard.git",
      path: "/home/brianw/hockey-scoreboard/prod",
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
