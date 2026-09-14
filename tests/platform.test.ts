import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import type Peer from 'peerjs';
import { Party, captureWorld, isWorld } from '../lib/multiplayer.ts';
import { MatchPeer } from '../lib/match-peer.ts';
import { Simulation, EMPTY_INPUT, obstaclePose } from '../lib/simulation.ts';
import { buildCourse, platformHeight } from '../lib/course-builder.ts';
import {
  cameraInput,
  toWorld,
  toLocal,
  routeAt,
  projectRoute,
  wrapAngle,
} from '../lib/routes.ts';
import { DEFAULT_COSMETICS, normalizeCosmetics } from '../lib/cosmetics.ts';
import { parseQueueStatus, type MatchAssignment } from '../lib/backend.ts';

void test('rotated ramps, hazards and camera input share the same coordinate frame', () => {
  for (const yaw of [-Math.PI / 2, Math.PI / 2, Math.PI, 0.73]) {
    const frame = { x: 40, z: -22, yaw };
    const world = toWorld(frame, 2, 5),
      local = toLocal(frame, world.x, world.z);
    assert.ok(Math.abs(local.x - 2) < 1e-9 && Math.abs(local.z - 5) < 1e-9);
    assert.equal(
      Math.round(
        platformHeight(
          { ...frame, w: 6, d: 10, y: 0, endY: 6 },
          world.z,
          world.x,
        ),
      ),
      6,
    );
    const input = cameraInput(0, 1, yaw);
    assert.ok(Math.abs(input.x - Math.sin(yaw)) < 1e-9);
    assert.ok(
      Math.hypot(...Object.values(cameraInput(1, 1, yaw))) <= 1.000000001,
    );
    const base = obstaclePose(
      { type: 'hammer', x: 0, z: 0, speed: 1, y: 4 },
      0.4,
    );
    const rotated = obstaclePose(
      { type: 'hammer', ...frame, speed: 1, y: 4 },
      0.4,
    );
    const expected = toWorld(frame, base.x, base.z);
    assert.ok(
      Math.hypot(rotated.x - expected.x, rotated.z - expected.z) < 1e-9,
    );
    assert.equal(rotated.y, base.y);
  }
  assert.ok(Math.abs(wrapAngle(-Math.PI + 0.1 - (Math.PI - 0.1)) - 0.2) < 1e-9);
});

void test('branch routes differ in length and progress projection cannot skip a switchback', () => {
  const course = buildCourse({
    version: 1,
    name: 'Branches',
    segments: [
      { type: 'fork', difficulty: 3 },
      { type: 'left', difficulty: 3 },
      { type: 'right', difficulty: 3 },
    ],
  });
  const forks = course.routes!.filter((r) => r.id.startsWith('fork-'));
  assert.equal(forks.length, 2);
  const length = (points: (typeof forks)[0]['points']) =>
    points
      .slice(1)
      .reduce(
        (sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z),
        0,
      );
  assert.notEqual(length(forks[0].points), length(forks[1].points));
  const sample = routeAt(course, 42, forks[1].id);
  assert.equal(
    projectRoute(course, sample.x, sample.z, 40, forks[1].id).lane,
    forks[1].id,
  );
  assert.ok(projectRoute(course, 500, 500, 5).progress <= 19);
  const s = new Simulation(course),
    gate = course.gates!.at(-1)!;
  Object.assign(s.player, {
    x: gate.x,
    z: gate.z,
    progress: course.length,
    y: 0,
  });
  s.move(s.player, EMPTY_INPUT, 1 / 60);
  assert.equal(
    s.player.finished,
    0,
    'Finish requires every ordered checkpoint',
  );
});

void test('cosmetics and network state reject malformed values', () => {
  assert.deepEqual(
    normalizeCosmetics({
      color: 'red',
      body: 'giant',
      head: 'script',
      eyes: 'laser',
    }),
    DEFAULT_COSMETICS,
  );
  const world = captureWorld(new Simulation(), 1, 1);
  world.state = 'racing';
  world.racers[0].x = 120;
  world.racers[0].z = -100;
  assert.equal(
    isWorld(world),
    true,
    'Curved courses allow negative coordinates',
  );
  world.racers[0].progress = Infinity;
  assert.equal(isWorld(world), false);
  assert.throws(() => parseQueueStatus({ state: 'searching', players: 6 }));
  assert.deepEqual(parseQueueStatus({ state: 'searching', players: 1 }), {
    state: 'searching',
    target: 5,
    players: 1,
  });
});

class FakePeer extends EventEmitter {
  id = 'test-host';
  open = true;
  destroyed = false;
  destroy() {
    this.destroyed = true;
  }
}
class FakeConnection extends EventEmitter {
  open = true;
  peer: string;
  packets: unknown[] = [];
  dataChannel = { bufferedAmount: 0 };
  constructor(id: number) {
    super();
    this.peer = `test-peer-${id}`;
  }
  send(data: unknown) {
    this.packets.push(data);
  }
  close() {
    this.open = false;
    this.emit('close');
  }
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
void test('five public players validate tickets, retry start, remove departed guests, and ignore closed-room input', async () => {
  let now = 1000,
    calls = 0;
  const peer = new FakePeer(),
    lease = new MatchPeer(peer as unknown as Peer);
  const assignment: MatchAssignment = {
    state: 'matched',
    matchId: 'match',
    roomCode: 'ABCDEF123456',
    hostUserId: 'u0',
    hostPeerId: peer.id,
    phase: 'connecting',
    userId: 'u0',
    slot: 0,
    ticket: 'ticket0',
    expiresAt: '',
    members: Array.from({ length: 5 }, (_, id) => ({
      userId: `u${id}`,
      slot: id,
      username: `Player${id}`,
      cosmetics: { ...DEFAULT_COSMETICS, head: id === 1 ? 'crown' : 'none' },
      accepted: id === 0,
    })),
  };
  const sim = new Simulation();
  const room = new Party(
    sim,
    { change: () => {}, prepare: () => {}, roster: () => {}, ended: () => {} },
    () => now,
  );
  const early = new FakeConnection(1);
  peer.emit('connection', early);
  early.emit('data', {
    type: 'join',
    protocol: 5,
    userId: 'u1',
    matchId: 'match',
    ticket: 'ticket1',
  });
  const validation = async (user: string, ticket: string, id: string) => ({
    accepted:
      ticket === `ticket${user.slice(1)}` &&
      id === `test-peer-${user.slice(1)}`,
    slot: Number(user.slice(1)),
  });
  room.connect(true, 'Player0', 0, '', DEFAULT_COSMETICS, {
    lease,
    assignment,
    validate: validation,
    start: async () => {
      if (++calls === 1) throw new Error('Temporary outage');
    },
  });
  await settle();
  const forged = new FakeConnection(2);
  peer.emit('connection', forged);
  forged.emit('data', {
    type: 'join',
    protocol: 5,
    userId: 'u2',
    matchId: 'match',
    ticket: 'forged',
  });
  await settle();
  assert.equal(forged.open, false);
  const connections = [early];
  for (let id = 2; id < 5; id++) {
    const c = new FakeConnection(id);
    connections.push(c);
    peer.emit('connection', c);
    c.emit('data', {
      type: 'join',
      protocol: 5,
      userId: `u${id}`,
      matchId: 'match',
      ticket: `ticket${id}`,
    });
    await settle();
  }
  assert.equal(room.view.members.length, 5);
  assert.equal(room.view.members[1].cosmetics?.head, 'crown');
  assert.equal(room.round, 0);
  now += 3001;
  room.tick(1 / 60);
  await settle();
  assert.equal(calls, 2);
  assert.equal(room.round, 1);
  room.updateAssignment({
    ...assignment,
    phase: 'playing',
    members: assignment.members.filter((m) => m.slot !== 4),
  });
  assert.equal(connections[3].open, false);
  assert.equal(room.view.members.length, 4);
  assert.equal(room.closed, false);
  room.close(false, true);
  assert.equal(peer.destroyed, false);
  assert.equal(lease.buffering, true);
  early.emit('data', {
    type: 'input',
    round: room.round,
    sequence: 50,
    input: { x: 1, z: 1, jump: true, dive: false },
  });
  assert.equal(sim.humanInputs.size, 0);
  lease.destroy();
});
