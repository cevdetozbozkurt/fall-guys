export const OUTFIT_COLORS = [
  '#ff8755',
  '#b28aff',
  '#37e4cf',
  '#ffe16b',
  '#ff64be',
  '#61c5ff',
] as const;
export const BODY_TYPES = [
  'bean',
  'round',
  'tall',
  'robot',
  'pear',
  'diamond',
  'astronaut',
  'pill',
  'marshmallow',
  'starborn',
] as const;
export const HEAD_TYPES = [
  'none',
  'cap',
  'crown',
  'mohawk',
  'beanie',
  'top_hat',
  'wizard',
  'pirate',
  'viking',
  'bunny',
  'cat',
  'antennae',
  'halo',
  'flower',
  'chef',
  'headphones',
  'afro',
  'ponytail',
  'spikes',
  'propeller',
] as const;
export const EYE_TYPES = [
  'visor',
  'glasses',
  'shades',
  'round_specs',
  'star_specs',
  'heart_specs',
  'monocle',
  'goggles',
  'vr',
  'cyclops',
  'ski',
  'aviator',
  'mask',
  'eyepatch',
  'hex_specs',
  'neon_band',
] as const;
export const BACK_TYPES = [
  'none',
  'jetpack',
  'angel',
  'bat',
  'rocket',
  'satchel',
  'cape',
  'turtle',
  'crystal',
  'boombox',
  'life_ring',
  'planet',
] as const;
export type Cosmetics = {
  color: (typeof OUTFIT_COLORS)[number];
  body: (typeof BODY_TYPES)[number];
  head: (typeof HEAD_TYPES)[number];
  eyes: (typeof EYE_TYPES)[number];
  back?: (typeof BACK_TYPES)[number];
};
export const DEFAULT_COSMETICS: Cosmetics = {
  color: '#ff8755',
  body: 'bean',
  head: 'none',
  eyes: 'visor',
  back: 'none',
};
export type CosmeticSlot = 'body' | 'head' | 'eyes' | 'back';
export type ShopItem = {
  id: string;
  slot: CosmeticSlot;
  value: string;
  name: string;
  price: number;
  color: Cosmetics['color'];
};
const names: Record<string, string> = {
  bean: 'Classic racer',
  round: 'Bubble body',
  tall: 'Tall tumbler',
  starborn: 'Starborn body',
  none: 'Unequipped',
  vr: 'VR explorer',
  round_specs: 'Round spectacles',
  star_specs: 'Star glasses',
  heart_specs: 'Heart glasses',
  hex_specs: 'Hex glasses',
  neon_band: 'Neon band',
  life_ring: 'Life ring',
  top_hat: 'Top hat',
};
const slots = {
  body: BODY_TYPES,
  head: HEAD_TYPES,
  eyes: EYE_TYPES,
  back: BACK_TYPES,
};
export const SHOP_ITEMS: ShopItem[] = Object.entries(slots).flatMap(
  ([slot, values]) =>
    values.map((value, index) => ({
      id: `${slot}:${value}`,
      slot: slot as CosmeticSlot,
      value,
      name:
        names[value] ??
        value.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
      price:
        (slot === 'body' && index < 3) ||
        (slot === 'head' && index < 4) ||
        (slot === 'eyes' && index < 3) ||
        value === 'none'
          ? 0
          : index % 3 === 0
            ? 3
            : 2,
      color: OUTFIT_COLORS[index % OUTFIT_COLORS.length],
    })),
);
export const FREE_ITEMS = SHOP_ITEMS.filter((item) => item.price === 0).map(
  (item) => item.id,
);
export const OUTFIT_BUNDLES = [
  {
    id: 'space-cadet',
    name: 'Space cadet',
    items: ['body:astronaut', 'head:antennae', 'eyes:vr', 'back:jetpack'],
  },
  {
    id: 'moon-mage',
    name: 'Moon mage',
    items: ['body:pear', 'head:wizard', 'eyes:star_specs', 'back:crystal'],
  },
  {
    id: 'sky-bunny',
    name: 'Sky bunny',
    items: ['body:marshmallow', 'head:bunny', 'eyes:heart_specs', 'back:angel'],
  },
] as const;
export function normalizeCosmetics(value: unknown): Cosmetics {
  const v =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const pick = <T extends readonly string[]>(
    values: T,
    key: string,
    fallback: T[number],
  ): T[number] =>
    values.includes(String(v[key])) ? (v[key] as T[number]) : fallback;
  return {
    color: pick(OUTFIT_COLORS, 'color', DEFAULT_COSMETICS.color),
    body: pick(BODY_TYPES, 'body', 'bean'),
    head: pick(HEAD_TYPES, 'head', 'none'),
    eyes: pick(EYE_TYPES, 'eyes', 'visor'),
    back: pick(BACK_TYPES, 'back', 'none'),
  };
}
export function equipItem(outfit: Cosmetics, item: ShopItem): Cosmetics {
  return normalizeCosmetics({ ...outfit, [item.slot]: item.value });
}
