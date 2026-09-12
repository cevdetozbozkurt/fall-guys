'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UserRound,
  Menu,
  Star,
  Radar,
  Shirt,
  ShieldCheck,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
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
import RouteMap from './course-map';
import { cameraInput } from '@/lib/routes';
import AccountPanel, { useAccount } from './account-panel';
import StarShop from './star-shop';
import { useProgression } from './use-progression';
import { starBalance, starsFor, unlockedThrough } from '@/lib/progression';
import MatchmakingPanel, { useMatchmaking } from './matchmaking-panel';
import StaffPanel from './staff-panel';
import InstallGame, { useGameInstall } from './install-game';
import {
  gameBackend,
  backendMessage,
  type PublishedLevel,
  type SavedRecipe,
  type MatchAssignment,
} from '@/lib/backend';
import {
  DEFAULT_COSMETICS,
  normalizeCosmetics,
  type Cosmetics,
} from '@/lib/cosmetics';
import type { MatchPeer } from '@/lib/match-peer';
import type { PublicConnection } from '@/lib/multiplayer';
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

type Snapshot = {
  diveCooldown: number;
  kickCooldown: number;
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
  diveCooldown: 0,
  kickCooldown: 0,
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
  return <RouteMap course={COURSES[index]} />;
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
    lastFinished = useRef(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(0),
    [activeCourse, setActiveCourse] = useState<Course>(COURSES[0]),
    [savedCourses, setSavedCourses] = useState<CourseRecipe[]>([]),
    [editorDraft, setEditorDraft] = useState<CourseRecipe>(() =>
      structuredClone(DEFAULT_RECIPE),
    ),
    [editingKey, setEditingKey] = useState<number | undefined>(),
    [mode, setMode] = useState('race'),
    [muted, setMuted] = useState(false),
    [music, setMusic] = useState(true);
  const [snap, setSnap] = useState(initial),
    [modal, setModal] = useState<
      | 'courses'
      | 'help'
      | 'pause'
      | 'party'
      | 'builder'
      | 'account'
      | 'matchmaking'
      | 'staff'
      | 'outfit'
      | 'menu'
      | null
    >(null),
    [notice, setNotice] = useState(''),
    [series, setSeries] = useState(false),
    [seriesPoints, setSeriesPoints] = useState(0),
    [fullscreen, setFullscreen] = useState(false);
  const [partyView, setPartyView] = useState<PartyView>(emptyParty),
    [playerName, setPlayerName] = useState(''),
    [joinCode, setJoinCode] = useState(''),
    [partyCourse, setPartyCourse] = useState(1),
    [copyState, setCopyState] = useState('');
  const accountController = useAccount();
  const progression = useProgression(accountController.session?.user.id);
  const progressRef = useRef(progression);
  useEffect(() => {
    progressRef.current = progression;
  }, [progression]);
  const install = useGameInstall();
  const [cosmetics, setCosmetics] = useState<Cosmetics>({
    ...DEFAULT_COSMETICS,
  });
  const cosmeticsRef = useRef(cosmetics);
  const [published, setPublished] = useState<PublishedLevel[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [cloudSaved, setCloudSaved] = useState<SavedRecipe[]>([]);
  const [editingPublished, setEditingPublished] =
    useState<PublishedLevel | null>(null);
  const publicPeer = useRef<MatchPeer | null>(null);
  const publicOpening = useRef<Promise<MatchPeer> | null>(null);
  const setupParty = useRef<
    (host: boolean, online?: PublicConnection) => Promise<void>
  >(async () => {});
  const changeCosmetics = useCallback((value: Cosmetics) => {
    const outfit = normalizeCosmetics(value);
    cosmeticsRef.current = outfit;
    setCosmetics(outfit);
    engine.current?.setCosmetics(outfit);
    try {
      localStorage.setItem('tumble-club-outfit-v1', JSON.stringify(outfit));
    } catch {
      /* Device preferences are optional. */
    }
  }, []);
  const refreshCatalog = useCallback(async () => {
    try {
      setPublished(await gameBackend.publishedLevels());
      setCatalogError('');
    } catch (error) {
      setCatalogError(backendMessage(error));
    }
  }, []);
  const getPeerId = useCallback(async () => {
    if (publicPeer.current && !publicPeer.current.peer.destroyed)
      return publicPeer.current.peer.id;
    if (!publicOpening.current)
      publicOpening.current = import('@/lib/match-peer').then(
        ({ createMatchPeer }) => createMatchPeer(),
      );
    try {
      publicPeer.current = await publicOpening.current;
      return publicPeer.current.peer.id;
    } finally {
      publicOpening.current = null;
    }
  }, []);
  const closePublic = useCallback((matchId?: string) => {
    if (!party.current?.online) return;
    if (matchId && party.current.online.assignment.matchId !== matchId) return;
    const simulation = sim.current;
    party.current.close(false, true);
    party.current = null;
    setPartyView({ ...emptyParty });
    if (simulation) {
      simulation.reset(simulation.course);
      engine.current?.setMembers([]);
      engine.current?.build();
      setSnap(initial);
    }
  }, []);
  const onMatch = useCallback(async (assignment: MatchAssignment) => {
    const lease = publicPeer.current;
    if (!lease || lease.peer.destroyed)
      throw new Error('The game network disconnected. Search again.');
    await setupParty.current(assignment.userId === assignment.hostUserId, {
      lease,
      assignment,
      validate: (userId, ticket, peerId) =>
        gameBackend.validateJoin(assignment.matchId, userId, ticket, peerId),
      start: () => gameBackend.startMatch(assignment.matchId),
    });
  }, []);
  const matchmaking = useMatchmaking({
    account: accountController.account,
    getPeerId,
    onMatch,
    onAssignment: (assignment) => party.current?.updateAssignment(assignment),
    onClosed: closePublic,
  });
  const cancelPublic = async () => {
    if (matchmaking.status.state !== 'idle' || matchmaking.busy)
      await matchmaking.cancel();
    publicPeer.current?.destroy();
    publicPeer.current = null;
  };
  useEffect(() => {
    try {
      const outfit = localStorage.getItem('tumble-club-outfit-v1');
      // oxlint-disable-next-line react/react-compiler -- Synchronize the external device preference with the 3D scene after mount.
      if (outfit) changeCosmetics(normalizeCosmetics(JSON.parse(outfit)));
    } catch {
      /* Ignore invalid device preferences. */
    }
    return () => {
      publicPeer.current?.destroy();
    };
  }, [changeCosmetics]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Initial asynchronous catalog fetch subscribes this view to the backend.
    void refreshCatalog();
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshCatalog();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [refreshCatalog]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Opening the catalog refreshes external published data.
    if (modal === 'courses') void refreshCatalog();
  }, [modal, refreshCatalog]);
  useEffect(() => {
    const profile = accountController.account?.profile;
    if (!profile) {
      // oxlint-disable-next-line react/react-compiler -- Clear private account data immediately when the external auth session changes.
      setCloudSaved([]);
      return;
    }
    // oxlint-disable-next-line react/react-compiler -- Hydrate the imperative 3D scene from the authenticated profile.
    changeCosmetics(profile.cosmetics);
    setPlayerName(profile.username);
    let current = true;
    void gameBackend
      .savedRecipes()
      .then((rows) => {
        if (current) setCloudSaved(rows);
      })
      .catch((error) => {
        if (current) setNotice(backendMessage(error));
      });
    return () => {
      current = false;
    };
  }, [accountController.account?.profile, changeCosmetics]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- The external PASSWORD_RECOVERY event opens the password form.
    if (accountController.recovery) setModal('account');
  }, [accountController.recovery]);
  const inParty = ['waiting', 'racing', 'finished'].includes(partyView.status);
  const course = activeCourse,
    racing = snap.state !== 'lobby',
    finished = snap.state === 'finished',
    qualified = (snap.place ?? 0) > 0 && snap.rank <= 8;
  const unlocked = unlockedThrough(progression.progress);
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
    try {
      const enabled = localStorage.getItem('tumble-music') !== 'false';
      audio.setMusic(enabled);
      queueMicrotask(() => setMusic(enabled));
    } catch {}
    let destroyed = false,
      frame = 0,
      last = 0,
      accumulator = 0,
      uiElapsed = 0,
      renderElapsed = 0,
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
    import('@/lib/scene')
      .then(({ RaceScene: Scene }) => {
        if (destroyed || !container.current) return;
        const view = new Scene(container.current, simulation, 0);
        engine.current = view;
        view.setCosmetics(cosmeticsRef.current);
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
              Object.assign(
                simulation.input,
                cameraInput(
                  simulation.input.x,
                  simulation.input.z,
                  view.cameraYaw,
                ),
              );
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
          if (
            (simulation.player.finished || simulation.state === 'finished') &&
            !lastFinished.current
          ) {
            lastFinished.current = true;
            keys.current.clear();
            touch.current = { x: 0, z: 0 };
            if (simulation.player.finished) {
              progressRef.current.finish(
                simulation.course.id,
                simulation.player.finishTime || simulation.time,
              );
            }
          }
          uiElapsed += dt;
          if (uiElapsed > 0.08 && simulation.state !== 'lobby') {
            uiElapsed = 0;
            setSnap({
              diveCooldown: simulation.player.diveCooldown,
              kickCooldown: simulation.player.kickCooldown,
              place: simulation.player.finished,
              state: simulation.state,
              time: simulation.time,
              rank: simulation.rank,
              progress: Math.max(
                0,
                Math.min(
                  100,
                  (simulation.player.progress / simulation.course.length) * 100,
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
          renderElapsed += dt;
          if (simulation.state !== 'lobby' || renderElapsed >= 1 / 30) {
            view.render(renderElapsed);
            renderElapsed = 0;
          }
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
      simulation.input.kick = false;
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
          'KeyF',
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
      if (!e.repeat && e.code === 'KeyF') simulation.input.kick = true;
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
    if (
      nextCourse.id <= COURSES.length &&
      nextCourse.id > unlockedThrough(progressRef.current.progress)
    ) {
      setModal('courses');
      return;
    }
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
  const connectParty = async (host: boolean, online?: PublicConnection) => {
    if (!online) await cancelPublic();
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
            setModal(online ? 'matchmaking' : 'party');
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
          if (online)
            void matchmaking.transportFailed(online.assignment.matchId, reason);
          simulation.reset(simulation.course);
          engine.current?.setMembers([]);
          engine.current?.build();
          setSnap(initial);
          setNotice(reason);
          setModal(online ? 'matchmaking' : 'party');
        },
      });
      party.current = room;
      const profile = online?.assignment.members.find(
        (m) => m.userId === online.assignment.userId,
      );
      const outfit = profile?.cosmetics ?? cosmeticsRef.current;
      room.connect(
        host,
        profile?.username ??
          (accountController.account?.profile?.username ||
            playerName.trim() ||
            'Tumbler'),
        COLORS.indexOf(outfit.color),
        joinCode,
        outfit,
        online,
      );
      if (host)
        for (const level of published.slice(0, 16))
          room.addCourse(level.recipe);
    } catch (cause) {
      if (online) throw cause;
      setPartyView({
        ...emptyParty,
        status: 'error',
        error: 'Multiplayer could not start. Please reload and try again.',
      });
    }
  };
  useEffect(() => {
    setupParty.current = connectParty;
  });
  const leaveParty = () => {
    if (party.current?.online) {
      void cancelPublic();
      return;
    }
    party.current?.close();
    party.current = null;
    setPartyView(emptyParty);
    engine.current?.memberColors.clear();
    engine.current?.memberCosmetics.clear();
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
  const saveCourse = async (recipe: CourseRecipe, replaces?: number) => {
    if (accountController.account?.profile) {
      try {
        const existing = cloudSaved.find(
          (r) =>
            recipeKey(r.recipe) === replaces ||
            recipeKey(r.recipe) === recipeKey(recipe),
        );
        const saved = await gameBackend.saveRecipe(recipe, existing?.id);
        setCloudSaved((current) => [
          saved,
          ...current.filter((r) => r.id !== saved.id),
        ]);
        return 'Saved to your account.';
      } catch (error) {
        return backendMessage(error);
      }
    }
    const next = savedCourses.filter(
      (r) => recipeKey(r) !== replaces && recipeKey(r) !== recipeKey(recipe),
    );
    if (next.length >= MAX_SAVED_COURSES)
      return 'You have 16 saved courses. Delete one to make space.';
    return persistCourses([...next, recipe])
      ? 'Saved on this device.'
      : 'Saving is unavailable. Allow browser storage, or test this course without saving.';
  };
  const deleteCourse = async (key: number) => {
    if (accountController.account?.profile) {
      const found = cloudSaved.find((r) => recipeKey(r.recipe) === key);
      if (found) {
        await gameBackend.deleteRecipe(found.id);
        setCloudSaved((current) => current.filter((r) => r.id !== found.id));
      }
    } else if (
      !persistCourses(savedCourses.filter((r) => recipeKey(r) !== key))
    )
      throw new Error('Browser storage is unavailable.');
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
          <div className="header-actions">
            <span
              className="star-wallet"
              aria-label={
                starBalance(progression.progress) + ' stars available'
              }
            >
              <Star size={19} />
              <b>{starBalance(progression.progress)}</b>
            </span>
            <button
              className="icon-button menu-toggle"
              aria-label="Open menu"
              aria-expanded={modal === 'menu'}
              onClick={() => setModal('menu')}
            >
              <Menu size={25} />
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
                <Sparkles size={15} /> COSMIC ARCADE · 50 COURSES
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
              <button
                className="play-button"
                onClick={start}
                disabled={!ready || !!error}
              >
                <span>
                  {ready
                    ? inParty
                      ? 'OPEN YOUR ROOM'
                      : 'PLAY'
                    : 'WARMING UP…'}
                </span>
                <ArrowUpRight size={29} />
              </button>
              <div className="home-actions">
                <button
                  className="friends-button"
                  disabled={!ready}
                  onClick={() => setModal('matchmaking')}
                >
                  <Radar size={18} /> Find Online Game <ArrowRight size={17} />
                </button>
                <button
                  className="friends-button"
                  disabled={!ready}
                  onClick={() => setModal('party')}
                >
                  <Users size={18} /> Play with Friends <ArrowRight size={17} />
                </button>
              </div>
              <p className="home-progress">
                Course {unlocked} / 50 unlocked · Earn stars. Find your style.
              </p>
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
                <kbd>SHIFT</kbd> Dive{' '}
                {snap.diveCooldown > 0
                  ? Math.ceil(snap.diveCooldown) + 's'
                  : '✓'}
                <span />
                <kbd>F</kbd> Kick{' '}
                {snap.kickCooldown > 0
                  ? Math.ceil(snap.kickCooldown) + 's'
                  : '✓'}
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
                    aria-label="Kick"
                    disabled={snap.kickCooldown > 0}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (sim.current) sim.current.input.kick = true;
                    }}
                    onKeyDown={(e) => {
                      if (
                        (e.key === 'Enter' || e.key === ' ') &&
                        !e.repeat &&
                        sim.current
                      )
                        sim.current.input.kick = true;
                    }}
                  >
                    {snap.kickCooldown > 0
                      ? Math.ceil(snap.kickCooldown) + 's'
                      : 'KICK'}
                  </button>
                  <button
                    aria-label="Dive"
                    disabled={snap.diveCooldown > 0}
                    onKeyDown={(e) => {
                      if (
                        (e.key === 'Enter' || e.key === ' ') &&
                        !e.repeat &&
                        sim.current
                      )
                        sim.current.input.dive = true;
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (sim.current) sim.current.input.dive = true;
                    }}
                  >
                    {snap.diveCooldown > 0
                      ? Math.ceil(snap.diveCooldown) + 's'
                      : 'DIVE'}
                  </button>
                  <button
                    aria-label="Jump"
                    onKeyDown={(e) => {
                      if (
                        (e.key === 'Enter' || e.key === ' ') &&
                        !e.repeat &&
                        sim.current
                      )
                        sim.current.input.jump = true;
                    }}
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

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent
          className={
            modal === 'outfit'
              ? 'game-dialog shop-dialog'
              : modal === 'builder'
                ? 'game-dialog builder-dialog'
                : modal === 'courses'
                  ? 'game-dialog courses-dialog'
                  : modal === 'staff'
                    ? 'game-dialog builder-dialog'
                    : 'game-dialog'
          }
        >
          <DialogTitle>
            {modal === 'menu'
              ? 'Your cosmic club.'
              : modal === 'account'
                ? 'Your player account.'
                : modal === 'matchmaking'
                  ? 'Race with the world.'
                  : modal === 'staff'
                    ? 'Your design studio.'
                    : modal === 'outfit'
                      ? 'Make your racer yours.'
                      : modal === 'builder'
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
            {modal === 'menu'
              ? 'Courses, style and everything in between.'
              : modal === 'account'
                ? 'Save your look and courses across devices.'
                : modal === 'matchmaking'
                  ? 'Search for five real players and stay together between rounds.'
                  : modal === 'staff'
                    ? 'Create courses for the whole club.'
                    : modal === 'outfit'
                      ? 'Try on 56 wearables. Earn stars to unlock your favorites.'
                      : modal === 'builder'
                        ? 'Arrange sections, test your route, and add it to your friend room.'
                        : modal === 'party'
                          ? 'Create a room, share the code, and race together. Up to 8 friends.'
                          : modal === 'courses'
                            ? 'Finish each course to unlock the next. Every finish earns at least one star.'
                            : modal === 'help'
                              ? 'A little timing goes a long way. Here’s everything you need.'
                              : inParty
                                ? 'Online races keep running while this menu is open.'
                                : 'Your race is paused. Your rivals can wait.'}
          </DialogDescription>
          {modal === 'account' && (
            <AccountPanel
              key={`${accountController.session?.user.id ?? 'guest'}:${accountController.account?.profile?.username ?? ''}`}
              controller={accountController}
              cosmetics={cosmetics}
              onCosmeticsChange={changeCosmetics}
              onBeforeSignOut={async () => {
                await cancelPublic();
                if (party.current) leaveParty();
              }}
              onStaff={() => setModal('staff')}
              onCustomize={() => setModal('outfit')}
            />
          )}
          {modal === 'menu' && (
            <div className="expanded-menu">
              <button onClick={() => setModal('courses')}>
                <Flag />
                <span>
                  Courses<small>{unlocked} of 50 unlocked</small>
                </span>
                <ChevronRight />
              </button>
              <button disabled={inParty} onClick={() => setModal('outfit')}>
                <Shirt />
                <span>
                  Star shop & outfits<small>56 ways to make it yours</small>
                </span>
                <ChevronRight />
              </button>
              <button onClick={() => setModal('builder')}>
                <Hammer />
                <span>
                  Course builder
                  <small>Create a challenge for your friends</small>
                </span>
                <ChevronRight />
              </button>
              <button onClick={() => setModal('account')}>
                <UserRound />
                <span>
                  {accountController.account?.profile?.username ??
                    'Your account'}
                  <small>Sign in, save and sync</small>
                </span>
                <ChevronRight />
              </button>
              <button onClick={() => setModal('help')}>
                <Gamepad2 />
                <span>How to play</span>
                <ChevronRight />
              </button>
              <details className="menu-settings">
                <summary>Race & audio settings</summary>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(String(v))}
                  aria-label="Race mode"
                  className="mode-picker"
                >
                  <label className="mode-option" htmlFor="quick-race-mode">
                    <RadioGroupItem id="quick-race-mode" value="race" />
                    Quick race
                  </label>
                  <label className="mode-option" htmlFor="championship-mode">
                    <RadioGroupItem
                      id="championship-mode"
                      value="championship"
                    />
                    Championship
                  </label>
                </RadioGroup>
                <button className="tc-secondary" onClick={toggleSound}>
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />} Sound{' '}
                  {muted ? 'off' : 'on'}
                </button>
                <button
                  className="tc-secondary"
                  onClick={() => {
                    const next = !music;
                    setMusic(next);
                    sound.current?.setMusic(next);
                    if (next) sound.current?.unlock();
                    try {
                      localStorage.setItem('tumble-music', String(next));
                    } catch {}
                  }}
                >
                  <AudioLines size={18} /> Music {music ? 'on' : 'off'}
                </button>
              </details>
              <InstallGame controller={install} />
            </div>
          )}
          {modal === 'outfit' && (
            <>
              <StarShop
                value={cosmetics}
                progress={progression.progress}
                busy={progression.busy}
                onChange={changeCosmetics}
                onBuy={progression.buy}
                onSave={
                  accountController.account?.profile
                    ? async () => {
                        await gameBackend.saveProfile(
                          accountController.account!.profile!.username,
                          cosmetics,
                        );
                        await accountController.refresh();
                      }
                    : undefined
                }
              />
              {progression.message && (
                <output className="tc-muted">{progression.message}</output>
              )}
            </>
          )}
          {modal === 'matchmaking' && (
            <MatchmakingPanel
              controller={matchmaking}
              account={accountController.account}
              onAccount={() => setModal('account')}
              inPrivateRoom={inParty && !partyView.publicMatch}
            />
          )}
          {modal === 'staff' && (
            <StaffPanel
              account={accountController.account}
              draft={editorDraft}
              editing={editingPublished}
              setEditing={setEditingPublished}
              onEdit={(recipe) => {
                setEditorDraft(structuredClone(recipe));
                setEditingKey(undefined);
                setModal('builder');
              }}
              onPublished={refreshCatalog}
            />
          )}
          {modal === 'builder' && (
            <>
              {accountController.account &&
                accountController.account.role !== 'player' && (
                  <button
                    className="tc-secondary studio-shortcut"
                    onClick={() => setModal('staff')}
                  >
                    <ShieldCheck size={17} />
                    Publish &amp; manage courses
                  </button>
                )}
              <CourseEditor
                saved={
                  accountController.account?.profile
                    ? cloudSaved.map((r) => r.recipe)
                    : savedCourses
                }
                cloud={!!accountController.account?.profile}
                inParty={inParty}
                roomCourses={partyView.customCourses}
                draft={editorDraft}
                setDraft={setEditorDraft}
                editingKey={editingKey}
                setEditingKey={setEditingKey}
                courseMessage={partyView.courseMessage}
                onSave={saveCourse}
                onDelete={deleteCourse}
                onTest={(recipe) => {
                  setSeries(false);
                  load(buildCourse(recipe), true);
                }}
                onAddToRoom={(recipe) =>
                  party.current?.addCourse(recipe) ?? false
                }
              />
            </>
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
                    maxLength={24}
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
                          All 50 courses + room creations
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
                    disabled={c.id > unlocked}
                    aria-label={c.name + (c.id > unlocked ? ', locked' : '')}
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
                      <span
                        className="course-stars"
                        aria-label={
                          starsFor(c.id, progression.progress.best[c.id]) +
                          ' stars'
                        }
                      >
                        {'★'.repeat(
                          starsFor(c.id, progression.progress.best[c.id]),
                        )}
                        {'☆'.repeat(
                          3 - starsFor(c.id, progression.progress.best[c.id]),
                        )}
                      </span>
                      <span className="star-targets">
                        ★★★ {c.starTimes?.gold}s · ★★ {c.starTimes?.silver}s · ★
                        Finish
                      </span>
                      <small>
                        <Icon size={13} />
                        {c.difficulty}
                        {c.id > unlocked
                          ? ' · Locked'
                          : progression.progress.best[c.id]
                            ? ` · Best ${formatTime(progression.progress.best[c.id])}`
                            : ' · Ready'}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {modal === 'courses' && (
            <section className="community-courses">
              <h3>
                Designer courses <span>{published.length}</span>
              </h3>
              {catalogError ? (
                <p role="alert">{catalogError}</p>
              ) : published.length === 0 ? (
                <p>
                  New courses from the club&apos;s designers will appear here.
                </p>
              ) : (
                <div className="community-grid">
                  {published.map((level) => {
                    const c = buildCourse(level.recipe);
                    return (
                      <button
                        key={level.id}
                        onClick={() => {
                          if (inParty) {
                            party.current?.addCourse(level.recipe);
                            setModal('party');
                          } else {
                            setSeries(false);
                            load(c);
                          }
                        }}
                      >
                        <RouteMap course={c} />
                        <strong>{c.name}</strong>
                        <span>
                          {c.difficulty} · {c.recipe?.segments.length} sections
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
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
                    the camera’s direction. Steer into turns as the camera
                    follows.
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
                    Press in the air to launch forward. Diving recharges in 5
                    seconds.
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
              <div className="help-row">
                <kbd>F</kbd>
                <div>
                  <strong>Make some space</strong>
                  <p>
                    Kick a nearby runner in front of you to knock them off
                    balance for one second. Kicking recharges in five seconds.
                  </p>
                </div>
              </div>
              <div className="help-note">
                <Gamepad2 size={22} />
                <p>
                  On a touchscreen, use the left pad to steer and the right
                  buttons to jump, dive and kick.
                </p>
              </div>
              <p className="help-fine">
                Install from your browser&apos;s app menu. On iPhone or iPad,
                open in Safari, tap Share, then Add to Home Screen. Solo play
                works offline after the game has downloaded; online rooms and
                accounts need a connection.
              </p>
              <p className="help-fine">
                Quick race: finish any course within 150 seconds. Championship:
                place in the top 8 in all 50 rounds. Your course records are
                saved on this device, or synced with your account. Improve your
                best times to earn up to three stars per course. Online rooms
                can race all courses; solo unlocks advance in order.
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
          {course.starTimes && (
            <div className="result-stars">
              <strong>
                {snap.place
                  ? '★'.repeat(starsFor(course.id, snap.finishTime)) +
                    '☆'.repeat(3 - starsFor(course.id, snap.finishTime))
                  : '☆☆☆'}
              </strong>
              <span>
                ★★★ {course.starTimes.gold}s · ★★ {course.starTimes.silver}s · ★
                Finish
              </span>
              <small>
                {course.id > unlocked
                  ? 'Finish earlier solo courses to earn these stars.'
                  : 'Best runs earn stars once. Beat your best to earn more.'}
              </small>
            </div>
          )}
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
