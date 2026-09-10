'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  Check,
  Copy,
  ChevronRight,
  Crown,
  Flag,
  Gamepad2,
  Maximize,
  Hammer,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { COURSES, COLORS, type Course } from '@/lib/courses';
import {
  buildCourse,
  parseRecipe,
  recipeKey,
  DEFAULT_RECIPE,
  MAX_SAVED_COURSES,
  type CourseRecipe,
} from '@/lib/course-builder';
import CourseEditor from './course-editor';
import { Simulation, type GameState } from '@/lib/simulation';
import { Sound } from '@/lib/sound';
import type { RaceScene } from '@/lib/scene';
import type { Party, PartyView } from '@/lib/multiplayer';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

const emptyParty: PartyView = {
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

type RecordEntry = { time: number; rank: number };
type Snapshot = {
  place: number;
  state: GameState;
  time: number;
  rank: number;
  progress: number;
  countdown: number;
  falls: number;
  checkpoint: number;
  finishTime: number;
  places: { id: number; place: number; time: number }[];
};
const initial: Snapshot = {
  place: 0,
  state: 'lobby',
  time: 0,
  rank: 1,
  progress: 0,
  countdown: 3,
  falls: 0,
  checkpoint: 0,
  finishTime: 0,
  places: [],
};
const formatTime = (t: number) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

function CourseMap({ index }: { index: number }) {
  const course = COURSES[index];
  return (
    <svg viewBox="0 0 200 100" aria-hidden="true" className="course-map">
      <rect width="200" height="100" fill={course.sky} />
      <g
        transform={`translate(98 70) rotate(-23) skewX(18) scale(1 ${Math.min(0.62, 90 / course.length)})`}
      >
        {course.platforms.map((p, i) => (
          <rect
            key={i}
            x={p.x * 4 - p.w * 2}
            y={48 - p.z * 0.77 - p.d * 0.385}
            width={p.w * 4}
            height={p.d * 0.77}
            rx="2"
            fill={p.kind === 'crumble' ? course.accent : course.color}
            stroke="#ffffff"
            strokeWidth=".7"
          />
        ))}
        {course.obstacles.map((o, i) => (
          <g key={i} transform={`translate(${o.x * 4},${48 - o.z * 0.77})`}>
            {o.type === 'bar' ? (
              <>
                <rect
                  x="-23"
                  y="-2.5"
                  width="46"
                  height="5"
                  rx="2"
                  fill={course.accent}
                  transform={`rotate(${i * 32 + 25})`}
                />
                <circle r="4" fill="#fff0bb" />
              </>
            ) : (
              <rect
                x={o.type === 'hurdle' ? -22 : -5}
                y="-4"
                width={o.type === 'hurdle' ? 44 : 10}
                height="8"
                rx="4"
                fill={course.accent}
                stroke="#fff0cc"
                strokeWidth="2"
              />
            )}
          </g>
        ))}
        <path
          d={`M -30 ${48 - course.length * 0.77} h 60`}
          stroke="#ffe8a5"
          strokeWidth="7"
        />
      </g>
    </svg>
  );
}

export default function Game() {
  const container = useRef<HTMLDivElement>(null),
    engine = useRef<RaceScene | null>(null),
    sim = useRef<Simulation | null>(null),
    sound = useRef<Sound | null>(null);
  const keys = useRef(new Set<string>()),
    menuOpen = useRef(false),
    party = useRef<Party | null>(null),
    touch = useRef({ x: 0, z: 0 }),
    lastFinished = useRef(false),
    recordsRef = useRef<Record<string, RecordEntry>>({});
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(0),
    [activeCourse, setActiveCourse] = useState<Course>(COURSES[0]),
    [savedCourses, setSavedCourses] = useState<CourseRecipe[]>([]),
    [editorDraft, setEditorDraft] = useState<CourseRecipe>(() =>
      structuredClone(DEFAULT_RECIPE),
    ),
    [editingKey, setEditingKey] = useState<number | undefined>(),
    [color, setColor] = useState(0),
    [mode, setMode] = useState('race'),
    [muted, setMuted] = useState(false);
  const [snap, setSnap] = useState(initial),
    [modal, setModal] = useState<
      'courses' | 'help' | 'pause' | 'party' | 'builder' | null
    >(null),
    [records, setRecords] = useState<Record<string, RecordEntry>>({}),
    [notice, setNotice] = useState(''),
    [series, setSeries] = useState(false),
    [seriesPoints, setSeriesPoints] = useState(0),
    [fullscreen, setFullscreen] = useState(false);
  const [partyView, setPartyView] = useState<PartyView>(emptyParty),
    [playerName, setPlayerName] = useState(''),
    [joinCode, setJoinCode] = useState(''),
    [partyCourse, setPartyCourse] = useState(1),
    [copyState, setCopyState] = useState('');
  const inParty = ['waiting', 'racing', 'finished'].includes(partyView.status);
  const course = activeCourse,
    racing = snap.state !== 'lobby',
    finished = snap.state === 'finished',
    qualified = (snap.place ?? 0) > 0 && snap.rank <= 8;
  const completed = Object.keys(records).filter(
    (id) => Number(id) <= COURSES.length,
  ).length;
  const roomCourses = [
    ...COURSES,
    ...partyView.customCourses.map((r) => buildCourse(r)),
  ];
  useEffect(() => {
    menuOpen.current = modal !== null;
    if (modal !== null) {
      keys.current.clear();
      touch.current = { x: 0, z: 0 };
    }
  }, [modal]);

  useEffect(() => {
    const simulation = new Simulation(0);
    sim.current = simulation;
    const audio = new Sound();
    sound.current = audio;
    let destroyed = false,
      frame = 0,
      last = 0,
      accumulator = 0,
      uiElapsed = 0,
      noticeTimer = 0;
    const invite = new URL(window.location.href).searchParams.get('room');
    if (invite)
      queueMicrotask(() => {
        if (!destroyed) {
          setJoinCode(
            invite
              .toUpperCase()
              .replace(/[^A-Z2-9]/g, '')
              .slice(0, 8),
          );
          setModal('party');
        }
      });
    try {
      const recipes = JSON.parse(
        localStorage.getItem('tumble-club-courses-v1') || '[]',
      );
      if (Array.isArray(recipes)) {
        const clean = recipes
          .slice(0, MAX_SAVED_COURSES)
          .map(parseRecipe)
          .filter((r): r is CourseRecipe => r !== null);
        queueMicrotask(() => {
          if (!destroyed) setSavedCourses(clean);
        });
      }
    } catch {
      /* The course builder remains available without storage. */
    }
    try {
      const saved = JSON.parse(
        localStorage.getItem('tumble-club-records') || '{}',
      );
      const clean: Record<string, RecordEntry> = {};
      for (const [k, v] of Object.entries(saved)) {
        const r = v as RecordEntry;
        if (
          Number(k) >= 1 &&
          Number(k) <= 4294968296 &&
          Number.isFinite(r.time) &&
          r.time > 0 &&
          r.rank >= 1 &&
          r.rank <= 12
        )
          clean[k] = r;
      }
      recordsRef.current = clean;
      queueMicrotask(() => {
        if (!destroyed) setRecords(clean);
      });
    } catch {
      /* Play remains available without local storage. */
    }
    import('@/lib/scene')
      .then(({ RaceScene: Scene }) => {
        if (destroyed || !container.current) return;
        const view = new Scene(container.current, simulation, 0);
        engine.current = view;
        setReady(true);
        const loop = (now: number) => {
          if (destroyed) return;
          const dt = Math.min((now - (last || now)) / 1000, 0.08);
          last = now;
          accumulator += dt;
          while (accumulator >= 1 / 60) {
            if (!simulation.paused) {
              simulation.input.x =
                (keys.current.has('KeyD') || keys.current.has('ArrowRight')
                  ? 1
                  : 0) -
                (keys.current.has('KeyA') || keys.current.has('ArrowLeft')
                  ? 1
                  : 0) +
                touch.current.x;
              simulation.input.z =
                (keys.current.has('KeyW') || keys.current.has('ArrowUp')
                  ? 1
                  : 0) -
                (keys.current.has('KeyS') || keys.current.has('ArrowDown')
                  ? 1
                  : 0) +
                touch.current.z;
            }
            if (party.current && !party.current.closed)
              party.current.tick(1 / 60);
            else simulation.step(1 / 60);
            accumulator -= 1 / 60;
          }
          for (const event of simulation.events) {
            audio.play(event);
            if (event === 'checkpoint' || event === 'fall') {
              setNotice(
                event === 'checkpoint'
                  ? 'Checkpoint saved!'
                  : 'A little tumble. Try again!',
              );
              noticeTimer = 2;
            }
          }
          simulation.events = [];
          if (noticeTimer > 0) {
            noticeTimer -= dt;
            if (noticeTimer <= 0) setNotice('');
          }
          if (simulation.state === 'finished' && !lastFinished.current) {
            lastFinished.current = true;
            keys.current.clear();
            touch.current = { x: 0, z: 0 };
            if (simulation.player.finished) {
              const id = String(simulation.course.id),
                old = recordsRef.current[id];
              const entry = {
                time: Math.min(
                  old?.time ?? Infinity,
                  simulation.player.finishTime || simulation.time,
                ),
                rank: Math.min(old?.rank ?? 13, simulation.rank),
              };
              const next = { ...recordsRef.current, [id]: entry };
              recordsRef.current = next;
              setRecords(next);
              try {
                localStorage.setItem(
                  'tumble-club-records',
                  JSON.stringify(next),
                );
              } catch {}
            }
          }
          uiElapsed += dt;
          if (uiElapsed > 0.08) {
            uiElapsed = 0;
            setSnap({
              place: simulation.player.finished,
              state: simulation.state,
              time: simulation.time,
              rank: simulation.rank,
              progress: Math.max(
                0,
                Math.min(
                  100,
                  (simulation.player.z / simulation.course.length) * 100,
                ),
              ),
              countdown: Math.ceil(simulation.countdown),
              falls: simulation.player.falls,
              checkpoint: simulation.player.checkpoint,
              finishTime: simulation.player.finishTime,
              places: simulation.racers.map((r) => ({
                id: r.id,
                place: r.finished,
                time: r.finishTime,
              })),
            });
          }
          view.render(dt);
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      })
      .catch((e) => {
        console.error(e);
        setError(
          'The 3D course couldn’t start. Enable hardware acceleration in your browser, then reload to race.',
        );
      });
    const clear = () => {
      keys.current.clear();
      touch.current = { x: 0, z: 0 };
      simulation.input.jump = false;
      simulation.input.dive = false;
      simulation.input.x = 0;
      simulation.input.z = 0;
      if (simulation.multiplayer) return;
      if (simulation.state === 'racing' || simulation.state === 'countdown') {
        simulation.paused = true;
        setModal('pause');
      }
    };
    const down = (e: KeyboardEvent) => {
      if (menuOpen.current && e.code !== 'Escape') return;
      if (simulation.state === 'lobby' || simulation.state === 'finished')
        return;
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyE',
          'ShiftLeft',
          'ShiftRight',
          'Escape',
          'KeyR',
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.code === 'Escape' && !e.repeat) {
        if (simulation.multiplayer) {
          setModal((current) => (current === 'pause' ? null : 'pause'));
          keys.current.clear();
          touch.current = { x: 0, z: 0 };
          return;
        }
        simulation.paused = !simulation.paused;
        setModal(simulation.paused ? 'pause' : null);
        keys.current.clear();
        return;
      }
      if (simulation.paused) return;
      keys.current.add(e.code);
      if (!e.repeat && e.code === 'Space') simulation.input.jump = true;
      if (!e.repeat && ['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code))
        simulation.input.dive = true;
      if (!e.repeat && e.code === 'KeyR') {
        if (party.current && !party.current.closed) party.current.respawn();
        else simulation.respawn(simulation.player);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const visibility = () => {
      if (document.hidden) clear();
    };
    const fs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', fs);
    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      party.current?.close(false);
      engine.current?.destroy();
      audio.destroy();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fs);
    };
  }, []);

  const load = (selection: number | Course, start = false) => {
    if (!sim.current || !engine.current) return;
    if (party.current && !party.current.closed) {
      setModal('party');
      return;
    }
    keys.current.clear();
    touch.current = { x: 0, z: 0 };
    const nextCourse =
      typeof selection === 'number' ? COURSES[selection] : selection;
    if (!nextCourse) return;
    setSelected(nextCourse.recipe ? -1 : nextCourse.id - 1);
    setActiveCourse(nextCourse);
    sim.current.reset(nextCourse);
    engine.current.build();
    lastFinished.current = false;
    setNotice('');
    setSnap(initial);
    setModal(null);
    if (start) {
      sound.current?.unlock();
      sim.current.start();
      setSnap({ ...initial, state: 'countdown' });
    }
  };
  const start = () => {
    if (inParty) {
      setModal('party');
      return;
    }
    const championship = mode === 'championship';
    setSeries(championship);
    setSeriesPoints(0);
    load(championship ? 0 : course, true);
  };
  const home = () => {
    if (party.current && !party.current.closed) {
      setModal('party');
      return;
    }
    setSeries(false);
    load(course);
  };
  const pause = () => {
    if (sim.current) {
      if (!sim.current.multiplayer) sim.current.paused = true;
      keys.current.clear();
      touch.current = { x: 0, z: 0 };
      setModal('pause');
    }
  };
  const closeModal = () => {
    setModal(null);
    if (sim.current) sim.current.paused = false;
  };
  const next = () => {
    if (series) setSeriesPoints((p) => p + Math.max(1, 13 - snap.rank));
    load(selected + 1, true);
  };
  const connectParty = async (host: boolean) => {
    if (!sim.current || !engine.current) return;
    party.current?.close(false);
    setPartyView({ ...emptyParty, status: 'connecting' });
    setCopyState('');
    setSeries(false);
    sound.current?.unlock();
    try {
      const { Party: Room } = await import('@/lib/multiplayer');
      const simulation = sim.current;
      let previousStatus = 'connecting';
      const room = new Room(simulation, {
        change: (view) => {
          setPartyView(view);
          if (view.status === 'racing' && previousStatus !== 'racing') {
            setModal((current) => (current === 'builder' ? current : null));
            sound.current?.unlock();
          }
          if (view.status === 'waiting' && previousStatus !== 'waiting')
            setModal('party');
          previousStatus = view.status;
        },
        prepare: (nextCourse) => {
          keys.current.clear();
          touch.current = { x: 0, z: 0 };
          setSelected(nextCourse.recipe ? -1 : nextCourse.id - 1);
          setActiveCourse(nextCourse);
          setPartyCourse(nextCourse.id);
          lastFinished.current = false;
          setSnap(initial);
          setNotice('');
          engine.current?.build();
        },
        roster: (members) => engine.current?.setMembers(members),
        ended: (reason) => {
          simulation.reset(simulation.course);
          engine.current?.setMembers([]);
          engine.current?.build();
          setSnap(initial);
          setNotice(reason);
          setModal('party');
        },
      });
      party.current = room;
      room.connect(host, playerName.trim() || 'Tumbler', color, joinCode);
    } catch {
      setPartyView({
        ...emptyParty,
        status: 'error',
        error: 'Multiplayer could not start. Please reload and try again.',
      });
    }
  };
  const leaveParty = () => {
    party.current?.close();
    party.current = null;
    setPartyView(emptyParty);
    engine.current?.memberColors.clear();
    setSeries(false);
    load(course);
  };
  const copyInvite = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', partyView.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyState('Invite link copied!');
    } catch {
      setCopyState(`Share this room code: ${partyView.code}`);
    }
  };
  const persistCourses = (recipes: CourseRecipe[]) => {
    try {
      localStorage.setItem('tumble-club-courses-v1', JSON.stringify(recipes));
      setSavedCourses(recipes);
      return true;
    } catch {
      return false;
    }
  };
  const saveCourse = (recipe: CourseRecipe, replaces?: number) => {
    const next = savedCourses.filter(
      (r) => recipeKey(r) !== replaces && recipeKey(r) !== recipeKey(recipe),
    );
    if (next.length >= MAX_SAVED_COURSES)
      return 'You have 16 saved courses. Delete one to make space.';
    return persistCourses([...next, recipe])
      ? 'Saved on this device.'
      : 'Saving is unavailable. Allow browser storage, or test this course without saving.';
  };
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (sound.current) {
      sound.current.enabled = !next;
      if (!next) sound.current.unlock();
    }
  };
  const touchMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      dx = (e.clientX - r.left - r.width / 2) / (r.width * 0.35),
      dy = (e.clientY - r.top - r.height / 2) / (r.height * 0.35),
      length = Math.max(1, Math.hypot(dx, dy));
    touch.current = { x: dx / length, z: -dy / length };
  };
  const icons = [
    Flag,
    RotateCcw,
    Sparkles,
    Zap,
    AudioLines,
    ArrowRight,
    Gamepad2,
    Flag,
    Zap,
    Crown,
  ];

  return (
    <main className={`game-shell ${racing ? 'in-race' : ''}`}>
      {!racing && (
        <header className="topbar">
          <button
            className="brand"
            onClick={home}
            aria-label="Tumble Club home"
          >
            <span className="brand-symbol">
              <Sparkles size={25} strokeWidth={2.8} />
            </span>
            <span>
              TUMBLE
              <span className="brand-bottom">
                CLUB<span className="brand-dot">✦</span>
              </span>
            </span>
          </button>
          <nav aria-label="Game menu">
            <button className="nav-active" onClick={home}>
              <Gamepad2 size={18} />
              Play
            </button>
            <button onClick={() => setModal('courses')}>
              The courses <span>{COURSES.length}</span>
            </button>
            <button className="party-nav" onClick={() => setModal('party')}>
              <Users size={17} />
              {inParty ? `Room ${partyView.code}` : 'Play with friends'}
            </button>
            <button onClick={() => setModal('builder')}>
              <Hammer size={17} /> Course builder
            </button>
            <button onClick={() => setModal('help')}>
              How to play <ArrowUpRight size={15} />
            </button>
          </nav>
          <div className="header-actions">
            <span className="completion">
              <Trophy size={19} />
              <b>{completed}</b>
              <span>/ {COURSES.length}</span>
            </span>
            <span className="header-rule" />
            <button
              className="icon-button"
              aria-label={muted ? 'Turn sound on' : 'Mute sound'}
              onClick={toggleSound}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </header>
      )}

      <section className="arena" aria-label="Tumble Club game">
        <div className="scene-container" ref={container} />
        {!racing && (
          <>
            <div className="lobby-shade" />
            <div className="lobby-copy">
              <div className="eyebrow">
                <Sparkles size={15} /> COSMIC ARCADE · 30 COURSES
              </div>
              <h1>
                RACE THE
                <br />
                <span>
                  COSMOS<span className="title-star">✳</span>
                </span>
              </h1>
              <p>
                Climb higher. Slide faster. Dodge meteors.
                <br />
                Build your own route and race your friends.
              </p>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(String(v))}
                aria-label="Race mode"
                className="mode-picker"
              >
                <label
                  htmlFor="quick-race-mode"
                  className={
                    mode === 'race' ? 'mode-option chosen' : 'mode-option'
                  }
                >
                  <RadioGroupItem id="quick-race-mode" value="race" />
                  <Flag size={17} />
                  Quick race
                </label>
                <label
                  htmlFor="championship-mode"
                  className={
                    mode === 'championship'
                      ? 'mode-option chosen'
                      : 'mode-option'
                  }
                >
                  <RadioGroupItem id="championship-mode" value="championship" />
                  <Crown size={18} />
                  Championship
                </label>
              </RadioGroup>
              <button
                className="play-button"
                onClick={start}
                disabled={!ready || !!error}
              >
                <span>
                  {ready
                    ? inParty
                      ? 'OPEN YOUR ROOM'
                      : 'LET’S RACE'
                    : 'WARMING UP…'}
                </span>
                <ArrowUpRight size={29} />
              </button>
              <div className="under-play">
                <Users size={15} />
                {mode === 'championship'
                  ? '30 rounds · Finish in the top 8 to advance'
                  : 'You + 11 bots · One delightfully chaotic race'}
              </div>
              <button
                className="friends-button"
                disabled={!ready}
                onClick={() => setModal('party')}
              >
                <Users size={17} />
                Play with friends <ArrowRight size={17} />
              </button>
              <button
                className="builder-shortcut text-button"
                onClick={() => setModal('builder')}
              >
                <Hammer size={17} /> Build your own course
              </button>
            </div>
            <div className="course-sticker">
              <span>
                <i />
                {course.recipe
                  ? 'CUSTOM COURSE'
                  : `COURSE ${String(selected + 1).padStart(2, '0')}`}
              </span>
              <strong>{course.name}</strong>
              <div>
                {course.difficulty}
                <span>•</span>
                {course.theme.toLowerCase()}
              </div>
            </div>
            <div className="character-picker">
              <span>YOUR COLOR</span>
              <div>
                {COLORS.map((c, i) => (
                  <button
                    key={c}
                    aria-label={`Choose ${['peach', 'purple', 'mint', 'yellow', 'pink', 'blue'][i]} racer`}
                    aria-pressed={color === i}
                    disabled={inParty}
                    style={{ background: c }}
                    className={color === i ? 'selected' : ''}
                    onClick={() => {
                      setColor(i);
                      engine.current?.setColor(i);
                    }}
                  >
                    {color === i && <Check size={16} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="scene-note">
              <span className="note-line" />A little wobble is part of the plan.
            </div>
          </>
        )}
        {error && (
          <div className="error-card" role="alert">
            <h2>A small pit stop</h2>
            <p>{error}</p>
            <button
              className="secondary-button"
              onClick={() => window.location.reload()}
            >
              Reload game
            </button>
          </div>
        )}
        {racing && (
          <>
            <div className="hud-top">
              <div className="hud-course">
                <button
                  className="icon-button"
                  aria-label="Pause game"
                  onClick={pause}
                >
                  <Pause size={20} />
                </button>
                <div>
                  <span>
                    {series
                      ? `CHAMPIONSHIP · ROUND ${selected + 1}/${COURSES.length}`
                      : course.recipe
                        ? 'CUSTOM COURSE'
                        : `COURSE ${String(selected + 1).padStart(2, '0')} / ${COURSES.length}`}
                  </span>
                  <h2>{course.name}</h2>
                </div>
              </div>
              <div className="hud-rank">
                <Users size={20} />
                <b>
                  {snap.rank}
                  <small> / 12</small>
                </b>
              </div>
              <div className="hud-clock">
                <span>TIME</span>
                <strong>{formatTime(snap.time)}</strong>
              </div>
            </div>
            <div className="race-objective">
              <Flag size={16} />
              {series
                ? 'Finish in the top 8 to qualify!'
                : inParty
                  ? snap.place
                    ? 'You finished! Waiting for your friends…'
                    : `ROOM ${partyView.code} · Race your friends!`
                  : 'Race to the finish!'}
              <span>150s limit</span>
            </div>
            {snap.state === 'countdown' && (
              <output className="countdown">
                <span>GET READY</span>
                <strong key={snap.countdown}>{snap.countdown || 'GO!'}</strong>
                <p>{course.tip}</p>
              </output>
            )}
            {notice && snap.state === 'racing' && (
              <output className="notice">{notice}</output>
            )}
            {inParty && partyView.error && (
              <output className="connection-notice" aria-live="polite">
                {partyView.error}
              </output>
            )}
            <div className="race-bottom">
              <div className="keyboard-hint">
                <kbd>W A S D</kbd> Move <span />
                <kbd>SPACE</kbd> Jump <span />
                <kbd>SHIFT</kbd> Dive
              </div>
              <div className="race-progress">
                <span>START</span>
                <Progress value={snap.progress} aria-label="Course progress" />
                <Flag size={17} />
              </div>
              <button
                className="icon-button"
                aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                onClick={() => {
                  if (document.fullscreenElement)
                    void document.exitFullscreen();
                  else
                    void document.documentElement
                      .requestFullscreen()
                      .catch(() =>
                        setNotice('Fullscreen is unavailable in this view.'),
                      );
                }}
              >
                <Maximize size={20} />
              </button>
            </div>
            {snap.state === 'racing' && (
              <div className="touch-controls">
                <div
                  className="joystick"
                  aria-label="Drag to move"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touchMove(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId))
                      touchMove(e);
                  }}
                  onPointerUp={() => (touch.current = { x: 0, z: 0 })}
                  onPointerCancel={() => (touch.current = { x: 0, z: 0 })}
                  onLostPointerCapture={() => (touch.current = { x: 0, z: 0 })}
                >
                  <ArrowUp />
                  <div>
                    <ArrowLeft />
                    <span />
                    <ArrowRight />
                  </div>
                  <ArrowDown />
                </div>
                <div className="touch-actions">
                  <button
                    aria-label="Dive"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (sim.current) sim.current.input.dive = true;
                    }}
                  >
                    DIVE
                  </button>
                  <button
                    aria-label="Jump"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (sim.current) sim.current.input.jump = true;
                    }}
                  >
                    JUMP
                    <ArrowUp size={19} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {!racing && (
        <section className="course-shelf" aria-label="Choose a course">
          <div className="shelf-heading">
            <div>
              <span className="section-kicker">PICK YOUR PLAYGROUND</span>
              <h2>30 worlds. Endless routes.</h2>
            </div>
            <button className="text-button" onClick={() => setModal('courses')}>
              Explore all courses <ArrowRight size={17} />
            </button>
          </div>
          <div className="course-strip">
            {COURSES.map((c, i) => (
              <button
                key={c.id}
                className={`course-card ${selected === i ? 'active' : ''}`}
                onClick={() => load(i)}
                aria-pressed={selected === i}
              >
                <div className="course-thumbnail">
                  <CourseMap index={i} />
                  <span className="course-number">
                    {String(c.id).padStart(2, '0')}
                  </span>
                  {records[c.id] && (
                    <span className="course-medal">
                      <Check size={13} />
                    </span>
                  )}
                </div>
                <div className="course-card-label">
                  <strong>{c.name}</strong>
                  {selected === i ? (
                    <span className="selected-dot" />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </div>
              </button>
            ))}
          </div>
          <footer>
            <span>
              <span className="footer-dot" /> All courses unlocked. All tumbles
              welcome.
            </span>
            <span>
              Made for the fun of it. <Sparkles size={13} />
            </span>
          </footer>
        </section>
      )}

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent
          className={
            modal === 'builder'
              ? 'game-dialog builder-dialog'
              : modal === 'courses'
                ? 'game-dialog courses-dialog'
                : 'game-dialog'
          }
        >
          <DialogTitle>
            {modal === 'builder'
              ? 'Build your next challenge.'
              : modal === 'party'
                ? 'Better with friends.'
                : modal === 'courses'
                  ? 'Pick your playground.'
                  : modal === 'help'
                    ? 'A crash course in tumbling.'
                    : 'Taking a breather?'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'builder'
              ? 'Arrange sections, test your route, and add it to your friend room.'
              : modal === 'party'
                ? 'Create a room, share the code, and race together. Up to 8 friends.'
                : modal === 'courses'
                  ? 'Thirty original courses. Pick any one and make it to the finish.'
                  : modal === 'help'
                    ? 'A little timing goes a long way. Here’s everything you need.'
                    : inParty
                      ? 'Online races keep running while this menu is open.'
                      : 'Your race is paused. Your rivals can wait.'}
          </DialogDescription>
          {modal === 'builder' && (
            <CourseEditor
              saved={savedCourses}
              inParty={inParty}
              roomCourses={partyView.customCourses}
              draft={editorDraft}
              setDraft={setEditorDraft}
              editingKey={editingKey}
              setEditingKey={setEditingKey}
              courseMessage={partyView.courseMessage}
              onSave={saveCourse}
              onDelete={(key) => {
                if (
                  !persistCourses(
                    savedCourses.filter((r) => recipeKey(r) !== key),
                  )
                )
                  setNotice('Browser storage is unavailable.');
              }}
              onTest={(recipe) => {
                setSeries(false);
                load(buildCourse(recipe), true);
              }}
              onAddToRoom={(recipe) =>
                party.current?.addCourse(recipe) ?? false
              }
            />
          )}
          {modal === 'party' && (
            <div className="party-content">
              {partyView.error && (
                <p className="party-error" role="alert">
                  {partyView.error}
                </p>
              )}
              {!inParty ? (
                <>
                  <label htmlFor="player-name">Your racer name</label>
                  <Input
                    id="player-name"
                    maxLength={20}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Tumbler"
                    disabled={partyView.status === 'connecting'}
                  />
                  <button
                    className="play-button"
                    disabled={!ready || partyView.status === 'connecting'}
                    onClick={() => void connectParty(true)}
                  >
                    {partyView.status === 'connecting'
                      ? 'CONNECTING…'
                      : 'CREATE A ROOM'}
                    <Users size={23} />
                  </button>
                  <div className="party-divider">or join your friends</div>
                  <label htmlFor="room-code">Room code</label>
                  <div className="join-row">
                    <Input
                      id="room-code"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z2-9]/g, '')
                            .slice(0, 8),
                        )
                      }
                      placeholder="ABCDEFGH"
                      maxLength={8}
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={partyView.status === 'connecting'}
                    />
                    <button
                      className="secondary-button"
                      disabled={
                        !ready ||
                        joinCode.length !== 8 ||
                        partyView.status === 'connecting'
                      }
                      onClick={() => void connectParty(false)}
                    >
                      Join <ArrowRight size={17} />
                    </button>
                  </div>
                  <p className="party-note">
                    The host runs the room and needs to keep this tab active.
                    Some work, school, or VPN networks may block direct
                    connections; try a home network or mobile hotspot.
                  </p>
                </>
              ) : (
                <>
                  <div className="invite-box">
                    <div>
                      <span>ROOM CODE</span>
                      <strong>{partyView.code}</strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Copy invitation link"
                      onClick={() => void copyInvite()}
                    >
                      <Copy size={21} />
                    </button>
                  </div>
                  {copyState && (
                    <output className="copy-feedback">{copyState}</output>
                  )}
                  <div className="roster-heading">
                    <strong>On the starting line</strong>
                    <span>{partyView.members.length} / 8 friends</span>
                  </div>
                  <ul className="party-roster">
                    {partyView.members.map((p) => (
                      <li key={p.id}>
                        <span
                          className="racer-swatch"
                          style={{ background: COLORS[p.color] }}
                        />
                        <strong>
                          {p.name}
                          {p.id === partyView.self ? ' (you)' : ''}
                        </strong>
                        <span>
                          {p.host ? (
                            <>
                              <Crown size={14} /> Host
                            </>
                          ) : (
                            'Ready'
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="party-note">
                    Empty places are filled by bots. Everyone races under the
                    same rules.
                  </p>
                  {partyView.host && partyView.status === 'waiting' && (
                    <>
                      <label htmlFor="party-course">Choose a course</label>
                      <NativeSelect
                        id="party-course"
                        value={partyCourse}
                        onChange={(e) => setPartyCourse(Number(e.target.value))}
                      >
                        {roomCourses.map((c) => (
                          <NativeSelectOption key={c.id} value={c.id}>
                            {c.recipe
                              ? 'Custom'
                              : String(c.id).padStart(2, '0')}{' '}
                            · {c.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <button
                        className="play-button"
                        disabled={partyView.members.length < 2}
                        onClick={() =>
                          party.current?.start(
                            roomCourses.find((c) => c.id === partyCourse) ??
                              COURSES[0],
                          )
                        }
                      >
                        START RACE <Flag size={23} />
                      </button>
                      {partyView.members.length < 2 && (
                        <p className="party-note">
                          Share your invitation and wait for at least one
                          friend.
                        </p>
                      )}
                    </>
                  )}
                  <div className="room-rotation">
                    <strong>Keep the party going</strong>
                    <p>
                      Every race ends with a 5-second countdown, then a random
                      course starts. This room stays together until the host
                      leaves.
                    </p>
                    {partyView.host ? (
                      <NativeSelect
                        aria-label="Automatic course rotation"
                        value={partyView.rotation}
                        onChange={(e) =>
                          party.current?.setRotation(
                            e.target.value as 'all' | 'custom',
                          )
                        }
                      >
                        <NativeSelectOption value="all">
                          All 30 courses + room creations
                        </NativeSelectOption>
                        <NativeSelectOption
                          value="custom"
                          disabled={!partyView.customCourses.length}
                        >
                          Room creations only
                        </NativeSelectOption>
                      </NativeSelect>
                    ) : (
                      <p>
                        Rotation:{' '}
                        {partyView.rotation === 'custom'
                          ? 'Room creations'
                          : 'All courses + room creations'}
                      </p>
                    )}
                    <button
                      className="secondary-button"
                      onClick={() => setModal('builder')}
                    >
                      <Hammer size={18} /> Build and add a course
                    </button>
                    <span>
                      {partyView.customCourses.length} / 16 custom courses in
                      this room
                    </span>
                    {partyView.customCourses.length > 0 && (
                      <ul>
                        {partyView.customCourses.map((r) => (
                          <li key={recipeKey(r)}>{r.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {!partyView.host && partyView.status === 'waiting' && (
                    <div className="waiting-host">
                      Waiting for the host to start the race…
                    </div>
                  )}
                  {partyView.status === 'racing' && (
                    <button
                      className="play-button"
                      onClick={() => setModal(null)}
                    >
                      BACK TO THE RACE <Play size={22} />
                    </button>
                  )}
                  <button className="text-button" onClick={leaveParty}>
                    Leave room <ArrowUpRight size={16} />
                  </button>
                </>
              )}
            </div>
          )}
          {modal === 'courses' && (
            <div className="course-grid">
              {COURSES.map((c, i) => {
                const Icon = icons[i % icons.length];
                return (
                  <button
                    key={c.id}
                    onClick={() => load(i)}
                    className={
                      selected === i
                        ? 'grid-course selected-course'
                        : 'grid-course'
                    }
                  >
                    <div className="grid-thumbnail">
                      <CourseMap index={i} />
                      <span>{String(c.id).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        <Icon size={13} />
                        {c.difficulty}
                        {records[c.id] &&
                          ` · Best ${formatTime(records[c.id].time)}`}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {modal === 'help' && (
            <div className="help-content">
              <div className="help-row">
                <span>
                  <kbd>W A S D</kbd>
                  <small>or arrow keys</small>
                </span>
                <div>
                  <strong>Find your feet</strong>
                  <p>
                    Move forward, backward, and sideways. Up always moves toward
                    the finish.
                  </p>
                </div>
              </div>
              <div className="help-row">
                <kbd>SPACE</kbd>
                <div>
                  <strong>Catch some air</strong>
                  <p>
                    Jump over obstacles and gaps. Get a running start for longer
                    jumps.
                  </p>
                </div>
              </div>
              <div className="help-row">
                <span>
                  <kbd>SHIFT</kbd>
                  <small>or E</small>
                </span>
                <div>
                  <strong>Commit to the dive</strong>
                  <p>
                    Press in the air to launch forward. You get one dive per
                    jump.
                  </p>
                </div>
              </div>
              <div className="help-row">
                <span>
                  <kbd>R</kbd>
                  <small>ESC to pause</small>
                </span>
                <div>
                  <strong>Try, tumble, repeat</strong>
                  <p>
                    Return to your last checkpoint. Green arches save your
                    position.
                  </p>
                </div>
              </div>
              <div className="help-note">
                <Gamepad2 size={22} />
                <p>
                  On a touchscreen, use the left pad to steer and the right
                  buttons to jump and dive.
                </p>
              </div>
              <p className="help-fine">
                Quick race: finish any course within 150 seconds. Championship:
                place in the top 8 in all 30 rounds. Your course records are
                saved on this device.
              </p>
            </div>
          )}
          {modal === 'pause' && (
            <div className="pause-actions">
              <button className="play-button" onClick={closeModal}>
                BACK TO THE CHAOS <Play size={22} />
              </button>
              {!inParty && (
                <button
                  className="secondary-button"
                  onClick={() => load(course, true)}
                >
                  <RotateCcw size={17} />
                  Restart course
                </button>
              )}
              <button className="secondary-button" onClick={toggleSound}>
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}Sound{' '}
                {muted ? 'off' : 'on'}
              </button>
              <button
                className="secondary-button"
                onClick={() => setModal(inParty ? 'party' : 'builder')}
              >
                <Hammer size={17} />
                {inParty ? 'Room & course builder' : 'Course builder'}
              </button>
              <button
                className="text-button"
                onClick={inParty ? leaveParty : home}
              >
                <ArrowLeft size={16} />
                {inParty ? 'Leave room' : 'Back to lobby'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={finished && modal !== 'builder' && modal !== 'party'}
        onOpenChange={() => {}}
      >
        <DialogContent
          className="game-dialog result-dialog"
          showCloseButton={false}
        >
          <div className="result-icon">
            {qualified ? (
              <Trophy size={50} />
            ) : snap.place ? (
              <Flag size={50} />
            ) : (
              <RotateCcw size={48} />
            )}
          </div>
          <span className="section-kicker">
            {series && selected === COURSES.length - 1 && qualified
              ? 'CHAMPIONSHIP COMPLETE'
              : snap.place
                ? 'FINISH LINE, MEET LEGEND.'
                : 'ONE MORE GO?'}
          </span>
          <DialogTitle>
            {series
              ? qualified
                ? selected === COURSES.length - 1
                  ? 'THE CROWN IS YOURS!'
                  : 'QUALIFIED!'
                : 'SO CLOSE!'
              : snap.place
                ? snap.rank === 1
                  ? 'FIRST CLASS TUMBLE!'
                  : 'WHAT A FINISH!'
                : 'TIME’S UP!'}
          </DialogTitle>
          <DialogDescription>
            {series && !qualified
              ? 'Finish in the top 8 to continue your championship.'
              : !snap.place
                ? 'The 150-second clock ran out. Your next run starts fresh.'
                : course.description}
          </DialogDescription>
          <div className="result-stats">
            <div>
              <span>PLACE</span>
              <strong>{snap.place ? `#${snap.rank}` : '—'}</strong>
            </div>
            <div>
              <span>TIME</span>
              <strong>{formatTime(snap.finishTime || snap.time)}</strong>
            </div>
            <div>
              <span>TUMBLES</span>
              <strong>{snap.falls}</strong>
            </div>
          </div>
          {series && (
            <p className="series-score">
              Championship points{' '}
              <strong>
                {seriesPoints + (qualified ? Math.max(1, 13 - snap.rank) : 0)}
              </strong>{' '}
              · Round {selected + 1} of {COURSES.length}
            </p>
          )}
          {inParty ? (
            <>
              <ul className="party-results">
                {partyView.members
                  .slice()
                  .sort(
                    (a, b) =>
                      (snap.places[a.id]?.place || 99) -
                      (snap.places[b.id]?.place || 99),
                  )
                  .map((p) => (
                    <li key={p.id}>
                      <b>
                        {snap.places[p.id]?.place
                          ? `#${snap.places[p.id].place}`
                          : '—'}
                      </b>
                      <span>
                        {p.name}
                        {p.id === partyView.self ? ' (you)' : ''}
                      </span>
                      <strong>
                        {snap.places[p.id]?.place
                          ? formatTime(snap.places[p.id].time)
                          : 'DNF'}
                      </strong>
                    </li>
                  ))}
              </ul>
              <output className="next-round">
                <span>NEXT RACE IN</span>
                <strong>{partyView.nextIn || 'GO'}</strong>
                <b>{partyView.nextName}</b>
                <small>Same room. Same friends. New course.</small>
              </output>
              <button className="text-button" onClick={leaveParty}>
                Leave room
              </button>
            </>
          ) : (!series || qualified) &&
            selected >= 0 &&
            selected < COURSES.length - 1 &&
            !!snap.place ? (
            <button className="play-button" onClick={next}>
              NEXT COURSE <ArrowRight size={24} />
            </button>
          ) : series && selected === COURSES.length - 1 && qualified ? (
            <button className="play-button" onClick={home}>
              CHAMPION’S LAP COMPLETE <Crown size={24} />
            </button>
          ) : (
            <button className="play-button" onClick={() => load(course, true)}>
              LET’S GO AGAIN <RotateCcw size={22} />
            </button>
          )}
          {!inParty && (
            <div className="result-links">
              <button onClick={() => load(course, true)}>
                <RotateCcw size={15} />
                Race again
              </button>
              <button onClick={home}>
                Back to lobby <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
