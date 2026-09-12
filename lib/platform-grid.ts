import type { Platform } from './courses.ts';
const grids = new WeakMap<Platform[], Map<string, number[]>>();
const cellSize = 16;
/** Static broad phase: dense rounded courses only test nearby floor pieces. */
export function nearbyPlatforms(
  platforms: Platform[],
  x: number,
  z: number,
): readonly number[] {
  let grid = grids.get(platforms);
  if (!grid) {
    grid = new Map();
    for (const [index, p] of platforms.entries()) {
      const c = Math.abs(Math.cos(p.yaw ?? 0)),
        s = Math.abs(Math.sin(p.yaw ?? 0));
      const halfX = (c * p.w + s * p.d) / 2 + 0.12;
      const halfZ = (s * p.w + c * p.d) / 2 + 0.12;
      for (
        let gx = Math.floor((p.x - halfX) / cellSize);
        gx <= Math.floor((p.x + halfX) / cellSize);
        gx++
      )
        for (
          let gz = Math.floor((p.z - halfZ) / cellSize);
          gz <= Math.floor((p.z + halfZ) / cellSize);
          gz++
        ) {
          const key = `${gx},${gz}`,
            indices = grid.get(key) ?? [];
          indices.push(index);
          grid.set(key, indices);
        }
    }
    grids.set(platforms, grid);
  }
  return (
    grid.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? []
  );
}
