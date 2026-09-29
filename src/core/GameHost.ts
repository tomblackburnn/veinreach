import type { InputManager } from '../engine/InputManager';
import type { AudioManager } from '../audio/AudioManager';
import type { SettingsData } from './Settings';
import type { SaveManager } from '../save/SaveManager';
import type { UIManager } from '../ui/UIManager';

/** Services the top-level Game provides to a running GameSession. */
export interface GameHost {
  readonly canvas: HTMLCanvasElement;
  readonly input: InputManager;
  readonly audio: AudioManager;
  readonly settings: SettingsData;
  readonly saves: SaveManager;
  readonly ui: UIManager;
  readonly dpr: number;
  saveSettings(): void;
  applySettings(): void;
  exitToMenu(): void;
  fps(): number;
  frameCost(): number;
}
