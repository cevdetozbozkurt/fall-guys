'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Radar, UserRound, Users } from 'lucide-react';
import {
  gameBackend,
  backendMessage,
  type Account,
  type GameBackend,
  type MatchAssignment,
  type QueueStatus,
} from '@/lib/backend';
import './account-panel.css';

type MatchmakingOptions = {
  account: Account | null;
  getPeerId: () => Promise<string>;
  onMatch: (assignment: MatchAssignment) => Promise<void>;
  onAssignment: (assignment: MatchAssignment) => void;
  // Keep the leased public Peer open during automatic recovery. Its identity is
  // still in the queue; dispose the old Party's channels and listeners only.
  onClosed: (matchId?: string) => void;
  backend?: GameBackend;
};

export function useMatchmaking(options: MatchmakingOptions) {
  const backend = options.backend ?? gameBackend;
  const [status, setStatus] = useState<QueueStatus>({
    state: 'idle',
    target: 5,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(options);
  useEffect(() => {
    live.current = options;
  });
  const statusRef = useRef<QueueStatus>(status);
  const wanted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const peerId = useRef('');
  const connecting = useRef<string | null>(null);
  const pendingTick = useRef<Promise<QueueStatus> | null>(null);
  const poll = useRef<(generation: number) => Promise<void>>(async () => {});
  const putStatus = useCallback((value: QueueStatus) => {
    statusRef.current = value;
    if (mounted.current) setStatus(value);
  }, []);

  const accept = useCallback(
    (next: QueueStatus, token: number) => {
      if (!wanted.current || token !== generation.current || !mounted.current)
        return;
      const previous = statusRef.current;
      const changedMatch =
        previous.state === 'matched' &&
        (next.state !== 'matched' || previous.matchId !== next.matchId);
      if (changedMatch) {
        connecting.current = null;
        live.current.onClosed(previous.matchId);
      }
      putStatus(next);
      setError('');
      if (next.state === 'matched') live.current.onAssignment(next);
      if (next.state === 'matched' && connecting.current !== next.matchId) {
        connecting.current = next.matchId;
        // The network handshake must not block database heartbeats.
        void live.current
          .onMatch(next)
          .then(() => {
            if (!wanted.current || token !== generation.current)
              live.current.onClosed(next.matchId);
          })
          .catch(async (cause: unknown) => {
            if (
              token !== generation.current ||
              connecting.current !== next.matchId
            )
              return;
            wanted.current = false;
            ++generation.current;
            clearTimeout(timer.current);
            setError(backendMessage(cause));
            try {
              await backend.leaveMatch(next.matchId);
              await backend.cancelQueue();
            } catch {
              /* The lease expires if service is unreachable. */
            }
            connecting.current = null;
            live.current.onClosed(next.matchId);
            putStatus({ state: 'idle', target: 5 });
          });
      }
    },
    [backend, putStatus],
  );

  useEffect(() => {
    poll.current = async (token: number) => {
      if (!wanted.current || token !== generation.current) return;
      try {
        const request = backend.queueTick(peerId.current, false);
        pendingTick.current = request;
        const next = await request;
        if (pendingTick.current === request) pendingTick.current = null;
        if (
          next.state === 'idle' &&
          wanted.current &&
          token === generation.current
        ) {
          // A lost connection can expire a queue lease. A still-active Search
          // intent rejoins explicitly after recovery; an ordinary heartbeat does not.
          const joined = backend.queueTick(peerId.current, true);
          pendingTick.current = joined;
          accept(await joined, token);
          if (pendingTick.current === joined) pendingTick.current = null;
        } else accept(next, token);
      } catch (cause) {
        if (wanted.current && token === generation.current && mounted.current)
          setError(backendMessage(cause));
      } finally {
        if (wanted.current && token === generation.current)
          timer.current = setTimeout(() => void poll.current(token), 3000);
      }
    };
  }, [accept, backend]);

  const start = useCallback(async () => {
    if (wanted.current || busy) return;
    if (!backend.configured) {
      setError(
        'Public matchmaking is not available yet. Private friend rooms are ready to play.',
      );
      return;
    }
    if (!live.current.account?.profile) {
      setError('Sign in and choose a player name before searching.');
      return;
    }
    const token = ++generation.current;
    wanted.current = true;
    setBusy(true);
    setError('');
    try {
      peerId.current = await live.current.getPeerId();
      if (!wanted.current || token !== generation.current) return;
      const request = backend.queueTick(peerId.current, true);
      pendingTick.current = request;
      accept(await request, token);
      if (pendingTick.current === request) pendingTick.current = null;
      if (wanted.current && token === generation.current)
        timer.current = setTimeout(() => void poll.current(token), 3000);
    } catch (cause) {
      if (token === generation.current) {
        wanted.current = false;
        setError(backendMessage(cause));
        putStatus({ state: 'idle', target: 5 });
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [accept, backend, busy, putStatus]);

  const cancel = async () => {
    wanted.current = false;
    ++generation.current;
    clearTimeout(timer.current);
    setBusy(true);
    try {
      // Drain a tick before canceling, so its allocation cannot arrive after us.
      try {
        await pendingTick.current;
      } catch {
        /* Cancel below still checks authoritative membership. */
      }
      if (backend.configured) {
        const current = await backend.cancelQueue();
        if (current.state === 'matched')
          await backend.leaveMatch(current.matchId);
        await backend.cancelQueue();
      }
      if (mounted.current) setError('');
    } catch (cause) {
      if (mounted.current) setError(backendMessage(cause));
    } finally {
      pendingTick.current = null;
      connecting.current = null;
      live.current.onClosed();
      putStatus({ state: 'idle', target: 5 });
      if (mounted.current) setBusy(false);
    }
  };

  const transportFailed = async (matchId: string, reason: string) => {
    if (
      statusRef.current.state !== 'matched' ||
      statusRef.current.matchId !== matchId
    )
      return;
    await cancel();
    if (mounted.current) setError(reason);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      wanted.current = false;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Cancel the latest request and timer, not their mount-time values.
      ++generation.current;
      clearTimeout(timer.current);
    };
  }, []);
  const userId = options.account?.userId;
  useEffect(() => {
    if (!userId && wanted.current) {
      wanted.current = false;
      ++generation.current;
      clearTimeout(timer.current);
      connecting.current = null;
      live.current.onClosed();
      putStatus({ state: 'idle', target: 5 });
    }
  }, [putStatus, userId]);
  return {
    status,
    searching: status.state === 'searching',
    busy,
    error,
    start,
    cancel,
    transportFailed,
  };
}

export type MatchmakingController = ReturnType<typeof useMatchmaking>;
export default function MatchmakingPanel({
  controller,
  account,
  onAccount,
  inPrivateRoom = false,
  backend = gameBackend,
}: {
  controller: MatchmakingController;
  account: Account | null;
  onAccount: () => void;
  inPrivateRoom?: boolean;
  backend?: GameBackend;
}) {
  const { status, busy, error, start, cancel } = controller;
  const count =
    status.state === 'matched'
      ? status.members.filter((m) => m.accepted).length
      : status.state === 'searching'
        ? status.players
        : 0;
  const active = status.state !== 'idle';
  return (
    <section className="tc-online-panel tc-match-panel">
      <span className="tc-eyebrow">Public online game</span>
      <h2>
        {status.state === 'matched'
          ? status.phase === 'playing'
            ? 'Your crew is racing'
            : 'Meet your crew'
          : active
            ? 'Searching for players…'
            : 'Find your next crew'}
      </h2>
      <div className="tc-match-orbit" data-searching={active || busy}>
        <Radar size={38} />
      </div>
      {!backend.configured ? (
        <p>
          Public matchmaking is not available yet. You can still race with
          friends using a private room code.
        </p>
      ) : !account?.profile ? (
        <>
          <p>Sign in and choose a player name to meet other racers.</p>
          <button className="tc-primary" type="button" onClick={onAccount}>
            <UserRound size={17} />
            {account ? 'Choose player name' : 'Sign in to play'}
          </button>
        </>
      ) : (
        <>
          <div
            className="tc-match-players"
            aria-label={`${count} of 5 players ${status.state === 'matched' ? 'connected' : 'found'}`}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="tc-match-slot" data-ready={i < count}>
                {i < count ? <Check size={20} /> : <UserRound size={20} />}
              </span>
            ))}
          </div>
          <output>
            {status.state === 'matched'
              ? status.phase === 'playing'
                ? 'The lobby stays together for the next course.'
                : `${count}/5 connected. Joining the same lobby…`
              : status.state === 'searching'
                ? `${count}/5 players found. The game starts when five real players are ready.`
                : 'Five players. Fifty courses. A new challenge every round.'}
          </output>
          {status.state === 'matched' && (
            <ul className="tc-match-members">
              {status.members.map((m) => (
                <li key={m.userId}>
                  {m.username}
                  {m.userId === status.hostUserId ? ' · host' : ''}
                </li>
              ))}
            </ul>
          )}
          {active ? (
            <button
              className="tc-secondary"
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
            >
              {busy
                ? 'Leaving…'
                : status.state === 'matched'
                  ? 'Leave this game'
                  : 'Cancel search'}
            </button>
          ) : (
            <button
              className="tc-primary"
              type="button"
              disabled={busy || inPrivateRoom}
              onClick={() => void start()}
            >
              <Users size={17} />
              {busy ? 'Connecting…' : 'Search for a game'}
            </button>
          )}
          {inPrivateRoom && !active && (
            <p className="tc-muted">
              Leave your private room before starting a public search.
            </p>
          )}
          {!active && (
            <p className="tc-muted">
              You can cancel at any time while waiting for a group.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="tc-notice tc-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
