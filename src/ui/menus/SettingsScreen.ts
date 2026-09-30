import { h } from '../../utils/dom';
import type { GameHost } from '../../core/GameHost';
import { ACTION_LABELS, DEFAULT_BINDINGS, type Action } from '../../engine/InputManager';
import { keyName } from './controlsHelp';

/** Settings panel shared by the main menu and the pause menu. */
export function buildSettingsPanel(host: GameHost, onBack: () => void): HTMLElement {
  const s = host.settings;
  const commit = () => {
    host.applySettings();
    host.saveSettings();
  };
  const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'ambienceVolume' | 'uiScale' | 'zoom' | 'particles', min: number, max: number, step: number, fmt: (v: number) => string) => {
    const val = h('span', { class: 'muted', style: 'min-width:48px;display:inline-block' }, fmt(s[key]));
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]), 'aria-label': label });
    input.addEventListener('input', () => {
      s[key] = parseFloat(input.value);
      val.textContent = fmt(s[key]);
      commit();
    });
    return [h('span', {}, label), h('span', { class: 'row' }, input, val)];
  };
  const toggle = (label: string, key: 'screenShake' | 'showFps' | 'smoothLighting' | 'developerMode' | 'autosave', hint?: string) => {
    const input = h('input', { type: 'checkbox', 'aria-label': label });
    input.checked = s[key];
    input.addEventListener('change', () => {
      s[key] = input.checked;
      commit();
    });
    return [h('span', {}, label, hint ? h('span', { class: 'hint' }, ` — ${hint}`) : null), input];
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const binds = h('div', { class: 'settings-grid' });
  const renderBinds = () => {
    binds.replaceChildren(
      ...(Object.keys(ACTION_LABELS) as Action[]).flatMap((a) => {
        const b = h('button', { class: 'btn small keybind' }, s.bindings[a].map(keyName).join(' / '));
        b.addEventListener('click', () => {
          b.classList.add('listening');
          b.textContent = 'Press a key...';
          const onKey = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            window.removeEventListener('keydown', onKey, true);
            if (e.code !== 'Escape') {
              s.bindings[a] = [e.code];
              host.input.bindings = structuredClone(s.bindings);
              commit();
            }
            renderBinds();
          };
          window.addEventListener('keydown', onKey, true);
        });
        return [h('span', {}, ACTION_LABELS[a]), b];
      }),
    );
  };
  renderBinds();
  const fullscreenBtn = h('button', {
    class: 'btn small',
    onclick: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    },
  }, 'Toggle Fullscreen');
  return h(
    'div',
    { class: 'panel col menu-panel' },
    h('h2', {}, 'Settings'),
    h('h3', {}, 'Audio'),
    h('div', { class: 'settings-grid' }, ...slider('Master volume', 'masterVolume', 0, 1, 0.05, pct), ...slider('Music', 'musicVolume', 0, 1, 0.05, pct), ...slider('Effects', 'sfxVolume', 0, 1, 0.05, pct), ...slider('Ambience', 'ambienceVolume', 0, 1, 0.05, pct)),
    h('h3', {}, 'Display'),
    h('div', { class: 'settings-grid' },
      ...slider('UI scale', 'uiScale', 0.7, 1.6, 0.05, pct),
      ...slider('Game zoom', 'zoom', 1, 4, 0.25, (v) => `${v}×`),
      ...slider('Particles', 'particles', 0, 1, 0.1, pct),
      ...toggle('Screen shake', 'screenShake'),
      ...toggle('Smooth lighting', 'smoothLighting'),
      ...toggle('Show FPS', 'showFps'),
      h('span', {}, 'Fullscreen'), fullscreenBtn,
    ),
    h('h3', {}, 'Gameplay'),
    h('div', { class: 'settings-grid' }, ...toggle('Autosave', 'autosave', 'every 45 seconds'), ...toggle('Developer mode', 'developerMode', 'debug overlay + ` console')),
    h('h3', {}, 'Key bindings'),
    binds,
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => { s.bindings = structuredClone(DEFAULT_BINDINGS); host.input.bindings = structuredClone(s.bindings); commit(); renderBinds(); } }, 'Reset keys'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: onBack }, 'Back'),
    ),
  );
}
