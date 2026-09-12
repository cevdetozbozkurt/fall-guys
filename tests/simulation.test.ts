import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeAt, toWorld } from '../lib/routes.ts';
import { COURSES } from '../lib/courses.ts';
import { Simulation, EMPTY_INPUT } from '../lib/simulation.ts';

void test('fifty distinct courses have supported start, checkpoints and finish', () => {
  assert.equal(COURSES.length, 50);
  assert.equal(new Set(COURSES.map((c) => c.name)).size, 50);
  for (let i = 0; i < COURSES.length; i++) {
    const s = new Simulation(i);
    for (const z of [1, ...s.course.checkpoints, s.course.length])
      assert.ok(
        s.support(routeAt(s.course, z).x, routeAt(s.course, z).z) >= 0,
        `${s.course.name}: unsupported marker at ${z}`,
      );
  }
});
void test('all fifty courses can be completed under shared racing physics', () => {
  const outcomes = [];
  for (let i = 0; i < COURSES.length; i++) {
    const s = new Simulation(i);
    s.start();
    for (
      let frame = 0;
      frame < 150 * 60 + 200 && s.state !== 'finished';
      frame++
    ) {
      s.input = s.botInput(s.player);
      s.step(1 / 60);
    }
    outcomes.push({
      course: s.course.name,
      finished: s.player.finished,
      time: s.time.toFixed(1),
      falls: s.player.falls,
    });
  }
  console.table(outcomes);
  for (const result of outcomes)
    assert.ok(result.finished > 0, `${result.course} was not completed`);
});
void test('diagonal input does not grant extra speed', () => {
  const straight = new Simulation(),
    diagonal = new Simulation();
  straight.course = { ...straight.course, obstacles: [] };
  diagonal.course = { ...diagonal.course, obstacles: [] };
  for (let i = 0; i < 20; i++) {
    straight.move(straight.player, { ...EMPTY_INPUT, z: 1 }, 1 / 60);
    diagonal.move(diagonal.player, { ...EMPTY_INPUT, x: 1, z: 1 }, 1 / 60);
  }
  assert.ok(Math.hypot(diagonal.player.vx, diagonal.player.vz) <= 10.001);
  assert.ok(Math.hypot(straight.player.vx, straight.player.vz) <= 10.001);
});
void test('jump, airborne dive and checkpoint respawn work', () => {
  const s = new Simulation();
  s.course = { ...s.course, obstacles: [] };
  s.move(s.player, { ...EMPTY_INPUT, z: 1, jump: true }, 1 / 60);
  assert.ok(s.player.y > 0);
  assert.equal(s.player.grounded, false);
  s.move(s.player, { ...EMPTY_INPUT, z: 1, dive: true }, 1 / 60);
  assert.equal(s.player.dived, true);
  assert.ok(s.player.vz > 4);
  s.player.checkpoint = s.course.checkpoints[2];
  const respawn = routeAt(s.course, s.player.checkpoint);
  s.player.y = -11;
  s.move(s.player, EMPTY_INPUT, 1 / 60);
  assert.equal(s.player.x, respawn.x);
  assert.equal(s.player.z, respawn.z);
  assert.equal(s.player.falls, 1);
  assert.ok(s.player.invincible > 0);
});
void test('pause freezes race and finish requires a valid landing area', () => {
  const s = new Simulation();
  s.start();
  s.paused = true;
  s.step(1);
  assert.equal(s.countdown, 3);
  s.paused = false;
  const gate = s.course.gates!.at(-1)!;
  Object.assign(s.player, toWorld(gate, 20, 0), {
    progress: s.course.length,
    checkpoint: s.course.checkpoints.at(-1)!,
  });
  s.player.y = -1;
  s.move(s.player, EMPTY_INPUT, 1 / 60);
  assert.equal(s.player.finished, 0);
  Object.assign(s.player, { x: gate.x, z: gate.z, y: 0 });
  s.move(s.player, EMPTY_INPUT, 1 / 60);
  assert.equal(s.player.finished, 1);
});
void test('reset clears tile timers, racer progress and input', () => {
  const s = new Simulation(6);
  s.tiles.set(4, 0);
  s.player.checkpoint = 39;
  s.input.jump = true;
  s.start();
  s.reset(8);
  assert.equal(s.tiles.size, 0);
  assert.equal(s.player.checkpoint, 0);
  assert.equal(s.input.jump, false);
  assert.equal(s.finishOrder.length, 0);
  assert.equal(s.state, 'lobby');
});
