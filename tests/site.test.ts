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
});
