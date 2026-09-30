import { h, clear } from '../../utils/dom';
import type { MenuHost } from './MenuHost';
import type { CharacterSave } from '../../save/types';
import { WORLD_SIZES, type WorldSizeKey } from '../../core/config';
import { recentRooms, forgetRoom } from '../../multiplayer/recentRooms';

/** The signed-in account's view of online play (null = not signed in: self-hosted only). */
export interface OnlineMenu {
  username: string;
  email: string | null;
  owned: { slot: string; code: string; name: string }[];
  maxOwned: number;
  signOut(): void;
  deleteAccount(): void;
  deleteWorld(w: { slot: string; code: string; name: string }): void;
}

const CODE_RE = /^[A-Z2-9]{6}$/;
const normalize = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');

/**
 * Multiplayer menu. Online worlds live in Firebase and are shared with a
 * six-character code; a self-hosted Node server is still available.
 */
export function multiplayerScreen(host: MenuHost, c: CharacterSave, online: OnlineMenu | null, offlineReason?: string): HTMLElement {
  const typing = (el: HTMLInputElement) => {
    el.addEventListener('focus', () => (host.input.typing = true));
    el.addEventListener('blur', () => (host.input.typing = false));
    return el;
  };

  // --- Join by code ---
  const code = typing(h('input', { type: 'text', placeholder: 'e.g. K7QM2X', maxlength: '8', 'aria-label': 'World code', style: 'width:160px;text-transform:uppercase;letter-spacing:3px' }));
  const joinErr = h('div', { class: 'hint', style: 'color:#ff9a8a' });
  const join = () => {
    const v = normalize(code.value);
    if (!CODE_RE.test(v)) {
      joinErr.textContent = 'World codes are 6 letters and numbers.';
      return;
    }
    host.joinRoom(c, v);
  };
  code.addEventListener('keydown', (e) => e.key === 'Enter' && join());

  // --- Create ---
  const name = typing(h('input', { type: 'text', value: `${c.name}'s World`, maxlength: '32', 'aria-label': 'World name', style: 'width:260px' }));
  const seed = typing(h('input', { type: 'text', placeholder: 'random', maxlength: '64', 'aria-label': 'World seed', style: 'width:260px' }));
  let size: WorldSizeKey = 'medium';
  const sizeRow = h('div', { class: 'row', style: 'flex-wrap:wrap' });
  const renderSizes = () => sizeRow.replaceChildren(...(Object.keys(WORLD_SIZES) as WorldSizeKey[]).map((k) => h('button', { class: `btn small ${k === size ? 'gold' : ''}`, onclick: () => { size = k; renderSizes(); } }, WORLD_SIZES[k].label)));
  renderSizes();

  // --- Host a saved world ---
  const worldSel = h('select', { style: 'min-width:260px' }, h('option', { value: '' }, 'Loading your worlds...'));
  void host.saves.listWorlds().then((ws) => {
    clear(worldSel);
    if (!ws.length) worldSel.append(h('option', { value: '' }, 'No saved worlds yet'));
    for (const w of ws) worldSel.append(h('option', { value: w.id }, `${w.meta.name} (${WORLD_SIZES[w.meta.size].label})`));
  });

  // --- Recent ---
  const recentBox = h('div', { class: 'col', style: 'gap:6px' });
  const renderRecent = () => {
    clear(recentBox);
    const owned = new Set(online?.owned.map((o) => o.code));
    const list = recentRooms().filter((r) => !owned.has(r.code));
    if (!list.length) recentBox.append(h('div', { class: 'hint' }, 'Worlds you join will appear here.'));
    for (const r of list) {
      recentBox.append(h('div', { class: 'row' },
        h('b', { style: 'letter-spacing:2px;min-width:90px' }, r.code),
        h('span', {}, r.name),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn small', title: 'Remove from this list (the world itself is not deleted)', onclick: () => { forgetRoom(r.code); renderRecent(); } }, 'Forget'),
        h('button', { class: 'btn small good', onclick: () => host.joinRoom(c, r.code) }, 'Join'),
      ));
    }
  };
  renderRecent();

  // --- Self-hosted ---
  const url = typing(h('input', { type: 'text', value: host.settings.multiplayerUrl, 'aria-label': 'Server address', style: 'width:300px' }));
  const advanced = h('details', { class: 'mp-advanced' },
    h('summary', {}, 'Self-hosted server (advanced)'),
    h('div', { class: 'hint' }, 'Run "npm run server" from the project folder (default ws://localhost:7777) and connect here. The server validates every edit, but you have to keep it running yourself.'),
    h('div', { class: 'row' }, url, h('button', { class: 'btn', onclick: () => { host.settings.multiplayerUrl = url.value.trim(); host.saveSettings(); host.joinServer(c, url.value.trim()); } }, 'Connect')),
  );

  const section = (title: string, ...body: (HTMLElement | string | null)[]) => h('div', { class: 'mp-section' }, h('h3', {}, title), ...body);
  const back = h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => host.showCharacters('multiplayer') }, 'Back'));
  if (!online) {
    advanced.open = true;
    return h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' },
      h('h2', {}, 'Multiplayer'),
      h('div', { class: 'dialog-text' }, offlineReason ?? 'Online play is unavailable right now.'),
      h('div', { class: 'row' }, h('button', { class: 'btn good', onclick: () => host.showMultiplayer(c) }, 'Sign in for online worlds')),
      advanced,
      back,
    ));
  }
  const full = online.owned.length >= online.maxOwned;
  const ownedBox = h('div', { class: 'col', style: 'gap:6px' },
    ...(online.owned.length ? online.owned.map((w) => h('div', { class: 'row' },
      h('b', { style: 'letter-spacing:2px;min-width:90px' }, w.code),
      h('span', {}, w.name),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn small danger', onclick: () => online.deleteWorld(w) }, 'Delete'),
      h('button', { class: 'btn small good', onclick: () => host.joinRoom(c, w.code) }, 'Play'),
    )) : [h('div', { class: 'hint' }, 'You don’t own any online worlds yet.')]),
  );
  const fullHint = full ? h('div', { class: 'hint' }, `You own ${online.maxOwned} worlds, the most allowed. Delete one to create or upload another.`) : null;
  return h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' },
    h('h2', {}, 'Multiplayer'),
    h('div', { class: 'row account-bar' },
      h('span', {}, 'Signed in as ', h('b', {}, online.username), online.email ? h('span', { class: 'muted' }, ` (${online.email})`) : null),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn small', onclick: () => online.signOut() }, 'Sign out'),
      h('button', { class: 'btn small danger', onclick: () => online.deleteAccount() }, 'Delete account'),
    ),
    h('div', { class: 'dialog-text' }, `Playing as ${c.name}. Online worlds are saved in the cloud; members can play any time, even when you're offline. Owners can kick, ban and lock their worlds (Esc → Online World).`),
    section('Join a friend', h('div', { class: 'row' }, code, h('button', { class: 'btn good', onclick: join }, 'Join')), joinErr),
    section(`Your online worlds (${online.owned.length}/${online.maxOwned})`, ownedBox),
    section('Create an online world',
      h('div', { class: 'form-grid' }, h('span', {}, 'Name'), name, h('span', {}, 'Seed'), seed, h('span', {}, 'Size'), sizeRow),
      h('div', { class: 'row' }, h('div', { class: 'spacer' }), h('button', { class: 'btn gold', disabled: full, onclick: () => host.createRoom(c, name.value.trim(), seed.value.trim(), size) }, 'Create & Play')),
      fullHint,
    ),
    section('Put one of your worlds online',
      h('div', { class: 'hint' }, 'Turns a saved world into an online world with its own code. The save stays in your single-player list, linked: changes sync both ways.'),
      h('div', { class: 'row' }, worldSel, h('div', { class: 'spacer' }), h('button', { class: 'btn gold', disabled: full, onclick: () => worldSel.value && host.hostWorld(c, worldSel.value) }, 'Host Online')),
    ),
    section('Recently joined', recentBox),
    advanced,
    h('div', { class: 'hint' }, 'Shared like Terraria: building, chests, paintings, time, boss progress, chat (Enter), and every creature and boss — hits count for everyone. Worlds you own also appear in your single-player list and stay in sync.'),
    back,
  ));
}
