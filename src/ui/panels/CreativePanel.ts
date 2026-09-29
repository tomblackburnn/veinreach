import type { GameSession } from '../../core/GameSession';
import { h, clear } from '../../utils/dom';
import { SlotView } from '../SlotView';
import { ItemRegistry } from '../../items/ItemRegistry';
import type { ItemCategory } from '../../items/types';
import { ENEMIES } from '../../data/enemies';
import { BOSSES } from '../../data/bosses';
import { WORLD_EVENTS } from '../../systems/WorldEventSystem';
import { TileRegistry } from '../../world/TileRegistry';
import { findStandSpot, surfaceSpot, findNearestTile } from '../../world/locate';
import { SURFACE_BIOME_ORDER } from '../../biomes/BiomeDetector';
import { BIOMES } from '../../data/biomes';
import type { WeatherKind } from '../../world/WorldState';

type Tab = 'items' | 'spawn' | 'world' | 'player';

const CATEGORY_GROUPS: { label: string; cats: ItemCategory[] | null }[] = [
  { label: 'All', cats: null },
  { label: 'Blocks', cats: ['block', 'wall'] },
  { label: 'Furniture', cats: ['furniture'] },
  { label: 'Tools', cats: ['tool', 'utility'] },
  { label: 'Weapons', cats: ['melee', 'ranged', 'magic', 'summon', 'ammo'] },
  { label: 'Armour', cats: ['armor'] },
  { label: 'Accessories', cats: ['accessory'] },
  { label: 'Consumables', cats: ['consumable'] },
  { label: 'Materials', cats: ['material', 'currency'] },
  { label: 'Boss & events', cats: ['bossSummon'] },
];

interface Loadout {
  label: string;
  armor: string;
  items: [string, number][];
  accessories: string[];
  life?: number;
  mana?: number;
}

export const LOADOUTS: Loadout[] = [
  {
    label: 'Early (Ferrocite)', armor: 'ferrocite',
    items: [['ferrocite_pickaxe', 1], ['ferrocite_axe', 1], ['ferrocite_broadsword', 1], ['ferrocite_bow', 1], ['wooden_arrow', 500], ['lesser_mending', 20], ['torch', 99]],
    accessories: ['swiftstep_boots', 'menders_band'],
  },
  {
    label: 'Mid (Sungild / Glimmer)', armor: 'sungild', life: 240, mana: 100,
    items: [['glimmer_pickaxe', 1], ['glimmerbrand', 1], ['sungild_longbow', 1], ['barbed_arrow', 500], ['frostbloom_staff', 1], ['wisp_rod', 1], ['mending', 20], ['torch', 99]],
    accessories: ['zephyr_charm', 'swiftstep_boots', 'featherfall_pendant', 'menders_band', 'keen_monocle'],
  },
  {
    label: 'Post-Unsealing (Cinder)', armor: 'cinder', life: 340, mana: 160,
    items: [['cindrite_pickaxe', 1], ['emberlance', 1], ['cinderstring', 1], ['ember_arrow', 500], ['tome_of_embers', 1], ['shardcaller', 1], ['greater_mending', 20], ['mana_tonic', 20]],
    accessories: ['voyager_treads', 'dashing_sash', 'ember_sigil', 'burrowers_carapace', 'resonant_core'],
  },
  {
    label: 'Endgame (Starforged)', armor: 'starforged', life: 400, mana: 200,
    items: [['aether_pickaxe', 1], ['starfall_edge', 1], ['astral_volley', 1], ['cindershot', 999], ['astral_scepter', 1], ['wyrmling_staff', 1], ['greater_mending', 30], ['mana_tonic', 30]],
    accessories: ['aurora_mantle', 'wyrm_heart', 'resonant_core', 'voyager_treads', 'seedcrown'],
  },
];

const FLAG_LABELS: [string, string][] = [
  ['boss:gravelmaw', 'Gravelmaw defeated'],
  ['boss:thornwarden', 'Thornwarden defeated'],
  ['boss:obelisk', 'Obelisk Prime defeated'],
  ['unsealed', 'The Unsealing (transforms the world)'],
  ['boss:serpent', "Nhal'Zyra defeated"],
  ['boss:solmara', 'Solmara defeated'],
  ['event:raid', 'Rustbound Raid repelled'],
];

/**
 * Creative / testing sandbox. Available to Creative characters, or to anyone
 * with Developer mode enabled. Everything here uses the same game systems as
 * normal play (spawning, bosses, flags, events), just without the prerequisites.
 */
export class CreativePanel {
  private el: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs: HTMLDivElement;
  private tab: Tab = 'items';
  private search = '';
  private group = 0;
  isOpen = false;

  constructor(private s: GameSession) {
    this.tabs = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' });
    this.body = h('div', { class: 'col creative-body' });
    this.el = h('div', { class: 'panel creative-panel' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, 'Creative'), h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => this.close() }, 'Close')),
      this.tabs,
      this.body,
    );
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
  }

  get available(): boolean {
    return this.s.player.difficulty === 'creative' || this.s.settings.developerMode;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (!this.available) {
      this.s.message('Creative tools need a Creative character, or Developer mode (Settings).', '#ffb070');
      return;
    }
    this.isOpen = true;
    this.el.style.display = '';
    this.s.npcPanel.close();
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.el.style.display = 'none';
    this.s.input.typing = false;
  }

  update(): void {
    if (this.isOpen && this.tab === 'player' && this.s.tick % 30 === 0) this.renderPlayerStatus();
  }

  private render(): void {
    clear(this.tabs);
    const names: [Tab, string][] = [['items', 'Items'], ['spawn', 'Creatures & Bosses'], ['world', 'World'], ['player', 'Player']];
    for (const [t, label] of names) this.tabs.append(h('button', { class: `btn small ${this.tab === t ? 'gold' : ''}`, onclick: () => { this.tab = t; this.render(); } }, label));
    clear(this.body);
    if (this.tab === 'items') this.renderItems();
    else if (this.tab === 'spawn') this.renderSpawn();
    else if (this.tab === 'world') this.renderWorld();
    else this.renderPlayer();
  }

  // ---------------- Items ----------------
  private renderItems(): void {
    const input = h('input', { type: 'text', placeholder: 'Search items...', value: this.search, style: 'width:100%' });
    input.addEventListener('focus', () => (this.s.input.typing = true));
    input.addEventListener('blur', () => (this.s.input.typing = false));
    const grid = h('div', { class: 'grid creative-grid' });
    const fill = () => {
      clear(grid);
      const q = this.search.toLowerCase();
      const cats = CATEGORY_GROUPS[this.group].cats;
      const items = ItemRegistry.all().filter((d) => (!cats || cats.includes(d.category)) && (!q || d.name.toLowerCase().includes(q) || d.id.includes(q)));
      for (const d of items) {
        const v = new SlotView();
        v.set({ id: d.id, count: 1 });
        v.tooltipExtra = () => ({});
        v.el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const n = e.shiftKey || d.maxStack === 1 ? 1 : Math.min(d.maxStack, 999);
          const left = this.s.player.inventory.give({ id: d.id, count: n });
          this.s.audio.play('pickup', { volume: 0.5 });
          if (left === n) this.s.message('Your inventory is full.', '#ffb070');
        });
        grid.appendChild(v.el);
      }
      if (!items.length) grid.append(h('span', { class: 'hint' }, 'No items match.'));
    };
    input.addEventListener('input', () => {
      this.search = input.value;
      fill();
    });
    const chips = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, ...CATEGORY_GROUPS.map((g, i) => h('button', { class: `btn small ${i === this.group ? 'gold' : ''}`, onclick: () => { this.group = i; this.render(); } }, g.label)));
    this.body.append(input, chips, h('div', { class: 'hint' }, 'Click: a full stack. Shift-click: one.'), grid);
    fill();
  }

  // ---------------- Spawning ----------------
  private spawnNear(id: string, n = 1): void {
    const p = this.s.player;
    for (let i = 0; i < n; i++) {
      const tx = p.tileX + p.facing * (8 + i * 2);
      const spot = findStandSpot(this.s.world, tx, p.tileY, 20) ?? [tx, p.tileY];
      this.s.spawnEnemy(id, spot[0] * 16 + 16, (spot[1] + 1) * 16);
    }
  }

  private renderSpawn(): void {
    const s = this.s;
    const bossRow = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, ...BOSSES.map((b) => h('button', {
      class: 'btn small danger',
      onclick: () => {
        if (s.bosses.active.length) return s.message('A boss is already active. Clear enemies first.', '#ffb070');
        if ((b.id === 'thornwarden' || b.id === 'solmara') && s.time.isDay) s.time.setHour(21);
        s.bosses.spawn(s, b.id, s.player);
        this.close();
      },
    }, b.name)));
    const enemyGrid = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, ...ENEMIES.map((e) => h('button', { class: 'btn small', title: e.id, onclick: (ev: Event) => this.spawnNear(e.id, (ev as MouseEvent).shiftKey ? 5 : 1) }, e.name)));
    const rate = (label: string, on: boolean, mul: number, cap: number) => h('button', {
      class: `btn small ${s.spawns.enabled === on && s.spawns.rateMul === mul ? 'gold' : ''}`,
      onclick: () => { s.spawns.enabled = on; s.spawns.rateMul = mul; s.spawns.capMul = cap; this.render(); },
    }, label);
    this.body.append(
      h('h3', {}, 'Bosses (conditions ignored)'), bossRow,
      h('h3', {}, 'Natural spawns'), h('div', { class: 'row' }, rate('Off', false, 1, 1), rate('Normal', true, 1, 1), rate('High', true, 3, 2.5), h('button', { class: 'btn small', onclick: () => s.entities.clearHostile() }, 'Clear enemies')),
      h('h3', {}, 'Creatures (Shift: spawn 5)'), enemyGrid,
    );
  }

  // ---------------- World ----------------
  private teleport(spot: [number, number] | null, what: string): void {
    if (!spot) return this.s.message(`No ${what} found in this world.`, '#ffb070');
    const safe = findStandSpot(this.s.world, spot[0], spot[1], 40) ?? spot;
    this.s.player.teleportTo(this.s, safe[0], safe[1]);
    this.s.audio.play('teleport');
  }

  private renderWorld(): void {
    const s = this.s;
    const w = s.world;
    const p = s.player;
    const time = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' },
      ...([['Dawn', 5], ['Noon', 12], ['Dusk', 18.5], ['Midnight', 0]] as [string, number][]).map(([l, hr]) => h('button', { class: 'btn small', onclick: () => s.time.setHour(hr) }, l)),
      h('button', { class: `btn small ${s.time.speed === 0 ? 'gold' : ''}`, onclick: () => { s.time.speed = s.time.speed === 0 ? 1 : 0; this.render(); } }, 'Freeze time'),
      h('button', { class: `btn small ${s.time.speed > 1 ? 'gold' : ''}`, onclick: () => { s.time.speed = s.time.speed > 1 ? 1 : 30; this.render(); } }, 'Fast time'),
    );
    const weather = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, ...(['clear', 'rain', 'storm', 'veilstorm'] as WeatherKind[]).map((k) => h('button', { class: `btn small ${s.weather.kind === k ? 'gold' : ''}`, onclick: () => { s.weather.set(k, 60 * 60 * 5); if (k !== 'clear') s.weather.intensity = 0.8; this.render(); } }, k)));
    const events = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' },
      ...Object.values(WORLD_EVENTS).map((e) => h('button', { class: 'btn small', onclick: () => { if (e.night && s.time.isDay) s.time.setHour(21); const err = s.worldEvents.tryStart(e.id); if (err) s.message(err, '#ffb070'); } }, e.name)),
      h('button', { class: 'btn small', onclick: () => s.worldEvents.end(true) }, 'End event'),
      h('button', { class: 'btn small', onclick: () => s.worldEvents.crashStar(s) }, 'Crash a star'),
    );
    const flags = h('div', { class: 'col', style: 'gap:2px' }, ...FLAG_LABELS.map(([f, label]) => {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = s.progression.has(f);
      cb.addEventListener('change', () => {
        if (cb.checked) s.progression.set(f);
        else s.progression.flags.delete(f);
      });
      return h('label', { class: 'row', style: 'gap:6px;cursor:pointer' }, cb, label);
    }), h('div', { class: 'hint' }, 'Flags unlock recipes, NPCs, shop stock, loot and summons. Unticking cannot undo the Unsealing.'));
    const surfaceBiomes = SURFACE_BIOME_ORDER.map((key, idx) => h('button', {
      class: 'btn small',
      onclick: () => {
        let best = -1;
        for (let x = 0; x < w.width; x++) if (w.biomeColumn[x] === idx && (best < 0 || Math.abs(x - p.tileX) < Math.abs(best - p.tileX))) best = x;
        this.teleport(best >= 0 ? surfaceSpot(w, best) : null, BIOMES[key].name);
      },
    }, BIOMES[key].name));
    const tileBiomes: [string, string[]][] = [['sporeglow', ['lumenmoss']], ['glimmer', ['prismstone', 'glimmerite_ore']], ['emberdeep', ['ash', 'magmarock']], ['shardblight', ['shardgrass', 'shardrock']]];
    const underBiomes = tileBiomes.map(([key, tiles]) => h('button', {
      class: 'btn small',
      onclick: () => this.teleport(findNearestTile(w, new Set(tiles.map((t) => TileRegistry.id(t))), p.tileX, p.tileY), BIOMES[key as keyof typeof BIOMES].name),
    }, BIOMES[key as keyof typeof BIOMES].name));
    const kinds = [...new Set(w.structures.map((st) => st.kind))];
    const structures = kinds.map((k) => {
      const list = w.structures.filter((st) => st.kind === k);
      return h('button', {
        class: 'btn small',
        onclick: () => {
          const st = list.reduce((a, b) => (Math.abs(a.x - p.tileX) + Math.abs(a.y - p.tileY) < Math.abs(b.x - p.tileX) + Math.abs(b.y - p.tileY) ? a : b));
          this.teleport([Math.floor(st.x + st.w / 2), Math.floor(st.y + st.h / 2)], st.name);
        },
      }, `${list[0].name} (${list.length})`);
    });
    this.body.append(
      h('h3', {}, 'Time'), time,
      h('h3', {}, 'Weather'), weather,
      h('h3', {}, 'Events'), events,
      h('h3', {}, 'Progression'), flags,
      h('h3', {}, 'Teleport'),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, h('button', { class: 'btn small gold', onclick: () => this.teleport([p.spawnX, p.spawnY], 'spawn') }, 'Spawn point'), ...surfaceBiomes, ...underBiomes),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, ...structures),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' },
        h('button', { class: 'btn small', onclick: () => { for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) w.markExplored(x, y); s.minimap.rebuild(); } }, 'Reveal map'),
      ),
    );
  }

  // ---------------- Player ----------------
  private statusEl: HTMLDivElement | null = null;

  private renderPlayerStatus(): void {
    if (!this.statusEl) return;
    const p = this.s.player;
    this.statusEl.textContent = `Life ${Math.ceil(p.life)}/${p.maxLife} · Mana ${Math.floor(p.mana)}/${p.maxMana} · Defense ${p.defense} · Tile ${p.tileX}, ${p.tileY}`;
  }

  private renderPlayer(): void {
    const s = this.s;
    const p = s.player;
    const toggle = (key: keyof typeof p.cheats, label: string, hint: string) => {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = p.cheats[key];
      cb.addEventListener('change', () => (p.cheats[key] = cb.checked));
      return h('label', { class: 'row', style: 'gap:6px;cursor:pointer' }, cb, h('b', {}, label), h('span', { class: 'hint' }, hint));
    };
    const loadouts = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, ...LOADOUTS.map((l) => h('button', { class: 'btn small good', onclick: () => this.applyLoadout(l) }, l.label)));
    this.statusEl = h('div', { class: 'hint' });
    this.body.append(
      this.statusEl,
      h('h3', {}, 'Cheats'),
      toggle('god', 'God mode', 'take no damage'),
      toggle('fly', 'Fly', 'move freely through terrain (W/Space up, S down)'),
      toggle('instantMine', 'Instant mining', 'any tool breaks anything instantly, ignoring power'),
      toggle('infinite', 'Infinite items', 'placing, ammo, mana and consumables are free'),
      h('h3', {}, 'Gear presets'),
      h('div', { class: 'hint' }, 'Equips a full armour set and accessories, and adds tools, weapons and potions for that stage.'),
      loadouts,
      h('h3', {}, 'Actions'),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' },
        h('button', { class: 'btn small', onclick: () => { p.life = p.maxLife; p.mana = p.maxMana; p.buffs.clear(); } }, 'Full heal'),
        h('button', { class: 'btn small', onclick: () => { p.baseLife = 400; p.baseMana = 200; p.refreshStats(); p.life = p.maxLife; p.mana = p.maxMana; } }, 'Max life & mana'),
        h('button', { class: 'btn small', onclick: () => { p.spawnX = p.tileX; p.spawnY = Math.floor((p.bottom - 1) / 16); s.message('Spawn point set here.', '#a0ffa0'); } }, 'Set spawn here'),
        h('button', { class: 'btn small', onclick: () => { p.inventory.wallet += 10000; } }, '+10,000 aurels'),
        h('button', { class: 'btn small danger', onclick: () => { for (let i = 10; i < 50; i++) p.inventory.main.set(i, null); } }, 'Clear backpack'),
      ),
    );
    this.renderPlayerStatus();
  }

  private applyLoadout(l: Loadout): void {
    const p = this.s.player;
    const inv = p.inventory;
    const stash = (id: string | undefined) => {
      if (id) inv.give({ id, count: 1 });
    };
    (['head', 'body', 'legs'] as const).forEach((slot, i) => {
      stash(inv.armor.get(i)?.id);
      inv.armor.set(i, { id: `${l.armor}_${slot}`, count: 1 });
    });
    for (let i = 0; i < inv.accessories.size; i++) {
      stash(inv.accessories.get(i)?.id);
      inv.accessories.set(i, l.accessories[i] ? { id: l.accessories[i], count: 1 } : null);
    }
    for (const [id, n] of l.items) inv.give({ id, count: n });
    if (l.life) p.baseLife = Math.max(p.baseLife, l.life);
    if (l.mana) p.baseMana = Math.max(p.baseMana, l.mana);
    p.refreshStats();
    p.life = p.maxLife;
    p.mana = p.maxMana;
    this.s.audio.play('powerup');
    this.s.message(`Equipped the ${l.label} loadout.`, '#a0ffa0');
  }

  dispose(): void {
    this.el.remove();
  }
}
