// Rounding for Stats Lab. OR Lab's clean() rounds to 9 decimal places, which turns the SD of
// 0.00001, 0.00002, 0.00003 into 0; here noise is removed relative to the size of the numbers.

// 12 significant digits: 0.30000000000000004 → 0.3, while 0.0000125 stays 0.0000125.
export const tidy = (x) => (x === 0 ? 0 : Number.isFinite(x) ? Number(x.toPrecision(12)) : x);

// A sum that is tiny next to its own terms is zero (0.1 + 0.2 − 0.3 → 0).
export function tsum(a) {
  let s = 0, m = 0;
  for (const v of a) { s += v; m += Math.abs(v); }
  return Math.abs(s) <= m * 1e-12 ? 0 : tidy(s);
}
