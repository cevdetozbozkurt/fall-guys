/** Shared route geometry. Simulation coordinates use +z as forward. */
export type RoutePoint = { x: number; z: number; progress: number };
export type RouteLane = { id: string; points: readonly RoutePoint[] };
export type RouteGate = {
  x: number;
  z: number;
  yaw: number;
  progress: number;
  halfWidth: number;
};
export type RouteCourse = {
  length: number;
  routes?: readonly RouteLane[];
};
export type RouteFrame = { x: number; z: number; yaw?: number };
export type RouteSample = RoutePoint & {
  yaw: number;
  lane: string;
  segment: number;
};
export type RouteProjection = RouteSample & {
  /** Euclidean distance to the selected centerline in world units. */
  distance: number;
  /** Signed distance to the right of the selected segment's forward axis. */
  lateral: number;
};

export const ROUTE_BACK_WINDOW = 10;
export const ROUTE_FORWARD_WINDOW = 14;
export const ROUTE_LANE_HYSTERESIS = 0.65;
const EPSILON = 1e-7;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** The shortest signed angle in [-PI, PI]. */
export function wrapAngle(angle: number): number {
  return Number.isFinite(angle)
    ? Math.atan2(Math.sin(angle), Math.cos(angle))
    : 0;
}

/** Convert a world-space point to the frame's lateral/forward coordinates. */
export function toLocal(frame: RouteFrame, x: number, z: number) {
  const yaw = frame.yaw ?? 0;
  const sin = Math.sin(yaw),
    cos = Math.cos(yaw);
  const dx = x - frame.x,
    dz = z - frame.z;
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
}

/** Convert frame-local lateral/forward coordinates into world coordinates. */
export function toWorld(frame: RouteFrame, x: number, z: number) {
  const yaw = frame.yaw ?? 0;
  const sin = Math.sin(yaw),
    cos = Math.cos(yaw);
  return {
    x: frame.x + x * cos + z * sin,
    z: frame.z - x * sin + z * cos,
  };
}

/** Camera-relative input becomes a bounded world-space direction for networking. */
export function cameraInput(x: number, z: number, yaw: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const length = Math.max(1, Math.hypot(x, z));
  return toWorld({ x: 0, z: 0, yaw: wrapAngle(yaw) }, x / length, z / length);
}

type Segment = {
  a: RoutePoint;
  b: RoutePoint;
  lane: string;
  segment: number;
  yaw: number;
};

// Course routes are immutable after construction. Replacing the routes array
// invalidates this cache; hot simulation ticks do not rebuild segment tables.
const segmentCache = new WeakMap<
  RouteCourse,
  {
    routes: RouteCourse['routes'];
    length: number;
    segments: Segment[];
  }
>();

function segmentsOf(course: RouteCourse): Segment[] {
  const cached = segmentCache.get(course);
  if (
    cached &&
    cached.routes === course.routes &&
    cached.length === course.length
  )
    return cached.segments;
  const segments: Segment[] = [];
  for (const lane of course.routes ?? []) {
    for (let i = 0; i + 1 < lane.points.length; i++) {
      const a = lane.points[i],
        b = lane.points[i + 1];
      if (
        ![a.x, a.z, a.progress, b.x, b.z, b.progress].every(Number.isFinite) ||
        b.progress - a.progress <= EPSILON ||
        Math.hypot(b.x - a.x, b.z - a.z) <= EPSILON
      )
        continue;
      segments.push({
        a,
        b,
        lane: lane.id,
        segment: i,
        yaw: Math.atan2(b.x - a.x, b.z - a.z),
      });
    }
  }
  if (segments.length === 0) {
    const length = Number.isFinite(course.length)
      ? Math.max(1, course.length)
      : 1;
    segments.push({
      a: { x: 0, z: 0, progress: 0 },
      b: { x: 0, z: length, progress: length },
      lane: 'main',
      segment: 0,
      yaw: 0,
    });
  }
  segmentCache.set(course, {
    routes: course.routes,
    length: course.length,
    segments,
  });
  return segments;
}

function sample(segment: Segment, progress: number): RouteSample {
  const t = clamp(
    (progress - segment.a.progress) / (segment.b.progress - segment.a.progress),
    0,
    1,
  );
  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    z: segment.a.z + (segment.b.z - segment.a.z) * t,
    progress:
      segment.a.progress + (segment.b.progress - segment.a.progress) * t,
    yaw: segment.yaw,
    lane: segment.lane,
    segment: segment.segment,
  };
}

/**
 * Sample the course at normalized progress. Branches share progress intervals,
 * while the length of each branch may differ. At a vertex, prefer its departing
 * segment. If a previous branch has ended, selection continues on the next lane.
 */
export function routeAt(
  course: RouteCourse,
  progress: number,
  lane?: string,
): RouteSample {
  const segments = segmentsOf(course);
  const minimum = Math.min(...segments.map((s) => s.a.progress));
  const maximum = Math.max(...segments.map((s) => s.b.progress));
  const p = clamp(
    Number.isFinite(progress) ? progress : minimum,
    minimum,
    maximum,
  );
  let candidates = segments.filter(
    (s) => s.a.progress <= p + EPSILON && p < s.b.progress - EPSILON,
  );
  if (candidates.length === 0)
    candidates = segments.filter(
      (s) => s.a.progress <= p + EPSILON && p <= s.b.progress + EPSILON,
    );
  // Invalid/discontinuous input still returns a finite nearest endpoint.
  if (candidates.length === 0)
    candidates = [...segments].sort(
      (a, b) =>
        Math.min(Math.abs(p - a.a.progress), Math.abs(p - a.b.progress)) -
        Math.min(Math.abs(p - b.a.progress), Math.abs(p - b.b.progress)),
    );
  return sample(candidates.find((s) => s.lane === lane) ?? candidates[0], p);
}

/**
 * Project only onto the nearby progress window. A later switchback that passes
 * close in world space cannot teleport progress across the course. Reset the
 * caller's previousProgress when explicitly respawning at a checkpoint.
 * lanePreference adds a small spatial hysteresis, not an unbreakable lane lock.
 */
export function projectRoute(
  course: RouteCourse,
  x: number,
  z: number,
  previousProgress: number,
  lanePreference?: string,
): RouteProjection {
  const previous = routeAt(course, previousProgress, lanePreference).progress;
  const minimum = previous - ROUTE_BACK_WINDOW;
  const maximum = previous + ROUTE_FORWARD_WINDOW;
  const candidates: RouteProjection[] = [];
  for (const segment of segmentsOf(course)) {
    const start = Math.max(minimum, segment.a.progress);
    const end = Math.min(maximum, segment.b.progress);
    if (end < start - EPSILON) continue;
    const a = sample(segment, start),
      b = sample(segment, end);
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t =
      lengthSquared > EPSILON
        ? clamp(((x - a.x) * dx + (z - a.z) * dz) / lengthSquared, 0, 1)
        : 0;
    const point = sample(segment, start + (end - start) * t);
    const offsetX = x - point.x,
      offsetZ = z - point.z;
    candidates.push({
      ...point,
      distance: Math.hypot(offsetX, offsetZ),
      lateral: offsetX * Math.cos(point.yaw) - offsetZ * Math.sin(point.yaw),
    });
  }
  if (!Number.isFinite(x) || !Number.isFinite(z) || candidates.length === 0) {
    const point = routeAt(course, previous, lanePreference);
    return { ...point, distance: 0, lateral: 0 };
  }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      Math.abs(a.progress - previous) - Math.abs(b.progress - previous),
  );
  const nearest = candidates[0];
  const preferred = candidates.find((p) => p.lane === lanePreference);
  return preferred &&
    preferred.distance <= nearest.distance + ROUTE_LANE_HYSTERESIS
    ? preferred
    : nearest;
}
