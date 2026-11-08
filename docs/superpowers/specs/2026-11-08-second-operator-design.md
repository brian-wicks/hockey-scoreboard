# Second operator access

Date: 2026-11-08
Status: Awaiting review

## Goal

The main operator (the owner) can give one trusted person a working control panel for the live game from the share sheet. Both people operate the same game at the same time and see each other's changes.

Access needs a link and a PIN. The owner can sign the second operator out at any time without disturbing the viewer links that OBS or a jumbotron may be using.

## Decisions

| Topic | Decision |
| --- | --- |
| Authorisation | Separate link plus a six-digit PIN. No Google account needed |
| After the PIN | The PIN is exchanged for a device token, which is used for reconnects |
| PIN lifetime | One PIN per game. When the owner's active game changes to a different one, the PIN stops working and the second operator is signed out. The link stays the same |
| Tabs available | Controls and Deck |
| Deck | Buttons can be pressed but not edited |
| Keyboard shortcuts | The owner's shortcuts, read-only |
| Overlay, Jumbotron and Results buttons | Hidden for the second operator |
| Local mode and desktop app | Not offered. Routes return 404 |
| Version bump and changelog | Left for the release step |

## Out of scope

- Access to saved games, the team library, settings or account data
- Starting or opening a game as the second operator
- More than one operator link per account
- Live updates of Deck or shortcut config. Edits by the owner reach the second operator on their next connection
- Conflict handling beyond what patches do today. If both operators change the same field at the same moment, the later change wins

## Access and security

### Creating access

The owner sets up access in a "Second operator" section of the share sheet. The server generates a `randomUUID()` for the link, `/operate/:operatorId`, and a random six-digit PIN using `crypto.randomInt`. The PIN is never part of the link or QR code.

The database stores a salted `scrypt` hash of the PIN, so the share sheet can only show the PIN at the moment it is created. A lost PIN is replaced by creating a new one.

The operator link and viewer share link are unrelated values. Neither can be derived from the other, and replacing one has no effect on the other.

### Signing in

A correct PIN returns a random device token. The record stores its SHA-256 hash and an expiry 24 hours after issue. Up to five tokens are kept, and issuing a sixth drops the oldest.

Five wrong PINs lock the link for 15 minutes. The count is per link and stored in the database, so changing IP or restarting the server does not reset it. Someone holding the link could use this to lock out the real second operator, and creating a new PIN clears the lock.

Comparisons of PIN hashes use `crypto.timingSafeEqual`.

### Removing access

"Create new PIN" keeps the link, replaces the PIN, deletes all device tokens and clears any lock. "Remove access" deletes the record. Both immediately disconnect live sockets that were authenticated through that record.

### A new PIN for each game

When the owner's active game changes from a known game to a different one, through `startNewGame` or through `openGame` with a different ID, the server calls `resetForNewGame(userId)`. It stores `pinHash: ""`, `pinSalt: ""`, `tokens: []`, `failedAttempts: 0` and `lockedUntil: null` under the same locks as the owner routes, then disconnects second operator sockets. The empty values mean "no PIN for this game", so there is no schema change, and the link is kept.

The reset runs while the old game is still live, before the new game is assigned to the owner's context or sent to anyone. A second operator therefore never receives the next game's state on a session from the previous game. A socket whose handshake read the old record could join the room after the disconnect, so operator sockets start in a separate `operators:{userId}` room that only the disconnect uses, and join the owner's room once the session re-check has passed.

Reopening the same game changes nothing. With no previous game (`context.gameId` is null) nothing changes either, so a PIN set up before the very first game and the waiting screen keep working.

### Server permissions

An operator socket joins the owner's room with `socket.data.isOperator = true` and `isViewer = false`.

| Socket event | Second operator |
| --- | --- |
| `applyGamePatch` | Allowed |
| `startClock`, `stopClock`, `setClock`, `clockIncrease`, `clockDecrease` | Allowed |
| `updateGameState` | Refused. The client only sends changes through `applyGamePatch` |
| `startNewGame`, `openGame` | Refused |

Account REST routes keep requiring the owner's Google token. They do not accept operator tokens.

PINs, tokens and operator links are never logged. Log lines refer to the owner's `userId` and the socket id.

The request log and Sentry events also keep sign-in credentials out, on every route. pino-http's serializers replace the `authorization` and `cookie` request headers and the `set-cookie` response header with `[hidden]`, working on a copy so the live request keeps its values. `scrubEvent` does the same for `event.request.headers` in any letter case and for each value in `event.request.cookies`, since the SDK's RequestData integration copies both onto every event.

### Accepted limit

The server's permission boundary is the live game's state. Someone with the link and PIN and a modified client could change any patchable game field, such as a team name, even though the UI only offers Controls and Deck. Their patches pass through the same `sanitizeGamePatch` as the owner's, so they cannot reach account data, the saved game list or other games.

## Data model

```ts
interface OperatorDeviceToken {
  tokenHash: string; // SHA-256, hex
  expiresAt: number; // epoch ms
}

interface OperatorAccess {
  operatorId: string;
  userId: string;
  pinHash: string;
  pinSalt: string;
  failedAttempts: number;
  lockedUntil: number | null; // epoch ms
  tokens: OperatorDeviceToken[];
}
```

Each account has at most one record. `DbAdapter` in `src/db/types.ts` gains these methods, implemented in both adapters:

```ts
getOperatorAccess(operatorId: string): Promise<OperatorAccess | null>;
getUserOperatorAccess(userId: string): Promise<OperatorAccess | null>;
setOperatorAccess(access: OperatorAccess): Promise<void>;
deleteOperatorAccess(userId: string): Promise<void>;
```

SQLite gets an `operator_access` table with `operatorId` as primary key, a unique `userId`, and a JSON column for tokens. Firestore follows the existing shares layout: an `operators/{operatorId}` document, plus an `operatorId` field on the user doc that avoids a `where()` query. Writes keep the record and the user doc field in step, as `setUserIdShare` does.

The electron stubs need no new behaviour, because the routes return 404 in local mode.

## API

| Route | Auth | Behaviour |
| --- | --- | --- |
| `GET /api/operator-access` | Owner | `{ operatorId, needsPin }`, with `needsPin` true when the current game has no PIN yet, or `{ operatorId: null, needsPin: false }` |
| `POST /api/operator-access` | Owner | Creates the link if needed and issues a new PIN. Returns `{ operatorId, pin }`. Deletes tokens, clears any lock and disconnects live sockets |
| `DELETE /api/operator-access` | Owner | Deletes the record and disconnects live sockets |
| `POST /api/operator/:operatorId/session` | Link holder | Body `{ pin }`. See the responses below |

Session responses:

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ token }` | PIN correct. Failed attempts reset to zero |
| 400 | `{ error }` | PIN is not six digits. Does not count as an attempt |
| 401 | `{ error, attemptsLeft }` | Wrong PIN |
| 404 | `{ error }` | Unknown link |
| 409 | `{ error: "No PIN for this game" }` | The owner has changed game and not created a new PIN. Checked after the link and PIN format. Does not count as an attempt or run `scrypt` |
| 429 | `{ error, retryAfterSeconds }` | Locked, or the per-IP limit was reached |

The owner `POST` uses the existing `shareCreationLimiter`. The session route gets its own per-IP limiter of 30 requests per 15 minutes. All four routes return 404 in local mode.

### Socket handshake

`io.use` gains a branch for `auth.operatorId` and `auth.operatorToken`. The token's hash must match an unexpired entry on the record. Failure returns `Authentication error: Operator session ended`, and the client uses that text to tell a rejected token from a network failure. Local mode rejects this branch.

After connecting, an operator socket gets the usual `gameState` and `activeGame` events, plus:

```ts
socket.emit("operatorConfig", { streamDeck, shortcuts });
```

Both values come from the owner's config, with the same fallback to the global file as the REST routes. That fallback moves into a shared helper. An unreadable config sends `null`, and the client keeps its defaults.

A token that expires while its socket is connected has no immediate effect. The next reconnect is rejected and the PIN screen appears.

## Client

### Share sheet

`ShareModal.tsx` gets a "Second operator" section below the viewer links. It works whether or not viewer links exist yet, and it is hidden in local mode. The modal body scrolls, because the added content will not fit on smaller screens at its current height.

| State | Shown |
| --- | --- |
| No access yet | A line explaining the feature and a "Set up second operator" button |
| Just created, or new PIN | Link, QR code and the PIN in large digits, with a note that the PIN will not be shown again |
| Reopened later | Link and QR code, with "Create new PIN" and "Remove access" |
| Reopened after the game changed | "This game has no PIN yet. Create one and give it to the second operator." with the link, QR code, "Create new PIN" and "Remove access" |

"Create new PIN" and "Remove access" go through the existing `ConfirmDialog`, because both sign the second operator out mid-game. The exception is "Create new PIN" when the game has no PIN, which creates one directly because nobody can be signed in.

The existing warning stays as it is, because it describes the viewer links.

### Second operator route

`/operate/:operatorId` renders a new `OperatorGate` component in `src/components/control-panel/`, which decides between these screens:

| Situation | Shown |
| --- | --- |
| No token | PIN screen, using `inputMode="numeric"` and `autoComplete="one-time-code"` |
| Wrong PIN | PIN screen with the attempts left |
| Locked | PIN screen with the time to wait |
| Unknown or removed link | A message asking them to get a new link from the main operator |
| Signed out by the owner, or token rejected | PIN screen with a message saying the session ended |
| The current game has no PIN yet | PIN screen with "This game needs a new PIN. Ask the main operator for it." |
| Connected, no active game | "Waiting for a game to start" |
| Connected, active game | `ControlPanel` |

`App.tsx` treats `isOperator` like `isViewer` when deciding whether to show the sign-in screen, and leaves the footer off `/operate/` routes. Its "Share link not found" screen is not used for this route.

### Control panel

`ControlPanel` skips its redirect to the Dashboard for a second operator, because `OperatorGate` handles the no-game state.

`AppSidebar` takes the list of tabs to show, which is Controls and Deck for a second operator. `StreamDeckPanel` hides the edit button.

`ControlPanelHeader` keeps the wordmark, connection status and Undo. It hides Close, Share, Results, Overlay, Jumbotron and the account menu, in both the desktop and mobile layouts. The wordmark is not a link. These checks use `isOperator`, so a Firebase user signed in on the same browser does not bring the account menu back.

### Store

New state: `isOperator`, `operatorId` and `operatorAuth`, an object holding the status plus attempts left or the wait time.

New actions: `submitOperatorPin(pin)` and `connectOperator(operatorId, token)`. `ensureInitialized` checks for the `/operate/` path before it looks at the signed-in user, so this route always uses the PIN and never the owner's account.

The token is kept in `sessionStorage` under a key that includes the `operatorId`. A reload stays signed in, and closing the tab means entering the PIN again.

`connect` and `connectOperator` share their `gameState` handling and in-transit change tracking through one extracted helper, so a second operator on a poor connection gets the same behaviour as the owner. Only `connect` touches the local game state cache, so a second operator on a shared computer cannot overwrite a cached game.

Export PDF in the event log uses the layout saved in the second operator's own browser, or the default layout, because `loadPdfLayout` does not read the owner's account.

`updateState`, undo and clock actions work unchanged over the socket. Undo reverses only that device's changes, because each device keeps its own undo stack. The `operatorConfig` event fills `streamDeckConfig` and `keyboardShortcuts`, and the REST config loaders are not called.

## Failure cases

| Case | Behaviour |
| --- | --- |
| Parallel PIN guesses | Checked one at a time per link through an in-process queue, so they cannot exceed the limit |
| New PIN or removal while a guess is in flight | Owner writes use the same queue, so a guess cannot save a stale copy over the new record |
| Database fault during the handshake | The handshake fails with a different message, the token is kept, and the client retries after two seconds, because Socket.IO does not retry server middleware errors itself |
| Attempt count cannot be saved | The PIN is refused with a 500, so a database fault cannot remove the limit |
| Database error while reading the record | 500. Does not count as an attempt |
| Token rejected on reconnect | The stored token is cleared and the PIN screen appears |
| Network failure | The token is kept and the socket keeps retrying, so a wifi drop does not sign anyone out |
| Server restart | Tokens and lockouts persist in the database, so the second operator reconnects without the PIN |
| Server disconnects the socket on revocation | Socket.IO does not reconnect after a server-side disconnect, so the client treats this reason as a session end and shows the PIN screen |
| Owner's game changes | The PIN stops working and the second operator is signed out before the new game's state is sent |
| PIN sent for a game with no PIN yet | 409 and the gate asks for a new PIN. Nothing is counted, and the form stays usable |
| Database fault while resetting for a new game | Logged with the `userId` only. The second operator is still disconnected and the owner's game still changes. The old PIN and tokens stay valid until the owner creates a new PIN, because they could not be cleared |
| Owner signs out or closes their browser | The second operator stays connected and the clock keeps running, because `userContexts` entries in `serverApp.ts` are not removed on disconnect |

## Documentation

`design.md` gets the `/operate/:operatorId` route. All new copy follows `tropes.md`.

## Testing

Written test first, following the existing test files.

Server tests in `src/test/server.test.ts`:
- PIN success, wrong PIN, malformed PIN and unknown link
- Lockout after five failures, the lock expiring, and a new PIN clearing it
- Parallel guesses not exceeding the limit
- Token expiry, the five-token cap, and rejected tokens at the handshake
- New PIN and removal disconnecting live sockets
- Each allowed and refused socket event
- Account REST routes rejecting operator tokens
- Viewer links staying read-only, and their share ID being refused as an operator credential
- `operatorConfig` contents and fallback
- All routes returning 404 in local mode, using `src/test/localModeServer.test.ts`

Adapter tests in `src/test/db/`: the same behaviour on SQLite and Firestore.

Client tests:
- `ShareModal`: each state, confirm dialogs, local mode hiding the section
- `OperatorGate`: each screen in the table above
- Store: `connectOperator`, token storage, rejected token versus network failure, cache left untouched
- `ControlPanel`, `ControlPanelHeader`, `AppSidebar` and `StreamDeckPanel` for a second operator

Real app check with two browsers:
- Changes appear in both directions, including the clock
- Deck buttons work and cannot be edited
- Creating a new PIN and removing access both sign the second operator out straight away
- A reload stays signed in, and a dropped connection recovers without the PIN
