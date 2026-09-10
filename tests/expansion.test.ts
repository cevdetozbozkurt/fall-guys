import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCourse,
  DEFAULT_RECIPE,
  MODULES,
  parseRecipe,
  recipeKey,
  type CourseRecipe,
} from '../lib/course-builder.ts';
import { Simulation, EMPTY_INPUT, obstaclePose } from '../lib/simulation.ts';
import { Party, captureWorld, type Member } from '../lib/multiplayer.ts';
import type { DataConnection } from 'peerjs';

const callbacks = {
  change: () => {},
  prepare: () => {},
  roster: () => {},
  ended: () => {},
};
const members: Member[] = [
  { id: 0, name: 'Host', color: 0, host: true },
  { id: 1, name: 'Guest', color: 2, host: false },
];
function pair() {
  let time = 1000;
  const host = new Party(new Simulation(), callbacks, () => time),
    guest = new Party(new Simulation(), callbacks, () => time);
  host.view = {
    ...host.view,
    host: true,
    code: 'ABCDEFGH',
    status: 'waiting',
    members: structuredClone(members),
  };
  guest.receiveHost({
    type: 'welcome',
    self: 1,
    members: structuredClone(members),
  });
  let closeCount = 0;
  const connection = {
    open: true,
    dataChannel: { bufferedAmount: 0 },
    send: (data: unknown) => guest.receiveHost(structuredClone(data)),
    close: () => {
      closeCount++;
    },
  } as unknown as DataConnection;
  host.connections.set(1, connection);
  return {
    host,
    guest,
    connection,
    advance: (ms: number) => {
      time += ms;
      host.tick(1 / 60);
    },
    now: () => time,
    closes: () => closeCount,
  };
}

void test('five-second random rotation keeps the code and members through multiple rounds', () => {
  const p = pair();
  p.host.start(10);
  for (let n = 0; n < 3; n++) {
    const previous = p.host.sim.course.id,
      round = p.host.round;
    p.host.sim.state = 'finished';
    p.advance(60);
    assert.equal(p.host.view.nextIn, 5);
    assert.equal(p.guest.view.nextIn, 5);
    assert.equal(p.guest.view.nextName, p.host.nextCourse!.name);
    p.advance(4999);
    assert.equal(p.host.round, round);
    assert.equal(p.host.view.nextIn, 1);
    p.advance(1);
    assert.equal(p.host.round, round + 1);
    assert.equal(
      p.host.sim.state,
      'racing',
      'No additional three-second countdown',
    );
    assert.notEqual(p.host.sim.course.id, previous);
    assert.equal(p.guest.sim.course.id, p.host.sim.course.id);
    assert.equal(p.guest.sim.state, 'racing');
    assert.equal(p.guest.sim.playerId, 1);
    assert.equal(p.host.connections.get(1), p.connection);
    assert.equal(p.host.view.code, 'ABCDEFGH');
    assert.deepEqual(p.host.view.members, members);
    assert.deepEqual(p.guest.view.members, members);
    assert.equal(p.closes(), 0);
  }
});
void test('custom courses synchronize before worlds and stale transitions cannot replace them', () => {
  const p = pair();
  const recipe: CourseRecipe = {
    version: 1,
    name: 'Our galactic route',
    segments: [
      { type: 'climb', difficulty: 2 },
      { type: 'slide', difficulty: 3 },
      { type: 'falling', difficulty: 1 },
      { type: 'hammer', difficulty: 2 },
    ],
  };
  assert.equal(p.host.addCourse(recipe), true);
  assert.deepEqual(p.guest.view.customCourses, [recipe]);
  p.host.setRotation('custom');
  p.host.start(buildCourse(recipe));
  assert.deepEqual(p.guest.sim.course, p.host.sim.course);
  assert.equal(p.guest.sim.course.id, recipeKey(recipe));
  assert.equal(p.guest.sim.playerId, 1);
  p.host.sim.state = 'finished';
  p.advance(60);
  p.advance(5000);
  assert.deepEqual(p.guest.sim.course.platforms, p.host.sim.course.platforms);
  assert.equal(p.guest.sim.course.name, recipe.name);
  const state = p.guest.sim.course;
  p.guest.receiveHost({ type: 'lobby', course: 1, round: 1 });
  p.guest.receiveHost({ type: 'round', course: 2, state: 'racing', round: 1 });
  p.guest.receiveHost(captureWorld(new Simulation(0), 1, 9999));
  assert.equal(p.guest.sim.course, state);
});
void test('only-host rooms keep rotating and a quiet host does not close a guest', () => {
  const p = pair();
  p.host.start(0);
  p.host.view.members = [members[0]];
  p.host.sim.humanIds.delete(1);
  p.host.connections.delete(1);
  p.host.sim.state = 'finished';
  p.advance(50);
  p.advance(5000);
  assert.equal(p.host.sim.state, 'racing');
  assert.equal(p.host.closed, false);
  p.guest.lastPacket = p.now() - 20000;
  p.guest.tick(1 / 60);
  assert.equal(p.guest.closed, false);
  assert.match(p.guest.view.error, /room is still open/);
  assert.equal(p.guest.view.members.length, 2);
});
void test('recipes are bounded, sanitized and detached from edits during an active race', () => {
  assert.equal(parseRecipe(null), null);
  assert.equal(
    parseRecipe({
      ...DEFAULT_RECIPE,
      segments: Array(11).fill(DEFAULT_RECIPE.segments[0]),
    }),
    null,
  );
  assert.equal(
    parseRecipe({
      ...DEFAULT_RECIPE,
      segments: [{ type: 'script', difficulty: 1 }, ...DEFAULT_RECIPE.segments],
    }),
    null,
  );
  assert.equal(
    parseRecipe({
      ...DEFAULT_RECIPE,
      segments: [
        { type: 'climb', difficulty: Infinity },
        ...DEFAULT_RECIPE.segments,
      ],
    }),
    null,
  );
  const cleaned = parseRecipe({
    ...DEFAULT_RECIPE,
    name: '<Our>\u0000 course',
  })!;
  assert.equal(cleaned.name, 'Our course');
  const p = pair();
  p.host.addCourse(cleaned);
  p.host.start(buildCourse(cleaned));
  cleaned.segments[0].type = 'hammer';
  assert.equal(p.host.sim.course.recipe!.segments[0].type, 'open');
  for (let i = 0; i < 15; i++)
    assert.equal(
      p.host.addCourse({ ...DEFAULT_RECIPE, name: `Course ${i}` }),
      true,
    );
  assert.equal(
    p.host.addCourse({ ...DEFAULT_RECIPE, name: 'Overflow' }),
    false,
  );
  assert.equal(p.host.view.customCourses.length, 16);
});
void test('each builder module works at every difficulty, including mixed long sequences', () => {
  for (const sectionInfo of MODULES)
    for (const difficulty of [1, 2, 3] as const) {
      const recipe: CourseRecipe = {
        version: 1,
        name: sectionInfo.name,
        segments: [
          { type: 'open', difficulty: 1 },
          { type: sectionInfo.key, difficulty },
          { type: 'open', difficulty: 1 },
        ],
      };
      const s = new Simulation(buildCourse(recipe));
      s.start();
      for (let frame = 0; frame < 9200 && s.state !== 'finished'; frame++) {
        s.input = s.botInput(s.player);
        s.step(1 / 60);
      }
      assert.ok(
        s.player.finished,
        `${sectionInfo.key}, difficulty ${difficulty}`,
      );
    }
  const long = buildCourse({
    version: 1,
    name: 'Everything in order',
    segments: MODULES.map((m) => ({ type: m.key, difficulty: 2 })),
  });
  const s = new Simulation(long);
  s.start();
  for (let frame = 0; frame < 9200 && s.state !== 'finished'; frame++) {
    s.input = s.botInput(s.player);
    s.step(1 / 60);
  }
  assert.ok(s.player.finished, 'Ten-section course');
});
void test('climbs require jumps, slopes raise racers, slides accelerate, and meteor collisions match height', () => {
  const s = new Simulation(
    buildCourse({
      version: 1,
      name: 'Movement',
      segments: [
        { type: 'climb', difficulty: 1 },
        { type: 'slide', difficulty: 1 },
        { type: 'drop', difficulty: 1 },
      ],
    }),
  );
  const r = s.player;
  r.x = 0;
  r.z = 13;
  r.vz = 10;
  for (let f = 0; f < 60; f++) s.move(r, { ...EMPTY_INPUT, z: 1 }, 1 / 60);
  assert.ok(r.z < 15.2, 'Cannot walk through a ledge face');
  s.move(r, { ...EMPTY_INPUT, z: 1, jump: true }, 1 / 60);
  for (let f = 0; f < 32; f++) s.move(r, { ...EMPTY_INPUT, z: 1 }, 1 / 60);
  assert.ok(r.y >= 1.25, 'Jump reaches the ledge');
  r.z = 58;
  r.y = s.height(0, 58);
  r.grounded = true;
  r.vy = 0;
  r.vz = 10;
  for (let f = 0; f < 20; f++) s.move(r, { ...EMPTY_INPUT, z: 1 }, 1 / 60);
  assert.ok(r.y > 3, 'Ramp supports increasing elevation');
  r.z = 69;
  r.y = s.height(0, 69);
  r.grounded = true;
  r.vy = 0;
  r.vz = 10;
  for (let f = 0; f < 20; f++) s.move(r, { ...EMPTY_INPUT, z: 1 }, 1 / 60);
  assert.ok(r.sliding && r.vz > 14, 'Slope applies speed and reduced friction');
  const meteor = {
    type: 'falling' as const,
    x: 0,
    z: 0,
    radius: 1.25,
    speed: 1,
  };
  r.x = 0;
  r.z = 0;
  r.y = 0;
  s.worldTime = 0;
  assert.equal(s.collide(r, meteor), false);
  s.worldTime = 2.5;
  assert.ok(obstaclePose(meteor, s.worldTime).y < 2);
  assert.equal(s.collide(r, meteor), true);
});
