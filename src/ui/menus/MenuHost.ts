import type { GameHost } from '../../core/GameHost';
import type { CharacterSave, WorldRecord } from '../../save/types';
import type { WorldSizeKey } from '../../core/config';

/**
 * Where to go after a character is chosen: the world list, the multiplayer
 * screen, or straight into a specific world picked from the Worlds menu.
 */
export type CharacterNext = 'worlds' | 'multiplayer' | { world: WorldRecord; isNew: boolean };

/** Navigation + actions the menu screens need from the Game. */
export interface MenuHost extends GameHost {
  showTitle(): void;
  showCharacters(next: CharacterNext): void;
  showCharacterCreate(next: CharacterNext): void;
  /** World list; `c` is null when browsing worlds from the main menu. */
  showWorlds(c: CharacterSave | null): void;
  showWorldCreate(c: CharacterSave | null): void;
  showSettings(): void;
  showCredits(): void;
  showMultiplayer(c: CharacterSave): void;
  startWorld(c: CharacterSave, record: WorldRecord, isNew: boolean): void;
  joinServer(c: CharacterSave, url: string): void;
  joinRoom(c: CharacterSave, code: string): void;
  createRoom(c: CharacterSave, name: string, seed: string, size: WorldSizeKey): void;
  hostWorld(c: CharacterSave, worldId: string): void;
}
