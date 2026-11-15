// Correlation and regression for paired data.
//   Karl Pearson: r = Σxy / √(Σx² · Σy²), with x and y measured from their means.
//   Spearman: R = 1 − 6 (ΣD² + Σ(m³ − m)/12) / (n³ − n), tied values getting the average rank.
//   Regression: Y on X: Y − Ȳ = byx (X − X̄), byx = Σxy / Σx²; X on Y: X − X̄ = bxy (Y − Ȳ), bxy = Σxy / Σy².

import { tidy as clean, tsum } from "./tidy.js";

const sum = tsum;

export function validatePairs(X, Y, { needSpread = true } = {}) {
  const errors = [];
  if (X.length !== Y.length) errors.push("X and Y need the same number of values.");
  if (X.length < 3) errors.push("Enter at least three pairs.");
  if (X.some((v) => !Number.isFinite(v)) || Y.some((v) => !Number.isFinite(v))) errors.push("Every X and Y must be a number.");
  if (!errors.length && needSpread) {
    if (X.every((v) => v === X[0])) errors.push("All the X values are the same, so correlation cannot be measured (Σx² would be 0).");
    if (Y.every((v) => v === Y[0])) errors.push("All the Y values are the same, so correlation cannot be measured (Σy² would be 0).");
  }
  return errors;
}

export function pearson(X, Y) {
  const n = X.length, mx = clean(sum(X) / n), my = clean(sum(Y) / n);
  const rows = X.map((x, i) => { const dx = clean(x - mx), dy = clean(Y[i] - my); return { x, y: Y[i], dx, dy, dx2: clean(dx * dx), dy2: clean(dy * dy), dxdy: clean(dx * dy) }; });
  const Sxy = clean(sum(rows.map((r) => r.dxdy))), Sxx = clean(sum(rows.map((r) => r.dx2))), Syy = clean(sum(rows.map((r) => r.dy2)));
  const r = clean(Sxy / Math.sqrt(Sxx * Syy));
  return { n, sumX: clean(sum(X)), sumY: clean(sum(Y)), mx: clean(mx), my: clean(my), rows, Sxy, Sxx, Syy, r, strength: describe(r) };
}

export function describe(r) {
  const a = Math.abs(r), dir = r > 0 ? "positive" : "negative";
  if (a >= 1 - 1e-12) return `perfect ${dir}`;
  if (a === 0) return "no";
  if (a >= 0.75) return `high ${dir}`;
  if (a >= 0.5) return `moderate ${dir}`;
  if (a >= 0.25) return `low ${dir}`;
  return `very low ${dir}`;
}

// Ranks with 1 for the largest value, as in most textbooks; tied values share the average rank.
export function rank(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const ranks = new Array(values.length), ties = [];
  for (let k = 0; k < order.length;) {
    let e = k;
    while (e + 1 < order.length && order[e + 1][0] === order[k][0]) e++;
    const avg = (k + 1 + e + 1) / 2;
    for (let t = k; t <= e; t++) ranks[order[t][1]] = avg;
    if (e > k) ties.push({ value: order[k][0], m: e - k + 1, rank: avg, positions: [k + 1, e + 1] });
    k = e + 1;
  }
  return { ranks, ties };
}

// `given` = true when the inputs are ranks already (they are used as they are).
export function spearman(X, Y, given = false) {
  const n = X.length;
  const rx = given ? { ranks: X.slice(), ties: tiesOf(X) } : rank(X);
  const ry = given ? { ranks: Y.slice(), ties: tiesOf(Y) } : rank(Y);
  const rows = X.map((x, i) => { const D = clean(rx.ranks[i] - ry.ranks[i]); return { x, y: Y[i], rx: rx.ranks[i], ry: ry.ranks[i], D, D2: clean(D * D) }; });
  const sumD2 = clean(sum(rows.map((r) => r.D2)));
  const cfs = [...rx.ties, ...ry.ties].map((t) => ({ ...t, cf: clean((t.m ** 3 - t.m) / 12) }));
  const CF = clean(sum(cfs.map((t) => t.cf)));
  const R = clean(1 - (6 * (sumD2 + CF)) / (n ** 3 - n));
  return { n, rows, sumD2, ties: { x: rx.ties, y: ry.ties }, cfs, CF, R, strength: describe(R) };
}

function tiesOf(ranks) {
  const c = new Map();
  for (const r of ranks) c.set(r, (c.get(r) || 0) + 1);
  return [...c.entries()].filter(([, m]) => m > 1).map(([rank, m]) => ({ value: rank, m, rank }));
}

export function regression(X, Y) {
  const p = pearson(X, Y);
  const byx = clean(p.Sxy / p.Sxx), bxy = clean(p.Sxy / p.Syy);
  // Y = a + byx X and X = c + bxy Y
  const a = clean(p.my - byx * p.mx), c = clean(p.mx - bxy * p.my);
  return { ...p, byx, bxy, a, c, check: clean(Math.sign(p.Sxy) * Math.sqrt(byx * bxy)), yAt: (x) => clean(a + byx * x), xAt: (y) => clean(c + bxy * y) };
}

// Regression from summary figures: means, standard deviations and r.
export function fromSummary({ mx, my, sx, sy, r }) {
  const byx = clean(r * sy / sx), bxy = clean(r * sx / sy);
  const a = clean(my - byx * mx), c = clean(mx - bxy * my);
  return { mx, my, sx, sy, r, byx, bxy, a, c, yAt: (x) => clean(a + byx * x), xAt: (y) => clean(c + bxy * y) };
}

export function validateSummary(v) {
  const errors = [];
  for (const [k, name] of [["mx", "mean of X"], ["my", "mean of Y"], ["sx", "σx"], ["sy", "σy"], ["r", "r"]]) if (!Number.isFinite(v[k])) errors.push(`Enter the ${name}.`);
  if (!errors.length) {
    if (!(v.sx > 0) || !(v.sy > 0)) errors.push("The standard deviations must be more than zero.");
    if (Math.abs(v.r) > 1) errors.push("r must be between −1 and 1.");
  }
  return errors;
}
