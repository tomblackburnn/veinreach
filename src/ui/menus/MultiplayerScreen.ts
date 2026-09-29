import { h } from '../../utils/dom';
import type { MenuHost } from './MenuHost';
import type { CharacterSave } from '../../save/types';

export function multiplayerScreen(host: MenuHost, c: CharacterSave): HTMLElement {
  const url = h('input', { type: 'text', value: host.settings.multiplayerUrl, style: 'width:320px' });
  url.addEventListener('focus', () => (host.input.typing = true));
  url.addEventListener('blur', () => (host.input.typing = false));
  return h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' },
    h('h2', {}, 'Multiplayer (Experimental)'),
    h('div', { class: 'dialog-text' }, `Joining as ${c.name}.`),
    h('div', { class: 'hint' }, 'Host a server from the project folder with "npm run server" (default ws://localhost:7777), then connect here. Up to 8 players share the world terrain, block edits, chests, time of day, world progression and chat. Creatures and bosses are currently simulated per-player — see docs/PROGRESS.md.'),
    h('div', { class: 'form-grid' }, h('span', {}, 'Server address'), url),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => host.showCharacters('multiplayer') }, 'Back'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn good', onclick: () => { host.settings.multiplayerUrl = url.value.trim(); host.saveSettings(); host.joinServer(c, url.value.trim()); } }, 'Connect'),
    ),
  ));
}
