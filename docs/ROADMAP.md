# Roadmap

## Phases (original plan → status)

| Phase | Scope | Status |
|---|---|---|
| 1 | Project, architecture, renderer, loop, input | ✅ |
| 2 | World generation, chunks, camera, player movement, collision | ✅ |
| 3 | Mining, placement, drops, inventory | ✅ |
| 4 | Crafting, equipment, tools, weapons | ✅ |
| 5 | Enemies, combat, projectiles, loot | ✅ |
| 6 | Saves, character/world menus, persistence | ✅ |
| 7 | Biomes, structures, lighting, backgrounds | ✅ |
| 8 | Bosses, progression, events | ✅ |
| 9 | NPCs, housing, shops | ✅ |
| 10 | Content expansion, polish, optimisation | 🟡 ongoing |
| 11 | Multiplayer | 🟡 experimental (terrain, edits, chests, flags, chat) |

## Planned systems

- **Multiplayer v2.** The server simulates enemies and bosses using the same `Enemy` and `Boss` classes. The headless `SimContext` in `tests/helpers` is already a working prototype of a server context. Planned alongside it:
  - projectile and damage events
  - shared item drops with ownership
  - server-side liquids
  - reconnection
  - a host-from-browser mode over WebRTC
- **Smart cursor**: auto-target the nearest minable tile along the aim ray.
- **Item prefixes and reforging** at a new Tinker station.
- **Vanity and dye slots.**
- **Trapdoors, slopes and half-blocks.**
- **Wiring**: pressure plates, doors and traps.
- **Fishing and cooking** with more buff food.
- **Pets and mounts** as boss drops.
- **Achievements** and a bestiary backed by the kill counts already tracked for bosses.

## Planned content

- Two more mid-game bosses: a Frostbound Colossus in the Taiga and a Mireweaver spider matriarch in the Blightmire.
- A post-Unsealing Shardblight dungeon with keyed chests.
- An Emberdeep "Cinder Gate" mini-event.
- More NPCs: a Dye Weaver and a Cartographer who sells maps revealing structures.
- Biome-specific chest loot pools and a mimic variant per biome.

## Polish goals

- Hand-drawn sprite sheets to replace procedural art where it matters most (player and bosses); the sprite pipeline is centralised in `rendering/sprites/` so it can be swapped piece by piece.
- Recorded music that can be dropped in via the audio manifest.
- Better tile blending between different materials (per-neighbour masks).
- A move of lighting and liquids to a Web Worker for large worlds.
- Accessibility: colour-blind palettes for rarity and hazard telegraphs, and remappable mouse buttons.
