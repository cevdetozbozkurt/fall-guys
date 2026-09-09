import Peer, { type DataConnection } from 'peerjs';
import {
  Simulation,
  EMPTY_INPUT,
  type Input,
  type Racer,
  type GameState,
} from './simulation.ts';
import { COURSES } from './courses.ts';

export type Member = { id: number; name: string; color: number; host: boolean };
export type PartyView = {
  status:
    | 'offline'
    | 'connecting'
    | 'waiting'
    | 'racing'
    | 'finished'
    | 'error';
  code: string;
  host: boolean;
  self: number;
  members: Member[];
  error: string;
  round: number;
};
export const EMPTY_PARTY: PartyView = {
  status: 'offline',
  code: '',
  host: false,
  self: 0,
  members: [],
  error: '',
  round: 0,
};
export type WorldPacket = {
  type: 'world';
  round: number;
  sequence: number;
  course: number;
  state: GameState;
  time: number;
  countdown: number;
  worldTime: number;
  racers: Racer[];
  tiles: [number, number][];
  finishOrder: number[];
};
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const cleanCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 8);
export const cleanName = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/[<>]/g, '')
        .split('')
        .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
        .join('')
        .trim()
        .slice(0, 20) || 'Tumbler'
    : 'Tumbler';
export function makeCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => CODE_ALPHABET[n % CODE_ALPHABET.length],
  ).join('');
}
export function validateInput(value: unknown): Input | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.x !== 'number' ||
    typeof v.z !== 'number' ||
    !Number.isFinite(v.x) ||
    !Number.isFinite(v.z) ||
    typeof v.jump !== 'boolean' ||
    typeof v.dive !== 'boolean'
  )
    return null;
  return {
    x: Math.max(-1, Math.min(1, v.x)),
    z: Math.max(-1, Math.min(1, v.z)),
    jump: v.jump,
    dive: v.dive,
  };
}
export function captureWorld(
  sim: Simulation,
  round: number,
  sequence: number,
): WorldPacket {
  return {
    type: 'world',
    round,
    sequence,
    course: sim.course.id - 1,
    state: sim.state,
    time: sim.time,
    countdown: sim.countdown,
    worldTime: sim.worldTime,
    racers: sim.racers.map((r) => ({ ...r })),
    tiles: [...sim.tiles],
    finishOrder: [...sim.finishOrder],
  };
}
export function isWorld(value: unknown): value is WorldPacket {
  if (!value || typeof value !== 'object') return false;
  const v = value as WorldPacket;
  return (
    v.type === 'world' &&
    Number.isInteger(v.round) &&
    Number.isInteger(v.sequence) &&
    Number.isInteger(v.course) &&
    v.course >= 0 &&
    v.course < 10 &&
    ['countdown', 'racing', 'finished'].includes(v.state) &&
    Number.isFinite(v.time) &&
    Number.isFinite(v.worldTime) &&
    Number.isFinite(v.countdown) &&
    Array.isArray(v.racers) &&
    v.racers.length === 12 &&
    v.racers.every(
      (r, i) =>
        r &&
        typeof r === 'object' &&
        r.id === i &&
        [
          'x',
          'y',
          'z',
          'vx',
          'vy',
          'vz',
          'finished',
          'falls',
          'checkpoint',
          'diveTime',
          'stun',
          'speed',
          'finishTime',
        ].every((k) => Number.isFinite(r[k as keyof Racer])) &&
        Math.abs(r.x) < 100 &&
        Math.abs(r.z) < 300,
    ) &&
    Array.isArray(v.tiles) &&
    v.tiles.length < 200 &&
    v.tiles.every(
      (t) =>
        Array.isArray(t) &&
        t.length === 2 &&
        Number.isInteger(t[0]) &&
        Number.isFinite(t[1]),
    ) &&
    Array.isArray(v.finishOrder) &&
    v.finishOrder.length <= 12 &&
    v.finishOrder.every((n) => Number.isInteger(n) && n >= 0 && n < 12)
  );
}
export function restoreWorld(sim: Simulation, packet: WorldPacket) {
  const previousState = sim.state;
  const old = sim.player;
  const prev = {
    falls: old.falls,
    checkpoint: old.checkpoint,
    finished: old.finished,
  };
  sim.state = packet.state;
  sim.time = packet.time;
  sim.countdown = packet.countdown;
  sim.worldTime = packet.worldTime;
  sim.racers = packet.racers.map((r) => ({ ...r }));
  sim.tiles = new Map(packet.tiles);
  sim.finishOrder = [...packet.finishOrder];
  if (previousState === 'countdown' && sim.state === 'racing')
    sim.events.push('go');
  if (
    previousState !== 'finished' &&
    sim.state === 'finished' &&
    !sim.player.finished
  )
    sim.events.push('timeout');
  if (sim.player.falls > prev.falls) sim.events.push('fall');
  if (sim.player.checkpoint > prev.checkpoint) sim.events.push('checkpoint');
  if (sim.player.finished && !prev.finished) sim.events.push('finish');
}

type Callbacks = {
  change: (view: PartyView) => void;
  prepare: (course: number) => void;
  roster: (members: Member[], self: number) => void;
  ended: (reason: string) => void;
};
// A single browser owns the simulation. Guests submit controls, never positions or wins.
export class Party {
  sim: Simulation;
  callbacks: Callbacks;
  view: PartyView = { ...EMPTY_PARTY };
  peer: Peer | null = null;
  connections = new Map<number, DataConnection>();
  server: DataConnection | null = null;
  round = 0;
  sequence = 0;
  lastSequence = -1;
  lastPacket = 0;
  lastBroadcast = 0;
  lastInput = 0;
  pendingJump = false;
  pendingDive = false;
  closed = false;
  timer: ReturnType<typeof setTimeout> | null = null;
  inputTimes = new Map<number, number>();
  inputSequences = new Map<number, number>();
  respawnTimes = new Map<number, number>();
  constructor(sim: Simulation, callbacks: Callbacks) {
    this.sim = sim;
    this.callbacks = callbacks;
  }
  emit(change: Partial<PartyView> = {}) {
    this.view = { ...this.view, ...change };
    this.callbacks.change({ ...this.view, members: [...this.view.members] });
  }
  connect(host: boolean, name: string, color: number, code = '') {
    this.closed = false;
    this.emit({
      status: 'connecting',
      host,
      code: host ? makeCode() : cleanCode(code),
      error: '',
      members: [],
      self: 0,
    });
    if (!host && this.view.code.length !== 8) {
      this.fail('Enter the eight-character room code from your friend.');
      return;
    }
    this.peer = host
      ? new Peer(`tumble-club-v1-${this.view.code}`, { debug: 0 })
      : new Peer({ debug: 0 });
    this.timer = setTimeout(
      () =>
        this.fail(
          'The room could not connect. Check the code and that the host is online. A restrictive network or VPN may block the connection.',
        ),
      20000,
    );
    this.peer.on('error', (err) => {
      const type = err.type;
      this.fail(
        type === 'peer-unavailable'
          ? 'That room is not online. Ask your friend to create a room and share its new code.'
          : type === 'unavailable-id'
            ? 'That room code is already in use. Try creating another room.'
            : 'The multiplayer connection failed. Try again, or try another network.',
      );
    });
    this.peer.on('disconnected', () => {
      if (!this.closed)
        this.emit({
          error:
            'The room directory disconnected. Existing racers can continue; new friends may need a new room.',
        });
    });
    this.peer.on('open', () => {
      if (this.closed) return;
      if (host) {
        this.clearTimer();
        this.view.self = 0;
        this.view.members = [
          { id: 0, name: cleanName(name), color, host: true },
        ];
        this.sim.setHumans([0]);
        this.emit({ status: 'waiting' });
        this.callbacks.roster(this.view.members, 0);
      } else {
        const c = this.peer!.connect(`tumble-club-v1-${this.view.code}`, {
          reliable: true,
          serialization: 'json',
        });
        this.server = c;
        c.on('open', () =>
          this.send(c, {
            type: 'join',
            name: cleanName(name),
            color,
            protocol: 1,
          }),
        );
        c.on('data', (data) => this.receiveHost(data));
        c.on('close', () => {
          if (!this.closed)
            this.fail(
              'The host left the room. Create or join another room to keep racing.',
            );
        });
        c.on('error', () => {
          if (!this.closed)
            this.fail(
              'The connection to your host was lost. Please rejoin the room.',
            );
        });
      }
    });
    this.peer.on('connection', (c) => {
      if (!host) {
        c.close();
        return;
      }
      let id = -1;
      const timeout = setTimeout(() => {
        if (id < 0) c.close();
      }, 10000);
      c.on('data', (data) => {
        if (!data || typeof data !== 'object') return;
        const m = data as Record<string, unknown>;
        if (id < 0) {
          if (m.type !== 'join' || m.protocol !== 1) {
            this.send(c, {
              type: 'error',
              message: 'Please reload the game before joining.',
            });
            c.close();
            return;
          }
          if (this.view.status !== 'waiting') {
            this.send(c, {
              type: 'error',
              message:
                'This race has already started. Ask the host to return to the room first.',
            });
            setTimeout(() => c.close(), 150);
            return;
          }
          if (this.view.members.length >= 8) {
            this.send(c, {
              type: 'error',
              message: 'This room is full (8 players).',
            });
            setTimeout(() => c.close(), 150);
            return;
          }
          id = Array.from({ length: 8 }, (_, i) => i).find(
            (n) => !this.view.members.some((member) => member.id === n),
          )!;
          clearTimeout(timeout);
          this.connections.set(id, c);
          this.view.members.push({
            id,
            name: cleanName(m.name),
            color:
              typeof m.color === 'number' &&
              Number.isInteger(m.color) &&
              m.color >= 0 &&
              m.color < 6
                ? m.color
                : id % 6,
            host: false,
          });
          this.sim.setHumans(this.view.members.map((p) => p.id));
          this.send(c, {
            type: 'welcome',
            self: id,
            code: this.view.code,
            members: this.view.members,
          });
          this.roster();
          return;
        }
        if (m.type === 'leave') {
          c.close();
          return;
        }
        if (m.type === 'input') {
          const now = performance.now();
          if (
            m.round !== this.round ||
            typeof m.sequence !== 'number' ||
            !Number.isInteger(m.sequence) ||
            m.sequence <= (this.inputSequences.get(id) ?? -1)
          )
            return;
          const input = validateInput(m.input);
          if (!input) return;
          const old = this.sim.humanInputs.get(id);
          input.jump ||= old?.jump ?? false;
          input.dive ||= old?.dive ?? false;
          this.sim.humanInputs.set(id, input);
          this.inputTimes.set(id, now);
          this.inputSequences.set(id, m.sequence);
        }
        if (
          m.type === 'respawn' &&
          m.round === this.round &&
          this.sim.state === 'racing' &&
          performance.now() - (this.respawnTimes.get(id) ?? -1000) > 800
        ) {
          this.sim.respawn(this.sim.racers[id]);
          this.respawnTimes.set(id, performance.now());
        }
      });
      c.on('close', () => {
        clearTimeout(timeout);
        if (id >= 0 && !this.closed) {
          this.connections.delete(id);
          this.view.members = this.view.members.filter((p) => p.id !== id);
          this.sim.humanIds.delete(id);
          this.sim.humanInputs.delete(id);
          this.inputTimes.delete(id);
          this.inputSequences.delete(id);
          this.roster();
        }
      });
      c.on('error', () => c.close());
    });
  }
  validRoster(m: unknown): m is Member[] {
    return (
      Array.isArray(m) &&
      m.length > 0 &&
      m.length <= 8 &&
      m.every((p) => p && typeof p === 'object') &&
      new Set(m.map((p) => p.id)).size === m.length &&
      m.every(
        (p) =>
          Number.isInteger(p.id) &&
          p.id >= 0 &&
          p.id < 8 &&
          typeof p.name === 'string' &&
          p.name.length <= 20 &&
          Number.isInteger(p.color) &&
          p.color >= 0 &&
          p.color < 6,
      )
    );
  }
  receiveHost(data: unknown) {
    if (this.closed) return;
    if (!data || typeof data !== 'object') return;
    const m = data as Record<string, unknown>;
    if (m.type === 'error') {
      this.fail(
        typeof m.message === 'string'
          ? m.message
          : 'The room could not be joined.',
      );
      return;
    }
    if (
      m.type === 'welcome' &&
      this.validRoster(m.members) &&
      typeof m.self === 'number' &&
      m.members.some((p) => p.id === m.self) &&
      m.self !== 0
    ) {
      this.clearTimer();
      this.view.self = m.self;
      this.view.members = m.members;
      this.sim.setHumans(
        m.members.map((p) => p.id),
        m.self,
      );
      this.lastPacket = performance.now();
      this.emit({ status: 'waiting' });
      this.callbacks.roster(this.view.members, this.view.self);
      return;
    }
    if (m.type === 'roster' && this.validRoster(m.members)) {
      this.view.members = m.members;
      this.sim.humanIds = new Set(m.members.map((p) => p.id));
      this.emit();
      this.callbacks.roster(this.view.members, this.view.self);
      return;
    }
    if (
      m.type === 'lobby' &&
      Number.isInteger(m.course) &&
      Number(m.course) >= 0 &&
      Number(m.course) < 10
    ) {
      this.sim.reset(Number(m.course));
      this.sim.setHumans(
        this.view.members.map((p) => p.id),
        this.view.self,
      );
      this.round = Number(m.round);
      this.lastSequence = -1;
      this.emit({ status: 'waiting', round: this.round });
      this.callbacks.prepare(Number(m.course));
      this.callbacks.roster(this.view.members, this.view.self);
      return;
    }
    if (isWorld(data)) {
      if (
        data.round < this.round ||
        (data.round === this.round && data.sequence <= this.lastSequence)
      )
        return;
      if (data.round !== this.round) {
        this.round = data.round;
        this.lastSequence = -1;
        this.sim.reset(data.course);
        this.sim.setHumans(
          this.view.members.map((p) => p.id),
          this.view.self,
        );
        this.callbacks.prepare(data.course);
        this.callbacks.roster(this.view.members, this.view.self);
      }
      this.lastSequence = data.sequence;
      this.lastPacket = performance.now();
      restoreWorld(this.sim, data);
      const status = data.state === 'finished' ? 'finished' : 'racing';
      if (this.view.status !== status)
        this.emit({ status, round: this.round, error: '' });
    }
  }
  roster() {
    this.emit();
    this.broadcast({ type: 'roster', members: this.view.members });
    this.callbacks.roster(this.view.members, this.view.self);
  }
  start(course: number) {
    if (!this.view.host || this.view.members.length < 2 || !COURSES[course])
      return;
    this.round++;
    this.sequence = 0;
    this.lastBroadcast = 0;
    this.inputTimes.clear();
    this.inputSequences.clear();
    this.sim.reset(course);
    this.sim.setHumans(this.view.members.map((p) => p.id));
    this.callbacks.prepare(course);
    this.callbacks.roster(this.view.members, 0);
    this.sim.start();
    this.emit({ status: 'racing', round: this.round, error: '' });
    this.broadcast(captureWorld(this.sim, this.round, ++this.sequence));
  }
  lobby(course: number) {
    if (!this.view.host) return;
    this.round++;
    this.sim.reset(course);
    this.sim.setHumans(this.view.members.map((p) => p.id));
    this.callbacks.prepare(course);
    this.callbacks.roster(this.view.members, 0);
    this.emit({ status: 'waiting', round: this.round });
    this.broadcast({ type: 'lobby', course, round: this.round });
  }
  tick(dt: number) {
    if (this.closed) return;
    const now = performance.now();
    if (this.view.host) {
      for (const [id, t] of this.inputTimes)
        if (now - t > 350) this.sim.humanInputs.set(id, { ...EMPTY_INPUT });
      this.sim.step(dt);
      if (this.view.status === 'racing' && this.sim.state === 'finished')
        this.emit({ status: 'finished' });
      if (
        (this.view.status === 'racing' || this.view.status === 'finished') &&
        now - this.lastBroadcast >= 50
      ) {
        this.lastBroadcast = now;
        this.broadcast(captureWorld(this.sim, this.round, ++this.sequence));
      }
    } else {
      this.pendingJump ||= this.sim.input.jump;
      this.pendingDive ||= this.sim.input.dive;
      if (this.view.status === 'racing' && now - this.lastInput >= 40) {
        this.lastInput = now;
        if (this.server)
          this.send(this.server, {
            type: 'input',
            round: this.round,
            sequence: ++this.sequence,
            input: {
              ...this.sim.input,
              jump: this.pendingJump,
              dive: this.pendingDive,
            },
          });
        this.pendingJump = false;
        this.pendingDive = false;
      }
      this.sim.input.jump = false;
      this.sim.input.dive = false;
      if (this.view.status === 'racing' && now - this.lastPacket > 12000)
        this.fail(
          'The host stopped responding. Ask them to keep the game tab active, then create a new room.',
        );
    }
  }
  respawn() {
    if (this.view.host) this.sim.respawn(this.sim.player);
    else if (this.server)
      this.send(this.server, { type: 'respawn', round: this.round });
  }
  send(c: DataConnection, data: unknown) {
    if (
      c.open &&
      (!(
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === 'world'
      ) ||
        (c.dataChannel?.bufferedAmount ?? 0) < 128000)
    ) {
      try {
        c.send(data);
      } catch {
        /* The close/error event handles a disconnected player. */
      }
    }
  }
  broadcast(data: unknown) {
    for (const c of this.connections.values()) this.send(c, data);
  }
  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  fail(reason: string) {
    if (this.closed) return;
    this.close(false);
    this.emit({ status: 'error', error: reason });
    this.callbacks.ended(reason);
  }
  close(notify = true) {
    this.closed = true;
    this.clearTimer();
    for (const c of this.connections.values()) c.close();
    this.connections.clear();
    if (this.server) {
      this.send(this.server, { type: 'leave' });
      this.server.close();
    }
    this.peer?.destroy();
    this.peer = null;
    this.sim.multiplayer = false;
    this.sim.playerId = 0;
    this.sim.humanIds.clear();
    this.sim.humanInputs.clear();
    if (notify) this.emit({ ...EMPTY_PARTY });
  }
}
