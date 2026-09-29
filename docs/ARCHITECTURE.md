# Architecture

## Overview

```
main.ts ─► Game (app root: canvas, InputManager, AudioManager, SaveManager, UIManager, GameLoop)
             │  menus (DOM)  ──────────────► startWorld / joinServer
             └─► GameSession  (implements GameContext)
                   ├─ World (+ Chunks)          ├─ EntityManager (Player, Enemies/Bosses, NPCs, Projectiles, Drops, Remotes)
                   ├─ systems: Time, Progression, Mining, Spawn, Weather, WorldEvents, Liquids, RandomTicks, Unsealing
                   ├─ BossManager, NPCManager
                   ├─ rendering: TileRenderer, BackgroundRenderer, LightingSystem, ParticleSystem, FloatingText
                   ├─ UI: Hud, InventoryPanel, NPCPanel, PauseMenu, Minimap, DebugConsole
                   └─ NetworkManager (optional, multiplayer)
```

- **Game** owns the long-lived services and navigation.
- **GameSession** is one running world. It is created per play session and disposed on exit.
- **GameContext** (`src/core/context.ts`) is an *interface* made only of type imports. Every entity and system receives it each tick. Entities never import the concrete session, which keeps the module graph acyclic.
- **Content lives in `src/data/`.** Registries (`TileRegistry`, `ItemRegistry`, `RecipeRegistry`) build fast lookup tables at startup and cross-validate references. Bad content is reported and skipped rather than crashing the game.

## Game loop

`GameLoop` runs a fixed 60 Hz simulation (with a spiral-of-death guard) and renders once per animation frame. Each tick, `GameSession.update()` runs in this order:

1. UI input (pause, inventory, hotbar), then player input sampled from the `InputManager`.
2. Time (dawn/dusk detection), world events, weather, spawning, NPC housing.
3. `EntityManager.update()`. Each entity is isolated in a try/catch; a failing entity is removed and logged.
4. Mining damage decay, liquids (every 3rd tick, near the player), random tile ticks, particles and floating text.
5. The Unsealing generator (time-sliced), camera follow, biome and music selection, structure discovery, autosave, network, HUD.

## World and chunk model

- **World** is `width × height` tiles split into 32×32 `Chunk`s. Each chunk holds typed arrays for `fg` (u16), `wall` (u16), `liquid` (u8), `liquidType` (u8), `frame` (u8 metadata: multi-tile offsets, tree species, variants) and `explored` (u8).
- **Flags** on each chunk:
  - `modified`: the chunk differs from the generated baseline, so it must be saved.
  - `saveDirty`: the chunk changed since the last save; autosave writes only these.
  - `renderDirty`: the chunk's render cache must be rebuilt.
- **Loading and unloading.** Tile data for the whole map is resident: it is regenerated from the seed on load, which is cheap (about 0.7 s for medium). Chunks are *activated* for rendering (canvas cache per chunk, rebuilt when dirty, LRU-evicted beyond 96) and for simulation (liquids and random ticks only within about 110 tiles of the player).
- **World edits** go through `WorldActions` (`breakTile`, `placeTile`, walls, doors). It handles multi-tile objects, tree felling, urn loot, chests and support cascades: floor-, ceiling- and attach-supported tiles break when their support goes. It also emits `worldEdit` events.
- `World.onChange` listeners feed the minimap, liquid wake-ups and network replication.

## Rendering

- **Background** (screen space): sky gradient by time and biome tint, stars, sun, moon phases, clouds, and three procedurally painted parallax layers per biome that crossfade between biomes. There is a separate cave backdrop underground.
- **World** (camera transform, integer-snapped for crisp pixels):
  - Chunk caches (walls darkened, tiles with exposed-edge shading, grass fringes and rounded corners).
  - Crack overlays.
  - A dynamic per-frame pass over visible tiles: liquids, tree crowns, flames, and animated decor (`DecorRenderer`). Animated decor is drawn once from its origin cell and reacts to wind (`exposedToWind` checks for open, wall-less air nearby), the hour and the moon phase.
  - Painted canvases are drawn from `World.paintings` through a per-canvas sprite cache (`sprites/paintings.ts`).
  - Entities, then particles.
- **Lighting:** the `LightingSystem` computes an RGB lightmap for the view plus a margin. Sky light seeds above each column's first opaque tile (`World.skyTop`); emitters are tiles, lava and entity lights. Light spreads with separable forward/backward sweeps (air decays 0.9 per tile, solid 0.6). Decay is per channel, so stained glass (`TileDef.tint`) filters light passing through it. Tinted tiles also stop direct skylight (`TileRegistry.skyBlock`), so sunlight enters through them tinted. The map is uploaded as a tiny canvas and multiplied over the scene with smoothing. Newly lit tiles are marked explored for the minimap.
- **Post-lighting:** coloured sunbeams under sunlit stained glass (additive), boss hazards (telegraphs stay readable in the dark), damage numbers, debug overlays, then screen-space weather and the low-health vignette.
- **Sprites** are all procedural (`rendering/sprites/`): tile textures from texture recipes, object/furniture painters, item icons from about 55 templates recoloured by palette, the layered player renderer (hair styles, armour overlays, animated limbs, held items), and enemy and boss painters.

## Entities

```
Entity (position, velocity, facing, light())
 ├─ Actor (life, defense, buffs, immunity, hurt() → onHurt/onDeath)
 │   ├─ Player (movement, stats, ItemUse, death penalties by difficulty)
 │   ├─ Enemy (EnemyDef + AIController; worm segments route damage to their head)
 │   │   └─ Boss (attack state machine, phases, hazards, shield, flee, staged death)
 │   │        Gravelmaw · Thornwarden · ObeliskPrime · Serpent · Solmara
 │   └─ NPC
 ├─ Projectile (behaviours: ballistic, boomerang, spear, minion, orbit; pierce/bounce/homing/explode/split)
 ├─ ItemDrop
 └─ RemotePlayer (multiplayer)
```

- **Physics** (`physics/Physics.ts`): axis-separated AABB sweeps against the tile grid, sub-stepped for fast bodies, with one-way platforms, automatic one-tile step-up, an unstick helper and line-of-sight raycasts.
- **Combat** (`combat/`): pure damage maths (`damage.ts`, unit-tested). `ItemUse` turns the held item into actions: swing arcs are segment-tested against enemy rects, and there are projectiles, mana and ammo, placement, consumables, summons and buckets.
- **AI** (`entities/enemies/ai/`): shared, stateless controllers for simple archetypes, and per-enemy instances for stateful ones (worms).
- **Hazards** (`entities/bosses/hazards.ts`): telegraph-then-active spikes, beams (optionally rotating), bursts, columns and arena rings.

## Housing and comfort

`world/housing.ts` `checkRoom` flood-fills a room once and returns both the NPC verdict and the room's properties: `enclosed`, `walled` and `comfort`. Comfort sums `TileDef.comfort` over the distinct tile kinds found inside the room or set into its boundary, plus bonuses for a blooming planter and for painted canvases. `GameSession.updateComfort` runs it at the player's position once a second to apply tier buffs. `NPCManager` uses the same result for shop discounts and housing text. Planter state lives in the tile frame (`kind*4 + stage`), so it saves and syncs like any tile.

## Progression

`ProgressionSystem` holds world flags (`boss:<id>`, `unsealed`, `event:raid` and others) and boss kill counts, and emits `flagSet`. The flags gate recipes, loot entries, spawn rules, NPC arrivals, shop stock, tile mining (`lockedUntil`) and boss summoning. The `unsealed` flag starts the time-sliced, seed-deterministic `unsealWorld` transformation.

## Save architecture

- `SaveManager` sits on a `StorageBackend`: `IDBBackend` in the browser, or `MemoryBackend` for tests and as a fallback.
- A **character** (appearance, difficulty, stats, inventory, buffs) is saved separately from worlds.
- A **world** is saved as `WorldRecord { meta, state }` plus `ChunkRecord`s (raw typed-array buffers of modified chunks) and `ExploredRecord`s (RLE).
- `validation.ts` sanitises everything read from storage or import files: clamping numbers, dropping unknown items and tile ids, and bounding strings.
- Export uses JSON with RLE+base64 chunk data.

## Audio

`AudioManager` lazily creates an `AudioContext` on the first user gesture and routes master, music, sfx and ambience buses.
- **SFX** are layered oscillator or noise recipes with pitch and amplitude envelopes and filters, positionally attenuated and panned.
- **Music** is a generative scheduler: per-track scale, progression, tempo, pad, lead, bass and drums, crossfaded when the biome, time, event or boss changes.
- **Ambience:** rain, wind and lava noise beds.
- **Overrides:** optional real files via `public/assets/audio/manifest.json`.

## Multiplayer considerations

`src/multiplayer/protocol.ts` is shared by the client and the Node server.

- **World delivery:** the server regenerates the world from the seed with the same generator code and sends only modifications on join.
- **Paintings** are object data (not tiles). They are sent as `paint` messages, validated by the server (canvas present at the origin, correct art size, sender in range), stored in the server save, and included in `welcome`. Breaking a canvas drops its painting on every side.
- **Edits:** clients send resulting tile diffs (`[x, y, fg, frame, wall]`) rather than high-level operations, so cascades such as tree felling replicate exactly. The server checks bounds, id validity, distance from the sender and rate, applies the diff and relays it.
- **Client-simulated state:** creatures and bosses are simulated per client today. The path to server authority is laid out in the roadmap: enemy snapshots from a host or server simulation reusing `Enemy`, with the headless `SimContext` in the tests as a starting point.
