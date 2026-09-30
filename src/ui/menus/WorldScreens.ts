import { h, clear, uid } from '../../utils/dom';
import type { MenuHost } from './MenuHost';
import type { CharacterSave, WorldRecord } from '../../save/types';
import { WORLD_SIZES, type WorldSizeKey, SAVE_VERSION, GEN_VERSION } from '../../core/config';
import { defaultWorldState } from '../../world/WorldState';
import { randomSeedString } from '../../utils/random';

const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

export function worldSelect(host: MenuHost, c: CharacterSave | null): HTMLElement {
  // Without a character (opened from the main menu) Play asks who will play.
  const play = (w: WorldRecord) => (c ? void host.startWorld(c, w, false) : host.showCharacters({ world: w, isNew: false }));
  const list = h('div', { class: 'list' });
  const screen = h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' },
    h('h2', {}, c ? `Select a World — ${c.name}` : 'Worlds'),
    list,
    h('div', { class: 'row' },
      h('button', { class: 'btn good', onclick: () => host.showWorldCreate(c) }, 'Create'),
      h('button', { class: 'btn small', onclick: async () => {
        const text = await host.ui.pickFile();
        if (!text) return;
        try {
          const r = await host.saves.importWorld(text);
          await host.ui.alert('Imported', `${r.meta.name} has been imported.`);
          host.showWorlds(c);
        } catch (e) {
          await host.ui.alert('Import failed', String((e as Error).message));
        }
      } }, 'Import'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => (c ? host.showCharacters('worlds') : host.showTitle()) }, 'Back'),
    ),
  ));
  void host.saves.listWorlds().then((worlds) => {
    clear(list);
    if (!worlds.length) list.append(h('div', { class: 'hint' }, 'No worlds yet. Create one!'));
    for (const w of worlds) {
      const item = h('div', { class: 'list-item' },
        h('div', { class: 'col', style: 'gap:2px' },
          h('span', { class: 'name' }, w.meta.name),
          h('span', { class: 'muted' }, `${WORLD_SIZES[w.meta.size].label} · seed ${w.meta.seed} · day ${w.state.day} · ${w.meta.bossesDefeated}/5 bosses${w.meta.unsealed ? ' · Unsealed' : ''} · ${ago(w.meta.lastPlayed)}`),
          w.meta.onlineCode ? h('span', { class: 'online-badge', title: 'Your single-player copy of an online world: friends’ changes sync in when you play it, and your changes upload next time you play it online.' }, `Online · ${w.meta.onlineCode}`) : null,
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn small good', onclick: (e: Event) => { e.stopPropagation(); play(w); } }, 'Play'),
        h('button', { class: 'btn small', onclick: async (e: Event) => { e.stopPropagation(); host.ui.download(`${w.meta.name.replace(/\W+/g, '_')}.veinreach-world.json`, await host.saves.exportWorld(w.id)); } }, 'Export'),
        h('button', { class: 'btn small danger', onclick: async (e: Event) => {
          e.stopPropagation();
          if (await host.ui.confirm('Delete world', `Delete ${w.meta.name} forever?`, true)) {
            await host.saves.deleteWorld(w.id);
            host.showWorlds(c);
          }
        } }, 'Delete'),
      );
      item.addEventListener('dblclick', () => play(w));
      list.append(item);
    }
  });
  return screen;
}

const WORLD_NAMES = ['Emberfall', 'Hollowmere', 'Cindervale', 'Glimmerreach', 'Thornwood', 'Rustmoor', 'Duskhaven', 'Stonewhisper', 'Aetherdeep', 'Mossgrave'];

export function worldCreate(host: MenuHost, c: CharacterSave | null): HTMLElement {
  const name = h('input', { type: 'text', value: WORLD_NAMES[Math.floor(Math.random() * WORLD_NAMES.length)], maxlength: '32', 'aria-label': 'World name' });
  const seed = h('input', { type: 'text', value: randomSeedString(), maxlength: '40', 'aria-label': 'World seed' });
  for (const i of [name, seed]) {
    i.addEventListener('focus', () => (host.input.typing = true));
    i.addEventListener('blur', () => (host.input.typing = false));
  }
  let size: WorldSizeKey = 'medium';
  const sizeRow = h('div', { class: 'row' });
  const renderSizes = () => {
    sizeRow.replaceChildren(...(Object.keys(WORLD_SIZES) as WorldSizeKey[]).map((k) => h('button', { class: `btn small ${k === size ? 'gold' : ''}`, onclick: () => { size = k; renderSizes(); } }, `${WORLD_SIZES[k].label} (${WORLD_SIZES[k].width}×${WORLD_SIZES[k].height})`)));
  };
  renderSizes();
  const create = async () => {
    const id = uid();
    const dims = WORLD_SIZES[size];
    const rec: WorldRecord = {
      id,
      meta: { id, name: name.value.trim() || 'Unnamed World', seed: seed.value.trim() || randomSeedString(), size, width: dims.width, height: dims.height, createdAt: Date.now(), lastPlayed: Date.now(), version: SAVE_VERSION, genVersion: GEN_VERSION, bossesDefeated: 0, unsealed: false },
      state: defaultWorldState(),
    };
    if (c) void host.startWorld(c, rec, true);
    else host.showCharacters({ world: rec, isNew: true });
  };
  return h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' },
    h('h2', {}, 'Create a World'),
    h('div', { class: 'form-grid' },
      h('span', {}, 'World name'), name,
      h('span', {}, 'Seed'), h('div', { class: 'row' }, seed, h('button', { class: 'btn small', onclick: () => (seed.value = randomSeedString()) }, 'Random')),
      h('span', {}, 'Size'), sizeRow,
    ),
    h('div', { class: 'hint' }, 'The same seed and size always produce the same world.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => host.showWorlds(c) }, 'Back'), h('div', { class: 'spacer' }), h('button', { class: 'btn good', onclick: create }, c ? 'Create & Play' : 'Create & Choose Character')),
  ));
}

export function loadingScreen(): { el: HTMLElement; set(stage: string, p: number): void } {
  const stage = h('div', { class: 'dialog-text' }, 'Preparing...');
  const fill = h('div', {});
  fill.style.width = '0%';
  const tips = [
    'Tip: Stand near crafting stations to unlock more recipes.',
    'Tip: NPCs need a room with walls, a door, a light, a table and a chair.',
    'Tip: Right-click a bed to set your spawn point.',
    'Tip: Vital Crystals deep underground increase your maximum health.',
    'Tip: Hold Down to drop through platforms.',
    'Tip: Shift-click moves whole stacks; Ctrl-click trashes them.',
    'Tip: Bosses leave if you stray too far — or die.',
  ];
  const el = h('div', { class: 'screen' }, h('div', { class: 'panel col', style: 'align-items:center;min-width:560px' }, h('h2', {}, 'Building the world'), stage, h('div', { class: 'progress' }, fill), h('div', { class: 'hint' }, tips[Math.floor(Math.random() * tips.length)])));
  return {
    el,
    set(s: string, p: number) {
      stage.textContent = s;
      fill.style.width = `${Math.round(p * 100)}%`;
    },
  };
}
