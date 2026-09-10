import { COURSES, type Course, type Obstacle } from './courses.ts';
import { platformHeight } from './course-builder.ts';

export type Input = { x: number; z: number; jump: boolean; dive: boolean };
export type Racer = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  coyote: number;
  jumpBuffer: number;
  checkpoint: number;
  invincible: number;
  stun: number;
  diveTime: number;
  dived: boolean;
  finished: number;
  falls: number;
  speed: number;
  lastJump: number;
  finishTime: number;
  sliding: boolean;
};
export type GameState = 'lobby' | 'countdown' | 'racing' | 'finished';
export const EMPTY_INPUT: Input = { x: 0, z: 0, jump: false, dive: false };
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

export function obstaclePose(o: Obstacle, t: number) {
  const phase = t * (o.speed ?? 1) + (o.phase ?? 0);
  const base = o.y ?? 0;
  if (o.type === 'falling') {
    const cycle = ((phase % 3.6) + 3.6) % 3.6;
    return {
      x: o.x,
      y:
        base + (cycle < 1.6 ? 12 : cycle < 2.6 ? 12 * (1 - (cycle - 1.6)) : -4),
      z: o.z,
      angle: phase,
      warning: cycle < 2.6,
    };
  }
  if (o.type === 'hammer') {
    const a = Math.sin(phase) * 1.12;
    return {
      x: o.x + Math.sin(a) * 5.5,
      y: base + 6.2 - Math.cos(a) * 5.5,
      z: o.z,
      angle: a,
    };
  }
  if (o.type === 'bumper')
    return { x: o.x + Math.sin(phase) * 3.8, y: 1, z: o.z, angle: 0 };
  if (o.type === 'pendulum') {
    const a = Math.sin(phase) * 0.87;
    return {
      x: o.x + Math.sin(a) * 7,
      y: 8 - Math.cos(a) * 7,
      z: o.z,
      angle: a,
    };
  }
  if (o.type === 'pusher')
    return { x: o.x + Math.sin(phase) * 3.2, y: 1, z: o.z, angle: 0 };
  return { x: o.x, y: 0.65, z: o.z, angle: phase };
}

export class Simulation {
  playerId = 0;
  multiplayer = false;
  humanIds = new Set<number>();
  humanInputs = new Map<number, Input>();
  course: Course;
  racers: Racer[] = [];
  state: GameState = 'lobby';
  time = 0;
  countdown = 3;
  worldTime = 0;
  finishOrder: number[] = [];
  tiles = new Map<number, number>();
  events: string[] = [];
  paused = false;
  input: Input = { ...EMPTY_INPUT };
  constructor(index: number | Course = 0) {
    this.course = typeof index === 'number' ? COURSES[index] : index;
    this.reset(index);
  }
  reset(index: number | Course) {
    this.playerId = 0;
    this.multiplayer = false;
    this.humanIds.clear();
    this.humanInputs.clear();
    this.course =
      typeof index === 'number' ? (COURSES[index] ?? COURSES[0]) : index;
    this.state = 'lobby';
    this.time = 0;
    this.countdown = 3;
    this.worldTime = 0;
    this.finishOrder = [];
    this.tiles.clear();
    this.events = [];
    this.paused = false;
    this.input = { ...EMPTY_INPUT };
    this.racers = Array.from({ length: 12 }, (_, id) => ({
      id,
      x: id === 0 ? 0 : (((id - 1) % 4) - 1.5) * 2,
      z: id === 0 ? 1 : -1 - Math.floor((id - 1) / 4) * 1.7,
      y: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
      coyote: 0.1,
      jumpBuffer: 0,
      checkpoint: 0,
      invincible: 1,
      stun: 0,
      diveTime: 0,
      dived: false,
      finished: 0,
      falls: 0,
      speed: id === 0 ? 10 : 7.7 + (id % 5) * 0.33,
      lastJump: -2,
      finishTime: 0,
      sliding: false,
    }));
  }
  start() {
    this.state = 'countdown';
    this.countdown = 3;
    this.input = { ...EMPTY_INPUT };
  }
  get player() {
    return this.racers[this.playerId];
  }
  setHumans(ids: number[], localId = 0) {
    this.playerId = localId;
    this.multiplayer = true;
    this.humanIds = new Set(ids);
    for (const r of this.racers) if (this.humanIds.has(r.id)) r.speed = 10;
  }
  get rank() {
    return (
      this.player.finished ||
      1 +
        this.racers.filter(
          (r) =>
            r.id !== this.playerId && (r.finished > 0 || r.z > this.player.z),
        ).length
    );
  }
  support(x: number, z: number, maxY = Infinity) {
    let result = -1,
      highest = -Infinity;
    this.course.platforms.forEach((p, i) => {
      const h = platformHeight(p, z),
        age = this.worldTime - (this.tiles.get(i) ?? Infinity);
      if (
        Math.abs(x - p.x) <= p.w / 2 + 0.08 &&
        Math.abs(z - p.z) <= p.d / 2 + 0.08 &&
        !(age > 0.7 && age < 3.4) &&
        h <= maxY + 0.12 &&
        h > highest
      ) {
        result = i;
        highest = h;
      }
    });
    return result;
  }
  height(x: number, z: number) {
    const i = this.support(x, z);
    return i < 0 ? -Infinity : platformHeight(this.course.platforms[i], z);
  }
  botInput(r: Racer): Input {
    let target = ((r.id % 5) - 2) * 1.2;
    const next = this.course.platforms
      .filter((p) => p.z + p.d / 2 > r.z + 4 && p.z - p.d / 2 < r.z + 5)
      .sort((a, b) => Math.abs(a.x - r.x) - Math.abs(b.x - r.x))[0];
    if (next)
      target = clamp(target, next.x - next.w / 2 + 1, next.x + next.w / 2 - 1);
    let jump = this.support(r.x, r.z + 2.4) < 0;
    const aheadSupport = this.support(r.x, r.z + 2.2);
    if (
      aheadSupport >= 0 &&
      this.course.platforms[aheadSupport].endY === undefined &&
      this.height(r.x, r.z + 2.2) > r.y + 0.5
    )
      jump = true;
    for (const o of this.course.obstacles) {
      const p = obstaclePose(o, this.worldTime);
      const dist = o.z - r.z;
      if (
        dist > -3.2 &&
        dist < 7 &&
        (o.type === 'bumper' ||
          o.type === 'pendulum' ||
          o.type === 'pusher' ||
          o.type === 'hammer' ||
          o.type === 'falling')
      )
        target = clamp(p.x + (r.x < p.x ? -3.6 : 3.6), -5.5, 5.5);
      if (o.type === 'hurdle' && dist > 0 && dist < 2.9) jump = true;
      if (
        o.type === 'bar' &&
        Math.abs(dist) < (o.radius ?? 5) + 1 &&
        this.worldTime - r.lastJump > 1.05
      )
        jump = true;
    }
    const ahead = this.course.platforms.find(
      (p) => Math.abs(r.z + 3 - p.z) <= p.d / 2 && p.w < 8,
    );
    if (ahead) target = clamp(target, -1.4, 1.4);
    return {
      x: clamp((target - r.x) * 1.7, -1, 1),
      z: 1,
      jump: jump && r.grounded,
      dive: false,
    };
  }
  step(dt: number) {
    if (this.paused) return;
    this.worldTime += dt;
    for (const [i, t] of this.tiles)
      if (this.worldTime - t >= 3.4) this.tiles.delete(i);
    if (this.state === 'lobby' || this.state === 'finished') return;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.events.push('go');
      }
      return;
    }
    this.time += dt;
    for (const r of this.racers) {
      if (r.finished) continue;
      const input =
        r.id === this.playerId
          ? this.input
          : this.humanIds.has(r.id)
            ? (this.humanInputs.get(r.id) ?? EMPTY_INPUT)
            : this.botInput(r);
      this.move(r, input, dt);
      if (this.humanInputs.has(r.id))
        this.humanInputs.set(r.id, { ...input, jump: false, dive: false });
    }
    this.input.jump = false;
    this.input.dive = false;
    if (
      this.multiplayer &&
      [...this.humanIds].every((id) => this.racers[id].finished > 0)
    )
      this.state = 'finished';
    if (this.time >= 150 && (this.multiplayer || !this.player.finished)) {
      this.state = 'finished';
      this.events.push('timeout');
    }
  }
  move(r: Racer, input: Input, dt: number) {
    r.invincible = Math.max(0, r.invincible - dt);
    r.stun = Math.max(0, r.stun - dt);
    r.diveTime = Math.max(0, r.diveTime - dt);
    r.coyote = r.grounded ? 0.1 : Math.max(0, r.coyote - dt);
    r.jumpBuffer = input.jump ? 0.12 : Math.max(0, r.jumpBuffer - dt);
    if (r.jumpBuffer > 0 && r.coyote > 0) {
      r.vy = 10.7;
      r.grounded = false;
      r.coyote = 0;
      r.jumpBuffer = 0;
      r.lastJump = this.worldTime;
      if (r.id === this.playerId) this.events.push('jump');
    }
    if (input.dive && !r.grounded && !r.dived && r.y > 0) {
      const len = Math.hypot(input.x, input.z) || 1;
      r.vx += (input.x / len) * 6;
      r.vz += (input.z === 0 ? 1 : input.z / len) * 6;
      r.vy = Math.max(r.vy, 2);
      r.dived = true;
      r.diveTime = 0.5;
      if (r.id === this.playerId) this.events.push('dive');
    }
    const len = Math.max(1, Math.hypot(input.x, input.z));
    const accel = r.sliding ? 9 : r.grounded ? 36 : 20;
    const factor = r.stun > 0 ? 0.12 : r.diveTime > 0 ? 0.25 : 1;
    const tx = (input.x / len) * r.speed,
      tz = (input.z / len) * r.speed;
    r.vx += clamp(tx - r.vx, -accel * dt, accel * dt) * factor;
    r.vz += clamp(tz - r.vz, -accel * dt, accel * dt) * factor;
    const prevY = r.y,
      prevX = r.x,
      prevZ = r.z,
      wasGrounded = r.grounded;
    r.vy -= 26 * dt;
    r.x += r.vx * dt;
    r.z += r.vz * dt;
    r.y += r.vy * dt;
    // Solid ledge faces require a jump; gradual ramps can be walked up.
    for (const p of this.course.platforms) {
      if (Math.abs(r.x - p.x) > p.w / 2 || Math.abs(r.z - p.z) > p.d / 2)
        continue;
      if (platformHeight(p, r.z) <= Math.max(prevY, r.y) + 0.35) continue;
      if (Math.abs(prevZ - p.z) >= p.d / 2) {
        r.z = prevZ;
        r.vz = 0;
      }
      if (Math.abs(prevX - p.x) >= p.w / 2) {
        r.x = prevX;
        r.vx = 0;
      }
    }
    const support = this.support(r.x, r.z, Math.max(prevY, r.y) + 0.3);
    const floor =
      support >= 0
        ? platformHeight(this.course.platforms[support], r.z)
        : -Infinity;
    r.sliding = false;
    if (
      support >= 0 &&
      r.y <= floor + (wasGrounded ? 0.32 : 0) &&
      prevY >= floor - 0.4 &&
      r.vy <= 0
    ) {
      r.y = floor;
      r.vy = 0;
      r.grounded = true;
      r.dived = false;
      const p = this.course.platforms[support];
      if (p.kind === 'slide') {
        r.sliding = true;
        r.vz = Math.min(19, r.vz + 34 * dt);
        r.z += 4 * dt;
      }
      if (p.kind === 'belt') r.x += (p.direction ?? 1) * 3 * dt;
      if (p.kind === 'crumble' && !this.tiles.has(support))
        this.tiles.set(support, this.worldTime);
    } else r.grounded = false;
    if (r.y < -10 || r.z < -12 || Math.abs(r.x) > 30) {
      this.respawn(r);
      return;
    }
    if (r.invincible === 0 && r.y > -0.5)
      for (const o of this.course.obstacles) {
        if (this.collide(r, o)) {
          break;
        }
      }
    if (r.grounded)
      for (const cp of this.course.checkpoints)
        if (r.z >= cp && r.checkpoint < cp) {
          r.checkpoint = cp;
          if (r.id === this.playerId) this.events.push('checkpoint');
        }
    if (
      r.z >= this.course.length &&
      r.y >= floor &&
      r.y < floor + 2.5 &&
      support >= 0
    ) {
      r.finished = this.finishOrder.length + 1;
      r.finishTime = this.time;
      this.finishOrder.push(r.id);
      if (r.id === this.playerId) {
        if (!this.multiplayer) this.state = 'finished';
        this.events.push('finish');
      }
    }
  }
  collide(r: Racer, o: Obstacle) {
    const p = obstaclePose(o, this.worldTime);
    const dx = r.x - p.x,
      dz = r.z - p.z;
    let nx = dx,
      nz = dz,
      hit = false;
    if (o.type === 'bar') {
      const ux = Math.cos(p.angle),
        uz = Math.sin(p.angle),
        along = clamp(dx * ux + dz * uz, -(o.radius ?? 5), o.radius ?? 5);
      nx = dx - ux * along;
      nz = dz - uz * along;
      hit = Math.hypot(nx, nz) < 0.87 && r.y < 1.08;
    } else if (o.type === 'hurdle' || o.type === 'pusher') {
      const width = o.width ?? 4;
      hit =
        Math.abs(dx) < width / 2 + 0.45 &&
        Math.abs(dz) < 0.9 &&
        r.y < (o.type === 'hurdle' ? 0.9 : 2);
      if (hit) {
        nx = Math.abs(dx) > width / 2 ? Math.sign(dx) : 0;
        nz = Math.sign(dz) || -1;
      }
    } else {
      hit =
        Math.hypot(dx, dz) < (o.radius ?? 1.5) + 0.48 &&
        Math.abs(r.y + 0.8 - p.y) < (o.radius ?? 1.5) + 0.6;
    }
    if (!hit) return false;
    const norm = Math.hypot(nx, nz) || 1;
    r.vx = (nx / norm) * 12;
    r.vz = (nz / norm) * 10;
    r.vy = 6.2;
    r.grounded = false;
    r.stun = 0.36;
    r.invincible = 0.8;
    r.x += (nx / norm) * 0.25;
    r.z += (nz / norm) * 0.25;
    if (r.id === this.playerId) this.events.push('hit');
    return true;
  }
  respawn(r: Racer) {
    r.x = r.id === 0 ? 0 : ((r.id % 3) - 1) * 1.2;
    r.z = r.checkpoint || 1;
    r.y = 1;
    r.vx = 0;
    r.vz = 0;
    r.vy = 0;
    r.grounded = false;
    r.coyote = 0;
    r.jumpBuffer = 0;
    r.invincible = 1.5;
    r.stun = 0;
    r.diveTime = 0;
    r.dived = false;
    r.sliding = false;
    r.y = Math.max(0, this.height(r.x, r.z)) + 1;
    r.falls++;
    if (r.id === this.playerId) this.events.push('fall');
  }
}
