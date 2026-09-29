import type { GameSession } from '../core/GameSession';
import { h } from '../utils/dom';
import { ItemRegistry } from '../items/ItemRegistry';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { WORLD_EVENTS } from '../systems/WorldEventSystem';
import type { WeatherKind } from '../world/WorldState';

/**
 * Developer console (enable Developer Mode in Settings, then press `).
 * Type `help` for commands.
 */
export class DebugConsole {
  private el: HTMLDivElement;
  private log: HTMLDivElement;
  private input: HTMLInputElement;
  private history: string[] = [];
  private hIndex = -1;
  open = false;

  constructor(private s: GameSession) {
    this.log = h('div', { class: 'log' });
    this.input = h('input', { type: 'text', placeholder: 'command (help)' });
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const cmd = this.input.value.trim();
        this.input.value = '';
        if (cmd) {
          this.history.unshift(cmd);
          this.hIndex = -1;
          this.print(`> ${cmd}`, '#a898b8');
          try {
            this.run(cmd);
          } catch (err) {
            this.print(String(err), '#ff6a6a');
          }
        }
      } else if (e.key === 'Escape' || e.key === '`') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'ArrowUp') {
        this.hIndex = Math.min(this.history.length - 1, this.hIndex + 1);
        this.input.value = this.history[this.hIndex] ?? '';
      } else if (e.key === 'ArrowDown') {
        this.hIndex = Math.max(-1, this.hIndex - 1);
        this.input.value = this.hIndex >= 0 ? this.history[this.hIndex] : '';
      }
    });
    this.el = h('div', { class: 'console' }, this.log, this.input);
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
    this.print('Veinreach debug console. Type "help".', '#f5cf3c');
  }

  toggle(): void {
    this.open = !this.open;
    this.el.style.display = this.open ? '' : 'none';
    this.s.host.input.typing = this.open;
    if (this.open) setTimeout(() => this.input.focus(), 0);
    else this.input.blur();
  }

  private print(text: string, color = '#efe6d8'): void {
    this.log.appendChild(h('div', { style: `color:${color}` }, text));
    this.log.scrollTop = this.log.scrollHeight;
  }

  private run(line: string): void {
    const [cmd, ...args] = line.split(/\s+/);
    const s = this.s;
    const p = s.player;
    const [mx, my] = s.camera.screenToWorld(s.input.mouseX, s.input.mouseY);
    switch (cmd.toLowerCase()) {
      case 'help':
        this.print(
          [
            'give <item> [n]      spawn <enemy> [n]    boss <id>',
            'tp <x> <y> | tp spawn | tp surface | tp cursor',
            'time <hour> | time day | time night | speed <n>',
            'god  heal  kill  light  chunks  hitboxes  fps',
            'flag <name>  unflag <name>  flags',
            'event <id> | event end    weather <kind>',
            'items [filter]  enemies  bosses  explore  save  clearenemies',
          ].join('\n'),
        );
        break;
      case 'give': {
        const id = args[0];
        if (!id || !ItemRegistry.has(id)) throw new Error(`Unknown item "${id}". Try: items ${id ?? ''}`);
        const n = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);
        const left = p.inventory.give({ id, count: n });
        this.print(`Gave ${n - left} × ${ItemRegistry.get(id).name}`);
        break;
      }
      case 'items': {
        const f = (args[0] ?? '').toLowerCase();
        this.print(ItemRegistry.all().filter((i) => i.id.includes(f) || i.name.toLowerCase().includes(f)).slice(0, 80).map((i) => i.id).join('  '));
        break;
      }
      case 'spawn': {
        const n = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);
        for (let i = 0; i < n; i++) if (!s.spawnEnemy(args[0], mx + i * 20, my)) throw new Error(`Unknown enemy "${args[0]}"`);
        this.print(`Spawned ${n} ${args[0]}`);
        break;
      }
      case 'enemies':
        this.print(ENEMIES.map((e) => e.id).join('  '));
        break;
      case 'bosses':
        this.print(BOSSES.map((b) => b.id).join('  '));
        break;
      case 'boss': {
        const b = s.bosses.spawn(s, args[0], p);
        if (!b) throw new Error(`Unknown boss. Try: ${BOSSES.map((x) => x.id).join(', ')}`);
        break;
      }
      case 'tp': {
        if (args[0] === 'spawn') p.teleportTo(s, p.spawnX, p.spawnY);
        else if (args[0] === 'cursor') p.teleportTo(s, Math.floor(mx / 16), Math.floor(my / 16));
        else if (args[0] === 'surface') {
          let y = 0;
          while (y < s.world.height - 1 && !s.world.isSolid(p.tileX, y + 1)) y++;
          p.teleportTo(s, p.tileX, y);
        } else {
          const x = parseInt(args[0], 10);
          const y = parseInt(args[1], 10);
          if (isNaN(x) || isNaN(y)) throw new Error('tp <x> <y>');
          p.teleportTo(s, x, y);
        }
        break;
      }
      case 'time':
        if (args[0] === 'day') s.time.setHour(8);
        else if (args[0] === 'night') s.time.setHour(21);
        else s.time.setHour(parseFloat(args[0]));
        this.print(`Time is now ${s.time.clockString()}`);
        break;
      case 'speed':
        s.time.speed = Math.max(0, parseFloat(args[0]) || 1);
        break;
      case 'god':
        p.cheats.god = !p.cheats.god;
        this.print(`God mode ${p.cheats.god ? 'on' : 'off'}`);
        break;
      case 'heal':
        p.life = p.maxLife;
        p.mana = p.maxMana;
        break;
      case 'kill':
        p.hurt(s, { damage: 99999, knockback: 0, dirX: 0, ignoreDefense: true });
        break;
      case 'light':
        s.lighting.fullbright = !s.lighting.fullbright;
        break;
      case 'chunks':
        s.showChunks = !s.showChunks;
        break;
      case 'hitboxes':
        s.showHitboxes = !s.showHitboxes;
        break;
      case 'fps':
        s.settings.showFps = !s.settings.showFps;
        break;
      case 'flag':
        s.progression.set(args[0]);
        this.print(`Set flag ${args[0]}`);
        break;
      case 'unflag':
        s.progression.flags.delete(args[0]);
        break;
      case 'flags':
        this.print([...s.progression.flags].join(', ') || '(none)');
        break;
      case 'event':
        if (args[0] === 'end') s.worldEvents.end(true);
        else {
          const err = s.worldEvents.tryStart(args[0]);
          if (err) throw new Error(`${err} Events: ${Object.keys(WORLD_EVENTS).join(', ')}`);
        }
        break;
      case 'weather':
        s.weather.set((args[0] ?? 'rain') as WeatherKind, 60 * 60 * 3);
        break;
      case 'explore':
        for (let y = 0; y < s.world.height; y++) for (let x = 0; x < s.world.width; x++) s.world.markExplored(x, y);
        s.minimap.rebuild();
        break;
      case 'clearenemies':
        s.entities.clearHostile();
        break;
      case 'save':
        void s.save('manual');
        break;
      default:
        throw new Error(`Unknown command "${cmd}"`);
    }
  }

  dispose(): void {
    this.el.remove();
    this.s.host.input.typing = false;
  }
}
