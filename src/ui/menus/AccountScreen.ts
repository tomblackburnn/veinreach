import { h } from '../../utils/dom';
import type { MenuHost } from './MenuHost';
import type { CharacterSave } from '../../save/types';
import type { AccountState } from '../../multiplayer/firebase/account';
import * as account from '../../multiplayer/firebase/account';
import { multiplayerScreen } from './MultiplayerScreen';

/**
 * Sign-in for online play (single-player never needs an account):
 * Google or email + password, a verified email, then a unique username.
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
    const email = typing(h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', style: 'width:100%' }));
    const pass = typing(h('input', { type: 'password', placeholder: 'Password (8+ characters)', autocomplete: 'current-password', style: 'width:100%' }));
    pass.addEventListener('keydown', (e) => e.key === 'Enter' && (e.target as HTMLElement).closest('.panel')?.querySelector<HTMLButtonElement>('.sign-in')?.click());
    return panel('Sign in to play online',
      h('div', { class: 'dialog-text' }, 'Online worlds need an account, so world owners can see who is playing and remove or ban people. Single-player never needs one.'),
      h('button', { class: 'btn gold google-btn', onclick: run(() => account.signInWithGoogle()) }, 'Continue with Google'),
      h('div', { class: 'account-or' }, 'or use your email'),
      email,
      pass,
      h('div', { class: 'row' },
        h('button', { class: 'btn good sign-in', onclick: run(() => account.signInWithEmail(email.value, pass.value)) }, 'Sign in'),
        h('button', { class: 'btn', onclick: run(() => account.createEmailAccount(email.value, pass.value)) }, 'Create account'),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn small', onclick: run(async () => {
          if (!email.value.trim()) throw new Error('Type your email above first.');
          await account.resetPassword(email.value);
          say('If that email has an account, a password reset link is on its way.', true);
        }, 'stay') }, 'Forgot password?'),
      ),
      h('div', { class: 'row' }, back, h('div', { class: 'spacer' }), selfHosted),
    );
  }

  if (!st.verified) {
    return panel('Verify your email',
      h('div', { class: 'dialog-text' }, `We sent a link to ${st.email ?? 'your email'}. Click it, then press Continue. (Check your spam folder if it isn’t there.)`),
      h('div', { class: 'row' },
        h('button', { class: 'btn good', onclick: run(async () => {
          if (!(await account.refreshVerification())) throw new Error('Not verified yet — click the link in the email first.');
        }) }, 'Continue'),
        h('button', { class: 'btn', onclick: run(async () => {
          await account.resendVerification();
          say('Sent another link.', true);
        }, 'stay') }, 'Resend email'),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn small', onclick: run(() => account.signOut()) }, 'Use a different account'),
      ),
      h('div', { class: 'row' }, back),
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
