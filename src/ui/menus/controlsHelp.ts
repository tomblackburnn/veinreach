import { h } from '../../utils/dom';
import { ACTION_LABELS, type Action, type InputManager } from '../../engine/InputManager';

export function keyName(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R').replace('Backquote', '`').replace('Equal', '=').replace('Minus', '-');
}

/** Keyboard + mouse reference table. */
export function controlsHelp(input: InputManager): HTMLElement {
  const rows: [string, string][] = [
    ['Left click', 'Use item / attack / mine / place'],
    ['Right click', 'Interact (doors, chests, beds, NPCs) / place'],
    ['Mouse wheel / 1–0', 'Select hotbar slot'],
    ['Shift + click (inventory)', 'Quick-move a stack'],
    ['Ctrl + click (inventory)', 'Send stack to trash'],
    ['Right click (inventory)', 'Split stack / quick-equip armour'],
  ];
  for (const a of Object.keys(ACTION_LABELS) as Action[]) rows.push([input.bindings[a].map(keyName).join(' / '), ACTION_LABELS[a]]);
  return h('div', { class: 'settings-grid' }, ...rows.flatMap(([k, v]) => [h('span', { class: 'tag', style: 'justify-self:start' }, k), h('span', {}, v)]));
}
