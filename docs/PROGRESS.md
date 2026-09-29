# Progress

_Last updated: 2026-09-29_

## Status

| Check | Status |
|---|---|
| `npm run typecheck` (client + server) | ✅ passing |
| `npm run test` | ✅ 67 tests passing (unit + headless simulation) |
| `npm run build` | ✅ passing (~440 kB JS, ~140 kB gzipped) |
| Browser runtime | ✅ Verified manually in Chromium: menus, character/world creation, generation, mining, placing, crafting, chests, persistence across reload, all five bosses rendered and fighting. No console errors. |

## Content counts

Numbers come from `npx tsx scripts/content-stats.ts`.

| Content | Count |
|---|---|
| Tiles / walls | 77 / 20 |
| Items | 249 (33 weapons: 14 melee, 9 ranged, 7 magic, 3 summon) |
| Tools and utilities | 20 |
| Armour | 36 pieces in 12 sets with set bonuses |
| Accessories | 23 |
| Consumables | 17, plus 7 ammo types |
| Recipes | 170 across 7 stations |
| Enemies | 31 (28 spawn naturally or in events, 3 boss adds) using 14 AI archetypes |
| Bosses | 5 |
| NPCs | 7 |
| Biomes | 12 (8 world biomes + underground, keep, sky isles, Shardblight) |
| Buffs / debuffs | 18 |
| Projectiles | 41 |
| Loot tables | 41 |
| World events | 4 |

## Completed systems

- Project scaffolding: Vite, TypeScript (strict), Vitest, git, docs.
- Seeded, deterministic world generation with biomes, caves, ores, liquids, structures and vegetation.
- Chunked world storage with dirty tracking, render caching and LRU; the save format is seed plus modified chunks.
- Tile renderer, parallax backgrounds, day/night sky, RGB lighting, weather and particles.
- Player movement and physics: double jump, dash, ropes, platforms, liquids, fall damage.
- Mining with tool power and hardness, cracks, tree felling, support cascades; building with validation.
- Inventory, equipment, ammo, trash, sort, quick-stack, drag and drop, tooltips, rarity colours.
- Crafting with station detection and progression gating.
- Combat: melee arcs, spears, boomerangs, ranged with ammo, magic with mana, summons, buffs and debuffs, crits, knockback, damage numbers.
- 14 enemy AI archetypes; spawn rules by biome, zone, time, flags and events; caps; safe houses.
- 5 bosses with phases, telegraphs, hazards, adds, intros, music and death sequences; BossManager summoning rules.
- Progression flags, the Unsealing world transformation, 4 world events, weather.
- NPC housing validation, arrivals, dialogue, shops (buy/sell/buyback), healer.
- IndexedDB saves, autosave, export/import with validation, memory fallback.
- Menus, HUD, boss bar, event bar, banners, minimap and world map, pause menu, settings with key rebinding, debug console.
- Procedural SFX and generative music with biome, event and boss switching.
- Experimental multiplayer: server with validated tile edits, chests, flags, time and chat; the client renders remote players.

## Partially completed

- **Multiplayer:** enemies, bosses, projectiles, drops and liquid flow are client-simulated rather than shared.
- **Chunk streaming:** tile data is resident for the whole map; only render and simulation are chunk-scoped.
- **Key rebinding** supports one key per action from the UI (defaults have two for movement).

## Known bugs and rough edges

- The `requestAnimationFrame` loop pauses when the tab is hidden. That is intended in single-player; in multiplayer, a hidden client's avatar freezes for others.
- Liquids can occasionally leave thin, single-cell films on uneven floors (evaporation removes most of them).
- Very fast projectiles against one-tile-thick platforms don't collide with platforms (by design they pass through).

## Recent changes

- **Housing Deed** (creative item): builds a complete, valid NPC house at the cursor. It refuses to overwrite furniture or chests. Items marked `cheat` are excluded from the obtainability audit.
- **Delver's Almanac**: an in-game guidebook (G) with a live boss checklist, current objective, per-stage loadouts, armour sets, ores and tools, stations, townsfolk and events. Its content is validated by tests.
- Fixed: the boss health bar now disappears after a boss is defeated or leaves.
- **Obtainability audit** (`scripts/audit-items.ts` and a test): all 250 items are reachable. Leafthatch now drops from felled leafy trees.
- Tests confirm the Unsealing seeds Umbralite, Aetherium and the Shardblight, and that each pickaxe tier mines the next ore.
- Multiplayer clients no longer broadcast the (identical) Unsealing terrain changes to each other.
- **Creative mode:** a Creative difficulty plus a Creative panel (C) with an item browser, boss/creature spawners, time/weather/event/progression controls, teleports, cheats (god, fly, instant mine, infinite items) and gear presets.
- Tools dig about 2× faster: shorter use times and ×1.6 damage per hit. The starter pickaxe breaks soil in one hit and stone in two.
- Multiplayer verified end to end with two real browser clients plus a scripted client: join, avatars, block edits both ways, chests, progression flags, chat, late-join catch-up and server autosave.
- Fixed: the UI Scale setting now scales every menu, HUD and panel (CSS zoom on the UI layer); "Zoom" is relabelled "Game zoom" (it is the in-game camera).
- Fixed: the main-menu **Worlds** button now opens a world manager; pressing Play there asks which character should play.
- Fixed: too many Tunnel Grubs underground. Spawning now picks a location first; worms spawn only inside rock, at most one at a time, with a low chance.
- World generation about 3× faster (medium world ~0.25 s in Node): sky-light columns are no longer rescanned per tile during generation.
- `GEN_VERSION` is stored in world metadata; loading a world made by an older generator shows a warning.
- Shorter trees with larger crowns; surface tiles are now fully sky-lit.

## Next priorities

1. Finish the in-browser visual tour of every biome and structure on a fresh world (started; taiga was checked).
2. Server-side enemy and boss simulation for multiplayer.
2. Smart cursor, vanity slots, per-item prefixes (reforging).
3. More structure variety: temple interiors, dungeon traps.
4. Mobile/touch controls; gamepad support.
5. Performance profiling on large worlds (lighting worker, chunk cache sizing).
