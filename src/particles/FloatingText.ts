interface FText {
  text: string;
  x: number;
  y: number;
  vy: number;
  vx: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

/** Damage numbers, heal numbers and pickup notices in world space. */
export class FloatingText {
  private items: FText[] = [];

  add(text: string, x: number, y: number, color = '#ffffff', size = 10, life = 50): void {
    if (this.items.length > 200) this.items.shift();
    this.items.push({ text, x, y, vy: -1.6, vx: (Math.random() - 0.5) * 0.8, life, max: life, color, size });
  }

  damage(amount: number, x: number, y: number, crit: boolean, toPlayer = false): void {
    this.add(String(amount), x, y, toPlayer ? '#ff4a4a' : crit ? '#ffb030' : '#ffffff', crit ? 13 : 10, crit ? 60 : 45);
  }

  update(): void {
    for (const t of this.items) {
      t.life--;
      t.y += t.vy;
      t.x += t.vx;
      t.vy *= 0.94;
    }
    this.items = this.items.filter((t) => t.life > 0);
  }

  render(g: CanvasRenderingContext2D): void {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of this.items) {
      const a = Math.min(1, t.life / (t.max * 0.4));
      g.globalAlpha = a;
      const pop = t.life > t.max - 6 ? 1 + (t.life - (t.max - 6)) * 0.08 : 1;
      g.font = `bold ${Math.round(t.size * pop)}px "Pixel", monospace`;
      g.fillStyle = '#000000';
      g.fillText(t.text, t.x + 1, t.y + 1);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
  }
}
