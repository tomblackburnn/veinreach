import { h, clear } from '../utils/dom';
import type { AudioManager } from '../audio/AudioManager';

/**
 * Owns the DOM overlay: the current menu screen, modal dialogs, and helpers for
 * file import/export. Gameplay HUD layers are appended by the GameSession.
 */
export class UIManager {
  readonly root: HTMLElement;
  private screenEl: HTMLElement | null = null;

  constructor(
    rootId: string,
    private audio: AudioManager,
  ) {
    const r = document.getElementById(rootId);
    if (!r) throw new Error(`#${rootId} missing`);
    this.root = r;
    // Menu click / hover sounds for every button.
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.btn')) this.audio.play('menuClick');
    });
    this.root.addEventListener('mouseover', (e) => {
      const b = (e.target as HTMLElement).closest('.btn');
      if (b && !(b as HTMLButtonElement).disabled && e.relatedTarget && !(b as HTMLElement).contains(e.relatedTarget as Node)) this.audio.play('menuHover');
    });
  }

  /** Scale every menu/HUD element (CSS zoom on the UI layer). */
  setScale(s: number): void {
    this.scale = s;
    document.documentElement.style.setProperty('--ui-scale', String(s));
    this.root.style.setProperty('zoom', String(s));
  }

  scale = 1;

  show(el: HTMLElement): void {
    this.hideScreen();
    this.screenEl = el;
    this.root.appendChild(el);
  }

  hideScreen(): void {
    this.screenEl?.remove();
    this.screenEl = null;
  }

  clearAll(): void {
    clear(this.root);
    this.screenEl = null;
  }

  /** Simple modal with buttons; resolves with the index of the button chosen. */
  modal(title: string, body: string | HTMLElement, buttons: { label: string; kind?: string }[]): Promise<number> {
    return new Promise((resolve) => {
      const back = h('div', { class: 'modal-back' });
      const btns = buttons.map((b, i) =>
        h('button', { class: `btn ${b.kind ?? ''}`, onclick: () => { back.remove(); resolve(i); } }, b.label),
      );
      const panel = h('div', { class: 'panel col', style: 'max-width:520px' }, h('h2', {}, title), typeof body === 'string' ? h('div', { class: 'dialog-text' }, body) : body, h('div', { class: 'row', style: 'justify-content:flex-end' }, ...btns));
      back.appendChild(panel);
      this.root.appendChild(back);
    });
  }

  alert(title: string, text: string): Promise<number> {
    return this.modal(title, text, [{ label: 'OK' }]);
  }

  confirm(title: string, text: string, danger = false): Promise<boolean> {
    return this.modal(title, text, [{ label: 'Cancel' }, { label: 'Confirm', kind: danger ? 'danger' : 'good' }]).then((i) => i === 1);
  }

  download(filename: string, text: string): void {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  pickFile(accept = '.json'): Promise<string | null> {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept });
      input.style.display = 'none';
      input.addEventListener('change', async () => {
        const f = input.files?.[0];
        input.remove();
        if (!f) return resolve(null);
        if (f.size > 50 * 1024 * 1024) return resolve(null);
        resolve(await f.text());
      });
      document.body.appendChild(input);
      input.click();
    });
  }
}
