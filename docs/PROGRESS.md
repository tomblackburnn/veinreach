# Progress

_Last updated: 2026-09-29_

## Status

| Check | Status |
|---|---|
| `npm run typecheck` (client + server) | ✅ passing |
| `npm run test` | ✅ 46 tests passing (unit + headless simulation) |
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

## Next priorities

1. Server-side enemy and boss simulation for multiplayer.
2. Smart cursor, vanity slots, per-item prefixes (reforging).
3. More structure variety: temple interiors, dungeon traps.
4. Mobile/touch controls; gamepad support.
5. Performance profiling on large worlds (lighting worker, chunk cache sizing).
