import type { CourseRecipe } from './course-builder.ts';
/** A sentence needs words and final punctuation, in any of the supported languages. */
export function isSentence(text: string) {
  return (
    text.trim().length >= 12 &&
    text.trim().length <= 1200 &&
    /\p{L}+(?:[^\p{L}]+\p{L}+){2}/u.test(text) &&
    /[.!?…]["'”’)]?$/.test(text.trim())
  );
}
export function estimatedTargets(recipe: CourseRecipe) {
  const length =
    16 +
    recipe.segments.reduce(
      (sum, s) =>
        sum +
        (s.type === 'fork'
          ? 76
          : s.type === 'slalom'
            ? 54
            : s.type === 'left' || s.type === 'right'
              ? 38
              : 40),
      0,
    );
  const gold = Math.ceil(
    length / 10 + recipe.segments.filter((s) => s.type === 'climb').length * 4,
  );
  return { gold, silver: gold + 15, target: Math.max(50, gold + 30) };
}
