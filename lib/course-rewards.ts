import { COURSE_TARGETS } from './course-balance.ts';
export type StarTargets = { gold: number; silver: number; target: number };
export const REWARDS: Record<number, StarTargets> = { ...COURSE_TARGETS };
export function installRewards(value: unknown) {
  if (!Array.isArray(value)) return;
  for (const t of value)
    if (
      t &&
      Number.isInteger(t.id) &&
      t.id >= 1 &&
      t.id <= 10000 &&
      [t.gold, t.silver, t.target].every(Number.isFinite) &&
      t.gold > 0 &&
      t.gold < t.silver &&
      t.silver < t.target &&
      t.target <= 150
    )
      REWARDS[t.id] = { gold: t.gold, silver: t.silver, target: t.target };
}
