import type { GameSession } from '../../core/GameSession';
import { h } from '../../utils/dom';
import { buildSettingsPanel } from '../menus/SettingsScreen';
import { controlsHelp } from '../menus/controlsHelp';
import type { FirebaseTransport, Roster } from '../../multiplayer/firebase/FirebaseTransport';

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
    this.el.style.display = '';
    this.showMain();
  }

  close(): void {
    this.isOpen = false;
    this.s.paused = false;
    if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.el.style.display = 'none';
  }

  /** Keyboard users land on the first control of each view (Escape still closes the menu). */
  private focusFirst(): void {
    (this.el.querySelector('button, input, select, a[href]') as HTMLElement | null)?.focus();
  }

  private showMain(): void {
    this.el.replaceChildren(
      h('div', { class: 'panel col', style: 'min-width:320px;align-items:stretch' },
        h('h2', {}, this.s.online ? 'Menu (online — game continues)' : 'Paused'),
        h('button', { class: 'btn', onclick: () => this.close() }, 'Resume'),
        h('button', { class: 'btn', onclick: async () => { await this.s.save('manual'); } }, 'Save Game'),
        this.room() ? h('button', { class: 'btn gold', onclick: () => this.showOnline() }, 'Online World…') : null,
        h('button', { class: 'btn', onclick: () => { this.close(); this.s.guide.open(); } }, 'Delver\u2019s Almanac (G)'),
        h('button', { class: 'btn', onclick: () => this.showSettings() }, 'Settings'),
        h('button', { class: 'btn', onclick: () => this.showControls() }, 'Controls'),
        h('button', { class: 'btn danger', onclick: () => { this.close(); void this.s.exit(); } }, 'Save & Quit to Menu'),
      ),
    );
    this.focusFirst();
  }

  /** The Firebase room behind this session, if any. */
  private room(): FirebaseTransport | null {
    const t = this.s.net?.transport as Partial<FirebaseTransport> | undefined;
    return t && typeof t.roster === 'function' ? (t as FirebaseTransport) : null;
  }

  /** Members, who's online, and the owner's kick / ban / lock controls. */
  private showOnline(): void {
    const room = this.room();
    if (!room) return;
    const status = h('div', { class: 'hint' });
    const act = (label: string, cls: string, fn: () => Promise<void>, confirmText?: string) =>
      h('button', {
        class: `btn small ${cls}`,
        onclick: async () => {
          if (confirmText && !(await this.s.host.ui.confirm('Online world', confirmText))) return;
          try {
            await fn();
            status.textContent = '';
          } catch (e) {
            status.textContent = `That didn’t work: ${(e as Error).message}`;
          }
        },
      }, label);
    const body = h('div', { class: 'col', style: 'gap:8px' });
    const render = (r: Roster) => {
      const members = r.members.map((m) => h('div', { class: 'row online-member' },
        h('span', { class: `online-dot ${m.online ? 'on' : ''}`, title: m.online ? 'Playing now' : 'Offline' }),
        h('b', {}, m.name), m.owner ? h('span', { class: 'label-sm' }, 'owner') : null, m.you ? h('span', { class: 'label-sm' }, 'you') : null,
        h('div', { class: 'spacer' }),
        r.youOwn && !m.you ? act('Kick', '', () => room.kick(m.uid), `Remove ${m.name} from this world? They can rejoin with the code unless the world is locked.`) : null,
        r.youOwn && !m.you ? act('Ban', 'danger', () => room.ban(m.uid), `Ban ${m.name}? They are removed now and can never rejoin (until you unban them).`) : null,
      ));
      const bans = r.bans.map((b) => h('div', { class: 'row' }, h('span', {}, b.name), h('div', { class: 'spacer' }), act('Unban', '', () => room.unban(b.uid))));
      body.replaceChildren(
        h('div', { class: 'row' }, h('span', {}, 'World code'), h('b', { class: 'online-code' }, r.code),
          h('button', { class: 'btn small', onclick: () => void navigator.clipboard?.writeText(r.code).then(() => (status.textContent = 'Code copied.'), () => undefined) }, 'Copy')),
        r.youOwn
          ? h('label', { class: 'row', style: 'cursor:pointer' }, (() => {
              const cb = h('input', { type: 'checkbox' });
              cb.checked = r.locked;
              cb.addEventListener('change', () => void room.setLocked(cb.checked).catch((e: Error) => (status.textContent = e.message)));
              return cb;
            })(), h('span', {}, 'Locked — no new players can join (members can still come back)'))
          : h('div', { class: 'hint' }, r.locked ? 'This world is locked by its owner: no new players can join.' : 'Anyone with the code can join.'),
        h('h3', {}, `Members (${r.members.length})`),
        ...members,
        ...(r.youOwn ? [h('h3', {}, `Banned (${r.bans.length})`), ...(bans.length ? bans : [h('div', { class: 'hint' }, 'Nobody is banned.')])] : []),
        status,
      );
    };
    room.onRoster = (r) => this.isOpen && render(r);
    render(room.roster());
    this.el.replaceChildren(h('div', { class: 'panel col menu-panel' }, h('h2', {}, 'Online World'), body, h('button', { class: 'btn', onclick: () => { room.onRoster = null; this.showMain(); } }, 'Back')));
    this.focusFirst();
  }

  private showSettings(): void {
    const panel = buildSettingsPanel(this.s.host, () => this.showMain());
    this.el.replaceChildren(panel);
    this.focusFirst();
  }

  private showControls(): void {
    this.el.replaceChildren(h('div', { class: 'panel col menu-panel' }, h('h2', {}, 'Controls'), controlsHelp(this.s.host.input), h('button', { class: 'btn', onclick: () => this.showMain() }, 'Back')));
    this.focusFirst();
  }

  dispose(): void {
    this.el.remove();
    if (this.isOpen) this.s.paused = false;
  }
}
