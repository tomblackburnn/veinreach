import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/styles.css', 'utf8');
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
const gradient = (sel: string) => css.match(new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{[^}]*linear-gradient\\((#[0-9a-fA-F]{6}),\\s*(#[0-9a-fA-F]{6})\\)`))!.slice(1, 3);
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('text contrast (WCAG AA, 4.5:1)', () => {
  const surfaces = ['bg', 'panel', 'panel-2', 'panel-3', 'slot'].map(token);
  it.each(['text', 'muted', 'gold', 'gold-2', 'good', 'bad'])('--%s is readable on every panel', (t) => {
    for (const s of surfaces) expect(ratio(token(t), s), `${t} on ${s}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['.btn', '.btn.good', '.btn.gold', '.btn.danger'])('button text is readable on %s', (sel) => {
    for (const stop of gradient(sel)) expect(ratio(token('text'), stop), `${sel} ${stop}`).toBeGreaterThanOrEqual(4.5);
  });
});
