export const OUTFIT_COLORS = [
  '#ff8755',
  '#b28aff',
  '#37e4cf',
  '#ffe16b',
  '#ff64be',
  '#61c5ff',
] as const;
export type Cosmetics = {
  color: (typeof OUTFIT_COLORS)[number];
  body: 'bean' | 'round' | 'tall';
  head: 'none' | 'cap' | 'crown' | 'mohawk';
  eyes: 'visor' | 'glasses' | 'shades';
};
export const DEFAULT_COSMETICS: Cosmetics = {
  color: '#ff8755',
  body: 'bean',
  head: 'none',
  eyes: 'visor',
};
export function normalizeCosmetics(value: unknown): Cosmetics {
  const v =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    color: OUTFIT_COLORS.includes(v.color as Cosmetics['color'])
      ? (v.color as Cosmetics['color'])
      : DEFAULT_COSMETICS.color,
    body: v.body === 'round' || v.body === 'tall' ? v.body : 'bean',
    head:
      v.head === 'cap' || v.head === 'crown' || v.head === 'mohawk'
        ? v.head
        : 'none',
    eyes: v.eyes === 'glasses' || v.eyes === 'shades' ? v.eyes : 'visor',
  };
}
