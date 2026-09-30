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
import { WORLD_SIZES, GEN_VERSION, SAVE_VERSION, type WorldSizeKey } from './config';
import { applyChunkRecord, applyExplored, decodeChunkRecord } from '../save/serialization';
import { BackgroundRenderer } from '../rendering/BackgroundRenderer';
import { TimeSystem } from '../systems/TimeSystem';
import { Camera } from '../engine/Camera';
import { skyLight } from '../lighting/LightingSystem';
import type { BiomeKey } from '../data/biomes';
import { NetworkManager, type Connection } from '../multiplayer/NetworkManager';
import { diffSavedWorld, replayUnsealing } from '../multiplayer/worldDiff';
import { applyRoomSnapshot } from '../multiplayer/linkedWorlds';
import { uid } from '../utils/dom';
import type { World } from '../world/World';
import { TileRegistry } from '../world/TileRegistry';
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
  /** Online play needs a signed-in, verified account with a username; otherwise show the sign-in screen. */
  async showMultiplayer(c: CharacterSave): Promise<void> {
    const loading = loadingScreen();
    this.ui.show(loading.el);
    loading.set('Connecting to online services...', 0.3);
    try {
      const acc = await import('../multiplayer/firebase/account');
      const st = await acc.accountState();
      if (!st.signedIn || !st.verified || !st.username) {
        const { accountScreen } = await import('../ui/menus/AccountScreen');
        this.ui.show(accountScreen(this, c, st));
        return;
      }
      const owned = await acc.ownedRooms();
      const act = (fn: () => Promise<unknown>) => async () => {
        try {
          await fn();
        } catch (err) {
          await this.ui.alert('Multiplayer', (err as Error).message);
        }
        void this.showMultiplayer(c);
      };
      this.ui.show(multiplayerScreen(this, c, {
        username: st.username,
        email: st.email,
        owned,
        maxOwned: acc.MAX_OWNED_ROOMS,
        signOut: act(() => acc.signOut()),
        deleteAccount: act(async () => {
          if (!(await this.ui.confirm('Delete account', 'This permanently deletes your account, your username and every online world you own (for all their members). Your single-player characters and worlds are not affected.', true))) return;
          const owned = await acc.ownedRooms();
          await acc.deleteAccount();
          for (const w of owned) await this.unlinkCopy(w.code);
        }),
        deleteWorld: (w) => void act(async () => {
          if (!(await this.ui.confirm('Delete online world', `Permanently delete “${w.name}” (${w.code}) for everyone? This can’t be undone.`, true))) return;
          await acc.deleteOwnedRoom(w);
          await this.unlinkCopy(w.code);
        })(),
      }));
    } catch (err) {
      this.ui.show(multiplayerScreen(this, c, null, `Online play is unavailable: ${(err as Error).message}`));
    }
  }

  // ---------------- Starting a world ----------------
  async startWorld(c: CharacterSave, record: WorldRecord, isNew: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const loading = loadingScreen();
    this.ui.show(loading.el);
    let syncNote: string | null = null;
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
        if (record.meta.onlineCode) syncNote = await this.pullOnlineChanges(record, world, loading);
        if (!record.state.spawnX) {
          record.state.spawnX = gen.spawnX;
          record.state.spawnY = gen.spawnY;
        }
      }
      this.ui.clearAll();
      this.session = new GameSession({ host: this, world, record, character: c });
      if (syncNote) this.session.message(syncNote, '#9fd0ff');
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

  /**
   * Single-player copy of an online world: bring in what others changed online
   * (the host's own offline edits are kept). Returns a note for the player.
   */
  private async pullOnlineChanges(record: WorldRecord, world: World, loading: ReturnType<typeof loadingScreen>): Promise<string> {
    const code = record.meta.onlineCode!;
    loading.set(`Syncing with online world ${code}...`, 0.99);
    try {
      const rooms = await import('../multiplayer/firebase/rooms');
      const snap = await Promise.race([
        rooms.fetchRoomSnapshot(code),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), 12000)),
      ]);
      const n = applyRoomSnapshot(world, record.state, snap);
      return n ? `Synced with online world ${code}: ${n} tile${n === 1 ? '' : 's'} changed by other players.` : `Synced with online world ${code}.`;
    } catch (err) {
      return `Couldn’t reach online world ${code} (${(err as Error).message}). Playing your saved copy; your changes will upload next time you play it online.`;
    }
  }

  /** The host's single-player copy of an online world, if this browser has one. */
  private async linkedCopy(code: string): Promise<WorldRecord | null> {
    try {
      return (await this.saves.listWorlds()).find((w) => w.meta.onlineCode === code) ?? null;
    } catch {
      return null;
    }
  }

  /** An online world was deleted: its single-player copy becomes an ordinary world again. */
  async unlinkCopy(code: string): Promise<void> {
    const rec = await this.linkedCopy(code);
    if (!rec) return;
    rec.meta.onlineCode = undefined;
    rec.state.pendingOnline = undefined;
    await this.saves.saveWorldRecord(rec);
  }

  /** Join a self-hosted Node server. */
  joinServer(c: CharacterSave, url: string): Promise<void> {
    return this.joinWith(c, `Connecting to ${url}...`, `net:${url}`, () => NetworkManager.connect(url, c));
  }

  /** Join an online (Firebase) world by its room code. */
  joinRoom(c: CharacterSave, code: string): Promise<void> {
    return this.joinWith(c, `Joining online world ${code}...`, `room:${code}`, async () => {
      const rooms = await import('../multiplayer/firebase/rooms');
      const conn = await rooms.connectRoom(code, c);
      rooms.rememberRoom(code, conn.welcome.world.name);
      return conn;
    }, code);
  }

  /** Create a brand-new online world, then join it. */
  async createRoom(c: CharacterSave, name: string, seed: string, size: WorldSizeKey): Promise<void> {
    if (this.busy) return;
    const loading = loadingScreen();
    this.ui.show(loading.el);
    loading.set('Creating online world...', 0.1);
    let code: string;
    try {
      const rooms = await import('../multiplayer/firebase/rooms');
      const worldSeed = seed || String(Math.floor(Math.random() * 1e9));
      code = await rooms.createRoom(name, worldSeed, size);
      // The host also gets it in their single-player world list, linked to the online world.
      const id = uid();
      const dims = WORLD_SIZES[size];
      await this.saves.saveWorldRecord({
        id,
        meta: { id, name: name || 'Online World', seed: worldSeed, size, width: dims.width, height: dims.height, createdAt: Date.now(), lastPlayed: Date.now(), version: SAVE_VERSION, genVersion: GEN_VERSION, bossesDefeated: 0, unsealed: false, onlineCode: code },
        state: defaultWorldState(),
      });
    } catch (err) {
      await this.ui.alert('Online world', (err as Error).message);
      this.showMultiplayer(c);
      return;
    }
    await this.joinRoom(c, code);
  }

  /** Put one of this browser's saved worlds online as a new room, then join it. */
  async hostWorld(c: CharacterSave, worldId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const loading = loadingScreen();
    this.ui.show(loading.el);
    let code: string;
    try {
      loading.set('Reading your world...', 0);
      const data = await this.saves.loadWorld(worldId);
      const m = data.record.meta;
      const diff = await diffSavedWorld(data, (stage, p) => loading.set(stage, p * 0.6));
      const rooms = await import('../multiplayer/firebase/rooms');
      loading.set('Creating online world...', 0.62);
      code = await rooms.createRoom(m.name, m.seed, m.size);
      const st = data.record.state;
      await rooms.uploadWorld(code, m.size, { ...diff, chests: st.chests, paintings: st.paintings, flags: st.flags, time: st.time, day: st.day }, (p) => loading.set(`Uploading ${diff.tiles.length / 5} changed tiles...`, 0.62 + p * 0.38));
      // This save now is the host's single-player copy of the online world.
      data.record.meta.onlineCode = code;
      data.record.state.pendingOnline = undefined;
      await this.saves.saveWorldRecord(data.record);
    } catch (err) {
      console.error('[Game] hosting failed', err);
      await this.ui.alert('Host online', (err as Error).message);
      this.showMultiplayer(c);
      return;
    } finally {
      this.busy = false;
    }
    await this.joinRoom(c, code);
  }

  /**
   * Shared join flow: handshake, regenerate the world from its seed, replay
   * the Unsealing if needed, then apply everything other players changed.
   */
  private async joinWith(c: CharacterSave, label: string, id: string, connect: () => Promise<Connection>, roomCode?: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const loading = loadingScreen();
    this.ui.show(loading.el);
    loading.set(label, 0);
    let net: NetworkManager | null = null;
    try {
      const conn = await connect();
      net = conn.net;
      const { welcome, players } = conn;
      const size = welcome.world.size in WORLD_SIZES ? welcome.world.size : 'medium';
      const { width, height } = WORLD_SIZES[size];
      const gen = await runSliced(generateWorld({ name: welcome.world.name, seed: welcome.world.seed, width, height }), (p) => loading.set(p.stage, p.progress));
      const world = gen.world;
      if (welcome.flags.includes('unsealed')) {
        loading.set('Replaying the Unsealing', 0.99);
        replayUnsealing(world, welcome.world.seed);
      }
      world.generating = true;
      for (const ch of welcome.chunks) {
        try {
          applyChunkRecord(world, decodeChunkRecord('net', ch));
        } catch (e) {
          console.warn('[Net] bad chunk from server', e);
        }
      }
      const t = welcome.tiles ?? [];
      for (let i = 0; i + 4 < t.length; i += 5) {
        world.setFg(t[i], t[i + 1], t[i + 2], t[i + 3]);
        world.setWall(t[i], t[i + 1], t[i + 4]);
      }
      const lq = welcome.liquids ?? [];
      for (let i = 0; i + 3 < lq.length; i += 4) world.setLiquid(lq[i], lq[i + 1], lq[i + 2], lq[i + 3]);
      world.generating = false;
      world.recomputeSkyTop();
      if (welcome.chunks.length) world.chests.clear(); // the Node server sends every chest
      for (const ch of welcome.chests) world.chests.set(world.chestKey(ch.x, ch.y), ch);
      // Chests that were broken lose their contents; newly placed ones start empty.
      const chestId = TileRegistry.id('chest');
      for (const [k, ch] of world.chests) if (world.getFg(ch.x, ch.y) !== chestId) world.chests.delete(k);
      for (let i = 0; i + 4 < t.length; i += 5) {
        if (t[i + 2] === chestId && t[i + 3] === 0 && !world.chests.has(world.chestKey(t[i], t[i + 1]))) world.chests.set(world.chestKey(t[i], t[i + 1]), { x: t[i], y: t[i + 1], items: new Array(40).fill(null) });
      }
      for (const pt of welcome.paintings ?? []) applyRemotePainting(world, pt);
      // Chunks with online edits count as modified (the host's copy saves them).
      for (let i = 0; i + 4 < t.length; i += 5) world.markModified(t[i], t[i + 1]);
      for (let i = 0; i + 3 < lq.length; i += 4) world.markModified(lq[i], lq[i + 1]);
      const linked = roomCode ? await this.linkedCopy(roomCode) : null;
      const state = defaultWorldState();
      state.time = welcome.time;
      state.day = welcome.day;
      state.flags = welcome.flags;
      state.spawnX = welcome.spawnX >= 0 ? welcome.spawnX : gen.spawnX;
      state.spawnY = welcome.spawnY >= 0 ? welcome.spawnY : gen.spawnY;
      state.structures = gen.structures;
      state.chests = [...world.chests.values()];
      state.paintings = [...world.paintings.values()];
      if (linked) {
        // The host's townsfolk, beds and last position come from their copy.
        state.npcs = linked.state.npcs;
        state.playerSpawns = linked.state.playerSpawns;
        state.playerPositions = linked.state.playerPositions;
      }
      const record: WorldRecord = {
        id,
        meta: { id, name: welcome.world.name, seed: welcome.world.seed, size, width, height, createdAt: Date.now(), lastPlayed: Date.now(), version: 1, bossesDefeated: 0, unsealed: welcome.flags.includes('unsealed') },
        state,
      };
      net.initialPlayers = players;
      this.ui.clearAll();
      this.session = new GameSession({ host: this, world, record, character: c, net, linked });
      if (roomCode) this.session.message(`Online world code: ${roomCode} — share it so friends can join.`, '#9fd0ff');
      net = null;
    } catch (err) {
      net?.disconnect();
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
