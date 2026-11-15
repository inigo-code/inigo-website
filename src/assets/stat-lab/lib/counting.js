// Permutations, combinations and simple probability, exactly (BigInt and fractions).

import { F } from "./frac.js";

export const MAX_N = 200;

export function factorial(n) {
  let r = 1n;
  for (let k = 2n; k <= BigInt(n); k++) r *= k;
  return r;
}
export function nPr(n, r) {
  if (r > n || r < 0) return 0n;
  let p = 1n;
  for (let k = 0; k < r; k++) p *= BigInt(n - k);
  return p;
}
export function nCr(n, r) {
  if (r > n || r < 0) return 0n;
  r = Math.min(r, n - r);
  let c = 1n;
  for (let k = 1; k <= r; k++) c = (c * BigInt(n - r + k)) / BigInt(k);
  return c;
}

// The factors written out for display: 5P3 = 5 × 4 × 3; 5C3 = (5 × 4 × 3) / (3 × 2 × 1).
export const fallingText = (n, r) => (r <= 0 ? "1" : Array.from({ length: Math.min(r, 8) }, (_, k) => n - k).join(" × ") + (r > 8 ? " × …" : ""));
export const factText = (r) => (r <= 1 ? "1" : Array.from({ length: Math.min(r, 8) }, (_, k) => r - k).join(" × ") + (r > 8 ? " × … × 1" : ""));

// Arrangements of the letters of a word: n! / (p! q! …) for repeated letters.
export function wordArrangements(word) {
  const letters = [...String(word).toUpperCase().replace(/[^A-Z]/g, "")];
  const counts = new Map();
  for (const c of letters) counts.set(c, (counts.get(c) || 0) + 1);
  const repeats = [...counts.entries()].filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]);
  const den = repeats.reduce((d, [, m]) => d * factorial(m), 1n);
  return { letters, n: letters.length, repeats, total: factorial(letters.length) / den, den };
}

export const prob = (fav, total) => new F(BigInt(fav), BigInt(total));

// ----- Classic simple-probability experiments -----

// Two (or more) dice: every outcome listed by its total.
export function diceTotals(dice = 2) {
  const counts = new Map();
  const go = (k, s) => { if (k === dice) { counts.set(s, (counts.get(s) || 0) + 1); return; } for (let f = 1; f <= 6; f++) go(k + 1, s + f); };
  go(0, 0);
  return { total: 6 ** dice, counts };
}
// P(total of the dice meets the test), e.g. test = (s) => s === 7.
export function diceEvent(dice, test) {
  const d = diceTotals(dice);
  let fav = 0;
  for (const [s, c] of d.counts) if (test(s)) fav += c;
  return { fav, total: d.total, p: prob(fav, d.total) };
}

// n coins: P(exactly k heads) = nCk / 2^n.
export function coins(n, k) {
  const fav = nCr(n, k), total = 2n ** BigInt(n);
  return { fav, total, p: new F(fav, total) };
}

// A bag with balls of several colours; draw `take` of them at once.
// want = how many of each colour are wanted (same order as counts). P = Π C(count, want) / C(total, take).
export function bag(counts, want) {
  const N = counts.reduce((s, c) => s + c, 0), take = want.reduce((s, w) => s + w, 0);
  const parts = counts.map((c, i) => ({ c, w: want[i], ways: nCr(c, want[i]) }));
  const fav = parts.reduce((s, p) => s * p.ways, 1n), total = nCr(N, take);
  return { N, take, parts, fav, total, p: total ? new F(fav, total) : null };
}

// Cards: a pack of 52. Draw `take` cards; how many of them must come from a group of `size` cards.
export const CARD_GROUPS = [
  ["ace", "an ace", 4], ["king", "a king", 4], ["queen", "a queen", 4], ["jack", "a jack", 4],
  ["face", "a face card (king, queen or jack)", 12], ["heart", "a heart", 13], ["spade", "a spade", 13],
  ["red", "a red card", 26], ["black", "a black card", 26], ["number", "a number card (2 to 10)", 36],
];
export function cards(size, take, k) {
  const fav = nCr(size, k) * nCr(52 - size, take - k), total = nCr(52, take);
  return { fav, total, p: new F(fav, total) };
}
