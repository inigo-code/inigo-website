// Time series trend by semi-averages and by moving averages, and the index numbers of
// Laspeyres, Paasche and Fisher, with the time-reversal and factor-reversal tests.

import { clean } from "../../or-lab/lib/num.js";

const sum = (a) => a.reduce((s, v) => s + v, 0);

export function validateSeries(t, y) {
  const errors = [];
  if (t.length < 4) errors.push("Enter at least four periods.");
  if (t.some((v) => !Number.isFinite(v))) errors.push("Every year (or period) must be a number.");
  if (y.some((v) => !Number.isFinite(v))) errors.push("Every value must be a number.");
  if (!errors.length) {
    for (let i = 1; i < t.length; i++) if (!(t[i] > t[i - 1])) { errors.push("Enter the years in increasing order."); break; }
    const g = t.slice(1).map((v, i) => clean(v - t[i]));
    if (!errors.length && g.some((v) => Math.abs(v - g[0]) > 1e-9)) errors.push("The years must be equally spaced (for example 2018, 2019, 2020 …).");
  }
  return errors;
}

// Semi-averages: split the series into two halves (leaving out the middle period when there is
// an odd number), average each half, and draw the straight line through the two averages.
export function semiAverage(t, y) {
  const n = t.length, half = Math.floor(n / 2), odd = n % 2 === 1;
  const A = { t: t.slice(0, half), y: y.slice(0, half) }, B = { t: t.slice(n - half), y: y.slice(n - half) };
  for (const P of [A, B]) { P.sumY = clean(sum(P.y)); P.avg = clean(P.sumY / P.y.length); P.mid = clean(sum(P.t) / P.t.length); }
  const slope = clean((B.avg - A.avg) / (B.mid - A.mid));
  const trend = t.map((x) => clean(A.avg + slope * (x - A.mid)));
  const gap = clean(t[1] - t[0]);
  return { odd, left: odd ? { t: t[half], y: y[half] } : null, A, B, slope, perPeriod: clean(slope * gap), trend };
}

// Moving averages of period k. An even period is centred by averaging pairs of moving averages.
export function movingAverage(t, y, k) {
  const n = y.length;
  const rows = t.map((x, i) => ({ t: x, y: y[i] }));
  if (k % 2 === 1) {
    const h = (k - 1) / 2;
    for (let i = h; i < n - h; i++) {
      const tot = clean(sum(y.slice(i - h, i + h + 1)));
      Object.assign(rows[i], { total: tot, trend: clean(tot / k) });
    }
    return { k, even: false, rows };
  }
  // Even period: k-period totals sit between periods; two of them add to a centred total of 2k values.
  const totals = [];
  for (let i = 0; i + k <= n; i++) totals.push(clean(sum(y.slice(i, i + k))));
  for (let j = 0; j + 1 < totals.length; j++) {
    const i = j + k / 2;
    const c = clean(totals[j] + totals[j + 1]);
    Object.assign(rows[i], { totalA: totals[j], totalB: totals[j + 1], centred: c, trend: clean(c / (2 * k)) });
  }
  return { k, even: true, totals, rows };
}

// ----- Index numbers -----

export function validateIndex(items) {
  const errors = [];
  if (items.length < 1) errors.push("Enter at least one item.");
  items.forEach((it, i) => {
    for (const [k, name] of [["p0", "base-year price"], ["q0", "base-year quantity"], ["p1", "current-year price"], ["q1", "current-year quantity"]]) {
      if (!Number.isFinite(it[k])) errors.push(`Item ${i + 1}: enter the ${name}.`);
      else if (it[k] < 0) errors.push(`Item ${i + 1}: the ${name} cannot be negative.`);
    }
  });
  if (!errors.length) {
    const t = totals(items);
    if (t.p0q0 === 0 || t.p0q1 === 0) errors.push("The base-year values Σp₀q₀ and Σp₀q₁ must be more than zero.");
  }
  return errors;
}

function totals(items) {
  const S = (f) => clean(sum(items.map(f)));
  return { p1q0: S((x) => x.p1 * x.q0), p0q0: S((x) => x.p0 * x.q0), p1q1: S((x) => x.p1 * x.q1), p0q1: S((x) => x.p0 * x.q1) };
}

export function indexNumbers(items) {
  const T = totals(items);
  const rows = items.map((x) => ({ ...x, p1q0: clean(x.p1 * x.q0), p0q0: clean(x.p0 * x.q0), p1q1: clean(x.p1 * x.q1), p0q1: clean(x.p0 * x.q1) }));
  const L = clean((T.p1q0 / T.p0q0) * 100), P = clean((T.p1q1 / T.p0q1) * 100);
  const F = clean(Math.sqrt((T.p1q0 / T.p0q0) * (T.p1q1 / T.p0q1)) * 100);
  // Time reversal: P01 × P10 = 1. Factor reversal: P01 × Q01 = Σp1q1 / Σp0q0.
  const P01 = Math.sqrt((T.p1q0 / T.p0q0) * (T.p1q1 / T.p0q1));
  const P10 = Math.sqrt((T.p0q1 / T.p1q1) * (T.p0q0 / T.p1q0));
  const Q01 = Math.sqrt((T.p0q1 / T.p0q0) * (T.p1q1 / T.p1q0));
  return {
    rows, T, L, P, F,
    trt: { P01: clean(P01), P10: clean(P10), product: clean(P01 * P10), holds: Math.abs(P01 * P10 - 1) < 1e-9 },
    frt: { Q01: clean(Q01), product: clean(P01 * Q01), value: clean(T.p1q1 / T.p0q0), holds: Math.abs(P01 * Q01 - T.p1q1 / T.p0q0) < 1e-9 * Math.max(1, T.p1q1 / T.p0q0) },
  };
}
