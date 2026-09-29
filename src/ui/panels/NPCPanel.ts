import type { GameSession } from '../../core/GameSession';
import type { NPC } from '../../entities/npcs/NPC';
import { h, clear } from '../../utils/dom';
import { SlotView } from '../SlotView';
import { ItemRegistry, sellPrice } from '../../items/ItemRegistry';
import { formatAurels } from '../Tooltip';
import type { ItemStack } from '../../items/ItemStack';
import { itemIconUrl } from '../../rendering/sprites/itemIcons';

/** NPC conversation window with shop, selling, buyback and services. */
export class NPCPanel {
  private el: HTMLDivElement;
  private npc: NPC | null = null;
  private body: HTMLDivElement;
  private buyback: ItemStack[] = [];
  private mode: 'talk' | 'shop' = 'talk';
  isOpen = false;

  constructor(private s: GameSession) {
    this.body = h('div', { class: 'col' });
    this.el = h('div', { class: 'panel npc-panel' }, this.body);
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
  }

  /** Dock under the backpack when the inventory is open; otherwise sit in that same spot on its own. */
  private place(): void {
    const docked = this.s.inventory.isOpen;
    const parent = docked ? this.s.inventory.dock : this.s.host.ui.root;
    if (this.el.parentElement !== parent) parent.appendChild(this.el);
    this.el.classList.toggle('docked', docked);
  }

  open(n: NPC): void {
    this.npc = n;
    this.isOpen = true;
    this.mode = 'talk';
    this.s.inventory.closeChest();
    this.place();
    this.el.style.display = '';
    n.talking = 60 * 60;
    this.renderTalk(this.s.npcs.dialogue(this.s, n));
  }

  close(): void {
    if (this.npc) this.npc.talking = 0;
    this.npc = null;
    this.isOpen = false;
    this.el.style.display = 'none';
  }

  private header(): HTMLElement {
    const n = this.npc!;
    return h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, n.displayName), h('div', { class: 'spacer' }), h('div', { class: 'wallet' }, h('img', { class: 'icon', src: itemIconUrl('aurel'), style: 'width:18px;height:18px' }), formatAurels(this.s.player.inventory.wallet)));
  }

  private renderTalk(text: string): void {
    const n = this.npc!;
    clear(this.body);
    const btns: HTMLElement[] = [];
    if (n.def.shop.length) btns.push(h('button', { class: 'btn gold', onclick: () => this.renderShop() }, 'Shop'));
    if (n.def.service === 'heal') {
      const cost = this.s.npcs.healCost(this.s);
      btns.push(h('button', { class: 'btn good', disabled: cost <= 0, onclick: () => this.heal() }, cost > 0 ? `Heal (${cost})` : 'Healthy'));
    }
    btns.push(h('button', { class: 'btn', onclick: () => this.renderTalk(this.s.npcs.dialogue(this.s, n)) }, 'Chat'));
    btns.push(h('button', { class: 'btn', onclick: () => this.housing() }, 'Housing'));
    btns.push(h('button', { class: 'btn', onclick: () => this.close() }, 'Close'));
    this.body.append(this.header(), h('div', { class: 'dialog-text' }, `“${text}”`), h('div', { class: 'row', style: 'flex-wrap:wrap' }, ...btns));
  }

  private housing(): void {
    const n = this.npc!;
    const lines: string[] = [];
    if (n.homeX !== null && n.homeY !== null) lines.push(this.s.npcs.queryHousing(this.s, n.homeX, n.homeY));
    else lines.push(`${n.name} has no home. Build a room: walls behind, a door, a light, a table and a chair.`);
    const hints = this.s.npcs.hints(this.s);
    const box = h('div', { class: 'col' }, ...lines.map((l) => h('div', { class: 'dialog-text' }, l)), hints.length ? h('div', { class: 'label-sm' }, 'Who might come next:') : null, ...hints.map((l) => h('div', { class: 'hint' }, l)));
    clear(this.body);
    this.body.append(this.header(), box, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => this.renderTalk(this.s.npcs.dialogue(this.s, n)) }, 'Back')));
  }

  private heal(): void {
    const cost = this.s.npcs.healCost(this.s);
    const p = this.s.player;
    if (p.inventory.wallet < cost) {
      this.renderTalk('You can’t afford my care, I’m afraid. Come back with more aurels.');
      return;
    }
    p.inventory.wallet -= cost;
    p.heal(this.s, p.maxLife);
    for (const b of p.buffs.list()) if (b.def.debuff && b.def.id !== 'potion_sickness') p.buffs.remove(b.def.id);
    this.s.audio.play('powerup');
    this.renderTalk('There. Good as new. Try to keep it that way.');
  }

  private renderShop(): void {
    this.mode = 'shop';
    const n = this.npc!;
    clear(this.body);
    const items = this.s.npcs.shop(this.s, n);
    const grid = h('div', { class: 'shop-grid' });
    for (const { entry, price } of items) {
      const v = new SlotView();
      v.set({ id: entry.item, count: 1 });
      v.tooltipExtra = () => ({ buyPrice: price });
      v.el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.buy(entry.item, price, e.shiftKey ? 10 : 1);
      });
      grid.appendChild(v.el);
    }
    const bbGrid = h('div', { class: 'shop-grid' });
    this.buyback.forEach((st, i) => {
      const v = new SlotView();
      v.set(st);
      const price = Math.max(1, sellPrice(ItemRegistry.get(st.id), st.count));
      v.tooltipExtra = () => ({ buyPrice: price });
      v.el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const p = this.s.player;
        if (p.inventory.wallet < price) return;
        if (p.inventory.give(st) > 0) return;
        p.inventory.wallet -= price;
        this.buyback.splice(i, 1);
        this.s.audio.play('coin');
        this.renderShop();
      });
      bbGrid.appendChild(v.el);
    });
    const sellSlot = new SlotView({ className: 'trash-slot' });
    sellSlot.el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.sellCursor();
    });
    this.body.append(
      this.header(),
      h('div', { class: 'hint' }, 'Click to buy (Shift: 10). Sell: drop an item on the red slot, or Sell Held.'),
      grid,
      h('div', { class: 'row', style: 'margin-top:6px' }, h('span', { class: 'label-sm' }, 'Sell'), sellSlot.el, h('button', { class: 'btn small', onclick: () => this.sellHeld() }, 'Sell Held'), h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => this.renderTalk(this.s.npcs.dialogue(this.s, n)) }, 'Back'), h('button', { class: 'btn small', onclick: () => this.close() }, 'Close')),
      ...(this.buyback.length ? [h('div', { class: 'label-sm' }, 'Buy back')] : []),
      bbGrid,
    );
    if (!this.s.inventory.isOpen) this.s.inventory.open();
    this.place();
  }

  private buy(id: string, price: number, qty: number): void {
    const p = this.s.player;
    const def = ItemRegistry.get(id);
    const n = def.maxStack > 1 ? qty : 1;
    let bought = 0;
    for (let i = 0; i < n; i++) {
      if (p.inventory.wallet < price) break;
      if (!p.inventory.canFit({ id, count: 1 })) break;
      p.inventory.give({ id, count: 1 });
      p.inventory.wallet -= price;
      bought++;
    }
    if (bought) {
      this.s.audio.play('coin');
      this.s.message(`Bought ${def.name}${bought > 1 ? ` ×${bought}` : ''}.`, '#f5cf3c');
    } else this.s.message(p.inventory.wallet < price ? 'Not enough aurels.' : 'No room in your inventory.', '#ffb070');
    this.renderShop();
  }

  private sell(stack: ItemStack): void {
    const def = ItemRegistry.get(stack.id);
    const value = Math.max(1, sellPrice(def, stack.count));
    this.s.player.inventory.wallet += value;
    this.buyback.unshift({ ...stack });
    if (this.buyback.length > 6) this.buyback.pop();
    this.s.audio.play('coin');
    this.s.message(`Sold ${def.name}${stack.count > 1 ? ` ×${stack.count}` : ''} for ${value} aurels.`, '#f5cf3c');
  }

  private sellCursor(): void {
    const c = this.s.inventory.cursor;
    if (!c.stack || c.stack.id === 'aurel') return;
    this.sell(c.stack);
    c.stack = null;
    this.renderShop();
  }

  private sellHeld(): void {
    const inv = this.s.player.inventory;
    const s = inv.heldItem();
    if (!s) return;
    inv.main.set(inv.selected, null);
    this.sell(s);
    this.renderShop();
  }

  update(): void {
    if (!this.npc) return;
    this.place();
    const p = this.s.player;
    if (Math.hypot(this.npc.cx - p.cx, this.npc.cy - p.cy) > 16 * 9 || p.dead) this.close();
    else this.npc.talking = Math.max(this.npc.talking, 30);
    void this.mode;
  }

  dispose(): void {
    this.el.remove();
  }
}
