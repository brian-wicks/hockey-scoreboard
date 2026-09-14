# Running the scoreboard at a rink with no wifi

The normal app needs the internet: it signs you in with Google, and that sign-in
has to be refreshed roughly every hour. At a rink with weak or no wifi that
fails, and the app becomes unusable mid-game.

The **desktop app** solves this. It's a normal application you install once and
double-click, and it works with the network unplugged.

## What's different in the desktop app

- **No sign-in.** It opens straight into the Dashboard.
- **Everything stays on the laptop.** Games you run offline are saved on that
  machine only — they will not appear in your account on the website.
- **Logo and template uploads work, and stay on the laptop.** Drop in a team
  crest or your own blank gamesheet PDF as usual; the file is saved alongside the
  local database instead of being sent to the cloud. A logo you pasted as a web
  *address* on the website won't load offline, though — upload the image file
  itself instead.
- **Only that laptop can control the game.** The app is not reachable from other
  devices on the rink's network. This is deliberate: with sign-in switched off,
  anyone who could reach it could change the score.

## Installing it

Ask whoever set up the scoreboard to build the installer once:

```
npm run electron:build
```

That produces an installer in the `release/` folder — `.dmg` on a Mac, `.exe` on
Windows. Copy it to the rink laptop and install it like any other app.

## Using it on game day

1. Open **Hockey Scoreboard** from your Applications folder or Start menu.
2. It opens on the Dashboard. Start a game with **New Game**, exactly as on the
   website.
3. For the OBS overlay, use the same overlay address as usual — the setup guide
   in the app shows it.
4. Export the gamesheet PDF at the end of the game as normal. The file saves to
   your computer, so you can email it once you're back on wifi.

You do not need to be online at any point.

## Where the data lives

Games, teams, and settings are stored in a database file inside the app's own
data folder, which the app creates on first launch:

- macOS: `~/Library/Application Support/hockey-scoreboard/data`
- Windows: `%APPDATA%\hockey-scoreboard\data`

Back that folder up if a season's games matter to you.

## Notes for whoever maintains this

- Local mode is a real authentication bypass. It's opt-in via `LOCAL_MODE=true`
  (see `src/lib/localMode.ts`), the server refuses to start with it under
  `NODE_ENV=production`, and it binds loopback only.
- `npm run electron:dev` runs the desktop shell against the repo without
  packaging. `npm run build:electron` just produces the bundles it needs.
- The server is bundled to `dist-electron/server.mjs` by
  `scripts/build-electron.mjs` because `tsx` isn't available inside a
  packaged app. `better-sqlite3` stays external and is rebuilt for Electron's ABI
  by electron-builder.
