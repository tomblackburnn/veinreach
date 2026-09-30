import { applyActionCode, checkActionCode, verifyPasswordResetCode, confirmPasswordReset, ActionCodeOperation } from 'firebase/auth';
import { getFirebaseCore, friendlyError } from '../multiplayer/firebase/client';
import { h } from '../utils/dom';

/** URL path of this page; set as the "action URL" of the Firebase Auth email templates. */
export const AUTH_ACTION_PATH = '/auth/action';

/**
 * Read the action parameters, tolerating links that email apps have mangled:
 * `&amp;` instead of `&`, double encoding, parameters moved into the hash.
 */
export function readActionParams(href: string): { mode: string | null; oobCode: string | null } {
  let raw = href.slice(href.indexOf('?') + 1).replace(/#/g, '&');
  for (let i = 0; i < 2 && /%26|%3D/i.test(raw); i++) raw = decodeURIComponent(raw);
  raw = raw.replace(/&amp;/gi, '&');
  const params = new Map<string, string>();
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).replace(/^(amp;)+/i, '').trim();
    if (!params.has(key)) params.set(key, part.slice(eq + 1).trim());
  }
  return { mode: params.get('mode') ?? null, oobCode: params.get('oobCode') ?? null };
}

/**
 * Our own handler for the links in Firebase Auth emails (verify email, reset
 * password, undo an email change). It replaces Firebase's default page, which
 * fails with "The selected page mode is invalid" when a mail app damages the link.
 */
export async function showAuthActionPage(root: HTMLElement): Promise<void> {
  const body = h('div', { class: 'col', style: 'gap:10px' }, h('div', { class: 'dialog-text' }, 'Checking your link…'));
  root.replaceChildren(h('div', { class: 'screen auth-action' }, h('div', { class: 'panel col menu-panel account-panel' }, h('h2', {}, 'Veinreach'), body)));
  const home = () => h('a', { class: 'btn gold', href: '/' }, 'Open Veinreach');
  const done = (title: string, text: string) => body.replaceChildren(h('h3', {}, title), h('div', { class: 'dialog-text' }, text), h('div', { class: 'row' }, home()));
  const fail = (text: string) => done('That link didn’t work', text);

  const { mode, oobCode } = readActionParams(location.href);
  if (!oobCode) {
    fail('This link is incomplete — your email app may have cut it short. In the game, open Multiplayer and use “Resend email” (or “Forgot password?”) to get a new one.');
    return;
  }
  try {
    const { auth } = await getFirebaseCore();
    // If the mode was lost, Firebase can still tell us what the code is for.
    let op = mode;
    if (!op || !['verifyEmail', 'resetPassword', 'recoverEmail', 'verifyAndChangeEmail'].includes(op)) {
      const info = await checkActionCode(auth, oobCode);
      op = info.operation === ActionCodeOperation.PASSWORD_RESET ? 'resetPassword' : info.operation === ActionCodeOperation.RECOVER_EMAIL ? 'recoverEmail' : 'verifyEmail';
    }
    if (op === 'resetPassword') {
      const email = await verifyPasswordResetCode(auth, oobCode);
      const pass = h('input', { type: 'password', placeholder: 'New password (8+ characters)', autocomplete: 'new-password', style: 'width:100%;box-sizing:border-box' });
      const msg = h('div', { class: 'hint account-msg' });
      const save = h('button', { class: 'btn good' }, 'Set new password');
      save.addEventListener('click', async () => {
        if (pass.value.length < 8) {
          msg.textContent = 'Passwords need at least 8 characters.';
          return;
        }
        save.disabled = true;
        try {
          await confirmPasswordReset(auth, oobCode, pass.value);
          done('Password changed', `You can now sign in to Veinreach as ${email} with your new password.`);
        } catch (e) {
          msg.textContent = friendlyError(e);
          save.disabled = false;
        }
      });
      body.replaceChildren(h('h3', {}, 'Choose a new password'), h('div', { class: 'dialog-text' }, `For ${email}.`), pass, h('div', { class: 'row' }, save), msg);
      return;
    }
    await applyActionCode(auth, oobCode);
    if (op === 'recoverEmail') done('Email change undone', 'Your account’s email address has been restored. If you didn’t ask for the change, reset your password too.');
    else done('Email verified!', 'Go back to Veinreach on the device where you signed up and press Continue. (If you signed up on this device, just open the game.)');
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') fail('This link has expired or has already been used. If your email isn’t verified yet, open Multiplayer in the game and press “Resend email”.');
    else fail(friendlyError(e));
  }
}
