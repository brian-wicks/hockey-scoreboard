# Running the scoreboard at a rink with no wifi

The normal app needs the internet: it signs you in with Google, and that sign-in
has to be refreshed roughly every hour. At a rink with weak or no wifi the
refresh fails and the app stops working mid-game.

The desktop app avoids this. You install it once, open it like any other
application, and it works with the network unplugged.

## Differences from the website

- There's no sign-in. The app opens straight into the Dashboard.
- Games you run in the desktop app are saved on that laptop only. They won't
  appear in your account on the website.
- Logo and gamesheet template uploads work as usual, but the files are saved next
  to the local database instead of being sent to the cloud. A logo you added on
  the website as a web address won't load offline, so upload the image file
  itself.
- Only that laptop can open the control panel. Other devices can open share
  links and the second operator link once you turn on network access. See
  [Using a tablet or another screen](#using-a-tablet-or-another-screen).

## Installing it

Download the installer for your system from the
[latest release](https://github.com/brian-wicks/hockey-scoreboard/releases/latest):
the `.dmg` for a Mac, the `.exe` for Windows or the `.AppImage` for Linux. Copy it
to the rink laptop and install it like any other app. Neither installer is
code-signed, so the first launch needs one extra step; see
[Unsigned builds](#unsigned-builds) below.

To build an installer yourself instead, run:

```
npm run electron:build
```

The installer ends up in the `release/` folder.

## Using it on game day

1. Open Hockey Scoreboard from your Applications folder or Start menu.
2. Start a game from the Dashboard with **New game**, the same as on the website.
3. For the OBS overlay, use the overlay address shown in the app's OBS setup
   guide.
4. Export the gamesheet PDF at the end of the game as normal. The file saves to
   your computer, and you can email it once you're back on wifi.

You don't need to be online at any point.

## Using a tablet or another screen

Other devices on the same network as the laptop can show the jumbotron or
overlay, or run the game as a second operator. They don't need the internet,
only a network they share with the laptop.

1. Connect the laptop and the tablet to the same wifi. If the rink's wifi
   doesn't work, use a phone hotspot or a travel router.
2. On the laptop, open **Share** in the control panel and choose **Turn on
   network access**. The first time, your computer may ask whether to allow
   incoming connections. Choose Allow.
3. The share links now use the laptop's network address, like
   `http://192.168.1.20:3696/share/rink/jumbotron`. Scan the QR code with the
   tablet, or type the address into its browser.
4. For a second operator, set one up in the same window and give them the link
   and PIN, the same as on the website.

Network access stays on until you turn it off, including after the app
restarts. Turning it off disconnects every other device straight away.

The tablet can't open the Dashboard or the control panel's other tabs: only the
laptop can, because sign-in is off in the desktop app. A second operator gets
the Controls and Deck tabs, the same as on the website.

If the tablet can't connect:

- Check both devices are on the same network, and that the address in the link
  matches one shown in the Share window.
- Guest wifi often stops devices reaching each other. Use a phone hotspot or a
  travel router instead.
- Check the laptop's firewall allows Hockey Scoreboard to accept incoming
  connections.

The app tries port 3696 first, so links saved on a tablet keep working from one
game to the next. If something else is using that port, it picks another and the
links change for that launch.

## Data folder

Games, teams and settings are stored in a database file in the app's data
folder, which the app creates on first launch:

- macOS: `~/Library/Application Support/hockey-scoreboard/data`
- Windows: `%APPDATA%\hockey-scoreboard\data`

Back that folder up if you want to keep a season's games.

## Notes for maintainers

- Local mode turns authentication off. It's opt-in via `LOCAL_MODE=true` (see
  `src/lib/localMode.ts`), and the server refuses to start with it under
  `NODE_ENV=production`. Its own listener is on loopback only. Network access
  adds a second listener on `0.0.0.0` (`src/server/localNetwork.ts`), and
  requests that arrive through it are never treated as the owner: they get
  share links and second operator access, which check the share ID or the
  operator's PIN and token as they do on the website.
- `npm run electron:dev` runs the desktop shell against the repo without
  packaging. `npm run build:electron` only produces the bundles it needs.
- `scripts/build-electron.mjs` bundles the server to `dist-electron/server.mjs`
  because `tsx` isn't available inside a packaged app. The bundle can't contain
  any bare imports, since `Contents/Resources/server/` has no `node_modules` to
  resolve them from once installed. Cloud-only dependencies (firebase-admin,
  @sentry/node) are replaced with stubs from `electron/stubs/` at bundle time.
  `better-sqlite3` is native, so electron-builder rebuilds it for Electron's ABI
  and `electron/main.cjs` loads it by absolute path.

## Cutting a release

Pushing a new version to `main` publishes a release. `.github/workflows/tag-release.yml`
tags the commit, then `.github/workflows/release.yml` builds installers for macOS, Windows
and Linux and publishes them on the repo's GitHub Releases page.

To cut one:

1. Bump `version` in `package.json` and add the changelog entry.
2. Commit and push that to `main`.
3. Watch the "Release desktop app" workflow in the repo's Actions tab. When it
   finishes, the release is on the Releases page with the `.dmg`, `.exe` and
   `.AppImage` attached. There's no manual step.

The release notes come from that version's changelog entry. Pushing to `main` without
changing the version doesn't publish anything.

## Unsigned builds

Neither build is code-signed, because no Apple or Microsoft certificate is
configured.

On Windows, SmartScreen shows a warning the first time you open a downloaded
copy. Click "More info", then "Run anyway".

On macOS the app has no signature at all, not even an ad-hoc one. A fully
unsigned app downloaded through a browser gets quarantined, and Gatekeeper
reports **"Hockey Scoreboard is damaged and can't be opened"** instead of the
usual "unidentified developer" prompt that right-click > Open gets past. The app
isn't damaged. Remove the quarantine flag in Terminal and it will open:

```
xattr -cr "/Applications/Hockey Scoreboard.app"
```

Signing the builds properly needs a paid Apple Developer account and a Windows
code-signing certificate. That's worth setting up before handing the app to
non-technical users in larger numbers, but it isn't planned yet.
