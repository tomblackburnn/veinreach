# Deployment and online play

The game is a static site on **Firebase Hosting**. Online multiplayer uses **Firebase Realtime Database** with **anonymous Firebase Auth**, so no game server is needed.

- Project: `veinreach-game` (see `.firebaserc`)
- Site: https://veinreach-game.web.app
- Database: `veinreach-game-default-rtdb`, in europe-west1
- Web config: `src/multiplayer/firebase/config.ts`. These values are public identifiers, not secrets; access is controlled by the rules.

## Deploying

```bash
npx firebase login          # once per machine
npm run deploy              # builds, then deploys hosting + database rules + auth settings
```

`firebase.json` runs `npm run build` before each hosting deploy. Hashed JS and CSS bundles are cached for a year; `index.html` is always revalidated, so players get new versions on reload.

## Local testing with emulators

```bash
npm run emulators           # Auth :9099, Database :9000, Emulator UI :4000
npm run dev:online          # the game, with online play pointed at the emulators
npx tsx scripts/online-smoke.ts   # scripted 3-player check of sync + security rules
```

## How rooms work

Rooms are stored under `rooms/<CODE>/`:

| Path | Contents |
|---|---|
| `meta` | name, seed, size, protocol version, owner uid, created time. Written once. |
| `time` | `{ time, day }`. The present player with the lowest uid refreshes it every 5 s. |
| `flags/<flag>` | `true`. Write-once progression flags, e.g. `boss:gravelmaw`. |
| `tiles/<y*width+x>` | `fg + frame·2¹⁶ + wall·2²⁴`: every tile that differs from the generated world |
| `liquids/<index>` | `amount + type·256` |
| `chests/<x_y>`, `paintings/<x_y>` | JSON strings |
| `players/<uid>` | `{ info, s }` JSON strings (name and appearance; position and animation). Removed on disconnect. |
| `chat/<pushId>` | `{ uid, name, text, t }` |

`FirebaseTransport` (in `src/multiplayer/firebase/`) acts as the server. It turns the client's protocol messages into database writes, and turns database changes back into the same messages the Node server sends, so `NetworkManager` works unchanged with either backend. It ignores echoes of its own writes, so a stale echo can never undo a newer local edit.

Joining a room works like this:
1. Regenerate the world from the seed.
2. Replay the Unsealing if the room is unsealed.
3. Apply the stored tiles, liquids, chests and paintings.

"Put one of your worlds online" uploads only the tiles that differ from a fresh generation of the same seed.

## Security rules (`database.rules.json`)

- Only signed-in (anonymous) users can read or write, and only inside a room with a valid code. Nobody can list `rooms/`.
- A room's `meta` can be created once and never changed, and the owner must be the creator.
- Tiles, liquids, chests, paintings and flags must match their expected shapes and sizes. Flags are write-once.
- Each player can write only their own `players/<uid>` entry and their own chat messages, which get a server timestamp.

Limits: the rules can't simulate the game, so a modified client could still make edits a normal player couldn't (for example, far from its avatar). Share room codes only with people you trust. The self-hosted Node server (`npm run server`) validates much more if you need that.

## Free-tier usage (Spark plan)

Realtime Database allows 100 simultaneous connections, 1 GB stored and 10 GB downloaded per month on the free plan. Player positions are sent about 7 times a second, and not at all while a player stands still. A late joiner downloads only the changed tiles (a few bytes each), so a few friends playing regularly fit comfortably.
