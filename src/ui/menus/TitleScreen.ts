import { h } from '../../utils/dom';
import type { MenuHost } from './MenuHost';
import { GAME_TITLE, GAME_VERSION } from '../../core/config';

export function titleScreen(host: MenuHost): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('h1', { class: 'title-logo' }, GAME_TITLE.toUpperCase()),
    h('div', { class: 'title-sub' }, 'Dig deep. Reach further.'),
    h('div', { class: 'menu-buttons', style: 'margin-top:24px' },
      h('button', { class: 'btn', onclick: () => host.showCharacters('worlds') }, 'Play'),
      h('button', { class: 'btn', onclick: () => host.showCharacters('worlds') }, 'Characters'),
      h('button', { class: 'btn', onclick: () => host.showWorlds(null) }, 'Worlds'),
      h('button', { class: 'btn', onclick: () => host.showCharacters('multiplayer') }, 'Multiplayer'),
      h('button', { class: 'btn', onclick: () => host.showSettings() }, 'Settings'),
      h('button', { class: 'btn', onclick: () => host.showCredits() }, 'Credits'),
    ),
    h('div', { class: 'footer' }, h('span', {}, `v${GAME_VERSION}`), h('span', {}, host.saves.persistent ? 'Saves stored in this browser (IndexedDB)' : 'Browser storage unavailable — saves will not persist')),
  );
}

export function creditsScreen(host: MenuHost): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'panel col credits menu-panel' },
      h('h2', {}, 'Credits'),
      h('div', { class: 'dialog-text' }, 'Veinreach is an original sandbox adventure made with TypeScript, HTML5 Canvas and the Web Audio API.'),
      h('div', { class: 'dialog-text' }, 'All sprites, textures, music and sound effects are generated procedurally at runtime — there are no external art or audio assets.'),
      h('div', { class: 'dialog-text' }, 'Design & code: the Veinreach team. Inspired by the sandbox-survival genre.'),
      h('div', { class: 'hint' }, 'Fonts: Silkscreen and VT323 (SIL Open Font License), served by Google Fonts when online.'),
      h('button', { class: 'btn', onclick: () => host.showTitle() }, 'Back'),
    ),
  );
}
