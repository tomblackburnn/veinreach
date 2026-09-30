// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { accountScreen } from '../src/ui/menus/AccountScreen';
import type { MenuHost } from '../src/ui/menus/MenuHost';
import type { CharacterSave } from '../src/save/types';

const host = { input: { typing: false }, showMultiplayer() {}, showCharacters() {}, ui: { show() {} } } as unknown as MenuHost;
const c = { name: 'Tester' } as unknown as CharacterSave;
const signedOut = { signedIn: false, email: null, verified: false, username: null, provider: null } as const;

describe('online sign-in screen', () => {
  it('Google sign-in stays disabled until the player confirms age and agrees to the terms', () => {
    const el = accountScreen(host, c, { ...signedOut });
    const google = [...el.querySelectorAll('button')].find((b) => /Google/.test(b.textContent ?? ''))!;
    const box = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(google.disabled).toBe(true);
    expect(box.checked).toBe(false);
    expect(box.closest('label')?.textContent).toMatch(/13 or older/);
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['/terms.html', '/privacy.html']));
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(google.disabled).toBe(false);
  });

  it('the username screen links the terms and privacy policy', () => {
    const el = accountScreen(host, c, { signedIn: true, email: 'a@b.c', verified: true, username: null, provider: 'google' });
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['/terms.html', '/privacy.html']));
  });
});
