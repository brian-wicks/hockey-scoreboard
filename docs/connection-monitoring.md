# Checking how the connection held up during a game

Every screen (the control panel, a second operator, and each overlay, jumbotron,
pre-show or results link) watches its own connection to the server. When something
goes wrong it sends the server a short report once the connection is back:

- **disconnect**: the connection dropped. The report gives the reason and how long
  the screen was offline.
- **stall**: the clock was running but no update reached the screen for more than 5
  seconds, even though the connection looked open.
- **connect_error**: an attempt to reconnect failed.
- **error**: something went wrong in the page itself.

A screen sends at most one report every 30 seconds, and nothing at all while the
connection is fine.

## Where to find the reports

**Server log.** Every report is logged. On the server:

```
pm2 logs hockey-scoreboard-production --lines 2000 | grep Diagnostics
```

Each line includes the screen, the share link it came from, and the socket IDs it
used. The server also logs every connect and disconnect with the reason, the
transport (polling or websocket) and how long the connection lasted. Search the log
for a socket ID from a report to follow one screen through the game:

```
pm2 logs hockey-scoreboard-production --lines 5000 | grep <socket id>
```

A disconnect with the reason `ping timeout` or `transport close` means the screen's
network went away. A screen that never logs `Socket upgraded transport` is stuck on
HTTP polling, usually because the rink's network blocks WebSockets.

**Sentry.** Only serious reports go to Sentry, as warnings titled "Screen connection
problem". A report is serious if the screen was offline for 10 seconds or more, got
no updates for 10 seconds or more, dropped its connection 3 or more times, or had an
error in the page. They are grouped by screen and kind, so a bad game shows up as a
few issues rather than hundreds.

Sentry's free plan allows 5,000 events a month, so the server sends at most one
report per screen every 30 minutes, 10 an hour and 40 a day. Anything over that is
still in the server log.

## Desktop app

The desktop app doesn't use Sentry or keep a log file, so these reports aren't
saved anywhere. They only show if you start the app from a terminal.
