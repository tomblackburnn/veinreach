/**
 * The GameContext is the service locator handed to entities and systems each
 * tick. It is an interface (type-only imports) so entity modules never import
 * the concrete GameSession, which keeps the dependency graph acyclic.
 */
import type { World } from '../world/World';
import type { EntityManager } from '../entities/EntityManager';
import type { ParticleSystem } from '../particles/ParticleSystem';
import type { FloatingText } from '../particles/FloatingText';
import type { AudioManager } from '../audio/AudioManager';
import type { Camera } from '../engine/Camera';
import type { InputManager } from '../engine/InputManager';
import type { TimeSystem } from '../systems/TimeSystem';
import type { ProgressionSystem } from '../systems/ProgressionSystem';
import type { MiningSystem } from '../systems/MiningSystem';
import type { EventBus } from './EventBus';
import type { SettingsData } from './Settings';
import type { Player } from '../entities/player/Player';
import type { ItemStack } from '../items/ItemStack';
import type { Projectile, ProjectileSpawn } from '../entities/Projectile';
import type { Enemy } from '../entities/enemies/Enemy';
import type { BossManager } from '../entities/bosses/BossManager';
import type { WorldEventSystem } from '../systems/WorldEventSystem';
import type { WeatherSystem } from '../systems/WeatherSystem';
import type { NPCManager } from '../entities/npcs/NPCManager';
import type { ChestData } from '../world/WorldState';
import type { NPC } from '../entities/npcs/NPC';
import type { LightingSystem } from '../lighting/LightingSystem';

export interface GameEvents {
  message: { text: string; color?: string };
  flagSet: { flag: string };
  bossSpawned: { id: string; name: string; title: string };
  bossDefeated: { id: string; name: string };
  playerDied: { cause: string };
  pickup: { id: string; count: number };
  /** High-level world edits (network sync & autosave triggers). */
  worldEdit: WorldEdit;
  saveRequested: { reason: string };
}

export type WorldEdit =
  | { op: 'break'; x: number; y: number }
  | { op: 'place'; x: number; y: number; tile: number }
  | { op: 'breakWall'; x: number; y: number }
  | { op: 'placeWall'; x: number; y: number; wall: number }
  | { op: 'door'; x: number; y: number; open: boolean }
  | { op: 'liquid'; x: number; y: number; amount: number; type: number };

/** UI callbacks gameplay code may trigger. */
export interface UIHooks {
  openChest(chest: ChestData): void;
  openNPC(npc: NPC): void;
  closeWorldPanels(): void;
  bossIntro(name: string, title: string): void;
  banner(text: string, sub?: string, color?: string): void;
  openGuide(): void;
}

export interface GameContext {
  readonly world: World;
  readonly entities: EntityManager;
  readonly particles: ParticleSystem;
  readonly text: FloatingText;
  readonly audio: AudioManager;
  readonly camera: Camera;
  readonly input: InputManager;
  readonly time: TimeSystem;
  readonly progression: ProgressionSystem;
  readonly mining: MiningSystem;
  readonly bus: EventBus<GameEvents>;
  readonly settings: SettingsData;
  readonly player: Player;
  readonly bosses: BossManager;
  readonly worldEvents: WorldEventSystem;
  readonly weather: WeatherSystem;
  readonly npcs: NPCManager;
  readonly lighting: LightingSystem;
  readonly ui: UIHooks;
  readonly tick: number;
  /** True when this client is connected to a multiplayer server. */
  readonly online: boolean;
  message(text: string, color?: string): void;
  dropItem(stack: ItemStack, x: number, y: number, vx?: number, vy?: number, pickupDelay?: number): void;
  spawnProjectile(id: string, x: number, y: number, vx: number, vy: number, o: ProjectileSpawn): Projectile | null;
  spawnEnemy(id: string, x: number, y: number): Enemy | null;
  shake(amount: number): void;
}
