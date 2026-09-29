import type { GameSession } from '../../core/GameSession';
import { h } from '../../utils/dom';
import { buildSettingsPanel } from '../menus/SettingsScreen';
import { controlsHelp } from '../menus/controlsHelp';

/** Escape menu: resume, save, settings, controls and quit. */
export class PauseMenu {
  private el: HTMLDivElement;
  isOpen = false;

  constructor(private s: GameSession) {
    this.el = h('div', { class: 'modal-back' });
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.isOpen = true;
    this.s.paused = true;
    this.s.host.input.releaseMouse();
    this.showMain();
    this.el.style.display = '';
  }

  close(): void {
    this.isOpen = false;
    this.s.paused = false;
    this.el.style.display = 'none';
  }

  private showMain(): void {
    this.el.replaceChildren(
      h('div', { class: 'panel col', style: 'min-width:320px;align-items:stretch' },
        h('h2', {}, this.s.online ? 'Menu (online — game continues)' : 'Paused'),
        h('button', { class: 'btn', onclick: () => this.close() }, 'Resume'),
        h('button', { class: 'btn', onclick: async () => { await this.s.save('manual'); } }, 'Save Game'),
        h('button', { class: 'btn', onclick: () => { this.close(); this.s.guide.open(); } }, 'Delver\u2019s Almanac (G)'),
        h('button', { class: 'btn', onclick: () => this.showSettings() }, 'Settings'),
        h('button', { class: 'btn', onclick: () => this.showControls() }, 'Controls'),
        h('button', { class: 'btn danger', onclick: () => { this.close(); void this.s.exit(); } }, 'Save & Quit to Menu'),
      ),
    );
  }

  private showSettings(): void {
    const panel = buildSettingsPanel(this.s.host, () => this.showMain());
    this.el.replaceChildren(panel);
  }

  private showControls(): void {
    this.el.replaceChildren(h('div', { class: 'panel col menu-panel' }, h('h2', {}, 'Controls'), controlsHelp(this.s.host.input), h('button', { class: 'btn', onclick: () => this.showMain() }, 'Back')));
  }

  dispose(): void {
    this.el.remove();
    if (this.isOpen) this.s.paused = false;
  }
}
