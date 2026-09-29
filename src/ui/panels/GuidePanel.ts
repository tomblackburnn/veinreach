import type { GameSession } from '../../core/GameSession';
import { h, clear } from '../../utils/dom';
import { ItemRegistry } from '../../items/ItemRegistry';
import { RARITY_COLORS } from '../../items/types';
import { itemIconUrl } from '../../rendering/sprites/itemIcons';
import { Tooltip, itemTooltip } from '../Tooltip';
import { BOSSES } from '../../data/bosses';
import { LOOT_TABLES } from '../../data/lootTables';
import { RecipeRegistry } from '../../crafting/RecipeRegistry';
import { GUIDE_STAGES, BOSS_GUIDE, STATION_GUIDE, ORE_GUIDE, GUIDE_TIPS, type GuideStage } from '../../data/guide';
import { SET_BONUSES } from '../../data/items/armor';
import { NPCS } from '../../data/npcs';
import { BIOMES, type BiomeKey } from '../../data/biomes';
import { WORLD_EVENTS } from '../../systems/WorldEventSystem';
import { TileRegistry } from '../../world/TileRegistry';
import { shade } from '../../utils/color';

type Chapter = 'welcome' | 'bosses' | 'progression' | 'loadouts' | 'armor' | 'ores' | 'stations' | 'npcs' | 'world';

const CHAPTERS: [Chapter, string][] = [
  ['welcome', 'Welcome'],
  ['bosses', 'Boss Checklist'],
  ['progression', 'Progression'],
  ['loadouts', 'Loadouts'],
  ['armor', 'Armour Sets'],
  ['ores', 'Ores & Tools'],
  ['stations', 'Crafting Stations'],
  ['npcs', 'Townsfolk'],
  ['world', 'Biomes & Events'],
];

const STATION_NAMES: Record<string, string> = {
  workbench: 'Workbench', furnace: 'Smelter', anvil: 'Anvil', alembic: 'Alembic Bench', runescribe: 'Runescribe Desk', aetherforge: 'Aetherforge', starloom: 'Starloom',
};

/** The Delver's Almanac: an in-game guidebook driven by live progression. */
export class GuidePanel {
  private el: HTMLDivElement;
  private nav: HTMLDivElement;
  private page: HTMLDivElement;
  private chapter: Chapter = 'welcome';
  private stageSel: string | null = null;
  isOpen = false;

  constructor(private s: GameSession) {
    this.nav = h('div', { class: 'guide-nav' });
    this.page = h('div', { class: 'guide-page' });
    this.el = h('div', { class: 'guide' },
      h('div', { class: 'guide-head' }, h('div', { class: 'guide-title' }, 'The Delver’s Almanac'), h('button', { class: 'btn small', onclick: () => this.close() }, 'Close')),
      h('div', { class: 'guide-body' }, this.nav, this.page),
    );
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(chapter?: Chapter): void {
    this.isOpen = true;
    if (chapter) this.chapter = chapter;
    this.el.style.display = '';
    this.s.npcPanel.close();
    this.s.audio.play('cloth', { pitch: 0.7 });
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.el.style.display = 'none';
    Tooltip.hide();
  }

  private has(flag: string | null): boolean {
    return !!flag && this.s.progression.has(flag);
  }

  /** The stage the player is currently in: the first one not yet completed. */
  private currentStage(): GuideStage {
    return GUIDE_STAGES.find((st) => !this.has(st.doneFlag)) ?? GUIDE_STAGES[GUIDE_STAGES.length - 1];
  }

  private render(): void {
    clear(this.nav);
    for (const [c, label] of CHAPTERS) this.nav.append(h('button', { class: `guide-tab ${c === this.chapter ? 'sel' : ''}`, onclick: () => { this.chapter = c; this.render(); } }, label));
    clear(this.page);
    this.page.scrollTop = 0;
    const fns: Record<Chapter, () => void> = {
      welcome: () => this.welcome(),
      bosses: () => this.bosses(),
      progression: () => this.progression(),
      loadouts: () => this.loadouts(),
      armor: () => this.armor(),
      ores: () => this.ores(),
      stations: () => this.stations(),
      npcs: () => this.npcs(),
      world: () => this.world(),
    };
    fns[this.chapter]();
  }

  // ---------- helpers ----------
  private item(id: string, count?: number): HTMLElement {
    const d = ItemRegistry.get(id);
    const el = h('span', { class: 'gitem' }, h('img', { src: itemIconUrl(id) }), h('span', { style: `color:${d.rarity >= 1 ? shade(RARITY_COLORS[d.rarity], 0.42) : 'inherit'};font-weight:${d.rarity >= 3 ? 'bold' : 'normal'}` }, `${d.name}${count && count > 1 ? ` ×${count}` : ''}`));
    el.addEventListener('mouseenter', () => Tooltip.show(itemTooltip(id, 1)));
    el.addEventListener('mouseleave', () => Tooltip.hide());
    return el;
  }

  private items(ids: string[]): HTMLElement {
    return h('div', { class: 'gitems' }, ...ids.map((i) => this.item(i)));
  }

  private h2(t: string): HTMLElement {
    return h('h2', {}, t);
  }

  private p(t: string): HTMLElement {
    return h('p', {}, t);
  }

  private recipeLine(id: string): HTMLElement | null {
    const r = RecipeRegistry.forOutput(id)[0];
    if (!r) return null;
    return h('div', { class: 'gline' }, h('b', {}, 'Recipe: '), ...r.ing.map(([i, n]) => this.item(i, n)), h('span', { class: 'gmuted' }, r.station ? `at a ${STATION_NAMES[r.station] ?? r.station}` : 'by hand'));
  }

  // ---------- chapters ----------
  private welcome(): void {
    const st = this.currentStage();
    const next = st.nextBoss ? BOSSES.find((b) => b.id === st.nextBoss) : null;
    const done = BOSSES.filter((b) => this.has(`boss:${b.id}`)).length;
    this.page.append(
      this.h2('Welcome, Delver'),
      this.p('Veinreach is a world of layered depths. Dig, build, craft better gear and defeat five great foes. This almanac tracks your progress and tells you what to do next.'),
      h('div', { class: 'gbox' },
        h('div', { class: 'gsub' }, 'Your current chapter'),
        h('div', { class: 'gbig' }, st.title),
        this.p(st.summary),
        next ? h('div', { class: 'gline' }, h('b', {}, 'Next boss: '), `${next.name}, ${next.title}. `, h('span', { class: 'gmuted' }, next.summonHint)) : this.p('You have defeated every boss. Congratulations!'),
        h('ul', {}, ...st.goals.slice(0, 4).map((g) => h('li', {}, g))),
        h('button', { class: 'btn small', onclick: () => { this.stageSel = st.id; this.chapter = 'loadouts'; this.render(); } }, 'Suggested loadout for this chapter'),
      ),
      h('div', { class: 'gline' }, h('b', {}, `Bosses defeated: ${done} / ${BOSSES.length}`), this.s.progression.has('unsealed') ? h('span', { class: 'gwarn' }, ' · The Seal is broken') : null),
      this.h2('Useful tips'),
      h('ul', {}, ...GUIDE_TIPS.map((t) => h('li', {}, t))),
    );
  }

  private bosses(): void {
    this.page.append(this.h2('Boss Checklist'), this.p('Defeat the bosses in order. Each one unlocks new materials, townsfolk and the way to the next.'));
    const nextId = this.currentStage().nextBoss;
    BOSSES.forEach((b, i) => {
      const done = this.has(`boss:${b.id}`);
      const kills = this.s.progression.bossKills[b.id] ?? 0;
      const g = BOSS_GUIDE[b.id];
      const loot = LOOT_TABLES[b.loot];
      const drops = [...(loot.always ?? []).map((e) => e.item), ...(loot.pools ?? []).flatMap((p) => p.entries.map((e) => e.item))].filter((id, k, a) => a.indexOf(id) === k && id !== 'aurel');
      this.page.append(
        h('div', { class: `gboss ${done ? 'done' : ''} ${b.id === nextId ? 'next' : ''}` },
          h('div', { class: 'gboss-head' },
            h('span', { class: 'gcheck' }, done ? '✔' : '☐'),
            h('img', { src: itemIconUrl(b.summonItem) }),
            h('div', {}, h('div', { class: 'gbig' }, `${i + 1}. ${b.name}`), h('div', { class: 'gmuted' }, b.title)),
            h('div', { class: 'spacer' }),
            h('span', { class: 'gtag' }, done ? `Defeated${kills > 1 ? ` ×${kills}` : ''}` : b.id === nextId ? 'Next' : 'Not yet'),
          ),
          h('div', { class: 'gline' }, h('b', {}, 'Summon: '), this.item(b.summonItem), h('span', { class: 'gmuted' }, b.summonHint)),
          this.recipeLine(b.summonItem),
          h('div', { class: 'gline' }, h('b', {}, 'Where: '), g.where),
          h('div', { class: 'gline' }, h('b', {}, 'Bring: '), g.recommended),
          h('ul', {}, ...g.strategy.map((t) => h('li', {}, t))),
          h('div', { class: 'gline' }, h('b', {}, 'Drops: ')),
          this.items(drops),
          h('div', { class: 'gmuted' }, b.lore),
        ),
      );
    });
  }

  private progression(): void {
    this.page.append(this.h2('The Path Through Veinreach'));
    const cur = this.currentStage();
    for (const st of GUIDE_STAGES) {
      const done = this.has(st.doneFlag);
      this.page.append(
        h('div', { class: `gboss ${done ? 'done' : ''} ${st === cur ? 'next' : ''}` },
          h('div', { class: 'gboss-head' }, h('span', { class: 'gcheck' }, done ? '✔' : st === cur ? '➤' : '☐'), h('div', { class: 'gbig' }, st.title)),
          this.p(st.summary),
          h('ul', {}, ...st.goals.map((g) => h('li', {}, g))),
        ),
      );
    }
  }

  private loadouts(): void {
    const cur = this.currentStage();
    const sel = GUIDE_STAGES.find((s) => s.id === this.stageSel) ?? cur;
    this.page.append(
      this.h2('Loadouts'),
      this.p('Suggested gear for each chapter of the game. Mix and match: each class works on its own, and set bonuses reward wearing a full set.'),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px;margin-bottom:8px' }, ...GUIDE_STAGES.map((st) => h('button', { class: `guide-tab small ${st === sel ? 'sel' : ''}`, onclick: () => { this.stageSel = st.id; this.render(); } }, `${st.title}${st === cur ? ' ← you' : ''}`))),
      h('div', { class: 'gbig' }, sel.title),
      this.p(sel.summary),
      h('div', { class: 'gline' }, h('b', {}, 'Armour')),
      ...sel.armor.map((set) => this.setRow(set)),
      h('div', { class: 'gline' }, h('b', {}, 'Pickaxe: '), this.item(sel.pickaxe), h('span', { class: 'gmuted' }, `power ${ItemRegistry.get(sel.pickaxe).tool?.pick ?? 0}`)),
      h('div', { class: 'gcols' },
        h('div', {}, h('div', { class: 'gsub' }, '⚔ Melee'), this.items(sel.melee)),
        h('div', {}, h('div', { class: 'gsub' }, '➶ Ranged'), this.items(sel.ranged)),
        h('div', {}, h('div', { class: 'gsub' }, '✦ Magic'), this.items(sel.magic)),
        h('div', {}, h('div', { class: 'gsub' }, '⚘ Summon'), this.items(sel.summon)),
      ),
      h('div', { class: 'gline' }, h('b', {}, 'Accessories')),
      this.items(sel.accessories),
      h('div', { class: 'gline' }, h('b', {}, 'Potions')),
      this.items(sel.potions),
    );
  }

  private setRow(set: string): HTMLElement {
    const pieces = ['head', 'body', 'legs'].map((s) => `${set}_${s}`);
    const def = pieces.reduce((n, id) => n + (ItemRegistry.get(id).armor?.defense ?? 0), 0);
    const bonus = SET_BONUSES[set];
    const r = RecipeRegistry.forOutput(pieces[1])[0];
    const from = r ? `${STATION_NAMES[r.station ?? ''] ?? 'by hand'} · ${r.ing.map(([i, n]) => `${ItemRegistry.get(i).name} ×${n}`).join(', ')}` : 'not craftable';
    return h('div', { class: 'gset' },
      this.items(pieces),
      h('div', {}, h('b', {}, `${def} defense`), bonus ? h('span', {}, ` · Set bonus: ${bonus.description}`) : null),
      h('div', { class: 'gmuted' }, `Chestpiece: ${from}`),
    );
  }

  private armor(): void {
    this.page.append(this.h2('Armour Sets'), this.p('Wear all three pieces of a set to gain its set bonus. Sets are listed roughly in the order you can make them.'));
    for (const set of Object.keys(SET_BONUSES)) this.page.append(this.setRow(set));
  }

  private ores(): void {
    this.page.append(this.h2('Ores & Tools'), this.p('Every ore needs a pickaxe of at least its power. Each new pickaxe is made from the ore before it.'));
    for (const o of ORE_GUIDE) {
      const tile = TileRegistry.get(TileRegistry.id(o.ore));
      const bar = RecipeRegistry.usingIngredient(o.ore).find((r) => r.out.endsWith('_bar'));
      this.page.append(h('div', { class: 'gset' },
        h('div', { class: 'gline' }, this.item(o.ore), h('span', { class: 'gtag' }, `pick power ${tile.toolPower || 'any'}`), tile.lockedUntil ? h('span', { class: 'gwarn' }, 'after the Unsealing') : null),
        h('div', { class: 'gmuted' }, o.where),
        bar ? h('div', { class: 'gline' }, 'Smelts into ', this.item(bar.out)) : null,
      ));
    }
    const picks = ItemRegistry.all().filter((i) => i.tool?.pick).sort((a, b) => a.tool!.pick! - b.tool!.pick!);
    this.page.append(h('h3', {}, 'Pickaxes by power'), h('div', { class: 'gitems' }, ...picks.map((pk) => h('span', {}, this.item(pk.id), h('span', { class: 'gmuted' }, ` ${pk.tool!.pick}`)))));
  }

  private stations(): void {
    this.page.append(this.h2('Crafting Stations'), this.p('Stand within a few tiles of a station to see its recipes in your crafting panel (E).'));
    for (const st of STATION_GUIDE) this.page.append(h('div', { class: 'gset' }, this.item(st.item), h('div', {}, h('b', {}, 'Build: '), st.how), h('div', { class: 'gmuted' }, `Makes: ${st.makes}`)));
  }

  private npcs(): void {
    const present = new Map(this.s.entities.npcs.map((n) => [n.def.id, n]));
    this.page.append(
      this.h2('Townsfolk & Housing'),
      h('div', { class: 'gbox' },
        h('b', {}, 'A valid house needs:'),
        h('ul', {}, ...['Player-placed background walls behind every open tile', 'A door (or platform) in its outer boundary', 'A light source (torch, lamp...)', 'A table or workbench', 'A chair', 'Between 40 and 750 enclosed tiles'].map((t) => h('li', {}, t))),
        this.p('Talk to a townsperson and press Housing to check a room. New residents arrive during the day when a free house is available.'),
      ),
    );
    for (const n of NPCS) {
      const live = present.get(n.id);
      this.page.append(h('div', { class: `gset ${live ? 'done' : ''}` },
        h('div', { class: 'gline' }, h('span', { class: 'gcheck' }, live ? '✔' : '☐'), h('b', {}, n.role), live ? h('span', {}, ` · ${live.name} lives here`) : null),
        h('div', { class: 'gmuted' }, n.arrivalHint),
        h('div', { class: 'gline' }, h('span', { class: 'gmuted' }, 'Sells: '), ...n.shop.slice(0, 8).map((e) => this.item(e.item))),
      ));
    }
  }

  private world(): void {
    const keys: BiomeKey[] = ['meadow', 'dunes', 'taiga', 'blightmire', 'shore', 'skyisles', 'underground', 'sporeglow', 'glimmer', 'keep', 'emberdeep', 'shardblight'];
    this.page.append(this.h2('Biomes'));
    for (const k of keys) this.page.append(h('div', { class: 'gline' }, h('b', {}, BIOMES[k].name), ' — ', BIOMES[k].description));
    this.page.append(this.h2('World Events'));
    const how: Record<string, string> = {
      gloamtide: 'Random at dusk after the first boss, or light a Gloam Lantern at night.',
      raid: 'Random at dawn after Gravelmaw, or sound a Rusted Horn. Defeat enough raiders to win.',
      starfall: 'Random at dusk. Stars rain down and one crashes, leaving Starshard ore.',
      veilstorm: 'Random at dusk after the Unsealing. Voidwraiths hunt in the storm.',
    };
    for (const e of Object.values(WORLD_EVENTS)) this.page.append(h('div', { class: 'gset' }, h('b', {}, e.name), h('div', {}, e.description), h('div', { class: 'gmuted' }, how[e.id] ?? '')));
  }

  dispose(): void {
    this.el.remove();
  }
}
