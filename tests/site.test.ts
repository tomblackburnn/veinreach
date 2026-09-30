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
