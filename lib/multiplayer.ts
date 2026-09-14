import Peer, { type DataConnection } from 'peerjs';
import {
  normalizeCosmetics,
  DEFAULT_COSMETICS,
  OUTFIT_COLORS,
  type Cosmetics,
} from './cosmetics.ts';
import type { MatchAssignment } from './backend';
import type { MatchPeer } from './match-peer';
export type PublicConnection = {
  lease: MatchPeer;
  assignment: MatchAssignment;
  validate: (
    userId: string,
    ticket: string,
    peerId: string,
  ) => Promise<{ accepted: boolean; userId?: string; slot?: number }>;
  start: () => Promise<unknown>;
};
import {
  Simulation,
  EMPTY_INPUT,
  type Input,
  type Racer,
  type GameState,
} from './simulation.ts';
import { COURSES, type Course } from './courses.ts';
import {
  buildCourse,
  parseRecipe,
  recipeKey,
  MAX_SAVED_COURSES,
  type CourseRecipe,
} from './course-builder.ts';

export type Member = {
  id: number;
  name: string;
  color: number;
  host: boolean;
  cosmetics?: Cosmetics;
  userId?: string;
};
export type PartyView = {
  status:
    | 'offline'
    | 'connecting'
    | 'waiting'
    | 'racing'
    | 'finished'
    | 'error';
  code: string;
  publicMatch?: boolean;
  host: boolean;
  self: number;
  members: Member[];
  error: string;
  round: number;
  nextIn: number;
  nextName: string;
  customCourses: CourseRecipe[];
  rotation: 'all' | 'custom';
  courseMessage: string;
};
export const EMPTY_PARTY: PartyView = {
  status: 'offline',
  code: '',
  host: false,
  self: 0,
  members: [],
  error: '',
  round: 0,
  nextIn: 0,
  nextName: '',
  customCourses: [],
  rotation: 'all',
  courseMessage: '',
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
  nextIn?: number;
  nextName?: string;
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
        .slice(0, 24) || 'Tumbler'
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
    kick: v.kick === true,
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
    v.course < 4294968296 &&
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
          'progress',
          'diveTime',
          'diveCooldown',
          'kickCooldown',
          'kickTime',
          'stun',
          'speed',
          'finishTime',
        ].every((k) => Number.isFinite(r[k as keyof Racer])) &&
        Math.abs(r.x) < 1500 &&
        Math.abs(r.z) < 1500 &&
        Math.abs(r.y) < 100 &&
        typeof r.sliding === 'boolean' &&
        typeof r.lane === 'string' &&
        r.lane.length < 64,
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
  prepare: (course: Course) => void;
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
  pendingKick = false;
  closed = false;
  timer: ReturnType<typeof setTimeout> | null = null;
  inputTimes = new Map<number, number>();
  inputSequences = new Map<number, number>();
  respawnTimes = new Map<number, number>();
  submissionTimes = new Map<number, number>();
  nextCourse: Course | null = null;
  intermissionEnd = 0;
  clock: () => number;
  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  online?: PublicConnection;
  peerCleanup: (() => void)[] = [];
  startingPublic = false;
  publicRetryAt = 0;
  constructor(
    sim: Simulation,
    callbacks: Callbacks,
    clock = () => performance.now(),
  ) {
    this.sim = sim;
    this.callbacks = callbacks;
    this.clock = clock;
  }
  emit(change: Partial<PartyView> = {}) {
    this.view = { ...this.view, ...change };
    this.callbacks.change({ ...this.view, members: [...this.view.members] });
  }
  connect(
    host: boolean,
    name: string,
    color: number,
    code = '',
    cosmetics: Cosmetics = DEFAULT_COSMETICS,
    online?: PublicConnection,
  ) {
    this.online = online;
    this.closed = false;
    this.emit({
      status: 'connecting',
      host,
      code:
        online?.assignment.roomCode ?? (host ? makeCode() : cleanCode(code)),
      publicMatch: !!online,
      error: '',
      members: [],
      self: 0,
    });
    if (!online && !host && this.view.code.length !== 8) {
      this.fail('Enter the eight-character room code from your friend.');
      return;
    }
    this.peer =
      online?.lease.peer ??
      (host
        ? new Peer(`tumble-club-v5-${this.view.code}`, { debug: 0 })
        : new Peer({ debug: 0 }));
    this.timer = setTimeout(
      () =>
        this.fail(
          'The room could not connect. Check the code and that the host is online. A restrictive network or VPN may block the connection.',
        ),
      20000,
    );
    const onError = (err: { type: string }) => {
      const type = err.type;
      if (this.view.status !== 'connecting') {
        this.emit({
          error:
            'The room directory is reconnecting. Your room and existing racers stay together.',
        });
        this.reconnectDirectory();
        return;
      }
      this.fail(
        type === 'peer-unavailable'
          ? 'That room is not online. Ask your friend to create a room and share its new code.'
          : type === 'unavailable-id'
            ? 'That room code is already in use. Try creating another room.'
            : 'The multiplayer connection failed. Try again, or try another network.',
      );
    };
    this.peer.on('error', onError);
    this.peerCleanup.push(() => this.peer?.off('error', onError));
    const onDisconnected = () => {
      if (!this.closed) {
        this.emit({
          error:
            'The room directory is reconnecting. Existing racers can continue.',
        });
        this.reconnectDirectory();
      }
    };
    this.peer.on('disconnected', onDisconnected);
    this.peerCleanup.push(() => this.peer?.off('disconnected', onDisconnected));
    const onOpen = () => {
      if (this.closed) return;
      if (this.view.status !== 'connecting') {
        this.emit({ error: '' });
        return;
      }
      if (host) {
        this.clearTimer();
        this.sim.reset(this.sim.course);
        this.view.self = 0;
        this.view.members = [
          {
            id: 0,
            name: cleanName(name),
            color,
            host: true,
            cosmetics: normalizeCosmetics({
              ...cosmetics,
              color: OUTFIT_COLORS[color],
            }),
            userId: online?.assignment.userId,
          },
        ];
        this.sim.setHumans([0]);
        this.callbacks.prepare(this.sim.course);
        this.emit({ status: 'waiting' });
        this.callbacks.roster(this.view.members, 0);
      } else {
        const c = this.peer!.connect(
          online?.assignment.hostPeerId ?? `tumble-club-v5-${this.view.code}`,
          {
            reliable: true,
            serialization: 'json',
          },
        );
        this.server = c;
        c.on('open', () =>
          this.send(c, {
            type: 'join',
            name: cleanName(name),
            color,
            protocol: 5,
            cosmetics: normalizeCosmetics({
              ...cosmetics,
              color: OUTFIT_COLORS[color],
            }),
            ...(online
              ? {
                  matchId: online.assignment.matchId,
                  userId: online.assignment.userId,
                  ticket: online.assignment.ticket,
                }
              : {}),
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
    };
    this.peer.on('open', onOpen);
    this.peerCleanup.push(() => this.peer?.off('open', onOpen));
    const onConnection = (c: DataConnection, queued: unknown[] = []) => {
      if (!host || this.closed) {
        c.close();
        return;
      }
      let id = -1,
        admitting = false;
      const timeout = setTimeout(() => {
        if (id < 0) c.close();
      }, 10000);
      const receive = async (data: unknown) => {
        if (this.closed || !data || typeof data !== 'object') return;
        const m = data as Record<string, unknown>;
        if (id < 0) {
          if (admitting) return;
          if (m.type !== 'join' || m.protocol !== 5) {
            this.send(c, {
              type: 'error',
              message: 'Please reload the game before joining.',
            });
            c.close();
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
          const verified = online?.assignment.members.find(
            (member) => member.userId === m.userId,
          );
          if (online) {
            if (
              m.matchId !== online.assignment.matchId ||
              typeof m.userId !== 'string' ||
              typeof m.ticket !== 'string' ||
              !verified
            ) {
              c.close();
              return;
            }
            admitting = true;
            try {
              const check = await online.validate(m.userId, m.ticket, c.peer);
              if (
                !check.accepted ||
                check.slot !== verified.slot ||
                this.closed ||
                !c.open ||
                this.view.members.some((member) => member.id === check.slot)
              ) {
                c.close();
                return;
              }
              id = check.slot!;
            } catch {
              c.close();
              return;
            } finally {
              admitting = false;
            }
          } else
            id = Array.from({ length: 8 }, (_, i) => i).find(
              (n) => !this.view.members.some((member) => member.id === n),
            )!;
          clearTimeout(timeout);
          this.connections.set(id, c);
          this.view.members.push({
            id,
            name: cleanName(verified?.username ?? m.name),
            cosmetics: normalizeCosmetics(verified?.cosmetics ?? m.cosmetics),
            userId: verified?.userId,
            color: verified
              ? OUTFIT_COLORS.indexOf(verified.cosmetics.color)
              : typeof m.color === 'number' &&
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
          this.send(c, {
            type: 'pool',
            recipes: this.view.customCourses,
            rotation: this.view.rotation,
          });
          if (this.round > 0) {
            this.send(c, this.roundPacket());
            this.send(c, this.worldPacket());
          }
          this.roster();
          void this.startPublicWhenReady();
          return;
        }
        if (this.connections.get(id) !== c) return;
        if (m.type === 'leave') {
          c.close();
          return;
        }
        if (m.type === 'submit-course') {
          if (this.clock() - (this.submissionTimes.get(id) ?? -5000) < 1500) {
            this.send(c, {
              type: 'course-result',
              message: 'Please wait a moment, then add the course again.',
            });
          } else {
            this.submissionTimes.set(id, this.clock());
            const accepted = this.addCourse(m.recipe);
            this.send(c, {
              type: 'course-result',
              message: accepted
                ? 'Your course is now in the room rotation.'
                : 'The course was not added. The room holds 16 valid custom courses.',
            });
          }
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
          input.kick ||= old?.kick ?? false;
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
      };
      c.on('data', (data) => {
        void receive(data);
      });
      for (const data of queued) void receive(data);
      c.on('close', () => {
        clearTimeout(timeout);
        if (id >= 0 && !this.closed && this.connections.get(id) === c) {
          this.connections.delete(id);
          this.view.members = this.view.members.filter((p) => p.id !== id);
          this.sim.humanIds.delete(id);
          this.sim.humanInputs.delete(id);
          this.inputTimes.delete(id);
          this.inputSequences.delete(id);
          this.respawnTimes.delete(id);
          this.submissionTimes.delete(id);
          this.roster();
        }
      });
      c.on('error', () => c.close());
    };
    this.peer.on('connection', onConnection);
    this.peerCleanup.push(() => this.peer?.off('connection', onConnection));
    if (online) {
      // Establish the host roster before replaying already-buffered admissions.
      if (this.peer.open) onOpen();
      for (const item of online.lease.take())
        onConnection(item.connection, item.messages);
    }
  }
  async startPublicWhenReady() {
    if (
      this.closed ||
      !this.online ||
      !this.view.host ||
      this.round > 0 ||
      this.startingPublic ||
      (this.view.members.length !== 5 &&
        this.online.assignment.phase !== 'playing') ||
      this.clock() < this.publicRetryAt
    )
      return;
    this.startingPublic = true;
    try {
      await this.online.start();
      if (!this.closed)
        this.start(
          Math.floor(Math.random() * COURSES.length),
          this.view.members.length < 2,
        );
    } catch {
      this.publicRetryAt = this.clock() + 3000;
      if (!this.closed)
        this.emit({ error: 'Waiting for all five racers to connect…' });
    } finally {
      this.startingPublic = false;
    }
  }
  updateAssignment(assignment: PublicConnection['assignment']) {
    if (
      this.closed ||
      !this.online ||
      assignment.matchId !== this.online.assignment.matchId
    )
      return;
    this.online.assignment = assignment;
    const allowed = new Set(assignment.members.map((m) => m.userId));
    if (!allowed.has(assignment.userId)) {
      this.fail(
        'Your place in this game expired. Search again to join a new crew.',
      );
      return;
    }
    if (!this.view.host) return;
    for (const member of this.view.members) {
      if (!member.host && !allowed.has(member.userId ?? '')) {
        const connection = this.connections.get(member.id);
        this.connections.delete(member.id);
        connection?.close();
        this.view.members = this.view.members.filter((m) => m.id !== member.id);
        this.sim.humanIds.delete(member.id);
        this.sim.humanInputs.delete(member.id);
        this.inputTimes.delete(member.id);
        this.inputSequences.delete(member.id);
      }
    }
    this.roster();
    void this.startPublicWhenReady();
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
          p.name.length <= 24 &&
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
    if (m.type === 'course-result' && typeof m.message === 'string') {
      this.emit({ courseMessage: m.message.slice(0, 160) });
      return;
    }
    if (
      m.type === 'pool' &&
      Array.isArray(m.recipes) &&
      m.recipes.length <= MAX_SAVED_COURSES &&
      ['all', 'custom'].includes(String(m.rotation))
    ) {
      const recipes = m.recipes.map(parseRecipe);
      if (recipes.every((r): r is CourseRecipe => r !== null))
        this.emit({
          customCourses: recipes,
          rotation: m.rotation as 'all' | 'custom',
        });
      return;
    }
    if (
      m.type === 'round' &&
      Number.isSafeInteger(m.round) &&
      Number(m.round) > this.round
    ) {
      const recipe = parseRecipe(m.recipe);
      const course = recipe
        ? buildCourse(
            recipe,
            Number.isSafeInteger(m.catalogNumber) &&
              Number(m.catalogNumber) >= 51 &&
              Number(m.catalogNumber) <= 10000
              ? Number(m.catalogNumber)
              : recipeKey(recipe),
          )
        : Number.isInteger(m.course)
          ? COURSES[Number(m.course)]
          : null;
      if (
        !course ||
        (m.recipe !== undefined && !recipe) ||
        !['lobby', 'countdown', 'racing'].includes(String(m.state))
      )
        return;
      this.round = Number(m.round);
      this.lastSequence = -1;
      this.pendingJump = this.pendingDive = this.pendingKick = false;
      this.sim.reset(course);
      this.sim.setHumans(
        this.view.members.map((p) => p.id),
        this.view.self,
      );
      this.sim.state = m.state as GameState;
      this.callbacks.prepare(course);
      this.callbacks.roster(this.view.members, this.view.self);
      this.emit({
        status: m.state === 'lobby' ? 'waiting' : 'racing',
        round: this.round,
        nextIn: 0,
        nextName: '',
        error: '',
      });
      return;
    }
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
      this.sim.reset(this.sim.course);
      this.sim.setHumans(
        m.members.map((p) => p.id),
        m.self,
      );
      this.lastPacket = performance.now();
      this.callbacks.prepare(this.sim.course);
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
      Number(m.course) < COURSES.length &&
      Number.isSafeInteger(m.round) &&
      Number(m.round) > this.round
    ) {
      this.sim.reset(Number(m.course));
      this.sim.setHumans(
        this.view.members.map((p) => p.id),
        this.view.self,
      );
      this.round = Number(m.round);
      this.lastSequence = -1;
      this.emit({ status: 'waiting', round: this.round });
      this.callbacks.prepare(COURSES[Number(m.course)]);
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
        if (!COURSES[data.course]) return;
        this.round = data.round;
        this.lastSequence = -1;
        this.sim.reset(data.course);
        this.sim.setHumans(
          this.view.members.map((p) => p.id),
          this.view.self,
        );
        this.callbacks.prepare(COURSES[data.course]);
        this.callbacks.roster(this.view.members, this.view.self);
      }
      if (data.course !== this.sim.course.id - 1) return;
      this.lastSequence = data.sequence;
      this.lastPacket = performance.now();
      restoreWorld(this.sim, data);
      const status = data.state === 'finished' ? 'finished' : 'racing';
      const nextIn = Number.isFinite(data.nextIn)
        ? Math.max(0, Math.min(5, Number(data.nextIn)))
        : 0;
      const nextName =
        typeof data.nextName === 'string' ? data.nextName.slice(0, 36) : '';
      if (
        this.view.status !== status ||
        this.view.nextIn !== nextIn ||
        this.view.error
      )
        this.emit({ status, round: this.round, error: '', nextIn, nextName });
    }
  }
  roster() {
    this.emit();
    this.broadcast({ type: 'roster', members: this.view.members });
    this.callbacks.roster(this.view.members, this.view.self);
  }
  start(selection: number | Course, automatic = false) {
    const course =
      typeof selection === 'number' ? COURSES[selection] : selection;
    if (
      !this.view.host ||
      (!automatic && this.view.members.length < 2) ||
      !course
    )
      return;
    this.round++;
    this.sequence = 0;
    this.lastBroadcast = 0;
    this.inputTimes.clear();
    this.inputSequences.clear();
    this.respawnTimes.clear();
    this.pendingJump = this.pendingDive = this.pendingKick = false;
    this.nextCourse = null;
    this.sim.reset(course);
    this.sim.setHumans(this.view.members.map((p) => p.id));
    this.callbacks.prepare(course);
    this.callbacks.roster(this.view.members, 0);
    this.sim.start();
    if (automatic) {
      this.sim.state = 'racing';
      this.sim.countdown = 0;
      this.sim.events.push('go');
    }
    this.emit({
      status: 'racing',
      round: this.round,
      error: '',
      nextIn: 0,
      nextName: '',
    });
    this.broadcast(this.roundPacket());
    this.broadcast(this.worldPacket());
  }
  lobby(course: number) {
    if (!this.view.host) return;
    this.round++;
    this.nextCourse = null;
    this.sim.reset(course);
    this.sim.setHumans(this.view.members.map((p) => p.id));
    this.callbacks.prepare(COURSES[course]);
    this.callbacks.roster(this.view.members, 0);
    this.emit({
      status: 'waiting',
      round: this.round,
      nextIn: 0,
      nextName: '',
    });
    this.broadcast(this.roundPacket());
  }
  tick(dt: number) {
    if (this.closed) return;
    const now = this.clock();
    if (this.view.host) {
      if (this.online && this.round === 0) void this.startPublicWhenReady();
      for (const [id, t] of this.inputTimes)
        if (now - t > 350) this.sim.humanInputs.set(id, { ...EMPTY_INPUT });
      this.sim.step(dt);
      if (this.view.status === 'racing' && this.sim.state === 'finished') {
        const customs = this.view.customCourses.map((r) => buildCourse(r));
        const pool =
          this.view.rotation === 'custom' && customs.length
            ? customs
            : [...COURSES, ...customs];
        const choices = pool.filter((c) => c.id !== this.sim.course.id);
        const available = choices.length ? choices : pool;
        this.nextCourse =
          available[Math.floor(Math.random() * available.length)];
        this.intermissionEnd = now + 5000;
        this.emit({
          status: 'finished',
          nextIn: 5,
          nextName: this.nextCourse.name,
        });
      }
      if (this.view.status === 'finished' && this.nextCourse) {
        const remaining = Math.max(
          0,
          Math.ceil((this.intermissionEnd - now) / 1000),
        );
        if (remaining !== this.view.nextIn) this.emit({ nextIn: remaining });
        if (now >= this.intermissionEnd) this.start(this.nextCourse, true);
      }
      if (
        (this.view.status === 'racing' || this.view.status === 'finished') &&
        now - this.lastBroadcast >= 50
      ) {
        this.lastBroadcast = now;
        this.broadcast(this.worldPacket());
      }
    } else {
      this.pendingJump ||= this.sim.input.jump;
      this.pendingDive ||= this.sim.input.dive;
      this.pendingKick ||= this.sim.input.kick ?? false;
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
              kick: this.pendingKick,
            },
          });
        this.pendingJump = false;
        this.pendingDive = false;
        this.pendingKick = false;
      }
      this.sim.input.jump = false;
      this.sim.input.dive = false;
      this.sim.input.kick = false;
      if (
        this.view.status === 'racing' &&
        now - this.lastPacket > 12000 &&
        !this.view.error
      )
        this.emit({
          error:
            'Waiting for the host to return to the game tab. Your room is still open.',
        });
    }
  }
  respawn() {
    if (this.sim.state !== 'racing' || this.sim.player.finished) return;
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
        void Promise.resolve(c.send(data)).catch(() => {
          /* The connection's close/error event handles a failed send. */
        });
      } catch {
        /* The close/error event handles a disconnected player. */
      }
    }
  }
  broadcast(data: unknown) {
    for (const c of this.connections.values()) this.send(c, data);
  }
  roundPacket() {
    return {
      type: 'round',
      round: this.round,
      course: this.sim.course.recipe ? -1 : this.sim.course.id - 1,
      recipe: this.sim.course.recipe,
      catalogNumber: COURSES.some((c) => c.id === this.sim.course.id)
        ? this.sim.course.id
        : undefined,
      state: this.sim.state === 'finished' ? 'racing' : this.sim.state,
    };
  }
  worldPacket() {
    return {
      ...captureWorld(this.sim, this.round, ++this.sequence),
      nextIn: this.view.nextIn,
      nextName: this.view.nextName,
    };
  }
  addCourse(value: unknown) {
    const recipe = parseRecipe(value);
    if (!recipe || this.closed) return false;
    if (!this.view.host) {
      if (
        !this.server?.open ||
        this.view.customCourses.length >= MAX_SAVED_COURSES
      )
        return false;
      this.emit({ courseMessage: 'Sharing your course with the room…' });
      this.send(this.server, { type: 'submit-course', recipe });
      return true;
    }
    if (this.view.customCourses.some((r) => recipeKey(r) === recipeKey(recipe)))
      return true;
    if (this.view.customCourses.length >= MAX_SAVED_COURSES) return false;
    this.emit({
      customCourses: [...this.view.customCourses, recipe],
      courseMessage: 'Course added to the room rotation.',
    });
    this.broadcast({
      type: 'pool',
      recipes: this.view.customCourses,
      rotation: this.view.rotation,
    });
    return true;
  }
  setRotation(rotation: 'all' | 'custom') {
    if (!this.view.host) return;
    this.emit({ rotation });
    this.broadcast({
      type: 'pool',
      recipes: this.view.customCourses,
      rotation,
    });
  }
  reconnectDirectory() {
    if (this.closed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed && this.peer?.disconnected && !this.peer.destroyed) {
        try {
          this.peer.reconnect();
        } catch {
          this.reconnectDirectory();
        }
      }
    }, 2000);
  }
  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  fail(reason: string) {
    if (this.closed) return;
    this.close(false, !!this.online);
    this.emit({ status: 'error', error: reason });
    this.callbacks.ended(reason);
  }
  close(notify = true, preservePeer = false) {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.nextCourse = null;
    this.clearTimer();
    for (const c of this.connections.values()) c.close();
    this.connections.clear();
    if (this.server) {
      this.send(this.server, { type: 'leave' });
      this.server.close();
    }
    for (const cleanup of this.peerCleanup) cleanup();
    this.peerCleanup = [];
    if (preservePeer && this.online) this.online.lease.resume();
    else this.peer?.destroy();
    this.peer = null;
    this.sim.multiplayer = false;
    this.sim.playerId = 0;
    this.sim.humanIds.clear();
    this.sim.humanInputs.clear();
    if (notify) this.emit({ ...EMPTY_PARTY });
  }
}
