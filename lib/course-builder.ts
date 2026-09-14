import type { Course, Platform, Obstacle } from './courses.ts';
import { roundPath, type CourseRibbon, type RibbonPoint } from './ribbon.ts';

export const MODULES = [
  {
    key: 'open',
    name: 'Open path',
    hint: 'A wide, safe stretch to pick up speed.',
    color: '#42decf',
  },
  {
    key: 'spin',
    name: 'Spin challenge',
    hint: 'Jump over two sweeping neon arms.',
    color: '#ed72d9',
  },
  {
    key: 'climb',
    name: 'Cosmic climb',
    hint: 'Jump up five ledges, then drop to the landing.',
    color: '#9b91ff',
  },
  {
    key: 'jump',
    name: 'Jump across',
    hint: 'Clear three gaps between floating platforms.',
    color: '#65c8ff',
  },
  {
    key: 'hammer',
    name: 'Hammer trap',
    hint: 'Time your run past swinging hammers.',
    color: '#ffa85f',
  },
  {
    key: 'falling',
    name: 'Meteor shower',
    hint: 'Watch the landing circles; dodge falling objects.',
    color: '#ff6c91',
  },
  {
    key: 'slide',
    name: 'Gravity slide',
    hint: 'Climb a ramp, then steer down a fast, slippery slope.',
    color: '#4fe4fa',
  },
  {
    key: 'drop',
    name: 'Orbital drop',
    hint: 'Take a ramp up, then leap down through a gap.',
    color: '#b68bff',
  },
  {
    key: 'belt',
    name: 'Conveyor dash',
    hint: 'Fight the sideways pull of the conveyor.',
    color: '#66e9a8',
  },
  {
    key: 'crumble',
    name: 'Vanishing tiles',
    hint: 'Cross the tiles before they disappear.',
    color: '#ff87df',
  },
  {
    key: 'left',
    name: 'Left orbit',
    hint: 'Steer through a sweeping left turn with lane blockers.',
    color: '#8f9fff',
  },
  {
    key: 'right',
    name: 'Right orbit',
    hint: 'Follow the neon track around a sweeping right turn.',
    color: '#ff9c63',
  },
  {
    key: 'fork',
    name: 'Risk or cruise',
    hint: 'Left: narrow shortcut with a jump. Right: longer, wider route.',
    color: '#ffe16b',
  },
  {
    key: 'slalom',
    name: 'Serpentine',
    hint: 'Weave left and right around staggered barriers.',
    color: '#65e9c3',
  },
] as const;
export type ModuleKey = (typeof MODULES)[number]['key'];
export const OBSTACLE_TYPES = [
  'bar',
  'hurdle',
  'hammer',
  'falling',
  'bumper',
  'pendulum',
  'pusher',
] as const;
export type ObstaclePlacement = {
  type: (typeof OBSTACLE_TYPES)[number];
  lane: 'main' | 'risk' | 'cruise';
  /** Distance along the chosen route, as a percentage. */
  at: number;
  /** Across the usable lane: -1 left edge, 0 centre, +1 right edge. */
  offset: number;
};
export const MAX_OBSTACLES = 16;
export type Segment = {
  type: ModuleKey;
  difficulty: 1 | 2 | 3;
  obstacles?: ObstaclePlacement[];
};
export type CourseRecipe = { version: 1; name: string; segments: Segment[] };
export const MAX_SEGMENTS = 10;
export const MIN_SEGMENTS = 3;
export const MAX_SAVED_COURSES = 16;
export const MODULE_LENGTH = 40;
export const DEFAULT_RECIPE: CourseRecipe = {
  version: 1,
  name: 'My cosmic course',
  segments: [
    { type: 'open', difficulty: 1 },
    { type: 'spin', difficulty: 1 },
    { type: 'jump', difficulty: 1 },
  ],
};
export function parseRecipe(value: unknown): CourseRecipe | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    typeof v.name !== 'string' ||
    v.name.length > 80 ||
    !Array.isArray(v.segments) ||
    v.segments.length < MIN_SEGMENTS ||
    v.segments.length > MAX_SEGMENTS
  )
    return null;
  const segments: Segment[] = [];
  for (const entry of v.segments) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !MODULES.some((m) => m.key === entry.type) ||
      ![1, 2, 3].includes(entry.difficulty)
    )
      return null;
    if (
      entry.obstacles !== undefined &&
      (!Array.isArray(entry.obstacles) ||
        entry.obstacles.length > MAX_OBSTACLES ||
        entry.obstacles.some(
          (o: ObstaclePlacement) =>
            !o ||
            !OBSTACLE_TYPES.includes(o.type) ||
            !(entry.type === 'fork' ? ['risk', 'cruise'] : ['main']).includes(
              o.lane,
            ) ||
            !Number.isFinite(o.at) ||
            o.at < 5 ||
            o.at > 95 ||
            !Number.isFinite(o.offset) ||
            Math.abs(o.offset) > 1,
        ))
    )
      return null;
    segments.push({
      type: entry.type as ModuleKey,
      difficulty: entry.difficulty as 1 | 2 | 3,
      ...(entry.obstacles !== undefined
        ? {
            obstacles: entry.obstacles.map((o: ObstaclePlacement) => ({
              type: o.type,
              lane: o.lane,
              at: o.at,
              offset: o.offset,
            })),
          }
        : {}),
    });
  }
  const name = v.name
    .replace(/[<>]/g, '')
    .split('')
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 36);
  if (!name) return null;
  return { version: 1, name, segments };
}
export function defaultObstacles(segment: Segment): ObstaclePlacement[] {
  const d = segment.difficulty;
  const row = (
    type: ObstaclePlacement['type'],
    at: number,
    offset = 0,
    lane: ObstaclePlacement['lane'] = 'main',
  ): ObstaclePlacement => ({ type, at, offset, lane });
  const series = (type: ObstaclePlacement['type'], count: number) =>
    Array.from({ length: count }, (_, n) =>
      row(type, 20 + (n * 60) / Math.max(1, count - 1), n % 2 ? 0.4 : -0.4),
    );
  switch (segment.type) {
    case 'spin':
      return series('bar', d + 1);
    case 'hammer':
      return series('hammer', d + 1);
    case 'falling':
      return series('falling', 3 + d);
    case 'slalom':
      return [
        ...series('falling', 3 + d),
        row('hurdle', 38, 0.4),
        row('hurdle', 68, -0.4),
      ];
    case 'left':
    case 'right':
      return series('hurdle', d + 1);
    case 'fork':
      return [
        row('bar', 68, 0, 'risk'),
        ...(d > 1 ? [row('hammer', 29, 0, 'risk')] : []),
        row('hurdle', 55, 0.35, 'cruise'),
      ];
    case 'belt':
      return [row('hurdle', 43)];
    case 'slide':
      return [row('bumper', 88, 0.4)];
    default:
      return [];
  }
}
export function recipeKey(recipe: CourseRecipe) {
  const value = JSON.stringify(recipe);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) + 1000;
}
export function platformHeight(p: Platform, z: number, x = p.x) {
  const start = p.y ?? 0;
  const localZ =
    (x - p.x) * Math.sin(p.yaw ?? 0) + (z - p.z) * Math.cos(p.yaw ?? 0);
  return (
    start +
    ((p.endY ?? start) - start) *
      Math.max(0, Math.min(1, (localZ + p.d / 2) / p.d))
  );
}

// Modules share level entrances and exits, so any valid sequence remains connected.
export function buildCourse(
  recipe: CourseRecipe,
  id = recipeKey(recipe),
): Course {
  const platforms: Platform[] = [{ x: 0, z: 2, w: 16, d: 16 }];
  const ribbons: CourseRibbon[] = [];
  const obstacles: Obstacle[] = [],
    checkpoints: number[] = [];
  const routes: NonNullable<Course['routes']> = [
    {
      id: 'start',
      points: [
        { x: 0, z: -6, progress: -6 },
        { x: 0, z: 10, progress: 10 },
      ],
    },
  ];
  const gates: NonNullable<Course['gates']> = [];
  let origin = { x: 0, z: 10, yaw: 0 },
    cursor = 10;
  const world = (x: number, z: number) => ({
    x: origin.x + x * Math.cos(origin.yaw) + z * Math.sin(origin.yaw),
    z: origin.z - x * Math.sin(origin.yaw) + z * Math.cos(origin.yaw),
  });
  recipe.segments.forEach((segment, i) => {
    const d = segment.difficulty,
      width = 16 - d * 2;
    const localPlatforms: Platform[] = [],
      localObstacles: Obstacle[] = [];
    const localLanes: {
      id: string;
      points: { x: number; z: number; progress: number }[];
    }[] = [];
    const add = (
      start: number,
      end: number,
      w = 14,
      extra: Partial<Platform> = {},
    ) =>
      localPlatforms.push({
        x: 0,
        z: (start + end) / 2,
        w,
        d: end - start,
        ...extra,
      });
    const lane = (
      id: string,
      points: { x: number; z: number; progress: number }[],
    ) => {
      localLanes.push({ id, points });
      routes.push({
        id,
        points: points.map((p) => ({
          ...world(p.x, p.z),
          progress: cursor + p.progress,
        })),
      });
    };
    const pave = (
      points: { x: number; z: number }[],
      w: number,
      options: {
        startCap?: number;
        endCap?: number;
        visual?: RibbonPoint[];
      } = {},
    ) => {
      const ribbon = ribbons.length;
      const visual: RibbonPoint[] = options.visual ?? points;
      ribbons.push({
        width: w,
        y: 0,
        points: visual.map((p) => ({
          ...world(p.x, p.z),
          ...(p.yaw !== undefined ? { yaw: origin.yaw + p.yaw } : {}),
        })),
      });
      for (let n = 1; n < points.length; n++) {
        const a = points[n - 1],
          b = points[n],
          len = Math.hypot(b.x - a.x, b.z - a.z),
          yaw = Math.atan2(b.x - a.x, b.z - a.z);
        const from = -(n === 1 ? (options.startCap ?? 0.55) : 0.55);
        const to =
          len + (n === points.length - 1 ? (options.endCap ?? 0.55) : 0.55);
        localPlatforms.push({
          x: a.x + ((b.x - a.x) * (from + to)) / (2 * len),
          z: a.z + ((b.z - a.z) * (from + to)) / (2 * len),
          w,
          d: to - from,
          yaw,
          ribbon,
        });
      }
    };
    const checkpoint = world(0, 1);
    checkpoints.push(cursor + 1);
    gates.push({
      ...checkpoint,
      yaw: origin.yaw,
      progress: cursor + 1,
      halfWidth:
        (['left', 'right', 'slalom'].includes(segment.type)
          ? 11 - d
          : segment.type === 'fork'
            ? 10
            : ['open', 'spin', 'hammer', 'falling', 'jump', 'drop'].includes(
                  segment.type,
                )
              ? width
              : ['belt', 'slide'].includes(segment.type)
                ? width
                : 14) / 2,
    });
    let end = { x: 0, z: 40 },
      length = 40,
      turn = 0;
    if (segment.type === 'left' || segment.type === 'right') {
      const sign = segment.type === 'left' ? -1 : 1,
        radius = 24;
      length = (radius * Math.PI) / 2;
      const points = Array.from({ length: 13 }, (_, n) => ({
        x: sign * radius * (1 - Math.cos((n * Math.PI) / 24)),
        z: radius * Math.sin((n * Math.PI) / 24),
        progress: (length * n) / 12,
      }));
      pave(points, 11 - d, {
        visual: Array.from({ length: 49 }, (_, n) => ({
          x: sign * radius * (1 - Math.cos((n * Math.PI) / 96)),
          z: radius * Math.sin((n * Math.PI) / 96),
          yaw: (sign * n * Math.PI) / 96,
        })),
      });
      lane('turn-' + i, points);
      for (const n of [4, 8]) {
        const p = points[n],
          yaw = (sign * n * Math.PI) / 24,
          side = n === 4 ? -1 : 1;
        localObstacles.push({
          type: 'hurdle',
          x: p.x + side * 2 * Math.cos(yaw),
          z: p.z - side * 2 * Math.sin(yaw),
          width: 3.1,
          yaw,
        });
      }
      end = points[12];
      turn = (sign * Math.PI) / 2;
    } else if (segment.type === 'fork') {
      length = 76;
      end = { x: 0, z: 76 };
      add(0, 9, 10);
      add(68, 76, 10);
      const hardBefore = roundPath([
        { x: 0, z: 8 },
        { x: -12, z: 24 },
        { x: -12, z: 35.9 },
      ]);
      const hardAfter = roundPath([
        { x: -12, z: 40.1 },
        { x: -12, z: 52 },
        { x: 0, z: 68 },
      ]);
      const hard = [...hardBefore, ...hardAfter];
      const easy = roundPath([
        { x: 0, z: 8 },
        { x: 14, z: 24 },
        { x: 23, z: 37 },
        { x: 23, z: 51 },
        { x: 12, z: 63 },
        { x: 0, z: 68 },
      ]);
      pave(hardBefore, 7 - d * 0.5, { endCap: 0 });
      pave(hardAfter, 7 - d * 0.5, { startCap: 0 });
      pave(easy, 10);
      for (const [name, points] of [
        ['hard', hard],
        ['easy', easy],
      ] as const) {
        const distances = points.map((p, n) =>
            n ? Math.hypot(p.x - points[n - 1].x, p.z - points[n - 1].z) : 0,
          ),
          total = distances.reduce((a, b) => a + b, 0);
        let distance = 0;
        lane('fork-' + i + '-' + name, [
          { x: 0, z: 0, progress: 0 },
          ...points.map((p, n) => {
            distance += distances[n];
            return { ...p, progress: 8 + (distance / total) * 60 };
          }),
          { x: 0, z: 76, progress: 76 },
        ]);
      }
      localObstacles.push(
        { type: 'bar', x: -12, z: 48, radius: 2.9, speed: 0.7 + d * 0.2 },
        { type: 'hurdle', x: 23, z: 44, width: 4, yaw: 0 },
      );
    } else if (segment.type === 'slalom') {
      length = 54;
      end = { x: 0, z: 54 };
      const points = Array.from({ length: 109 }, (_, n) => {
        const t = n / 108;
        return {
          x: -6 * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t) ** 2,
          z: 54 * t,
          yaw: Math.atan2(
            -12 *
              Math.PI *
              (Math.cos(2 * Math.PI * t) * Math.sin(Math.PI * t) ** 2 +
                Math.sin(2 * Math.PI * t) *
                  Math.sin(Math.PI * t) *
                  Math.cos(Math.PI * t)),
            54,
          ),
          progress: 54 * t,
        };
      });
      pave(points, 11 - d);
      lane('slalom-' + i, points);
      localObstacles.push(
        { type: 'hurdle', x: 6, z: 28, width: 3 },
        { type: 'falling', x: -5, z: 43, radius: 1.1, speed: 1, phase: i },
      );
    } else {
      lane('straight-' + i, [
        { x: 0, z: 0, progress: 0 },
        { x: 0, z: 40, progress: 40 },
      ]);
      switch (segment.type) {
        case 'climb':
          add(0, 5);
          for (let step = 1; step <= 5; step++)
            add(5 + (step - 1) * 5, 5 + step * 5, width, { y: step * 1.25 });
          add(30, 40);
          break;
        case 'slide':
          add(0, 4);
          add(4, 16, width, { y: 0, endY: 6 });
          add(16, 32, width, { y: 6, endY: 0, kind: 'slide' });
          add(32, 40);
          localObstacles.push({
            type: 'bumper',
            x: 3,
            z: 35,
            radius: 1,
            speed: 0.6 + d * 0.25,
          });
          break;
        case 'drop':
          add(0, 4);
          add(4, 18, width, { y: 0, endY: 8 });
          add(18, 23, width, { y: 8 });
          add(27, 40, width);
          break;
        case 'jump': {
          let pos = 0;
          for (const end of [9, 21, 33]) {
            add(pos, end, width);
            pos = end + 3 + d * 0.35;
          }
          add(pos, 40, width);
          break;
        }
        case 'crumble':
          add(0, 6);
          for (let z = 6; z < 34; z += 7)
            for (const x of [-4, 0, 4])
              add(z, z + 7, 4, { x, kind: 'crumble' });
          add(34, 40);
          break;
        case 'belt':
          add(0, 5);
          add(5, 34, width, { kind: 'belt', direction: i % 2 ? 1 : -1 });
          add(34, 40);
          localObstacles.push({
            type: 'hurdle',
            x: 0,
            z: 17,
            width: width - 3,
          });
          break;
        default:
          add(0, 40, width);
          if (segment.type === 'spin')
            for (const [n, z] of [14, 29].entries())
              localObstacles.push({
                type: 'bar',
                x: n ? 1 : -1,
                z,
                radius: width / 2 - 1,
                speed: (0.65 + d * 0.25) * (n ? -1 : 1),
                phase: i,
              });
          if (segment.type === 'hammer')
            for (const [n, z] of [14, 28].entries())
              localObstacles.push({
                type: 'hammer',
                x: n ? 2 : -2,
                z,
                radius: 1.4,
                speed: 0.8 + d * 0.25,
                phase: n * 2 + i,
              });
          if (segment.type === 'falling')
            for (let n = 0; n < 3 + d; n++)
              localObstacles.push({
                type: 'falling',
                x: [-3, 0, 3][n % 3],
                z: 10 + n * 4.2,
                radius: 1.25,
                speed: 0.7 + d * 0.15,
                phase: n * 0.71 + i,
              });
      }
    }
    // Resolve every authored obstacle in its own lane frame, including on ramps.
    localObstacles.length = 0;
    for (const [n, placement] of (
      segment.obstacles ?? defaultObstacles(segment)
    ).entries()) {
      const route = localLanes.find(
        (l) =>
          placement.lane === 'main' ||
          l.id.endsWith(placement.lane === 'risk' ? 'hard' : 'easy'),
      )!;
      const distances = route.points
        .slice(1)
        .map((p, j) =>
          Math.hypot(p.x - route.points[j].x, p.z - route.points[j].z),
        );
      let remaining =
        (distances.reduce((a, b) => a + b, 0) * placement.at) / 100;
      let j = 0;
      while (j < distances.length - 1 && remaining > distances[j])
        remaining -= distances[j++];
      const a = route.points[j],
        b = route.points[j + 1],
        t = remaining / distances[j];
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const laneWidth =
        segment.type === 'fork'
          ? placement.lane === 'risk'
            ? 7 - d * 0.5
            : 10
          : ['left', 'right', 'slalom'].includes(segment.type)
            ? 11 - d
            : width;
      const across = placement.offset * Math.max(0, laneWidth / 2 - 1.2);
      const x = a.x + (b.x - a.x) * t + across * Math.cos(yaw),
        z = a.z + (b.z - a.z) * t - across * Math.sin(yaw);
      let y = 0;
      for (const p of localPlatforms) {
        const px =
          (x - p.x) * Math.cos(p.yaw ?? 0) - (z - p.z) * Math.sin(p.yaw ?? 0);
        const pz =
          (x - p.x) * Math.sin(p.yaw ?? 0) + (z - p.z) * Math.cos(p.yaw ?? 0);
        if (Math.abs(px) <= p.w / 2 && Math.abs(pz) <= p.d / 2)
          y = Math.max(y, platformHeight(p, z, x));
      }
      localObstacles.push({
        type: placement.type,
        x,
        z,
        y,
        yaw,
        radius:
          placement.type === 'bar'
            ? laneWidth / 2 - 1
            : placement.type === 'hammer'
              ? 1.4
              : 1.15,
        width: laneWidth * 0.48,
        speed:
          (placement.type === 'falling' ? 0.7 + d * 0.15 : 0.65 + d * 0.25) *
          (placement.type === 'bar' && n % 2 ? -1 : 1),
        phase: n * 0.83 + i * 0.47,
      });
    }
    for (const p of localPlatforms)
      platforms.push({
        ...p,
        ...world(p.x, p.z),
        yaw: origin.yaw + (p.yaw ?? 0),
      });
    for (const o of localObstacles)
      obstacles.push({
        ...o,
        ...world(o.x, o.z),
        yaw: origin.yaw + (o.yaw ?? 0),
      });
    origin = { ...world(end.x, end.z), yaw: origin.yaw + turn };
    cursor += length;
  });
  platforms.push({ ...world(0, 7), yaw: origin.yaw, w: 16, d: 14 });
  routes.push({
    id: 'finish',
    points: [
      { ...world(0, 0), progress: cursor },
      { ...world(0, 14), progress: cursor + 14 },
    ],
  });
  const length = cursor + 6;
  gates.push({
    ...world(0, 6),
    yaw: origin.yaw,
    progress: length,
    halfWidth: 7.5,
  });
  return {
    id,
    name: recipe.name,
    theme: 'COSMIC COURSE',
    description: recipe.segments
      .map((s) => MODULES.find((m) => m.key === s.type)!.name)
      .join(' · '),
    tip: 'Steer with the camera through turns. Left forks are narrow shortcuts; right forks are wider detours. Jump gaps and watch meteor circles.',
    difficulty: ['Easy', 'Medium', 'Hard'][
      Math.max(...recipe.segments.map((s) => s.difficulty)) - 1
    ],
    color: '#7943d4',
    sky: '#080f28',
    accent: '#30f0e2',
    length,
    platforms,
    ribbons,
    obstacles,
    checkpoints,
    routes,
    gates,
    ...(id > 50 ? { recipe: structuredClone(recipe) } : {}),
  };
}

const recipe = (
  name: string,
  keys: ModuleKey[],
  difficulty: 1 | 2 | 3,
): CourseRecipe => ({
  version: 1,
  name,
  segments: keys.map((type) => ({ type, difficulty })),
});
export const EXPANSION: CourseRecipe[] = [
  recipe('Cosmic Climb', ['open', 'climb', 'spin', 'climb'], 1),
  recipe('Gravity Gardens', ['slide', 'open', 'slide', 'jump'], 1),
  recipe('Orbital Drop', ['drop', 'jump', 'drop', 'open'], 1),
  recipe('Meteor Mile', ['open', 'falling', 'spin', 'falling'], 1),
  recipe('Hammer Highway', ['hammer', 'open', 'hammer', 'jump'], 1),
  recipe('Satellite Steps', ['jump', 'climb', 'jump', 'climb'], 1),
  recipe('Photon Slides', ['slide', 'belt', 'slide', 'slide'], 2),
  recipe('Starlight Summit', ['climb', 'hammer', 'climb', 'drop'], 2),
  recipe('Comet Cascade', ['falling', 'drop', 'falling', 'slide'], 2),
  recipe('Vortex Vaults', ['spin', 'jump', 'spin', 'jump'], 2),
  recipe('Lunar Landing', ['climb', 'drop', 'jump', 'drop'], 2),
  recipe('Neon Avalanche', ['slide', 'falling', 'slide', 'hammer'], 2),
  recipe('Crystal Crossing', ['crumble', 'jump', 'climb', 'crumble'], 2),
  recipe('Asteroid Alley', ['hammer', 'falling', 'belt', 'falling'], 2),
  recipe('Skyline Scramble', ['climb', 'belt', 'hammer', 'drop', 'jump'], 3),
  recipe('Plasma Pipeline', ['slide', 'spin', 'belt', 'slide', 'falling'], 3),
  recipe('Zero-G Gauntlet', ['drop', 'hammer', 'jump', 'climb', 'drop'], 3),
  recipe('Nebula Rush', ['falling', 'spin', 'climb', 'slide', 'jump'], 3),
  recipe(
    'Supernova Shuffle',
    ['crumble', 'hammer', 'slide', 'falling', 'spin'],
    3,
  ),
  recipe(
    'Galaxy Grand Prix',
    ['climb', 'drop', 'hammer', 'falling', 'slide', 'jump'],
    3,
  ),
];
