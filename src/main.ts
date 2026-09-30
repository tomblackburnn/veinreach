import './ui/styles.css';
import { Game } from './core/Game';

/** Entry point. Any fatal startup error is shown on screen rather than failing silently. */
async function boot(): Promise<void> {
  // Links from account emails (verify / reset password) get their own small page, not the game.
  if (location.pathname.replace(/\/+$/, '') === '/auth/action') {
    const { showAuthActionPage } = await import('./ui/AuthActionPage');
    await showAuthActionPage(document.getElementById('ui-root')!);
    return;
  }
  try {
    const game = new Game();
    (window as unknown as { veinreach: Game }).veinreach = game;
    await game.init();
  } catch (err) {
    console.error(err);
    const root = document.getElementById('ui-root');
    if (root) root.innerHTML = `<div class="screen"><div class="panel"><h2>Veinreach failed to start</h2><div class="dialog-text">${String((err as Error)?.message ?? err)}</div></div></div>`;
  }
}

void boot();
