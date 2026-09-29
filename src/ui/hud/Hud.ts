import type { GameSession } from '../../core/GameSession';
import { h, clear } from '../../utils/dom';
import { SlotView } from '../SlotView';
import { ItemRegistry } from '../../items/ItemRegistry';
import { RARITY_COLORS } from '../../items/types';
import { iconUrlFromSpec, itemIconUrl } from '../../rendering/sprites/itemIcons';
import { Tooltip, formatAurels } from '../Tooltip';
import { BIOMES } from '../../data/biomes';
import { escapeHtml } from '../../utils/dom';
import { TileRegistry } from '../../world/TileRegistry';

interface Msg {
  el: HTMLElement;
  t: number;
}

/** In-game heads-up display. Updates the DOM only when values change. */
export class Hud {
  readonly el: HTMLDivElement;
  private hotbar: SlotView[] = [];
  private heldName: HTMLDivElement;
  private lifeFill: HTMLDivElement;
  private lifeLabel: HTMLDivElement;
  private lifeBar: HTMLDivElement;
  private manaFill: HTMLDivElement;
  private manaLabel: HTMLDivElement;
  private buffsEl: HTMLDivElement;
  private walletEl: HTMLDivElement;
  private infoEl: HTMLDivElement;
  private bossEl: HTMLDivElement;
  private bossName: HTMLDivElement;
  private bossFill: HTMLDivElement;
  private bossGhost: HTMLDivElement;
  private eventEl: HTMLDivElement;
  private msgEl: HTMLDivElement;
  private deathEl: HTMLDivElement | null = null;
  private debugEl: HTMLDivElement;
  private mapEl: HTMLDivElement;
  private hoverEl: HTMLDivElement;
  readonly barsEl: HTMLDivElement;
  private msgs: Msg[] = [];
  private last: Record<string, string | number> = {};
  private bossGhostFrac = 1;
  mapOpen = false;

  constructor(private s: GameSession) {
    this.hotbar = Array.from({ length: 10 }, (_, i) => new SlotView({ num: String((i + 1) % 10) }));
    this.hotbar.forEach((v, i) => {
      v.el.classList.add('interactive');
      v.el.addEventListener('mousedown', (e) => {
        if (this.s.inventory.isOpen) return;
        e.stopPropagation();
        this.s.player.inventory.selected = i;
      });
    });
    this.heldName = h('div', { class: 'held-name' });
    this.lifeFill = h('div', { class: 'fill' });
    this.lifeLabel = h('div', { class: 'label' });
    this.lifeBar = h('div', { class: 'bar life' }, this.lifeFill, this.lifeLabel);
    this.manaFill = h('div', { class: 'fill' });
    this.manaLabel = h('div', { class: 'label' });
    this.buffsEl = h('div', { class: 'buffs interactive' });
    this.walletEl = h('div', { class: 'wallet' });
    this.infoEl = h('div', { class: 'info' });
    this.bossName = h('div', { class: 'bname' });
    this.bossFill = h('div', { class: 'fill' });
    this.bossGhost = h('div', { class: 'ghost' });
    this.bossEl = h('div', { class: 'bossbar' }, this.bossName, h('div', { class: 'bar' }, this.bossGhost, this.bossFill));
    this.bossEl.style.display = 'none';
    this.eventEl = h('div', { class: 'eventbar' });
    this.eventEl.style.display = 'none';
    this.msgEl = h('div', { class: 'messages' });
    this.debugEl = h('div', { class: 'debug' });
    this.debugEl.style.display = 'none';
    this.hoverEl = h('div', { class: 'crosshair-info' });
    this.mapEl = h('div', { class: 'fullmap' });
    this.mapEl.style.display = 'none';
    this.mapEl.addEventListener('click', () => this.toggleMap(false));
    this.barsEl = h('div', { class: 'bars' }, this.lifeBar, h('div', { class: 'bar mana' }, this.manaFill, this.manaLabel), this.buffsEl, this.walletEl, this.infoEl);
    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hotbar interactive' }, ...this.hotbar.map((v) => v.el)),
      this.heldName,
      this.barsEl,
      this.eventEl,
      this.bossEl,
      this.msgEl,
      this.debugEl,
      this.hoverEl,
      this.mapEl,
    );
    s.host.ui.root.appendChild(this.el);
  }

  private set(key: string, val: string | number, apply: () => void): void {
    if (this.last[key] === val) return;
    this.last[key] = val;
    apply();
  }

  update(): void {
    const p = this.s.player;
    const inv = p.inventory;
    for (let i = 0; i < 10; i++) {
      this.hotbar[i].set(inv.main.get(i));
      this.hotbar[i].select(i === inv.selected);
    }
    const held = inv.heldItem();
    const hn = held ? ItemRegistry.get(held.id).name : '';
    this.set('held', `${hn}|${held?.id}`, () => {
      this.heldName.textContent = hn;
      this.heldName.style.color = held ? RARITY_COLORS[ItemRegistry.get(held.id).rarity] ?? '#fff' : '#fff';
    });
    const life = Math.ceil(p.life);
    this.set('life', `${life}/${p.maxLife}`, () => {
      this.lifeFill.style.transform = `scaleX(${Math.max(0, p.life / p.maxLife)})`;
      this.lifeLabel.textContent = `${life} / ${p.maxLife}`;
      this.lifeBar.classList.toggle('low', p.life < p.maxLife * 0.25);
    });
    const mana = Math.floor(p.mana);
    this.set('mana', `${mana}/${p.maxMana}`, () => {
      this.manaFill.style.transform = `scaleX(${Math.max(0, p.mana / p.maxMana)})`;
      this.manaLabel.textContent = `${mana} / ${p.maxMana}`;
    });
    this.set('wallet', inv.wallet, () => {
      clear(this.walletEl);
      this.walletEl.append(h('img', { class: 'icon', src: itemIconUrl('aurel'), style: 'width:18px;height:18px' }), `${formatAurels(inv.wallet)}`);
    });
    if (this.s.tick % 10 === 0) this.updateBuffs();
    if (this.s.tick % 15 === 0) this.updateInfo();
    this.updateBoss();
    this.updateEvent();
    this.updateMessages();
    if (this.deathEl && !p.dead) {
      this.deathEl.remove();
      this.deathEl = null;
    }
    if (this.deathEl && p.dead && !p.permadead) {
      const t = this.deathEl.querySelector('.timer');
      if (t) t.textContent = `Respawning in ${Math.ceil(p.respawnTimer / 60)}...`;
    }
    if (this.mapOpen && this.s.tick % 10 === 0) this.s.minimap.renderFull(this.mapEl);
    if (this.s.tick % 4 === 0) this.updateHover();
  }

  /** Contextual hint next to the cursor: interactables, creatures, NPCs. */
  private updateHover(): void {
    const s = this.s;
    const inp = s.input;
    let text = '';
    if (inp.overCanvas && !s.inventory.isOpen && !s.player.dead) {
      const [wx, wy] = s.camera.screenToWorld(inp.mouseX, inp.mouseY);
      const inside = (e: { x: number; y: number; w: number; h: number }) => wx >= e.x - 2 && wx <= e.x + e.w + 2 && wy >= e.y - 2 && wy <= e.y + e.h + 2;
      const npc = s.entities.npcs.find(inside);
      const enemy = npc ? undefined : s.entities.enemies.find((e) => inside(e) && e.hittable && e.state !== 'disguised' && e.state !== 'buried');
      if (npc) text = `${npc.displayName} — right-click to talk`;
      else if (enemy) {
        const tgt = enemy.head ?? enemy;
        text = `${tgt.name}: ${Math.ceil(tgt.life)}/${tgt.maxLife}`;
      } else {
        const id = s.world.getFg(Math.floor(wx / 16), Math.floor(wy / 16));
        const key = TileRegistry.get(id).key;
        const hints: Record<string, string> = {
          chest: 'Chest — right-click to open',
          door_closed: 'Door — right-click to open',
          door_open: 'Door — right-click to close',
          bed: 'Bed — right-click to set spawn',
          vital_crystal: 'Vital Crystal — break it to claim its heart',
          pot: 'Clay Urn — break it',
        };
        text = hints[key] ?? '';
      }
      if (text) {
        const z = s.host.ui.scale || 1;
        this.hoverEl.style.left = `${(inp.mouseX + 18) / z}px`;
        this.hoverEl.style.top = `${(inp.mouseY + 14) / z}px`;
      }
    }
    this.set('hover', text, () => {
      this.hoverEl.textContent = text;
      this.hoverEl.style.display = text ? '' : 'none';
    });
  }

  private updateBuffs(): void {
    const list = this.s.player.buffs.list();
    const key = list.map((b) => `${b.def.id}:${Math.ceil(b.ticks / 60)}`).join(',');
    this.set('buffs', key, () => {
      clear(this.buffsEl);
      for (const { def, ticks } of list) {
        const secs = Math.ceil(ticks / 60);
        const el = h('div', { class: `buff ${def.debuff ? 'debuff' : ''}` }, h('img', { src: iconUrlFromSpec(def.icon) }), h('div', { class: 't' }, secs >= 60 ? `${Math.floor(secs / 60)}m` : `${secs}s`));
        el.addEventListener('mouseenter', () => Tooltip.show(`<div class="tname" style="color:${def.debuff ? '#ff8a8a' : '#a0ffa0'}">${def.name}</div><div class="tl">${def.description}</div>`));
        el.addEventListener('mouseleave', () => Tooltip.hide());
        this.buffsEl.appendChild(el);
      }
    });
  }

  private updateInfo(): void {
    const s = this.s;
    const p = s.player;
    const st = p.stats;
    const lines: string[] = [];
    lines.push(`${BIOMES[s.biome].name}`);
    if (st.showTime) lines.push(`${s.time.clockString()}`);
    if (st.showDepth) {
      const depth = p.tileY - s.world.layers.surfaceY;
      lines.push(depth <= 0 ? `${-depth}' above surface` : `${depth}' underground`);
    }
    if (st.detectEnemies) {
      const n = s.entities.enemies.filter((e) => !e.head && Math.hypot(e.cx - p.cx, e.cy - p.cy) < 16 * 50).length;
      lines.push(n ? `${n} creature${n > 1 ? 's' : ''} nearby` : 'No creatures nearby');
    }
    if (p.stats.setBonus) lines.push(`Set bonus active`);
    lines.push(`Defense ${p.defense}`);
    const text = lines.join('<br>');
    this.set('info', text, () => (this.infoEl.innerHTML = text));
    if (s.settings.showFps || s.settings.developerMode) {
      this.debugEl.style.display = '';
      const dbg = [`FPS ${s.host.fps()}  frame ${s.host.frameCost().toFixed(1)}ms`];
      if (s.settings.developerMode) {
        dbg.push(`pos ${p.tileX}, ${p.tileY}  zone ${s.world.zoneAt(p.tileY)}`);
        dbg.push(`entities ${s.entities.total} (enemies ${s.entities.enemies.length}, proj ${s.entities.projectiles.length})`);
        dbg.push(`chunks cached ${s.tiles.cachedChunks}  liquids awake ${s.liquids.awake}`);
        dbg.push(`particles ${s.particles.active}  time ${s.time.clockString()} day ${s.time.day}`);
        dbg.push(`weather ${s.weather.kind}/${s.weather.local}  event ${s.worldEvents.active?.id ?? '-'}`);
        dbg.push('` opens the debug console');
      }
      this.debugEl.textContent = dbg.join('\n');
    } else this.debugEl.style.display = 'none';
  }

  private updateBoss(): void {
    const b = this.s.bosses.primary;
    if (!b) {
      this.set('boss', 'none', () => (this.bossEl.style.display = 'none'));
      this.bossGhostFrac = 1;
      return;
    }
    const frac = Math.max(0, b.life / b.maxLife);
    this.bossGhostFrac = Math.max(frac, this.bossGhostFrac - 0.004);
    this.bossEl.style.display = '';
    const label = `${b.bdef.name}, ${b.bdef.title}${b.phase > 1 ? ` — Phase ${b.phase}` : ''}  (${Math.ceil(b.life)}/${b.maxLife})`;
    this.set('bossName', label, () => (this.bossName.textContent = label));
    this.bossFill.style.transform = `scaleX(${frac})`;
    this.bossGhost.style.transform = `scaleX(${this.bossGhostFrac})`;
  }

  private updateEvent(): void {
    const e = this.s.eventInfo();
    const key = e ? `${e.name}:${e.progress}/${e.goal}` : 'none';
    this.set('event', key, () => {
      if (!e) {
        this.eventEl.style.display = 'none';
        return;
      }
      this.eventEl.style.display = '';
      clear(this.eventEl);
      this.eventEl.append(h('div', { class: 'ename' }, e.name));
      if (e.goal > 0) {
        const fill = h('div', { class: 'fill' });
        fill.style.transform = `scaleX(${Math.min(1, e.progress / e.goal)})`;
        this.eventEl.append(h('div', { class: 'bar' }, fill, h('div', { class: 'label' }, `${e.progress} / ${e.goal}`)));
      }
    });
  }

  message(text: string, color = '#efe6d8'): void {
    const el = h('div', { class: 'msg', style: `color:${color}` }, text);
    this.msgEl.appendChild(el);
    this.msgs.push({ el, t: 0 });
    while (this.msgs.length > 7) this.msgs.shift()!.el.remove();
  }

  private updateMessages(): void {
    for (const m of this.msgs) {
      m.t++;
      if (m.t === 60 * 7) m.el.style.opacity = '0';
      if (m.t > 60 * 8) m.el.remove();
    }
    this.msgs = this.msgs.filter((m) => m.t <= 60 * 8);
  }

  private bannerEl: HTMLElement | null = null;

  /** Show a centre-screen banner; a newer banner replaces the current one. */
  banner(text: string, sub?: string, color = '#ffe16b', extraClass = ''): void {
    this.bannerEl?.remove();
    const el = h('div', { class: `banner ${extraClass}` }, h('div', { class: 'big', style: `color:${color}` }, text), sub ? h('div', { class: 'sub' }, sub) : null);
    this.bannerEl = el;
    this.el.appendChild(el);
    setTimeout(() => {
      el.remove();
      if (this.bannerEl === el) this.bannerEl = null;
    }, 4600);
  }

  bossIntro(name: string, title: string): void {
    this.banner(name, title, '#ff6a8a', 'boss-intro');
  }

  saveIndicator(text: string): void {
    this.message(text, '#8a9ab0');
  }

  showDeath(text: string, sub: string | null): void {
    this.deathEl?.remove();
    this.deathEl = h('div', { class: 'death' }, h('div', { class: 'big' }, 'You have fallen'), h('div', { class: 'sub', html: escapeHtml(text) }), sub ? h('div', { class: 'sub' }, sub) : h('div', { class: 'sub timer' }, ''));
    this.el.appendChild(this.deathEl);
  }

  toggleMap(force?: boolean): void {
    this.mapOpen = force ?? !this.mapOpen;
    this.mapEl.style.display = this.mapOpen ? '' : 'none';
    if (this.mapOpen) this.s.minimap.renderFull(this.mapEl);
  }

  dispose(): void {
    this.el.remove();
    Tooltip.hide();
  }
}
