import { COURSES } from './courses.ts';
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
  const course = COURSES[courseId - 1];
  if (!course?.starTimes || !Number.isFinite(time) || time <= 0 || time > 150)
    return 0;
  return time <= course.starTimes.gold
    ? 3
    : time <= course.starTimes.silver
      ? 2
      : 1;
}
export function unlockedThrough(progress: Progression) {
  let level = 1;
  while (level < 50 && progress.best[level] > 0) level++;
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
    id > 50 ||
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
  for (let id = 1; id <= 50; id++)
    if (data.best?.[id]) result = recordFinish(result, id, data.best[id]);
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
