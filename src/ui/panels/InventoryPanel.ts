import type { GameSession } from '../../core/GameSession';
import { h, clear } from '../../utils/dom';
import { SlotView } from '../SlotView';
import type { ItemContainer } from '../../inventory/ItemContainer';
import { leftClickSlot, rightClickSlot, shiftClickSlot, type Cursor } from '../../inventory/transfer';
import { ItemRegistry } from '../../items/ItemRegistry';
import { itemIconUrl } from '../../rendering/sprites/itemIcons';
import { nearbyStations, listRecipes, craft, maxCrafts } from '../../crafting/CraftingSystem';
import type { Recipe } from '../../crafting/RecipeRegistry';
import type { ChestData } from '../../world/WorldState';
import { ItemContainer as Container } from '../../inventory/ItemContainer';
import { Tooltip, itemTooltip } from '../Tooltip';
import { TileRegistry } from '../../world/TileRegistry';

const STATION_NAMES: Record<string, string> = {
  workbench: 'Workbench', furnace: 'Smelter', anvil: 'Anvil', alembic: 'Alembic', runescribe: 'Runescribe Desk', aetherforge: 'Aetherforge', starloom: 'Starloom', bookcase: 'Bookcase',
};

/**
 * Inventory screen: backpack + hotbar, equipment, ammo, trash, crafting and
 * (when open) a chest. Implements click-to-drag, stack splitting and
 * shift-click quick moves on top of the pure ItemContainer logic.
 */
export class InventoryPanel {
  readonly cursor: Cursor = { stack: null };
  private el: HTMLDivElement;
  private views = new Map<ItemContainer, SlotView[]>();
  private cursorEl: HTMLDivElement;
  private cursorImg: HTMLImageElement;
  private cursorCount: HTMLSpanElement;
  private chestWrap: HTMLDivElement;
  private chest: ChestData | null = null;
  private chestContainer: Container | null = null;
  private craftList: HTMLDivElement;
  private craftDetail: HTMLDivElement;
  private stationsEl: HTMLDivElement;
  private selectedRecipe: Recipe | null = null;
  private recipeKey = '';
  private lastInvVersion = -1;
  isOpen = false;

  constructor(private s: GameSession) {
    const inv = s.player.inventory;
    this.cursorImg = h('img', { class: 'icon' });
    this.cursorCount = h('span', { class: 'count' });
    this.cursorEl = h('div', { class: 'cursor-item' }, this.cursorImg, this.cursorCount);
    this.cursorEl.style.display = 'none';
    document.body.appendChild(this.cursorEl);
    window.addEventListener('mousemove', this.onMove);

    const main = h('div', { class: 'grid' }, ...this.makeViews(inv.main, (i) => ({ num: i < 10 ? String((i + 1) % 10) : undefined })));
    const armorGhosts = ['brasslite_head', 'brasslite_body', 'brasslite_legs'];
    const armor = h('div', { class: 'subgrid' }, ...this.makeViews(inv.armor, (i) => ({ ghostIcon: armorGhosts[i] })));
    const acc = h('div', { class: 'subgrid' }, ...this.makeViews(inv.accessories, () => ({ ghostIcon: 'stonehide_charm' })));
    const ammo = h('div', { class: 'subgrid' }, ...this.makeViews(inv.ammo, () => ({ ghostIcon: 'wooden_arrow' })));
    const trash = h('div', {}, ...this.makeViews(inv.trash, () => ({ className: 'trash-slot' })));
    const sortBtn = h('button', { class: 'btn small', onclick: () => inv.main.sort([10, 50]) }, 'Sort');
    const depositBtn = h('button', { class: 'btn small', title: 'Quick stack to nearby chests', onclick: () => this.quickStackNearby() }, 'Quick Stack');
    this.chestWrap = h('div', { class: 'panel' });
    this.chestWrap.style.display = 'none';
    this.stationsEl = h('div', { class: 'label-sm' });
    this.craftList = h('div', { class: 'craft-list' });
    this.craftDetail = h('div', { class: 'craft-detail' });
    this.el = h(
      'div',
      { class: 'inv-wrap' },
      h('div', { class: 'col' },
        h('div', { class: 'panel' }, h('h3', {}, 'Inventory'), main, h('div', { class: 'row', style: 'margin-top:8px' }, sortBtn, depositBtn, h('div', { class: 'spacer' }), h('span', { class: 'label-sm' }, 'Trash'), trash)),
        this.chestWrap,
      ),
      h('div', { class: 'panel' },
        h('h3', {}, 'Equipment'),
        h('div', { class: 'row', style: 'align-items:flex-start' },
          h('div', { class: 'col', style: 'gap:4px' }, h('div', { class: 'label-sm' }, 'Armour'), armor),
          h('div', { class: 'col', style: 'gap:4px' }, h('div', { class: 'label-sm' }, 'Accessories'), acc),
          h('div', { class: 'col', style: 'gap:4px' }, h('div', { class: 'label-sm' }, 'Ammo'), ammo),
        ),
      ),
      h('div', { class: 'panel', style: 'width:340px' }, h('h3', {}, 'Crafting'), this.stationsEl, this.craftList, this.craftDetail),
    );
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
  }

  private makeViews(c: ItemContainer, opts: (i: number) => ConstructorParameters<typeof SlotView>[0]): HTMLElement[] {
    const views: SlotView[] = [];
    for (let i = 0; i < c.size; i++) {
      const v = new SlotView(opts(i));
      v.tooltipExtra = () => ({ sell: true, setWorn: this.s.player.stats.setBonus });
      v.el.addEventListener('mousedown', (e) => this.onSlot(c, i, e));
      views.push(v);
    }
    this.views.set(c, views);
    return views.map((v) => v.el);
  }

  private onSlot(c: ItemContainer, i: number, e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const inv = this.s.player.inventory;
    const audio = this.s.audio;
    if (e.button === 0 && e.shiftKey) {
      // Quick move: main <-> chest, else hotbar <-> backpack, equip items go to their slots.
      const targets: { c: ItemContainer; range?: [number, number] }[] = [];
      if (c === inv.main) {
        const s = c.get(i);
        if (s && this.chestContainer) targets.push({ c: this.chestContainer });
        else if (s && (ItemRegistry.get(s.id).armor || ItemRegistry.get(s.id).category === 'accessory')) {
          if (inv.quickEquip(i)) audio.play('cloth');
          return;
        } else if (s && ItemRegistry.get(s.id).category === 'ammo') targets.push({ c: inv.ammo });
        else targets.push({ c: inv.main, range: i < 10 ? [10, 50] : [0, 10] });
      } else targets.push({ c: inv.main });
      if (shiftClickSlot(c, i, targets)) audio.play('pickup', { volume: 0.4 });
      this.afterChestChange(c);
      return;
    }
    if (e.button === 0 && e.ctrlKey && c !== inv.trash) {
      const s = c.get(i);
      if (s) {
        inv.trash.set(0, s);
        c.set(i, null);
        audio.play('cloth');
      }
      this.afterChestChange(c);
      return;
    }
    if (e.button === 2 && c === inv.main) {
      const s = c.get(i);
      if (s && !this.cursor.stack && (ItemRegistry.get(s.id).armor || ItemRegistry.get(s.id).category === 'accessory')) {
        if (inv.quickEquip(i)) audio.play('cloth');
        return;
      }
    }
    const before = this.cursor.stack?.id;
    if (e.button === 0) leftClickSlot(c, i, this.cursor);
    else if (e.button === 2) rightClickSlot(c, i, this.cursor);
    if (before !== this.cursor.stack?.id) audio.play('pickup', { volume: 0.3, pitch: 1.3 });
    this.afterChestChange(c);
    Tooltip.hide();
  }

  private afterChestChange(c: ItemContainer): void {
    if (c === this.chestContainer || this.chestContainer) this.syncChest();
  }

  private onMove = (e: MouseEvent): void => {
    this.cursorEl.style.left = `${e.clientX + 6}px`;
    this.cursorEl.style.top = `${e.clientY + 6}px`;
  };

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.isOpen = true;
    this.el.style.display = '';
    this.s.audio.play('menuClick');
    this.recipeKey = '';
  }

  close(): void {
    this.isOpen = false;
    this.el.style.display = 'none';
    this.closeChest();
    Tooltip.hide();
    // Return the dragged item to the inventory (or drop it).
    if (this.cursor.stack) {
      const left = this.s.player.inventory.give(this.cursor.stack);
      if (left > 0) this.s.dropItem({ id: this.cursor.stack.id, count: left }, this.s.player.cx, this.s.player.cy);
      this.cursor.stack = null;
    }
  }

  openChest(chest: ChestData): void {
    this.chest = chest;
    this.chestContainer = new Container(40);
    this.chestContainer.slots.splice(0, 40, ...chest.items.map((s) => (s ? { ...s } : null)));
    clear(this.chestWrap);
    this.views.delete(this.chestContainer);
    const grid = h('div', { class: 'grid' }, ...this.makeViews(this.chestContainer, () => ({})));
    const c = this.chestContainer;
    const inv = this.s.player.inventory;
    const nameInput = h('input', { type: 'text', value: chest.name ?? '', placeholder: 'Chest', maxlength: '24', style: 'width:160px;font-size:18px' });
    nameInput.addEventListener('focus', () => (this.s.input.typing = true));
    nameInput.addEventListener('blur', () => {
      this.s.input.typing = false;
      chest.name = nameInput.value.trim() || undefined;
      this.s.net?.sendChest(chest);
    });
    this.chestWrap.append(
      h('div', { class: 'row' }, h('h3', { style: 'margin:0' }, 'Chest'), nameInput),
      grid,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn small', onclick: () => { c.depositAll(inv.main, [0, 40]); this.syncChest(); } }, 'Loot All'),
        h('button', { class: 'btn small', onclick: () => { inv.main.depositAll(c, [10, 50]); this.syncChest(); } }, 'Deposit All'),
        h('button', { class: 'btn small', onclick: () => { inv.main.quickStackInto(c, [10, 50]); this.syncChest(); } }, 'Quick Stack'),
        h('button', { class: 'btn small', onclick: () => { c.sort(); this.syncChest(); } }, 'Sort'),
      ),
    );
    this.chestWrap.style.display = '';
    if (!this.isOpen) this.open();
  }

  private syncChest(): void {
    if (!this.chest || !this.chestContainer) return;
    this.chest.items = this.chestContainer.serialize();
    this.s.net?.sendChest(this.chest);
  }

  /** Called by the network layer when another player edits the open chest. */
  refreshChest(chest: ChestData): void {
    if (this.chest && this.chest.x === chest.x && this.chest.y === chest.y && this.chestContainer) this.chestContainer.load(chest.items);
  }

  closeChest(): void {
    if (this.chest) {
      this.syncChest();
      this.s.audio.play('chest', { pitch: 0.8 });
    }
    this.chest = null;
    this.chestContainer = null;
    this.chestWrap.style.display = 'none';
  }

  private quickStackNearby(): void {
    const p = this.s.player;
    let moved = 0;
    for (const chest of this.s.world.chests.values()) {
      if (Math.abs(chest.x - p.tileX) > 12 || Math.abs(chest.y - p.tileY) > 8) continue;
      const c = new Container(40);
      c.load(chest.items);
      moved += p.inventory.main.quickStackInto(c, [10, 50]);
      chest.items = c.serialize();
      this.s.net?.sendChest(chest);
    }
    this.s.message(moved ? `Quick-stacked ${moved} items to nearby chests.` : 'Nothing to quick-stack nearby.', '#c0c0c0');
  }

  update(): void {
    if (this.cursor.stack) {
      this.cursorEl.style.display = '';
      this.cursorImg.src = itemIconUrl(this.cursor.stack.id);
      this.cursorCount.textContent = this.cursor.stack.count > 1 ? String(this.cursor.stack.count) : '';
    } else this.cursorEl.style.display = 'none';
    if (!this.isOpen) return;
    for (const [c, views] of this.views) views.forEach((v, i) => v.set(c.get(i)));
    const inv = this.s.player.inventory;
    const hot = this.views.get(inv.main);
    hot?.forEach((v, i) => v.select(i === inv.selected));
    // Chest range check.
    if (this.chest) {
      const p = this.s.player;
      const id = this.s.world.getFg(this.chest.x, this.chest.y);
      if (Math.abs(this.chest.x - p.tileX) > 7 || Math.abs(this.chest.y - p.tileY) > 6 || id !== TileRegistry.id('chest')) this.closeChest();
    }
    if (this.s.tick % 15 === 0 || inv.main.version !== this.lastInvVersion) {
      this.lastInvVersion = inv.main.version;
      this.updateCrafting();
    }
  }

  private updateCrafting(): void {
    const p = this.s.player;
    const stations = nearbyStations(this.s.world, p.tileX, p.tileY);
    const sources: ItemContainer[] = [p.inventory.main];
    const recipes = listRecipes(stations, this.s.progression.flags, sources);
    const key = [...stations].sort().join(',') + '|' + recipes.map((r) => `${r.recipe.index}${r.craftable ? '+' : '-'}`).join(',');
    if (key === this.recipeKey) return;
    this.recipeKey = key;
    const names = [...stations].map((s) => STATION_NAMES[s] ?? s);
    this.stationsEl.textContent = names.length ? `Nearby: ${names.join(', ')}` : 'By hand (stand near stations for more)';
    clear(this.craftList);
    for (const { recipe, craftable } of recipes) {
      const v = new SlotView({ className: craftable ? '' : 'no' });
      v.set({ id: recipe.out, count: recipe.count });
      v.tooltipExtra = () => ({});
      if (this.selectedRecipe?.index === recipe.index) v.select(true);
      v.el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (this.selectedRecipe?.index === recipe.index && craftable) this.doCraft(recipe, e.shiftKey);
        this.selectedRecipe = recipe;
        this.recipeKey = '';
        this.updateCrafting();
      });
      this.craftList.appendChild(v.el);
    }
    this.renderDetail(sources);
  }

  private renderDetail(sources: ItemContainer[]): void {
    clear(this.craftDetail);
    const r = this.selectedRecipe;
    if (!r) {
      this.craftDetail.append(h('span', { class: 'hint' }, 'Select a recipe. Click it again (or press Craft) to craft; Shift crafts up to 10.'));
      return;
    }
    const def = ItemRegistry.get(r.out);
    const n = maxCrafts(r, sources);
    const title = h('div', { class: 'row' }, h('img', { class: 'icon', src: itemIconUrl(r.out), style: 'width:28px;height:28px' }), h('b', {}, `${def.name}${r.count > 1 ? ` ×${r.count}` : ''}`));
    title.addEventListener('mouseenter', () => Tooltip.show(itemTooltip(r.out, r.count)));
    title.addEventListener('mouseleave', () => Tooltip.hide());
    const ings = r.ing.map(([id, need]) => {
      const have = sources.reduce((a, c) => a + c.count(id), 0);
      return h('div', { class: `ing ${have < need ? 'missing' : ''}` }, h('img', { src: itemIconUrl(id) }), `${ItemRegistry.get(id).name} ${have}/${need}`);
    });
    const btn = h('button', { class: 'btn small good', disabled: n <= 0, onclick: (e: Event) => this.doCraft(r, (e as MouseEvent).shiftKey) }, n > 0 ? 'Craft' : 'Missing materials');
    this.craftDetail.append(title, ...ings, ...(r.station ? [h('div', { class: 'hint' }, `Requires: ${STATION_NAMES[r.station] ?? r.station}`)] : []), btn);
  }

  private doCraft(r: Recipe, many: boolean): void {
    const inv = this.s.player.inventory;
    const times = many ? Math.min(10, maxCrafts(r, [inv.main])) : 1;
    let crafted = 0;
    for (let k = 0; k < times; k++) {
      const out = craft(r, [inv.main]);
      if (!out) break;
      crafted++;
      const c = this.cursor.stack;
      if (!c) this.cursor.stack = out;
      else if (c.id === out.id && c.count + out.count <= ItemRegistry.get(out.id).maxStack) c.count += out.count;
      else {
        const left = inv.give(out);
        if (left > 0) this.s.dropItem({ id: out.id, count: left }, this.s.player.cx, this.s.player.cy);
      }
    }
    if (crafted) {
      this.s.audio.play('craft');
      this.recipeKey = '';
    }
  }

  dispose(): void {
    window.removeEventListener('mousemove', this.onMove);
    this.el.remove();
    this.cursorEl.remove();
  }
}
