'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COURSES } from '@/lib/courses';
import { gameBackend, backendMessage } from '@/lib/backend';
import {
  newProgression,
  parseProgression,
  recordFinish,
  purchaseItems,
  type Progression,
} from '@/lib/progression';
const key = (id?: string) => 'tumble-progression-v2:' + (id ?? 'guest');
function withLocalBest(remote: Progression, local: Progression) {
  let merged = remote;
  for (const { id } of COURSES)
    if (local.best[id]) merged = recordFinish(merged, id, local.best[id]);
  return merged;
}
export function useProgression(userId?: string, catalogRevision = 0) {
  const [progress, setProgress] = useState(newProgression),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const current = useRef(newProgression()),
    identity = useRef(userId),
    queue = useRef(Promise.resolve()),
    buying = useRef(false);
  const save = useCallback((value: Progression, id?: string) => {
    if (identity.current !== id) return;
    current.current = value;
    setProgress(value);
    try {
      localStorage.setItem(key(id), JSON.stringify(value));
    } catch {
      /* Optional device storage. */
    }
  }, []);
  const sync = useCallback(
    async (owner: string) => {
      if (identity.current !== owner) return;
      let remote = await gameBackend.progression();
      for (const { id } of COURSES) {
        if (identity.current !== owner) return;
        const time = current.current.best[id];
        if (time && (!remote.best[id] || time < remote.best[id]))
          remote = await gameBackend.recordFinish(id, time);
      }
      if (identity.current === owner) {
        save(withLocalBest(remote, current.current), owner);
        setMessage('');
      }
    },
    [save],
  );
  useEffect(() => {
    if (!catalogRevision) return;
    identity.current = userId;
    let cancelled = false;
    let local = newProgression();
    try {
      local = parseProgression(
        JSON.parse(localStorage.getItem(key(userId)) ?? 'null'),
      );
    } catch {
      /* Invalid old records are not imported into the longer courses. */
    }
    save(local, userId);
    const online = () => {
      if (userId)
        queue.current = queue.current.then(async () => {
          if (cancelled) return;
          try {
            await sync(userId);
          } catch (e) {
            if (!cancelled)
              setMessage('Progress saved on this device. ' + backendMessage(e));
          }
        });
    };
    online();
    window.addEventListener('online', online);
    return () => {
      cancelled = true;
      window.removeEventListener('online', online);
    };
  }, [userId, save, sync, catalogRevision]);
  const finish = useCallback(
    (id: number, time: number) => {
      const owner = identity.current,
        next = recordFinish(current.current, id, time);
      if (next === current.current) return;
      save(next, owner);
      if (owner)
        queue.current = queue.current.then(async () => {
          if (identity.current !== owner) return;
          try {
            await sync(owner);
          } catch (e) {
            if (identity.current === owner)
              setMessage('Progress saved on this device. ' + backendMessage(e));
          }
        });
    },
    [save, sync],
  );
  const buy = useCallback(
    async (id: string) => {
      if (buying.current) return false;
      const owner = identity.current;
      buying.current = true;
      setBusy(true);
      setMessage('');
      try {
        await queue.current;
        if (identity.current !== owner) return false;
        if (owner) await sync(owner);
        if (identity.current !== owner) return false;
        const next = owner
          ? await gameBackend.buyCosmetic(id)
          : purchaseItems(current.current, id);
        if (identity.current !== owner) return false;
        save(withLocalBest(next, current.current), owner);
        return true;
      } catch (e) {
        if (identity.current === owner) setMessage(backendMessage(e));
        return false;
      } finally {
        buying.current = false;
        setBusy(false);
      }
    },
    [save, sync],
  );
  return { progress, busy, message, finish, buy };
}
