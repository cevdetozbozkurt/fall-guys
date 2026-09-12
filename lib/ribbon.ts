/** Flat, continuous visual surfaces over the existing paved collision slabs. */
export type RibbonPoint = { x: number; z: number; yaw?: number };
export type CourseRibbon = {
  points: RibbonPoint[];
  width: number;
  y: number;
};
type Point3 = [number, number, number];

/** Rounded quadratic corner arcs used by both collision slabs and route guidance. */
export function roundPath<
  T extends { x: number; z: number; progress?: number },
>(points: T[]) {
  const result: { x: number; z: number; progress?: number }[] = [points[0]];
  const mix = (a: T, b: T, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    ...(a.progress !== undefined && b.progress !== undefined
      ? { progress: a.progress + (b.progress - a.progress) * t }
      : {}),
  });
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const incoming = Math.hypot(b.x - a.x, b.z - a.z),
      outgoing = Math.hypot(c.x - b.x, c.z - b.z);
    const trim = Math.min(6, incoming * 0.3, outgoing * 0.3);
    const start = mix(a, b, 1 - trim / incoming),
      end = mix(b, c, trim / outgoing);
    for (let n = 0; n <= 12; n++) {
      const t = n / 12,
        u = 1 - t;
      result.push({
        x: u * u * start.x + 2 * u * t * b.x + t * t * end.x,
        z: u * u * start.z + 2 * u * t * b.z + t * t * end.z,
        ...(b.progress !== undefined
          ? {
              progress:
                u * u * start.progress! +
                2 * u * t * b.progress +
                t * t * end.progress!,
            }
          : {}),
      });
    }
  }
  result.push(points.at(-1)!);
  return result;
}
export type RibbonMeshData = {
  positions: number[];
  normals: number[];
  indices: number[];
  topIndexCount: number;
};

/** Right-facing offset vectors; explicit tangents preserve analytic arc edges. */
function ribbonFrames(points: readonly RibbonPoint[]) {
  if (points.length < 2) throw new Error('A ribbon needs at least two points');
  return points.map((point, i) => {
    if (point.yaw !== undefined)
      return { x: Math.cos(point.yaw), z: -Math.sin(point.yaw) };
    const before = points[Math.max(0, i - 1)],
      after = points[Math.min(points.length - 1, i + 1)];
    const incomingLength = Math.hypot(point.x - before.x, point.z - before.z);
    const outgoingLength = Math.hypot(after.x - point.x, after.z - point.z);
    const incoming =
      incomingLength > 1e-8
        ? {
            x: (point.z - before.z) / incomingLength,
            z: -(point.x - before.x) / incomingLength,
          }
        : null;
    const outgoing =
      outgoingLength > 1e-8
        ? {
            x: (after.z - point.z) / outgoingLength,
            z: -(after.x - point.x) / outgoingLength,
          }
        : null;
    if (!incoming && !outgoing)
      throw new Error('A ribbon contains duplicate points');
    if (!incoming) return outgoing!;
    if (!outgoing) return incoming;
    const x = incoming.x + outgoing.x,
      z = incoming.z + outgoing.z;
    const length = Math.hypot(x, z);
    const denominator =
      length > 1e-8 ? (x * outgoing.x + z * outgoing.z) / length : 0;
    // Sharp paths must have matching rounded colliders before they use ribbons.
    if (denominator < 0.8) throw new Error('A ribbon join is too sharp');
    return { x: x / length / denominator, z: z / length / denominator };
  });
}

export function ribbonEdges(
  ribbon: CourseRibbon,
  width = ribbon.width,
  offset = 0,
) {
  const frames = ribbonFrames(ribbon.points);
  const edge = (side: number) =>
    ribbon.points.map((point, i) => ({
      x: point.x + frames[i].x * (offset + (side * width) / 2),
      z: point.z + frames[i].z * (offset + (side * width) / 2),
    }));
  return { left: edge(-1), right: edge(1) };
}

/** One exterior polygon, without the internal rectangle outlines. */
export function ribbonFootprint(ribbon: CourseRibbon) {
  const { left, right } = ribbonEdges(ribbon);
  return [...left, ...right.reverse()];
}

/**
 * Indexed, closed strip geometry in Three.js coordinates (+simulation z => -z).
 * The same helper builds the road and its slim continuous raised edge strips.
 */
export function buildRibbonGeometry(
  ribbon: CourseRibbon,
  options: {
    width?: number;
    offset?: number;
    top?: number;
    depth?: number;
  } = {},
): RibbonMeshData {
  const { left, right } = ribbonEdges(
    ribbon,
    options.width ?? ribbon.width,
    options.offset ?? 0,
  );
  const top = options.top ?? ribbon.y - 0.035,
    bottom = top - (options.depth ?? 0.85);
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  const position = (point: { x: number; z: number }, y: number): Point3 => [
    point.x,
    y,
    -point.z,
  ];
  const quad = (a: Point3, b: Point3, c: Point3, d: Point3) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-10) throw new Error('A ribbon face has no area');
    const base = positions.length / 3;
    for (const p of [a, b, c, d]) {
      positions.push(...p);
      normals.push(nx / length, ny / length, nz / length);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let i = 0; i + 1 < left.length; i++)
    quad(
      position(left[i], top),
      position(right[i], top),
      position(right[i + 1], top),
      position(left[i + 1], top),
    );
  const topIndexCount = indices.length;
  for (let i = 0; i + 1 < left.length; i++) {
    quad(
      position(left[i], top),
      position(left[i + 1], top),
      position(left[i + 1], bottom),
      position(left[i], bottom),
    );
    quad(
      position(right[i + 1], top),
      position(right[i], top),
      position(right[i], bottom),
      position(right[i + 1], bottom),
    );
    quad(
      position(left[i + 1], bottom),
      position(right[i + 1], bottom),
      position(right[i], bottom),
      position(left[i], bottom),
    );
  }
  quad(
    position(right[0], top),
    position(left[0], top),
    position(left[0], bottom),
    position(right[0], bottom),
  );
  const end = left.length - 1;
  quad(
    position(left[end], top),
    position(right[end], top),
    position(right[end], bottom),
    position(left[end], bottom),
  );
  return { positions, normals, indices, topIndexCount };
}
