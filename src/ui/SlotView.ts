import { itemIconUrl } from '../rendering/sprites/itemIcons';
import { ItemRegistry } from '../items/ItemRegistry';
import type { Slot } from '../items/ItemStack';
import { h } from '../utils/dom';
import { Tooltip, itemTooltip } from './Tooltip';

/** A reusable DOM item slot that only touches the DOM when its contents change. */
export class SlotView {
  readonly el: HTMLDivElement;
  private img: HTMLImageElement;
  private countEl: HTMLSpanElement;
  private lastId: string | null = null;
  private lastCount = -1;
  tooltipExtra: () => Parameters<typeof itemTooltip>[2] = () => ({ sell: true });
  current: Slot = null;

  constructor(opts: { num?: string; ghostIcon?: string; className?: string } = {}) {
    this.img = h('img', { class: 'icon', draggable: 'false', alt: '' });
    this.img.style.display = 'none';
    this.countEl = h('span', { class: 'count' });
    this.el = h('div', { class: `slot ${opts.className ?? ''}` }, this.img, this.countEl, opts.num ? h('span', { class: 'num' }, opts.num) : null);
    if (opts.ghostIcon) {
      this.el.classList.add('ghost');
      this.img.src = itemIconUrl(opts.ghostIcon);
      this.img.style.display = '';
      this.ghost = opts.ghostIcon;
    }
    this.el.addEventListener('mouseenter', () => {
      if (this.current) Tooltip.show(itemTooltip(this.current.id, this.current.count, this.tooltipExtra()));
    });
    this.el.addEventListener('mouseleave', () => Tooltip.hide());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private ghost: string | null = null;

  set(s: Slot): void {
    this.current = s;
    const id = s?.id ?? null;
    const count = s?.count ?? 0;
    if (id === this.lastId && count === this.lastCount) return;
    this.lastId = id;
    this.lastCount = count;
    if (id) {
      this.img.src = itemIconUrl(id);
      this.img.style.display = '';
      this.el.classList.remove('ghost');
      const r = ItemRegistry.get(id).rarity;
      this.el.className = this.el.className.replace(/\br\d\b/g, '').trim() + (r ? ` r${r}` : '');
    } else if (this.ghost) {
      this.img.src = itemIconUrl(this.ghost);
      this.img.style.display = '';
      this.el.classList.add('ghost');
    } else {
      this.img.style.display = 'none';
    }
    this.countEl.textContent = count > 1 ? String(count) : '';
  }

  select(on: boolean): void {
    this.el.classList.toggle('sel', on);
  }
}
