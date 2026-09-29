import type { GameContext, GameEvents, UIHooks } from './context';
import type { GameHost } from './GameHost';
import { EventBus } from './EventBus';
import { AUTOSAVE_SECONDS, TICKS_PER_SECOND, SAVE_VERSION } from './config';
import type { World } from '../world/World';
import type { WorldRecord, CharacterSave } from '../save/types';
import { EntityManager } from '../entities/EntityManager';
import { ParticleSystem } from '../particles/ParticleSystem';
import { FloatingText } from '../particles/FloatingText';
import { Camera } from '../engine/Camera';
import { TimeSystem } from '../systems/TimeSystem';
import { ProgressionSystem, FLAGS } from '../systems/ProgressionSystem';
import { MiningSystem } from '../systems/MiningSystem';
import { Player } from '../entities/player/Player';
import { BossManager } from '../entities/bosses/BossManager';
import { WorldEventSystem, WORLD_EVENTS } from '../systems/WorldEventSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { NPCManager } from '../entities/npcs/NPCManager';
import { LightingSystem, skyLight } from '../lighting/LightingSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { LiquidSystem } from '../systems/LiquidSystem';
import { RandomTickSystem } from '../systems/RandomTickSystem';
import { TileRenderer } from '../rendering/TileRenderer';
import { BackgroundRenderer } from '../rendering/BackgroundRenderer';
import { ItemDrop } from '../entities/ItemDrop';
import { Projectile, type ProjectileSpawn } from '../entities/Projectile';
import { Enemy } from '../entities/enemies/Enemy';
import { ENEMY_MAP } from '../data/enemies';
import { ItemRegistry } from '../items/ItemRegistry';
import type { ItemStack } from '../items/ItemStack';
import { applyCharacter, characterFromPlayer } from './playerSave';
import { detectBiome } from '../biomes/BiomeDetector';
import { BIOMES, type BiomeKey } from '../data/biomes';
import { T, TileRegistry } from '../world/TileRegistry';
import { toggleDoor } from '../world/WorldActions';
import { unsealWorld } from '../systems/Unsealing';
import { quickUse, inReach } from '../combat/ItemUse';
import { canPlaceItemAt, placementOrigin } from '../systems/BuildingSystem';
import { rectsOverlap, pointInRect } from '../utils/math';
import { Hud } from '../ui/hud/Hud';
import { InventoryPanel } from '../ui/panels/InventoryPanel';
import { NPCPanel } from '../ui/panels/NPCPanel';
import { PauseMenu } from '../ui/panels/PauseMenu';
import { Minimap } from '../ui/Minimap';
import { DebugConsole } from '../ui/DebugConsole';
import { CreativePanel } from '../ui/panels/CreativePanel';
import { GuidePanel } from '../ui/panels/GuidePanel';
import { renderHazards } from '../entities/bosses/hazards';
import { ObjectSprites } from '../rendering/sprites/objectSprites';
import { TileTextures } from '../rendering/sprites/tileTextures';
import type { NetworkManager } from '../multiplayer/NetworkManager';
import type { NPC } from '../entities/npcs/NPC';
import type { ChestData } from '../world/WorldState';

export interface SessionInit {
  host: GameHost;
  world: World;
  record: WorldRecord;
  character: CharacterSave;
  net?: NetworkManager | null;
}

/**
 * A running game: one world, one local player. Implements GameContext for all
 * entities/systems and orchestrates update order, rendering, saving and UI.
 */
export class GameSession implements GameContext {
  readonly host: GameHost;
  readonly world: World;
  record: WorldRecord;
  character: CharacterSave;
  readonly entities = new EntityManager();
  readonly particles = new ParticleSystem();
  readonly text = new FloatingText();
  readonly camera = new Camera();
  readonly time = new TimeSystem();
  readonly bus = new EventBus<GameEvents>();
  readonly progression = new ProgressionSystem(this.bus);
  readonly mining: MiningSystem;
  readonly player = new Player();
  readonly bosses = new BossManager();
  readonly worldEvents = new WorldEventSystem();
  readonly weather = new WeatherSystem();
  readonly npcs = new NPCManager();
  readonly lighting = new LightingSystem();
  readonly spawns = new SpawnSystem();
  readonly liquids: LiquidSystem;
  readonly randomTicks = new RandomTickSystem();
  readonly tiles = new TileRenderer();
  readonly background = new BackgroundRenderer();
  readonly hud: Hud;
  readonly inventory: InventoryPanel;
  readonly npcPanel: NPCPanel;
  readonly pause: PauseMenu;
  readonly minimap: Minimap;
  readonly debug: DebugConsole;
  readonly creative: CreativePanel;
  readonly guide: GuidePanel;
  readonly net: NetworkManager | null;
  readonly ui: UIHooks;
  tick = 0;
  paused = false;
  biome: BiomeKey = 'meadow';
  private autosaveTimer = 0;
  private saving = false;
  private unsealGen: Generator<number> | null = null;
  private lastHour = 0;
  private lightFrame = 0;
  private disposed = false;
  private unsubscribers: (() => void)[] = [];
  showChunks = false;
  showHitboxes = false;

  get audio() {
    return this.host.audio;
  }
  get input() {
    return this.host.input;
  }
  get settings() {
    return this.host.settings;
  }
  get online(): boolean {
    return !!this.net?.connected;
  }

  constructor(init: SessionInit) {
    this.host = init.host;
    this.world = init.world;
    this.record = init.record;
    this.character = init.character;
    this.net = init.net ?? null;
    this.mining = new MiningSystem(this.world.width);
    this.liquids = new LiquidSystem(this.world);
    this.camera.setBounds(this.world.width * 16, this.world.height * 16);
    this.bosses.bind(this);
    this.worldEvents.bind(this);
    this.npcs.bind(this);

    // Restore world state.
    const st = this.record.state;
    this.time.time = st.time || this.time.time;
    this.time.day = st.day;
    this.progression.load(st.flags, st.bossKills);
    this.worldEvents.active = st.event;
    this.weather.load(st.weather);
    this.world.structures = st.structures.length ? st.structures : this.world.structures;
    if (st.chests.length) {
      this.world.chests.clear();
      for (const c of st.chests) this.world.chests.set(this.world.chestKey(c.x, c.y), c);
    }
    // Player
    applyCharacter(this.player, this.character);
    const spawn = st.playerSpawns[this.character.id];
    this.player.spawnX = spawn && this.world.getFg(spawn.x, spawn.y + 1) !== 0 ? spawn.x : st.spawnX;
    this.player.spawnY = spawn && this.world.getFg(spawn.x, spawn.y + 1) !== 0 ? spawn.y : st.spawnY;
    const pos = st.playerPositions[this.character.id];
    this.entities.add(this.player);
    this.player.teleportTo(this, pos ? pos.x : this.player.spawnX, pos ? pos.y : this.player.spawnY);
    if (this.player.permadead) this.player.permadead = false; // a permadead char can't be selected; safety
    this.npcs.load(this, st.npcs);
    for (const d of st.drops) this.entities.add(new ItemDrop({ id: d.id, count: d.count }, d.x, d.y, 0));
    this.lastHour = this.time.hour;

    // UI
    const self = this;
    this.hud = new Hud(this);
    this.inventory = new InventoryPanel(this);
    this.npcPanel = new NPCPanel(this);
    this.pause = new PauseMenu(this);
    this.minimap = new Minimap(this);
    this.debug = new DebugConsole(this);
    this.creative = new CreativePanel(this);
    this.guide = new GuidePanel(this);
    this.ui = {
      openChest: (c: ChestData) => self.inventory.openChest(c),
      openNPC: (n: NPC) => self.npcPanel.open(n),
      closeWorldPanels: () => {
        self.inventory.closeChest();
        self.npcPanel.close();
      },
      bossIntro: (name, title) => self.hud.bossIntro(name, title),
      banner: (t, s, c) => self.hud.banner(t, s, c),
      openGuide: () => self.guide.open(),
    };

    // World change hooks.
    this.unsubscribers.push(
      this.world.onChange((x, y, layer) => {
        if (layer !== 'wall') this.liquids.wake(x, y);
        this.minimap.onTileChanged(x, y);
      }),
    );
    this.lighting.onExplore = (x, y) => this.minimap.onExplored(x, y);
    this.liquids.onSolidify = (x, y) => this.minimap.onTileChanged(x, y);
    this.bus.on('flagSet', ({ flag }) => this.onFlag(flag));
    this.bus.on('saveRequested', ({ reason }) => void this.save(reason));
    this.bus.on('message', ({ text, color }) => this.hud.message(text, color));
    this.bus.on('playerDied', ({ cause }) => this.onPlayerDied(cause));
    this.liquids.wakeArea(this.player.tileX - 120, this.player.tileY - 80, this.player.tileX + 120, this.player.tileY + 80);
    // Resume an interrupted Unsealing.
    if (this.progression.has(FLAGS.unsealed) && !this.progression.has('unseal:done')) this.unsealGen = unsealWorld(this, this.record.meta.seed);
    this.net?.attach(this);
    this.applySettings();
    this.message(`Welcome to ${this.record.meta.name}, ${this.player.name}.`, '#ffe8a0');
    if (!this.host.saves.persistent) this.message('Warning: browser storage is unavailable — progress will not be saved.', '#ff8a8a');
  }

  applySettings(): void {
    const s = this.settings;
    this.camera.targetZoom = s.zoom;
    this.camera.shakeEnabled = s.screenShake;
    this.particles.density = s.particles;
  }

  // ---------------- GameContext services ----------------
  message(text: string, color?: string): void {
    this.hud.message(text, color);
  }

  dropItem(stack: ItemStack, x: number, y: number, vx = 0, vy = -2, pickupDelay = 20): void {
    if (!ItemRegistry.has(stack.id) || stack.count <= 0) return;
    const d = new ItemDrop({ id: stack.id, count: stack.count }, x, y, pickupDelay);
    d.vx = vx;
    d.vy = vy;
    this.entities.add(d);
  }

  spawnProjectile(id: string, x: number, y: number, vx: number, vy: number, o: ProjectileSpawn): Projectile | null {
    const def = ItemRegistry.projectile(id);
    if (!def) {
      console.warn(`[Session] unknown projectile ${id}`);
      return null;
    }
    const p = new Projectile(def, x, y, vx, vy, o);
    this.entities.add(p);
    return p;
  }

  spawnEnemy(id: string, x: number, y: number): Enemy | null {
    const def = ENEMY_MAP.get(id);
    if (!def) {
      console.warn(`[Session] unknown enemy ${id}`);
      return null;
    }
    const unsealed = this.progression.has(FLAGS.unsealed);
    const gated = def.spawn.some((r) => r.requires === FLAGS.unsealed);
    const scale = (unsealed && !gated ? 1.6 : 1) * (1 + this.progression.bossesDefeated() * 0.06);
    const e = new Enemy(def, x, y, scale);
    this.entities.add(e);
    return e;
  }

  shake(amount: number): void {
    this.camera.shake(amount);
  }

  // ---------------- Update ----------------
  update(): void {
    if (this.disposed) return;
    const inp = this.input;
    this.handleUIInput();
    if (this.paused && !this.online) {
      inp.endTick();
      return;
    }
    this.tick++;
    this.updatePlayerInput();

    // Time & world events.
    const dayRolled = this.time.update();
    const h = this.time.hour;
    const dusk = this.lastHour < 19.5 && h >= 19.5;
    const dawn = (this.lastHour < 4.5 && h >= 4.5) || (dayRolled && h >= 4.5);
    this.lastHour = h;
    if (dusk && !this.worldEvents.active) this.message('Night falls...', '#9aa0ff');
    this.worldEvents.update(this, { dusk, dawn });
    this.weather.update(this);
    this.spawns.update(this);
    this.npcs.update(this);
    this.entities.update(this);
    this.mining.update();
    if (this.tick % 3 === 0) this.liquids.step(this.player.tileX, this.player.tileY, 110);
    this.randomTicks.update(this);
    this.particles.update();
    this.text.update();
    this.stepUnsealing();

    // Camera with slight lead toward the cursor.
    const [mx, my] = this.camera.screenToWorld(inp.mouseX, inp.mouseY);
    const lead = inp.overCanvas ? 0.08 : 0;
    this.camera.follow(this.player.cx, this.player.cy - 8, (mx - this.player.cx) * lead, (my - this.player.cy) * lead);
    this.audio.setListener(this.player.cx, this.player.cy);

    if (this.tick % 30 === 0) this.updateBiomeAndMusic();
    if (this.tick % 60 === 0) this.discoverStructures();
    if (this.player.cheats.god) {
      this.player.life = this.player.maxLife;
      this.player.mana = this.player.maxMana;
    }
    // Autosave.
    if (this.settings.autosave && ++this.autosaveTimer >= AUTOSAVE_SECONDS * TICKS_PER_SECOND) {
      this.autosaveTimer = 0;
      void this.save('autosave');
    }
    this.net?.update(this);
    this.inventory.update();
    this.npcPanel.update();
    this.creative.update();
    this.hud.update();
    this.minimap.update();
    inp.endTick();
  }

  private handleUIInput(): void {
    const inp = this.input;
    if (this.debug.open) return;
    if (inp.wasPressed('pause')) {
      if (this.hud.mapOpen) this.hud.toggleMap(false);
      else if (this.guide.isOpen) this.guide.close();
      else if (this.creative.isOpen) this.creative.close();
      else if (this.npcPanel.isOpen) this.npcPanel.close();
      else if (this.inventory.isOpen) this.inventory.close();
      else this.pause.toggle();
    }
    if (this.paused) return;
    if (inp.wasPressed('inventory')) {
      if (this.npcPanel.isOpen) this.npcPanel.close();
      this.inventory.toggle();
    }
    if (inp.wasPressed('map')) this.hud.toggleMap();
    if (inp.wasPressed('debug') && this.settings.developerMode) this.debug.toggle();
    if (inp.wasPressed('creative')) this.creative.toggle();
    if (inp.wasPressed('guide')) this.guide.toggle();
    if (inp.wasPressed('zoomIn')) this.camera.targetZoom = Math.min(4, this.camera.targetZoom + 0.25);
    if (inp.wasPressed('zoomOut')) this.camera.targetZoom = Math.max(1, this.camera.targetZoom - 0.25);
    const hb = inp.hotbarPressed();
    const inv = this.player.inventory;
    if (hb >= 0) inv.selected = hb;
    const wheel = inp.takeWheel();
    if (wheel && inp.overCanvas && !this.player.use.active) inv.selected = (inv.selected + wheel + 10) % 10;
    if (inp.wasPressed('quickHeal')) quickUse(this.player, this, 'heal');
    if (inp.wasPressed('quickMana')) quickUse(this.player, this, 'mana');
    if (inp.wasPressed('drop')) {
      const s = inv.heldItem();
      if (s) {
        const n = inp.isDown('modifier') ? s.count : 1;
        const taken = inv.main.takeFromSlot(inv.selected, n);
        if (taken) this.dropItem(taken, this.player.cx + this.player.facing * 12, this.player.cy, this.player.facing * 3, -2, 80);
      }
    }
  }

  private updatePlayerInput(): void {
    const inp = this.input;
    const p = this.player;
    const [ax, ay] = this.camera.screenToWorld(inp.mouseX, inp.mouseY);
    const worldClick = inp.overCanvas && !this.pause.isOpen;
    const holdingCursor = !!this.inventory.cursor.stack;
    // Clicking the world while dragging an item throws it.
    if (holdingCursor && inp.leftPressed && worldClick) {
      const s = this.inventory.cursor.stack!;
      this.inventory.cursor.stack = null;
      this.dropItem(s, p.cx + p.facing * 12, p.cy - 8, p.facing * 3, -2, 80);
    }
    let alt = false;
    if (inp.rightPressed && worldClick && !holdingCursor) alt = this.interact(ax, ay);
    const held = p.inventory.heldItem();
    const heldDef = held ? ItemRegistry.get(held.id) : null;
    const rightPlaces = !alt && worldClick && (inp.mouseRight || inp.rightPressed) && !!heldDef && (!!heldDef.placeTile || !!heldDef.placeWall);
    p.input = {
      left: inp.isDown('left'),
      right: inp.isDown('right'),
      up: inp.isDown('up'),
      down: inp.isDown('down'),
      jump: inp.isDown('jump'),
      jumpPressed: inp.wasPressed('jump'),
      use: (worldClick && (inp.mouseLeft || inp.leftPressed) && !holdingCursor) || rightPlaces,
      usePressed: (worldClick && inp.leftPressed && !holdingCursor) || (rightPlaces && inp.rightPressed),
      aimX: ax,
      aimY: ay,
    };
  }

  /** Right-click interactions. Returns true if something was interacted with. */
  interact(wx: number, wy: number): boolean {
    const p = this.player;
    for (const n of this.entities.npcs) {
      if (pointInRect(wx, wy, { x: n.x - 4, y: n.y - 4, w: n.w + 8, h: n.h + 8 }) && Math.hypot(n.cx - p.cx, n.cy - p.cy) < 16 * 7) {
        this.npcPanel.open(n);
        return true;
      }
    }
    const tx = Math.floor(wx / 16);
    const ty = Math.floor(wy / 16);
    if (!inReach(p, tx, ty, 1)) return false;
    const id = this.world.getFg(tx, ty);
    if (id === T.doorClosed || id === T.doorOpen) return toggleDoor(this, tx, ty) || true;
    if (id === T.chest) {
      const c = this.world.getChestAt(tx, ty);
      if (c) {
        this.inventory.openChest(c);
        this.audio.play('chest', { x: wx, y: wy });
        this.net?.sendChestOpen(c.x, c.y);
      }
      return true;
    }
    if (id === T.bed) {
      const [ox, oy] = this.world.objectOrigin(tx, ty);
      p.spawnX = ox + 1;
      p.spawnY = oy + 1;
      this.record.state.playerSpawns[p.charId] = { x: p.spawnX, y: p.spawnY };
      p.buffs.add('homely', 60 * 5);
      this.message('Spawn point set.', '#a0ffa0');
      this.audio.play('powerup', { volume: 0.5 });
      return true;
    }
    return false;
  }

  private updateBiomeAndMusic(): void {
    const p = this.player;
    this.biome = detectBiome(this.world, p.tileX, p.tileY);
    this.background.setBiome(this.biome);
    this.background.wind = this.weather.wind;
    const zone = this.world.zoneAt(p.tileY);
    const boss = this.bosses.musicOverride();
    const ev = this.worldEvents.def;
    let track: string;
    if (boss) track = boss;
    else if (ev && (zone === 'surface' || ev.id === 'veilstorm')) track = ev.music;
    else if (zone === 'surface' || zone === 'sky') {
      const b = BIOMES[this.biome];
      track = this.time.isNight && !['blightmire', 'shardblight'].includes(this.biome) ? 'night' : b.music;
    } else track = BIOMES[this.biome].music;
    this.audio.setMusic(track);
    this.audio.setAmbience({ lava: zone === 'underworld' ? 0.7 : 0 });
  }

  private discoverStructures(): void {
    const p = this.player;
    const r = { x: p.tileX - 30, y: p.tileY - 20, w: 60, h: 40 };
    for (const s of this.world.structures) {
      if (!s.discovered && rectsOverlap(r, s)) {
        s.discovered = true;
        this.message(`Discovered: ${s.name}`, '#ffe8a0');
      }
    }
  }

  private onFlag(flag: string): void {
    if (flag === FLAGS.unsealed && !this.unsealGen) {
      this.unsealGen = unsealWorld(this, this.record.meta.seed);
      this.audio.play('unseal');
      this.shake(1);
      this.hud.banner('The Seal is broken!', 'Void-touched ores spread through the deep, and a violet scar tears across the land.', '#c080ff');
    }
    this.record.meta.bossesDefeated = this.progression.bossesDefeated();
    this.record.meta.unsealed = this.progression.has(FLAGS.unsealed);
  }

  private stepUnsealing(): void {
    if (!this.unsealGen) return;
    const t0 = performance.now();
    if (this.net) this.net.suppressCapture = true;
    try {
      this.stepUnsealingSlice(t0);
    } finally {
      if (this.net) this.net.suppressCapture = false;
    }
  }

  private stepUnsealingSlice(t0: number): void {
    while (this.unsealGen && performance.now() - t0 < 6) {
      const r = this.unsealGen.next();
      if (r.done) {
        this.unsealGen = null;
        this.progression.set('unseal:done');
        this.world.recomputeSkyTop();
        this.minimap.rebuild();
        this.message('Umbralite and Aetherium now lie in the deep caverns. The Shardblight has appeared.', '#e0b0ff');
        void this.save('unsealing');
        return;
      }
    }
  }

  private onPlayerDied(cause: string): void {
    this.inventory.closeChest();
    this.npcPanel.close();
    if (this.player.permadead) {
      this.hud.showDeath(`${this.player.name} has fallen to ${cause}.`, 'Ironsoul characters cannot return.');
      void this.save('permadeath').then(() => {
        setTimeout(() => this.host.exitToMenu(), 5000);
      });
    } else {
      this.hud.showDeath(`${this.player.name} was slain by ${cause}.`, null);
    }
  }

  // ---------------- Saving ----------------
  async save(reason: string): Promise<boolean> {
    if (this.saving || this.disposed && reason !== 'exit') return false;
    this.saving = true;
    try {
      const p = this.player;
      this.character = characterFromPlayer(p, this.character);
      await this.host.saves.saveCharacter(this.character);
      const st = this.record.state;
      st.time = this.time.time;
      st.day = this.time.day;
      st.flags = [...this.progression.flags];
      st.bossKills = { ...this.progression.bossKills };
      st.event = this.worldEvents.active;
      st.weather = this.weather.serialize();
      st.npcs = this.npcs.serialize();
      st.playerPositions[p.charId] = { x: p.tileX, y: Math.floor((p.bottom - 1) / 16) };
      st.structures = this.world.structures;
      st.chests = [...this.world.chests.values()];
      st.drops = this.entities.drops.slice(0, 300).map((d) => ({ id: d.stack.id, count: d.stack.count, x: d.cx, y: d.cy }));
      this.record.meta.lastPlayed = Date.now();
      this.record.meta.version = SAVE_VERSION;
      this.record.meta.bossesDefeated = this.progression.bossesDefeated();
      this.record.meta.unsealed = this.progression.has(FLAGS.unsealed);
      if (!this.online) await this.host.saves.saveWorld(this.record, this.world);
      if (reason === 'manual' || reason === 'autosave') this.hud.saveIndicator(reason === 'manual' ? 'Game saved.' : 'Autosaved');
      return true;
    } catch (err) {
      console.error('[Save] failed', err);
      this.message('Saving failed! See console for details.', '#ff6a6a');
      return false;
    } finally {
      this.saving = false;
    }
  }

  async exit(): Promise<void> {
    await this.save('exit');
    this.dispose();
    this.host.exitToMenu();
  }

  dispose(): void {
    this.disposed = true;
    for (const u of this.unsubscribers) u();
    this.bus.clear();
    this.net?.disconnect();
    this.hud.dispose();
    this.inventory.dispose();
    this.npcPanel.dispose();
    this.pause.dispose();
    this.debug.dispose();
    this.creative.dispose();
    this.guide.dispose();
  }

  // ---------------- Rendering ----------------
  render(g: CanvasRenderingContext2D, dpr: number): void {
    const cam = this.camera;
    cam.viewW = g.canvas.width / dpr;
    cam.viewH = g.canvas.height / dpr;
    const daylight = this.time.daylight;
    const tint = BIOMES[this.biome].skyTint;
    const sky = skyLight(daylight, tint);
    const evTint = this.worldEvents.def?.skyTint ?? null;
    if (evTint && this.time.isNight) {
      sky.r = Math.max(sky.r, 0.14);
      sky.b = Math.max(sky.b, 0.2);
    }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    this.background.render(g, cam, this.time, this.world.layers.surfaceY, this.world.layers.underworldY, sky, evTint);

    const z = cam.zoom * dpr;
    const ox = Math.round((cam.viewW / 2 - (cam.x + cam.shakeX) * cam.zoom) * dpr);
    const oy = Math.round((cam.viewH / 2 - (cam.y + cam.shakeY) * cam.zoom) * dpr);
    g.setTransform(z, 0, 0, z, ox, oy);
    const l = cam.left - 16;
    const t = cam.top - 16;
    const r = cam.right + 16;
    const b = cam.bottom + 16;
    this.tiles.render(g, this.world, l, t, r, b);
    this.tiles.renderCracks(g, (fn) => this.mining.forEachDamaged(fn, this.world));
    this.tiles.renderDynamic(g, this.world, l, t, r, b, this.tick);
    this.entities.render(g, this, l, t, r, b);
    this.particles.render(g, l, t, r, b);
    this.renderCursor(g);

    // Lighting
    if (this.lightFrame++ % 2 === 0) {
      const lights = this.entities.lights(l, t, r, b);
      const p = this.player;
      if (!p.dead) lights.push({ x: p.cx, y: p.cy, r: 0.3, g: 0.28, b: 0.32, radius: 2 });
      this.lighting.compute(this.world, l, t, r, b, sky, lights, { nightVision: p.stats.nightVision > 0 });
    }
    this.lighting.render(g, this.settings.smoothLighting);

    // Post-light overlays (always readable).
    for (const boss of this.bosses.active) renderHazards(g, boss.hazards, this.tick);
    this.text.render(g);
    if (this.showChunks) this.renderChunkBorders(g, l, t, r, b);
    if (this.showHitboxes) this.renderHitboxes(g);
    this.net?.renderOverlay(g);

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.weather.render(g, this);
    if (this.player.life < this.player.maxLife * 0.25 && !this.player.dead) {
      const a = 0.25 + Math.sin(this.tick * 0.1) * 0.1;
      const grd = g.createRadialGradient(cam.viewW / 2, cam.viewH / 2, cam.viewH * 0.3, cam.viewW / 2, cam.viewH / 2, cam.viewH * 0.8);
      grd.addColorStop(0, 'rgba(120,0,0,0)');
      grd.addColorStop(1, `rgba(120,0,0,${a})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, cam.viewW, cam.viewH);
    }
    this.minimap.render();
  }

  private renderCursor(g: CanvasRenderingContext2D): void {
    const inp = this.input;
    if (!inp.overCanvas || this.player.dead) return;
    const [wx, wy] = this.camera.screenToWorld(inp.mouseX, inp.mouseY);
    const tx = Math.floor(wx / 16);
    const ty = Math.floor(wy / 16);
    const held = this.player.inventory.heldItem();
    const def = held ? ItemRegistry.get(held.id) : null;
    if (!def) return;
    const reach = inReach(this.player, tx, ty, def.tool?.range ?? 0);
    if (def.placeTile || def.placeWall) {
      if (!reach) return;
      const ok = canPlaceItemAt(this, def, tx, ty);
      g.globalAlpha = 0.55;
      if (def.placeTile) {
        const id = TileRegistry.id(def.placeTile);
        const td = TileRegistry.get(id);
        const [ox, oy] = placementOrigin(def.placeTile, tx, ty);
        const spr = td.texture.kind === 'sprite' ? ObjectSprites.get(td.key === 'door_closed' ? 'door_closed' : td.key, 0) : TileTextures.tile(id, 0);
        if (spr) g.drawImage(spr, ox * 16, oy * 16);
        const [w, hgt] = td.size ?? [1, 1];
        g.globalAlpha = 0.8;
        g.strokeStyle = ok ? '#7ae07a' : '#ff6a6a';
        g.lineWidth = 1;
        g.strokeRect(ox * 16 + 0.5, oy * 16 + 0.5, w * 16 - 1, hgt * 16 - 1);
      } else {
        g.strokeStyle = ok ? '#7ae07a' : '#ff6a6a';
        g.globalAlpha = 0.8;
        g.strokeRect(tx * 16 + 0.5, ty * 16 + 0.5, 15, 15);
      }
      g.globalAlpha = 1;
    } else if (def.tool && reach) {
      const has = def.tool.hammer ? this.world.getWall(tx, ty) !== 0 || this.world.getFg(tx, ty) !== 0 : this.world.getFg(tx, ty) !== 0;
      if (has) {
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1;
        g.strokeRect(tx * 16 + 0.5, ty * 16 + 0.5, 15, 15);
      }
    }
  }

  private renderChunkBorders(g: CanvasRenderingContext2D, l: number, t: number, r: number, b: number): void {
    g.strokeStyle = 'rgba(255,255,0,0.5)';
    g.lineWidth = 1;
    const cs = 512;
    for (let x = Math.floor(l / cs) * cs; x < r; x += cs) {
      g.beginPath();
      g.moveTo(x, t);
      g.lineTo(x, b);
      g.stroke();
    }
    for (let y = Math.floor(t / cs) * cs; y < b; y += cs) {
      g.beginPath();
      g.moveTo(l, y);
      g.lineTo(r, y);
      g.stroke();
    }
  }

  private renderHitboxes(g: CanvasRenderingContext2D): void {
    g.lineWidth = 1;
    const box = (e: { x: number; y: number; w: number; h: number }, c: string) => {
      g.strokeStyle = c;
      g.strokeRect(e.x, e.y, e.w, e.h);
    };
    for (const e of this.entities.enemies) box(e, '#ff4a4a');
    for (const e of this.entities.projectiles) box(e, '#ffe070');
    for (const e of this.entities.drops) box(e, '#6aff6a');
    for (const e of this.entities.npcs) box(e, '#6ab0ff');
    box(this.player, '#ffffff');
  }

  /** Current event (for HUD). */
  eventInfo(): { name: string; progress: number; goal: number } | null {
    const a = this.worldEvents.active;
    if (!a) return null;
    return { name: WORLD_EVENTS[a.id]?.name ?? a.id, progress: a.progress, goal: a.goal };
  }
}
