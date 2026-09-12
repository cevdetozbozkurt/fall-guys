import { COURSES, type Course, type Obstacle } from './courses.ts';
import { platformHeight } from './course-builder.ts';
import { toLocal, toWorld, routeAt, projectRoute } from './routes.ts';
import { nearbyPlatforms } from './platform-grid.ts';

export type Input = {
  x: number;
  z: number;
  jump: boolean;
  dive: boolean;
  kick?: boolean;
};
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
  progress: number;
  lane: string;
  invincible: number;
  stun: number;
  diveTime: number;
  diveCooldown: number;
  kickCooldown: number;
  kickTime: number;
  dived: boolean;
  finished: number;
  falls: number;
  speed: number;
  lastJump: number;
  finishTime: number;
  sliding: boolean;
};
export type GameState = 'lobby' | 'countdown' | 'racing' | 'finished';
export const EMPTY_INPUT: Input = {
  x: 0,
  z: 0,
  jump: false,
  dive: false,
  kick: false,
};
export const ABILITY_COOLDOWN = 5;
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

function localObstaclePose(o: Obstacle, t: number) {
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
    return { x: o.x + Math.sin(phase) * 3.8, y: base + 1, z: o.z, angle: 0 };
  if (o.type === 'pendulum') {
    const a = Math.sin(phase) * 0.87;
    return {
      x: o.x + Math.sin(a) * 7,
      y: base + 8 - Math.cos(a) * 7,
      z: o.z,
      angle: a,
    };
  }
  if (o.type === 'pusher')
    return { x: o.x + Math.sin(phase) * 3.2, y: 1, z: o.z, angle: 0 };
  return { x: o.x, y: base + 0.65, z: o.z, angle: phase };
}

export function obstaclePose(o: Obstacle, t: number) {
  const p = localObstaclePose({ ...o, x: 0, z: 0 }, t);
  return {
    ...p,
    ...toWorld(o, p.x, p.z),
    angle: o.type === 'bar' ? p.angle - (o.yaw ?? 0) : p.angle,
  };
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
      progress: id === 0 ? 1 : -1 - Math.floor((id - 1) / 4) * 1.7,
      lane: 'start',
      invincible: 1,
      stun: 0,
      diveTime: 0,
      diveCooldown: 0,
      kickCooldown: 0,
      kickTime: 0,
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
            r.id !== this.playerId &&
            (r.finished > 0 || r.progress > this.player.progress),
        ).length
    );
  }
  support(x: number, z: number, maxY = Infinity) {
    let result = -1,
      highest = -Infinity;
    for (const i of nearbyPlatforms(this.course.platforms, x, z)) {
      const p = this.course.platforms[i];
      const local = toLocal(p, x, z);
      const h = platformHeight(p, z, x),
        age = this.worldTime - (this.tiles.get(i) ?? Infinity);
      if (
        Math.abs(local.x) <= p.w / 2 + 0.08 &&
        Math.abs(local.z) <= p.d / 2 + 0.08 &&
        !(age > 0.7 && age < 3.4) &&
        h <= maxY + 0.12 &&
        h > highest
      ) {
        result = i;
        highest = h;
      }
    }
    return result;
  }
  height(x: number, z: number) {
    const i = this.support(x, z);
    return i < 0 ? -Infinity : platformHeight(this.course.platforms[i], z, x);
  }
  botInput(r: Racer): Input {
    const branch = this.course.routes?.find(
      (l) =>
        l.id.endsWith(r.id % 2 ? 'easy' : 'hard') &&
        l.points[0].progress <= r.progress + 5 &&
        l.points[l.points.length - 1].progress > r.progress + 5,
    )?.id;
    const frame = routeAt(this.course, r.progress + 4.5, branch ?? r.lane);
    const here = routeAt(this.course, r.progress, branch ?? r.lane);
    const support = this.support(frame.x, frame.z);
    const halfWidth =
      support < 0 ? 3 : Math.max(1, this.course.platforms[support].w / 2 - 1.2);
    let lateral = 0;
    const ahead = toWorld({ x: r.x, z: r.z, yaw: here.yaw }, 0, 2.35);
    const aheadSupport = this.support(ahead.x, ahead.z);
    let jump = aheadSupport < 0;
    if (
      aheadSupport >= 0 &&
      this.course.platforms[aheadSupport].endY === undefined &&
      this.height(ahead.x, ahead.z) > r.y + 0.5
    )
      jump = true;
    for (const o of this.course.obstacles) {
      const pose = obstaclePose(o, this.worldTime),
        rel = toLocal({ x: r.x, z: r.z, yaw: here.yaw }, pose.x, pose.z);
      if (
        rel.z > -2 &&
        rel.z < 8 &&
        ['bumper', 'pendulum', 'pusher', 'hammer', 'falling'].includes(o.type)
      ) {
        const future = obstaclePose(
          o,
          this.worldTime + clamp(rel.z / r.speed, 0, 0.8),
        );
        const local = toLocal(here, future.x, future.z);
        if (future.y < r.y + 3.5 && future.y > r.y - 2)
          lateral = clamp(
            local.x + (local.x > 0 ? -3.3 : 3.3),
            -halfWidth,
            halfWidth,
          );
      }
      if (o.type === 'hurdle' && rel.z > 0 && rel.z < 3.1) jump = true;
    }
    const target = toWorld(frame, lateral, 0),
      dx = target.x - r.x,
      dz = target.z - r.z,
      len = Math.max(1, Math.hypot(dx, dz));
    const direction = { x: dx / len, z: dz / len };
    for (const o of this.course.obstacles) {
      if (o.type !== 'bar') continue;
      for (const t of [0.15, 0.23, 0.31]) {
        const p = obstaclePose(o, this.worldTime + t);
        const x = r.x + direction.x * r.speed * t - p.x,
          z = r.z + direction.z * r.speed * t - p.z;
        const ux = Math.cos(p.angle),
          uz = Math.sin(p.angle),
          along = clamp(x * ux + z * uz, -(o.radius ?? 5), o.radius ?? 5);
        if (Math.hypot(x - ux * along, z - uz * along) < 1.05) jump = true;
      }
    }
    return { ...direction, jump: jump && r.grounded, dive: false };
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
        this.humanInputs.set(r.id, {
          ...input,
          jump: false,
          dive: false,
          kick: false,
        });
    }
    this.input.jump = false;
    this.input.dive = false;
    this.input.kick = false;
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
    r.diveCooldown = Math.max(0, r.diveCooldown - dt);
    r.kickCooldown = Math.max(0, r.kickCooldown - dt);
    r.kickTime = Math.max(0, r.kickTime - dt);
    r.invincible = Math.max(0, r.invincible - dt);
    r.stun = Math.max(0, r.stun - dt);
    r.diveTime = Math.max(0, r.diveTime - dt);
    r.coyote = r.grounded ? 0.1 : Math.max(0, r.coyote - dt);
    r.jumpBuffer = input.jump ? 0.12 : Math.max(0, r.jumpBuffer - dt);
    if (r.jumpBuffer > 0 && r.coyote > 0 && r.stun <= 0) {
      r.vy = 10.7;
      r.grounded = false;
      r.coyote = 0;
      r.jumpBuffer = 0;
      r.lastJump = this.worldTime;
      if (r.id === this.playerId) this.events.push('jump');
    }
    if (input.kick) this.kick(r, input);
    if (
      input.dive &&
      r.diveCooldown <= 0 &&
      r.stun <= 0 &&
      !r.grounded &&
      !r.dived &&
      r.y > 0
    ) {
      const direction =
        Math.hypot(input.x, input.z) > 0
          ? input
          : Math.hypot(r.vx, r.vz) > 0.5
            ? { x: r.vx, z: r.vz }
            : toWorld(
                {
                  x: 0,
                  z: 0,
                  yaw: routeAt(this.course, r.progress, r.lane).yaw,
                },
                0,
                1,
              );
      const len = Math.hypot(direction.x, direction.z) || 1;
      r.vx += (direction.x / len) * 6;
      r.vz += (direction.z / len) * 6;
      r.vy = Math.max(r.vy, 2);
      r.dived = true;
      r.diveTime = 0.5;
      r.diveCooldown = ABILITY_COOLDOWN;
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
    for (const index of nearbyPlatforms(this.course.platforms, r.x, r.z)) {
      const p = this.course.platforms[index];
      const pos = toLocal(p, r.x, r.z),
        prev = toLocal(p, prevX, prevZ);
      if (Math.abs(pos.x) > p.w / 2 || Math.abs(pos.z) > p.d / 2) continue;
      const height = platformHeight(p, r.z, r.x);
      const previouslyInside =
        Math.abs(prev.x) <= p.w / 2 + 0.08 &&
        Math.abs(prev.z) <= p.d / 2 + 0.08;
      // A diving racer can intersect a rising ramp while still moving upward.
      // Catch crossing its top from above in surface-relative coordinates.
      if (
        p.endY !== undefined &&
        previouslyInside &&
        prevY >= platformHeight(p, prevZ, prevX) - 0.05 &&
        r.y <= height
      ) {
        r.y = height;
        r.vy = 0;
      }
      if (height <= Math.max(prevY, r.y) + 0.02) continue;
      const velocity = toLocal({ x: 0, z: 0, yaw: p.yaw }, r.vx, r.vz);
      if (Math.abs(prev.z) >= p.d / 2) {
        pos.z = prev.z;
        velocity.z = 0;
      }
      if (Math.abs(prev.x) >= p.w / 2) {
        pos.x = prev.x;
        velocity.x = 0;
      }
      const resolved = toWorld(p, pos.x, pos.z),
        v = toWorld({ x: 0, z: 0, yaw: p.yaw }, velocity.x, velocity.z);
      r.x = resolved.x;
      r.z = resolved.z;
      r.vx = v.x;
      r.vz = v.z;
    }
    const support = this.support(r.x, r.z, Math.max(prevY, r.y) + 0.3);
    const floor =
      support >= 0
        ? platformHeight(this.course.platforms[support], r.z, r.x)
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
        const yaw = p.yaw ?? 0,
          forward = r.vx * Math.sin(yaw) + r.vz * Math.cos(yaw),
          push = Math.min(19, forward + 34 * dt) - forward;
        r.vx += push * Math.sin(yaw);
        r.vz += push * Math.cos(yaw);
        r.x += 4 * dt * Math.sin(yaw);
        r.z += 4 * dt * Math.cos(yaw);
      }
      if (p.kind === 'belt') {
        const push = (p.direction ?? 1) * 3 * dt;
        r.x += push * Math.cos(p.yaw ?? 0);
        r.z -= push * Math.sin(p.yaw ?? 0);
      }
      if (p.kind === 'crumble' && !this.tiles.has(support))
        this.tiles.set(support, this.worldTime);
    } else r.grounded = false;
    if (r.y < -10 || Math.abs(r.z) > 1500 || Math.abs(r.x) > 1500) {
      this.respawn(r);
      return;
    }
    if (r.invincible === 0 && r.y > -0.5)
      for (const o of this.course.obstacles) {
        if (this.collide(r, o)) {
          break;
        }
      }
    const projected = projectRoute(this.course, r.x, r.z, r.progress, r.lane);
    if (projected.distance < 18) {
      r.progress = projected.progress;
      r.lane = projected.lane;
    }
    const nextGate = this.course.gates?.find(
      (g) => g.progress > r.checkpoint && g.progress < this.course.length,
    );
    if (nextGate && r.y >= -0.2 && r.y < 10) {
      const local = toLocal(nextGate, r.x, r.z);
      if (
        local.z >= 0 &&
        local.z < 8 &&
        Math.abs(local.x) <= nextGate.halfWidth &&
        r.progress >= nextGate.progress - 1
      ) {
        r.checkpoint = nextGate.progress;
        if (r.id === this.playerId) this.events.push('checkpoint');
      }
    }
    if (!this.course.gates && r.grounded)
      for (const cp of this.course.checkpoints)
        if (r.z >= cp) r.checkpoint = Math.max(r.checkpoint, cp);
    const finishGate = this.course.gates?.at(-1),
      finish = finishGate
        ? toLocal(finishGate, r.x, r.z)
        : { x: r.x, z: r.z - this.course.length };
    if (
      finish.z >= 0 &&
      finish.z < 8 &&
      Math.abs(finish.x) < (finishGate?.halfWidth ?? 8) &&
      r.checkpoint >= (this.course.checkpoints.at(-1) ?? 0) &&
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
  kick(r: Racer, input: Input) {
    if (r.kickCooldown > 0 || r.stun > 0 || r.finished) return;
    r.kickCooldown = ABILITY_COOLDOWN;
    r.kickTime = 0.3;
    const velocity =
      Math.hypot(input.x, input.z) > 0.1
        ? input
        : Math.hypot(r.vx, r.vz) > 0.5
          ? { x: r.vx, z: r.vz }
          : toWorld(
              { x: 0, z: 0, yaw: routeAt(this.course, r.progress, r.lane).yaw },
              0,
              1,
            );
    const length = Math.hypot(velocity.x, velocity.z) || 1;
    const forward = { x: velocity.x / length, z: velocity.z / length };
    const target = this.racers
      .filter((other) => {
        const dx = other.x - r.x,
          dz = other.z - r.z,
          distance = Math.hypot(dx, dz);
        return (
          other.id !== r.id &&
          !other.finished &&
          other.invincible <= 0 &&
          Math.abs(other.y - r.y) < 1.7 &&
          distance < 2.8 &&
          (distance < 0.1 || (dx * forward.x + dz * forward.z) / distance > 0.2)
        );
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z),
      )[0];
    if (r.id === this.playerId) this.events.push('kick');
    if (!target) return;
    target.stun = 1;
    target.vx = forward.x * 8;
    target.vz = forward.z * 8;
    target.vy = Math.max(target.vy, 3);
    target.grounded = false;
    if (target.id === this.playerId) this.events.push('hit');
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
      hit = Math.hypot(nx, nz) < 0.87 && r.y - (o.y ?? 0) < 1.08;
    } else if (o.type === 'hurdle' || o.type === 'pusher') {
      const width = o.width ?? 4;
      const local = toLocal({ x: p.x, z: p.z, yaw: o.yaw }, r.x, r.z);
      hit =
        Math.abs(local.x) < width / 2 + 0.45 &&
        Math.abs(local.z) < 0.9 &&
        r.y - (o.y ?? 0) < (o.type === 'hurdle' ? 0.9 : 2);
      if (hit) {
        const normal = toWorld(
          { x: 0, z: 0, yaw: o.yaw },
          Math.abs(local.x) > width / 2 ? Math.sign(local.x) : 0,
          Math.sign(local.z) || -1,
        );
        nx = normal.x;
        nz = normal.z;
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
    const frame = routeAt(this.course, r.checkpoint || 1);
    const point = toWorld(frame, r.id === 0 ? 0 : ((r.id % 3) - 1) * 1.2, 0);
    r.x = point.x;
    r.z = point.z;
    r.progress = r.checkpoint || 1;
    r.lane = frame.lane;
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
