import { ItemRegistry, sellPrice } from '../items/ItemRegistry';
import { RARITY_COLORS, RARITY_NAMES } from '../items/types';
import { describeMods } from '../items/stats';
import { SET_BONUSES } from '../data/items/armor';
import { RecipeRegistry } from '../crafting/RecipeRegistry';
import { escapeHtml } from '../utils/dom';

const speedWord = (t: number) => (t <= 8 ? 'Insanely fast' : t <= 15 ? 'Very fast' : t <= 20 ? 'Fast' : t <= 25 ? 'Average' : t <= 30 ? 'Slow' : 'Very slow');
const kbWord = (k: number) => (k <= 1 ? 'Very weak' : k <= 3 ? 'Weak' : k <= 5 ? 'Average' : k <= 7 ? 'Strong' : 'Very strong');

export function formatAurels(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`;
  return String(Math.floor(n));
}

/** Rich tooltip HTML for an item. */
export function itemTooltip(id: string, count = 1, extra: { buyPrice?: number; sell?: boolean; setWorn?: string | null } = {}): string {
  const d = ItemRegistry.get(id);
  const lines: string[] = [];
  const color = RARITY_COLORS[Math.min(d.rarity, RARITY_COLORS.length - 1)];
  lines.push(`<div class="tname" style="color:${color}">${escapeHtml(d.name)}${count > 1 ? ` (${count})` : ''}</div>`);
  const w = d.weapon;
  if (w && d.category !== 'tool') {
    lines.push(`<div class="tl">${w.damage} ${w.kind} damage</div>`);
    lines.push(`<div class="tm">${4 + (w.crit ?? 0)}% critical chance</div>`);
    lines.push(`<div class="tm">${speedWord(d.useTime ?? 20)} speed · ${kbWord(w.knockback)} knockback</div>`);
    if (w.manaCost) lines.push(`<div class="tm">Uses ${w.manaCost} mana</div>`);
    if (w.ammo) lines.push(`<div class="tm">Uses ${w.ammo === 'arrow' ? 'arrows' : 'pellets'} as ammo</div>`);
    if (w.kind === 'summon') lines.push(`<div class="tm">Summons a minion (uses 1 slot)</div>`);
  } else if (w && d.category === 'tool') {
    lines.push(`<div class="tl">${w.damage} melee damage</div>`);
  }
  if (d.tool) {
    if (d.tool.pick) lines.push(`<div class="tg">${d.tool.pick}% pickaxe power</div>`);
    if (d.tool.axe) lines.push(`<div class="tg">${d.tool.axe}% axe power</div>`);
    if (d.tool.hammer) lines.push(`<div class="tg">${d.tool.hammer}% hammer power</div>`);
  }
  if (d.armor) {
    lines.push(`<div class="tl">${d.armor.defense} defense</div>`);
    lines.push(`<div class="tm">Equippable (${d.armor.slot})</div>`);
    for (const l of describeMods(d.armor.mods ?? {})) lines.push(`<div class="tg">${l}</div>`);
    if (d.armor.set && SET_BONUSES[d.armor.set]) {
      const worn = extra.setWorn === d.armor.set;
      lines.push(`<div class="${worn ? 'tg' : 'tm'}">Set bonus: ${SET_BONUSES[d.armor.set].description}${worn ? ' (active)' : ''}</div>`);
    }
  }
  if (d.accessory) {
    lines.push(`<div class="tm">Accessory</div>`);
    for (const l of describeMods(d.accessory)) lines.push(`<div class="tg">${l}</div>`);
  }
  if (d.ammo) lines.push(`<div class="tl">${d.ammo.damage} ranged damage</div><div class="tm">Ammunition</div>`);
  const c = d.consumable;
  if (c) {
    if (c.heal) lines.push(`<div class="tg">Restores ${c.heal} health</div>`);
    if (c.mana) lines.push(`<div class="tg">Restores ${c.mana} mana</div>`);
    if (c.maxLifeUp) lines.push(`<div class="tg">+${c.maxLifeUp} maximum health (up to 400)</div>`);
    if (c.maxManaUp) lines.push(`<div class="tg">+${c.maxManaUp} maximum mana (up to 200)</div>`);
    lines.push(`<div class="tm">Consumable</div>`);
  }
  if (d.placeTile || d.placeWall) lines.push(`<div class="tm">Can be placed</div>`);
  if (RecipeRegistry.usingIngredient(id).length) lines.push(`<div class="tm">Material</div>`);
  if (d.description) lines.push(`<div class="tl">${escapeHtml(d.description)}</div>`);
  if (d.rarity >= 1) lines.push(`<div class="tm" style="color:${color}">${RARITY_NAMES[d.rarity] ?? ''}</div>`);
  if (extra.buyPrice !== undefined) lines.push(`<div class="tv">Buy: ${formatAurels(extra.buyPrice)} aurels</div>`);
  else if (extra.sell && d.value > 0 && id !== 'aurel') lines.push(`<div class="tv">Sell: ${formatAurels(Math.max(1, sellPrice(d, count)))} aurels</div>`);
  return lines.join('');
}

class TooltipImpl {
  private el: HTMLDivElement | null = null;
  private visible = false;

  private ensure(): HTMLDivElement {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'tooltip';
      this.el.style.display = 'none';
      document.body.appendChild(this.el);
      window.addEventListener('mousemove', (e) => this.move(e.clientX, e.clientY));
    }
    return this.el;
  }

  show(html: string): void {
    const el = this.ensure();
    el.innerHTML = html;
    el.style.display = 'block';
    this.visible = true;
  }

  hide(): void {
    if (this.el && this.visible) {
      this.el.style.display = 'none';
      this.visible = false;
    }
  }

  private move(x: number, y: number): void {
    if (!this.el || !this.visible) return;
    const r = this.el.getBoundingClientRect();
    const nx = x + 18 + r.width > window.innerWidth ? x - r.width - 12 : x + 18;
    const ny = y + 18 + r.height > window.innerHeight ? y - r.height - 12 : y + 18;
    this.el.style.left = `${nx}px`;
    this.el.style.top = `${ny}px`;
  }
}

export const Tooltip = new TooltipImpl();
