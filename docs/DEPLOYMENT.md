# Deployment and online play

The game is a static site on **Firebase Hosting**. Online multiplayer uses **Firebase Realtime Database** with **Firebase Auth** accounts (**Google sign-in only** for now; see [Account email links](#account-email-links)), so no game server is needed. Single-player never asks for an account.

- Project: `veinreach-game` (see `.firebaserc`)
- Site: https://veinreach-game.web.app. A custom domain can be added later; see [Going live](#going-live).
- Database: `veinreach-game-default-rtdb`, in europe-west1
- Web config: `src/multiplayer/firebase/config.ts`. These values are public identifiers, not secrets; access is controlled by the rules.

## Going live

The site, database rules and auth settings are deployed to https://veinreach-game.web.app. To publish changes, run `npx firebase login` (once per machine), then `npm run deploy`.

Still to do when you have a custom domain:

1. **Custom domain:** Firebase console → Hosting → *Add custom domain*. Add the DNS records it shows at your registrar. Firebase provisions the HTTPS certificate itself.
2. **Authorized domains:** Firebase console → Authentication → Settings → *Authorized domains*: add your domain so Google sign-in works on it.
3. **Sign-in popup (optional, recommended):** set `authDomain` in `src/multiplayer/firebase/config.ts` to your domain. That makes the Google sign-in popup show your domain instead of `veinreach-game.firebaseapp.com`, and avoids third-party-cookie problems in some browsers.
4. **App Check:**
   - Firebase console → App Check → *Apps* → register the web app with **reCAPTCHA Enterprise** (Firebase creates the key), listing your domain and `localhost`.
   - Put the site key in `APP_CHECK_SITE_KEY` in `config.ts` and redeploy.
   - Check the App Check metrics in the console. Once nearly all requests are verified, press **Enforce** for Realtime Database; unverified requests (scripts, other sites) are then rejected.
   - For local development against the real database, the console prints a debug token on `localhost`. Register it under App Check → *Manage debug tokens*.
5. **Email links:** Authentication → Templates → (pencil) → *Customize action URL*. Set it to `https://<your domain>/auth/action`; one setting covers all templates. You can also set the sender name there.

## Account email links

Verification and password-reset emails link to the game's own page at `/auth/action` (`src/ui/AuthActionPage.ts`), not Firebase's default handler. Some mobile mail apps and link scanners damage the link (for example turning `&` into `&amp;`), and the default page then fails with *"The selected page mode is invalid"*. Our page reads damaged links. If the `mode` part is missing, it asks Firebase what the code is for (`checkActionCode`).

For our page to be used, the template action URL must be set to `https://veinreach-game.web.app/auth/action`. On this free-plan (Spark) project, Firebase refuses that change, both in the console and through the API (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`). So **email/password sign-in is off for now** and online play is Google-only.

To bring email accounts back:
1. Upgrade the project to Blaze; normal usage stays within the free allowance.
2. Set the action URL above.
3. Turn Email/Password back on in Authentication → Sign-in method.
4. Restore the email form in `src/ui/menus/AccountScreen.ts`. The account functions in `src/multiplayer/firebase/account.ts` are still there, and `/auth/action` is already deployed.

`firebase.json` runs `npm run build` before each hosting deploy. Hashed JS and CSS bundles are cached for a year. Everything else (pages, including deep links like `/auth/action`, and the audio manifest) is sent with `no-cache`, so players get new versions on their next reload. The build uses `base: '/'` so deep links load `/assets/...` correctly.

## Local testing with emulators

```bash
npm run emulators           # Auth :9099, Database :9000, Emulator UI :4000
npm run dev:online          # the game, with online play pointed at the emulators
npx tsx scripts/online-smoke.ts   # 40 scripted checks: accounts, membership, kick/ban/lock, sync, rules
```

## Accounts

- Players sign in with Google. Email/password sign-in is **switched off**, both in the game and in Firebase (`signIn.email.enabled = false`), for the reason under [Account email links](#account-email-links). The rules still only accept accounts with `email_verified`, which Google accounts always have.
- Each account claims one unique username (3–16 characters: letters, numbers, `_`; case-insensitive). It can't be changed, and it's what others see in chat and on nameplates. The rules check that every chat message and avatar name matches its owner's username.
- An account can own at most **5** online worlds at once; deleting one frees its slot.
- **Delete account** (Multiplayer menu) removes the account's worlds, username and profile, then the login. Single-player saves are untouched.

## How rooms work

Rooms are stored under `rooms/<CODE>/`:

| Path | Contents |
|---|---|
| `meta` | name, seed, size, protocol version, owner uid, created time, owner's slot. Written once. |
| `settings/locked` | Owner only. While true, no new members can join. |
| `members/<uid>` | `{ name, joined }`. Only members can read or change the world. |
| `bans/<uid>` | `{ name, at }`. Owner only; a banned player can't rejoin. |
| `time` | `{ time, day }`. The present player with the lowest uid refreshes it every 5 s. |
| `flags/<flag>` | `true`. Write-once progression flags, e.g. `boss:gravelmaw`. |
| `tiles/<y*width+x>` | `fg + frame·2¹⁶ + wall·2²⁴`: every tile that differs from the generated world |
| `liquids/<index>` | `amount + type·256` |
| `chests/<x_y>`, `paintings/<x_y>` | JSON strings |
| `players/<uid>` | `{ name, info, s }`: username; appearance; position and animation. Removed on disconnect. |
| `chat/<pushId>` | `{ uid, name, text, t }` |
| `mobs/<tag>` | JSON snapshot of the creatures one player's game simulates (overwritten ~10×/s; removed on disconnect) |
| `ev/<pushId>` | `{ f: tag, t, e }`: a batch of hits, deaths and projectiles, deleted by its sender after 15 s |

Outside rooms, there are two more paths:
- `usernames/<lowercase name>` maps a username to its account.
- `users/<uid>` holds `{ name, rooms: { <slot 1–5>: <code> } }`.

`FirebaseTransport` (in `src/multiplayer/firebase/`) acts as the server. It turns the client's protocol messages into database writes, and turns database changes back into the same messages the Node server sends, so `NetworkManager` works unchanged with either backend. It ignores echoes of its own writes, so a stale echo can never undo a newer local edit. A player watches their own `members/<uid>` entry, which stays readable to them, so being kicked or banned sends them back to the menu with the reason.

Joining a room works like this:
1. Regenerate the world from the seed.
2. Replay the Unsealing if the room is unsealed.
3. Apply the stored tiles, liquids, chests and paintings.

"Put one of your worlds online" uploads only the tiles that differ from a fresh generation of the same seed.

## Shared creatures

`src/multiplayer/MobSync.ts` runs on every client, for both the Firebase and Node backends:
- **Ownership:** each creature belongs to the game that spawned it. Owners publish snapshots of creatures near other players; bosses are always published.
- **Mirrors:** other games show "puppets" that interpolate, run contact, hazard and boss-specific collisions against their own player, and forward hits to the owner. The owner applies the exact rolled damage (`ignoreDefense`), so everyone sees the same health.
- **Deaths:** the owner sends each death with the killer's tag. The killer's game rolls normal loot; every game whose player took part (dealt damage, or was within 150 tiles) rolls boss loot and records the kill.
- **Projectiles:** mirrored as events. Players' shots are harmless "ghosts" on other screens (their owner deals the damage); creature shots are real everywhere.

## Linked single-player copies

`meta.onlineCode` marks a local save as the host's copy of an online world (`src/multiplayer/linkedWorlds.ts`):
- **Online:** the session also saves into the copy (all modified chunks, chests, paintings, flags, townsfolk).
- **Single-player:** edits are recorded in `state.pendingOnline`. Before playing, the copy pulls the room (`fetchRoomSnapshot`); tiles, chests and paintings the host changed offline win.
- **Back online:** pending edits are applied to the online session, which sends them to everyone.
- **Deleting** the online world unlinks the copy.

## Security rules (`database.rules.json`)

- Only **verified** accounts with a username can do anything online. Nobody can list rooms or read another user's profile.
- A room's `meta` is written once, by its owner, into one of the owner's 5 slots.
- **Only members** can read or edit a world. You become a member by joining with the code, which the rules refuse while you're **banned** or the world is **locked**. Only the owner can kick, ban, unban, lock or delete the world.
- Tiles, liquids, chests, paintings and flags must match their expected shapes and sizes. Flags are write-once.
- Each player can write only their own avatar and their own chat, both under their own username, and chat gets a server timestamp.

**Remaining limit:** the rules can't simulate the game, so a *member* running a modified game could still make edits a normal player couldn't. Owners handle that by banning the account (the ban is enforced by the rules). App Check stops scripted clients that aren't running the real site. The self-hosted Node server (`npm run server`) validates game logic if you ever need that.

## Free-tier usage (Spark plan)

Realtime Database allows 100 simultaneous connections, 1 GB stored and 10 GB downloaded per month on the free plan. Player positions are sent about 7 times a second, and not at all while a player stands still. A late joiner downloads only the changed tiles (a few bytes each), so a few friends playing regularly fit comfortably.
