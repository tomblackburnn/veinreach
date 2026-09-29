import type { AIKind } from '../../../data/enemies';
import type { AIController } from './AIController';
import type { Enemy } from '../Enemy';
import { jumperAI, walkerAI, chargerAI, rollerAI, burrowAmbushAI, climberAI, mimicAI, archerAI } from './ground';
import { flierAI, hoverdiveAI, floaterAI, ghostAI, casterAI } from './air';
import { WormHeadAI } from './worm';

/** AI registry: stateless controllers are shared; stateful ones are created per enemy. */
export function createAI(kind: AIKind, e: Enemy): AIController {
  switch (kind) {
    case 'jumper':
      return jumperAI;
    case 'walker':
      return walkerAI;
    case 'charger':
      return chargerAI;
    case 'roller':
      return rollerAI;
    case 'burrowAmbush':
      return burrowAmbushAI;
    case 'climber':
      return climberAI;
    case 'mimic':
      return mimicAI;
    case 'archer':
      return archerAI;
    case 'flier':
      return flierAI;
    case 'hoverdive':
      return hoverdiveAI;
    case 'floater':
      return floaterAI;
    case 'ghost':
      return ghostAI;
    case 'caster':
      return casterAI;
    case 'worm':
      return new WormHeadAI(e.def.p?.segments ?? 6, 14);
    default:
      console.warn(`[AI] unknown ai ${kind as string}, using walker`);
      return walkerAI;
  }
}
