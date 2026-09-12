import fs from 'node:fs';
import { COURSES } from '../lib/courses.ts';
import { Simulation, EMPTY_INPUT } from '../lib/simulation.ts';

const rows = [];
for (const course of COURSES) {
  const outcomes = [];
  for (const attempt of [0, 0.35, 0.8, 1.4, 2, -1]) {
    const deliberate = attempt === -1;
    const s = new Simulation(course);
    s.player.speed = 10;
    // Independent controller benchmark: no competing runners or human timing claims.
    for (const racer of s.racers.slice(1)) racer.finished = 1;
    s.start();
    let checkpoint = -1,
      hesitate = 0,
      startDelay = Math.max(0, attempt);
    for (
      let frame = 0;
      frame < 180 * 60 + 200 && s.state !== 'finished';
      frame++
    ) {
      if (deliberate && s.player.checkpoint !== checkpoint) {
        checkpoint = s.player.checkpoint;
        hesitate = 1.5;
      }
      const starting = s.state === 'racing' && startDelay > 0;
      if (starting) startDelay -= 1 / 60;
      const waiting = (hesitate > 0 || starting) && s.player.grounded;
      if (waiting) hesitate -= 1 / 60;
      s.input = waiting ? { ...EMPTY_INPUT } : s.botInput(s.player);
      s.step(1 / 60);
    }
    outcomes.push({
      finished: s.player.finished > 0,
      time: Math.round(s.time * 100) / 100,
      falls: s.player.falls,
    });
  }
  const steady = outcomes.pop()!;
  const expert =
    outcomes.filter((r) => r.finished).sort((a, b) => a.time - b.time)[0] ??
    outcomes[0];
  const gold = Math.ceil(expert.time * 1.035);
  const target = Math.ceil(Math.max(50, steady.time, gold + 18));
  const silver = Math.ceil(gold + (target - gold) * 0.55);
  rows.push({
    id: course.id,
    name: course.name,
    expert,
    steady,
    gold,
    silver,
    target,
  });
}
fs.writeFileSync('outputs/course-balance.json', JSON.stringify(rows, null, 2));
console.table(
  rows.map((r) => ({
    id: r.id,
    expert: r.expert.time,
    steady: r.steady.time,
    gold: r.gold,
    silver: r.silver,
    target: r.target,
    finished: r.expert.finished && r.steady.finished,
  })),
);
if (
  rows.some(
    (r) => !r.expert.finished || !r.steady.finished || r.steady.time < 50,
  )
)
  process.exitCode = 1;
else
  fs.writeFileSync(
    'lib/course-balance.ts',
    `// Benchmarked with scripts/calibrate-courses.ts; steady controller pauses at checkpoints.\nexport const COURSE_TARGETS = ${JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, { gold: r.gold, silver: r.silver, target: r.target }])))} as const;\n`,
  );
