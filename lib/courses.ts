import { buildCourse, EXPANSION, type CourseRecipe } from './course-builder.ts';

export type Platform = {
  x: number;
  z: number;
  w: number;
  d: number;
  y?: number;
  endY?: number;
  kind?: 'belt' | 'crumble' | 'slide';
  direction?: number;
};
export type Obstacle = {
  type:
    | 'bar'
    | 'bumper'
    | 'hurdle'
    | 'pendulum'
    | 'pusher'
    | 'hammer'
    | 'falling';
  y?: number;
  x: number;
  z: number;
  radius?: number;
  speed?: number;
  phase?: number;
  width?: number;
};
export type Course = {
  id: number;
  name: string;
  theme: string;
  description: string;
  tip: string;
  difficulty: string;
  color: string;
  sky: string;
  accent: string;
  length: number;
  platforms: Platform[];
  obstacles: Obstacle[];
  checkpoints: number[];
  recipe?: CourseRecipe;
};
const base = (length: number, width = 16): Platform[] => [
  { x: 0, z: length / 2, w: width, d: length + 12 },
];
const rows = (
  type: Obstacle['type'],
  positions: number[],
  extra = {},
): Obstacle[] =>
  positions.map((z, i) => ({ type, x: 0, z, phase: i * 1.4, ...extra }));
const gaps = (
  length: number,
  cuts: [number, number][],
  width = 16,
): Platform[] => {
  const result: Platform[] = [];
  let start = -6;
  for (const [a, b] of [
    ...cuts,
    [length + 6, length + 6] as [number, number],
  ]) {
    result.push({ x: 0, z: (start + a) / 2, w: width, d: a - start });
    start = b;
  }
  return result;
};
export const COURSES: Course[] = [
  {
    id: 1,
    name: 'Bubble Boulevard',
    theme: 'THE WARM-UP',
    description: 'Big bounces. Little room for error.',
    tip: 'Hop over the pink hurdles. The green arches save your progress.',
    difficulty: 'Easy',
    color: '#9565ee',
    sky: '#c9efec',
    accent: '#ff8050',
    length: 100,
    platforms: base(100),
    checkpoints: [34, 68],
    obstacles: [
      { type: 'bar', x: 0, z: 19, radius: 5.5, speed: 0.75 },
      ...[-4, 4].map((x, i) => ({
        type: 'bumper' as const,
        x,
        z: 46 + i * 9,
        radius: 1.3,
        speed: 1,
      })),
      ...rows('hurdle', [78, 87], { width: 11 }),
    ],
  },
  {
    id: 2,
    name: 'Spin Parade',
    theme: 'ROUND & ROUND',
    description: 'Find your rhythm. Beat the sweep.',
    tip: 'Jump over the spinning arms, or slip around their tips.',
    difficulty: 'Easy',
    color: '#f277aa',
    sky: '#fae4b9',
    accent: '#7755df',
    length: 110,
    platforms: base(110),
    checkpoints: [36, 74],
    obstacles: rows('bar', [20, 53, 88], { radius: 6.4, speed: 1.1 }),
  },
  {
    id: 3,
    name: 'Cloud Hoppers',
    theme: 'MIND THE GAP',
    description: 'Take a leap into the good stuff.',
    tip: 'Build up speed before each gap. Dive in the air for extra reach.',
    difficulty: 'Medium',
    color: '#69bddd',
    sky: '#cee9fa',
    accent: '#fca748',
    length: 112,
    platforms: gaps(
      112,
      [
        [22, 26],
        [45, 49],
        [76, 80],
        [96, 100],
      ],
      14,
    ),
    checkpoints: [32, 64],
    obstacles: rows('bumper', [38, 87], { radius: 1.2, speed: 1.2 }),
  },
  {
    id: 4,
    name: 'Bumper Ballet',
    theme: 'BOUNCE HOUSE',
    description: 'A very questionable dance floor.',
    tip: 'Watch the striped bumpers. Choose a gap and keep moving.',
    difficulty: 'Medium',
    color: '#fb9759',
    sky: '#ffe5cd',
    accent: '#9666e8',
    length: 116,
    platforms: base(116, 18),
    checkpoints: [37, 77],
    obstacles: [
      ...rows('bumper', [19, 28, 49, 61, 89, 101], { radius: 1.6, speed: 1.4 }),
      ...rows('pusher', [55, 95], { x: 5, width: 4, speed: 1.5 }),
    ],
  },
  {
    id: 5,
    name: 'Pendulum Party',
    theme: 'SWING TIME',
    description: 'The party really hits different.',
    tip: 'Wait for the hanging balls to swing past, then dash through.',
    difficulty: 'Medium',
    color: '#ad83e2',
    sky: '#e1ddf9',
    accent: '#fd875d',
    length: 118,
    platforms: base(118),
    checkpoints: [37, 77],
    obstacles: rows('pendulum', [19, 28, 51, 63, 89, 102], {
      radius: 1.7,
      speed: 1.5,
    }),
  },
  {
    id: 6,
    name: 'Beltway Bounce',
    theme: 'GO WITH THE FLOW',
    description: 'This floor has somewhere to be.',
    tip: 'Arrow tiles push you sideways. Steer against the flow.',
    difficulty: 'Medium',
    color: '#65c4a7',
    sky: '#d5f1da',
    accent: '#ed88bb',
    length: 118,
    platforms: [
      { x: 0, z: 4, w: 16, d: 20 },
      ...Array.from({ length: 6 }, (_, i) => ({
        x: 0,
        z: 25 + i * 20,
        w: 16,
        d: 22,
        kind: 'belt' as const,
        direction: i % 2 ? 1 : -1,
      })),
    ],
    checkpoints: [36, 76],
    obstacles: [
      ...rows('hurdle', [24, 64, 102], { width: 10 }),
      ...rows('bumper', [48, 88], { radius: 1.4, speed: 1.4 }),
    ],
  },
  {
    id: 7,
    name: 'Cookie Crumble',
    theme: 'KEEP IT MOVING',
    description: 'Good things don’t last forever.',
    tip: 'The pink tiles drop after you land on them. Keep moving!',
    difficulty: 'Hard',
    color: '#e5af66',
    sky: '#faeccb',
    accent: '#ed78a3',
    length: 118,
    platforms: [
      { x: 0, z: 4, w: 16, d: 20 },
      { x: 0, z: 39, w: 16, d: 10 },
      { x: 0, z: 79, w: 16, d: 10 },
      { x: 0, z: 113, w: 16, d: 22 },
      ...Array.from({ length: 11 }, (_, i) => i * 8 + 18)
        .filter((z) => z < 34 || (z > 44 && z < 74) || z > 84)
        .flatMap((z) =>
          [-5, 0, 5].map((x) => ({
            x,
            z,
            w: 5,
            d: 8,
            kind: 'crumble' as const,
          })),
        ),
    ],
    checkpoints: [39, 79],
    obstacles: rows('bar', [26, 64, 94], { radius: 5, speed: 0.8 }),
  },
  {
    id: 8,
    name: 'Ribbon Run',
    theme: 'WALK THE LINE',
    description: 'Small paths. Big main-character energy.',
    tip: 'Stay near the middle on the narrow ribbons. Slow down to line up jumps.',
    difficulty: 'Hard',
    color: '#5aafd2',
    sky: '#d1e7f5',
    accent: '#f489b5',
    length: 124,
    platforms: [
      { x: 0, z: 4, w: 16, d: 20 },
      { x: 0, z: 25, w: 6, d: 22 },
      { x: 0, z: 41, w: 16, d: 10 },
      { x: 0, z: 62, w: 6, d: 32 },
      { x: 0, z: 83, w: 16, d: 10 },
      { x: 0, z: 103, w: 6, d: 30 },
      { x: 0, z: 124, w: 16, d: 12 },
    ],
    checkpoints: [41, 83],
    obstacles: rows('bar', [24, 61, 102], { radius: 4.5, speed: 0.9 }),
  },
  {
    id: 9,
    name: 'Neon Mixer',
    theme: 'A LITTLE OF EVERYTHING',
    description: 'All your favorite ways to fall.',
    tip: 'Mix your moves: dodge the bumpers, jump the gaps, time the sweeps.',
    difficulty: 'Hard',
    color: '#8f79ed',
    sky: '#cbdaf2',
    accent: '#a6e787',
    length: 132,
    platforms: gaps(
      132,
      [
        [44, 48],
        [90, 94],
      ],
      16,
    ).map((p, i) => ({
      ...p,
      kind: i === 1 ? 'belt' : undefined,
      direction: 1,
    })),
    checkpoints: [35, 78, 106],
    obstacles: [
      { type: 'bar', x: 0, z: 20, radius: 6, speed: 1.3 },
      { type: 'bumper', x: 0, z: 61, radius: 1.8, speed: 1.8 },
      { type: 'pendulum', x: 0, z: 84, radius: 1.8, speed: 1.7 },
      { type: 'bar', x: 0, z: 118, radius: 6.5, speed: 1.5 },
    ],
  },
  {
    id: 10,
    name: 'Crown Circuit',
    theme: 'THE GRAND FINALE',
    description: 'One last tumble. All the glory.',
    tip: 'Use every checkpoint. The crown is waiting at the very end.',
    difficulty: 'Expert',
    color: '#e8af45',
    sky: '#f9e7b5',
    accent: '#ac75e6',
    length: 150,
    platforms: gaps(
      150,
      [
        [25, 29],
        [90, 94],
      ],
      16,
    ),
    checkpoints: [36, 76, 116],
    obstacles: [
      { type: 'bar', x: 0, z: 17, radius: 6, speed: 1.3 },
      { type: 'bar', x: -2, z: 51, radius: 5, speed: 1.5 },
      { type: 'bar', x: 2, z: 64, radius: 5, speed: -1.3 },
      { type: 'bumper', x: 0, z: 84, radius: 1.8, speed: 1.8 },
      { type: 'pendulum', x: 0, z: 106, radius: 1.8, speed: 1.8 },
      { type: 'pendulum', x: 0, z: 130, radius: 1.9, speed: 1.8 },
      { type: 'hurdle', x: 0, z: 139, width: 12 },
    ],
  },
];
COURSES.push(...EXPANSION.map((recipe, i) => buildCourse(recipe, i + 11)));
for (const [i, course] of COURSES.entries()) {
  course.sky = ['#080f28', '#100d2b', '#071c2b'][i % 3];
  course.color = ['#7943d4', '#216ba1', '#b43aa0', '#157d83'][i % 4];
  course.accent = ['#30f0e2', '#ff59c7', '#ffe16b', '#71a7ff'][i % 4];
}
export const COLORS = [
  '#ff8755',
  '#b28aff',
  '#37e4cf',
  '#ffe16b',
  '#ff64be',
  '#61c5ff',
];
