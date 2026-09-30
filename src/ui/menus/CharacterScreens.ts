import { h, clear } from '../../utils/dom';
import type { MenuHost, CharacterNext } from './MenuHost';
import type { CharacterSave } from '../../save/types';
import { drawPlayer } from '../../rendering/sprites/playerSprite';
import { DIFFICULTIES, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, CLOTH_COLORS, randomAppearance, type Appearance, type Difficulty } from '../../entities/player/Appearance';
import { newCharacter } from '../../core/playerSave';
import { ItemRegistry } from '../../items/ItemRegistry';

function preview(app: Appearance, armorIds: (string | null)[] = [], scale = 4): HTMLCanvasElement {
  const c = h('canvas', { width: String(20 * scale + 20), height: String(52 * scale) });
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.scale(scale, scale);
  const armor = { head: armorIds[0] ? ItemRegistry.get(armorIds[0]).armor : undefined, body: armorIds[1] ? ItemRegistry.get(armorIds[1]).armor : undefined, legs: armorIds[2] ? ItemRegistry.get(armorIds[2]).armor : undefined };
  drawPlayer(g, (20 * scale + 20) / scale / 2, 50, { appearance: app, armor, anim: 'idle', t: 0, facing: 1, armAngle: null });
  return c;
}

const hours = (ticks: number) => `${(ticks / 60 / 3600).toFixed(1)}h`;

/** Continue after a character has been chosen or created. */
function proceed(host: MenuHost, c: CharacterSave, next: CharacterNext): void {
  if (next === 'worlds') host.showWorlds(c);
  else if (next === 'multiplayer') host.showMultiplayer(c);
  else void host.startWorld(c, next.world, next.isNew);
}

export function characterSelect(host: MenuHost, next: CharacterNext): HTMLElement {
  const heading = typeof next === 'object' ? `Who will play ${next.world.meta.name}?` : 'Select a Character';
  const back = () => (typeof next === 'object' ? host.showWorlds(null) : host.showTitle());
  const list = h('div', { class: 'list' });
  const screen = h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' }, h('h2', {}, heading), list, h('div', { class: 'row' },
    h('button', { class: 'btn good', onclick: () => host.showCharacterCreate(next) }, 'Create'),
    h('button', { class: 'btn small', onclick: async () => {
      const text = await host.ui.pickFile();
      if (!text) return;
      try {
        const c = await host.saves.importCharacter(text);
        await host.ui.alert('Imported', `${c.name} has been imported.`);
        host.showCharacters(next);
      } catch (e) {
        await host.ui.alert('Import failed', String((e as Error).message));
      }
    } }, 'Import'),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn', onclick: back }, 'Back'),
  )));
  void host.saves.listCharacters().then((chars) => {
    clear(list);
    if (!chars.length) list.append(h('div', { class: 'hint' }, 'No characters yet. Create one to begin your journey.'));
    for (const c of chars) {
      const item = h('div', { class: 'list-item' },
        preview(c.appearance, c.inventory.armor.map((s) => s?.id ?? null), 1.5),
        h('div', { class: 'col', style: 'gap:2px' },
          h('span', { class: 'name' }, c.name),
          h('span', { class: 'muted' }, `${DIFFICULTIES[c.difficulty].name} · ${c.baseLife} life · ${c.baseMana} mana · played ${hours(c.playTicks)}${c.permadead ? ' · FALLEN' : ''}`),
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn small good', disabled: c.permadead, onclick: (e: Event) => { e.stopPropagation(); proceed(host, c, next); } }, typeof next === 'object' ? 'Play' : 'Select'),
        h('button', { class: 'btn small', onclick: (e: Event) => { e.stopPropagation(); host.ui.download(`${c.name.replace(/\W+/g, '_')}.veinreach-character.json`, host.saves.exportCharacter(c)); } }, 'Export'),
        h('button', { class: 'btn small danger', onclick: async (e: Event) => {
          e.stopPropagation();
          if (await host.ui.confirm('Delete character', `Delete ${c.name} forever?`, true)) {
            await host.saves.deleteCharacter(c.id);
            host.showCharacters(next);
          }
        } }, 'Delete'),
      );
      item.addEventListener('dblclick', () => !c.permadead && proceed(host, c, next));
      list.append(item);
    }
  });
  return screen;
}

export function characterCreate(host: MenuHost, next: CharacterNext): HTMLElement {
  let app: Appearance = randomAppearance();
  let difficulty: Difficulty = 'wanderer';
  const nameInput = h('input', { type: 'text', value: '', placeholder: 'Name your hero', maxlength: '24', 'aria-label': 'Character name' });
  nameInput.addEventListener('focus', () => (host.input.typing = true));
  nameInput.addEventListener('blur', () => (host.input.typing = false));
  const previewBox = h('div', { class: 'preview-box' });
  const form = h('div', { class: 'form-grid' });
  const redraw = () => {
    previewBox.replaceChildren(preview(app));
    renderForm();
  };
  const swatches = (colors: string[], key: keyof Appearance, label: string) =>
    h('div', { class: 'swatches', role: 'group', 'aria-label': label }, ...colors.map((c, i) =>
      h('button', { type: 'button', class: `swatch ${app[key] === c ? 'sel' : ''}`, style: `background:${c}`, 'aria-label': `${label} ${i + 1}`, 'aria-pressed': String(app[key] === c), onclick: () => {
        (app as unknown as Record<string, unknown>)[key] = c;
        redraw();
        // Keep keyboard focus on the same swatch after the form re-renders.
        (form.querySelector(`[aria-label="${label} ${i + 1}"]`) as HTMLElement | null)?.focus();
      } })));
  const colorPick = (key: keyof Appearance, label: string) => {
    const i = h('input', { type: 'color', value: String(app[key]), style: 'width:40px;height:30px;border:none;background:none', 'aria-label': `${label} colour` });
    i.addEventListener('input', () => {
      (app as unknown as Record<string, unknown>)[key] = i.value;
      previewBox.replaceChildren(preview(app));
    });
    return i;
  };
  const renderForm = () => {
    clear(form);
    form.append(
      h('span', {}, 'Name'), nameInput,
      h('span', {}, 'Hair style'), h('div', { class: 'row' },
        h('button', { class: 'btn small', 'aria-label': 'Previous hair style', onclick: () => { app.hairStyle = (app.hairStyle + HAIR_STYLES - 1) % HAIR_STYLES; redraw(); } }, '<'),
        h('span', {}, `Style ${app.hairStyle + 1}`),
        h('button', { class: 'btn small', 'aria-label': 'Next hair style', onclick: () => { app.hairStyle = (app.hairStyle + 1) % HAIR_STYLES; redraw(); } }, '>')),
      h('span', {}, 'Hair colour'), h('div', { class: 'row' }, swatches(HAIR_COLORS, 'hairColor', 'Hair colour'), colorPick('hairColor', 'Hair')),
      h('span', {}, 'Skin'), swatches(SKIN_TONES, 'skinColor', 'Skin tone'),
      h('span', {}, 'Eyes'), h('div', { class: 'row' }, colorPick('eyeColor', 'Eye')),
      h('span', {}, 'Shirt'), h('div', { class: 'row' }, swatches(CLOTH_COLORS, 'shirtColor', 'Shirt colour'), colorPick('shirtColor', 'Shirt')),
      h('span', {}, 'Trousers'), h('div', { class: 'row' }, swatches(['#4a3a2a', '#2a3a5a', '#3a3a3a', '#5a4a3a', '#6a2a2a', '#2a4a2a'], 'pantsColor', 'Trouser colour'), colorPick('pantsColor', 'Trouser')),
      h('span', {}, 'Shoes'), swatches(['#3a2a1a', '#2a2a2a', '#5a3a1a', '#6a6a6a'], 'shoeColor', 'Shoe colour'),
      h('span', {}, 'Difficulty'), h('div', { class: 'col', style: 'gap:4px' }, ...(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => h('label', { class: 'row', style: 'gap:6px;cursor:pointer' },
        (() => { const r = h('input', { type: 'radio', name: 'diff' }); r.checked = d === difficulty; r.addEventListener('change', () => (difficulty = d)); return r; })(),
        h('b', {}, DIFFICULTIES[d].name), h('span', { class: 'hint' }, DIFFICULTIES[d].description)))),
    );
  };
  redraw();
  const create = async () => {
    const name = nameInput.value.trim();
    if (!name) {
      await host.ui.alert('Name required', 'Please give your character a name.');
      return;
    }
    const c: CharacterSave = newCharacter(name, app, difficulty);
    await host.saves.saveCharacter(c);
    proceed(host, c, next);
  };
  return h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel' },
    h('h2', {}, 'Create a Character'),
    h('div', { class: 'row', style: 'align-items:flex-start;gap:20px' }, h('div', { class: 'col' }, previewBox, h('button', { class: 'btn small', onclick: () => { app = randomAppearance(); redraw(); } }, 'Randomise')), form),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => host.showCharacters(next) }, 'Back'), h('div', { class: 'spacer' }), h('button', { class: 'btn good', onclick: create }, 'Create')),
  ));
}
