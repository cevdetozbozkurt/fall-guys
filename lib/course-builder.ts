import type { Course, Platform, Obstacle } from './courses.ts';

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
] as const;
export type ModuleKey = (typeof MODULES)[number]['key'];
export type Segment = { type: ModuleKey; difficulty: 1 | 2 | 3 };
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
    segments.push({
      type: entry.type as ModuleKey,
      difficulty: entry.difficulty as 1 | 2 | 3,
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
export function recipeKey(recipe: CourseRecipe) {
  const value = JSON.stringify(recipe);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) + 1000;
}
export function platformHeight(p: Platform, z: number) {
  const start = p.y ?? 0;
  return (
    start +
    ((p.endY ?? start) - start) *
      Math.max(0, Math.min(1, (z - p.z + p.d / 2) / p.d))
  );
}

// Modules share level entrances and exits, so any valid sequence remains connected.
export function buildCourse(
  recipe: CourseRecipe,
  id = recipeKey(recipe),
): Course {
  const platforms: Platform[] = [{ x: 0, z: 2, w: 16, d: 16 }];
  const obstacles: Obstacle[] = [],
    checkpoints: number[] = [];
  const add = (
    start: number,
    end: number,
    w = 16,
    extra: Partial<Platform> = {},
  ) =>
    platforms.push({ x: 0, z: (start + end) / 2, w, d: end - start, ...extra });
  recipe.segments.forEach((segment, i) => {
    const s = 10 + i * MODULE_LENGTH,
      d = segment.difficulty;
    const width = 18 - d * 2;
    checkpoints.push(s + 1);
    switch (segment.type) {
      case 'climb':
        add(s, s + 5);
        for (let step = 1; step <= 5; step++)
          add(s + 5 + (step - 1) * 5, s + 5 + step * 5, width, {
            y: step * 1.25,
          });
        add(s + 30, s + 40);
        break;
      case 'slide':
        add(s, s + 4);
        add(s + 4, s + 16, width, { y: 0, endY: 6 });
        add(s + 16, s + 32, width, { y: 6, endY: 0, kind: 'slide' });
        add(s + 32, s + 40);
        obstacles.push({
          type: 'bumper',
          x: 3,
          z: s + 35,
          radius: 1,
          speed: 0.6 + d * 0.25,
        });
        break;
      case 'drop':
        add(s, s + 4);
        add(s + 4, s + 18, width, { y: 0, endY: 8 });
        add(s + 18, s + 23, width, { y: 8 });
        add(s + 27, s + 40, width);
        break;
      case 'jump': {
        let pos = s;
        for (const end of [s + 9, s + 21, s + 33]) {
          add(pos, end, width);
          pos = end + 3 + d * 0.35;
        }
        add(pos, s + 40, width);
        break;
      }
      case 'crumble':
        add(s, s + 6);
        for (let z = s + 6; z < s + 34; z += 7)
          for (const x of [-5, 0, 5]) add(z, z + 7, 5, { x, kind: 'crumble' });
        add(s + 34, s + 40);
        break;
      case 'belt':
        add(s, s + 5);
        add(s + 5, s + 34, width, { kind: 'belt', direction: i % 2 ? 1 : -1 });
        add(s + 34, s + 40);
        obstacles.push({ type: 'hurdle', x: 0, z: s + 17, width: width - 3 });
        break;
      default:
        add(s, s + 40, width);
        if (segment.type === 'spin')
          for (const [n, offset] of [14, 29].entries())
            obstacles.push({
              type: 'bar',
              x: n ? 1 : -1,
              z: s + offset,
              radius: width / 2 - 1,
              speed: (0.65 + d * 0.25) * (n ? -1 : 1),
              phase: i,
            });
        if (segment.type === 'hammer')
          for (const [n, offset] of [14, 28].entries())
            obstacles.push({
              type: 'hammer',
              x: n ? 2 : -2,
              z: s + offset,
              radius: 1.4,
              speed: 0.8 + d * 0.25,
              phase: n * 2 + i,
            });
        if (segment.type === 'falling')
          for (let n = 0; n < 3 + d; n++)
            obstacles.push({
              type: 'falling',
              x: [-4, 0, 4][n % 3],
              z: s + 10 + n * 4.2,
              radius: 1.25,
              speed: 0.7 + d * 0.15,
              phase: n * 0.71 + i,
            });
    }
  });
  const length = 16 + recipe.segments.length * MODULE_LENGTH;
  add(length - 6, length + 8);
  return {
    id,
    name: recipe.name,
    theme: 'COSMIC COURSE',
    description: recipe.segments
      .map((s) => MODULES.find((m) => m.key === s.type)!.name)
      .join(' · '),
    tip: 'Jump onto ledges. Steer on slopes. Watch the meteor landing circles.',
    difficulty: ['Easy', 'Medium', 'Hard'][
      Math.max(...recipe.segments.map((s) => s.difficulty)) - 1
    ],
    color: '#7943d4',
    sky: '#080f28',
    accent: '#30f0e2',
    length,
    platforms,
    obstacles,
    checkpoints,
    ...(id > 30 ? { recipe: structuredClone(recipe) } : {}),
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
