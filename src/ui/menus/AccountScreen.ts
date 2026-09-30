import { h } from '../../utils/dom';
import type { MenuHost } from './MenuHost';
import type { CharacterSave } from '../../save/types';
import type { AccountState } from '../../multiplayer/firebase/account';
import * as account from '../../multiplayer/firebase/account';
import { multiplayerScreen } from './MultiplayerScreen';

/**
 * Sign-in for online play (single-player never needs an account): Google
 * sign-in, then a unique username. Email/password is switched off for now
 * because this project can't point verification emails at our own page
 * (see docs/DEPLOYMENT.md, "Account email links").
 */
export function accountScreen(host: MenuHost, c: CharacterSave, st: AccountState): HTMLElement {
  const typing = <T extends HTMLInputElement>(el: T): T => {
    el.addEventListener('focus', () => (host.input.typing = true));
    el.addEventListener('blur', () => (host.input.typing = false));
    return el;
  };
  const msg = h('div', { class: 'hint account-msg' });
  const say = (text: string, ok = false) => {
    msg.textContent = text;
    msg.classList.toggle('ok', ok);
  };
  /** Run an action with the buttons disabled; on success re-open Multiplayer (which re-checks the account). */
  const run = (fn: () => Promise<unknown>, after: 'reload' | 'stay' = 'reload') => async (e: Event) => {
    const panel = (e.target as HTMLElement).closest('.panel');
    panel?.querySelectorAll('button').forEach((b) => (b.disabled = true));
    say('Please wait…', true);
    try {
      await fn();
      if (after === 'reload') host.showMultiplayer(c);
      else panel?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    } catch (err) {
      say((err as Error).message);
      panel?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  };
  const back = h('button', { class: 'btn', onclick: () => host.showCharacters('multiplayer') }, 'Back');
  const selfHosted = h('button', { class: 'btn small', title: 'Connect to a server you run yourself (no account needed)', onclick: () => host.ui.show(multiplayerScreen(host, c, null, 'You aren’t signed in, so only self-hosted servers are available.')) }, 'Self-hosted server…');
  const panel = (title: string, ...body: (HTMLElement | null)[]) =>
    h('div', { class: 'screen' }, h('div', { class: 'panel col menu-panel account-panel' }, h('h2', {}, title), ...body, msg));

  if (!st.signedIn) {
    return panel('Sign in to play online',
      h('div', { class: 'dialog-text' }, 'Online worlds need an account, so world owners can see who is playing and remove or ban people. Single-player never needs one.'),
      h('button', { class: 'btn gold google-btn', onclick: run(() => account.signInWithGoogle()) }, 'Continue with Google'),
      h('div', { class: 'hint' }, 'We only use your Google account to know it’s you. Other players see the username you choose next, never your name or email.'),
      h('div', { class: 'row' }, back, h('div', { class: 'spacer' }), selfHosted),
    );
  }

  if (!st.verified) {
    // Email sign-up is switched off (Google only); older unverified email accounts can't play online.
    return panel('Please use Google',
      h('div', { class: 'dialog-text' }, `Online play now uses Google sign-in only, and ${st.email ?? 'this email account'} was never verified. Sign out, then continue with Google.`),
      h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: run(() => account.signOut()) }, 'Sign out'), h('div', { class: 'spacer' }), back),
    );
  }

  const name = typing(h('input', { type: 'text', maxlength: '16', placeholder: 'e.g. DeepDelver', style: 'width:260px' }));
  const save = run(async () => {
    const err = await account.claimUsername(name.value.trim());
    if (err) throw new Error(err);
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && void save(e));
  return panel('Choose your username',
    h('div', { class: 'dialog-text' }, 'This is the name other players see in chat and above your character online. It must be unique and can’t be changed later.'),
    h('div', { class: 'row' }, name, h('button', { class: 'btn good', onclick: save }, 'Save')),
    h('div', { class: 'hint' }, '3–16 letters, numbers or underscores.'),
    h('div', { class: 'row' }, back, h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: run(() => account.signOut()) }, 'Sign out')),
  );
}
