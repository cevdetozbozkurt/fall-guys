import { buildCourse, EXPANSION, type CourseRecipe } from './course-builder.ts';
import type { CourseRibbon } from './ribbon.ts';

export type Platform = {
  x: number;
  z: number;
  w: number;
  d: number;
  y?: number;
  endY?: number;
  kind?: 'belt' | 'crumble' | 'slide';
  direction?: number;
  yaw?: number;
  ribbon?: number;
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
  yaw?: number;
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
  ribbons?: CourseRibbon[];
  obstacles: Obstacle[];
  checkpoints: number[];
  routes?: {
    id: string;
    points: { x: number; z: number; progress: number }[];
  }[];
  gates?: {
    x: number;
    z: number;
    yaw: number;
    progress: number;
    halfWidth: number;
  }[];
  recipe?: CourseRecipe;
};

// Fifty curated routes: original names keep their IDs, with rebuilt geometry.
const layout = (
  name: string,
  sequence: string,
  difficulty: 1 | 2 | 3,
): CourseRecipe => ({
  version: 1,
  name,
  segments: sequence.split(' ').map((type) => ({
    type: type as CourseRecipe['segments'][number]['type'],
    difficulty,
  })),
});
const originals: CourseRecipe[] = [
  layout('Bubble Boulevard', 'open left jump right fork', 1),
  layout('Spin Parade', 'spin right spin left fork', 2),
  layout('Cloud Hoppers', 'jump left climb right jump fork', 2),
  layout('Bumper Ballet', 'slide right slalom left hammer fork', 2),
  layout('Pendulum Party', 'hammer left spin right fork falling', 2),
  layout('Beltway Bounce', 'belt right jump left fork belt', 2),
  layout('Cookie Crumble', 'crumble left fork right crumble jump', 2),
  layout('Ribbon Run', 'slalom right jump left fork slide', 3),
  layout('Neon Mixer', 'spin left hammer fork right falling slide', 3),
  layout('Crown Circuit', 'climb right fork left drop slalom spin jump', 3),
];
const newRoutes: CourseRecipe[] = [
  layout('Andromeda Switchback', 'climb left fork right slalom drop', 3),
  layout('Twin Orbit Trials', 'spin right fork left hammer jump', 3),
  layout('Photon Hairpin', 'slalom left jump right slide fork', 3),
  layout('Meteor Divide', 'falling fork right falling left climb', 3),
  layout('Neon Serpent', 'slalom left slalom right fork belt', 3),
  layout('Gravity Junction', 'slide right fork left drop jump', 3),
  layout('Perilous Panorama', 'climb left drop fork right hammer', 3),
  layout('Hammerhead Bend', 'hammer right slalom left fork spin', 3),
  layout('Shattered Constellation', 'crumble left fork right jump falling', 3),
  layout('Satellite Slingshot', 'belt right slide left fork slalom', 3),
  layout('Crystal Corkscrew', 'climb left spin right fork climb drop', 3),
  layout('Binary Star Sprint', 'fork right jump left fork spin', 3),
  layout('Comet Chicane', 'slalom right falling left slide fork', 3),
  layout('Aurora Ascent', 'climb left jump right climb fork drop', 3),
  layout('Asteroid Crossroads', 'falling fork left hammer right fork', 3),
  layout('Plasma Detour', 'belt left fork right slide hammer jump', 3),
  layout('Event Horizon', 'drop right crumble left fork falling', 3),
  layout('Quasar Quarrel', 'spin left fork right slalom hammer spin', 3),
  layout(
    'Midnight Megalopolis',
    'climb right slalom left falling fork slide',
    3,
  ),
  layout(
    'Ultimate Data Vortex',
    'climb left fork right hammer slalom falling drop jump',
    3,
  ),
];
const rebuilt = EXPANSION.map((r, i) => ({
  ...r,
  segments: [
    ...r.segments
      .slice(0, 2)
      .map((s) => ({ ...s, difficulty: Math.max(2, s.difficulty) as 2 | 3 })),
    {
      type: i % 2 ? 'right' : 'left',
      difficulty: 2,
    } as CourseRecipe['segments'][number],
    {
      type: 'fork',
      difficulty: i > 8 ? 3 : 2,
    } as CourseRecipe['segments'][number],
    {
      type: i % 2 ? 'left' : 'right',
      difficulty: 2,
    } as CourseRecipe['segments'][number],
    ...r.segments
      .slice(2)
      .map((s) => ({ ...s, difficulty: Math.max(2, s.difficulty) as 2 | 3 })),
  ],
}));
export const COURSES: Course[] = [...originals, ...rebuilt, ...newRoutes].map(
  (r, i) => buildCourse(r, i + 1),
);
for (const [i, c] of COURSES.entries()) {
  c.sky = ['#080f28', '#100d2b', '#071c2b'][i % 3];
  c.color = ['#7943d4', '#216ba1', '#b43aa0', '#157d83'][i % 4];
  c.accent = ['#30f0e2', '#ff59c7', '#ffe16b', '#71a7ff'][i % 4];
}
export const COLORS = [
  '#ff8755',
  '#b28aff',
  '#37e4cf',
  '#ffe16b',
  '#ff64be',
  '#61c5ff',
];
