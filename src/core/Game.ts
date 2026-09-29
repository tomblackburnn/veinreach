import type { MenuHost, CharacterNext } from '../ui/menus/MenuHost';
import { InputManager } from '../engine/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { IDBBackend, MemoryBackend } from '../save/backend';
import { defaultSettings, type SettingsData } from './Settings';
import { UIManager } from '../ui/UIManager';
import { GameLoop } from './GameLoop';
import { GameSession } from './GameSession';
import type { CharacterSave, WorldRecord } from '../save/types';
import { titleScreen, creditsScreen } from '../ui/menus/TitleScreen';
import { characterSelect, characterCreate } from '../ui/menus/CharacterScreens';
import { worldSelect, worldCreate, loadingScreen } from '../ui/menus/WorldScreens';
import { multiplayerScreen } from '../ui/menus/MultiplayerScreen';
import { buildSettingsPanel } from '../ui/menus/SettingsScreen';
import { h } from '../utils/dom';
import { generateWorld, runSliced } from '../generation/WorldGenerator';
import { WORLD_SIZES, GEN_VERSION } from './config';
import { applyChunkRecord, applyExplored, decodeChunkRecord } from '../save/serialization';
import { BackgroundRenderer } from '../rendering/BackgroundRenderer';
import { TimeSystem } from '../systems/TimeSystem';
import { Camera } from '../engine/Camera';
import { skyLight } from '../lighting/LightingSystem';
import type { BiomeKey } from '../data/biomes';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { defaultWorldState } from '../world/WorldState';
import { applyRemotePainting } from '../world/paintings';
import { ItemRegistry } from '../items/ItemRegistry';
import { RecipeRegistry } from '../crafting/RecipeRegistry';

/** Application root: owns the canvas, services, menus and the active session. */
export class Game implements MenuHost {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  readonly input: InputManager;
  readonly audio = new AudioManager();
  saves = new SaveManager(new MemoryBackend());
  settings: SettingsData = defaultSettings();
  readonly ui: UIManager;
  private loop: GameLoop;
  private session: GameSession | null = null;
  dpr = 1;
  private menuBg = new BackgroundRenderer();
  private menuTime = new TimeSystem();
  private menuCam = new Camera();
  private menuBiomes: BiomeKey[] = ['meadow', 'taiga', 'dunes', 'blightmire', 'meadow'];
  private menuTick = 0;
  private busy = false;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const g = this.canvas.getContext('2d', { alpha: false });
    if (!g) throw new Error('Canvas 2D is not supported in this browser.');
    this.g = g;
    this.input = new InputManager(this.canvas);
    this.ui = new UIManager('ui-root', this.audio);
    this.loop = new GameLoop(() => this.update(), () => this.render());
    window.addEventListener('resize', () => this.resize());
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('beforeunload', () => {
      if (this.session) void this.session.save('unload');
    });
    this.menuTime.speed = 40;
    this.menuTime.setHour(6);
  }

  async init(): Promise<void> {
    try {
      this.saves = new SaveManager(await IDBBackend.open());
    } catch (err) {
      console.warn('[Game] IndexedDB unavailable, using memory storage', err);
    }
    this.settings = await this.saves.loadSettings();
    this.input.bindings = structuredClone(this.settings.bindings);
    this.applySettings();
    this.resize();
    const problems = [...ItemRegistry.problems, ...RecipeRegistry.problems];
    if (problems.length) console.warn(`[Game] ${problems.length} content problems detected (see above).`);
    this.showTitle();
    this.loop.start();
    // Dev convenience: ?autoplay resumes the most recent character + world.
    if (new URLSearchParams(location.search).has('autoplay')) {
      const [c] = await this.saves.listCharacters();
      const [w] = await this.saves.listWorlds();
      if (c && w) void this.startWorld(c, w, false);
    }
  }

  fps(): number {
    return this.loop.fps;
  }

  frameCost(): number {
    return this.loop.frameCost;
  }

  applySettings(): void {
    const s = this.settings;
    this.audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume, ambience: s.ambienceVolume });
    this.ui.setScale(s.uiScale);
    this.session?.applySettings();
  }

  saveSettings(): void {
    void this.saves.saveSettings(this.settings).catch((e) => console.warn('[Game] settings save failed', e));
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.g.imageSmoothingEnabled = false;
  }

  // ---------------- Menus ----------------
  showTitle(): void {
    this.audio.setMusic('title');
    this.ui.show(titleScreen(this));
  }
  showCharacters(next: CharacterNext): void {
    this.ui.show(characterSelect(this, next));
  }
  showCharacterCreate(next: CharacterNext): void {
    this.ui.show(characterCreate(this, next));
  }
  showWorlds(c: CharacterSave | null): void {
    this.ui.show(worldSelect(this, c));
  }
  showWorldCreate(c: CharacterSave | null): void {
    this.ui.show(worldCreate(this, c));
  }
  showSettings(): void {
    this.ui.show(h('div', { class: 'screen' }, buildSettingsPanel(this, () => this.showTitle())));
  }
  showCredits(): void {
    this.ui.show(creditsScreen(this));
  }
  showMultiplayer(c: CharacterSave): void {
    this.ui.show(multiplayerScreen(this, c));
  }

  // ---------------- Starting a world ----------------
  async startWorld(c: CharacterSave, record: WorldRecord, isNew: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const loading = loadingScreen();
    this.ui.show(loading.el);
    try {
      const { width, height } = WORLD_SIZES[record.meta.size];
      const gen = await runSliced(generateWorld({ name: record.meta.name, seed: record.meta.seed, width, height }), (p) => loading.set(p.stage, p.progress));
      const world = gen.world;
      if (isNew) {
        record.state.spawnX = gen.spawnX;
        record.state.spawnY = gen.spawnY;
        record.state.structures = gen.structures;
        record.state.chests = [...world.chests.values()];
        record.state.time = this.menuTime.time && 0;
        await this.saves.saveWorld(record, world, true);
      } else {
        loading.set('Restoring your changes', 0.99);
        const data = await this.saves.loadWorld(record.id);
        record = data.record;
        let bad = 0;
        for (const ch of data.chunks) if (!applyChunkRecord(world, ch)) bad++;
        for (const ex of data.explored) applyExplored(world, ex);
        if (bad) console.warn(`[Game] ${bad} saved chunks were invalid and skipped`);
        world.recomputeSkyTop();
        if (!record.state.spawnX) {
          record.state.spawnX = gen.spawnX;
          record.state.spawnY = gen.spawnY;
        }
      }
      this.ui.clearAll();
      this.session = new GameSession({ host: this, world, record, character: c });
      if (isNew) void this.session.save('new');
      else if ((record.meta.genVersion ?? 1) !== GEN_VERSION) {
        this.session.message('This world was created by an older world generator; untouched areas may look different.', '#ffb070');
      }
    } catch (err) {
      console.error('[Game] failed to start world', err);
      await this.ui.alert('Could not load world', `Something went wrong: ${(err as Error).message}. The save may be corrupt.`);
      this.showWorlds(c);
    } finally {
      this.busy = false;
    }
  }

  async joinServer(c: CharacterSave, url: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const loading = loadingScreen();
    this.ui.show(loading.el);
    loading.set(`Connecting to ${url}...`, 0);
    try {
      const { net, welcome, players } = await NetworkManager.connect(url, c);
      const size = welcome.world.size in WORLD_SIZES ? welcome.world.size : 'medium';
      const { width, height } = WORLD_SIZES[size];
      const gen = await runSliced(generateWorld({ name: welcome.world.name, seed: welcome.world.seed, width, height }), (p) => loading.set(p.stage, p.progress));
      const world = gen.world;
      world.generating = true;
      for (const ch of welcome.chunks) {
        try {
          applyChunkRecord(world, decodeChunkRecord('net', ch));
        } catch (e) {
          console.warn('[Net] bad chunk from server', e);
        }
      }
      world.generating = false;
      world.recomputeSkyTop();
      world.chests.clear();
      for (const ch of welcome.chests) world.chests.set(world.chestKey(ch.x, ch.y), ch);
      for (const pt of welcome.paintings ?? []) applyRemotePainting(world, pt);
      const state = defaultWorldState();
      state.time = welcome.time;
      state.day = welcome.day;
      state.flags = welcome.flags;
      state.spawnX = welcome.spawnX;
      state.spawnY = welcome.spawnY;
      state.structures = gen.structures;
      state.chests = welcome.chests;
      state.paintings = [...world.paintings.values()];
      const record: WorldRecord = {
        id: `net:${url}`,
        meta: { id: `net:${url}`, name: welcome.world.name, seed: welcome.world.seed, size, width, height, createdAt: Date.now(), lastPlayed: Date.now(), version: 1, bossesDefeated: 0, unsealed: false },
        state,
      };
      net.initialPlayers = players;
      this.ui.clearAll();
      this.session = new GameSession({ host: this, world, record, character: c, net });
    } catch (err) {
      await this.ui.alert('Multiplayer', (err as Error).message);
      this.showMultiplayer(c);
    } finally {
      this.busy = false;
    }
  }

  exitToMenu(): void {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    this.ui.clearAll();
    this.showTitle();
  }

  // ---------------- Loop ----------------
  private update(): void {
    if (this.session) this.session.update();
    else {
      this.menuTick++;
      this.menuTime.update();
      this.input.endTick();
    }
  }

  private render(): void {
    if (this.session) {
      this.session.render(this.g, this.dpr);
      return;
    }
    // Animated title backdrop: drifting parallax through the biomes with a fast day/night cycle.
    const cam = this.menuCam;
    cam.viewW = this.canvas.width / this.dpr;
    cam.viewH = this.canvas.height / this.dpr;
    cam.zoom = 2;
    cam.x = this.menuTick * 0.6;
    cam.y = 150 * 16;
    const biome = this.menuBiomes[Math.floor(this.menuTick / 900) % this.menuBiomes.length];
    this.menuBg.setBiome(biome);
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.menuBg.render(this.g, cam, this.menuTime, 150 - 8, 10000, skyLight(this.menuTime.daylight), null);
    this.g.fillStyle = 'rgba(10,6,16,0.35)';
    this.g.fillRect(0, 0, cam.viewW, cam.viewH);
  }
}
