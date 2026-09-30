import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

describe('site', () => {
  it('loads nothing from Google Fonts; fonts are self-hosted', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(html).toContain('/fonts/fonts.css');
    const css = read('public/fonts/fonts.css');
    for (const [, file] of css.matchAll(/url\('\/fonts\/([^']+)'\)/g)) expect(existsSync(`public/fonts/${file}`), file).toBe(true);
    expect(css).toMatch(/font-family:\s*'Silkscreen'/);
    expect(css).toMatch(/font-family:\s*'VT323'/);
    expect(existsSync('public/licenses/OFL-Silkscreen.txt') && existsSync('public/licenses/OFL-VT323.txt')).toBe(true);
  });

  const PAGES = ['privacy', 'terms', 'about'];
  it.each(PAGES)('%s page names the operator and contact', (p) => {
    const html = read(`public/${p}.html`);
    expect(html).toContain('Tom Blackburn');
    expect(html).toContain('asteroidthedino@gmail.com');
    expect(html).toContain('/fonts/fonts.css');
    expect(html).toMatch(/<html lang="en">/);
    for (const q of PAGES) if (q !== p) expect(html).toContain(`/${q}.html`);
  });
  it('privacy policy covers the essentials', () => {
    const html = read('public/privacy.html');
    for (const s of ['United Kingdom', 'ICO', '24 hours', '13', 'Belgium', 'Delete account', 'one month', 'IndexedDB', 'not use cookies for tracking']) expect(html, s).toContain(s);
  });
  it('privacy policy matches what the game actually does', () => {
    const html = read('public/privacy.html');
    expect(html).toContain('the next time anyone opens that world'); // chat is pruned by the players' games, not a server
    expect(html).toContain('characters, worlds and settings, in IndexedDB'); // settings live in IndexedDB, not localStorage
    expect(html).toContain('stays in step with the online world'); // linked single-player copies sync
    expect(html).toContain('and when it happened'); // bans record a time
    expect(html).toContain('from a different browser'); // joins before the joined list existed
  });
  it('terms set the age, conduct rules and law', () => {
    const html = read('public/terms.html');
    for (const s of ['13', 'parent', 'England and Wales', 'death or personal injury']) expect(html, s).toContain(s);
  });
  it('hosting serves clean URLs', () => {
    expect(JSON.parse(read('firebase.json')).hosting.cleanUrls).toBe(true);
  });
  it('the title screen links the pages in new tabs', () => {
    const src = read('src/ui/menus/TitleScreen.ts');
    for (const p of PAGES) expect(src).toContain(`/${p}.html`);
    expect(src).toContain("target: '_blank'");
  });
});
