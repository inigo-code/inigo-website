// Measures of central tendency and dispersion for the three kinds of series in B.B.A. textbooks
// (S. P. Gupta's conventions):
//   individual  a list of values
//   discrete    values x with frequencies f
//   continuous  classes (lower–upper) with frequencies f
// Positions: median (n+1)/2, quartiles (n+1)/4 and 3(n+1)/4 for individual and discrete series
// (individual series interpolate between items); N/2, N/4 and 3N/4 for continuous series.
// Standard deviation divides by n (the population formula used in these textbooks).

import { tidy as clean, tsum } from "./tidy.js";

const sum = tsum;

// The value at a (possibly fractional) position in a sorted list, as Gupta interpolates it.
function itemAt(sorted, pos) {
  const n = sorted.length;
  if (pos <= 1) return { value: sorted[0], text: `the 1st item, ${sorted[0]}` };
  if (pos >= n) return { value: sorted[n - 1], text: `the last item, ${sorted[n - 1]}` };
  const k = Math.floor(pos), frac = clean(pos - k);
  const a = sorted[k - 1], b = sorted[k];
  if (frac === 0) return { value: a, text: `item ${k}, which is ${a}`, k };
  return { value: clean(a + frac * (b - a)), text: `item ${k} + ${frac} × (item ${k + 1} − item ${k}) = ${a} + ${frac} × (${b} − ${a})`, k, frac, a, b };
}

function modeOfCounts(pairs) { // pairs: [[value, count]]
  const top = Math.max(...pairs.map((p) => p[1]));
  const modes = pairs.filter((p) => p[1] === top).map((p) => p[0]);
  return { top, modes };
}

export function validateIndividual(xs) {
  const errors = [];
  if (xs.length < 2) errors.push("Enter at least two values.");
  if (xs.some((x) => !Number.isFinite(x))) errors.push("Every value must be a number.");
  return errors;
}

export function individual(xs) {
  const n = xs.length, sorted = xs.slice().sort((a, b) => a - b);
  const mean = sum(xs) / n;
  const med = itemAt(sorted, (n + 1) / 2);
  const q1 = itemAt(sorted, (n + 1) / 4), q3 = itemAt(sorted, (3 * (n + 1)) / 4);
  const counts = new Map();
  for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
  const md = modeOfCounts([...counts.entries()].sort((a, b) => a[0] - b[0]));
  const mode = md.top === 1 ? { none: true } : md.modes.length > 1 ? { multi: md.modes, count: md.top } : { value: md.modes[0], count: md.top };
  return finish({ kind: "individual", n, sorted, sumX: sum(xs), mean, median: med.value, medPos: (n + 1) / 2, med, q1: q1.value, q3: q3.value, q1Item: q1, q3Item: q3, mode,
    lo: sorted[0], hi: sorted[n - 1],
    rows: xs.map((x) => ({ x, f: 1, m: x })) });
}

export function validateDiscrete(rows) {
  const errors = [];
  if (rows.length < 2) errors.push("Enter at least two values.");
  rows.forEach((r, i) => {
    if (!Number.isFinite(r.x)) errors.push(`Row ${i + 1}: enter the value x.`);
    if (!Number.isFinite(r.f) || r.f < 0) errors.push(`Row ${i + 1}: the frequency must be zero or more.`);
  });
  if (!errors.length && sum(rows.map((r) => r.f)) <= 0) errors.push("The frequencies must add up to more than zero.");
  const xs = rows.map((r) => r.x);
  if (!errors.length && new Set(xs).size !== xs.length) errors.push("Each value of x should appear once; add the frequencies of repeated values together.");
  return errors;
}

// The value whose cumulative frequency first reaches the position.
const byCf = (rows, pos) => { const r = rows.find((r) => r.cf >= pos - 1e-9) || rows[rows.length - 1]; return r; };

export function discrete(input) {
  const rows0 = input.slice().sort((a, b) => a.x - b.x);
  let cf = 0;
  const rows = rows0.map((r) => ({ x: r.x, f: r.f, m: r.x, cf: (cf = clean(cf + r.f)) }));
  const N = cf;
  const mean = sum(rows.map((r) => r.f * r.x)) / N;
  const medPos = (N + 1) / 2, q1Pos = (N + 1) / 4, q3Pos = (3 * (N + 1)) / 4;
  const medRow = byCf(rows, medPos), q1Row = byCf(rows, q1Pos), q3Row = byCf(rows, q3Pos);
  const md = modeOfCounts(rows.map((r) => [r.x, r.f]));
  const mode = md.modes.length > 1 ? { multi: md.modes, count: md.top } : { value: md.modes[0], count: md.top };
  const used = rows.filter((r) => r.f > 0);
  return finish({ kind: "discrete", n: N, rows, sumFX: sum(rows.map((r) => r.f * r.x)), mean, median: medRow.x, medPos, medRow, q1: q1Row.x, q3: q3Row.x, q1Pos, q3Pos, q1Row, q3Row, mode,
    lo: used[0].x, hi: used[used.length - 1].x });
}

export function validateContinuous(rows) {
  const errors = [], warnings = [];
  if (rows.length < 2) errors.push("Enter at least two classes.");
  rows.forEach((r, i) => {
    if (![r.lo, r.hi].every(Number.isFinite)) errors.push(`Class ${i + 1}: enter both class limits.`);
    else if (!(r.hi > r.lo)) errors.push(`Class ${i + 1}: the upper limit must be more than the lower limit.`);
    if (!Number.isFinite(r.f) || r.f < 0) errors.push(`Class ${i + 1}: the frequency must be zero or more.`);
  });
  if (!errors.length) {
    for (let i = 1; i < rows.length; i++) if (rows[i].lo < rows[i - 1].lo) { errors.push("Enter the classes in increasing order."); break; }
    for (let i = 1; i < rows.length && !errors.length; i++) if (rows[i].lo < rows[i - 1].hi - 1e-9) errors.push(`Classes ${i} and ${i + 1} overlap.`);
    if (!errors.length && sum(rows.map((r) => r.f)) <= 0) errors.push("The frequencies must add up to more than zero.");
  }
  return { errors, warnings };
}

// Classes such as 10–19, 20–29 (inclusive) become 9.5–19.5, 19.5–29.5 (exclusive).
export function exclusive(rows) {
  const gaps = rows.slice(1).map((r, i) => clean(r.lo - rows[i].hi));
  const gap = gaps.length && gaps.every((g) => g > 0 && Math.abs(g - gaps[0]) < 1e-9) ? gaps[0] : 0;
  if (!gap) return { rows: rows.map((r) => ({ ...r })), adjusted: false };
  const half = gap / 2;
  return { rows: rows.map((r) => ({ ...r, lo: clean(r.lo - half), hi: clean(r.hi + half), origLo: r.lo, origHi: r.hi })), adjusted: true, half };
}

// The class containing a position, and the interpolation formula L + (pos − cf) / f × h.
function locate(rows, pos) {
  const k = rows.findIndex((r) => r.cf >= pos - 1e-9 && r.f > 0);
  const i = k < 0 ? rows.length - 1 : k;
  const r = rows[i], cfBefore = i ? rows[i - 1].cf : 0, h = clean(r.hi - r.lo);
  return { i, L: r.lo, cf: cfBefore, f: r.f, h, pos, value: clean(r.lo + ((pos - cfBefore) / r.f) * h) };
}

export function continuous(input) {
  const ex = exclusive(input);
  let cf = 0;
  const rows = ex.rows.map((r) => ({ ...r, m: clean((r.lo + r.hi) / 2), cf: (cf = clean(cf + r.f)) }));
  const N = cf;
  const widths = rows.map((r) => clean(r.hi - r.lo));
  const equal = widths.every((w) => Math.abs(w - widths[0]) < 1e-9);
  const mean = sum(rows.map((r) => r.f * r.m)) / N;
  // Step deviations from an assumed mean (the mid-point of the middle class), when widths are equal.
  const A = rows[Math.floor((rows.length - 1) / 2)].m, h = widths[0];
  const step = equal ? { A, h, d: rows.map((r) => clean((r.m - A) / h)) } : null;
  const med = locate(rows, N / 2), q1 = locate(rows, N / 4), q3 = locate(rows, (3 * N) / 4);
  // Mode by the formula, from the class with the highest frequency.
  const top = Math.max(...rows.map((r) => r.f));
  const modal = rows.map((r, i) => i).filter((i) => rows[i].f === top);
  let mode;
  if (modal.length === 1) {
    const i = modal[0], f1 = rows[i].f, f0 = i ? rows[i - 1].f : 0, f2 = i < rows.length - 1 ? rows[i + 1].f : 0;
    const den = 2 * f1 - f0 - f2;
    if (den > 0) mode = { i, L: rows[i].lo, f0, f1, f2, h: widths[i], value: clean(rows[i].lo + ((f1 - f0) / den) * widths[i]) };
    else mode = { i, flat: true };
  } else mode = { multi: modal };
  return finish({ kind: "continuous", n: N, rows, adjusted: ex.adjusted, half: ex.half, equalWidths: equal, step, mean, med, median: med.value, q1Loc: q1, q3Loc: q3, q1: q1.value, q3: q3.value, mode,
    lo: rows[0].lo, hi: rows[rows.length - 1].hi });
}

// Everything that follows the same way for all three series.
function finish(r) {
  const rows = r.rows, N = r.n;
  r.mean = clean(r.mean);
  // When the mode cannot be found directly, textbooks use the empirical relation Mode = 3 Median − 2 Mean.
  if (r.mode.value === undefined) r.mode.empirical = clean(3 * r.median - 2 * r.mean);
  r.modeValue = r.mode.value ?? r.mode.empirical;
  r.range = clean(r.hi - r.lo);
  r.rangeCoef = r.hi + r.lo !== 0 ? clean((r.hi - r.lo) / (r.hi + r.lo)) : null;
  r.qd = clean((r.q3 - r.q1) / 2);
  r.qdCoef = r.q3 + r.q1 !== 0 ? clean((r.q3 - r.q1) / (r.q3 + r.q1)) : null;
  const dev = (c) => rows.map((x) => Math.abs(x.m - c));
  r.mdMeanSum = clean(sum(rows.map((x, i) => x.f * dev(r.mean)[i])));
  r.mdMedianSum = clean(sum(rows.map((x, i) => x.f * dev(r.median)[i])));
  r.mdMean = clean(r.mdMeanSum / N);
  r.mdMedian = clean(r.mdMedianSum / N);
  r.mdMeanCoef = r.mean !== 0 ? clean(r.mdMean / r.mean) : null;
  r.mdMedianCoef = r.median !== 0 ? clean(r.mdMedian / r.median) : null;
  r.sumSq = clean(sum(rows.map((x) => x.f * (x.m - r.mean) ** 2)));
  r.variance = clean(r.sumSq / N);
  r.sd = clean(Math.sqrt(r.variance));
  r.cv = r.mean !== 0 ? clean((r.sd / r.mean) * 100) : null;
  if (r.step) {
    const d = r.step.d;
    r.step.sumFd = clean(sum(rows.map((x, i) => x.f * d[i])));
    r.step.sumFd2 = clean(sum(rows.map((x, i) => x.f * d[i] ** 2)));
  }
  return r;
}
