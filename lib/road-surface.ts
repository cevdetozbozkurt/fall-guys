import polygonClipping, {
  type Polygon,
  type MultiPolygon,
} from 'polygon-clipping';
import type { Course, Platform } from './courses.ts';
import { ribbonEdges } from './ribbon.ts';
import { toWorld } from './routes.ts';

export const isGroundDeck = (p: Platform) =>
  p.ribbon === undefined && !p.kind && (p.y ?? 0) === 0 && (p.endY ?? 0) === 0;
const cache = new WeakMap<Course, MultiPolygon>();
/** Union the visible road before drawing its border: interior joins have no walls or rails. */
export function roadSurface(course: Course): MultiPolygon {
  const cached = cache.get(course);
  if (cached) return cached;
  const ends: { x: number; z: number; width: number; owner: object }[] = [];
  for (const r of course.ribbons ?? [])
    for (const p of [r.points[0], r.points.at(-1)!])
      ends.push({ ...p, width: r.width, owner: r });
  for (const p of course.platforms)
    if (p.ribbon === undefined)
      for (const sign of [-1, 1]) {
        const y = sign < 0 ? (p.y ?? 0) : (p.endY ?? p.y ?? 0);
        if (y === 0)
          ends.push({
            ...toWorld(p, 0, (sign * p.d) / 2),
            width: p.w,
            owner: p,
          });
      }
  const joinedWidth = (
    point: { x: number; z: number },
    width: number,
    owner: object,
  ) =>
    Math.min(
      width,
      ...ends
        .filter(
          (e) =>
            e.owner !== owner &&
            Math.hypot(e.x - point.x, e.z - point.z) < 0.02,
        )
        .map((e) => e.width),
    );
  const polygons: Polygon[] = (course.ribbons ?? []).map((r) => {
    const first = joinedWidth(r.points[0], r.width, r),
      last = joinedWidth(r.points.at(-1)!, r.width, r);
    const distances = r.points.map((p, i) =>
      i ? Math.hypot(p.x - r.points[i - 1].x, p.z - r.points[i - 1].z) : 0,
    );
    const total = distances.reduce((a, b) => a + b, 0);
    let distance = 0;
    const edges = ribbonEdges(r);
    const sides = [edges.left, edges.right].map((edge) =>
      edge.map((p, i) => {
        if (edge === edges.left) distance += distances[i];
        // Compute arc distance independently for each edge.
        const along =
          edge === edges.left
            ? distance
            : distances.slice(0, i + 1).reduce((a, b) => a + b, 0);
        const width = Math.min(
          r.width,
          first + (r.width - first) * Math.min(1, along / 4),
          last + (r.width - last) * Math.min(1, (total - along) / 4),
        );
        return [
          r.points[i].x + ((p.x - r.points[i].x) * width) / r.width,
          r.points[i].z + ((p.z - r.points[i].z) * width) / r.width,
        ] as [number, number];
      }),
    );
    return [[...sides[0], ...sides[1].reverse()]];
  });
  for (const p of course.platforms.filter(isGroundDeck)) {
    const first = joinedWidth(toWorld(p, 0, -p.d / 2), p.w, p),
      last = joinedWidth(toWorld(p, 0, p.d / 2), p.w, p),
      taper = Math.min(4, p.d / 3),
      bodyWidth = p.d <= 9 ? Math.max(first, last) : p.w;
    polygons.push([
      [
        [-first / 2, -p.d / 2],
        [first / 2, -p.d / 2],
        [bodyWidth / 2, -p.d / 2 + taper],
        [bodyWidth / 2, p.d / 2 - taper],
        [last / 2, p.d / 2],
        [-last / 2, p.d / 2],
        [-bodyWidth / 2, p.d / 2 - taper],
        [-bodyWidth / 2, -p.d / 2 + taper],
      ].map(([x, z]) => {
        const q = toWorld(p, x, z);
        return [q.x, q.z];
      }),
    ]);
  }
  // Rounding sub-micron noise prevents near-coincident seams at quarter turns.
  for (const polygon of polygons)
    for (const ring of polygon)
      for (const p of ring) {
        p[0] = Math.round(p[0] * 1e6) / 1e6;
        p[1] = Math.round(p[1] * 1e6) / 1e6;
      }
  const result = polygons.length
    ? polygonClipping.union(polygons[0], ...polygons.slice(1))
    : [];
  cache.set(course, result);
  return result;
}
