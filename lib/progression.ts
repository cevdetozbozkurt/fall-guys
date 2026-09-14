import { COURSES } from './courses.ts';
import { REWARDS } from './course-rewards.ts';
import { FREE_ITEMS, SHOP_ITEMS, OUTFIT_BUNDLES } from './cosmetics.ts';
export type Progression = {
  version: 2;
  best: Record<string, number>;
  owned: string[];
  spent: number;
};
export const newProgression = (): Progression => ({
  version: 2,
  best: {},
  owned: [...FREE_ITEMS],
  spent: 0,
});
export function starsFor(courseId: number, time: number) {
  const target = REWARDS[courseId];
  if (!target || !Number.isFinite(time) || time <= 0 || time > 150) return 0;
  return time <= target.gold ? 3 : time <= target.silver ? 2 : 1;
}
export function unlockedThrough(progress: Progression) {
  let level = 1;
  for (const c of COURSES) {
    level = c.id;
    if (!(progress.best[c.id] > 0)) break;
  }
  return level;
}
export function earnedStars(progress: Progression) {
  return Object.entries(progress.best).reduce(
    (total, [id, time]) => total + starsFor(Number(id), time),
    0,
  );
}
export function starBalance(progress: Progression) {
  return Math.max(0, earnedStars(progress) - progress.spent);
}
export function recordFinish(
  progress: Progression,
  id: number,
  time: number,
): Progression {
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    !COURSES.some((c) => c.id === id) ||
    id > unlockedThrough(progress) ||
    !starsFor(id, time)
  )
    return progress;
  return {
    ...progress,
    best: {
      ...progress.best,
      [id]: Math.min(progress.best[id] ?? Infinity, time),
    },
  };
}
export function purchaseItems(progress: Progression, id: string): Progression {
  const bundle = OUTFIT_BUNDLES.find((b) => b.id === id);
  const ids = bundle ? [...bundle.items] : [id];
  if (ids.some((id) => !SHOP_ITEMS.some((item) => item.id === id)))
    throw Error('This item is not available.');
  const missing = SHOP_ITEMS.filter(
    (item) => ids.includes(item.id) && !progress.owned.includes(item.id),
  );
  const price = missing.reduce((total, item) => total + item.price, 0);
  if (price > starBalance(progress))
    throw Error(`You need ${price - starBalance(progress)} more stars.`);
  return {
    ...progress,
    spent: progress.spent + price,
    owned: [...new Set([...progress.owned, ...ids])],
  };
}
export function parseProgression(value: unknown): Progression {
  if (!value || typeof value !== 'object') return newProgression();
  const data = value as Partial<Progression>;
  if (data.version !== 2) return newProgression();
  let result = newProgression();
  for (const { id } of COURSES)
    if (data.best?.[id]) result = recordFinish(result, id, data.best[id]);
  // Retired courses keep their earned stars, but no longer block new unlocks.
  for (const [id, time] of Object.entries(data.best ?? {}))
    if (
      Number(id) > 50 &&
      !COURSES.some((c) => c.id === Number(id)) &&
      starsFor(Number(id), time)
    )
      result.best[id] = time;
  const owned = Array.isArray(data.owned)
    ? data.owned.filter(
        (id) => typeof id === 'string' && SHOP_ITEMS.some((i) => i.id === id),
      )
    : [];
  const validSpent =
    Number.isInteger(data.spent) &&
    Number(data.spent) >= 0 &&
    Number(data.spent) <= earnedStars(result);
  if (validSpent) {
    result.owned = [...new Set([...FREE_ITEMS, ...owned])];
    result.spent = Number(data.spent);
  }
  return result;
}
