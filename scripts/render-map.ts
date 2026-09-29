/** Dev utility: generate a world and write its map as a PPM image. Usage: tsx scripts/render-map.ts <seed> <size> <out.ppm> */
import { writeFileSync } from 'node:fs';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { TileRegistry } from '../src/world/TileRegistry';
import { WORLD_SIZES, type WorldSizeKey } from '../src/core/config';
import { hexToRgb } from '../src/utils/color';

const seed = process.argv[2] ?? 'veinreach';
const size = (process.argv[3] ?? 'medium') as WorldSizeKey;
const out = process.argv[4] ?? 'map.ppm';
const { width, height } = WORLD_SIZES[size];
const t0 = performance.now();
const { world } = generateWorldSync({ name: 'map', seed, width, height });
console.log(`generated ${width}x${height} in ${(performance.now() - t0).toFixed(0)}ms`);
const buf = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3;
    const fg = world.getFg(x, y);
    const liq = world.getLiquid(x, y);
    let c: [number, number, number];
    if (fg) c = hexToRgb(TileRegistry.get(fg).mapColor);
    else if (liq) c = world.getLiquidType(x, y) === 2 ? [255, 90, 20] : [40, 90, 200];
    else if (world.getWall(x, y)) c = hexToRgb(TileRegistry.wall(world.getWall(x, y)).mapColor);
    else c = y < world.layers.undergroundY ? [140, 190, 230] : [20, 15, 20];
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
  }
}
writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), buf]));
console.log('chests', world.chests.size, 'structures', world.structures.map((s) => s.kind).join(','));
