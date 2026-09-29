/** Keyboard/mouse state with rebindable actions. */
export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'inventory'
  | 'pause'
  | 'map'
  | 'quickHeal'
  | 'quickMana'
  | 'smartCursor'
  | 'modifier'
  | 'chat'
  | 'debug'
  | 'drop'
  | 'zoomIn'
  | 'zoomOut';

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  inventory: ['KeyE', 'Tab'],
  pause: ['Escape'],
  map: ['KeyM'],
  quickHeal: ['KeyH'],
  quickMana: ['KeyJ'],
  smartCursor: ['ControlLeft', 'ControlRight'],
  modifier: ['ShiftLeft', 'ShiftRight'],
  chat: ['Enter'],
  debug: ['Backquote'],
  drop: ['KeyQ'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
};

export const ACTION_LABELS: Record<Action, string> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Climb up',
  down: 'Drop / climb down',
  jump: 'Jump',
  inventory: 'Inventory',
  pause: 'Pause / close',
  map: 'World map',
  quickHeal: 'Quick heal',
  quickMana: 'Quick mana',
  smartCursor: 'Smart cursor (hold)',
  modifier: 'Modifier',
  chat: 'Chat (multiplayer)',
  debug: 'Debug console',
  drop: 'Drop held item',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
};

export class InputManager {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  bindings: Record<Action, string[]> = structuredClone(DEFAULT_BINDINGS);

  mouseX = 0;
  mouseY = 0;
  mouseLeft = false;
  mouseRight = false;
  leftPressed = false;
  rightPressed = false;
  wheel = 0;
  /** True while the pointer is over the game canvas (not over UI panels). */
  overCanvas = true;
  /** Suspend game input (e.g. while typing in a text field). */
  typing = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mouseenter', () => (this.overCanvas = true));
    canvas.addEventListener('mouseleave', () => (this.overCanvas = false));
  }

  private isTextTarget(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.isTextTarget(e)) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.released.add(e.code);
  };

  private onBlur = (): void => {
    this.down.clear();
    this.mouseLeft = false;
    this.mouseRight = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - r.left;
    this.mouseY = e.clientY - r.top;
    this.overCanvas = e.target === this.canvas;
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.onMouseMove(e);
    if (e.button === 0) {
      this.mouseLeft = true;
      this.leftPressed = true;
    } else if (e.button === 2) {
      this.mouseRight = true;
      this.rightPressed = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeft = false;
    else if (e.button === 2) this.mouseRight = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheel += Math.sign(e.deltaY);
  };

  isDown(a: Action): boolean {
    if (this.typing) return false;
    return this.bindings[a].some((c) => this.down.has(c));
  }

  wasPressed(a: Action): boolean {
    if (this.typing) return false;
    return this.bindings[a].some((c) => this.pressed.has(c));
  }

  wasReleased(a: Action): boolean {
    return this.bindings[a].some((c) => this.released.has(c));
  }

  codePressed(code: string): boolean {
    return !this.typing && this.pressed.has(code);
  }

  /** Hotbar number key pressed this tick (0-9) or -1. */
  hotbarPressed(): number {
    if (this.typing) return -1;
    for (let i = 0; i < 10; i++) if (this.pressed.has(`Digit${(i + 1) % 10}`)) return i;
    return -1;
  }

  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Call after each simulation tick. */
  endTick(): void {
    this.pressed.clear();
    this.released.clear();
    this.leftPressed = false;
    this.rightPressed = false;
  }

  releaseMouse(): void {
    this.mouseLeft = false;
    this.mouseRight = false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
