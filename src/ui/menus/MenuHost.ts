import type { GameHost } from '../../core/GameHost';
import type { CharacterSave, WorldRecord } from '../../save/types';

/** Navigation + actions the menu screens need from the Game. */
export interface MenuHost extends GameHost {
  showTitle(): void;
  showCharacters(next: 'worlds' | 'multiplayer'): void;
  showCharacterCreate(next: 'worlds' | 'multiplayer'): void;
  showWorlds(c: CharacterSave): void;
  showWorldCreate(c: CharacterSave): void;
  showSettings(): void;
  showCredits(): void;
  showMultiplayer(c: CharacterSave): void;
  startWorld(c: CharacterSave, record: WorldRecord, isNew: boolean): void;
  joinServer(c: CharacterSave, url: string): void;
}
