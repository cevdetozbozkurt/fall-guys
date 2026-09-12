import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation, EMPTY_INPUT } from '../lib/simulation.ts';
import {
  Party,
  captureWorld,
  isWorld,
  restoreWorld,
  cleanName,
  validateInput,
  type Member,
} from '../lib/multiplayer.ts';
import type { DataConnection } from 'peerjs';
import { COURSES } from '../lib/courses.ts';
const callbacks = {
  change: () => {},
  prepare: () => {},
  roster: () => {},
  ended: () => {},
};
const members: Member[] = [
  { id: 0, name: 'Cevdet', color: 0, host: true },
  { id: 1, name: 'Friend', color: 2, host: false },
];

void test('normal names survive and invalid network payloads are rejected', () => {
  assert.equal(cleanName('Cevdet Eren 123'), 'Cevdet Eren 123');
  assert.equal(cleanName('BOB'), 'BOB');
  assert.equal(cleanName('Alice\u0000'), 'Alice');
  assert.equal(validateInput({ x: NaN, z: 1, jump: false, dive: false }), null);
  assert.deepEqual(validateInput({ x: 20, z: -40, jump: true, dive: false }), {
    x: 1,
    z: -1,
    jump: true,
    dive: false,
    kick: false,
  });
  const world = captureWorld(new Simulation(), 1, 1);
  world.state = 'racing';
  assert.equal(isWorld(world), true);
  assert.equal(
    isWorld({ ...world, racers: [null, ...world.racers.slice(1)] }),
    false,
  );
  const room = new Party(new Simulation(), callbacks);
  assert.equal(room.validRoster([null]), false);
  assert.equal(room.validRoster([members[0], members[0]]), false);
});
void test('host and guest share countdown, movement, checkpoints and course transitions', () => {
  const hostSim = new Simulation(),
    guestSim = new Simulation();
  const host = new Party(hostSim, callbacks),
    guest = new Party(guestSim, callbacks);
  host.view = { ...host.view, status: 'waiting', host: true, members };
  guest.receiveHost({ type: 'welcome', self: 1, code: 'ABCDEFGH', members });
  host.connections.set(1, {
    open: true,
    dataChannel: { bufferedAmount: 0 },
    send: (data: unknown) => guest.receiveHost(structuredClone(data)),
  } as unknown as DataConnection);
  host.start(0);
  assert.equal(guestSim.state, 'countdown');
  assert.equal(guestSim.playerId, 1);
  for (let i = 0; i < 180 + 120; i++) {
    hostSim.input = { ...EMPTY_INPUT, z: 1 };
    hostSim.humanInputs.set(1, { ...EMPTY_INPUT, z: 1 });
    hostSim.step(1 / 60);
  }
  host.broadcast(captureWorld(hostSim, host.round, 10));
  assert.equal(guestSim.state, 'racing');
  assert.equal(guestSim.player.x, hostSim.racers[1].x);
  assert.equal(guestSim.worldTime, hostSim.worldTime);
  const old = captureWorld(hostSim, host.round, 11);
  host.lobby(4);
  assert.equal(guestSim.state, 'lobby');
  assert.equal(guestSim.course.id, 5);
  host.start(4);
  guest.receiveHost(old);
  assert.equal(guestSim.course.id, 5);
  assert.equal(guestSim.state, 'countdown');
});
void test('race does not end when only the host finishes; both clients see identical places', () => {
  const s = new Simulation();
  s.course = { ...s.course, obstacles: [] };
  s.setHumans([0, 1]);
  s.state = 'racing';
  const gate = s.course.gates!.at(-1)!;
  Object.assign(s.player, {
    x: gate.x,
    z: gate.z,
    progress: s.course.length,
    checkpoint: s.course.checkpoints.at(-1)!,
  });
  s.move(s.player, EMPTY_INPUT, 1 / 60);
  assert.equal(s.state, 'racing');
  assert.equal(s.player.finished, 1);
  const other = s.racers[1];
  Object.assign(other, {
    x: gate.x,
    z: gate.z,
    progress: s.course.length,
    checkpoint: s.course.checkpoints.at(-1)!,
  });
  other.y = 0;
  s.move(other, EMPTY_INPUT, 1 / 60);
  s.step(1 / 60);
  assert.equal(s.state, 'finished');
  assert.equal(other.finished, 2);
  const guest = new Simulation();
  guest.setHumans([0, 1], 1);
  restoreWorld(guest, captureWorld(s, 1, 1));
  assert.equal(guest.player.id, 1);
  assert.equal(guest.player.finished, 2);
  assert.deepEqual(guest.finishOrder, s.finishOrder);
});
void test('congested links retain control packets while old world snapshots can be dropped', () => {
  const room = new Party(new Simulation(), callbacks),
    sent: unknown[] = [];
  const c = {
    open: true,
    dataChannel: { bufferedAmount: 999999 },
    send: (v: unknown) => sent.push(v),
  } as unknown as DataConnection;
  room.send(c, { type: 'world' });
  room.send(c, { type: 'lobby', course: 2, round: 3 });
  room.send(c, { type: 'roster', members });
  assert.equal(sent.length, 2);
});
void test('two human inputs can finish every course with the shared physics', () => {
  for (let course = 0; course < COURSES.length; course++) {
    const s = new Simulation(course);
    s.setHumans([0, 1]);
    s.start();
    for (
      let frame = 0;
      frame < 150 * 60 + 190 && s.state !== 'finished';
      frame++
    ) {
      s.input = s.botInput(s.player);
      s.humanInputs.set(1, s.botInput(s.racers[1]));
      s.step(1 / 60);
    }
    assert.equal(s.state, 'finished');
    assert.ok(s.player.finished > 0, `Host failed ${s.course.name}`);
    assert.ok(s.racers[1].finished > 0, `Guest failed ${s.course.name}`);
  }
});
