/**
 * Headless GameContext for integration tests: real world, entities and
 * systems; stubbed audio/UI/rendering. Lets us run enemies and bosses for
 * thousands of ticks in Node and catch runtime errors.
 */
import type { GameContext, GameEvents, UIHooks } from '../../src/core/context';
import { EventBus } from '../../src/core/EventBus';
import { EntityManager } from '../../src/entities/EntityManager';
import { ParticleSystem } from '../../src/particles/ParticleSystem';
import { FloatingText } from '../../src/particles/FloatingText';
import { Camera } from '../../src/engine/Camera';
import { TimeSystem } from '../../src/systems/TimeSystem';
import { ProgressionSystem } from '../../src/systems/ProgressionSystem';
import { MiningSystem } from '../../src/systems/MiningSystem';
import { Player } from '../../src/entities/player/Player';
import { BossManager } from '../../src/entities/bosses/BossManager';
import { WorldEventSystem } from '../../src/systems/WorldEventSystem';
import { WeatherSystem } from '../../src/systems/WeatherSystem';
import { NPCManager } from '../../src/entities/npcs/NPCManager';
import { LightingSystem } from '../../src/lighting/LightingSystem';
import { ItemDrop } from '../../src/entities/ItemDrop';
import { Projectile, type ProjectileSpawn } from '../../src/entities/Projectile';
import { Enemy } from '../../src/entities/enemies/Enemy';
import { ENEMY_MAP } from '../../src/data/enemies';
import { ItemRegistry } from '../../src/items/ItemRegistry';
import type { ItemStack } from '../../src/items/ItemStack';
import type { World } from '../../src/world/World';
import { defaultSettings } from '../../src/core/Settings';
import type { AudioManager } from '../../src/audio/AudioManager';
import type { InputManager } from '../../src/engine/InputManager';
import { SpawnSystem } from '../../src/systems/SpawnSystem';
import { emptyInput } from '../../src/entities/player/Player';

const noop = () => undefined;
const audioStub = { play: noop, setMusic: noop, setAmbience: noop, setListener: noop, unlock: noop, setVolumes: noop } as unknown as AudioManager;
const inputStub = { isDown: () => false, wasPressed: () => false, mouseX: 0, mouseY: 0, overCanvas: false } as unknown as InputManager;

export class SimContext implements GameContext {
  readonly entities = new EntityManager();
  readonly particles = new ParticleSystem();
  readonly text = new FloatingText();
  readonly audio = audioStub;
  readonly camera = new Camera();
  readonly input = inputStub;
  readonly time = new TimeSystem();
  readonly bus = new EventBus<GameEvents>();
  readonly progression = new ProgressionSystem(this.bus);
  readonly mining: MiningSystem;
  readonly settings = defaultSettings();
  readonly player = new Player();
  readonly bosses = new BossManager();
  readonly worldEvents = new WorldEventSystem();
  readonly weather = new WeatherSystem();
  readonly npcs = new NPCManager();
  readonly lighting = new LightingSystem();
  readonly spawns = new SpawnSystem();
  readonly messages: string[] = [];
  readonly ui: UIHooks = { openChest: noop, openNPC: noop, closeWorldPanels: noop, bossIntro: noop, banner: (t) => void this.messages.push(t), openGuide: noop };
  tick = 0;
  readonly online = false;
  god = false;

  constructor(readonly world: World) {
    this.mining = new MiningSystem(world.width);
    this.bosses.bind(this);
    this.worldEvents.bind(this);
    this.npcs.bind(this);
    this.camera.setBounds(world.width * 16, world.height * 16);
    this.camera.viewW = 1280;
    this.camera.viewH = 720;
    this.entities.add(this.player);
    this.player.refreshStats();
  }

  message(text: string): void {
    this.messages.push(text);
  }
  dropItem(stack: ItemStack, x: number, y: number, vx = 0, vy = -2, delay = 20): void {
    if (!ItemRegistry.has(stack.id)) return;
    const d = new ItemDrop({ ...stack }, x, y, delay);
    d.vx = vx;
    d.vy = vy;
    this.entities.add(d);
  }
  spawnProjectile(id: string, x: number, y: number, vx: number, vy: number, o: ProjectileSpawn): Projectile | null {
    const def = ItemRegistry.projectile(id);
    if (!def) throw new Error(`unknown projectile ${id}`);
    const p = new Projectile(def, x, y, vx, vy, o);
    this.entities.add(p);
    return p;
  }
  spawnEnemy(id: string, x: number, y: number): Enemy | null {
    const def = ENEMY_MAP.get(id);
    if (!def) throw new Error(`unknown enemy ${id}`);
    const e = new Enemy(def, x, y);
    this.entities.add(e);
    return e;
  }
  shake(): void {}

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.tick++;
      this.player.input = { ...emptyInput(), ...this.nextInput };
      this.time.update();
      this.npcs.update(this);
      this.entities.update(this);
      this.mining.update();
      this.particles.update();
      this.text.update();
      this.camera.follow(this.player.cx, this.player.cy);
      if (this.god) {
        this.player.life = this.player.maxLife;
        this.player.dead = false;
      }
    }
  }
  nextInput: Partial<ReturnType<typeof emptyInput>> = {};
}
