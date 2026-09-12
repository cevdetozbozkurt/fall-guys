import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation, EMPTY_INPUT } from '../lib/simulation.ts';
import { buildCourse, platformHeight } from '../lib/course-builder.ts';
import { toWorld, toLocal } from '../lib/routes.ts';
import { COURSES } from '../lib/courses.ts';
import {
  Party,
  captureWorld,
  restoreWorld,
  validateInput,
} from '../lib/multiplayer.ts';
import type { DataConnection } from 'peerjs';

void test('guest kick taps survive the send interval and the host broadcasts the resulting stun', () => {
  let now = 1000;
  const guestSim = new Simulation(),
    hostSim = new Simulation();
  guestSim.setHumans([0, 1], 1);
  hostSim.setHumans([0, 1]);
  guestSim.state = hostSim.state = 'racing';
  const guest = new Party(
    guestSim,
    { change: () => {}, prepare: () => {}, roster: () => {}, ended: () => {} },
    () => now,
  );
  guest.view = { ...guest.view, status: 'racing', host: false };
  guest.lastInput = now;
  guest.lastPacket = now;
  const packets: { input: unknown }[] = [];
  guest.server = {
    open: true,
    dataChannel: { bufferedAmount: 0 },
    send: (data: { input: unknown }) => packets.push(data),
  } as unknown as DataConnection;
  guestSim.input = { ...EMPTY_INPUT, kick: true, z: 1 };
  guest.tick(1 / 60);
  assert.equal(packets.length, 0);
  guestSim.input = { ...EMPTY_INPUT, z: 1 };
  now += 50;
  guest.tick(1 / 60);
  assert.equal(packets.length, 1);
  const command = validateInput(packets[0].input)!;
  assert.equal(command.kick, true);
  for (const r of hostSim.racers) Object.assign(r, { x: 100, invincible: 0 });
  Object.assign(hostSim.racers[1], { x: 0, z: 4, y: 0, grounded: true });
  Object.assign(hostSim.player, { x: 0, z: 6, y: 0, grounded: true });
  hostSim.humanInputs.set(1, command);
  hostSim.step(1 / 60);
  assert.equal(hostSim.player.stun, 1);
  assert.equal(hostSim.racers[1].kickCooldown, 5);
  restoreWorld(guestSim, captureWorld(hostSim, 1, 1));
  assert.equal(guestSim.racers[0].stun, 1);
  assert.equal(guestSim.player.kickCooldown, 5);
  now += 50;
  guest.tick(1 / 60);
  assert.equal(validateInput(packets[1].input)?.kick, false);
  guest.server = null;
  guest.close(false);
});

void test('dive cooldown survives landing and respawn and expires after five seconds', () => {
  const sim = new Simulation();
  const r = sim.player;
  Object.assign(r, { y: 2, grounded: false });
  sim.move(r, { ...EMPTY_INPUT, dive: true, z: 1 }, 1 / 60);
  assert.equal(r.diveCooldown, 5);
  sim.respawn(r);
  Object.assign(r, { y: 2, grounded: false });
  sim.move(r, { ...EMPTY_INPUT, dive: true, z: 1 }, 1 / 60);
  assert.equal(r.dived, false);
  for (let i = 0; i < 298; i++) sim.move(r, EMPTY_INPUT, 1 / 60);
  assert.ok(r.diveCooldown > 0);
  sim.move(r, EMPTY_INPUT, 1 / 60);
  sim.move(r, EMPTY_INPUT, 1 / 60);
  Object.assign(r, { y: 2, grounded: false, dived: false });
  sim.move(r, { ...EMPTY_INPUT, dive: true, z: 1 }, 1 / 60);
  assert.equal(r.dived, true);
});
void test('kick selects one nearby forward runner, stuns one second, and cannot repeat during cooldown', () => {
  const sim = new Simulation(),
    r = sim.player,
    target = sim.racers[1],
    rear = sim.racers[2];
  for (const other of sim.racers)
    Object.assign(other, { x: 50, invincible: 0 });
  Object.assign(r, { x: 0, z: 0 });
  Object.assign(target, { x: 0, z: 2 });
  Object.assign(rear, { x: 0, z: -1 });
  sim.kick(r, { ...EMPTY_INPUT, z: 1, kick: true });
  assert.equal(target.stun, 1);
  assert.equal(rear.stun, 0);
  assert.equal(r.kickCooldown, 5);
  target.stun = 0;
  sim.kick(r, { ...EMPTY_INPUT, z: 1, kick: true });
  assert.equal(target.stun, 0);
  r.kickCooldown = 0;
  target.x = 10;
  sim.kick(r, { ...EMPTY_INPUT, z: 1, kick: true });
  assert.equal(target.stun, 0);
});
void test('an airborne dive cannot enter beneath a rising rotated ramp', () => {
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, 0.72]) {
    const sim = new Simulation(),
      ramp = { x: 0, z: 0, w: 10, d: 14, y: 0, endY: 8, yaw };
    sim.course = { ...sim.course, platforms: [ramp], obstacles: [], gates: [] };
    Object.assign(sim.player, toWorld(ramp, 0, -5), {
      y: (8 * 2) / 14 + 0.01,
      grounded: false,
      vy: 2,
      dived: true,
      diveTime: 0.5,
      vx: 18 * Math.sin(yaw),
      vz: 18 * Math.cos(yaw),
    });
    for (let i = 0; i < 25; i++) {
      sim.move(
        sim.player,
        { ...EMPTY_INPUT, ...toWorld({ x: 0, z: 0, yaw }, 0, 1) },
        1 / 60,
      );
      assert.ok(
        sim.player.y >=
          platformHeight(ramp, sim.player.z, sim.player.x) - 0.001,
      );
    }
  }
});
void test('spatial floor index preserves exhaustive support at rotated platform edges', () => {
  for (const course of COURSES) {
    const sim = new Simulation(course);
    for (const p of course.platforms)
      for (const [x, z] of [
        [0, 0],
        [p.w / 2 + 0.06, 0],
        [-p.w / 2 - 0.06, p.d / 2 + 0.06],
      ]) {
        const point = toWorld(p, x, z);
        let expected = -1,
          highest = -Infinity;
        course.platforms.forEach((candidate, i) => {
          const local = toLocal(candidate, point.x, point.z),
            height = platformHeight(candidate, point.z, point.x);
          if (
            Math.abs(local.x) <= candidate.w / 2 + 0.08 &&
            Math.abs(local.z) <= candidate.d / 2 + 0.08 &&
            height > highest
          ) {
            expected = i;
            highest = height;
          }
        });
        assert.equal(sim.support(point.x, point.z), expected);
      }
  }
  assert.equal(
    buildCourse({
      version: 1,
      name: 'fixture',
      segments: [
        { type: 'climb', difficulty: 3 },
        { type: 'left', difficulty: 2 },
        { type: 'slide', difficulty: 3 },
      ],
    }).id > 50,
    true,
  );
});
