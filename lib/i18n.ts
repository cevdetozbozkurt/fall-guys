import { TRANSLATIONS } from './translations.ts';
export type Language = 'tr' | 'en' | 'fr' | 'de';
export const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'tr', name: 'Türkçe', flag: 'tr' },
  { code: 'en', name: 'English', flag: 'gb' },
  { code: 'fr', name: 'Français', flag: 'fr' },
  { code: 'de', name: 'Deutsch', flag: 'de' },
];
let language: Language = 'tr';
try {
  const saved =
    typeof window !== 'undefined'
      ? localStorage.getItem('tumble-language')
      : null;
  if (LANGUAGES.some((l) => l.code === saved)) language = saved as Language;
} catch {
  /* Browser storage is optional. */
}
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setLanguage(value: Language) {
  if (!LANGUAGES.some((l) => l.code === value)) return;
  language = value;
  try {
    localStorage.setItem('tumble-language', value);
  } catch {
    /* Optional preference. */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  listeners.forEach((listener) => listener());
}
const decode = (value: string) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
const normalize = (value: string) =>
  decode(value).trim().replace(/\s+/g, ' ').toLowerCase();
const dictionary = new Map(TRANSLATIONS.map((row) => [normalize(row[0]), row]));
const templates = TRANSLATIONS.filter((row) => /\{\d+\}/.test(row[0])).map(
  (row) => {
    const keys: number[] = [];
    const source = normalize(row[0])
      .split(/(\{\d+\})/)
      .map((piece) => {
        if (/^\{\d+\}$/.test(piece)) {
          keys.push(Number(piece.slice(1, -1)));
          return '(.+?)';
        }
        return piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { row, keys, regex: new RegExp('^' + source + '$', 'iu') };
  },
);
// Prefer specific sentences over broad counters such as "{0} courses".
templates.sort(
  (a, b) =>
    b.row[0].replace(/\{\d+\}/g, '').length -
    a.row[0].replace(/\{\d+\}/g, '').length,
);
export function translate(text: string, locale: Language): string {
  const raw = decode(text),
    trimmed = raw.trim().replace(/\s+/g, ' ');
  if (locale === 'en' || !trimmed) return raw;
  const index = locale === 'tr' ? 1 : locale === 'fr' ? 2 : 3;
  let value = dictionary.get(normalize(trimmed))?.[index];
  if (!value)
    for (const template of templates) {
      const match = trimmed.match(template.regex);
      if (match) {
        value = template.row[index].replace(
          /\{(\d+)\}/g,
          (_, key) => match[template.keys.indexOf(Number(key)) + 1] ?? '',
        );
        break;
      }
    }
  if (!value && trimmed.includes(' · '))
    value = trimmed
      .split(' · ')
      .map((part) => translate(part, locale))
      .join(' · ');
  if (!value) return raw;
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed))
    value = value.toLocaleUpperCase(locale);
  return (
    raw.slice(0, raw.length - raw.trimStart().length) +
    value +
    raw.slice(raw.trimEnd().length)
  );
}
export function t<T extends string | null | undefined>(value: T): T {
  return (typeof value === 'string' ? translate(value, language) : value) as T;
}
