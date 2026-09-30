// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { isUiControl, InputManager } from '../src/engine/InputManager';
import { UIManager } from '../src/ui/UIManager';
import type { AudioManager } from '../src/audio/AudioManager';

describe('keyboard access', () => {
  it('treats buttons (and their contents) as UI controls, not the game canvas', () => {
    const b = document.createElement('button');
    const inner = document.createElement('span');
    b.append(inner);
    expect(isUiControl(b)).toBe(true);
    expect(isUiControl(inner)).toBe(true);
    expect(isUiControl(document.createElement('canvas'))).toBe(false);
    expect(isUiControl(document.body)).toBe(false);
    expect(isUiControl(null)).toBe(false);
  });

  it('a mouse-clicked button lets go of focus (so Space jumps instead of pressing it again); keyboard clicks keep it', () => {
    const input = new InputManager(document.createElement('canvas'));
    const b = document.createElement('button');
    document.body.append(b);
    b.focus();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(document.activeElement).not.toBe(b);
    b.focus();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(document.activeElement).toBe(b);
    // Keys pressed on a focused button are left to the button, except Escape.
    b.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    expect(input.codePressed('Space')).toBe(false);
    input.dispose();
    b.remove();
  });

  it('dialogs are labelled, take focus, and Escape cancels a confirm', async () => {
    const root = document.createElement('div');
    root.id = 'ui-test-root';
    document.body.append(root);
    const ui = new UIManager('ui-test-root', { play() {} } as unknown as AudioManager);
    const p = ui.confirm('Delete world', 'Sure?', true);
    const dlg = root.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg).toBeTruthy();
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dlg.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete world');
    expect(document.activeElement?.textContent).toBe('Cancel');
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await p).toBe(false);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });
});

import { readFileSync } from 'node:fs';

describe('labels', () => {
  it('the game view and page are described', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<canvas id="game-canvas" role="img" aria-label="[^"]+"/);
    expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
  });
});
